import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { passGap } from '../src/game/collisions.js';
import { Game } from '../src/game/game.js';
import { Juice, carveIntensity, parseJuiceLevel, sprayRate, type JuiceLevel } from '../src/game/juice.js';
import type { ParticlePool } from '../src/game/particles.js';
import type { Renderer } from '../src/game/renderer.js';
import type { RunResult } from '../src/game/session.js';
import type { JumpCallout, Obstacle } from '../src/game/types.js';
import type { World } from '../src/game/world.js';
import type { TiltInput } from '../src/input/TiltInput.js';

const STEP = 1 / 60;

interface GameInternals {
  update(dt: number): void;
  draw(): void;
  time: number;
  player: { x: number; y: number; speed: number; stumbleTimer: number };
  world: World;
  juice: Juice;
}

function leaning(x: number, y: number): TiltInput {
  return {
    name: 'scripted',
    needsUserGesture: false,
    calibrated: true,
    angles: null,
    start() {},
    stop() {},
    calibrate() {},
    update() {},
    sample: () => ({ x, y, grounded: false, sideGrounded: false }),
  };
}

/** A real Game on a stub renderer that records every shake and drawn callout. */
function headless(level: JuiceLevel, input = leaning(0, 0)) {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const shakes: number[] = [];
  const callouts: (JumpCallout | null)[] = [];
  let particles: ParticlePool | null = null;
  const renderer = {
    render: (...args: unknown[]) => {
      callouts.push(args[11] as JumpCallout | null);
      particles = args[13] as ParticlePool;
    },
    reset() {},
    addShake: (px: number) => shakes.push(px),
  } as unknown as Renderer;
  const game = new Game(renderer, input, null, level);
  game.start();
  const internals = game as unknown as GameInternals;
  internals.update(STEP);
  internals.world.ramps = [];
  return { game, internals, shakes, callouts, drawnParticles: () => particles as ParticlePool | null };
}

/** Puts a tree in the rider's path and steps until they hit it; returns the game time of the crash step. */
function crashIntoTree(internals: GameInternals): number {
  const { x, y } = internals.player;
  internals.world.obstacles = [{ id: -1, kind: 'pine', x, y: y + CONFIG.flatSpeed * 0.1, r: 16, scale: 1 }];
  for (let i = 0; i < 30 && internals.player.stumbleTimer <= 0; i += 1) internals.update(STEP);
  expect(internals.player.stumbleTimer).toBeGreaterThan(0);
  return internals.time;
}

/** Game seconds that pass over the next `steps` steps. */
function timePassing(internals: GameInternals, steps: number): number {
  const before = internals.time;
  for (let i = 0; i < steps; i += 1) internals.update(STEP);
  return internals.time - before;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('crash impact by effects setting', () => {
  it('off: a crash brings no hit-stop, no shake and no snow burst, but still calls out CRASH!', () => {
    const { internals, shakes, callouts, drawnParticles } = headless('off');
    crashIntoTree(internals);
    expect(timePassing(internals, 1)).toBeCloseTo(STEP, 10);
    internals.draw();
    expect(shakes).toEqual([]);
    expect(drawnParticles()?.alive).toBe(0);
    expect(callouts.at(-1)).toMatchObject({ kind: 'crash' });
  });

  it('full: the world hangs for crashHitStopS while the shake and burst play', () => {
    const { internals, shakes, drawnParticles } = headless('full');
    crashIntoTree(internals);
    const frozenSteps = Math.ceil(CONFIG.crashHitStopS / STEP - 1e-9);
    expect(timePassing(internals, frozenSteps)).toBe(0);
    expect(timePassing(internals, 1)).toBeCloseTo(STEP, 10);
    internals.draw();
    expect(shakes).toHaveLength(1);
    expect(shakes[0]).toBeGreaterThan(0);
    expect(shakes[0]).toBeLessThanOrEqual(CONFIG.crashShakePx);
    expect(drawnParticles()?.alive).toBeGreaterThan(0);
  });

  it('reduced: half the hit-stop and half the shake of full', () => {
    const full = headless('full');
    crashIntoTree(full.internals);
    const fullStop = full.internals.juice.hitStop;
    full.game.stop();
    const reduced = headless('reduced');
    crashIntoTree(reduced.internals);
    expect(reduced.internals.juice.hitStop).toBeCloseTo(fullStop / 2, 10);
    expect(reduced.shakes[0]).toBeCloseTo(full.shakes[0] / 2, 10);
  });

  it('never changes the run: the same course scores, lasts and travels the same at full and off', () => {
    const run = (level: JuiceLevel): RunResult & { crashes: number } => {
      vi.spyOn(Date, 'now').mockReturnValue(2024);
      const { game, internals } = headless(level, leaning(0.4, 0.5));
      let result: RunResult | null = null;
      game.onGameOverCallback((r) => (result = r));
      let crashes = 0;
      for (let i = 0; i < 300 / STEP && result === null; i += 1) {
        const before = internals.player.stumbleTimer;
        internals.update(STEP);
        if (internals.player.stumbleTimer > before) crashes += 1;
      }
      game.stop();
      if (result === null) throw new Error('not caught');
      return { ...(result as RunResult), crashes };
    };
    const full = run('full');
    expect(full.crashes).toBeGreaterThan(0);
    expect(run('off')).toEqual(full);
  });
});

describe('near misses', () => {
  const sinks = () => ({ shake: vi.fn(), whoosh: vi.fn() });

  it('plays once, then stays silent for nearMissCooldownS', () => {
    const s = sinks();
    const juice = new Juice('full', s);
    expect(juice.nearMiss(5, CONFIG.fullLeanSpeed, 10)).toMatchObject({ kind: 'close', at: 10, flash: true });
    expect(juice.nearMiss(5, CONFIG.fullLeanSpeed, 10 + CONFIG.nearMissCooldownS / 2)).toBeNull();
    expect(juice.nearMiss(5, CONFIG.fullLeanSpeed, 10 + CONFIG.nearMissCooldownS - 0.01)).toBeNull();
    expect(s.whoosh).toHaveBeenCalledTimes(1);
    expect(juice.nearMiss(5, CONFIG.fullLeanSpeed, 10 + CONFIG.nearMissCooldownS)).not.toBeNull();
    expect(s.whoosh).toHaveBeenCalledTimes(2);
  });

  it('whooshes louder for a closer pass', () => {
    const s = sinks();
    new Juice('full', s).nearMiss(CONFIG.nearMissMarginPx * 0.9, CONFIG.flatSpeed, 0);
    new Juice('full', s).nearMiss(1, CONFIG.flatSpeed, 0);
    const [[far], [near]] = s.whoosh.mock.calls;
    expect(near).toBeGreaterThan(far);
  });

  it('reduced keeps the CLOSE! callout without the flash; off has neither sound nor callout', () => {
    expect(new Juice('reduced', sinks()).nearMiss(5, CONFIG.flatSpeed, 0)).toMatchObject({ kind: 'close', flash: false });
    const s = sinks();
    expect(new Juice('off', s).nearMiss(5, CONFIG.flatSpeed, 0)).toBeNull();
    expect(s.whoosh).not.toHaveBeenCalled();
  });

  it('in a real run each tree counts once, and a dense row calls out only once per cooldown', () => {
    const { game, internals, callouts } = headless('full');
    const { y } = internals.player;
    const side = CONFIG.playerRadius + 12 + CONFIG.nearMissMarginPx / 2;
    const tree = (id: number, seconds: number): Obstacle => ({ id, kind: 'pine', x: side, y: y + CONFIG.flatSpeed * seconds, r: 12, scale: 1 });
    internals.world.obstacles = [tree(1, 0.3), tree(2, 0.6), tree(3, 0.9), tree(4, 1.5)];
    for (let i = 0; i < 2 / STEP; i += 1) {
      internals.update(STEP);
      internals.draw();
    }
    expect(game.nearMissCount).toBe(4);
    const closeTimes = new Set(callouts.filter((c) => c?.kind === 'close').map((c) => c?.at));
    expect(closeTimes.size).toBe(2);
    expect(internals.player.stumbleTimer).toBe(0);
  });

  it('passGap reports an obstacle on exactly one step as the rider rides by', () => {
    const ob: Obstacle = { id: 1, kind: 'rock', x: 40, y: 500, r: 16, scale: 1 };
    const gaps: number[] = [];
    for (let y = 0; y < 1000; y += 23) {
      const gap = passGap(y, y + 23, 0, CONFIG.playerRadius, ob);
      if (gap !== null) gaps.push(gap);
    }
    expect(gaps).toEqual([40 - CONFIG.playerRadius - 16]);
  });
});

describe('carve spray', () => {
  const leans = [0, 0.1, 0.25, 0.5, 0.75, 1];
  const speeds = [0, CONFIG.flatSpeed, (CONFIG.flatSpeed + CONFIG.fullLeanSpeed) / 2, CONFIG.fullLeanSpeed];

  it('rises monotonically with lean and with speed, from nothing riding straight to the most at a full carve', () => {
    for (const speed of speeds) {
      const rates = leans.map((lean) => sprayRate(lean, speed));
      for (let i = 1; i < rates.length; i += 1) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
    for (const lean of leans) {
      const rates = speeds.map((speed) => sprayRate(lean, speed));
      for (let i = 1; i < rates.length; i += 1) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
    expect(sprayRate(0, CONFIG.fullLeanSpeed)).toBe(0);
    expect(sprayRate(-1, CONFIG.fullLeanSpeed)).toBe(CONFIG.sprayMaxRate);
    expect(sprayRate(0.5, CONFIG.fullLeanSpeed)).toBeLessThan(sprayRate(1, CONFIG.fullLeanSpeed));
  });

  it('depends on lean × speed: a soft carve at speed sprays like a hard carve at half the speed', () => {
    expect(carveIntensity(0.5, CONFIG.fullLeanSpeed)).toBeCloseTo(carveIntensity(1, CONFIG.fullLeanSpeed / 2), 10);
    expect(sprayRate(0.5, CONFIG.fullLeanSpeed)).toBeCloseTo(sprayRate(1, CONFIG.fullLeanSpeed / 2), 10);
  });

  it('emits more, bigger particles for a harder carve, never more than the cap, and none when off', () => {
    const emitted = (level: JuiceLevel, lean: number) => {
      const juice = new Juice(level, { shake() {}, whoosh() {} }, () => 0.5);
      for (let i = 0; i < 30; i += 1) juice.carve(STEP, 0, 0, lean, CONFIG.fullLeanSpeed);
      const { particles } = juice;
      let size = 0;
      for (let i = 0; i < particles.capacity; i += 1) if (particles.isAlive(i)) size = Math.max(size, particles.size[i]);
      return { count: particles.alive, size };
    };
    const soft = emitted('full', 0.3);
    const hard = emitted('full', 1);
    expect(soft.count).toBeGreaterThan(0);
    expect(hard.count).toBeGreaterThan(soft.count);
    expect(hard.size).toBeGreaterThan(soft.size);
    expect(emitted('full', 0).count).toBe(0);
    expect(emitted('off', 1).count).toBe(0);

    const flood = new Juice('full', { shake() {}, whoosh() {} });
    for (let i = 0; i < 20; i += 1) flood.crash(0, 0, CONFIG.fullLeanSpeed);
    expect(flood.particles.alive).toBe(CONFIG.particleCap);
  });
});

describe('effects setting', () => {
  it('keeps a stored choice and defaults to reduced only for riders who ask for reduced motion', () => {
    expect(parseJuiceLevel(null, false)).toBe('full');
    expect(parseJuiceLevel(null, true)).toBe('reduced');
    expect(parseJuiceLevel('junk', true)).toBe('reduced');
    expect(parseJuiceLevel('full', true)).toBe('full');
    expect(parseJuiceLevel('off', false)).toBe('off');
  });
});

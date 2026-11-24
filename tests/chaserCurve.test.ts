import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { Game } from '../src/game/game.js';
import type { Renderer } from '../src/game/renderer.js';
import type { World } from '../src/game/world.js';
import type { TiltInput } from '../src/input/TiltInput.js';

const STEP = 1 / 60;
const LIMIT_S = 300;
const LEANS = [0, 0.3, 0.5, 0.7, 1] as const;
const SEEDS = [1, 7, 99, 2024, 31337];

interface Survival {
  seconds: number;
  metres: number;
  crashes: number;
  jumps: number;
}

interface GameInternals {
  update(dt: number): void;
  player: { stumbleTimer: number; jump: unknown };
  world: World;
}

const nullRenderer = { render() {}, reset() {}, addShake() {} } as unknown as Renderer;

/** A rider holding one forward lean, no steering, for the whole run. */
function constantLean(lean: number): TiltInput {
  return {
    name: 'constant',
    needsUserGesture: false,
    calibrated: true,
    angles: null,
    start() {},
    stop() {},
    calibrate() {},
    update() {},
    sample: () => ({ x: 0, y: lean, grounded: false, sideGrounded: false }),
  };
}

/**
 * The real Game loop, headless, down the middle of the slope at one lean until
 * the golem catches the rider. `clean` strips trees and ramps every frame, so
 * only rider speed and the chaser decide the run.
 */
function survive(lean: number, seed: number, clean: boolean): Survival {
  vi.spyOn(Date, 'now').mockReturnValue(seed);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const game = new Game(nullRenderer, constantLean(lean), null);
  let caught: { durationS: number; distanceM: number } | null = null;
  game.onGameOverCallback((run) => {
    caught = run;
  });
  game.start();
  const internals = game as unknown as GameInternals;
  let crashes = 0;
  let jumps = 0;
  for (let t = 0; t < LIMIT_S && caught === null; t += STEP) {
    if (clean) {
      internals.world.obstacles = [];
      internals.world.ramps = [];
    }
    const { stumbleTimer: before, jump: wasFlying } = internals.player;
    internals.update(STEP);
    if (internals.player.stumbleTimer > before) crashes += 1;
    if (internals.player.jump && !wasFlying) jumps += 1;
  }
  game.stop();
  if (caught === null) throw new Error(`lean ${lean}, seed ${seed}: not caught in ${LIMIT_S}s`);
  const run = caught as { durationS: number; distanceM: number };
  return { seconds: run.durationS, metres: run.distanceM, crashes, jumps };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function curve(clean: boolean) {
  return LEANS.map((lean) => {
    const runs = SEEDS.map((seed) => survive(lean, seed, clean));
    return { lean, runs, seconds: median(runs.map((r) => r.seconds)), metres: median(runs.map((r) => r.metres)) };
  });
}

describe('chaser survival curve (real Game, fixed lean, no steering)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const clean = curve(true);
  const course = curve(false);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  it.runIf(import.meta.env.CHASER_CURVE)('prints the curve (CHASER_CURVE=1 npx vitest run tests/chaserCurve.test.ts)', () => {
    console.table(
      LEANS.map((lean, i) => ({
        lean,
        'clean s': clean[i].seconds.toFixed(1),
        'clean m': clean[i].metres,
        'course median s': course[i].seconds.toFixed(1),
        'course median m': course[i].metres,
        'course s per seed': course[i].runs.map((r) => r.seconds.toFixed(1)).join(' '),
        crashes: course[i].runs.map((r) => r.crashes).join(' '),
        jumps: course[i].runs.map((r) => r.jumps).join(' '),
      })),
    );
    expect(clean).toHaveLength(LEANS.length);
  });

  it('catches every lean, and leaning forward always buys time', () => {
    for (let i = 1; i < clean.length; i += 1) expect(clean[i].seconds).toBeGreaterThan(clean[i - 1].seconds);
    expect(CONFIG.chaserSpeed).toBeGreaterThan(CONFIG.flatSpeed);
  });

  // The design intent in chaser.ts: coasters get caught, leaning buys time, and the run caps near 120 s.
  it.each([
    [0, 45, 60],
    [0.5, 75, 90],
    [1, 105, 120],
  ])('a clean run held at lean %d is caught between %d and %d s', (lean, min, max) => {
    const { seconds } = clean[LEANS.indexOf(lean as (typeof LEANS)[number])];
    expect(seconds).toBeGreaterThanOrEqual(min);
    expect(seconds).toBeLessThanOrEqual(max);
  });
});

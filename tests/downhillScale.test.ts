import { afterEach, describe, expect, it, vi } from 'vitest';
import * as config from '../src/config.js';
import { makeConfig, type Config } from '../src/config.js';

const K = 2.5;
const DT = 1 / 60;
const RUN_LIMIT_S = 600;

/** Speeds and distances along the slope: each is its K=1 value × K. */
const DOWNHILL: readonly (keyof Config)[] = [
  'downhillScale',
  'flatSpeed',
  'fullLeanSpeed',
  'chunkHeight',
  'gateSpacingY',
  'rampClearanceY',
  'typicalTakeoffSpeed',
  'chaserTriggerDistance',
  'chaserSpawnBehind',
  'chaserSpeed',
  'chaserAccel',
  'pxPerMeter',
];
/** Per-px rates: each is its K=1 value ÷ K. */
const PER_DOWNHILL_PX: readonly (keyof Config)[] = ['scorePerPx'];

describe('makeConfig', () => {
  const base = makeConfig(1);
  const scaled = makeConfig(K);

  it.each(DOWNHILL)('scales %s by K', (key) => {
    expect(scaled[key]).toBeCloseTo(base[key] * K, 9);
  });

  it.each(PER_DOWNHILL_PX)('divides %s by K', (key) => {
    expect(scaled[key]).toBeCloseTo(base[key] / K, 12);
  });

  it('keeps every other value (lateral sizes, times, counts, scores) as it is', () => {
    const scaledKeys = new Set<keyof Config>([...DOWNHILL, ...PER_DOWNHILL_PX]);
    const others = (Object.keys(base) as (keyof Config)[]).filter((key) => !scaledKeys.has(key));
    const lateralAndTimes = [
      'steerSpeed', 'worldHalfWidth', 'chaserTurnSpeed', 'gateHalfWidth', 'rampHalfWidth', 'rampClearanceX',
      'playerRadius', 'chaserCatchRadius', 'obstaclesPerChunk', 'airTimeAtTypicalSpeed', 'flipDurationS',
      'groundedGraceS', 'stumbleDuration', 'landingCarryS', 'speedEaseRate',
    ];
    expect(others).toEqual(expect.arrayContaining(lateralAndTimes));
    expect(Object.fromEntries(others.map((key) => [key, scaled[key]]))).toEqual(
      Object.fromEntries(others.map((key) => [key, base[key]])),
    );
  });
});

/** The real game modules, loaded fresh against the tuning for downhill scale `k`. */
async function gameAt(k: number) {
  vi.resetModules();
  vi.doMock('../src/config.js', () => ({ ...config, CONFIG: makeConfig(k) }));
  // One at a time: modules imported in parallel can miss the mock and load the real config.
  const { CONFIG } = await import('../src/config.js');
  const { Chaser } = await import('../src/game/chaser.js');
  const collisions = await import('../src/game/collisions.js');
  const jump = await import('../src/game/jump.js');
  const scoring = await import('../src/game/scoring.js');
  const speedGauge = await import('../src/game/speedGauge.js');
  const sprites = await import('../src/game/sprites.js');
  const { World } = await import('../src/game/world.js');
  expect(CONFIG.downhillScale).toBe(k);
  return { CONFIG, Chaser, collisions, jump, scoring, speedGauge, sprites, World };
}

type Game = Awaited<ReturnType<typeof gameAt>>;

interface Pace {
  caughtAtS: number;
  /** Seconds between consecutive gate crossings once at full speed. */
  gateGapsS: number[];
  obstaclesPerS: number;
  airTimesS: number[];
  scorePerS: number;
  metresPerS: number;
  pxPerS: number;
  /** Seconds the beast shows its lunge frame before the catch. */
  lungeLeadS: number;
}

/**
 * A rider at full forward lean down the middle of the slope, ignoring trees,
 * against the real chaser; with `takeRamps` they take off at every ramp they
 * reach (lined up perfectly) and land clean. Mirrors the per-frame order in Game.update.
 */
function ride({ CONFIG, Chaser, collisions, jump: jumps, scoring, speedGauge, sprites, World }: Game, seed: number, takeRamps: boolean): Pace {
  const world = new World(seed);
  const chaser = new Chaser();
  const target = speedGauge.leanTargetSpeed(1, 'off', false);
  let y = 0;
  let speed = CONFIG.flatSpeed;
  let jump: ReturnType<typeof jumps.takeoff> | null = null;
  let landingCarry = 0;
  let score = 0;
  let lungeAt: number | null = null;
  const gateTimes: number[] = [];
  const airTimesS: number[] = [];
  for (let time = DT; time < RUN_LIMIT_S; time += DT) {
    if (jump && jumps.hasLanded(jump, time)) {
      jump = null;
      landingCarry = CONFIG.landingCarryS;
    }
    if (jump) {
      speed = jump.speed;
    } else {
      speed = jumps.easeSpeed(speed, target, landingCarry, DT);
      landingCarry = Math.max(0, landingCarry - DT);
    }
    const prevY = y;
    y += speed * DT;
    score += scoring.scoreForDistance(speed * DT);
    world.ensure(y - 400, y + 1600);
    if (takeRamps && !jump && world.ramps.some((r) => collisions.gateCrossed(prevY, y, r.y))) {
      jump = jumps.takeoff(speed, time, 0);
      airTimesS.push(jump.duration);
      landingCarry = 0;
    }
    if (world.gates.some((g) => collisions.gateCrossed(prevY, y, g.y))) gateTimes.push(time);
    chaser.maybeActivate(y, 0, y);
    chaser.update(DT, 0, y);
    if (chaser.active && lungeAt === null && sprites.beastFrame(time, -chaser.x, y - chaser.y, false) === 'lunge') lungeAt = time;
    if (chaser.caught(0, y)) {
      const passed = world.obstacles.filter((ob) => ob.y < y).length;
      // Skip the first seconds, while the rider is still speeding up.
      const atSpeed = gateTimes.filter((t) => t > 3);
      return {
        caughtAtS: time,
        gateGapsS: atSpeed.slice(1).map((t, i) => t - atSpeed[i]),
        obstaclesPerS: passed / time,
        airTimesS,
        scorePerS: score / time,
        metresPerS: y / CONFIG.pxPerMeter / time,
        pxPerS: y / time,
        lungeLeadS: time - (lungeAt ?? time),
      };
    }
  }
  throw new Error(`seed ${seed}: the chaser never caught the rider`);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 1);

describe(`at downhill scale ${K} the pace per second matches scale 1`, () => {
  afterEach(() => {
    vi.doUnmock('../src/config.js');
  });

  async function rides(takeRamps: boolean) {
    const slowGame = await gameAt(1);
    const slow = SEEDS.map((seed) => ride(slowGame, seed, takeRamps));
    const fastGame = await gameAt(K);
    const fast = SEEDS.map((seed) => ride(fastGame, seed, takeRamps));
    /** Ratio of the K run's mean to the K=1 run's mean of one measure. */
    const ratio = (measure: (p: Pace) => number) => mean(fast.map(measure)) / mean(slow.map(measure));
    return { slow, fast, ratio };
  }

  it('keeps the air time of a takeoff at any lean', async () => {
    const leans = [0, 0.25, 0.5, 1];
    const airTimes = async (k: number) => {
      const { jump, speedGauge } = await gameAt(k);
      return leans.map((lean) => jump.takeoff(speedGauge.leanTargetSpeed(lean, 'off', false), 0, 0).duration);
    };
    const slow = await airTimes(1);
    const fast = await airTimes(K);
    expect(new Set(slow).size).toBeGreaterThan(2);
    fast.forEach((t, i) => expect(t).toBeCloseTo(slow[i], 9));
  });

  it.each([false, true])('with ramps: %s', async (takeRamps) => {
    const { slow, fast, ratio } = await rides(takeRamps);
    expect(ratio((p) => p.pxPerS)).toBeCloseTo(K, 1);
    expect(ratio((p) => p.caughtAtS)).toBeCloseTo(1, 1);
    expect(Math.abs(ratio((p) => p.caughtAtS) - 1)).toBeLessThan(0.03);
    expect(Math.abs(ratio((p) => mean(p.gateGapsS)) - 1)).toBeLessThan(0.02);
    expect(Math.abs(ratio((p) => p.obstaclesPerS) - 1)).toBeLessThan(0.03);
    expect(Math.abs(ratio((p) => p.scorePerS) - 1)).toBeLessThan(0.02);
    expect(Math.abs(ratio((p) => p.metresPerS) - 1)).toBeLessThan(0.02);
    expect(mean(fast.map((p) => p.lungeLeadS))).toBeGreaterThan(0.2);
    expect(mean(fast.map((p) => p.lungeLeadS))).toBeCloseTo(mean(slow.map((p) => p.lungeLeadS)), 1);
    if (takeRamps) {
      expect(Math.abs(ratio((p) => p.airTimesS.length / p.caughtAtS) - 1)).toBeLessThan(0.05);
      expect(Math.abs(ratio((p) => mean(p.airTimesS)) - 1)).toBeLessThan(0.03);
    } else {
      // Without ramps the course is the K=1 course stretched downhill, so each run ends within a frame or so.
      fast.forEach((p, i) => expect(p.caughtAtS).toBeCloseTo(slow[i].caughtAtS, 0));
    }
  });
});

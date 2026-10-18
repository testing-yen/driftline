import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { airTime, easeSpeed, hasLanded, landing, flipProgress, takeoff, updateAir } from '../src/game/jump.js';
import type { Jump } from '../src/game/types.js';

const DT = 1 / 60;
const TYPICAL = CONFIG.typicalTakeoffSpeed;
const HARD = CONFIG.trickLeanFraction + 0.05;
const SOFT = CONFIG.trickLeanFraction - 0.05;

/** Runs a jump from takeoff at t=0 to touchdown with a lean and grounded state per frame, then lands. */
function fly(leanAt: (t: number) => number, groundedAt: (t: number) => boolean = () => false, speed = TYPICAL) {
  let jump = takeoff(speed, 0, 0);
  let t = 0;
  while (!hasLanded(jump, t)) {
    t += DT;
    jump = updateAir(jump, leanAt(t), groundedAt(t), t);
  }
  return { jump, outcome: landing(jump, leanAt(t)) };
}

describe('airTime', () => {
  it('is about one second at typical takeoff speed', () => {
    expect(airTime(TYPICAL)).toBeCloseTo(CONFIG.airTimeAtTypicalSpeed);
    expect(CONFIG.airTimeAtTypicalSpeed).toBeGreaterThanOrEqual(0.8);
    expect(CONFIG.airTimeAtTypicalSpeed).toBeLessThanOrEqual(1.2);
  });

  it('grows with takeoff speed', () => {
    expect(airTime(TYPICAL * 1.2)).toBeGreaterThan(airTime(TYPICAL));
    expect(airTime(TYPICAL * 0.8)).toBeLessThan(airTime(TYPICAL));
  });

  it('is clamped at both ends', () => {
    expect(airTime(1)).toBe(CONFIG.minAirTimeS);
    expect(airTime(100_000)).toBe(CONFIG.maxAirTimeS);
  });
});

describe('takeoff', () => {
  it('locks air speed at takeoff speed times the boost', () => {
    expect(takeoff(400, 3, 0).speed).toBeCloseTo(400 * CONFIG.airSpeedBoost);
    expect(takeoff(400, 3, 0).startedAt).toBe(3);
  });

  it('does not compound momentum carried into the takeoff past full-lean speed', () => {
    expect(takeoff(CONFIG.fullLeanSpeed * 1.3, 0, 0).speed).toBeCloseTo(CONFIG.fullLeanSpeed * CONFIG.airSpeedBoost);
  });

  it('ignores lean in the air: forward or lateral, the speed stays locked', () => {
    const { jump } = fly((t) => Math.sin(t * 20));
    expect(jump.speed).toBeCloseTo(TYPICAL * CONFIG.airSpeedBoost);
  });
});

describe('updateAir', () => {
  const base = (): Jump => takeoff(TYPICAL, 0, 0);

  it('starts no flip below trickLeanFraction', () => {
    expect(updateAir(base(), SOFT, false, 0.1).flip).toBeNull();
    expect(updateAir(base(), -SOFT, false, 0.1).flip).toBeNull();
  });

  it('starts a flip in the lean direction past trickLeanFraction', () => {
    expect(updateAir(base(), HARD, false, 0.1).flip).toMatchObject({ dir: 'right', startedAt: 0.1 });
    expect(updateAir(base(), -HARD, false, 0.1).flip).toMatchObject({ dir: 'left', startedAt: 0.1 });
  });

  it('starts only one flip per jump', () => {
    const first = updateAir(base(), HARD, false, 0.1);
    const again = updateAir(updateAir(first, 0, false, 0.2), -HARD, false, 0.7);
    expect(again.flip).toMatchObject({ dir: 'right', startedAt: 0.1 });
  });

  it('does not flip from a lean already held at takeoff (steering onto the ramp)', () => {
    let jump = takeoff(TYPICAL, 0, HARD);
    for (let t = 0.05; t < 0.5; t += 0.05) jump = updateAir(jump, HARD, false, t);
    expect(jump.flip).toBeNull();
  });

  it('flips by leaning further than a lean held at takeoff, with no need to level out first', () => {
    const held = 0.3;
    let jump = takeoff(TYPICAL, 0, held);
    jump = updateAir(jump, held + CONFIG.trickLeanFraction - 0.05, false, 0.05);
    expect(jump.flip).toBeNull();
    jump = updateAir(jump, held + CONFIG.trickLeanFraction + 0.05, false, 0.1);
    expect(jump.flip).toMatchObject({ dir: 'right', startedAt: 0.1 });
  });

  it('never flips from easing a held lean back toward level', () => {
    let jump = takeoff(TYPICAL, 0, 0.6);
    for (let t = 0.05, lean = 0.6; t < 0.6; t += 0.05, lean -= 0.06) jump = updateAir(jump, Math.max(0, lean), false, t);
    expect(jump.flip).toBeNull();
  });

  it('can flip the other way from a lean held at takeoff', () => {
    const jump = updateAir(takeoff(TYPICAL, 0, 0.5), -HARD, false, 0.1);
    expect(jump.flip).toMatchObject({ dir: 'left', startedAt: 0.1 });
  });

  it('starts no flip while a side edge is grounded', () => {
    expect(updateAir(base(), HARD, true, 0.1).flip).toBeNull();
  });

  it('remembers that a side edge touched the floor', () => {
    const touched = updateAir(base(), 0, true, 0.1);
    expect(updateAir(touched, 0, false, 0.2).touchedFloor).toBe(true);
    expect(updateAir(base(), 0, false, 0.1).touchedFloor).toBe(false);
  });
});

describe('landing', () => {
  const flipEarly = (t: number) => (t < 0.1 ? HARD : 0);

  it('is clean with no flip and a level board', () => {
    expect(fly(() => 0).outcome).toBe('clean');
  });

  it('is a trick when the flip completes before touchdown', () => {
    expect(fly(flipEarly).outcome).toBe('trick');
  });

  it('speeds up a late flip so it still finishes by touchdown and scores', () => {
    const duration = airTime(TYPICAL);
    const startAt = duration - CONFIG.flipDurationS / 2;
    const late = (t: number) => (t > startAt && t < startAt + 0.05 ? -HARD : 0);
    const { jump, outcome } = fly(late);
    expect(jump.flip?.dir).toBe('left');
    expect(flipProgress(jump, jump.startedAt + jump.duration)).toBe(1);
    expect(outcome).toBe('trick');
  });

  it('starts no flip with less than minFlipS of air left', () => {
    const duration = airTime(TYPICAL);
    const tooLate = (t: number) => (t > duration - CONFIG.minFlipS + 0.02 ? CONFIG.landingCrashLean * 0.9 : 0);
    const { jump, outcome } = fly(tooLate);
    expect(jump.flip).toBeNull();
    expect(outcome).toBe('clean');
  });

  it('crashes on a hard lateral lean at touchdown, either way, even after a finished flip', () => {
    const noFlip = takeoff(TYPICAL, 0, 0);
    expect(landing(noFlip, CONFIG.landingCrashLean)).toBe('crash');
    expect(landing(noFlip, -CONFIG.landingCrashLean)).toBe('crash');
    expect(landing(noFlip, CONFIG.landingCrashLean * 0.9)).toBe('clean');
    const flipped = fly(flipEarly).jump;
    expect(landing(flipped, CONFIG.landingCrashLean)).toBe('crash');
  });

  it('voids the trick when the board was grounded at any point in the air', () => {
    const groundedAfterFlip = (t: number) => t > 0.8 && t < 0.85;
    expect(fly(flipEarly, groundedAfterFlip).outcome).toBe('clean');
    const groundedBeforeFlip = (t: number) => t < 0.05;
    const flipLater = (t: number) => (t > 0.1 && t < 0.2 ? HARD : 0);
    expect(fly(flipLater, groundedBeforeFlip).outcome).toBe('clean');
  });
});

describe('easeSpeed', () => {
  function ease(landingCarry: number, seconds: number): number {
    let speed = 600;
    let carry = landingCarry;
    for (let t = 0; t < seconds; t += DT) {
      speed = easeSpeed(speed, 400, carry, DT);
      carry = Math.max(0, carry - DT);
    }
    return speed;
  }

  it('normally reaches the lean target within half a second', () => {
    expect(ease(0, 0.5)).toBeLessThan(410);
  });

  it('keeps most of the air speed for a while after landing, then reaches the target', () => {
    expect(ease(CONFIG.landingCarryS, 0.5)).toBeGreaterThan(500);
    expect(ease(CONFIG.landingCarryS, CONFIG.landingCarryS + 0.5)).toBeLessThan(410);
  });
});

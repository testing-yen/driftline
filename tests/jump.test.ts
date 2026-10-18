import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { airTime, easeSpeed, hasLanded, landing, takeoff, updateAir } from '../src/game/jump.js';
import type { Jump } from '../src/game/types.js';

const DT = 1 / 60;
const TYPICAL = CONFIG.typicalTakeoffSpeed;
const HARD = CONFIG.trickLeanFraction + 0.05;
const SOFT = CONFIG.trickLeanFraction - 0.05;

/** Runs a jump from takeoff at t=0 to touchdown with a lean and grounded state per frame, then lands. */
function fly(leanAt: (t: number) => number, groundedAt: (t: number) => boolean = () => false, speed = TYPICAL) {
  let jump = takeoff(speed, 0);
  let t = 0;
  while (!hasLanded(jump, t)) {
    t += DT;
    jump = updateAir(jump, leanAt(t), groundedAt(t), t);
  }
  return { jump, outcome: landing(jump, leanAt(t), t) };
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
    expect(takeoff(400, 3).speed).toBeCloseTo(400 * CONFIG.airSpeedBoost);
    expect(takeoff(400, 3).startedAt).toBe(3);
  });

  it('does not compound momentum carried into the takeoff past full-lean speed', () => {
    expect(takeoff(CONFIG.fullLeanSpeed * 1.3, 0).speed).toBeCloseTo(CONFIG.fullLeanSpeed * CONFIG.airSpeedBoost);
  });

  it('ignores lean in the air: forward or lateral, the speed stays locked', () => {
    const { jump } = fly((t) => Math.sin(t * 20));
    expect(jump.speed).toBeCloseTo(TYPICAL * CONFIG.airSpeedBoost);
  });
});

describe('updateAir', () => {
  const base = (): Jump => takeoff(TYPICAL, 0);

  it('starts no spin below trickLeanFraction', () => {
    expect(updateAir(base(), SOFT, false, 0.1).spin).toBeNull();
    expect(updateAir(base(), -SOFT, false, 0.1).spin).toBeNull();
  });

  it('starts a spin in the lean direction past trickLeanFraction', () => {
    expect(updateAir(base(), HARD, false, 0.1).spin).toEqual({ dir: 'right', startedAt: 0.1 });
    expect(updateAir(base(), -HARD, false, 0.1).spin).toEqual({ dir: 'left', startedAt: 0.1 });
  });

  it('starts only one spin per jump', () => {
    const first = updateAir(base(), HARD, false, 0.1);
    const again = updateAir(updateAir(first, 0, false, 0.2), -HARD, false, 0.7);
    expect(again.spin).toEqual({ dir: 'right', startedAt: 0.1 });
  });

  it('starts no spin while the board is grounded', () => {
    expect(updateAir(base(), HARD, true, 0.1).spin).toBeNull();
  });

  it('remembers that the board touched the floor', () => {
    const touched = updateAir(base(), 0, true, 0.1);
    expect(updateAir(touched, 0, false, 0.2).touchedFloor).toBe(true);
    expect(updateAir(base(), 0, false, 0.1).touchedFloor).toBe(false);
  });
});

describe('landing', () => {
  const spinEarly = (t: number) => (t < 0.1 ? HARD : 0);

  it('is clean with no spin and a level board', () => {
    expect(fly(() => 0).outcome).toBe('clean');
  });

  it('is a trick when the spin completes before touchdown', () => {
    expect(fly(spinEarly).outcome).toBe('trick');
  });

  it('crashes when the spin is still going at touchdown', () => {
    const duration = airTime(TYPICAL);
    const late = (t: number) => (t > duration - CONFIG.spinDurationS / 2 && t < duration - 0.1 ? -HARD : 0);
    expect(fly(late).outcome).toBe('crash');
  });

  it('crashes on a hard lateral lean at touchdown, either way, even after a finished spin', () => {
    const noSpin = takeoff(TYPICAL, 0);
    const t = noSpin.duration;
    expect(landing(noSpin, CONFIG.landingCrashLean, t)).toBe('crash');
    expect(landing(noSpin, -CONFIG.landingCrashLean, t)).toBe('crash');
    expect(landing(noSpin, CONFIG.landingCrashLean * 0.9, t)).toBe('clean');
    const spun = fly(spinEarly).jump;
    expect(landing(spun, CONFIG.landingCrashLean, t)).toBe('crash');
  });

  it('voids the trick when the board was grounded at any point in the air', () => {
    const groundedAfterSpin = (t: number) => t > 0.8 && t < 0.85;
    expect(fly(spinEarly, groundedAfterSpin).outcome).toBe('clean');
    const groundedBeforeSpin = (t: number) => t < 0.05;
    const spinLater = (t: number) => (t > 0.1 && t < 0.2 ? HARD : 0);
    expect(fly(spinLater, groundedBeforeSpin).outcome).toBe('clean');
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

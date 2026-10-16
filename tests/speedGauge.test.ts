import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { gaugeModel, leanTargetSpeed } from '../src/game/speedGauge.js';

const MAX = CONFIG.baseSpeed * CONFIG.tuckMultiplier;
const idle = { speed: CONFIG.baseSpeed, target: CONFIG.baseSpeed, chaserSpeed: null };
const lean = (y: number, grounded = false) => ({ y, grounded });

describe('leanTargetSpeed', () => {
  it('coasts at baseSpeed, tucks to baseSpeed x tuck, brakes to baseSpeed x brake', () => {
    expect(leanTargetSpeed(lean(0), false)).toBeCloseTo(CONFIG.baseSpeed);
    expect(leanTargetSpeed(lean(1), false)).toBeCloseTo(CONFIG.baseSpeed * CONFIG.tuckMultiplier);
    expect(leanTargetSpeed(lean(-1), false)).toBeCloseTo(CONFIG.baseSpeed * CONFIG.brakeMultiplier);
  });

  it('is linear between neutral and each end', () => {
    expect(leanTargetSpeed(lean(0.5), false)).toBeCloseTo(CONFIG.baseSpeed * (1 + 0.5 * (CONFIG.tuckMultiplier - 1)));
    expect(leanTargetSpeed(lean(-0.5), false)).toBeCloseTo(CONFIG.baseSpeed * (1 - 0.5 * (1 - CONFIG.brakeMultiplier)));
  });

  it('gives a grounded board no tuck: full forward lean only cruises', () => {
    expect(leanTargetSpeed(lean(1, true), false)).toBeCloseTo(CONFIG.baseSpeed);
    expect(leanTargetSpeed(lean(0.5, true), false)).toBeCloseTo(CONFIG.baseSpeed);
  });

  it('still brakes while grounded', () => {
    expect(leanTargetSpeed(lean(-1, true), false)).toBeCloseTo(CONFIG.baseSpeed * CONFIG.brakeMultiplier);
    expect(leanTargetSpeed(lean(-0.5, true), false)).toBeCloseTo(leanTargetSpeed(lean(-0.5), false));
  });

  it('slows the target by stumbleSlowFactor while stumbling', () => {
    expect(leanTargetSpeed(lean(1), true)).toBeCloseTo(leanTargetSpeed(lean(1), false) * CONFIG.stumbleSlowFactor);
    expect(leanTargetSpeed(lean(1), true)).toBeLessThan(leanTargetSpeed(lean(1), false));
  });
});

describe('gaugeModel', () => {
  it('puts a full forward lean at the top of the gauge', () => {
    expect(gaugeModel({ ...idle, target: leanTargetSpeed(lean(1), false) }).target).toBeCloseTo(1);
  });

  it('puts a neutral lean on the cruise mark, at baseSpeed / max speed', () => {
    const g = gaugeModel({ ...idle, target: leanTargetSpeed(lean(0), false) });
    expect(g.target).toBeCloseTo(g.cruise);
    expect(g.cruise).toBeCloseTo(CONFIG.baseSpeed / MAX);
  });

  it('shows a grounded full forward lean on the cruise mark, not at the top', () => {
    const g = gaugeModel({ ...idle, target: leanTargetSpeed(lean(1, true), false) });
    expect(g.target).toBeCloseTo(g.cruise);
    expect(g.target).toBeLessThan(0.9);
  });

  it('shows a stumbling target below the same lean without a stumble', () => {
    const steady = gaugeModel({ ...idle, target: leanTargetSpeed(lean(1), false) });
    const stumbling = gaugeModel({ ...idle, target: leanTargetSpeed(lean(1), true) });
    expect(stumbling.target).toBeCloseTo(CONFIG.stumbleSlowFactor);
    expect(stumbling.target).toBeLessThan(steady.target);
  });

  it('maps actual speed linearly into 0..1', () => {
    expect(gaugeModel({ ...idle, speed: 0 }).speed).toBe(0);
    expect(gaugeModel({ ...idle, speed: MAX / 4 }).speed).toBeCloseTo(0.25);
    expect(gaugeModel({ ...idle, speed: MAX * 0.8 }).speed).toBeCloseTo(0.8);
  });

  it('maps target speed independently of actual speed', () => {
    const g = gaugeModel({ ...idle, speed: CONFIG.baseSpeed, target: MAX * 0.9 });
    expect(g.target).toBeCloseTo(0.9);
    expect(g.speed).toBeCloseTo(CONFIG.baseSpeed / MAX);
  });

  it('clamps speed and target outside the range', () => {
    const high = gaugeModel({ ...idle, speed: MAX * 1.5, target: -20 });
    expect(high.speed).toBe(1);
    expect(high.target).toBe(0);
    const low = gaugeModel({ ...idle, speed: -5, target: MAX + 1 });
    expect(low.speed).toBe(0);
    expect(low.target).toBe(1);
  });

  it('has no chaser before it appears', () => {
    const g = gaugeModel(idle);
    expect(g.chaser).toBeNull();
    expect(g.chaserOverMax).toBe(false);
  });

  it('maps an active chaser linearly while it is still outrunnable', () => {
    const g = gaugeModel({ ...idle, chaserSpeed: CONFIG.chaserSpeed });
    expect(g.chaser).toBeCloseTo(CONFIG.chaserSpeed / MAX);
    expect(g.chaserOverMax).toBe(false);
  });

  it('is not over max when the chaser exactly matches full tuck', () => {
    const g = gaugeModel({ ...idle, chaserSpeed: MAX });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(false);
  });

  it('pins the chaser at the top and flags it once it beats full tuck', () => {
    const g = gaugeModel({ ...idle, chaserSpeed: MAX + 0.5 });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(true);
  });
});

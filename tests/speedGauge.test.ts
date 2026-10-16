import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { GAUGE_MAX_SPEED, gaugeModel } from '../src/game/speedGauge.js';

const MAX = CONFIG.baseSpeed * CONFIG.tuckMultiplier;
const idle = { speed: CONFIG.baseSpeed, target: CONFIG.baseSpeed, chaserActive: false, chaserSpeed: 0 };

describe('gaugeModel', () => {
  it('spans 0 to full-tuck speed', () => {
    expect(GAUGE_MAX_SPEED).toBe(MAX);
  });

  it('maps actual speed linearly into 0..1', () => {
    expect(gaugeModel({ ...idle, speed: 0 }).speed).toBe(0);
    expect(gaugeModel({ ...idle, speed: MAX / 4 }).speed).toBeCloseTo(0.25);
    expect(gaugeModel({ ...idle, speed: MAX * 0.8 }).speed).toBeCloseTo(0.8);
    expect(gaugeModel({ ...idle, speed: MAX }).speed).toBe(1);
  });

  it('maps target speed independently of actual speed', () => {
    const g = gaugeModel({ ...idle, speed: CONFIG.baseSpeed, target: MAX * 0.9 });
    expect(g.target).toBeCloseTo(0.9);
    expect(g.speed).toBeCloseTo(CONFIG.baseSpeed / MAX);
  });

  it('clamps speed and target outside the range', () => {
    const g = gaugeModel({ ...idle, speed: MAX * 1.5, target: -20 });
    expect(g.speed).toBe(1);
    expect(g.target).toBe(0);
    const low = gaugeModel({ ...idle, speed: -5, target: MAX + 1 });
    expect(low.speed).toBe(0);
    expect(low.target).toBe(1);
  });

  it('places cruise at baseSpeed / max speed', () => {
    expect(gaugeModel(idle).cruise).toBeCloseTo(CONFIG.baseSpeed / MAX);
    expect(gaugeModel(idle).cruise).toBeCloseTo(1 / CONFIG.tuckMultiplier);
  });

  it('shows a stumble-reduced target below the brake floor', () => {
    const stumbledTuck = MAX * CONFIG.stumbleSlowFactor;
    expect(gaugeModel({ ...idle, target: stumbledTuck }).target).toBeCloseTo(CONFIG.stumbleSlowFactor);
    const stumbledBrake = CONFIG.baseSpeed * CONFIG.brakeMultiplier * CONFIG.stumbleSlowFactor;
    expect(gaugeModel({ ...idle, target: stumbledBrake }).target).toBeCloseTo(stumbledBrake / MAX);
  });

  it('has no chaser while it is inactive, whatever its speed', () => {
    const g = gaugeModel({ ...idle, chaserActive: false, chaserSpeed: MAX * 2 });
    expect(g.chaser).toBeNull();
    expect(g.chaserOverMax).toBe(false);
  });

  it('maps an active chaser linearly while it is still outrunnable', () => {
    const g = gaugeModel({ ...idle, chaserActive: true, chaserSpeed: CONFIG.chaserSpeed });
    expect(g.chaser).toBeCloseTo(CONFIG.chaserSpeed / MAX);
    expect(g.chaserOverMax).toBe(false);
  });

  it('is not over max when the chaser exactly matches full tuck', () => {
    const g = gaugeModel({ ...idle, chaserActive: true, chaserSpeed: MAX });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(false);
  });

  it('pins the chaser at the top and flags it once it beats full tuck', () => {
    const g = gaugeModel({ ...idle, chaserActive: true, chaserSpeed: MAX + 0.5 });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(true);
  });
});

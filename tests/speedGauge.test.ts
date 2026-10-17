import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { edgeContact, gaugeModel, leanTargetSpeed } from '../src/game/speedGauge.js';

const MAX = CONFIG.fullLeanSpeed;
const FLAT = CONFIG.flatSpeed;
const idle = { speed: FLAT, target: FLAT, chaserSpeed: null };

describe('edgeContact', () => {
  it('is off whenever the edge is up, however long it was down before', () => {
    expect(edgeContact(false, 0)).toBe('off');
    expect(edgeContact(false, CONFIG.groundedGraceS * 10)).toBe('off');
  });

  it('is only touching inside the grace window, and resting from the grace time on', () => {
    expect(edgeContact(true, 0)).toBe('touching');
    expect(edgeContact(true, CONFIG.groundedGraceS * 0.99)).toBe('touching');
    expect(edgeContact(true, CONFIG.groundedGraceS)).toBe('resting');
  });
});

describe('leanTargetSpeed', () => {
  it('rides at flatSpeed on a level board and fullLeanSpeed at full forward lean', () => {
    expect(leanTargetSpeed(0, 'off', false)).toBeCloseTo(FLAT);
    expect(leanTargetSpeed(1, 'off', false)).toBeCloseTo(MAX);
  });

  it('is linear in forward lean between level and full lean', () => {
    expect(leanTargetSpeed(0.5, 'off', false)).toBeCloseTo((FLAT + MAX) / 2);
    expect(leanTargetSpeed(0.25, 'off', false)).toBeCloseTo(FLAT + 0.25 * (MAX - FLAT));
  });

  it('ignores leaning back: it rides like a level board, never slower', () => {
    expect(leanTargetSpeed(-1, 'off', false)).toBeCloseTo(FLAT);
    expect(leanTargetSpeed(-0.4, 'off', false)).toBeCloseTo(FLAT);
  });

  it('gives no lean bonus while the edge is touching the floor', () => {
    expect(leanTargetSpeed(1, 'touching', false)).toBeCloseTo(FLAT);
    expect(leanTargetSpeed(0.6, 'touching', false)).toBeCloseTo(FLAT);
  });

  it('drops below level-board speed once resting on the edge, whatever the lean', () => {
    const resting = FLAT * CONFIG.restingSpeedFactor;
    expect(leanTargetSpeed(1, 'resting', false)).toBeCloseTo(resting);
    expect(leanTargetSpeed(0, 'resting', false)).toBeCloseTo(resting);
    expect(resting).toBeLessThan(FLAT);
  });

  it('slows the target by stumbleSlowFactor while stumbling', () => {
    expect(leanTargetSpeed(1, 'off', true)).toBeCloseTo(MAX * CONFIG.stumbleSlowFactor);
    expect(leanTargetSpeed(1, 'off', true)).toBeLessThan(leanTargetSpeed(1, 'off', false));
  });
});

describe('gaugeModel', () => {
  it('puts a full forward lean at the top of the gauge', () => {
    expect(gaugeModel({ ...idle, target: leanTargetSpeed(1, 'off', false) }).target).toBeCloseTo(1);
  });

  it('puts a level board on the flat mark, at flatSpeed / full-lean speed', () => {
    const g = gaugeModel({ ...idle, target: leanTargetSpeed(0, 'off', false) });
    expect(g.target).toBeCloseTo(g.flat);
    expect(g.flat).toBeCloseTo(FLAT / MAX);
  });

  it('shows resting on the edge below the flat mark', () => {
    const g = gaugeModel({ ...idle, target: leanTargetSpeed(1, 'resting', false) });
    expect(g.target).toBeLessThan(g.flat);
  });

  it('maps actual speed linearly into 0..1', () => {
    expect(gaugeModel({ ...idle, speed: 0 }).speed).toBe(0);
    expect(gaugeModel({ ...idle, speed: MAX / 4 }).speed).toBeCloseTo(0.25);
    expect(gaugeModel({ ...idle, speed: MAX * 0.8 }).speed).toBeCloseTo(0.8);
  });

  it('maps target speed independently of actual speed', () => {
    const g = gaugeModel({ ...idle, speed: FLAT, target: MAX * 0.9 });
    expect(g.target).toBeCloseTo(0.9);
    expect(g.speed).toBeCloseTo(FLAT / MAX);
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

  it('is not over max when the chaser exactly matches full lean', () => {
    const g = gaugeModel({ ...idle, chaserSpeed: MAX });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(false);
  });

  it('pins the chaser at the top and flags it once it beats full lean', () => {
    const g = gaugeModel({ ...idle, chaserSpeed: MAX + 0.5 });
    expect(g.chaser).toBe(1);
    expect(g.chaserOverMax).toBe(true);
  });
});

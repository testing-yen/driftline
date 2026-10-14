import { describe, expect, it } from 'vitest';
import {
  LowPassFilter,
  NeutralCalibrator,
  applyDeadZone,
  deadZoneToNormal,
  degToNormal,
} from '../src/input/tiltMath.js';

describe('degToNormal', () => {
  it('maps zero tilt to zero', () => {
    expect(degToNormal(0, 25)).toBe(0);
  });

  it('maps max tilt to +-1', () => {
    expect(degToNormal(25, 25)).toBe(1);
    expect(degToNormal(-25, 25)).toBe(-1);
  });

  it('clamps beyond max tilt', () => {
    expect(degToNormal(90, 25)).toBe(1);
    expect(degToNormal(-90, 25)).toBe(-1);
  });

  it('scales proportionally', () => {
    expect(degToNormal(12.5, 25)).toBeCloseTo(0.5);
  });
});

describe('applyDeadZone', () => {
  it('zeroes values inside the zone', () => {
    expect(applyDeadZone(0.05, 0.08)).toBe(0);
    expect(applyDeadZone(-0.05, 0.08)).toBe(0);
  });

  it('rescales values outside the zone continuously', () => {
    // At the zone edge the output is 0; at full deflection it is 1.
    expect(applyDeadZone(0.08, 0.08)).toBeCloseTo(0);
    expect(applyDeadZone(1, 0.08)).toBeCloseTo(1);
    expect(applyDeadZone(-1, 0.08)).toBeCloseTo(-1);
    // Midpoint of the remaining range maps to ~0.5.
    expect(applyDeadZone(0.54, 0.08)).toBeCloseTo(0.5, 5);
  });

  it('handles a zero dead zone as pass-through', () => {
    expect(applyDeadZone(0.3, 0)).toBeCloseTo(0.3);
  });
});

describe('deadZoneToNormal', () => {
  it('converts 2 degrees of a 25 degree range', () => {
    expect(deadZoneToNormal(2, 25)).toBeCloseTo(0.08);
  });
});

describe('LowPassFilter', () => {
  it('passes the first sample through', () => {
    const f = new LowPassFilter(0.5);
    expect(f.push(10)).toBe(10);
  });

  it('converges toward a constant input', () => {
    const f = new LowPassFilter(0.5);
    f.push(0);
    let v = 0;
    for (let i = 0; i < 20; i += 1) v = f.push(100);
    expect(v).toBeCloseTo(100, 3);
  });

  it('smooths a spike', () => {
    const f = new LowPassFilter(0.1);
    f.push(0);
    f.push(0);
    const v = f.push(100);
    expect(v).toBeLessThan(20);
  });
});

describe('NeutralCalibrator', () => {
  it('averages the first N samples as the offset', () => {
    const c = new NeutralCalibrator(4);
    c.addSample(2, -1);
    c.addSample(4, -3);
    c.addSample(2, -1);
    c.addSample(4, -3);
    expect(c.isCalibrated).toBe(true);
    expect(c.offset()).toEqual({ x: 3, y: -2 });
  });

  it('ignores samples beyond the target count', () => {
    const c = new NeutralCalibrator(2);
    c.addSample(10, 10);
    c.addSample(10, 10);
    c.addSample(1000, 1000);
    expect(c.offset()).toEqual({ x: 10, y: 10 });
  });

  it('resets cleanly', () => {
    const c = new NeutralCalibrator(2);
    c.addSample(10, 10);
    c.reset();
    expect(c.isCalibrated).toBe(false);
    expect(c.offset()).toEqual({ x: 0, y: 0 });
  });
});

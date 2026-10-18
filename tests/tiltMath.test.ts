import { describe, expect, it } from 'vitest';
import {
  LowPassFilter,
  NeutralCalibrator,
  TiltRange,
  anglesIn,
  applyDeadZone,
  deadZoneToNormal,
  degToNormal,
  neutralFrame,
  type Vec3,
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

const G = 9.81;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Rotation by `deg` about world x (right) or y (away from the player), right-handed. */
function rotate(axis: 'x' | 'y', deg: number, v: Vec3): Vec3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return axis === 'x'
    ? { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }
    : { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/**
 * Gravity as iOS reports it in device coordinates, for a phone that starts
 * flat and face up (device axes = world axes, gravity (0, 0, -g)), then has
 * its top edge raised toward the player by `heldDeg` (about world x), then is
 * tipped right-edge-down by `sideDeg` about the horizontal axis pointing away
 * from the player. Device-frame gravity is the inverse rotation of world gravity.
 */
function gravityHeld(heldDeg: number, sideDeg = 0): Vec3 {
  const down = { x: 0, y: 0, z: -G };
  return rotate('x', -heldDeg, rotate('y', -sideDeg, down));
}

describe('neutralFrame / anglesIn', () => {
  it('reproduces atan2(ax, -az) and atan2(ay, -az) for a flat, face-up neutral', () => {
    const frame = neutralFrame({ x: 0, y: 0, z: -G });
    const samples: Vec3[] = [
      { x: 0, y: 0, z: -G },
      { x: 3.1, y: -1.2, z: -9.2 },
      { x: -4.5, y: 6.7, z: -5.3 },
      { x: 1, y: 2, z: 3 },
      { x: -8, y: -0.5, z: 0.4 },
    ];
    for (const a of samples) {
      const { roll, pitch } = anglesIn(frame, a);
      expect(roll).toBeCloseTo((Math.atan2(a.x, -a.z) * 180) / Math.PI, 10);
      expect(pitch).toBeCloseTo((Math.atan2(a.y, -a.z) * 180) / Math.PI, 10);
    }
  });

  it.each([45, 60])('measures a sideways tip as roll alone from a neutral held at %i°', (heldDeg) => {
    const frame = neutralFrame(gravityHeld(heldDeg));
    expect(anglesIn(frame, gravityHeld(heldDeg)).roll).toBeCloseTo(0, 10);
    for (const side of [5, 15, 30, -20]) {
      const { roll, pitch } = anglesIn(frame, gravityHeld(heldDeg, side));
      expect(roll, `roll for a ${side}° tip`).toBeCloseTo(side, 6);
      expect(pitch, `pitch for a ${side}° tip`).toBeCloseTo(0, 6);
    }
  });

  it.each([45, 60])('measures tilting the top edge toward the player as negative pitch from %i°', (heldDeg) => {
    const frame = neutralFrame(gravityHeld(heldDeg));
    for (const toward of [5, 20, -15]) {
      const { roll, pitch } = anglesIn(frame, gravityHeld(heldDeg + toward));
      expect(pitch, `pitch for ${toward}° toward`).toBeCloseTo(-toward, 6);
      expect(roll, `roll for ${toward}° toward`).toBeCloseTo(0, 6);
    }
  });

  it('falls back to the flat frame when gravity has no direction', () => {
    const frame = neutralFrame({ x: 0, y: 0, z: 0 });
    const a = { x: 2, y: -3, z: -9 };
    expect(anglesIn(frame, a).roll).toBeCloseTo((Math.atan2(a.x, -a.z) * 180) / Math.PI, 10);
  });
});

describe('NeutralCalibrator', () => {
  it('averages the first N gravity samples into the neutral', () => {
    const c = new NeutralCalibrator(2);
    const held = gravityHeld(45);
    // Two noisy readings whose mean is the 45° hold.
    c.addSample({ x: held.x + 0.4, y: held.y - 0.3, z: held.z });
    expect(c.isCalibrated).toBe(false);
    c.addSample({ x: held.x - 0.4, y: held.y + 0.3, z: held.z });
    expect(c.isCalibrated).toBe(true);
    const { roll, pitch } = anglesIn(c.frame, held);
    expect(roll).toBeCloseTo(0, 10);
    expect(pitch).toBeCloseTo(0, 10);
  });

  it('ignores samples beyond the target count', () => {
    const c = new NeutralCalibrator(2);
    c.addSample(gravityHeld(45));
    c.addSample(gravityHeld(45));
    c.addSample(gravityHeld(0));
    expect(anglesIn(c.frame, gravityHeld(45)).pitch).toBeCloseTo(0, 10);
  });

  it('resets to the flat frame, uncalibrated', () => {
    const c = new NeutralCalibrator(2);
    c.addSample(gravityHeld(45));
    c.addSample(gravityHeld(45));
    c.reset();
    expect(c.isCalibrated).toBe(false);
    expect(anglesIn(c.frame, gravityHeld(0)).pitch).toBeCloseTo(0, 10);
    expect(anglesIn(c.frame, gravityHeld(45)).pitch).toBeCloseTo(-45, 10);
  });
});
describe('TiltRange', () => {
  it('keeps the furthest lean in each direction separately', () => {
    const r = new TiltRange();
    r.record(3, 8);
    r.record(-6, -2);
    r.record(1, 5);
    expect({ forward: r.forward, back: r.back, left: r.left, right: r.right }).toEqual({
      forward: 8,
      back: 2,
      left: 6,
      right: 3,
    });
  });

  it('starts at zero and returns to zero on reset', () => {
    const r = new TiltRange();
    expect([r.forward, r.back, r.left, r.right]).toEqual([0, 0, 0, 0]);
    r.record(4, -9);
    r.reset();
    expect([r.forward, r.back, r.left, r.right]).toEqual([0, 0, 0, 0]);
  });
});

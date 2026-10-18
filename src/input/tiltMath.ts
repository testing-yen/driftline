/**
 * Shared tilt math: degree normalization, dead zone, low-pass filtering,
 * and neutral-position calibration. Pure functions + tiny classes so they
 * are trivially unit-testable.
 */

/** Map a tilt angle in degrees to [-1, 1] given the angle for full deflection. */
export function degToNormal(deg: number, maxDeg: number): number {
  if (maxDeg <= 0) return 0;
  return Math.max(-1, Math.min(1, deg / maxDeg));
}

/**
 * Scaled dead zone on a normalized [-1, 1] value.
 * Values inside the zone become 0; values outside are rescaled so the
 * response stays continuous from 0 at the zone edge to 1 at full tilt.
 */
export function applyDeadZone(value: number, deadZone: number): number {
  const dz = Math.max(0, Math.min(1, deadZone));
  const abs = Math.abs(value);
  if (abs < dz) return 0;
  const sign = value < 0 ? -1 : 1;
  return ((abs - dz) / (1 - dz)) * sign;
}

/** Convert a degree-based dead zone to normalized units. */
export function deadZoneToNormal(deadZoneDeg: number, fullLeanDeg: number): number {
  return Math.max(0, Math.min(1, deadZoneDeg / fullLeanDeg));
}

/** A lean in degrees to [-1, 1]: full deflection at `fullLeanDeg`, nothing inside `deadZoneDeg`. */
export function leanToNormal(deg: number, fullLeanDeg: number, deadZoneDeg: number): number {
  return applyDeadZone(degToNormal(deg, fullLeanDeg), deadZoneToNormal(deadZoneDeg, fullLeanDeg));
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Orthonormal axes in device coordinates, built from the neutral gravity
 * vector so lean is measured from however the phone was held at calibration.
 */
export interface NeutralFrame {
  /** Along neutral gravity. */
  z: Vec3;
  /** The device x axis (toward the right edge) with its gravity component removed: horizontal. */
  x: Vec3;
  /** x × z: horizontal, toward the top edge when the phone is face up. */
  y: Vec3;
}

/** The frame of a phone lying flat, face up, as iOS reports gravity: (0, 0, -g). */
const FLAT_FRAME: NeutralFrame = {
  z: { x: 0, y: 0, z: -1 },
  x: { x: 1, y: 0, z: 0 },
  y: { x: 0, y: 1, z: 0 },
};

/** Below this an axis has no usable direction (free fall, or the right edge pointing straight down). */
const MIN_AXIS_LENGTH = 1e-6;

/** Axes for measuring lean from `gravity`, the averaged accelerationIncludingGravity at neutral. */
export function neutralFrame(gravity: Vec3): NeutralFrame {
  const z = unit(gravity);
  if (!z) return FLAT_FRAME;
  const x = unit(sub({ x: 1, y: 0, z: 0 }, scale(z, z.x)));
  if (!x) return FLAT_FRAME;
  return { z, x, y: cross(x, z) };
}

/**
 * Roll and pitch of `a` from the frame's neutral, in degrees. Roll is + with
 * the right edge down; pitch is + with the top edge tipped away (down). For
 * the flat frame these are atan2(ax, -az) and atan2(ay, -az).
 */
export function anglesIn(frame: NeutralFrame, a: Vec3): { roll: number; pitch: number } {
  const down = dot(a, frame.z);
  return {
    roll: (Math.atan2(dot(a, frame.x), down) * 180) / Math.PI,
    pitch: (Math.atan2(dot(a, frame.y), down) * 180) / Math.PI,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Null when `a` is too short to have a direction; also rejects NaN. */
function unit(a: Vec3): Vec3 | null {
  const length = Math.hypot(a.x, a.y, a.z);
  return length >= MIN_AXIS_LENGTH ? scale(a, 1 / length) : null;
}

/** Furthest lean seen in each direction since the last reset, in degrees from neutral. */
export class TiltRange {
  forward = 0;
  back = 0;
  left = 0;
  right = 0;

  /** x: + right, y: + forward (tuck). */
  record(xDeg: number, yDeg: number): void {
    this.right = Math.max(this.right, xDeg);
    this.left = Math.max(this.left, -xDeg);
    this.forward = Math.max(this.forward, yDeg);
    this.back = Math.max(this.back, -yDeg);
  }

  reset(): void {
    this.forward = 0;
    this.back = 0;
    this.left = 0;
    this.right = 0;
  }
}

/** One-pole low-pass filter for smoothing noisy IMU samples. */
export class LowPassFilter {
  private state = 0;
  private initialized = false;

  constructor(private readonly alpha: number) {}

  push(value: number): number {
    if (!this.initialized) {
      this.state = value;
      this.initialized = true;
      return this.state;
    }
    this.state += this.alpha * (value - this.state);
    return this.state;
  }

  reset(): void {
    this.state = 0;
    this.initialized = false;
  }
}

/**
 * Per-session neutral calibration: average the gravity vector over the first
 * N samples while the phone is held at neutral, and measure later readings in
 * the frame built from it. Until then the frame follows the running average.
 */
export class NeutralCalibrator {
  private sum: Vec3 = { x: 0, y: 0, z: 0 };
  private count = 0;
  private current: NeutralFrame = FLAT_FRAME;

  constructor(private readonly targetSamples: number) {}

  addSample(gravity: Vec3): void {
    if (this.count >= this.targetSamples) return;
    this.sum = { x: this.sum.x + gravity.x, y: this.sum.y + gravity.y, z: this.sum.z + gravity.z };
    this.count += 1;
    this.current = neutralFrame(this.sum);
  }

  get isCalibrated(): boolean {
    return this.count >= this.targetSamples;
  }

  /** The flat frame before any sample. */
  get frame(): NeutralFrame {
    return this.current;
  }

  reset(): void {
    this.sum = { x: 0, y: 0, z: 0 };
    this.count = 0;
    this.current = FLAT_FRAME;
  }
}

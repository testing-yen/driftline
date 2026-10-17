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
 * Per-session neutral calibration: average the first N samples while the
 * board is held level, then subtract that offset from later readings.
 */
export class NeutralCalibrator {
  private sumX = 0;
  private sumY = 0;
  private count = 0;

  constructor(private readonly targetSamples: number) {}

  addSample(xDeg: number, yDeg: number): void {
    if (this.count >= this.targetSamples) return;
    this.sumX += xDeg;
    this.sumY += yDeg;
    this.count += 1;
  }

  get isCalibrated(): boolean {
    return this.count >= this.targetSamples;
  }

  offset(): { x: number; y: number } {
    if (this.count === 0) return { x: 0, y: 0 };
    return { x: this.sumX / this.count, y: this.sumY / this.count };
  }

  reset(): void {
    this.sumX = 0;
    this.sumY = 0;
    this.count = 0;
  }
}

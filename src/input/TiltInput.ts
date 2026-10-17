/**
 * Tilt input abstraction.
 *
 * The game only ever sees a normalized 2-axis tilt sample:
 *   x: -1 (full left) .. +1 (full right)
 *   y: -1 (full brake / lean back) .. +1 (full tuck / lean forward)
 *
 * Implementations: KeyboardTiltInput (desktop dev/testing) and
 * DeviceMotionTiltInput (real phone IMU on the board).
 */
import type { BoardReach } from './boardReach.js';
import type { TiltRange } from './tiltMath.js';

export interface TiltSample {
  x: number;
  y: number;
  /** The board's edge is (nearly) on the floor, so the rider is resting on it instead of planking. */
  grounded: boolean;
}

/** Lean in degrees from neutral: x + right, y + forward. */
export interface LeanDegrees {
  x: number;
  y: number;
}

/** Real board angles, for inputs that measure them. */
export interface BoardAngles {
  /** Calibrated, smoothed lean right now. */
  readonly now: LeanDegrees;
  /** Furthest lean per direction since the last reset. */
  readonly range: TiltRange;
  /** Normalizes every sample; replace it after measuring the board. */
  reach: BoardReach;
}

export interface TiltInput {
  /** Human-readable name, e.g. "keyboard" or "device-motion". */
  readonly name: string;
  /** True when start() must be called from a user gesture (iOS motion permission). */
  readonly needsUserGesture: boolean;
  /** Begin listening. May request OS permission; may throw if denied. */
  start(): void | Promise<void>;
  /** Stop listening and release listeners. */
  stop(): void;
  /** Latest smoothed, dead-zoned, calibrated sample in [-1, 1]. */
  sample(): TiltSample;
  /** Re-zero the neutral position (call while holding the board level). */
  calibrate(): void;
  /** False while a calibrate() is still collecting neutral samples. */
  readonly calibrated: boolean;
  /** Null when the input has no real angle (keyboard). */
  readonly angles: BoardAngles | null;
  /** Advance time-based smoothing. Called once per frame by the game loop. */
  update(dt: number): void;
}

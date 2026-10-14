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
export interface TiltSample {
  x: number;
  y: number;
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
  /** Advance time-based smoothing. Called once per frame by the game loop. */
  update(dt: number): void;
}

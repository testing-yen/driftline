import { CONFIG } from '../config.js';
import type { BoardReach } from './boardReach.js';
import type { LeanProfile } from './playMode.js';
import type { LeanDegrees, TiltInput, TiltSample } from './TiltInput.js';
import { LowPassFilter, NeutralCalibrator, TiltRange, anglesIn } from './tiltMath.js';

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Real phone input via the DeviceMotion API.
 *
 * Assumes the phone is in PORTRAIT, screen toward the player: mounted on a
 * board with the top edge pointing forward, or held in the hand.
 *   - roll  (tipping the left or right edge down) -> steer left/right
 *   - pitch (tipping the top edge) -> tuck / brake; the play mode's
 *     LeanProfile says which way is forward
 *
 * Derived from accelerationIncludingGravity, measured in the frame of the
 * gravity vector averaged at neutral (see neutralFrame), so the lean is from
 * however the phone was held when it calibrated. Lying flat face up that is
 *   rollDeg  = atan2(ax, -az)   (positive = tilted right)
 *   pitchDeg = atan2(ay, -az)   (positive = top edge down = tuck forward)
 *
 * Requires a secure context (HTTPS) and, on iOS 13+, an explicit user
 * gesture — hence needsUserGesture and the "tap to enable" button.
 */
export class DeviceMotionTiltInput implements TiltInput {
  readonly name = 'device-motion';
  readonly needsUserGesture = true;
  readonly angles: { now: LeanDegrees; range: TiltRange; reach: BoardReach; profile: LeanProfile };

  private tilt: TiltSample = { x: 0, y: 0, grounded: false, sideGrounded: false };
  private filterX = new LowPassFilter(CONFIG.lowPassAlpha);
  private filterY = new LowPassFilter(CONFIG.lowPassAlpha);
  private calibrator = new NeutralCalibrator(CONFIG.calibSamples);
  private listening = false;
  private lastError: string | null = null;

  constructor(reach: BoardReach, profile: LeanProfile) {
    this.angles = { now: { x: 0, y: 0 }, range: new TiltRange(), reach, profile };
  }

  /** Most recent failure reason, for display in the UI. */
  get error(): string | null {
    return this.lastError;
  }

  async start(): Promise<void> {
    if (this.listening) return;
    if (typeof DeviceMotionEvent === 'undefined') {
      throw new Error('DeviceMotion is not supported on this device/browser.');
    }
    const DOE = DeviceMotionEvent as unknown as DeviceMotionEventWithPermission;
    if (typeof DOE.requestPermission === 'function') {
      // iOS 13+: must be called from a user gesture.
      const result = await DOE.requestPermission();
      if (result !== 'granted') {
        throw new Error('Motion permission was denied.');
      }
    }
    window.addEventListener('devicemotion', this.onMotion, { passive: true });
    this.listening = true;
  }

  stop(): void {
    if (!this.listening) return;
    window.removeEventListener('devicemotion', this.onMotion);
    this.listening = false;
  }

  calibrate(): void {
    this.calibrator.reset();
    // Maxima were measured from the old neutral.
    this.angles.range.reset();
    this.filterX.reset();
    this.filterY.reset();
  }

  get calibrated(): boolean {
    return this.calibrator.isCalibrated;
  }

  update(): void {
    // Samples arrive on their own event cadence; nothing per-frame needed.
  }

  sample(): TiltSample {
    return { ...this.tilt };
  }

  private onMotion = (e: DeviceMotionEvent): void => {
    try {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      const gravity = { x: a.x, y: a.y, z: a.z };
      this.calibrator.addSample(gravity);
      const { roll, pitch } = anglesIn(this.calibrator.frame, gravity);

      const { reach, profile } = this.angles;
      const xDeg = this.filterX.push(roll);
      const yDeg = this.filterY.push(profile.forwardSign * pitch);
      this.angles.now = { x: xDeg, y: yDeg };
      if (this.calibrator.isCalibrated) this.angles.range.record(xDeg, yDeg);
      this.tilt = profile.toSample(this.angles.now, reach);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  };
}

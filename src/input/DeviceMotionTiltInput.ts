import { CONFIG } from '../config.js';
import type { TiltInput, TiltSample } from './TiltInput.js';
import {
  LowPassFilter,
  NeutralCalibrator,
  applyDeadZone,
  deadZoneToNormal,
  degToNormal,
} from './tiltMath.js';

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * Real phone input via the DeviceMotion API.
 *
 * Assumes the phone is mounted in LANDSCAPE, screen facing up toward the
 * player (the natural position on a board phone mount):
 *   - roll  (rotation around the long axis) -> steer left/right
 *   - pitch (rotation around the short axis) -> tuck / brake
 *
 * Derived from accelerationIncludingGravity:
 *   rollDeg  = atan2(ax, -az)   (positive = tilted right)
 *   pitchDeg = atan2(ay, -az)   (positive = top edge down = tuck forward)
 *
 * Requires a secure context (HTTPS) and, on iOS 13+, an explicit user
 * gesture — hence needsUserGesture and the "tap to enable" button.
 */
export class DeviceMotionTiltInput implements TiltInput {
  readonly name = 'device-motion';
  readonly needsUserGesture = true;

  private tilt: TiltSample = { x: 0, y: 0 };
  private filterX = new LowPassFilter(CONFIG.lowPassAlpha);
  private filterY = new LowPassFilter(CONFIG.lowPassAlpha);
  private calibrator = new NeutralCalibrator(CONFIG.calibSamples);
  private listening = false;
  private lastError: string | null = null;

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
    this.filterX.reset();
    this.filterY.reset();
  }

  update(): void {
    // Samples arrive on their own event cadence; nothing per-frame needed.
  }

  sample(): TiltSample {
    return { x: this.tilt.x, y: this.tilt.y };
  }

  private onMotion = (e: DeviceMotionEvent): void => {
    try {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      const rollDeg = (Math.atan2(a.x, -a.z) * 180) / Math.PI;
      const pitchDeg = (Math.atan2(a.y, -a.z) * 180) / Math.PI;

      this.calibrator.addSample(rollDeg, pitchDeg);
      const off = this.calibrator.offset();

      const dz = deadZoneToNormal(CONFIG.deadZoneDeg, CONFIG.maxTiltDeg);
      const nx = degToNormal(this.filterX.push(rollDeg - off.x), CONFIG.maxTiltDeg);
      const ny = degToNormal(this.filterY.push(pitchDeg - off.y), CONFIG.maxTiltDeg);

      this.tilt = { x: applyDeadZone(nx, dz), y: applyDeadZone(ny, dz) };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  };
}

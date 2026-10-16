import { CONFIG } from '../config.js';

/** Which speed gauge the HUD draws. A prototype switch so variants can be compared on the phone. */
export type GaugeStyle = 'side' | 'bottom' | 'rider' | 'off';

/** Every position is a 0..1 fraction of the gauge range, 0 .. full-tuck speed. */
export interface GaugeModel {
  /** Actual player speed. */
  speed: number;
  /** Speed the current lean (and any stumble) is heading for; leads `speed` by the easing lag. */
  target: number;
  /** Coasting speed at neutral lean: brake zone below, tuck zone above. */
  cruise: number;
  /** Chaser speed, clamped to the top; null while the chaser has not appeared. */
  chaser: number | null;
  /** The chaser is faster than full tuck, so it can no longer be outrun. */
  chaserOverMax: boolean;
}

/**
 * Speed the rider eases toward for a forward/back lean in [-1, 1]:
 * full back lean brakes, neutral coasts at baseSpeed, full forward lean tucks.
 */
export function leanTargetSpeed(tiltY: number, stumbling: boolean): number {
  const factor =
    tiltY >= 0
      ? 1 + tiltY * (CONFIG.tuckMultiplier - 1)
      : 1 + tiltY * (1 - CONFIG.brakeMultiplier);
  const speed = CONFIG.baseSpeed * factor;
  return stumbling ? speed * CONFIG.stumbleSlowFactor : speed;
}

export const GAUGE_MAX_SPEED = leanTargetSpeed(1, false);
const CRUISE = leanTargetSpeed(0, false) / GAUGE_MAX_SPEED;

export function gaugeModel(input: {
  speed: number;
  target: number;
  /** null while the chaser has not appeared. */
  chaserSpeed: number | null;
}): GaugeModel {
  return {
    speed: toGauge(input.speed),
    target: toGauge(input.target),
    cruise: CRUISE,
    chaser: input.chaserSpeed === null ? null : toGauge(input.chaserSpeed),
    chaserOverMax: input.chaserSpeed !== null && input.chaserSpeed > GAUGE_MAX_SPEED,
  };
}

function toGauge(speed: number): number {
  return Math.max(0, Math.min(1, speed / GAUGE_MAX_SPEED));
}

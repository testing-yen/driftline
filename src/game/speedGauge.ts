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

export const GAUGE_MAX_SPEED = CONFIG.baseSpeed * CONFIG.tuckMultiplier;

export function gaugeModel(input: {
  speed: number;
  target: number;
  chaserActive: boolean;
  chaserSpeed: number;
}): GaugeModel {
  return {
    speed: toGauge(input.speed),
    target: toGauge(input.target),
    cruise: CONFIG.baseSpeed / GAUGE_MAX_SPEED,
    chaser: input.chaserActive ? toGauge(input.chaserSpeed) : null,
    chaserOverMax: input.chaserActive && input.chaserSpeed > GAUGE_MAX_SPEED,
  };
}

function toGauge(speed: number): number {
  return Math.max(0, Math.min(1, speed / GAUGE_MAX_SPEED));
}

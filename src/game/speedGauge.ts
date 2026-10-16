import { CONFIG } from '../config.js';

/** Which speed gauge the HUD draws. A prototype switch so variants can be compared on the phone. */
export type GaugeStyle = 'side' | 'bottom' | 'rider' | 'off';

/**
 * How the board's edge relates to the floor. 'touching' is the grace window
 * (a wobbling board brushes the floor); 'resting' means the rider has put
 * weight on the floor instead of planking.
 */
export type EdgeContact = 'off' | 'touching' | 'resting';

/** `groundedFor` is how long the edge has been down without a break, in seconds. */
export function edgeContact(grounded: boolean, groundedFor: number): EdgeContact {
  if (!grounded) return 'off';
  return groundedFor >= CONFIG.groundedGraceS ? 'resting' : 'touching';
}

/** Every position is a 0..1 fraction of the gauge range, 0 .. full-lean speed. */
export interface GaugeModel {
  /** Actual player speed. */
  speed: number;
  /** Speed the current lean (and any stumble or edge contact) is heading for; leads `speed` by the easing lag. */
  target: number;
  /** Speed with the board level: only edge contact or a stumble goes below it. */
  flat: number;
  /** Chaser speed, clamped to the top; null while the chaser has not appeared. */
  chaser: number | null;
  /** The chaser is faster than full lean, so it can no longer be outrun. */
  chaserOverMax: boolean;
}

/**
 * Speed the rider eases toward for a lean y in [-1, 1]. Only forward lean
 * counts: level (or leaning back) is flatSpeed, full forward lean is
 * fullLeanSpeed. An edge on the floor gets no lean bonus, and resting on it
 * drops below flat, so leaning on the floor never pays.
 */
export function leanTargetSpeed(y: number, contact: EdgeContact, stumbling: boolean): number {
  const forward = contact === 'off' ? Math.max(0, y) : 0;
  const speed =
    contact === 'resting'
      ? CONFIG.flatSpeed * CONFIG.restingSpeedFactor
      : CONFIG.flatSpeed + forward * (CONFIG.fullLeanSpeed - CONFIG.flatSpeed);
  return stumbling ? speed * CONFIG.stumbleSlowFactor : speed;
}

export const GAUGE_MAX_SPEED = leanTargetSpeed(1, 'off', false);
const FLAT = leanTargetSpeed(0, 'off', false) / GAUGE_MAX_SPEED;

export function gaugeModel(input: {
  speed: number;
  target: number;
  /** null while the chaser has not appeared. */
  chaserSpeed: number | null;
}): GaugeModel {
  return {
    speed: toGauge(input.speed),
    target: toGauge(input.target),
    flat: FLAT,
    chaser: input.chaserSpeed === null ? null : toGauge(input.chaserSpeed),
    chaserOverMax: input.chaserSpeed !== null && input.chaserSpeed > GAUGE_MAX_SPEED,
  };
}

function toGauge(speed: number): number {
  return Math.max(0, Math.min(1, speed / GAUGE_MAX_SPEED));
}

import { CONFIG } from '../config.js';
import type { Jump } from './types.js';

/**
 * Jump rules, pure and DOM-free: takeoff, what lean does in the air, how a
 * landing turns out, and the speed easing that carries momentum after it.
 * All times are game time in seconds.
 */

export type Landing = 'clean' | 'trick' | 'crash';

/** Seconds in the air for a takeoff at `speed`: proportional to speed, within the configured bounds. */
export function airTime(speed: number): number {
  const t = (speed / CONFIG.typicalTakeoffSpeed) * CONFIG.airTimeAtTypicalSpeed;
  return Math.max(CONFIG.minAirTimeS, Math.min(CONFIG.maxAirTimeS, t));
}

/** `lean` is the lateral lean in [-1, 1] at the moment of takeoff. */
export function takeoff(speed: number, time: number, lean: number): Jump {
  // Capped at full-lean speed so momentum carried off one landing cannot compound
  // jump after jump; rider speed stays bounded and the accelerating golem still wins.
  const base = Math.min(speed, CONFIG.fullLeanSpeed);
  return {
    startedAt: time,
    duration: airTime(base),
    speed: base * CONFIG.airSpeedBoost,
    spin: null,
    touchedFloor: false,
    spinArmed: Math.abs(lean) < CONFIG.trickLeanFraction,
  };
}

/**
 * One frame in the air. `lean` is lateral lean in [-1, 1]. Once armed (see
 * Jump.spinArmed), a hard lean starts the jump's one spin unless the board's
 * edge is on the floor; the edge on the floor at any point voids the trick.
 */
export function updateAir(jump: Jump, lean: number, grounded: boolean, time: number): Jump {
  const hard = Math.abs(lean) >= CONFIG.trickLeanFraction;
  const startsSpin = jump.spin === null && jump.spinArmed && !grounded && hard;
  return {
    ...jump,
    touchedFloor: jump.touchedFloor || grounded,
    spinArmed: jump.spinArmed || !hard,
    spin: startsSpin ? { dir: lean < 0 ? 'left' : 'right', startedAt: time } : jump.spin,
  };
}

export function hasLanded(jump: Jump, time: number): boolean {
  return time >= jump.startedAt + jump.duration;
}

/** 0..1 through the spin, or null when the jump has none. */
export function spinProgress(jump: Jump, time: number): number | null {
  if (jump.spin === null) return null;
  return Math.min(1, (time - jump.spin.startedAt) / CONFIG.spinDurationS);
}

/** How touchdown goes with lateral lean `lean`: an unfinished spin or a hard lean crashes. */
export function landing(jump: Jump, lean: number, time: number): Landing {
  const spin = spinProgress(jump, time);
  if (spin !== null && spin < 1) return 'crash';
  if (Math.abs(lean) >= CONFIG.landingCrashLean) return 'crash';
  return spin !== null && !jump.touchedFloor ? 'trick' : 'clean';
}

/**
 * Eases speed toward the lean target for one frame. During a landing carry
 * (`landingCarry` > 0 seconds left) it eases over landingCarryS instead of the
 * usual fraction of a second, so a landing keeps its momentum.
 */
export function easeSpeed(speed: number, target: number, landingCarry: number, dt: number): number {
  const rate = landingCarry > 0 ? 1 / CONFIG.landingCarryS : CONFIG.speedEaseRate;
  return speed + (target - speed) * Math.min(1, dt * rate);
}

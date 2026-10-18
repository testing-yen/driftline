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
    flip: null,
    touchedFloor: false,
    takeoffLean: lean,
  };
}

/**
 * Lateral lean that starts a flip each way: trickLeanFraction further than
 * the takeoff lean in that direction (or than level, if the rider took off
 * leaning the other way). Easing back toward level never reaches either.
 */
export function trickThresholds(jump: Jump): { left: number; right: number } {
  return {
    left: Math.max(-1, Math.min(0, jump.takeoffLean) - CONFIG.trickLeanFraction),
    right: Math.min(1, Math.max(0, jump.takeoffLean) + CONFIG.trickLeanFraction),
  };
}

/**
 * One frame in the air. `lean` is lateral lean in [-1, 1]. Leaning past a
 * trick threshold starts the jump's one flip unless a side edge is on the
 * floor; a side edge on the floor at any point voids the trick. A flip always
 * finishes by touchdown, speeding up when started late, so the only timing
 * rule is that it needs minFlipS of air left to start.
 */
export function updateAir(jump: Jump, lean: number, sideGrounded: boolean, time: number): Jump {
  const { left, right } = trickThresholds(jump);
  const airLeft = jump.startedAt + jump.duration - time;
  const startsFlip =
    jump.flip === null && (lean >= right || lean <= left) && !sideGrounded && airLeft >= CONFIG.minFlipS;
  return {
    ...jump,
    touchedFloor: jump.touchedFloor || sideGrounded,
    flip: startsFlip ? { startedAt: time, endsAt: time + Math.min(CONFIG.flipDurationS, airLeft) } : jump.flip,
  };
}

export function hasLanded(jump: Jump, time: number): boolean {
  return time >= jump.startedAt + jump.duration;
}

/** 0..1 through the flip, or null when the jump has none. */
export function flipProgress(jump: Jump, time: number): number | null {
  if (jump.flip === null) return null;
  return Math.min(1, (time - jump.flip.startedAt) / (jump.flip.endsAt - jump.flip.startedAt));
}

/** How touchdown goes with lateral lean `lean`: a hard lean crashes; a flip scores unless the edge touched the floor. */
export function landing(jump: Jump, lean: number): Landing {
  if (Math.abs(lean) >= CONFIG.landingCrashLean) return 'crash';
  return jump.flip !== null && !jump.touchedFloor ? 'trick' : 'clean';
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

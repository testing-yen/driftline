import { CONFIG } from '../config.js';
import { applyDeadZone, deadZoneToNormal, degToNormal } from './tiltMath.js';

/** Degrees from neutral at which the board's edge touches the floor, per direction. */
export interface BoardReach {
  forward: number;
  back: number;
  left: number;
  right: number;
}

export type LeanDirection = keyof BoardReach;

/** Calibration order, and the order every per-direction list is shown in. */
export const LEAN_DIRECTIONS: readonly LeanDirection[] = ['forward', 'back', 'left', 'right'];

/**
 * Measured on 2026-10-16 on the user's wobble board, phone mounted portrait
 * (35.1, 34.2, 27.9, 37.8 degrees, rounded). Custom hardware must re-measure
 * with the Calibrate board flow.
 */
export const DEFAULT_REACH: BoardReach = { forward: 35, back: 34, left: 28, right: 38 };

/** Stored reach outside this range is a corrupt value or a phone not on a board, not a real measurement. */
export const REACH_LIMITS_DEG = { min: 3, max: 80 } as const;

export const REACH_STORAGE_KEY = 'driftline.boardReach.v1';

/** How far the board leans toward `dir`, in degrees; negative when it leans the other way. */
export function leanToward(dir: LeanDirection, xDeg: number, yDeg: number): number {
  switch (dir) {
    case 'forward':
      return yDeg;
    case 'back':
      return -yDeg;
    case 'left':
      return -xDeg;
    case 'right':
      return xDeg;
  }
}

/**
 * Calibrated lean in degrees (x: + right, y: + forward) to a normalized sample.
 * Each direction reaches full deflection at its own `reach * fullLeanFraction`,
 * so a board that tips further one way still needs the same effort per side.
 */
export function leanFromAngles(
  xDeg: number,
  yDeg: number,
  reach: BoardReach,
): { x: number; y: number; grounded: boolean } {
  return {
    x: axisLean(xDeg, xDeg >= 0 ? reach.right : reach.left),
    y: axisLean(yDeg, yDeg >= 0 ? reach.forward : reach.back),
    grounded: LEAN_DIRECTIONS.some(
      (dir) => leanToward(dir, xDeg, yDeg) >= reach[dir] * CONFIG.groundedFraction,
    ),
  };
}

function axisLean(deg: number, reachDeg: number): number {
  const fullDeg = reachDeg * CONFIG.fullLeanFraction;
  return applyDeadZone(degToNormal(deg, fullDeg), deadZoneToNormal(CONFIG.deadZoneDeg, fullDeg));
}

/** Parses the stored reach; anything missing, malformed, or out of range falls back to DEFAULT_REACH. */
export function parseStoredReach(raw: string | null): BoardReach {
  if (raw === null) return DEFAULT_REACH;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_REACH;
  }
  if (typeof value !== 'object' || value === null) return DEFAULT_REACH;
  const record = value as Record<string, unknown>;
  const reach = { ...DEFAULT_REACH };
  for (const dir of LEAN_DIRECTIONS) {
    const deg = record[dir];
    if (!isReachDeg(deg)) return DEFAULT_REACH;
    reach[dir] = deg;
  }
  return reach;
}

export function isReachDeg(deg: unknown): deg is number {
  // The range check also rejects NaN and Infinity.
  return typeof deg === 'number' && deg >= REACH_LIMITS_DEG.min && deg <= REACH_LIMITS_DEG.max;
}

/** The saved reach, or DEFAULT_REACH when storage is empty, blocked, or corrupt. */
export function loadReach(): BoardReach {
  try {
    return parseStoredReach(localStorage.getItem(REACH_STORAGE_KEY));
  } catch {
    return DEFAULT_REACH;
  }
}

/** Best effort: without storage the reach still applies until the page reloads. */
export function saveReach(reach: BoardReach): void {
  try {
    localStorage.setItem(REACH_STORAGE_KEY, JSON.stringify(reach));
  } catch {
    // Private mode or blocked storage.
  }
}

import { CONFIG } from '../config.js';
import { LEAN_DIRECTIONS, REACH_LIMITS_DEG, leanToward, type BoardReach, type LeanDirection } from './boardReach.js';
import type { LeanDegrees } from './TiltInput.js';

/** A steady push being timed. It restarts whenever the lean leaves `anchor ± reachHoldToleranceDeg`. */
interface Hold {
  since: number;
  /** Time of the latest sample, to notice a stalled stream. */
  last: number;
  anchor: number;
  sum: number;
  count: number;
}

/**
 * A longer gap between samples means the stream stalled (phone locked, tab
 * hidden), so the hold restarts instead of averaging across the gap.
 */
const MAX_SAMPLE_GAP_MS = 200;

/**
 * The Calibrate board flow: level the board for the neutral, then push each
 * edge to the floor in LEAN_DIRECTIONS order, returning to level in between.
 * `reach` starts as the previous reach and gains each direction as it is captured.
 */
export type CalibStep =
  | { kind: 'neutral'; reach: BoardReach }
  | { kind: 'push'; dir: LeanDirection; reach: BoardReach; hold: Hold | null }
  | { kind: 'return'; captured: LeanDirection; next: LeanDirection; reach: BoardReach }
  | { kind: 'done'; reach: BoardReach };

export interface CalibSample {
  /** Calibrated lean in degrees. */
  lean: LeanDegrees;
  /** The input has finished collecting its neutral. */
  calibrated: boolean;
}

/** The caller re-zeroes the input's neutral alongside this, with the board held level. */
export function startCalibration(previous: BoardReach): CalibStep {
  return { kind: 'neutral', reach: previous };
}

/** Feeds one sample taken at `now` (ms); returns the same step when nothing changed. */
export function advance(step: CalibStep, sample: CalibSample, now: number): CalibStep {
  switch (step.kind) {
    case 'neutral':
      return sample.calibrated ? push(LEAN_DIRECTIONS[0], step.reach) : step;
    case 'push':
      return advancePush(step, leanToward(step.dir, sample.lean.x, sample.lean.y), now);
    case 'return': {
      const level = Math.max(Math.abs(sample.lean.x), Math.abs(sample.lean.y)) < CONFIG.reachLevelDeg;
      return level ? push(step.next, step.reach) : step;
    }
    case 'done':
      return step;
  }
}

/** 0..1 of the way through the current hold, for a progress bar. */
export function holdProgress(step: CalibStep, now: number): number {
  if (step.kind !== 'push' || !step.hold) return 0;
  return Math.min(1, (now - step.hold.since) / CONFIG.reachHoldMs);
}

function push(dir: LeanDirection, reach: BoardReach): CalibStep {
  return { kind: 'push', dir, reach, hold: null };
}

function advancePush(step: Extract<CalibStep, { kind: 'push' }>, deg: number, now: number): CalibStep {
  // Written so NaN also drops the hold.
  if (!(deg >= CONFIG.reachCaptureMinDeg && deg <= REACH_LIMITS_DEG.max)) {
    return step.hold ? { ...step, hold: null } : step;
  }
  const hold = step.hold;
  if (
    !hold ||
    Math.abs(deg - hold.anchor) > CONFIG.reachHoldToleranceDeg ||
    now - hold.last > MAX_SAMPLE_GAP_MS
  ) {
    return { ...step, hold: { since: now, last: now, anchor: deg, sum: deg, count: 1 } };
  }
  const held = { ...hold, last: now, sum: hold.sum + deg, count: hold.count + 1 };
  if (now - held.since < CONFIG.reachHoldMs) return { ...step, hold: held };

  const reach = { ...step.reach, [step.dir]: held.sum / held.count };
  const next = LEAN_DIRECTIONS[LEAN_DIRECTIONS.indexOf(step.dir) + 1];
  return next ? { kind: 'return', captured: step.dir, next, reach } : { kind: 'done', reach };
}

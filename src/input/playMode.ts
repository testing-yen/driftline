import { CONFIG } from '../config.js';
import { leanFromAngles, type BoardReach } from './boardReach.js';
import type { LeanDegrees, TiltSample } from './TiltInput.js';
import { leanToNormal } from './tiltMath.js';

/** How the phone is ridden: mounted on a wobble board, or held in the hands. */
export type PlayMode = 'board' | 'handheld';

export const PLAY_MODES: readonly PlayMode[] = ['board', 'handheld'];

export const DEFAULT_PLAY_MODE: PlayMode = 'board';

export const PLAY_MODE_STORAGE_KEY = 'driftline.playMode.v1';

/** How one play mode turns the lean from neutral into a TiltSample. */
export interface LeanProfile {
  readonly mode: PlayMode;
  /**
   * Turns the frame's pitch (+ with the top edge tipped away from the player)
   * into lean y (+ forward, faster). On a board forward is tipping the top
   * edge down; in the hand it is tilting the top edge toward the player.
   */
  readonly forwardSign: 1 | -1;
  /** The Calibrate board flow measures the reach this profile scales to. */
  readonly calibratesReach: boolean;
  /** `lean` is already signed: x + right, y + forward. */
  toSample(lean: LeanDegrees, reach: BoardReach): TiltSample;
}

export const LEAN_PROFILES: Readonly<Record<PlayMode, LeanProfile>> = {
  board: {
    mode: 'board',
    forwardSign: 1,
    calibratesReach: true,
    toSample: (lean, reach) => leanFromAngles(lean.x, lean.y, reach),
  },
  handheld: {
    mode: 'handheld',
    forwardSign: -1,
    calibratesReach: false,
    // No floor under a hand-held phone, so nothing is ever grounded.
    toSample: (lean) => ({
      x: leanToNormal(lean.x, CONFIG.handheldFullLeanDeg, CONFIG.deadZoneDeg),
      y: leanToNormal(lean.y, CONFIG.handheldFullLeanDeg, CONFIG.deadZoneDeg),
      grounded: false,
      sideGrounded: false,
    }),
  },
};

/** The stored mode, or DEFAULT_PLAY_MODE for anything else. */
export function parsePlayMode(raw: string | null): PlayMode {
  return PLAY_MODES.find((mode) => mode === raw) ?? DEFAULT_PLAY_MODE;
}

/** The remembered mode, or DEFAULT_PLAY_MODE when storage is empty, blocked, or corrupt. */
export function loadPlayMode(): PlayMode {
  try {
    return parsePlayMode(localStorage.getItem(PLAY_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_PLAY_MODE;
  }
}

/** Best effort: without storage the mode still applies until the page reloads. */
export function savePlayMode(mode: PlayMode): void {
  try {
    localStorage.setItem(PLAY_MODE_STORAGE_KEY, mode);
  } catch {
    // Private mode or blocked storage.
  }
}

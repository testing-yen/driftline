/** Shared game entity types. All art is original; nothing here derives from SkiFree. */

export type ObstacleKind = 'pine' | 'rock';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  /** World coords: x lateral (px), y downhill distance (px). */
  x: number;
  y: number;
  /** Collision radius, px. */
  r: number;
  /** Visual scale for variety. */
  scale: number;
}

interface GateBase {
  id: number;
  /** Downhill position of the gate line, px. */
  y: number;
  /** Center of the opening, px. */
  centerX: number;
  halfWidth: number;
}

/** resolvedAt is game time in seconds when the player crossed the gate line. */
export type Gate =
  | (GateBase & { state: 'pending' })
  | (GateBase & { state: 'cleared'; points: number; resolvedAt: number })
  | (GateBase & { state: 'missed'; resolvedAt: number });

/** A snow kicker. y is its take-off lip; the ramp itself runs uphill of it. */
export interface Ramp {
  id: number;
  x: number;
  y: number;
  halfWidth: number;
}

export type SpinDir = 'left' | 'right';

/** Times are game time in seconds. */
export interface Jump {
  startedAt: number;
  /** Seconds from takeoff to touchdown. */
  duration: number;
  /** Locked speed for the whole jump, px/s. */
  speed: number;
  /** The one spin this jump may have, from when it started. */
  spin: { dir: SpinDir; startedAt: number; endsAt: number } | null;
  /** A side edge hit the floor at some point in the air, which voids the trick. */
  touchedFloor: boolean;
  /**
   * Lateral lean at takeoff. A spin needs a lean past it (see trickThresholds),
   * so a lean held while steering onto the ramp does not spin by itself and
   * easing off it never does.
   */
  takeoffLean: number;
}

/** What the in-air trick meter shows: lateral lean against the two spin thresholds, all in [-1, 1]. */
export interface AirLean {
  lean: number;
  left: number;
  right: number;
  /** A side edge is on the floor, so no spin can start. */
  sideGrounded: boolean;
  spinning: boolean;
}

/** A jump moment the renderer calls out next to the rider; `at` is game time in seconds. */
export interface JumpCallout {
  kind: 'takeoff' | 'spin' | 'trick' | 'crash';
  at: number;
}

export interface PlayerState {
  x: number;
  y: number;
  speed: number;
  /** Seconds remaining of stumble slowdown (0 = not stumbling). */
  stumbleTimer: number;
  /** Seconds remaining of post-crash invulnerability. */
  invulnTimer: number;
  /** In the air off a ramp; null on the snow. */
  jump: Jump | null;
  /** Seconds remaining of the slow speed easing after a clean landing (0 = normal easing). */
  landingCarry: number;
}

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';

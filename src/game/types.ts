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

export interface PlayerState {
  x: number;
  y: number;
  speed: number;
  /** Seconds remaining of stumble slowdown (0 = not stumbling). */
  stumbleTimer: number;
  /** Seconds remaining of post-crash invulnerability. */
  invulnTimer: number;
}

export type GamePhase = 'menu' | 'playing' | 'gameover';

/**
 * All tuning parameters for Driftline live here.
 *
 * Nothing gameplay-related should hard-code numbers elsewhere — change them
 * here so play-testers (especially people on a wobble board) can tune the
 * feel without reading game logic.
 */
export const CONFIG = {
  /** Player physics */
  baseSpeed: 260, // px/s downhill at neutral tilt
  tuckMultiplier: 1.8, // forward tilt (tuck) speed multiplier
  brakeMultiplier: 0.55, // backward tilt (brake) speed multiplier
  steerSpeed: 460, // px/s lateral movement at full tilt
  playerRadius: 14, // collision radius of the rider, px

  /** Playfield */
  worldHalfWidth: 520, // half-width of the skiable slope, px

  /** Tilt input */
  maxTiltDeg: 25, // tilt angle that maps to full deflection
  deadZoneDeg: 2, // ignore tilt smaller than this (1-3 deg recommended)
  lowPassAlpha: 0.22, // smoothing for IMU noise (~10 Hz feel at 60 fps)
  calibSamples: 60, // samples (~1s) used for per-session neutral calibration

  /** Obstacles & gates */
  chunkHeight: 1000, // world-gen chunk height, px
  obstaclesPerChunk: 7, // trees/rocks per chunk
  gateSpacingY: 650, // vertical distance between slalom gates, px
  gateHalfWidth: 70, // half-width of a gate opening, px

  /** Chaser ("shadow beast") — the run timer */
  chaserTriggerDistance: 4500, // px travelled before the chaser appears (~17s in)
  chaserSpawnBehind: 850, // px behind the player at spawn
  chaserSpeed: 295, // px/s — slightly above baseSpeed so coasters get caught
  chaserAccel: 5, // px/s^2 — guarantees even tuckers get caught eventually
  chaserTurnSpeed: 260, // px/s lateral homing speed
  chaserCatchRadius: 30, // catch distance, px

  /** Stumble (crash) */
  stumbleSlowFactor: 0.5, // speed multiplier while stumbling
  stumbleDuration: 1.0, // seconds of slowdown after a crash
  invulnDuration: 1.2, // seconds of invulnerability after a crash

  /** Scoring */
  scorePerPx: 0.02, // points per px travelled
  gateScore: 100, // points per clean gate
  gateStreakBonus: 25, // extra points per consecutive gate in a streak
  stumblePenalty: 50, // points lost on crash (score never goes below 0)
} as const;

export type Config = typeof CONFIG;

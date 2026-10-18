/**
 * All tuning parameters for Driftline live here.
 *
 * Nothing gameplay-related should hard-code numbers elsewhere — change them
 * here so play-testers (especially people on a wobble board) can tune the
 * feel without reading game logic.
 */
export const CONFIG = {
  /** Player physics */
  // Speed comes from forward lean only. Leaning back is nearly impossible in a plank,
  // so a level board is the slowest a rider goes without a penalty.
  flatSpeed: 143, // px/s with the board level (no forward lean)
  fullLeanSpeed: 468, // px/s at full forward lean (fullLeanFraction of the forward reach)
  steerSpeed: 460, // px/s lateral movement at full tilt
  playerRadius: 14, // collision radius of the rider, px
  speedEaseRate: 6, // 1/s: speed closes on the lean target with a ~0.17 s time constant

  /** Playfield */
  worldHalfWidth: 520, // half-width of the skiable slope, px
  viewMargin: 40, // snow kept visible beyond each slope edge; the view zooms out to fit slope + margin on narrow screens

  /** Tilt input */
  // Both fractions are of the board's reach (the lean at which its edge touches the floor,
  // calibrated per board) and depend on the hardware; re-tune them for a different board or plank rig.
  fullLeanFraction: 0.7, // full steer/tuck/brake here, so top speed never needs the edge on the floor (resting there would stop the plank workout)
  groundedFraction: 0.9, // past this the edge is effectively on the floor: "Lift the edge!" and no lean bonus
  groundedGraceS: 0.5, // a wobbling board brushes the floor; only an edge held down this long counts as resting on it
  restingSpeedFactor: 0.5, // × flatSpeed once resting on the edge, so leaning on the floor instead of planking loses the run
  deadZoneDeg: 2, // ignore tilt smaller than this (1-3 deg recommended)
  lowPassAlpha: 0.22, // smoothing for IMU noise (~10 Hz feel at 60 fps)
  calibSamples: 60, // samples (~1s) used for per-session neutral calibration

  /** Board reach calibration (Calibrate board flow) */
  reachCaptureMinDeg: 8, // a push only counts once the lean passes this; below it the rider has not started pushing
  reachHoldToleranceDeg: 1, // the lean must stay within this of where the hold started...
  reachHoldMs: 1000, // ...for this long, so a bounce off the floor is not captured as the reach
  reachLevelDeg: 4, // between directions every lean must drop below this before the next push arms

  /** Obstacles & gates */
  chunkHeight: 1000, // world-gen chunk height, px
  obstaclesPerChunk: 7, // trees/rocks per chunk
  gateSpacingY: 650, // vertical distance between slalom gates, px
  gateHalfWidth: 70, // half-width of a gate opening, px
  gatePopupDuration: 0.9, // seconds the "+N" / miss mark stays visible
  gatePopupRise: 40, // px the "+N" popup floats up while fading

  /** Jump ramps */
  rampEveryGates: 2.5, // on average one ramp per this many gates (about one every 2-3 gates)
  rampHalfWidth: 44, // half-width of the take-off lip, px; the rider's centre must cross the lip within it
  rampLength: 55, // footprint of the ramp uphill of its lip, px
  rampClearance: 110, // trees, rocks and gate lines stay at least this far from a ramp's footprint, px
  typicalTakeoffSpeed: 350, // px/s, a rider leaning well forward...
  airTimeAtTypicalSpeed: 1.0, // ...is in the air this long, s; air time is proportional to takeoff speed
  minAirTimeS: 0.6, // even a slow takeoff leaves room to start a flip
  maxAirTimeS: 1.4, // hang time cap, s
  airSpeedBoost: 1.3, // speed in the air is takeoff speed × this (no snow friction), so jumps help outrun the golem
  jumpScore: 50, // points per jump
  trickScore: 100, // points for a flip completed before landing
  // Both lean fractions are of full lean (the steering input's ±1) and depend on the hardware:
  // they must stay well inside the grounded threshold, so re-tune them with fullLeanFraction / groundedFraction.
  trickLeanFraction: 0.35, // lean this much further sideways than at takeoff, in the air, to start a flip (depends on the board)
  landingCrashLean: 0.6, // lateral lean at touchdown at or past this crashes the landing
  flipDurationS: 0.5, // one full flip when there is air time for it; a later flip speeds up to finish by touchdown
  minFlipS: 0.15, // a flip needs at least this much air left to start, so a lean right at touchdown is not a trick
  landingCarryS: 1.0, // after a clean landing, speed eases from air speed to the lean target over about this long, s

  /** Chaser ("avalanche golem") — the run timer */
  chaserTriggerDistance: 4500, // px travelled before the chaser appears (~17s in)
  chaserSpawnBehind: 850, // px behind the player at spawn
  chaserSpeed: 295, // px/s — about halfway from flat to full lean, so a level board gets caught
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

  /** Session best */
  newBestBannerDuration: 1.6, // seconds the mid-run "NEW BEST!" banner stays up
} as const;

export type Config = typeof CONFIG;

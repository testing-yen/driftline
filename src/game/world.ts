import { CONFIG } from '../config.js';
import { mulberry32 } from './rng.js';
import type { Gate, Obstacle, Ramp } from './types.js';

/** Random positions tried for a ramp or an obstacle before giving up on it. */
const PLACEMENT_TRIES = 30;

/** Tree and rock radii before their random 0.8-1.4x scale. */
const BASE_RADIUS = { pine: 12, rock: 16 } as const;
const MIN_SCALE = 0.8;
const SCALE_RANGE = 0.6;
/** The largest radius a tree or rock can roll, so a ramp can keep a neighbouring chunk's obstacles out of reach. */
const MAX_OBSTACLE_RADIUS = BASE_RADIUS.rock * (MIN_SCALE + SCALE_RANGE);

/**
 * Procedural downhill course: chunks of obstacles, slalom gates and jump
 * ramps generated ahead of the player with a seeded RNG. Original obstacle
 * designs (pines and rocks) — not SkiFree sprites.
 */
export class World {
  private rng: () => number;
  private nextChunkIndex = 0;
  private nextObstacleId = 1;
  private nextGateId = 1;
  private nextRampId = 1;
  obstacles: Obstacle[] = [];
  gates: Gate[] = [];
  ramps: Ramp[] = [];

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  /**
   * Generate all chunks intersecting [yMin, yMax). Idempotent: each chunk is
   * generated exactly once as the player descends.
   */
  ensure(yMin: number, yMax: number): void {
    const first = Math.max(0, Math.floor(yMin / CONFIG.chunkHeight));
    const last = Math.floor(yMax / CONFIG.chunkHeight);
    while (this.nextChunkIndex <= last) {
      const i = this.nextChunkIndex;
      if (i >= first) this.generateChunk(i);
      this.nextChunkIndex += 1;
    }
  }

  /** Drop chunks fully above yMin to bound memory. */
  prune(yMin: number): void {
    this.obstacles = this.obstacles.filter((o) => o.y > yMin - 200);
    this.gates = this.gates.filter((g) => g.y > yMin - 200);
    this.ramps = this.ramps.filter((r) => r.y > yMin - 200);
  }

  private generateChunk(index: number): void {
    const y0 = index * CONFIG.chunkHeight;
    const half = CONFIG.worldHalfWidth;

    // One gate per gate-spacing interval inside this chunk.
    const gatesInChunk = Math.max(1, Math.round(CONFIG.chunkHeight / CONFIG.gateSpacingY));
    const gateYs = Array.from({ length: gatesInChunk }, (_, g) => y0 + ((g + 0.5) / gatesInChunk) * CONFIG.chunkHeight);

    // The ramp goes first so the trees and rocks can keep out of its way.
    const ramp = this.rng() < gatesInChunk / CONFIG.rampEveryGates ? this.placeRamp(y0, gateYs) : null;
    if (ramp) this.ramps.push(ramp);

    for (let n = 0; n < CONFIG.obstaclesPerChunk; n += 1) {
      const kind = this.rng() < 0.6 ? 'pine' : 'rock';
      const scale = MIN_SCALE + this.rng() * SCALE_RANGE;
      const r = BASE_RADIUS[kind] * scale;
      for (let tries = 0; tries < PLACEMENT_TRIES; tries += 1) {
        const x = (this.rng() * 2 - 1) * half;
        const y = y0 + this.rng() * CONFIG.chunkHeight;
        if (ramp && inClearZone(ramp, x, y, r)) continue;
        this.obstacles.push({ id: this.nextObstacleId++, kind, x, y, r, scale });
        break;
      }
    }

    for (const y of gateYs) {
      const margin = CONFIG.gateHalfWidth + 30;
      const centerX = (this.rng() * 2 - 1) * (half - margin);
      this.gates.push({
        id: this.nextGateId++,
        y,
        centerX,
        halfWidth: CONFIG.gateHalfWidth,
        state: 'pending',
      });
    }
  }

  /**
   * A ramp whose clear zone, widened by the largest obstacle radius, fits
   * inside this chunk, so no other chunk's trees reach it, and stays off every
   * gate line. Null if no spot turned up.
   */
  private placeRamp(y0: number, gateYs: number[]): Ramp | null {
    const { rampLength: length, rampClearanceY: clear, rampHalfWidth: halfWidth } = CONFIG;
    const margin = clear + MAX_OBSTACLE_RADIUS;
    const top = y0 + length + margin;
    const span = CONFIG.chunkHeight - length - 2 * margin;
    for (let tries = 0; tries < PLACEMENT_TRIES; tries += 1) {
      const y = top + this.rng() * span;
      const x = (this.rng() * 2 - 1) * (CONFIG.worldHalfWidth - halfWidth);
      if (gateYs.every((gy) => gy <= y - length - clear || gy >= y + clear)) {
        return { id: this.nextRampId++, x, y, halfWidth };
      }
    }
    return null;
  }
}

/** Does a circle at (x, y) with radius r reach into the clear zone around the ramp's footprint? */
function inClearZone(ramp: Ramp, x: number, y: number, r: number): boolean {
  const reachY = CONFIG.rampClearanceY + r;
  return (
    Math.abs(x - ramp.x) < ramp.halfWidth + CONFIG.rampClearanceX + r &&
    y > ramp.y - CONFIG.rampLength - reachY &&
    y < ramp.y + reachY
  );
}

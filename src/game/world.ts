import { CONFIG } from '../config.js';
import { mulberry32 } from './rng.js';
import type { Gate, Obstacle, Ramp } from './types.js';

/** Random positions tried for a ramp or an obstacle before giving up on it. */
const PLACEMENT_TRIES = 30;

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
      const scale = 0.8 + this.rng() * 0.6;
      const r = (kind === 'pine' ? 12 : 16) * scale;
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
   * A ramp whose clear zone fits inside this chunk, so no other chunk's trees
   * reach it, and stays off every gate line. Null if no spot turned up.
   */
  private placeRamp(y0: number, gateYs: number[]): Ramp | null {
    const { rampLength: length, rampClearance: clear, rampHalfWidth: halfWidth } = CONFIG;
    const top = y0 + length + clear;
    const span = CONFIG.chunkHeight - length - 2 * clear;
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
  const reach = CONFIG.rampClearance + r;
  return (
    Math.abs(x - ramp.x) < ramp.halfWidth + reach &&
    y > ramp.y - CONFIG.rampLength - reach &&
    y < ramp.y + reach
  );
}

import { CONFIG } from '../config.js';
import { mulberry32 } from './rng.js';
import type { Gate, Obstacle } from './types.js';

/**
 * Procedural downhill course: chunks of obstacles and slalom gates generated
 * ahead of the player with a seeded RNG. Original obstacle designs (pines and
 * rocks) — not SkiFree sprites.
 */
export class World {
  private rng: () => number;
  private nextChunkIndex = 0;
  private nextObstacleId = 1;
  private nextGateId = 1;
  obstacles: Obstacle[] = [];
  gates: Gate[] = [];

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
  }

  private generateChunk(index: number): void {
    const y0 = index * CONFIG.chunkHeight;
    const half = CONFIG.worldHalfWidth;

    for (let n = 0; n < CONFIG.obstaclesPerChunk; n += 1) {
      const kind = this.rng() < 0.6 ? 'pine' : 'rock';
      const x = (this.rng() * 2 - 1) * half;
      const y = y0 + this.rng() * CONFIG.chunkHeight;
      const scale = 0.8 + this.rng() * 0.6;
      this.obstacles.push({
        id: this.nextObstacleId++,
        kind,
        x,
        y,
        r: (kind === 'pine' ? 12 : 16) * scale,
        scale,
      });
    }

    // One gate per gate-spacing interval inside this chunk.
    const gatesInChunk = Math.max(1, Math.round(CONFIG.chunkHeight / CONFIG.gateSpacingY));
    for (let g = 0; g < gatesInChunk; g += 1) {
      const y = y0 + ((g + 0.5) / gatesInChunk) * CONFIG.chunkHeight;
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
}

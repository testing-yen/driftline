import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { Chaser } from '../src/game/chaser.js';

const DT = 1 / 60;

function runFrames(chaser: Chaser, frames: number, playerX: number): void {
  for (let i = 0; i < frames; i += 1) chaser.update(DT, playerX);
}

describe('Chaser', () => {
  it('stays inactive before the trigger distance', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance - 1, 0, 1000);
    expect(c.active).toBe(false);
    expect(c.caught(0, 1000)).toBe(false);
  });

  it('activates at the trigger distance, spawning behind the player', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance, 0, 5000);
    expect(c.active).toBe(true);
    expect(c.y).toBe(5000 - CONFIG.chaserSpawnBehind);
  });

  it('catches a coasting player (slower than the chaser)', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance, 0, 5000);
    // Player coasts at base speed; chaser is faster -> gap must close.
    let playerY = 5000;
    let caught = false;
    for (let i = 0; i < 60 * 60 && !caught; i += 1) {
      playerY += CONFIG.baseSpeed * DT;
      c.update(DT, 0);
      caught = c.caught(0, playerY);
    }
    expect(caught).toBe(true);
  });

  it('cannot catch a player tucking at full speed immediately', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance, 0, 5000);
    let playerY = 5000;
    const tuckSpeed = CONFIG.baseSpeed * CONFIG.tuckMultiplier;
    let caught = false;
    // 10 seconds of full tuck: the gap should still be open.
    for (let i = 0; i < 600 && !caught; i += 1) {
      playerY += tuckSpeed * DT;
      c.update(DT, 0);
      caught = c.caught(0, playerY);
    }
    expect(caught).toBe(false);
  });

  it('eventually catches even a tucking player (acceleration guarantees a cap)', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance, 0, 5000);
    let playerY = 5000;
    const tuckSpeed = CONFIG.baseSpeed * CONFIG.tuckMultiplier;
    let caught = false;
    for (let i = 0; i < 60 * 300 && !caught; i += 1) {
      playerY += tuckSpeed * DT;
      c.update(DT, 0);
      caught = c.caught(0, playerY);
    }
    expect(caught).toBe(true);
  });

  it('homes laterally toward the player within its turn limit', () => {
    const c = new Chaser();
    c.maybeActivate(CONFIG.chaserTriggerDistance, 300, 5000);
    const startX = c.x;
    runFrames(c, 60, -300);
    expect(c.x).toBeLessThan(startX);
    // One second of turning (260 px) cannot cover the whole 600px gap.
    expect(c.x).toBeGreaterThan(-300);
  });
});

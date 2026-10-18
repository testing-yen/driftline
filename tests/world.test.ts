import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { World } from '../src/game/world.js';

const CHUNKS = 400;
const SEEDS = [1, 42, 2024, 987654];

function course(seed: number): World {
  const world = new World(seed);
  world.ensure(0, CHUNKS * CONFIG.chunkHeight - 1);
  return world;
}

/** Distance from a point to the ramp's footprint: the lip's width, running rampLength uphill of it. */
function distanceToFootprint(ramp: { x: number; y: number; halfWidth: number }, x: number, y: number): number {
  const dx = Math.max(0, Math.abs(x - ramp.x) - ramp.halfWidth);
  const dy = Math.max(0, ramp.y - CONFIG.rampLength - y, y - ramp.y);
  return Math.hypot(dx, dy);
}

describe.each(SEEDS)('World ramps (seed %i)', (seed) => {
  const world = course(seed);

  it('appear at about the configured rate, once every 2-3 gates', () => {
    expect(CONFIG.rampEveryGates).toBeGreaterThanOrEqual(2);
    expect(CONFIG.rampEveryGates).toBeLessThanOrEqual(3);
    const gatesPerRamp = world.gates.length / world.ramps.length;
    expect(gatesPerRamp).toBeGreaterThan(CONFIG.rampEveryGates * 0.9);
    expect(gatesPerRamp).toBeLessThan(CONFIG.rampEveryGates * 1.1);
  });

  it('never have a tree or rock in their clear zone', () => {
    let nearest = Infinity;
    for (const ramp of world.ramps) {
      for (const ob of world.obstacles) nearest = Math.min(nearest, distanceToFootprint(ramp, ob.x, ob.y) - ob.r);
    }
    expect(nearest).toBeGreaterThanOrEqual(CONFIG.rampClearance);
  });

  it('never sit on a gate line', () => {
    const onGateLine = world.ramps.filter((ramp) =>
      world.gates.some(
        (gate) => gate.y > ramp.y - CONFIG.rampLength - CONFIG.rampClearance && gate.y < ramp.y + CONFIG.rampClearance,
      ),
    );
    expect(onGateLine).toEqual([]);
  });

  it('stay on the slope with their whole lip', () => {
    for (const ramp of world.ramps) {
      expect(Math.abs(ramp.x) + ramp.halfWidth).toBeLessThanOrEqual(CONFIG.worldHalfWidth);
    }
  });
});

describe('World ramp layout', () => {
  it('is reproducible from the seed', () => {
    expect(course(7).ramps).toEqual(course(7).ramps);
  });

  it('keeps the obstacle count: trees and rocks move out of the way instead of disappearing', () => {
    expect(course(3).obstacles.length).toBe(CHUNKS * CONFIG.obstaclesPerChunk);
  });

  it('prunes ramps behind the player like gates and obstacles', () => {
    const world = new World(5);
    world.ensure(0, 20 * CONFIG.chunkHeight);
    world.prune(10 * CONFIG.chunkHeight);
    expect(world.ramps.length).toBeGreaterThan(0);
    for (const ramp of world.ramps) expect(ramp.y).toBeGreaterThan(10 * CONFIG.chunkHeight - 200);
  });
});

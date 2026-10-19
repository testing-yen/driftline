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

/** Gaps from a circle's edge to the ramp's footprint (the lip's width, running rampLength uphill of it), across and down the slope. */
function gapsToFootprint(ramp: { x: number; y: number; halfWidth: number }, ob: { x: number; y: number; r: number }) {
  return {
    x: Math.abs(ob.x - ramp.x) - ramp.halfWidth - ob.r,
    y: Math.max(ramp.y - CONFIG.rampLength - ob.y, ob.y - ramp.y) - ob.r,
  };
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
    const inside = world.ramps.flatMap((ramp) =>
      world.obstacles.filter((ob) => {
        const gap = gapsToFootprint(ramp, ob);
        return gap.x < CONFIG.rampClearanceX && gap.y < CONFIG.rampClearanceY;
      }),
    );
    expect(world.obstacles.length).toBeGreaterThan(0);
    expect(inside).toEqual([]);
  });

  it('never sit on a gate line', () => {
    const onGateLine = world.ramps.filter((ramp) =>
      world.gates.some(
        (gate) => gate.y > ramp.y - CONFIG.rampLength - CONFIG.rampClearanceY && gate.y < ramp.y + CONFIG.rampClearanceY,
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

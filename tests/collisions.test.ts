import { describe, expect, it } from 'vitest';
import { makeConfig } from '../src/config.js';
import { circlesCollide, gateCrossed, gatePassed, rampHit, sweptHitsObstacle } from '../src/game/collisions.js';
import type { Obstacle } from '../src/game/types.js';

/** The longest move a rider makes on the snow in one 1/60 s frame: landing at air speed, at the largest dev downhill scale. */
const FASTEST = makeConfig(3);
const MAX_STEP = (FASTEST.fullLeanSpeed * FASTEST.airSpeedBoost) / 60;
const RIDER_R = FASTEST.playerRadius;
/** The smallest tree the world places: radius 12 at scale 0.8. */
const smallTree: Obstacle = { id: 1, kind: 'pine', x: 0, y: 1000, r: 12 * 0.8, scale: 0.8 };

/** Rides straight down at `x` in MAX_STEP frames, starting `phase` px into a step; true if any frame hits the tree. */
function rideDown(x: number, phase: number): boolean {
  for (let y = smallTree.y - 200 + phase; y < smallTree.y + 200; y += MAX_STEP) {
    if (sweptHitsObstacle({ x, y }, { x, y: y + MAX_STEP }, RIDER_R, [smallTree])) return true;
  }
  return false;
}

const PHASES = Array.from({ length: 50 }, (_, i) => (i / 50) * MAX_STEP);

describe('circlesCollide', () => {
  it('detects overlapping circles', () => {
    expect(circlesCollide(0, 0, 10, 5, 5, 10)).toBe(true);
  });

  it('rejects separated circles', () => {
    expect(circlesCollide(0, 0, 10, 100, 100, 10)).toBe(false);
  });

  it('treats exact touching as non-colliding (strict <)', () => {
    expect(circlesCollide(0, 0, 10, 20, 0, 10)).toBe(false);
    expect(circlesCollide(0, 0, 10, 19.9, 0, 10)).toBe(true);
  });
});

describe('gateCrossed', () => {
  it('fires when the player moves past the gate line this frame', () => {
    expect(gateCrossed(90, 110, 100)).toBe(true);
  });

  it('does not fire before reaching the line', () => {
    expect(gateCrossed(10, 90, 100)).toBe(false);
  });

  it('does not fire twice once past the line', () => {
    expect(gateCrossed(110, 130, 100)).toBe(false);
  });
});

describe('rampHit', () => {
  const ramp = { id: 1, x: 100, y: 500, halfWidth: 44 };

  it('hits when crossing the lip within its half-width', () => {
    expect(rampHit(490, 505, 100, ramp)).toBe(true);
    expect(rampHit(490, 505, 143, ramp)).toBe(true);
    expect(rampHit(490, 505, 57, ramp)).toBe(true);
  });

  it('misses outside the half-width', () => {
    expect(rampHit(490, 505, 145, ramp)).toBe(false);
    expect(rampHit(490, 505, 55, ramp)).toBe(false);
  });

  it('misses when the lip is not crossed this frame', () => {
    expect(rampHit(480, 495, 100, ramp)).toBe(false);
    expect(rampHit(505, 520, 100, ramp)).toBe(false);
  });
});

describe('gatePassed', () => {
  it('passes inside the opening', () => {
    expect(gatePassed(0, 0, 70)).toBe(true);
    expect(gatePassed(69, 0, 70)).toBe(true);
  });

  it('misses outside the opening', () => {
    expect(gatePassed(71, 0, 70)).toBe(false);
    expect(gatePassed(-200, 0, 70)).toBe(false);
  });

  it('respects an offset gate center', () => {
    expect(gatePassed(150, 150, 70)).toBe(true);
    expect(gatePassed(0, 150, 70)).toBe(false);
  });
});

describe('sweptHitsObstacle', () => {
  it('needs the swept test: checking only where each frame ends misses some grazing passes at the max step', () => {
    expect(MAX_STEP).toBeGreaterThan(25);
    const reach = RIDER_R + smallTree.r;
    // Grazing the tree's edge, some frames would end either side of it.
    const x = reach - 1;
    const endsInside = PHASES.filter((phase) => {
      for (let y = smallTree.y - 200 + phase; y < smallTree.y + 200; y += MAX_STEP) {
        if (circlesCollide(x, y, RIDER_R, smallTree.x, smallTree.y, smallTree.r)) return true;
      }
      return false;
    });
    expect(endsInside.length).toBeLessThan(PHASES.length);
  });

  it('hits a rider riding straight through the centre at the max step, whatever the frame phase', () => {
    expect(PHASES.every((phase) => rideDown(0, phase))).toBe(true);
  });

  it('hits a rider grazing the edge at the max step, whatever the frame phase', () => {
    const reach = RIDER_R + smallTree.r;
    expect(PHASES.every((phase) => rideDown(reach - 0.5, phase))).toBe(true);
    expect(PHASES.every((phase) => rideDown(-(reach - 0.5), phase))).toBe(true);
  });

  it('misses a rider passing just clear of the tree', () => {
    const reach = RIDER_R + smallTree.r;
    expect(PHASES.some((phase) => rideDown(reach + 0.5, phase))).toBe(false);
  });

  it('hits a diagonal move that crosses the tree mid-frame', () => {
    expect(sweptHitsObstacle({ x: -30, y: 985 }, { x: 30, y: 1015 }, RIDER_R, [smallTree])).toBe(true);
    expect(sweptHitsObstacle({ x: -30, y: 1000 }, { x: -30, y: 1000 }, RIDER_R, [smallTree])).toBe(false);
  });
});

describe('gate and ramp crossings at the max step', () => {
  it('fire on exactly one frame whatever the frame phase', () => {
    const ramp = { id: 1, x: 0, y: 1000, halfWidth: 44 };
    for (const phase of PHASES) {
      let gates = 0;
      let ramps = 0;
      for (let y = 800 + phase; y < 1200; y += MAX_STEP) {
        if (gateCrossed(y, y + MAX_STEP, 1000)) gates += 1;
        if (rampHit(y, y + MAX_STEP, 0, ramp)) ramps += 1;
      }
      expect([gates, ramps]).toEqual([1, 1]);
    }
  });
});

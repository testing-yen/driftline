import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { Chaser } from '../src/game/chaser.js';
import { gateCrossed } from '../src/game/collisions.js';
import { easeSpeed, hasLanded, takeoff } from '../src/game/jump.js';
import { leanTargetSpeed } from '../src/game/speedGauge.js';
import type { Jump } from '../src/game/types.js';
import { World } from '../src/game/world.js';

const DT = 1 / 60;
const RUN_LIMIT_S = 600;

interface Run {
  caughtAtS: number | null;
  jumps: number;
}

/**
 * A rider at full forward lean down the middle of the slope, ignoring trees,
 * against the real chaser. With `takeRamps` they hit every ramp they reach on
 * the snow (lined up perfectly, the most a rider can get out of ramps) and land
 * every jump clean; without, they ride the same course and never take off.
 */
function ride(seed: number, takeRamps: boolean): Run {
  const world = new World(seed);
  const chaser = new Chaser();
  const target = leanTargetSpeed(1, 'off', false);
  const x = 0;
  let y = 0;
  let speed: number = CONFIG.flatSpeed;
  let jump: Jump | null = null;
  let landingCarry = 0;
  let jumps = 0;
  for (let time = DT; time < RUN_LIMIT_S; time += DT) {
    if (jump && hasLanded(jump, time)) {
      jump = null;
      landingCarry = CONFIG.landingCarryS;
    }
    if (jump) {
      speed = jump.speed;
    } else {
      speed = easeSpeed(speed, target, landingCarry, DT);
      landingCarry = Math.max(0, landingCarry - DT);
    }
    const prevY = y;
    y += speed * DT;
    world.ensure(y - 400, y + 1600);
    world.prune(y - 400);
    if (takeRamps && !jump && world.ramps.some((r) => gateCrossed(prevY, y, r.y))) {
      jump = takeoff(speed, time);
      landingCarry = 0;
      jumps += 1;
    }
    chaser.maybeActivate(y, x, y);
    chaser.update(DT, x, y);
    if (chaser.caught(x, y)) return { caughtAtS: time, jumps };
  }
  return { caughtAtS: null, jumps };
}

describe.each([1, 7, 99, 2024])('a full-lean run that hits every ramp (seed %i)', (seed) => {
  const withRamps = ride(seed, true);
  const without = ride(seed, false);

  it('jumps all run long', () => {
    expect(withRamps.jumps).toBeGreaterThan(20);
  });

  it('still gets caught: the run cap holds', () => {
    expect(withRamps.caughtAtS).not.toBeNull();
    expect(withRamps.caughtAtS).toBeLessThan(180);
  });

  it('lasts longer than the same rider ignoring the ramps', () => {
    expect(without.caughtAtS).not.toBeNull();
    expect(withRamps.caughtAtS!).toBeGreaterThan(without.caughtAtS! + 5);
  });
});

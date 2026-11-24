import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { Game } from '../src/game/game.js';
import type { Renderer } from '../src/game/renderer.js';
import type { JumpCallout } from '../src/game/types.js';
import type { World } from '../src/game/world.js';
import type { TiltInput } from '../src/input/TiltInput.js';

const STEP = 1 / 60;

interface GameInternals {
  update(dt: number): void;
  draw(): void;
  player: { x: number; y: number; stumbleTimer: number };
  world: World;
}

const levelBoard: TiltInput = {
  name: 'level',
  needsUserGesture: false,
  calibrated: true,
  angles: null,
  start() {},
  stop() {},
  calibrate() {},
  update() {},
  sample: () => ({ x: 0, y: 0, grounded: false, sideGrounded: false }),
};

describe('riding into a tree', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls out the crash next to the rider', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const callouts: (JumpCallout | null)[] = [];
    const renderer = {
      render: (...args: unknown[]) => callouts.push(args[11] as JumpCallout | null),
      reset() {},
      addShake() {},
    } as unknown as Renderer;
    const game = new Game(renderer, levelBoard, null);
    game.start();
    const internals = game as unknown as GameInternals;
    internals.update(STEP);
    const { x, y } = internals.player;
    internals.world.obstacles = [{ id: -1, kind: 'pine', x, y: y + CONFIG.flatSpeed * 0.1, r: 16, scale: 1 }];
    internals.world.ramps = [];

    for (let i = 0; i < 30 && internals.player.stumbleTimer <= 0; i += 1) internals.update(STEP);
    internals.draw();

    expect(internals.player.stumbleTimer).toBeGreaterThan(0);
    expect(callouts.at(-1)).toMatchObject({ kind: 'crash' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { DEFAULT_REACH, leanFromAngles, type BoardReach } from '../src/input/boardReach.js';
import { DeviceMotionTiltInput } from '../src/input/DeviceMotionTiltInput.js';
import {
  LEAN_PROFILES,
  PLAY_MODE_STORAGE_KEY,
  loadPlayMode,
  parsePlayMode,
  savePlayMode,
  type PlayMode,
} from '../src/input/playMode.js';
import type { Vec3 } from '../src/input/tiltMath.js';

const G = 9.81;
const REACH: BoardReach = { forward: 30, back: 20, left: 25, right: 40 };
const FULL = CONFIG.handheldFullLeanDeg;
const handheld = LEAN_PROFILES.handheld;

/**
 * iOS gravity in device coordinates for a portrait phone whose top edge is
 * raised `heldDeg` from flat toward the player, then tipped right-edge-down
 * by `sideDeg` about the horizontal axis pointing away from the player.
 */
function gravityHeld(heldDeg: number, sideDeg = 0): Vec3 {
  const h = (heldDeg * Math.PI) / 180;
  const s = (sideDeg * Math.PI) / 180;
  return { x: G * Math.sin(s), y: -G * Math.sin(h) * Math.cos(s), z: -G * Math.cos(h) * Math.cos(s) };
}

/** A DeviceMotionTiltInput fed scripted devicemotion events through a stubbed window. */
async function motionInput(mode: PlayMode) {
  let onMotion: ((e: unknown) => void) | null = null;
  vi.stubGlobal('DeviceMotionEvent', class {});
  vi.stubGlobal('window', {
    addEventListener: (_type: string, fn: (e: unknown) => void) => {
      onMotion = fn;
    },
    removeEventListener: () => undefined,
  });
  const input = new DeviceMotionTiltInput(REACH, LEAN_PROFILES[mode]);
  await input.start();
  // Enough events to finish calibrating and let the low-pass filter settle.
  const hold = (a: Vec3, events = CONFIG.calibSamples + 60) => {
    for (let i = 0; i < events; i += 1) onMotion?.({ accelerationIncludingGravity: a });
    return input.sample();
  };
  return { input, hold };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('board profile', () => {
  it('is leanFromAngles on the stored reach', () => {
    for (const [x, y] of [
      [0, 0],
      [5, -3],
      [-20, 12],
      [27, 0],
      [0, 28],
      [-30, -30],
    ]) {
      expect(LEAN_PROFILES.board.toSample({ x, y }, REACH)).toEqual(leanFromAngles(x, y, REACH));
    }
  });

  it('speeds up when the top edge tips away from a flat neutral, and grounds the edge past its reach', async () => {
    const { input, hold } = await motionInput('board');
    input.calibrate();
    hold(gravityHeld(0));
    // Tipping the top edge down from flat is a negative "raise".
    expect(hold(gravityHeld(-REACH.forward * CONFIG.fullLeanFraction)).y).toBeCloseTo(1, 3);
    expect(hold(gravityHeld(-REACH.forward)).grounded).toBe(true);
    expect(hold(gravityHeld(0, REACH.right)).sideGrounded).toBe(true);
  });
});

describe('handheld profile', () => {
  it('reaches full lean at handheldFullLeanDeg in every direction, whatever the board reach', () => {
    expect(handheld.toSample({ x: 0, y: FULL }, REACH).y).toBe(1);
    expect(handheld.toSample({ x: 0, y: -FULL }, REACH).y).toBe(-1);
    expect(handheld.toSample({ x: FULL, y: 0 }, REACH).x).toBe(1);
    expect(handheld.toSample({ x: -FULL, y: 0 }, DEFAULT_REACH).x).toBe(-1);
    expect(handheld.toSample({ x: FULL - 1, y: 0 }, REACH).x).toBeLessThan(0.99);
  });

  it('keeps the dead zone', () => {
    const small = CONFIG.deadZoneDeg * 0.9;
    expect(handheld.toSample({ x: small, y: -small }, REACH)).toMatchObject({ x: 0, y: 0 });
  });

  it('steers the same amount left and right', () => {
    for (const deg of [3, 8, 14, 19, 35]) {
      expect(handheld.toSample({ x: -deg, y: 0 }, REACH).x).toBeCloseTo(-handheld.toSample({ x: deg, y: 0 }, REACH).x, 12);
    }
  });

  it('is never grounded, at any angle', () => {
    for (let x = -90; x <= 90; x += 15) {
      for (let y = -90; y <= 90; y += 15) {
        expect(handheld.toSample({ x, y }, REACH), `at ${x}, ${y}`).toMatchObject({ grounded: false, sideGrounded: false });
      }
    }
  });

  it.each([45, 60])('held at %i°: tilting the top edge toward the player is full speed, away gives none', async (heldDeg) => {
    const { input, hold } = await motionInput('handheld');
    input.calibrate();
    expect(hold(gravityHeld(heldDeg))).toMatchObject({ x: 0, y: 0 });
    expect(hold(gravityHeld(heldDeg + FULL)).y).toBeCloseTo(1, 3);
    expect(hold(gravityHeld(heldDeg - FULL)).y).toBeLessThanOrEqual(0);
    expect(hold(gravityHeld(heldDeg, FULL)).x).toBeCloseTo(1, 3);
    expect(hold(gravityHeld(heldDeg, -FULL)).x).toBeCloseTo(-1, 3);
    expect(hold(gravityHeld(heldDeg - 40, 50))).toMatchObject({ grounded: false, sideGrounded: false });
  });
});

describe('parsePlayMode', () => {
  it.each<PlayMode>(['board', 'handheld'])('round-trips %s', (mode) => {
    expect(parsePlayMode(mode)).toBe(mode);
  });

  it.each([null, '', 'Handheld', 'hand', '"board"', 'undefined', 'board '])('falls back to board for %j', (raw) => {
    expect(parsePlayMode(raw)).toBe('board');
  });
});

describe('loadPlayMode / savePlayMode', () => {
  it('remembers the chosen mode across loads', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(loadPlayMode()).toBe('board');
    savePlayMode('handheld');
    expect(store.get(PLAY_MODE_STORAGE_KEY)).toBe('handheld');
    expect(loadPlayMode()).toBe('handheld');
  });

  it('defaults to board without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => savePlayMode('handheld')).not.toThrow();
    expect(loadPlayMode()).toBe('board');
  });
});

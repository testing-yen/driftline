import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import {
  DEFAULT_REACH,
  REACH_STORAGE_KEY,
  leanFromAngles,
  loadReach,
  parseStoredReach,
  saveReach,
  type BoardReach,
} from '../src/input/boardReach.js';

/** Deliberately lopsided so a mix-up between directions changes the result. */
const REACH: BoardReach = { forward: 30, back: 20, left: 25, right: 40 };
const full = (deg: number) => deg * CONFIG.fullLeanFraction;
const groundAt = (deg: number) => deg * CONFIG.groundedFraction;

describe('leanFromAngles', () => {
  it('reaches exactly full deflection at each direction’s reach x fullLeanFraction', () => {
    expect(leanFromAngles(0, full(REACH.forward), REACH).y).toBe(1);
    expect(leanFromAngles(0, -full(REACH.back), REACH).y).toBe(-1);
    expect(leanFromAngles(-full(REACH.left), 0, REACH).x).toBe(-1);
    expect(leanFromAngles(full(REACH.right), 0, REACH).x).toBe(1);
  });

  it('is short of full deflection just before that angle', () => {
    expect(leanFromAngles(0, full(REACH.forward) - 1, REACH).y).toBeLessThan(0.99);
    expect(leanFromAngles(full(REACH.right) - 1, 0, REACH).x).toBeLessThan(0.99);
  });

  it('clamps leans beyond full deflection', () => {
    expect(leanFromAngles(60, 60, REACH)).toMatchObject({ x: 1, y: 1 });
    expect(leanFromAngles(-60, -60, REACH)).toMatchObject({ x: -1, y: -1 });
  });

  it('normalizes the same angle differently per side when the reach is asymmetric', () => {
    const right = leanFromAngles(12, 0, REACH).x;
    const left = leanFromAngles(-12, 0, REACH).x;
    // Left reach (25) is shorter than right (40), so 12 degrees is a bigger share of it.
    expect(-left).toBeGreaterThan(right + 0.2);
    const forward = leanFromAngles(0, 12, REACH).y;
    const back = leanFromAngles(0, -12, REACH).y;
    expect(-back).toBeGreaterThan(forward + 0.2);
  });

  it('zeroes leans inside the dead zone and responds just outside it', () => {
    const small = CONFIG.deadZoneDeg * 0.9;
    expect(leanFromAngles(small, small, REACH)).toMatchObject({ x: 0, y: 0 });
    expect(leanFromAngles(-small, -small, REACH)).toMatchObject({ x: 0, y: 0 });
    const past = CONFIG.deadZoneDeg + 1;
    expect(leanFromAngles(past, past, REACH).x).toBeGreaterThan(0);
    expect(leanFromAngles(past, past, REACH).y).toBeGreaterThan(0);
  });

  it('is not grounded at full deflection, so top speed never needs the edge down', () => {
    expect(leanFromAngles(0, full(REACH.forward), REACH).grounded).toBe(false);
    expect(leanFromAngles(full(REACH.right), 0, REACH).grounded).toBe(false);
  });

  it('flags grounded at reach x groundedFraction in each direction, and not just below it', () => {
    const cases: [string, (deg: number) => [number, number], number][] = [
      ['forward', (d) => [0, d], REACH.forward],
      ['back', (d) => [0, -d], REACH.back],
      ['left', (d) => [-d, 0], REACH.left],
      ['right', (d) => [d, 0], REACH.right],
    ];
    for (const [dir, at, reach] of cases) {
      expect(leanFromAngles(...at(groundAt(reach)), REACH).grounded, `${dir} at the grounded angle`).toBe(true);
      expect(leanFromAngles(...at(groundAt(reach) - 0.1), REACH).grounded, `${dir} just below`).toBe(false);
    }
  });
});

describe('parseStoredReach', () => {
  it('round-trips a valid stored reach', () => {
    expect(parseStoredReach(JSON.stringify(REACH))).toEqual(REACH);
  });

  it('accepts the limits of the plausible range', () => {
    const edges = { forward: 3, back: 80, left: 3, right: 80 };
    expect(parseStoredReach(JSON.stringify(edges))).toEqual(edges);
  });

  it.each([
    ['nothing stored', null],
    ['not JSON', '{forward: 30'],
    ['a number', '42'],
    ['JSON null', 'null'],
    ['an array', '[30, 20, 25, 40]'],
    ['a missing key', JSON.stringify({ forward: 30, back: 20, left: 25 })],
    ['a string number', JSON.stringify({ ...REACH, left: '25' })],
    ['NaN (serialized as null)', JSON.stringify({ ...REACH, back: NaN })],
    ['too small', JSON.stringify({ ...REACH, forward: 2.9 })],
    ['too large', JSON.stringify({ ...REACH, right: 80.1 })],
    ['negative', JSON.stringify({ ...REACH, left: -25 })],
  ])('falls back to the default for %s', (_label, raw) => {
    expect(parseStoredReach(raw)).toEqual(DEFAULT_REACH);
  });
});

describe('loadReach / saveReach', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remembers a saved reach across loads', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    saveReach(REACH);
    expect(store.has(REACH_STORAGE_KEY)).toBe(true);
    expect(loadReach()).toEqual(REACH);
  });

  it('works without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => saveReach(REACH)).not.toThrow();
    expect(loadReach()).toEqual(DEFAULT_REACH);
  });
});

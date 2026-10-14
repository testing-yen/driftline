import { describe, expect, it } from 'vitest';
import { circlesCollide, gateCrossed, gatePassed } from '../src/game/collisions.js';

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

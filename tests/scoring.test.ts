import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { applyStumblePenalty, passedBest, scoreForDistance, scoreForGate } from '../src/game/scoring.js';

describe('scoreForDistance', () => {
  it('scales linearly with distance', () => {
    expect(scoreForDistance(1000)).toBe(1000 * CONFIG.scorePerPx);
    expect(scoreForDistance(0)).toBe(0);
  });
});

describe('scoreForGate', () => {
  it('awards the base gate score on the first gate', () => {
    expect(scoreForGate(1)).toBe(CONFIG.gateScore);
  });

  it('adds a streak bonus for consecutive gates', () => {
    expect(scoreForGate(3)).toBe(CONFIG.gateScore + CONFIG.gateStreakBonus * 2);
  });

  it('floors fractional streaks to at least 1', () => {
    expect(scoreForGate(0)).toBe(CONFIG.gateScore);
  });
});

describe('applyStumblePenalty', () => {
  it('subtracts the penalty', () => {
    expect(applyStumblePenalty(500)).toBe(500 - CONFIG.stumblePenalty);
  });

  it('never drops below zero', () => {
    expect(applyStumblePenalty(10)).toBe(0);
    expect(applyStumblePenalty(0)).toBe(0);
  });
});

describe('passedBest', () => {
  it('never fires without a previous best', () => {
    expect(passedBest(0, 100, null)).toBe(false);
    expect(passedBest(-1, 1e9, null)).toBe(false);
  });

  it('fires only on the frame the score crosses above the best', () => {
    const best = 500;
    const frames = [480, 495, 500, 503, 510, 520];
    const fired = frames.slice(1).filter((s, i) => passedBest(frames[i], s, best));
    expect(fired).toEqual([503]);
  });

  it('does not fire when the score only reaches the best', () => {
    expect(passedBest(490, 500, 500)).toBe(false);
    expect(passedBest(500, 500, 500)).toBe(false);
  });

  it('does not fire again while the score stays above the best', () => {
    expect(passedBest(503, 510, 500)).toBe(false);
  });
});

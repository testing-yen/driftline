import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { applyStumblePenalty, scoreForDistance, scoreForGate } from '../src/game/scoring.js';

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

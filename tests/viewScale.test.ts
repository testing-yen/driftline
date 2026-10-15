import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { viewScale } from '../src/game/renderer.js';

/** Half the screen width, in world px, that the slope can use after zooming. */
function visibleHalfWidth(screenWidth: number, safeInset: number): number {
  return (screenWidth / 2 - safeInset) / viewScale(screenWidth, safeInset);
}

describe('viewScale', () => {
  it('keeps desktop screens at 1:1', () => {
    expect(viewScale(1440, 0)).toBe(1);
  });

  it('keeps the slope edges and rider on screen in iPhone landscape, clear of the notch', () => {
    // iPhone 15 landscape: 852 px wide, ~59 px notch inset.
    const half = visibleHalfWidth(852, 59);
    expect(half).toBeGreaterThanOrEqual(CONFIG.worldHalfWidth + CONFIG.viewMargin - 1e-9);
  });

  it('fits the slope in iPhone portrait too', () => {
    const half = visibleHalfWidth(390, 0);
    expect(half).toBeGreaterThanOrEqual(CONFIG.worldHalfWidth + CONFIG.viewMargin - 1e-9);
  });
});

import { CONFIG } from '../config.js';

/** Pure scoring helpers. Score never goes below zero. */

export function scoreForDistance(pxTravelled: number): number {
  return pxTravelled * CONFIG.scorePerPx;
}

/** Gate bonus grows slightly with a consecutive-gate streak. */
export function scoreForGate(streak: number): number {
  const s = Math.max(1, Math.floor(streak));
  return CONFIG.gateScore + CONFIG.gateStreakBonus * (s - 1);
}

/** Apply a stumble penalty, floored at zero. */
export function applyStumblePenalty(score: number): number {
  return Math.max(0, score - CONFIG.stumblePenalty);
}

/** True only on the frame the score first goes strictly above a non-null best. */
export function passedBest(prevScore: number, score: number, best: number | null): boolean {
  return best !== null && prevScore <= best && score > best;
}

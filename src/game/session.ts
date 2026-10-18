import type { PlayMode } from '../input/playMode.js';

/**
 * In-memory scoreboard for one page session. A page refresh clears it on
 * purpose: it measures today's workout, not an all-time record.
 */

export interface RunResult {
  score: number;
  distanceM: number;
  gatesCleared: number;
  durationS: number;
}

export interface RecordOutcome {
  /** 1-based rank among all session runs (score desc; ties: earlier run ranks higher). */
  rank: number;
  /** Best score before this run; null on the first run. */
  previousBest: number | null;
  isNewBest: boolean;
}

export class SessionBoard {
  /** Sorted by score desc; equal scores keep insertion order. */
  private ranked: RunResult[] = [];
  private totalS = 0;

  record(run: RunResult): RecordOutcome {
    const previousBest = this.bestScore;
    // Insert after every run with an equal or higher score, so ties favour the earlier run.
    let index = 0;
    while (index < this.ranked.length && this.ranked[index].score >= run.score) index += 1;
    this.ranked.splice(index, 0, run);
    this.totalS += run.durationS;
    return {
      rank: index + 1,
      previousBest,
      isNewBest: previousBest !== null && run.score > previousBest,
    };
  }

  get bestScore(): number | null {
    return this.ranked.length > 0 ? this.ranked[0].score : null;
  }

  top(n: number): readonly RunResult[] {
    return this.ranked.slice(0, n);
  }

  get runCount(): number {
    return this.ranked.length;
  }

  get totalDurationS(): number {
    return this.totalS;
  }
}

/** One scoreboard per play mode: a handheld run never competes with a board run, and vice versa. */
export function boardsPerMode(): Record<PlayMode, SessionBoard> {
  return { board: new SessionBoard(), handheld: new SessionBoard() };
}

/** Format seconds as m:ss, truncating partial seconds. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

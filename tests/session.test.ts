import { describe, expect, it } from 'vitest';
import { SessionBoard, boardsPerMode, formatDuration, type RunResult } from '../src/game/session.js';

function run(score: number, durationS = 60): RunResult {
  return { score, distanceM: score / 2, gatesCleared: Math.floor(score / 100), durationS };
}

describe('SessionBoard.record', () => {
  it('ranks the first run 1st with no previous best and no celebration', () => {
    const board = new SessionBoard();
    expect(board.bestScore).toBeNull();
    expect(board.record(run(500))).toEqual({ rank: 1, previousBest: null, isNewBest: false });
    expect(board.bestScore).toBe(500);
  });

  it('flags a higher run as a new best against the previous best', () => {
    const board = new SessionBoard();
    board.record(run(500));
    board.record(run(300));
    expect(board.record(run(800))).toEqual({ rank: 1, previousBest: 500, isNewBest: true });
    expect(board.bestScore).toBe(800);
  });

  it('ranks a lower run below the better ones without celebrating', () => {
    const board = new SessionBoard();
    board.record(run(500));
    board.record(run(900));
    expect(board.record(run(700))).toEqual({ rank: 2, previousBest: 900, isNewBest: false });
    expect(board.record(run(100))).toEqual({ rank: 4, previousBest: 900, isNewBest: false });
  });

  it('does not treat a tie with the best as a new best, and ranks it below the earlier run', () => {
    const board = new SessionBoard();
    const first = run(500, 10);
    const tie = run(500, 20);
    board.record(first);
    expect(board.record(tie)).toEqual({ rank: 2, previousBest: 500, isNewBest: false });
    expect(board.top(2)).toEqual([first, tie]);
    expect(board.top(2)[0]).toBe(first);
  });
});

describe('SessionBoard.top', () => {
  it('returns at most n runs sorted by score descending', () => {
    const board = new SessionBoard();
    for (const s of [300, 900, 100, 700, 500, 800, 200]) board.record(run(s));
    expect(board.top(5).map((r) => r.score)).toEqual([900, 800, 700, 500, 300]);
    expect(board.top(10)).toHaveLength(7);
    expect(board.top(0)).toEqual([]);
  });

  it('places each run at the index its reported rank names', () => {
    const board = new SessionBoard();
    for (const s of [400, 400, 900, 100, 400, 650]) {
      const r = run(s);
      const { rank } = board.record(r);
      expect(board.top(board.runCount)[rank - 1]).toBe(r);
    }
  });
});

describe('SessionBoard totals', () => {
  it('counts runs and sums plank time across all of them', () => {
    const board = new SessionBoard();
    expect(board.runCount).toBe(0);
    expect(board.totalDurationS).toBe(0);
    board.record(run(500, 61.5));
    board.record(run(200, 30.25));
    board.record(run(900, 90));
    expect(board.runCount).toBe(3);
    expect(board.totalDurationS).toBeCloseTo(181.75);
  });
});

describe('boardsPerMode', () => {
  it('keeps each mode’s best, ranks and totals apart', () => {
    const boards = boardsPerMode();
    boards.board.record(run(400, 30));
    expect(boards.handheld.bestScore).toBeNull();
    expect(boards.handheld.record(run(900, 45))).toEqual({ rank: 1, previousBest: null, isNewBest: false });
    expect(boards.board.bestScore).toBe(400);
    expect(boards.board.record(run(500))).toEqual({ rank: 1, previousBest: 400, isNewBest: true });
    expect(boards.handheld.bestScore).toBe(900);
    expect([boards.board.runCount, boards.handheld.runCount]).toEqual([2, 1]);
    expect(boards.handheld.totalDurationS).toBe(45);
  });
});

describe('formatDuration', () => {
  it('formats as m:ss with zero-padded, truncated seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9.99)).toBe('0:09');
    expect(formatDuration(65.9)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
  });
});

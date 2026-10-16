import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { DEFAULT_REACH, REACH_LIMITS_DEG, type BoardReach, type LeanDirection } from '../src/input/boardReach.js';
import { advance, startCalibration, type CalibStep } from '../src/input/reachCalibration.js';

const FRAME_MS = 16;
const LEVEL = { x: 0, y: 0 };

/** Lean in degrees that pushes `deg` toward `dir`. */
function toward(dir: LeanDirection, deg: number): { x: number; y: number } {
  switch (dir) {
    case 'forward':
      return { x: 0, y: deg };
    case 'back':
      return { x: 0, y: -deg };
    case 'left':
      return { x: -deg, y: 0 };
    case 'right':
      return { x: deg, y: 0 };
  }
}

/** Replays samples every frame for `ms`; `lean` may vary with the time since the start. */
function feed(
  run: { step: CalibStep; t: number },
  ms: number,
  lean: { x: number; y: number } | ((elapsed: number) => { x: number; y: number }),
): { step: CalibStep; t: number } {
  let { step, t } = run;
  const start = t;
  for (; t < start + ms; t += FRAME_MS) {
    const now = typeof lean === 'function' ? lean(t - start) : lean;
    step = advance(step, { lean: now, calibrated: true }, t);
  }
  return { step, t };
}

/** A calibration already through the neutral step, at the forward push. */
function atForwardPush(): { step: CalibStep; t: number } {
  const step = advance(startCalibration(DEFAULT_REACH), { lean: LEVEL, calibrated: true }, 0);
  return { step, t: FRAME_MS };
}

describe('reach calibration', () => {
  it('waits for the input to finish its neutral before the first push', () => {
    const start = startCalibration(DEFAULT_REACH);
    expect(advance(start, { lean: LEVEL, calibrated: false }, 0)).toMatchObject({ kind: 'neutral' });
    expect(advance(start, { lean: LEVEL, calibrated: true }, 0)).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('captures only after a steady hold of reachHoldMs', () => {
    let run = feed(atForwardPush(), CONFIG.reachHoldMs - 100, toward('forward', 20));
    expect(run.step).toMatchObject({ kind: 'push', dir: 'forward' });
    run = feed(run, 200, toward('forward', 20));
    expect(run.step.kind).toBe('return');
    expect(run.step.reach.forward).toBeCloseTo(20);
  });

  it('captures the mean over the hold window, not the first or last sample', () => {
    const half = CONFIG.reachHoldMs / 2;
    const offset = CONFIG.reachHoldToleranceDeg * 0.4;
    const { step } = feed(atForwardPush(), CONFIG.reachHoldMs + 100, (ms) =>
      toward('forward', ms < half ? 30 + offset : 30 - offset),
    );
    expect(step.kind).toBe('return');
    expect(step.reach.forward).toBeGreaterThan(30 - offset / 2);
    expect(step.reach.forward).toBeLessThan(30 + offset / 2);
  });

  it('never captures a lean below reachCaptureMinDeg, however long it is held', () => {
    const { step } = feed(atForwardPush(), 3000, toward('forward', CONFIG.reachCaptureMinDeg - 0.5));
    expect(step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('never captures an implausible lean above the reach limit', () => {
    const { step } = feed(atForwardPush(), 3000, toward('forward', REACH_LIMITS_DEG.max + 5));
    expect(step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('restarts the hold when one sample goes above the reach limit', () => {
    let run = feed(atForwardPush(), CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    run = feed(run, FRAME_MS, toward('forward', REACH_LIMITS_DEG.max + 5));
    run = feed(run, CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    expect(run.step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('restarts the hold on a NaN sample instead of capturing NaN', () => {
    let run = feed(atForwardPush(), CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    run = feed(run, FRAME_MS, { x: 0, y: NaN });
    run = feed(run, CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    expect(run.step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('restarts the hold when the sample stream stalls', () => {
    let run = feed(atForwardPush(), CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    run = { ...run, t: run.t + 500 };
    run = feed(run, CONFIG.reachHoldMs * 0.6, toward('forward', 20));
    expect(run.step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('ignores a jittery hold that keeps leaving the tolerance band', () => {
    const swing = CONFIG.reachHoldToleranceDeg * 2.5;
    const jitter = (ms: number) => toward('forward', Math.floor(ms / 300) % 2 === 0 ? 20 : 20 + swing);
    const { step } = feed(atForwardPush(), 3000, jitter);
    expect(step).toMatchObject({ kind: 'push', dir: 'forward' });
  });

  it('requires the board back to level before arming the next direction', () => {
    let run = feed(atForwardPush(), CONFIG.reachHoldMs + 100, toward('forward', 30));
    expect(run.step).toMatchObject({ kind: 'return', captured: 'forward', next: 'back' });
    run = feed(run, 2000, toward('back', 30));
    expect(run.step).toMatchObject({ kind: 'return', next: 'back' });
    run = feed(run, 500, { x: CONFIG.reachLevelDeg + 0.5, y: 0 });
    expect(run.step).toMatchObject({ kind: 'return', next: 'back' });
    run = feed(run, 100, LEVEL);
    expect(run.step).toMatchObject({ kind: 'push', dir: 'back' });
  });

  it('collects all four directions in order and ends with them as the reach', () => {
    const measured: BoardReach = { forward: 31, back: 26, left: 22, right: 36 };
    let run = atForwardPush();
    const order: string[] = [];
    const confirmed: string[] = [];
    for (const dir of ['forward', 'back', 'left', 'right'] as const) {
      if (run.step.kind === 'push') order.push(run.step.dir);
      run = feed(run, CONFIG.reachHoldMs + 100, toward(dir, measured[dir]));
      if (run.step.kind === 'return') confirmed.push(run.step.captured);
      run = feed(run, 100, LEVEL);
    }
    expect(order).toEqual(['forward', 'back', 'left', 'right']);
    expect(confirmed).toEqual(['forward', 'back', 'left']);
    expect(run.step.kind).toBe('done');
    const { reach } = run.step;
    expect(reach.forward).toBeCloseTo(measured.forward);
    expect(reach.back).toBeCloseTo(measured.back);
    expect(reach.left).toBeCloseTo(measured.left);
    expect(reach.right).toBeCloseTo(measured.right);
  });
});

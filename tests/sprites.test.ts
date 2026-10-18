import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { viewScale } from '../src/game/renderer.js';
import {
  BEAST,
  BEAST_LUNGE_DISTANCE,
  beastFrame,
  devicePxPerSpritePx,
  LeanTracker,
  PLAYER,
  RAMP,
  flipFrame,
  TRANSPARENT,
  type SpriteSheet,
} from '../src/game/sprites.js';

const SHEETS: [string, SpriteSheet<string>, number, number][] = [
  ['player', PLAYER, 24, 32],
  ['beast', BEAST, 32, 32],
  ['ramp', RAMP, 32, 19],
];

describe.each(SHEETS)('%s sprite sheet', (_, sheet, width, height) => {
  it(`is ${width}x${height}`, () => {
    expect([sheet.width, sheet.height]).toEqual([width, height]);
  });

  it('has 4-6 colours besides transparent', () => {
    const keys = Object.keys(sheet.palette);
    expect(keys).not.toContain(TRANSPARENT);
    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(keys.length).toBeLessThanOrEqual(6);
    for (const key of keys) expect(key).toHaveLength(1);
  });

  it.each(Object.entries(sheet.frames))('frame %s is a full, non-empty grid of palette pixels', (_, rows) => {
    expect(rows).toHaveLength(height);
    for (const row of rows) expect(row).toHaveLength(width);
    const used = new Set(rows.join(''));
    for (const ch of used) expect([TRANSPARENT, ...Object.keys(sheet.palette)]).toContain(ch);
    used.delete(TRANSPARENT);
    expect(used.size).toBeGreaterThan(0);
  });

  it('anchors inside the frame', () => {
    expect(sheet.anchor.x).toBeGreaterThan(0);
    expect(sheet.anchor.x).toBeLessThan(width);
    expect(sheet.anchor.y).toBeGreaterThan(0);
    expect(sheet.anchor.y).toBeLessThan(height);
  });
});

describe('beast frames', () => {
  it('glide A, glide B and lunge are three different pictures', () => {
    const { glideA, glideB, lunge } = BEAST.frames;
    expect(new Set([glideA, glideB, lunge].map((rows) => rows.join('\n'))).size).toBe(3);
  });
});

describe('player frames', () => {
  const key = (rows: readonly string[]) => rows.join('\n');

  it('lean frames differ from straight and from each other', () => {
    const { straight, left, right } = PLAYER.frames;
    expect(key(left)).not.toBe(key(straight));
    expect(key(right)).not.toBe(key(straight));
    expect(key(left)).not.toBe(key(right));
  });

  it('leans the right way: the left frame carries more pixels left of centre', () => {
    const leftHeavy = (rows: readonly string[]) => {
      let balance = 0;
      for (const row of rows)
        [...row].forEach((ch, x) => {
          if (ch !== TRANSPARENT) balance += x < PLAYER.width / 2 ? 1 : -1;
        });
      return balance;
    };
    expect(leftHeavy(PLAYER.frames.left)).toBeGreaterThan(leftHeavy(PLAYER.frames.straight));
    expect(leftHeavy(PLAYER.frames.right)).toBeLessThan(leftHeavy(PLAYER.frames.straight));
  });

  const FLIP = ['flipPitch', 'flipTuck', 'flipInverted', 'flipTuckUp', 'flipOpen'] as const;

  it('has five flip frames, each a different picture from every other frame', () => {
    const all = Object.values(PLAYER.frames).map(key);
    expect(new Set(all).size).toBe(all.length);
    for (const frame of FLIP) expect(PLAYER.frames).toHaveProperty(frame);
  });

  /** Mean row of the pixels drawn in `colour`. */
  const meanRow = (rows: readonly string[], colour: string) => {
    const ys = rows.flatMap((row, y) => [...row].filter((ch) => ch === colour).map(() => y));
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  };

  it('goes head down through the first tuck and inverted, head up again for the second tuck and landing', () => {
    // Jacket ('O') above the trousers ('B') is head up; below them is head down.
    const headDown = (frame: keyof typeof PLAYER.frames) =>
      meanRow(PLAYER.frames[frame], 'O') > meanRow(PLAYER.frames[frame], 'B');
    expect(headDown('straight')).toBe(false);
    expect(FLIP.map(headDown)).toEqual([false, true, true, false, false]);
  });

  it('draws both tucks compressed, shorter than the upright rider', () => {
    const height = (rows: readonly string[]) => {
      const drawn = rows.flatMap((row, y) => (row.replaceAll(TRANSPARENT, '') ? [y] : []));
      return drawn[drawn.length - 1] - drawn[0] + 1;
    };
    const upright = height(PLAYER.frames.straight);
    expect(height(PLAYER.frames.flipTuck)).toBeLessThan(upright * 0.75);
    expect(height(PLAYER.frames.flipTuckUp)).toBeLessThan(upright * 0.75);
  });

  describe('flipFrame', () => {
    it('walks pitch, tuck, inverted, tuck, open in order as the flip progresses', () => {
      const seen = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99].map(flipFrame);
      expect(seen.filter((frame, i) => frame !== seen[i - 1])).toEqual([...FLIP]);
    });

    it('is upside down halfway through', () => {
      expect(flipFrame(0.5)).toBe('flipInverted');
    });

    it('rides straight once the flip is done', () => {
      expect(flipFrame(1)).toBe('straight');
      expect(flipFrame(1.5)).toBe('straight');
    });
  });
});

describe('LeanTracker', () => {
  const STEP = 1 / 60;

  function ride(tracker: LeanTracker, vx: number, seconds: number, from = { x: 0, time: 0 }) {
    let { x, time } = from;
    let lean = tracker.update(x, time);
    for (let t = 0; t < seconds; t += STEP) {
      x += vx * STEP;
      time += STEP;
      lean = tracker.update(x, time);
    }
    return { lean, x, time };
  }

  it('shows straight when running straight', () => {
    expect(ride(new LeanTracker(), 0, 1).lean).toBe('straight');
  });

  it('ignores a slow drift', () => {
    expect(ride(new LeanTracker(), 30, 1).lean).toBe('straight');
  });

  it('leans into full steering in either direction', () => {
    expect(ride(new LeanTracker(), -CONFIG.steerSpeed, 0.3).lean).toBe('left');
    expect(ride(new LeanTracker(), CONFIG.steerSpeed, 0.3).lean).toBe('right');
  });

  it('straightens up after steering stops', () => {
    const tracker = new LeanTracker();
    const steered = ride(tracker, -CONFIG.steerSpeed, 0.3);
    expect(ride(tracker, 0, 0.5, steered).lean).toBe('straight');
  });

  it('holds its frame while game time stands still, even if x jumps', () => {
    const tracker = new LeanTracker();
    const steered = ride(tracker, CONFIG.steerSpeed, 0.3);
    expect(tracker.update(steered.x - 500, steered.time)).toBe('right');
  });

  it('starts a new run straight when game time goes back to zero', () => {
    const tracker = new LeanTracker();
    ride(tracker, CONFIG.steerSpeed, 0.3);
    expect(tracker.update(0, 0)).toBe('straight');
  });
});

describe('beastFrame', () => {
  const FAR = BEAST_LUNGE_DISTANCE * 3;

  it('alternates glide frames over time while far away', () => {
    const frames = new Set([0, 0.25, 0.5, 0.75, 1].map((t) => beastFrame(t, FAR, 0, false)));
    expect(frames).toEqual(new Set(['glideA', 'glideB']));
  });

  it('lunges once close to the rider, before the catch', () => {
    expect(BEAST_LUNGE_DISTANCE).toBeGreaterThan(CONFIG.chaserCatchRadius + CONFIG.playerRadius);
    expect(beastFrame(0, BEAST_LUNGE_DISTANCE - 1, 0, false)).toBe('lunge');
    expect(beastFrame(0, 0, BEAST_LUNGE_DISTANCE - 1, false)).toBe('lunge');
    expect(beastFrame(0, 0, -(BEAST_LUNGE_DISTANCE - 1), false)).toBe('lunge');
  });

  it('lunges on the catch whatever the distance', () => {
    expect(beastFrame(0, FAR, 0, true)).toBe('lunge');
  });
});

describe('devicePxPerSpritePx', () => {
  it('draws the same on-screen size on a 390px phone at 1x and 2x, in whole device pixels', () => {
    const zoom = viewScale(390, 0);
    const oneX = devicePxPerSpritePx(zoom);
    const twoX = devicePxPerSpritePx(2 * zoom);
    expect(Number.isInteger(oneX) && Number.isInteger(twoX)).toBe(true);
    expect(twoX / 2).toBe(oneX);
  });

  it('never drops below one device pixel per sprite pixel', () => {
    expect(devicePxPerSpritePx(0.01)).toBe(1);
  });
});

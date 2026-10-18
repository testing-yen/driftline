import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { viewScale } from '../src/game/renderer.js';
import {
  BEAST_LUNGE_DISTANCE,
  BEAST_STYLES,
  BEASTS,
  beastFrame,
  devicePxPerSpritePx,
  isBeastStyle,
  LeanTracker,
  PLAYER,
  TRANSPARENT,
  type SpriteSheet,
} from '../src/game/sprites.js';

const SHEETS: [string, SpriteSheet<string>, number, number][] = [
  ['player', PLAYER, 24, 32],
  ...BEAST_STYLES.map((style): [string, SpriteSheet<string>, number, number] => [`${style} beast`, BEASTS[style], 32, 32]),
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

describe.each(BEAST_STYLES)('%s beast frames', (style) => {
  it('glide A, glide B and lunge are three different pictures', () => {
    const { glideA, glideB, lunge } = BEASTS[style].frames;
    expect(new Set([glideA, glideB, lunge].map((rows) => rows.join('\n'))).size).toBe(3);
  });
});

describe('isBeastStyle', () => {
  it('accepts every style and nothing else', () => {
    for (const style of BEAST_STYLES) expect(isBeastStyle(style)).toBe(true);
    for (const other of [null, '', 'yeti', 'Wolf', 'BEAST']) expect(isBeastStyle(other)).toBe(false);
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
    const frames = new Set([0, 0.25, 0.5, 0.75, 1].map((t) => beastFrame(t, FAR, false)));
    expect(frames).toEqual(new Set(['glideA', 'glideB']));
  });

  it('lunges once close to the rider, before the catch', () => {
    expect(BEAST_LUNGE_DISTANCE).toBeGreaterThan(CONFIG.chaserCatchRadius + CONFIG.playerRadius);
    expect(beastFrame(0, BEAST_LUNGE_DISTANCE - 1, false)).toBe('lunge');
  });

  it('lunges on the catch whatever the distance', () => {
    expect(beastFrame(0, FAR, true)).toBe('lunge');
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

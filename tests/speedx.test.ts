import { describe, expect, it } from 'vitest';
import { CONFIG, DEFAULT_DOWNHILL_SCALE } from '../src/config.js';
import { parseSpeedx } from '../src/dev/speedx.js';

describe('parseSpeedx', () => {
  it.each([
    ['?speedx=1', 1],
    ['?speedx=2', 2],
    ['?speedx=2.5', 2.5],
    ['?sprites&speedx=3', 3],
  ])('reads %s as K = %s', (search, k) => {
    expect(parseSpeedx(search)).toBe(k);
  });

  it.each(['', '?speedx', '?speedx=', '?speedx=0', '?speedx=10', '?speedx=fast', '?speedx=-2.5'])(
    'ignores %j',
    (search) => {
      expect(parseSpeedx(search)).toBeNull();
    },
  );
});

describe('CONFIG', () => {
  it('uses the default downhill scale when there is no page URL, so tests stay deterministic', () => {
    expect(CONFIG.downhillScale).toBe(DEFAULT_DOWNHILL_SCALE);
  });
});

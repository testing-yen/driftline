/**
 * Pixel-art sprites for the rider, the beast and the jump ramp, plus the
 * rules that pick a frame. ORIGINAL ART drawn for Driftline: nothing here
 * derives from SkiFree, the beast is not a yeti, and the ramp is our own kicker.
 *
 * A frame is a list of rows with one character per pixel, looked up in the
 * sheet's palette; '.' is transparent. Downhill is down the screen, so the
 * rider shows their back with ski tips pointing down. The beast chases from
 * uphill, facing the rider.
 */

import type { SpinDir } from './types.js';

export const TRANSPARENT = '.';

export interface SpriteSheet<F extends string> {
  readonly width: number;
  readonly height: number;
  /** Point, in sprite pixels from the top-left, drawn on the entity's collision centre. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly palette: Readonly<Record<string, string>>;
  readonly frames: Readonly<Record<F, readonly string[]>>;
}

/** 'front' only shows halfway through a spin, facing back uphill. */
export type PlayerFrame = 'straight' | 'left' | 'right' | 'front' | 'crashed';
export type BeastFrame = 'glideA' | 'glideB' | 'lunge';
export type RampFrame = 'kicker';
export type Lean = Extract<PlayerFrame, 'straight' | 'left' | 'right'>;

export const PLAYER: SpriteSheet<PlayerFrame> = {
  width: 24,
  height: 32,
  anchor: { x: 12, y: 11 },
  palette: {
    o: '#141a2a', // outline
    O: '#ff922b', // jacket, the gauge's orange
    d: '#c4561c', // jacket shade
    b: '#4da0ff', // helmet, skis, back stripe: the gauge's blue
    B: '#23509e', // trousers, gloves, helmet shade
    w: '#ffffff', // shine, snow spray
  },
  frames: {
    straight: [
      '........................',
      '..........oooo..........',
      '........oobbbboo........',
      '.......obwwbbbbBo.......',
      '.......obwbbbbbBo.......',
      '.......oBBBBBBBBo.......',
      '.....oooBbbbbbbBooo.....',
      '....oOOOoBBBBBBoOOdo....',
      '...oOOOOOOooooOOOOOdo...',
      '...oOOOOOOOOOOOOOOOdo...',
      '..oOOoOOOOOOOOOOOdoOdo..',
      '..oOOobbbbbbbbbbbBoOdo..',
      '..oOOoOOOOOOOOOOOdoOdo..',
      '..ooooOOOOOOOOOOOdoooo..',
      '......oddOOOOOOddo......',
      '......ooBBBBBBBBoo......',
      '......ooBBBooBBBoo......',
      '......oBBBo..oBBBo......',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......owo......owo......',
      '......owo......owo......',
      '......obo......obo......',
      '.......o........o.......',
    ],
    left: [
      '........................',
      '........oooo............',
      '......oobbbboo..........',
      '.....obwwbbbbBo.........',
      '.....obwbbbbbBo.........',
      '.....oBBBBBBBBo.........',
      '...oooBbbbbbbBooo.......',
      '...oOOOoBBBBBBoOOdo.....',
      '..oOOOOOOooooOOOOOdo....',
      '..oOOOOOOOOOOOOOOOdo....',
      '.oOOoOOOOOOOOOOOdoOdo...',
      '.oOOobbbbbbbbbbbBoOdo...',
      '.oOOoOOOOOOOOOOOdoOdo...',
      '.ooooOOOOOOOOOOOdoooo...',
      '......oddOOOOOOddobo....',
      '.......oBBBBBBBBobo.....',
      '.......oBBBooBBBobo.....',
      '......oBBBo..oBBBoo.....',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '.....obo......obo.......',
      '.....obo......obo.......',
      '.....obo......obo.......',
      '....obo......obo........',
      '....obo......obo........',
      '....obo......obo........',
      '...obo......obo.........',
      '...owo......owo.........',
      '...owo......owo.........',
      '...oo.......oo..........',
      '........................',
    ],
    right: [
      '........................',
      '............oooo........',
      '..........oobbbboo......',
      '.........obwwbbbbBo.....',
      '.........obwbbbbbBo.....',
      '.........oBBBBBBBBo.....',
      '.......oooBbbbbbbBooo...',
      '.....oOOOoBBBBBBoOOdo...',
      '....oOOOOOOooooOOOOOdo..',
      '....oOOOOOOOOOOOOOOOdo..',
      '...oOOoOOOOOOOOOOOdoOdo.',
      '...oOOobbbbbbbbbbbBoOdo.',
      '...oOOoOOOOOOOOOOOdoOdo.',
      '...ooooOOOOOOOOOOOdoooo.',
      '....oboddOOOOOOddo......',
      '.....oboBBBBBBBBo.......',
      '.....oboBBBooBBBo.......',
      '.....ooBBBo..oBBBo......',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '.......obo......obo.....',
      '.......obo......obo.....',
      '.......obo......obo.....',
      '........obo......obo....',
      '........obo......obo....',
      '........obo......obo....',
      '.........obo......obo...',
      '.........owo......owo...',
      '.........owo......owo...',
      '..........oo.......oo...',
      '........................',
    ],
    front: [
      '........................',
      '..........oooo..........',
      '........oobbbboo........',
      '.......obwwbbbbBo.......',
      '.......oowwwwwwoo.......',
      '.......oBwwwwwwBo.......',
      '.....oooBBBBBBBBooo.....',
      '....oOOOoBBBBBBoOOdo....',
      '...oOOOOOOooooOOOOOdo...',
      '...oOOOOOOOddOOOOOOdo...',
      '..oOOoOOOOOddOOOOdoOdo..',
      '..oOOoOOOOOddOOOOdoOdo..',
      '..oOOoOOOOOddOOOOdoOdo..',
      '..ooooOOOOOddOOOOdoooo..',
      '......oddOOOOOOddo......',
      '......ooBBBBBBBBoo......',
      '......ooBBBooBBBoo......',
      '......oBBBo..oBBBo......',
      '.....oBBBo....oBBBo.....',
      '....oBBBBBo..oBBBBBo....',
      '....ooooooo..ooooooo....',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......obo......obo......',
      '......owo......owo......',
      '......owo......owo......',
      '......obo......obo......',
      '.......o........o.......',
    ],
    crashed: [
      '........................',
      '.........o..............',
      '.......ooboo............',
      '......obbbbbo...........',
      '.....obbwwbbbo..........',
      '.....obbwbbbbo.....oooo.',
      '.ooooobbbbbBBo...ooooBo.',
      '.oBoOoobbbBBoOoooOOoBBBo',
      'oBBBoOOooBooOOOOoOOOoBo.',
      '.oBoOOoOOoOOOOOOOoOOooo.',
      '.ooooOoOOOOOOOOOOooo....',
      '....booOOOOOOOOOOo......',
      '...bwbobbbbbbbbBBo......',
      '.bwwwwoOOOOOOOdddo...b..',
      'bwwwwb.oOOOOddddo...bwb.',
      'bwwwb..oooddddooo..ooowb',
      '.booo.ooBBooooBBoooobob.',
      '..obbooBBBBooBBBBobboo..',
      '...obbooBBo..oBBobbo....',
      '....obbboo...ooobboo....',
      '....ooobbo...obbooBo....',
      '....oBBobbooobbooBBo....',
      '.....ooooobobboooBoo....',
      '.........oobboo..o......',
      '........obboobbo........',
      '.......obboooobbo..bbbb.',
      '.....oobbo....obboobwwb.',
      '....oobbo......oobbowwb.',
      '...obboo.........obboob.',
      '..obboo...........obbo..',
      '..obo..............ooo..',
      '...o....................',
    ],
  },
};

/**
 * The beast's early-1990s Windows-era palette: white body, two greys, black
 * outline, one red accent. Each frame bakes in a soft ground shadow ('s') so a
 * white beast still separates from white snow.
 */
const BEAST_PALETTE: Readonly<Record<string, string>> = {
  o: '#000000', // outline
  w: '#ffffff', // body
  l: '#c0c0c0', // light shade
  g: '#808080', // mid shade
  r: '#ff0000', // eyes and maw
  s: '#b4c3da', // ground shadow
};

/** Avalanche Golem: a squat heap of packed snow lumps and ice shards that tumble as it rolls; lunges with its icicle maw wide. */
export const BEAST: SpriteSheet<BeastFrame> = {
  width: 32,
  height: 32,
  anchor: { x: 16, y: 19 },
  palette: BEAST_PALETTE,
  frames: {
    glideA: [
      '................................',
      '................................',
      '...............o................',
      '..............owo......o........',
      '........o.....owo.....owo.......',
      '.......owo....olwo....owo.......',
      '.......owo....olwo....olwo......',
      '.......olwo.oolwgooo.oolwo......',
      '........olwowwwwwwwwolwgo.......',
      '.......olwgwwwwwwwwwwlwgo.......',
      '.....ooolwggwwwwwwwwggwwgoo.....',
      '...oowwwwwwggggwwggggwwwwwwoo...',
      '..owwwwwwgwworrwwrrowlgwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwwgwwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwwgwwwwwwwlgwwwwwwwlo..',
      '..owwwwwwwoooooooooooowwwwwwlo..',
      '..owwwwwwoolwoooooowloowwwwlgo..',
      '.owwwgggggoowoooooowoogggggwwwo.',
      '.owwwgwwwowwoooooooowwowwwgwwwwo',
      'owwwwwgwwwwwwwwwwwwwwwwwwwgwwwlo',
      '.owwwgwwwwwwwwwwwwwwwwwwwlgwwwlo',
      '.owwggwwwwwwwwwwwwwwwwwwwllgwlo.',
      '..oowwwwwwwwwwwwwwwwwwwwwllglo..',
      '..ooowwgggggwwwwwwwwwwgwllgoo...',
      '.owwwogwwwwwgwwwwwwgggwgggo.....',
      '.owwwwwwwwwwlgwwwwgwwwwwwwwo....',
      '.owwwowwwwwwgwwlllgwwwwwwwlo....',
      '.owlgoowwllgwlllllggwwwwlgo.....',
      '..ooo.sooooooooooooooooooo......',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
    glideB: [
      '................................',
      '................................',
      '................................',
      '...............o................',
      '..............owo......o........',
      '........o.....owo.....owo.......',
      '.......owo....olwo....owo.......',
      '.......owo....olwo....olwo......',
      '.......olwo.oolwgooo.oolwo......',
      '........olwowwwwwwwwolwgo.......',
      '.......olwgwwwwwwwwwwlwgo.......',
      '.....ooolwggwwwwwwwwggwwgoo.....',
      '...oowwwwwwggggwwggggwwwwwwoo...',
      '..owwwwwwgwworrwwrrowlgwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwwgwwwwwwwo..',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwwgwwwwwwwlgwwwwwwwlo..',
      '..owwwwwwwoooooooooooowwwwwwlo..',
      '..owwwwwwoolwoooooowloowwwwlgo..',
      '.owwwgggggoowoooooowoogggggwwwo.',
      '.owwwgwwwowwoooooooowwowwwgwwwwo',
      'owwwwwgwwwwwwwwwwwwwwwwwwwgwwwlo',
      '.owwwgwwwwwwwwwwwwwwwwwwwlgwwwlo',
      '.owwggwwwwwwwwwwwwwwwwwwwllgwlo.',
      '..oowwwwwwwwwwwwwwwwwwwwwllglo..',
      '....owwwwgwwwwwwwwwwwgggglgwwwo.',
      '.....ogggwgggwwwwwwggwwwwgwwwwo.',
      '....owwwwwwwwgwwwwwgwwwwwwlwwwo.',
      '....owwwwwwwwgwllllggwwwwlgwlgo.',
      '.....ooooooooooooooooooooooooo..',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
    lunge: [
      '...............o................',
      '..............owo...............',
      '..............owo...............',
      '..............olwo.....o........',
      '........o.....olwo....owo.......',
      '.......owo..oolwgooo..owo.......',
      '.......owo.owwwwwwwwo.olwo......',
      '.......olwowwwwwwwwwwoolwo......',
      '........olggwwwwwwwwggwgo.......',
      '.......olwgggggwwgggggwgo.......',
      '.....ooolgwworrwwrrowlgwgoo.....',
      '...oowwwwwwwwwwwwwwwwlwwwwwoo...',
      '..owwwwwwwgwwwwwwwwwlgwwwwwwwo..',
      '..owwwwwwwoooooooooooowwwwwwwo..',
      '..owwwwwwowlowloolwolwowwwwwwo..',
      '..owwwwwoowoowoooowoowoowwwwlo..',
      '..owwwwwoooooooooooooooowwwwgo..',
      '.owgggwwooooooorrooooooowwwgwwo.',
      '.owwwgggoooooorrrroooooogggwwwwo',
      'owwwwwgwoooooooooooooooowwgwwwlo',
      '.owwwgwwooowooowwooowooowwgwwwlo',
      '.owwggwwwolwolwllwlowlowwllgwlo.',
      '..oowwwwwwoooooooooooowwwllllo..',
      '...owwwwwwwwwwwwwwwwwwwwwllgo...',
      '....owwgggggwwwwwwwwwwgwllgo....',
      '.....ogwwwwwgwwwwwwgggwgggo.....',
      '....owwwwwwwlgwwwwgwwwwwwwwo....',
      '.....owwwwwwgwwlllgwwwwwwwlo....',
      '......owwllgwlllllggwwwwlgo.....',
      '......sooooooooooooooooooo......',
      '....ssssssssssssssssssssssss....',
      '................................',
    ],
  },
};

/**
 * Snow kicker seen from uphill: a packed-snow run-in, widening toward the
 * lip, with orange chevrons pointing the way off it; then the bright lip,
 * the dark take-off edge and the shaded face that drops to the snow.
 * Anchored on the take-off edge, which is the ramp's y.
 */
export const RAMP: SpriteSheet<RampFrame> = {
  width: 32,
  height: 19,
  anchor: { x: 16, y: 15 },
  palette: {
    o: '#1d2b44', // outline and take-off edge
    w: '#ffffff', // packed-snow lip
    l: '#cfdcf0', // run-in surface
    s: '#93a9cb', // run-in edges, shadow on the snow
    d: '#46689e', // side walls, taller toward the lip, and the face under it
    a: '#ff922b', // chevrons, the gauge's "fast" orange
  },
  frames: {
    kicker: [
      '........ssssssssssssssss........',
      '........ssssssssssssssss........',
      '.....oddsllllllllllllllsddo.....',
      '.....oddsllaaallllaaallsddo.....',
      '.....oddslllaaallaaalllsddo.....',
      '....oddslllllaallaalllllsddo....',
      '...odddsllllllaaaallllllsdddo...',
      '...odddsllllllllllllllllsdddo...',
      '..odddsllllaaallllaaallllsdddo..',
      '..odddslllllaaallaaalllllsdddo..',
      '.oddddsllllllaallaallllllsddddo.',
      'oddddsllllllllaaaallllllllsddddo',
      'oddddsllllllllllllllllllllsddddo',
      'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
      'owwwwwwwwwwwwwwwwwwwwwwwwwwwwwwo',
      'oooooooooooooooooooooooooooooooo',
      '.dddddddddddddddddddddddddddddd.',
      '..ssssssssssssssssssssssssssss..',
      '.....ssssssssssssssssssssss.....',
    ],
  },
};

/** A spin seen from behind: side-on one way, facing uphill, side-on the other way, back again. */
const SPIN_FRAMES: Readonly<Record<SpinDir, readonly PlayerFrame[]>> = {
  right: ['straight', 'right', 'front', 'left'],
  left: ['straight', 'left', 'front', 'right'],
};

/** Rider frame `progress` (0..1) of the way through a spin; a finished spin rides straight. */
export function spinFrame(dir: SpinDir, progress: number): PlayerFrame {
  const frames = SPIN_FRAMES[dir];
  if (progress >= 1) return 'straight';
  return frames[Math.floor(Math.max(0, progress) * frames.length)];
}

/** World px per sprite px the renderer aims for; it rounds so each sprite px is whole device px. */
const SPRITE_WORLD_PX = 2.6;

/**
 * Device px per sprite px for a world-to-device scale. Whole numbers keep
 * pixels crisp. A 390px phone gets 2 at dpr 2 and 1 at dpr 1, the same size
 * on screen either way.
 */
export function devicePxPerSpritePx(worldToDevice: number): number {
  return Math.max(1, Math.round(SPRITE_WORLD_PX * worldToDevice));
}

/**
 * Draws each frame once onto its own canvas, one canvas px per sprite px.
 * Needs a DOM, so only the renderer and the dev sprite sheet call it.
 */
export function bakeFrames<F extends string>(sheet: SpriteSheet<F>): Record<F, HTMLCanvasElement> {
  const baked: Partial<Record<F, HTMLCanvasElement>> = {};
  for (const [name, rows] of Object.entries<readonly string[]>(sheet.frames)) {
    const canvas = document.createElement('canvas');
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === TRANSPARENT) return;
        ctx.fillStyle = sheet.palette[ch];
        ctx.fillRect(x, y, 1, 1);
      });
    });
    baked[name as F] = canvas;
  }
  return baked as Record<F, HTMLCanvasElement>;
}

/** Smoothed lateral speed, world px/s, past which the rider shows a lean... */
const LEAN_ON_SPEED = 90;
/** ...and below which they straighten up again. The gap stops flicker at the threshold. */
const LEAN_OFF_SPEED = 50;
/** Time constant of the lateral-speed smoothing, s. */
const LEAN_SMOOTHING_S = 0.08;

/**
 * Infers the rider's lean from how their x changes between renders. Driven
 * by game time, so a paused run holds its frame and a new run starts straight.
 */
export class LeanTracker {
  private lean: Lean = 'straight';
  private vx = 0;
  private last: { x: number; time: number } | null = null;

  reset(): void {
    this.lean = 'straight';
    this.vx = 0;
    this.last = null;
  }

  update(x: number, time: number): Lean {
    const last = this.last;
    if (last === null || time < last.time) {
      this.reset();
      this.last = { x, time };
      return this.lean;
    }
    const dt = time - last.time;
    if (dt === 0) return this.lean;
    this.vx += ((x - last.x) / dt - this.vx) * Math.min(1, dt / LEAN_SMOOTHING_S);
    this.last = { x, time };
    const speed = Math.abs(this.vx);
    if (speed < LEAN_OFF_SPEED) this.lean = 'straight';
    else if (speed > LEAN_ON_SPEED) this.lean = this.vx < 0 ? 'left' : 'right';
    return this.lean;
  }
}

/** Seconds each glide frame shows. */
const BEAST_GLIDE_FRAME_S = 0.2;
/** World px between beast and rider centres inside which the beast lunges. Catch happens at 44. */
export const BEAST_LUNGE_DISTANCE = 130;

export function beastFrame(time: number, distanceToRider: number, caught: boolean): BeastFrame {
  if (caught || distanceToRider < BEAST_LUNGE_DISTANCE) return 'lunge';
  return Math.floor(time / BEAST_GLIDE_FRAME_S) % 2 === 0 ? 'glideA' : 'glideB';
}

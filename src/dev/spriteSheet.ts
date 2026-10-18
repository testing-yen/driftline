import { viewScale } from '../game/renderer.js';
import { BEASTS, bakeFrames, devicePxPerSpritePx, PLAYER, type SpriteSheet } from '../game/sprites.js';

const GAP = 10;
const LABEL_H = 16;

interface Row {
  name: string;
  sheet: SpriteSheet<string>;
  baked: Record<string, HTMLCanvasElement>;
}

/**
 * Dev-only sprite sheet, opened with `?sprites`: the rider and every beast
 * style, each row showing all frames enlarged and then again at the size the
 * game draws them on this screen, on plain snow.
 */
export function showSpriteSheet(canvas: HTMLCanvasElement): void {
  const rows: Row[] = [
    { name: 'rider', sheet: PLAYER, baked: bakeFrames(PLAYER) },
    ...Object.entries(BEASTS).map(([name, sheet]) => ({ name: `?beast=${name}`, sheet, baked: bakeFrames(sheet) })),
  ];
  const draw = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#eef3fb';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    // In CSS px, matching what the renderer draws for this screen and dpr (ignoring safe-area insets).
    const gameSize = devicePxPerSpritePx(dpr * viewScale(w, 0)) / dpr;
    let zoom = 8;
    while (zoom > 1 && layout(rows, zoom, gameSize, w, null) > h) zoom -= 1;
    layout(rows, zoom, gameSize, w, ctx);
  };
  draw();
  window.addEventListener('resize', draw);
}

/**
 * Lays each row out left to right (frames at `zoom`, then at `gameSize`),
 * wrapping at the screen edge. Draws when given a context; returns the height used.
 */
function layout(rows: Row[], zoom: number, gameSize: number, screenW: number, ctx: CanvasRenderingContext2D | null): number {
  let y = GAP;
  for (const { name, sheet, baked } of rows) {
    if (ctx) {
      ctx.fillStyle = '#22303f';
      ctx.fillText(name, GAP, y);
    }
    y += LABEL_H;
    let x = GAP;
    let lineH = 0;
    const frames = Object.keys(sheet.frames);
    for (const scale of [zoom, gameSize]) {
      const fw = sheet.width * scale;
      const fh = sheet.height * scale;
      for (const frame of frames) {
        if (x + fw > screenW - GAP && x > GAP) {
          y += lineH + GAP;
          x = GAP;
          lineH = 0;
        }
        ctx?.drawImage(baked[frame], x, y, fw, fh);
        x += fw + GAP;
        lineH = Math.max(lineH, fh);
      }
    }
    y += lineH + GAP;
  }
  return y;
}

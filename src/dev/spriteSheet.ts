import { viewScale } from '../game/renderer.js';
import { BEAST, bakeFrames, devicePxPerSpritePx, PLAYER, type SpriteSheet } from '../game/sprites.js';

const GAP = 12;
const LABEL_H = 18;

/**
 * Dev-only sprite sheet, opened with `?sprites`: every frame enlarged, then
 * again at the size the game draws it on this screen, on plain snow.
 */
export function showSpriteSheet(canvas: HTMLCanvasElement): void {
  const player = bakeFrames(PLAYER);
  const beast = bakeFrames(BEAST);
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
    let y = GAP;
    y = drawRow(ctx, PLAYER, player, y, bigZoom(PLAYER, w));
    y = drawRow(ctx, BEAST, beast, y, bigZoom(BEAST, w));
    y = drawRow(ctx, PLAYER, player, y, gameSize);
    drawRow(ctx, BEAST, beast, y, gameSize);
  };
  draw();
  window.addEventListener('resize', draw);
}

/** Draws every frame of a sheet left to right at `scale` CSS px per sprite px; returns the next row's y. */
function drawRow<F extends string>(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet<F>,
  baked: Record<F, HTMLCanvasElement>,
  y: number,
  scale: number,
): number {
  let x = GAP;
  for (const name of Object.keys(sheet.frames) as F[]) {
    ctx.fillStyle = '#22303f';
    ctx.fillText(name, x, y);
    ctx.drawImage(baked[name], x, y + LABEL_H, sheet.width * scale, sheet.height * scale);
    x += Math.max(sheet.width * scale, ctx.measureText(name).width) + GAP;
  }
  return y + LABEL_H + sheet.height * scale + GAP;
}

/** Largest whole zoom that fits a row of every frame across the screen. */
function bigZoom<F extends string>(sheet: SpriteSheet<F>, screenW: number): number {
  const count = Object.keys(sheet.frames).length;
  return Math.max(1, Math.floor((screenW - GAP * (count + 1)) / (sheet.width * count)));
}

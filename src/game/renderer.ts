import { CONFIG } from '../config.js';
import type { Chaser } from './chaser.js';
import type { Gate, PlayerState } from './types.js';
import type { World } from './world.js';

/**
 * Canvas 2D renderer. ALL ART IS ORIGINAL — simple geometric shapes drawn in
 * code. No SkiFree sprites, no copied pixel art.
 *
 * Face-down readability rules: high-contrast palette, large shapes, no text
 * smaller than 20px during gameplay, motion conveyed by speed streaks.
 */
/**
 * Zoom factor that fits the whole slope (plus `viewMargin` of snow on each
 * side) into the screen width left over after the safe-area insets. Never
 * zooms in past 1:1, so wide desktop screens render exactly as before.
 */
export function viewScale(screenWidth: number, safeInset: number): number {
  const needed = 2 * (CONFIG.worldHalfWidth + CONFIG.viewMargin);
  const available = Math.max(1, screenWidth - 2 * safeInset);
  return Math.min(1, available / needed);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  /** Visible area in world px (screen size divided by `scale`). */
  private w = 0;
  private h = 0;
  /** Screen size in CSS px, used for the HUD, which is never scaled. */
  private screenW = 0;
  private screenH = 0;
  private dpr = 1;
  private scale = 1;
  private insetLeft = 0;
  private insetRight = 0;
  private shake = 0;
  /** Hidden element whose padding resolves the CSS safe-area insets to px. */
  private readonly insetProbe: HTMLDivElement;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.insetProbe = document.createElement('div');
    this.insetProbe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);';
    document.body.appendChild(this.insetProbe);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;
    const probe = getComputedStyle(this.insetProbe);
    this.insetLeft = parseFloat(probe.paddingLeft) || 0;
    this.insetRight = parseFloat(probe.paddingRight) || 0;
    // The slope is centred, so reserve the larger inset (the notch side) on both sides.
    this.scale = viewScale(this.screenW, Math.max(this.insetLeft, this.insetRight));
    this.w = this.screenW / this.scale;
    this.h = this.screenH / this.scale;
    this.canvas.width = Math.floor(this.screenW * this.dpr);
    this.canvas.height = Math.floor(this.screenH * this.dpr);
    this.canvas.style.width = `${this.screenW}px`;
    this.canvas.style.height = `${this.screenH}px`;
  }

  addShake(amount: number): void {
    this.shake = Math.min(14, this.shake + amount);
  }

  render(
    world: World,
    player: PlayerState,
    chaser: Chaser,
    score: number,
    streak: number,
    phase: 'playing' | 'gameover',
  ): void {
    const { ctx, w, h } = this;
    const playerScreenY = h * 0.62;
    const camY = player.y - playerScreenY;

    let sx = 0;
    let sy = 0;
    if (this.shake > 0.2) {
      sx = (Math.random() * 2 - 1) * this.shake;
      sy = (Math.random() * 2 - 1) * this.shake;
      this.shake *= 0.88;
    }

    // World is drawn in world px, zoomed out to fit narrow screens.
    const k = this.dpr * this.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.save();
    ctx.translate(sx, sy);

    this.drawSnow(player);
    this.drawSpeedStreaks();

    for (const gate of world.gates) {
      const gy = gate.y - camY;
      if (gy < -80 || gy > h + 80) continue;
      this.drawGate(gate, gy);
    }
    for (const ob of world.obstacles) {
      const oy = ob.y - camY;
      if (oy < -80 || oy > h + 80) continue;
      const ox = w / 2 + ob.x;
      if (ob.kind === 'pine') this.drawPine(ox, oy, ob.scale);
      else this.drawRock(ox, oy, ob.scale);
    }

    if (chaser.active) {
      const cy = chaser.y - camY;
      if (cy > -120 && cy < h + 120) this.drawChaser(w / 2 + chaser.x, cy);
    }

    this.drawPlayer(w / 2 + player.x, playerScreenY, player);
    ctx.restore();

    // HUD stays at 1:1 in screen px so text keeps its readable size.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHud(score, streak, player, phase);
  }

  private drawSnow(player: PlayerState): void {
    const { ctx, w, h } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f2f6fd');
    grad.addColorStop(1, '#dbe6f4');
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // Slope edge markers so lateral bounds are visible.
    ctx.fillStyle = '#b9c9e2';
    const half = CONFIG.worldHalfWidth;
    ctx.fillRect(w / 2 - half - 26, -20, 18, h + 40);
    ctx.fillRect(w / 2 + half + 8, -20, 18, h + 40);

    // Speed lines, denser when tucking.
    const lines = Math.floor(player.speed / 60);
    ctx.strokeStyle = 'rgba(140,170,210,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < lines; i += 1) {
      const yy = ((i * 197 + player.y * 0.9) % (h + 120)) - 60;
      const xx = (i * 331) % w;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + 46);
      ctx.stroke();
    }
  }

  private drawSpeedStreaks(): void {
    // Reserved: streak particles could go here; kept minimal for the POC.
  }

  private drawPine(x: number, y: number, s: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#5b3a22';
    ctx.fillRect(x - 4 * s, y - 6 * s, 8 * s, 14 * s);
    ctx.fillStyle = '#1f7a3d';
    for (let i = 0; i < 3; i += 1) {
      const ty = y - 8 * s - i * 16 * s;
      const tw = (26 - i * 6) * s;
      ctx.beginPath();
      ctx.moveTo(x - tw, ty);
      ctx.lineTo(x + tw, ty);
      ctx.lineTo(x, ty - 22 * s);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawRock(x: number, y: number, s: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#8a93a3';
    ctx.beginPath();
    ctx.moveTo(x - 20 * s, y + 8 * s);
    ctx.lineTo(x - 10 * s, y - 12 * s);
    ctx.lineTo(x + 6 * s, y - 16 * s);
    ctx.lineTo(x + 20 * s, y - 2 * s);
    ctx.lineTo(x + 12 * s, y + 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y - 12 * s);
    ctx.lineTo(x + 6 * s, y - 16 * s);
    ctx.lineTo(x - 2 * s, y - 4 * s);
    ctx.closePath();
    ctx.fill();
  }

  private drawGate(gate: Gate, screenY: number): void {
    const { ctx, w } = this;
    const cx = w / 2 + gate.centerX;
    const hw = gate.halfWidth;
    const pole = (x: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(x - 4, screenY - 34, 8, 40);
      ctx.beginPath();
      ctx.moveTo(x + 4, screenY - 34);
      ctx.lineTo(x + 26, screenY - 26);
      ctx.lineTo(x + 4, screenY - 18);
      ctx.closePath();
      ctx.fill();
    };
    const dim = gate.state === 'pending' ? 1 : 0.35;
    ctx.globalAlpha = dim;
    pole(cx - hw, '#d43a2f'); // left, red
    pole(cx + hw, '#2f6fd4'); // right, blue
    ctx.globalAlpha = 1;
  }

  private drawPlayer(x: number, y: number, player: PlayerState): void {
    const { ctx } = this;
    // Blink while invulnerable after a crash.
    if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 10) % 2 === 0) return;

    // Skis.
    ctx.strokeStyle = '#22303f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 16);
    ctx.lineTo(x - 10, y + 34);
    ctx.moveTo(x + 10, y + 16);
    ctx.lineTo(x + 10, y + 34);
    ctx.stroke();
    // Body (parka).
    ctx.fillStyle = '#e8a33d';
    ctx.beginPath();
    ctx.arc(x, y, CONFIG.playerRadius, 0, Math.PI * 2);
    ctx.fill();
    // Helmet.
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.arc(x, y - 6, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawChaser(x: number, y: number): void {
    const { ctx } = this;
    // Original "shadow beast": dark rounded blob with glowing eyes. NOT a yeti.
    ctx.fillStyle = 'rgba(30,20,40,0.92)';
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5d5d';
    ctx.beginPath();
    ctx.arc(x - 9, y - 8, 5, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 9, y - 8, 2, 0, Math.PI * 2);
    ctx.arc(x + 9, y - 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHud(
    score: number,
    streak: number,
    player: PlayerState,
    phase: 'playing' | 'gameover',
  ): void {
    const { ctx, screenW: w, screenH: h } = this;
    const left = 18 + this.insetLeft;
    const right = w - 18 - this.insetRight;
    ctx.fillStyle = '#22303f';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(score)}`, left, 44);
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText(`${Math.floor(player.y / 10)} m`, left, 72);
    if (streak >= 2) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1f7a3d';
      ctx.fillText(`🔥 x${streak}`, right, 44);
    }
    if (phase === 'gameover') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(14,26,43,0.72)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.fillText('Caught!', w / 2, h / 2 - 30);
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillText(`Score ${Math.floor(score)} · ${Math.floor(player.y / 10)} m`, w / 2, h / 2 + 12);
      ctx.fillText('Tap to ride again', w / 2, h / 2 + 52);
    }
  }
}

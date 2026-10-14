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
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private shake = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    this.drawHud(score, streak, player, phase);
  }

  /** Screen coords of the player for UI overlays (no shake applied). */
  playerScreen(): { x: number; y: number } {
    return { x: this.w / 2, y: this.h * 0.62 };
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
    const { ctx, w } = this;
    ctx.fillStyle = '#22303f';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(score)}`, 18, 44);
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText(`${Math.floor(player.y / 10)} m`, 18, 72);
    if (streak >= 2) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1f7a3d';
      ctx.fillText(`🔥 x${streak}`, w - 18, 44);
    }
    if (phase === 'gameover') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(14,26,43,0.72)';
      ctx.fillRect(0, 0, w, this.h);
      ctx.fillStyle = '#fff';
      ctx.font = '800 44px system-ui, sans-serif';
      ctx.fillText('Caught!', w / 2, this.h / 2 - 30);
      ctx.font = '500 22px system-ui, sans-serif';
      ctx.fillText(`Score ${Math.floor(score)} · ${Math.floor(player.y / 10)} m`, w / 2, this.h / 2 + 12);
      ctx.fillText('Tap to ride again', w / 2, this.h / 2 + 52);
    }
  }
}

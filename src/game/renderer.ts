import { CONFIG } from '../config.js';
import type { Chaser } from './chaser.js';
import { flipProgress } from './jump.js';
import type { EdgeContact, GaugeModel } from './speedGauge.js';
import {
  bakeFrames,
  BEAST,
  beastFrame,
  devicePxPerSpritePx,
  LeanTracker,
  PLAYER,
  RAMP,
  flipFrame,
  type SpriteSheet,
} from './sprites.js';
import type { AirLean, GamePhase, Gate, Jump, JumpCallout, PlayerState } from './types.js';
import type { World } from './world.js';

/**
 * Canvas 2D renderer. ALL ART IS ORIGINAL: geometric shapes drawn in code,
 * plus our own pixel-art rider and beast from sprites.ts. No SkiFree sprites,
 * no copied pixel art.
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

/** Eases 0..1..0 about 1.6 times a second, for warning glows. */
function pulse(time: number): number {
  return 0.5 + 0.5 * Math.sin(time * 10);
}

/** Mirrors the DOM pause button in style.css: 56px square, 12px in from the top-right corner. */
const PAUSE_BUTTON = { size: 56, margin: 12 };
/** Keeps the streak clear of the pause button. */
const PAUSE_BUTTON_CLEARANCE = PAUSE_BUTTON.size + PAUSE_BUTTON.margin + 16;

const GAUGE_COLORS = {
  track: 'rgba(14,26,43,0.82)',
  outline: '#ffffff',
  slowTint: 'rgba(77,160,255,0.28)',
  fastTint: 'rgba(255,170,90,0.26)',
  slowFill: '#4da0ff',
  fastFill: '#ff922b',
  ink: '#22303f',
  chaser: '#ff3b3b',
  beast: '#ffffff',
};
/** Gauge fraction from which the warning glow shows once the chaser passes full lean. */
const OVER_MAX_GLOW_FROM = 0.8;

/** Half the NEW BEST! banner's height at its largest pop-in scale, plus its outline. */
const NEW_BEST_HALF_HEIGHT = 40;
/** Room kept above the rider's centre: the rider plus the "rider" gauge dial beside them. */
const RIDER_CLEARANCE = 70;
const GROUNDED_WARNING = {
  text: 'Lift the edge!',
  font: '900 30px system-ui, sans-serif',
  height: 52,
  padX: 22,
  /** Gap kept from the screen edge and the side gauge. */
  gap: 12,
};

/** Peak height of a jump, world px per second of air time, so longer jumps fly higher... */
const AIR_PEAK_PX_PER_S = 180;
/** ...up to this fraction of the snow above the rider, so a short landscape screen keeps the apex in view. */
const AIR_PEAK_MAX_FRACTION = 0.45;
/** How much bigger the rider draws at the top of a jump, as closer to the camera. */
const AIR_GROW = 0.25;

const CALLOUTS: Record<JumpCallout['kind'], { text: string; color: string }> = {
  takeoff: { text: `JUMP +${CONFIG.jumpScore}`, color: '#4da0ff' },
  flip: { text: 'FLIP!', color: '#ff922b' },
  trick: { text: `FLIP +${CONFIG.trickScore}`, color: '#ff922b' },
  crash: { text: 'CRASH!', color: '#ff3b3b' },
};
const CALLOUT_FONT = '900 30px system-ui, sans-serif';
/** Gap between the bottom of the rider's skis and the top of the callout, screen px. */
const CALLOUT_GAP = 14;

/** 0 on the snow, rising to 1 at the top of the jump and back to 0 at touchdown. */
function airArc(jump: Jump, time: number): number {
  const p = Math.max(0, Math.min(1, (time - jump.startedAt) / jump.duration));
  return 4 * p * (1 - p);
}

/** Rider centre in HUD screen px. */
interface ScreenPoint {
  x: number;
  y: number;
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
  private insetTop = 0;
  private shake = 0;
  /** Hidden element whose padding resolves the CSS safe-area insets to px. */
  private readonly insetProbe: HTMLDivElement;
  private readonly playerFrames = bakeFrames(PLAYER);
  private readonly beastFrames = bakeFrames(BEAST);
  private readonly rampFrames = bakeFrames(RAMP);
  private readonly lean = new LeanTracker();
  /** What the sprite draws need beyond their position, captured at the top of render(). */
  private frame = { time: 0, caught: false, rider: { x: 0, y: 0 } };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.insetProbe = document.createElement('div');
    this.insetProbe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);' +
      'padding-top:env(safe-area-inset-top);';
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
    this.insetTop = parseFloat(probe.paddingTop) || 0;
    // The slope is centred, so reserve the larger inset (the notch side) on both sides.
    this.scale = viewScale(this.screenW, Math.max(this.insetLeft, this.insetRight));
    this.w = this.screenW / this.scale;
    this.h = this.screenH / this.scale;
    this.canvas.width = Math.floor(this.screenW * this.dpr);
    this.canvas.height = Math.floor(this.screenH * this.dpr);
    this.canvas.style.width = `${this.screenW}px`;
    this.canvas.style.height = `${this.screenH}px`;
  }

  /** Clears effects that would otherwise carry over into the next run. */
  reset(): void {
    this.shake = 0;
    this.lean.reset();
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
    phase: GamePhase,
    time: number,
    best: number | null,
    newBestAt: number | null,
    gauge: GaugeModel,
    contact: EdgeContact,
    callout: JumpCallout | null,
    airLean: AirLean | null,
  ): void {
    const { ctx, w, h } = this;
    const playerScreenY = h * 0.62;
    const rider = { x: (w / 2 + player.x) * this.scale, y: playerScreenY * this.scale };
    const camY = player.y - playerScreenY;
    this.frame = { time, caught: phase === 'gameover', rider: { x: w / 2 + player.x, y: playerScreenY } };

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

    for (const ramp of world.ramps) {
      const ry = ramp.y - camY;
      if (ry < -80 || ry > h + 80) continue;
      this.drawSprite(RAMP, this.rampFrames, 'kicker', w / 2 + ramp.x, ry);
    }
    for (const gate of world.gates) {
      const gy = gate.y - camY;
      if (gy < -80 || gy > h + 80) continue;
      this.drawGate(gate, gy, time);
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

    ctx.restore();

    // HUD stays at 1:1 in screen px so text keeps its readable size.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSideGauge(gauge, rider, time);
    // A jump near the right edge rises past the gauge; the rider stays in front so the flip shows.
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.translate(sx, sy);
    this.drawPlayer(w / 2 + player.x, playerScreenY, player);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHud(score, streak, player, phase, best);
    if (phase === 'playing' && newBestAt !== null) {
      const t = (time - newBestAt) / CONFIG.newBestBannerDuration;
      if (t >= 0 && t < 1) this.drawNewBestBanner(t);
    }
    if (phase === 'playing' && callout !== null) this.drawCallout(callout, rider, time);
    if (phase === 'playing' && airLean !== null) this.drawAirLean(airLean, rider);
    if (phase === 'playing' && contact !== 'off') this.drawGroundedWarning(rider, time, contact);
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

    // Speed lines, denser at speed.
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

  private drawGate(gate: Gate, screenY: number, time: number): void {
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
    ctx.save();
    switch (gate.state) {
      case 'pending':
        pole(cx - hw, '#d43a2f'); // left, red
        pole(cx + hw, '#2f6fd4'); // right, blue
        break;
      case 'cleared': {
        ctx.globalAlpha = 0.75;
        pole(cx - hw, '#2fa35a');
        pole(cx + hw, '#2fa35a');
        const t = (time - gate.resolvedAt) / CONFIG.gatePopupDuration;
        if (t < 1) {
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = '#1f8a4a';
          ctx.font = '700 28px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${gate.points}`, cx, screenY - 14 - t * CONFIG.gatePopupRise);
        }
        break;
      }
      case 'missed': {
        ctx.globalAlpha = 0.35;
        pole(cx - hw, '#9aa5b4');
        pole(cx + hw, '#9aa5b4');
        const t = (time - gate.resolvedAt) / CONFIG.gatePopupDuration;
        if (t < 1) {
          const r = 12;
          const my = screenY - 14;
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = '#d43a2f';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - r, my - r);
          ctx.lineTo(cx + r, my + r);
          ctx.moveTo(cx + r, my - r);
          ctx.lineTo(cx - r, my + r);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  private drawPlayer(x: number, y: number, player: PlayerState): void {
    // Track lean even while blinking so the next visible frame is current.
    const lean = this.lean.update(player.x, this.frame.time);
    // Blink while invulnerable after a crash.
    if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 10) % 2 === 0) return;
    const { jump } = player;
    if (jump === null) {
      this.drawSprite(PLAYER, this.playerFrames, player.stumbleTimer > 0 ? 'crashed' : lean, x, y);
      return;
    }
    const arc = airArc(jump, this.frame.time);
    this.drawAirShadow(x, y, arc);
    const flip = flipProgress(jump, this.frame.time);
    const frame = jump.flip === null || flip === null ? 'straight' : flipFrame(jump.flip.dir, flip);
    const peak = Math.min(AIR_PEAK_PX_PER_S * jump.duration, AIR_PEAK_MAX_FRACTION * y);
    this.drawSprite(PLAYER, this.playerFrames, frame, x, y - peak * arc, 1 + AIR_GROW * arc);
  }

  /** The rider's shadow stays on the snow, shrinking and fading as they rise. */
  private drawAirShadow(x: number, y: number, arc: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = `rgba(60,85,130,${0.55 - 0.15 * arc})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 30 * (1 - 0.25 * arc), 11 * (1 - 0.25 * arc), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawChaser(x: number, y: number): void {
    const { time, caught, rider } = this.frame;
    const frame = beastFrame(time, Math.hypot(rider.x - x, rider.y - y), caught);
    this.drawSprite(BEAST, this.beastFrames, frame, x, y);
  }

  /**
   * Draws a baked frame with its anchor on world point (x, y). Each sprite px
   * covers a whole number of device px, snapped to the device grid, so the
   * pixels stay crisp at any zoom. A `grow` above 1 enlarges it with
   * nearest-neighbour scaling: still sharp, some pixels one device px wider.
   */
  private drawSprite<F extends string>(
    sheet: SpriteSheet<F>,
    baked: Record<F, HTMLCanvasElement>,
    frame: F,
    x: number,
    y: number,
    grow = 1,
  ): void {
    const { ctx } = this;
    const m = ctx.getTransform();
    const n = devicePxPerSpritePx(m.a) * grow;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      baked[frame],
      Math.round(m.e + m.a * x - sheet.anchor.x * n),
      Math.round(m.f + m.d * y - sheet.anchor.y * n),
      Math.round(sheet.width * n),
      Math.round(sheet.height * n),
    );
    ctx.restore();
  }

  private drawHud(
    score: number,
    streak: number,
    player: PlayerState,
    phase: GamePhase,
    best: number | null,
  ): void {
    const { ctx, screenW: w, screenH: h } = this;
    const left = 18 + this.insetLeft;
    const right = w - PAUSE_BUTTON_CLEARANCE - this.insetRight;
    ctx.fillStyle = '#22303f';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(score)}`, left, 44);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(`${Math.floor(player.y / 10)} m`, left, 76);
    if (best !== null) {
      const label = `BEST ${best}`;
      ctx.font = '700 20px system-ui, sans-serif';
      if (Math.floor(score) > best) {
        // Gold text alone washes out on snow, so a beaten best gets a gold pill.
        ctx.fillStyle = '#ffc21a';
        ctx.beginPath();
        ctx.roundRect(left - 8, 88, ctx.measureText(label).width + 16, 30, 15);
        ctx.fill();
      }
      ctx.fillStyle = '#22303f';
      ctx.fillText(label, left, 110);
    }
    if (streak >= 2) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1f7a3d';
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillText(`🔥 x${streak}`, right, 44);
    }
    if (phase === 'gameover' || phase === 'paused') {
      // The DOM panel sits on top of this dim.
      ctx.fillStyle = 'rgba(14,26,43,0.72)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** Vertical speed bar under the pause button, up = faster. */
  private drawSideGauge(gauge: GaugeModel, rider: ScreenPoint, time: number): void {
    const thickness = 32;
    const cx = this.sideGaugeX();
    // Labels sit above and below the bar, not beside it, so nothing extends into the slope.
    // The gap keeps them clear of the target chevron when it sits at either end of the bar.
    const labelGap = 28;
    const fastY = this.insetTop + PAUSE_BUTTON.margin + PAUSE_BUTTON.size + 28;
    const top = fastY + labelGap;
    // Downhill is down the screen, so the bar and its SLOW label stop above the rider to keep the slope ahead clear.
    const slowY = rider.y - 42;
    const bottom = slowY - labelGap;
    this.drawGaugeLabel('FAST', cx, fastY, 'center', GAUGE_COLORS.fastFill);
    this.drawBarGauge(gauge, cx, bottom, -Math.PI / 2, bottom - top, thickness, time);
    this.drawGaugeLabel('SLOW', cx, slowY, 'center', GAUGE_COLORS.slowFill);
  }

  /** Centre line of the side gauge; leaves room right of the bar for the chaser marker. */
  private sideGaugeX(): number {
    return this.screenW - this.insetRight - 46;
  }

  /**
   * Draws a bar from (x0, y0) along `angle`, slow end first. In the bar's own
   * frame the target chevron sits on the -y side and the chaser marker on +y.
   */
  private drawBarGauge(
    gauge: GaugeModel,
    x0: number,
    y0: number,
    angle: number,
    length: number,
    thickness: number,
    time: number,
  ): void {
    const { ctx } = this;
    const half = thickness / 2;
    const pad = 5;
    const flatX = gauge.flat * length;
    const speedX = gauge.speed * length;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.roundRect(0, -half, length, thickness, 8);
    ctx.fillStyle = GAUGE_COLORS.track;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = GAUGE_COLORS.slowTint;
    ctx.fillRect(0, -half, flatX, thickness);
    ctx.fillStyle = GAUGE_COLORS.fastTint;
    ctx.fillRect(flatX, -half, length - flatX, thickness);
    ctx.fillStyle = GAUGE_COLORS.slowFill;
    ctx.fillRect(0, -half + pad, Math.min(speedX, flatX), thickness - 2 * pad);
    if (speedX > flatX) {
      ctx.fillStyle = GAUGE_COLORS.fastFill;
      ctx.fillRect(flatX, -half + pad, speedX - flatX, thickness - 2 * pad);
    }
    if (gauge.chaserOverMax) {
      ctx.fillStyle = `rgba(255,59,59,${0.35 + 0.45 * pulse(time)})`;
      ctx.fillRect(length * OVER_MAX_GLOW_FROM, -half, length * (1 - OVER_MAX_GLOW_FROM), thickness);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(0, -half, length, thickness, 8);
    this.strokeGaugeOutline(gauge, time);

    ctx.fillStyle = GAUGE_COLORS.outline;
    ctx.fillRect(flatX - 2.5, -half - 5, 5, thickness + 10);

    if (gauge.chaser !== null) {
      const x = Math.max(2.5, Math.min(length - 2.5, gauge.chaser * length));
      ctx.fillStyle = GAUGE_COLORS.chaser;
      ctx.fillRect(x - 2.5, -half - 4, 5, thickness + 8);
      ctx.save();
      ctx.translate(x, half + 13);
      ctx.rotate(-angle);
      this.drawBeastMarker(0, 0);
      ctx.restore();
    }

    const tx = gauge.target * length;
    ctx.beginPath();
    ctx.moveTo(tx, -half - 2);
    ctx.lineTo(tx - 13, -half - 24);
    ctx.lineTo(tx + 13, -half - 24);
    ctx.closePath();
    this.fillPointer();
    ctx.restore();
  }

  /** Strokes the current path as the gauge border, glowing red once the chaser can't be outrun. */
  private strokeGaugeOutline(gauge: GaugeModel, time: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = GAUGE_COLORS.outline;
    if (gauge.chaserOverMax) {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = GAUGE_COLORS.chaser;
      ctx.shadowColor = GAUGE_COLORS.chaser;
      ctx.shadowBlur = 8 + 12 * pulse(time);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Fills the current path as the lean-target pointer: white with a dark rim so it reads on snow and track alike. */
  private fillPointer(): void {
    const { ctx } = this;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = GAUGE_COLORS.ink;
    ctx.stroke();
    ctx.fillStyle = GAUGE_COLORS.outline;
    ctx.fill();
  }

  /** A tiny golem face so the chaser line reads as "the beast", not another limit. */
  private drawBeastMarker(x: number, y: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = GAUGE_COLORS.beast;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = GAUGE_COLORS.chaser;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 4, y - 2, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 2, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = GAUGE_COLORS.chaser;
    ctx.fill();
    ctx.fillStyle = GAUGE_COLORS.ink;
    ctx.fillRect(x - 4, y + 3, 8, 2.5);
  }

  private drawGaugeLabel(text: string, x: number, y: number, align: CanvasTextAlign, color: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = GAUGE_COLORS.ink;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** Below the top-left HUD block and well above the rider at 62% height. */
  private newBestBannerY(): number {
    return Math.max(160, this.screenH * 0.26);
  }

  /**
   * Centre of the "Lift the edge!" pill. It goes between the NEW BEST! banner
   * and the rider when that gap fits it (portrait), otherwise in the top row
   * between the score and the streak, level with the pause button (landscape).
   */
  private groundedWarningCentre(rider: ScreenPoint, width: number): ScreenPoint {
    const { height, gap } = GROUNDED_WARNING;
    const bandTop = this.newBestBannerY() + NEW_BEST_HALF_HEIGHT;
    const bandBottom = rider.y - RIDER_CLEARANCE;
    if (bandBottom - bandTop < height + 2 * gap) {
      return {
        x: (this.insetLeft + this.screenW - this.insetRight) / 2,
        y: this.insetTop + PAUSE_BUTTON.margin + PAUSE_BUTTON.size / 2,
      };
    }
    const left = this.insetLeft + gap;
    // The side gauge's target chevron reaches 40px left of its centre line.
    const right = this.sideGaugeX() - 40 - gap;
    return {
      x: Math.max(left + width / 2, (left + right) / 2),
      y: (bandTop + bandBottom) / 2,
    };
  }

  private drawGroundedWarning(rider: ScreenPoint, time: number, contact: Exclude<EdgeContact, 'off'>): void {
    const { ctx } = this;
    const { text, font, height, padX } = GROUNDED_WARNING;
    ctx.save();
    ctx.font = font;
    const width = ctx.measureText(text).width + 2 * padX;
    const { x, y } = this.groundedWarningCentre(rider, width);
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, height / 2);
    ctx.fillStyle = '#d62828';
    ctx.fill();
    // Resting on the edge is already costing speed, so the warning pulses harder and faster.
    ctx.lineWidth = contact === 'resting' ? 4 + 6 * pulse(time * 3) : 3 + 3 * pulse(time);
    ctx.strokeStyle = '#22303f';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  /**
   * "JUMP +50", "FLIP +100" or "CRASH!" just below the rider's skis, where no
   * other HUD element goes: the gauge, the grounded warning and the NEW BEST!
   * banner all sit above the rider. Pops in, holds, fades like the banner.
   */
  private drawCallout(callout: JumpCallout, rider: ScreenPoint, time: number): void {
    const t = (time - callout.at) / CONFIG.gatePopupDuration;
    if (t < 0 || t >= 1) return;
    const { ctx } = this;
    const { text, color } = CALLOUTS[callout.kind];
    const skis = ((PLAYER.height - PLAYER.anchor.y) * devicePxPerSpritePx(this.dpr * this.scale)) / this.dpr;
    ctx.save();
    ctx.font = CALLOUT_FONT;
    const half = ctx.measureText(text).width / 2 + 4;
    const x = Math.max(this.insetLeft + half, Math.min(this.screenW - this.insetRight - half, rider.x));
    const y = rider.y + skis + CALLOUT_GAP + 15;
    const scale = 1 + 0.3 * Math.max(0, 1 - t / 0.12);
    ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = GAUGE_COLORS.ink;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /**
   * In-air trick meter under the callout: lateral lean as a marker on a short
   * track, with the two flip thresholds marked. Shows why a flip did or did
   * not start, which is otherwise invisible in under a second of air.
   */
  private drawAirLean(air: AirLean, rider: ScreenPoint): void {
    const { ctx } = this;
    const halfW = 80;
    const barH = 14;
    const skis = ((PLAYER.height - PLAYER.anchor.y) * devicePxPerSpritePx(this.dpr * this.scale)) / this.dpr;
    const x = Math.max(this.insetLeft + halfW + 8, Math.min(this.screenW - this.insetRight - halfW - 8, rider.x));
    const y = rider.y + skis + CALLOUT_GAP + 15 + 34;
    const at = (lean: number) => x + Math.max(-1, Math.min(1, lean)) * halfW;
    const past = air.lean >= air.right || air.lean <= air.left;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - halfW, y - barH / 2, 2 * halfW, barH, barH / 2);
    ctx.fillStyle = air.sideGrounded ? 'rgba(214,40,40,0.85)' : GAUGE_COLORS.track;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = GAUGE_COLORS.outline;
    ctx.stroke();
    ctx.fillStyle = GAUGE_COLORS.outline;
    ctx.fillRect(x - 1, y - barH / 2 + 3, 2, barH - 6);
    ctx.fillStyle = GAUGE_COLORS.fastFill;
    for (const t of [air.left, air.right]) ctx.fillRect(at(t) - 2, y - barH / 2 - 5, 4, barH + 10);
    ctx.beginPath();
    ctx.arc(at(air.lean), y, 9, 0, Math.PI * 2);
    // Orange means a flip is (or would be) on; a grounded side edge blocks it, so stay white.
    ctx.fillStyle = air.flipping || (past && !air.sideGrounded) ? GAUGE_COLORS.fastFill : GAUGE_COLORS.outline;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = GAUGE_COLORS.ink;
    ctx.stroke();
    if (air.sideGrounded) {
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = GAUGE_COLORS.ink;
      ctx.strokeText('EDGE DOWN', x, y + barH / 2 + 6);
      ctx.fillStyle = '#ff3b3b';
      ctx.fillText('EDGE DOWN', x, y + barH / 2 + 6);
    }
    ctx.restore();
  }

  /** t runs 0..1 over the banner's lifetime: pop in, hold, fade out. */
  private drawNewBestBanner(t: number): void {
    const { ctx, screenW: w } = this;
    const grow = Math.min(1, t / 0.15);
    const scale = 0.6 + 0.4 * grow + 0.15 * Math.sin(grow * Math.PI);
    const alpha = Math.min(grow, t > 0.75 ? (1 - t) / 0.25 : 1);
    const cx = (this.insetLeft + w - this.insetRight) / 2;
    const cy = this.newBestBannerY();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.font = '900 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#22303f';
    ctx.strokeText('NEW BEST!', 0, 0);
    ctx.fillStyle = '#ffc21a';
    ctx.fillText('NEW BEST!', 0, 0);
    ctx.restore();
  }
}

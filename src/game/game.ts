import { CONFIG } from '../config.js';
import type { TiltInput } from '../input/TiltInput.js';
import { Chaser } from './chaser.js';
import { circlesCollide, gateCrossed, gatePassed } from './collisions.js';
import { Renderer } from './renderer.js';
import { applyStumblePenalty, scoreForDistance, scoreForGate } from './scoring.js';
import type { GamePhase, PlayerState } from './types.js';
import { World } from './world.js';

const STEP = 1 / 60;

/**
 * Owns the fixed-timestep loop, player physics, collisions, scoring and the
 * chaser. Rendering is delegated to Renderer; input comes from a TiltInput.
 */
export class Game {
  phase: GamePhase = 'menu';
  private player: PlayerState = { x: 0, y: 0, speed: CONFIG.baseSpeed, stumbleTimer: 0, invulnTimer: 0 };
  private world = new World(Date.now() % 2147483647);
  private chaser = new Chaser();
  private renderer: Renderer;
  private score = 0;
  private streak = 0;
  private time = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private onGameOver: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly input: TiltInput,
  ) {
    this.renderer = new Renderer(canvas);
  }

  onGameOverCallback(cb: () => void): void {
    this.onGameOver = cb;
  }

  get currentScore(): number {
    return this.score;
  }

  start(): void {
    this.reset();
    this.phase = 'playing';
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      const loop = (now: number) => {
        if (!this.running) return;
        this.acc += Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        let steps = 0;
        while (this.acc >= STEP && steps < 5) {
          this.update(STEP);
          this.acc -= STEP;
          steps += 1;
        }
        this.renderer.render(this.world, this.player, this.chaser, this.score, this.streak, this.phase === 'gameover' ? 'gameover' : 'playing', this.time);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private reset(): void {
    this.player = { x: 0, y: 0, speed: CONFIG.baseSpeed, stumbleTimer: 0, invulnTimer: 0 };
    this.world = new World(Date.now() % 2147483647);
    this.chaser.reset();
    this.score = 0;
    this.streak = 0;
    this.time = 0;
    this.acc = 0;
  }

  private update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.time += dt;
    this.input.update(dt);
    const tilt = this.input.sample();

    // Speed: forward tilt tucks, backward tilt brakes.
    const y = tilt.y;
    const speedFactor =
      y >= 0
        ? 1 + y * (CONFIG.tuckMultiplier - 1)
        : 1 + y * (1 - CONFIG.brakeMultiplier);
    let targetSpeed = CONFIG.baseSpeed * speedFactor;
    if (this.player.stumbleTimer > 0) {
      targetSpeed *= CONFIG.stumbleSlowFactor;
      this.player.stumbleTimer -= dt;
    }
    this.player.speed += (targetSpeed - this.player.speed) * Math.min(1, dt * 6);

    // Lateral steering with soft walls.
    this.player.x += tilt.x * CONFIG.steerSpeed * dt;
    const half = CONFIG.worldHalfWidth;
    if (this.player.x < -half) this.player.x = -half;
    if (this.player.x > half) this.player.x = half;

    const prevY = this.player.y;
    const dy = this.player.speed * dt;
    this.player.y += dy;
    this.score += scoreForDistance(dy);

    if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt;

    // Keep course generated ahead; prune behind.
    this.world.ensure(this.player.y - 400, this.player.y + 1600);
    this.world.prune(this.player.y - 400);

    // Gates.
    const gates = this.world.gates;
    for (let i = 0; i < gates.length; i += 1) {
      const gate = gates[i];
      if (gate.state !== 'pending' || !gateCrossed(prevY, this.player.y, gate.y)) continue;
      if (gatePassed(this.player.x, gate.centerX, gate.halfWidth)) {
        this.streak += 1;
        const points = scoreForGate(this.streak);
        this.score += points;
        gates[i] = { ...gate, state: 'cleared', points, resolvedAt: this.time };
      } else {
        this.streak = 0;
        gates[i] = { ...gate, state: 'missed', resolvedAt: this.time };
      }
    }

    // Obstacle collisions → stumble (never instant death).
    if (this.player.invulnTimer <= 0) {
      for (const ob of this.world.obstacles) {
        if (Math.abs(ob.y - this.player.y) > 60) continue;
        if (
          circlesCollide(
            this.player.x, this.player.y, CONFIG.playerRadius,
            ob.x, ob.y, ob.r,
          )
        ) {
          this.player.stumbleTimer = CONFIG.stumbleDuration;
          this.player.invulnTimer = CONFIG.invulnDuration;
          this.score = applyStumblePenalty(this.score);
          this.streak = 0;
          this.renderer.addShake(8);
          break;
        }
      }
    }

    // Chaser.
    this.chaser.maybeActivate(this.player.y, this.player.x, this.player.y);
    this.chaser.update(dt, this.player.x, this.player.y);
    if (this.chaser.caught(this.player.x, this.player.y)) {
      this.phase = 'gameover';
      this.onGameOver?.();
    }
  }
}

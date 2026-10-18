import { CONFIG } from '../config.js';
import type { TiltInput } from '../input/TiltInput.js';
import { Chaser } from './chaser.js';
import { circlesCollide, gateCrossed, gatePassed, rampHit } from './collisions.js';
import { easeSpeed, hasLanded, landing, takeoff, updateAir } from './jump.js';
import type { Renderer } from './renderer.js';
import { applyStumblePenalty, passedBest, scoreForDistance, scoreForGate } from './scoring.js';
import type { RunResult } from './session.js';
import { edgeContact, gaugeModel, leanTargetSpeed, type EdgeContact } from './speedGauge.js';
import type { GamePhase, Jump, JumpCallout, PlayerState } from './types.js';
import { World } from './world.js';

const STEP = 1 / 60;

/**
 * Owns the fixed-timestep loop, player physics, collisions, scoring and the
 * chaser. Rendering is delegated to Renderer; input comes from a TiltInput.
 */
export class Game {
  phase: GamePhase = 'menu';
  private player: PlayerState = { x: 0, y: 0, speed: CONFIG.flatSpeed, stumbleTimer: 0, invulnTimer: 0, jump: null, landingCarry: 0 };
  private world = new World(Date.now() % 2147483647);
  private chaser = new Chaser();
  /** Speed the current lean is easing toward, kept for the speed gauge. */
  private targetSpeed: number = CONFIG.flatSpeed;
  /** Seconds the board's edge has been down without a break. */
  private groundedFor = 0;
  private contact: EdgeContact = 'off';
  private score = 0;
  private streak = 0;
  private gatesCleared = 0;
  /** Latest jump moment for the renderer to call out; null until the first jump. */
  private callout: JumpCallout | null = null;
  /** Game time when the score first passed the session best; null until then. */
  private newBestAt: number | null = null;
  private time = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private onGameOver: ((run: RunResult) => void) | null = null;

  constructor(
    /** Shared by every run on the page, so per-run effects are cleared in reset(). */
    private readonly renderer: Renderer,
    readonly input: TiltInput,
    /** Session best score to beat; null on the session's first run. */
    private readonly best: number | null,
  ) {}

  onGameOverCallback(cb: (run: RunResult) => void): void {
    this.onGameOver = cb;
  }

  get currentScore(): number {
    return this.score;
  }

  /** Begins a new run from zero. */
  start(): void {
    this.reset();
    this.phase = 'playing';
    this.runLoop();
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.stop();
    this.phase = 'paused';
    this.draw();
  }

  /** Continues a paused run where it left off. */
  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.runLoop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private runLoop(): void {
    if (this.running) return;
    this.running = true;
    // Time spent stopped must not reach the accumulator as one huge step.
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
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private draw(): void {
    const gauge = gaugeModel({
      speed: this.player.speed,
      target: this.targetSpeed,
      chaserSpeed: this.chaser.active ? this.chaser.speed : null,
    });
    this.renderer.render(this.world, this.player, this.chaser, this.score, this.streak, this.phase, this.time, this.best, this.newBestAt, gauge, this.contact, this.callout);
  }

  private reset(): void {
    this.player = { x: 0, y: 0, speed: CONFIG.flatSpeed, stumbleTimer: 0, invulnTimer: 0, jump: null, landingCarry: 0 };
    this.world = new World(Date.now() % 2147483647);
    this.chaser.reset();
    this.targetSpeed = CONFIG.flatSpeed;
    this.groundedFor = 0;
    this.contact = 'off';
    this.score = 0;
    this.streak = 0;
    this.gatesCleared = 0;
    this.newBestAt = null;
    this.callout = null;
    this.time = 0;
    this.acc = 0;
    this.renderer.reset();
  }

  private update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.time += dt;
    const prevScore = this.score;
    this.input.update(dt);
    const tilt = this.input.sample();

    this.groundedFor = tilt.grounded ? this.groundedFor + dt : 0;
    this.contact = edgeContact(tilt.grounded, this.groundedFor);

    const flying = this.player.jump && updateAir(this.player.jump, tilt.x, tilt.grounded, this.time);
    if (flying && hasLanded(flying, this.time)) this.land(flying, tilt.x);
    else this.player.jump = flying;

    const stumbling = this.player.stumbleTimer > 0;
    if (stumbling) this.player.stumbleTimer -= dt;
    if (this.player.jump) {
      // Locked speed and no steering in the air: lateral lean is for tricks.
      this.targetSpeed = this.player.jump.speed;
      this.player.speed = this.player.jump.speed;
    } else {
      this.targetSpeed = leanTargetSpeed(tilt.y, this.contact, stumbling);
      this.player.speed = easeSpeed(this.player.speed, this.targetSpeed, this.player.landingCarry, dt);
      this.player.landingCarry = Math.max(0, this.player.landingCarry - dt);

      // Lateral steering with soft walls.
      this.player.x += tilt.x * CONFIG.steerSpeed * dt;
      const half = CONFIG.worldHalfWidth;
      if (this.player.x < -half) this.player.x = -half;
      if (this.player.x > half) this.player.x = half;
    }

    const prevY = this.player.y;
    const dy = this.player.speed * dt;
    this.player.y += dy;
    this.score += scoreForDistance(dy);

    if (this.player.invulnTimer > 0) this.player.invulnTimer -= dt;

    // Keep course generated ahead; prune behind.
    this.world.ensure(this.player.y - 400, this.player.y + 1600);
    this.world.prune(this.player.y - 400);

    if (!this.player.jump && this.world.ramps.some((r) => rampHit(prevY, this.player.y, this.player.x, r))) {
      this.player.jump = takeoff(this.player.speed, this.time);
      this.player.landingCarry = 0;
      this.score += CONFIG.jumpScore;
      this.callout = { kind: 'takeoff', at: this.time };
    }

    // Gates.
    const gates = this.world.gates;
    for (let i = 0; i < gates.length; i += 1) {
      const gate = gates[i];
      if (gate.state !== 'pending' || !gateCrossed(prevY, this.player.y, gate.y)) continue;
      if (gatePassed(this.player.x, gate.centerX, gate.halfWidth)) {
        this.streak += 1;
        this.gatesCleared += 1;
        const points = scoreForGate(this.streak);
        this.score += points;
        gates[i] = { ...gate, state: 'cleared', points, resolvedAt: this.time };
      } else {
        this.streak = 0;
        gates[i] = { ...gate, state: 'missed', resolvedAt: this.time };
      }
    }

    // Obstacle collisions → stumble (never instant death). Airborne riders fly over them.
    if (this.player.invulnTimer <= 0 && !this.player.jump) {
      for (const ob of this.world.obstacles) {
        if (Math.abs(ob.y - this.player.y) > 60) continue;
        if (
          circlesCollide(
            this.player.x, this.player.y, CONFIG.playerRadius,
            ob.x, ob.y, ob.r,
          )
        ) {
          this.crash();
          break;
        }
      }
    }

    // Compare whole points, as shown in the HUD and recorded on the board.
    if (this.newBestAt === null && passedBest(Math.floor(prevScore), Math.floor(this.score), this.best)) {
      this.newBestAt = this.time;
    }

    // Chaser.
    this.chaser.maybeActivate(this.player.y, this.player.x, this.player.y);
    this.chaser.update(dt, this.player.x, this.player.y);
    if (this.chaser.caught(this.player.x, this.player.y)) {
      this.phase = 'gameover';
      this.onGameOver?.({
        score: Math.floor(this.score),
        distanceM: Math.floor(this.player.y / 10),
        gatesCleared: this.gatesCleared,
        durationS: this.time,
      });
    }
  }

  private land(jump: Jump, lean: number): void {
    this.player.jump = null;
    const outcome = landing(jump, lean, this.time);
    if (outcome === 'crash') {
      this.crash();
      this.callout = { kind: 'crash', at: this.time };
      return;
    }
    this.player.landingCarry = CONFIG.landingCarryS;
    if (outcome === 'trick') {
      this.score += CONFIG.trickScore;
      this.callout = { kind: 'trick', at: this.time };
    }
  }

  private crash(): void {
    this.player.stumbleTimer = CONFIG.stumbleDuration;
    this.player.invulnTimer = CONFIG.invulnDuration;
    this.player.landingCarry = 0;
    this.score = applyStumblePenalty(this.score);
    this.streak = 0;
    this.renderer.addShake(8);
  }
}

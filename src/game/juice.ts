import { CONFIG } from '../config.js';
import { ParticlePool } from './particles.js';
import type { JumpCallout } from './types.js';

/**
 * Juice: snow spray, crash impact and near-miss feedback. It only decorates
 * what the rider does and never touches speed, score or the chaser; every
 * effect grows with the rider's lean, speed or closeness.
 */

/** The rider's effects setting. `off` still keeps the "CRASH!" callout, which is part of the base game. */
export type JuiceLevel = 'full' | 'reduced' | 'off';

export const JUICE_LEVELS: readonly JuiceLevel[] = ['full', 'reduced', 'off'];

export const JUICE_STORAGE_KEY = 'driftline.juice.v1';

interface JuiceProfile {
  /** Carve spray and the crash burst. */
  readonly particles: boolean;
  /** Multipliers on crashHitStopS and crashShakePx. */
  readonly hitStop: number;
  readonly shake: number;
  /** Near-miss whoosh and "CLOSE!" callout. */
  readonly nearMiss: boolean;
  /** The "CLOSE!" callout pops and flashes white instead of just appearing. */
  readonly flash: boolean;
}

export const JUICE_PROFILES: Readonly<Record<JuiceLevel, JuiceProfile>> = {
  full: { particles: true, hitStop: 1, shake: 1, nearMiss: true, flash: true },
  reduced: { particles: true, hitStop: 0.5, shake: 0.5, nearMiss: true, flash: false },
  off: { particles: false, hitStop: 0, shake: 0, nearMiss: false, flash: false },
};

/** The stored level; with nothing valid stored, `reduced` for riders who ask for reduced motion, else `full`. */
export function parseJuiceLevel(raw: string | null, prefersReducedMotion: boolean): JuiceLevel {
  return JUICE_LEVELS.find((level) => level === raw) ?? (prefersReducedMotion ? 'reduced' : 'full');
}

export function loadJuiceLevel(): JuiceLevel {
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(JUICE_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage.
  }
  return parseJuiceLevel(raw, reducedMotion);
}

/** Best effort: without storage the level still applies until the page reloads. */
export function saveJuiceLevel(level: JuiceLevel): void {
  try {
    localStorage.setItem(JUICE_STORAGE_KEY, level);
  } catch {
    // Private mode or blocked storage.
  }
}

/** Speed as a fraction of full-lean speed, 0..1. */
function speedFraction(speed: number): number {
  return Math.min(1, Math.max(0, speed / CONFIG.fullLeanSpeed));
}

/** 0 riding straight, 1 at full lateral lean at full-lean speed. */
export function carveIntensity(lean: number, speed: number): number {
  return Math.min(1, Math.abs(lean)) * speedFraction(speed);
}

/** Spray particles per second for a lateral lean and speed. */
export function sprayRate(lean: number, speed: number): number {
  const intensity = carveIntensity(lean, speed);
  return intensity < CONFIG.sprayMinIntensity ? 0 : intensity * CONFIG.sprayMaxRate;
}

/** Where the effects go outside the game state: the renderer's shake and the synthesized whoosh. */
export interface JuiceSinks {
  shake(px: number): void;
  whoosh(strength: number): void;
}

export class Juice {
  readonly particles = new ParticlePool(CONFIG.particleCap);
  readonly profile: JuiceProfile;
  private hitStopLeft = 0;
  /** Fractional spray particles owed from earlier steps, so low rates still emit. */
  private sprayOwed = 0;
  /** Game time until which near misses stay silent. */
  private quietUntil = -Infinity;

  constructor(
    readonly level: JuiceLevel,
    private readonly sinks: JuiceSinks,
    private readonly random: () => number = Math.random,
  ) {
    this.profile = JUICE_PROFILES[level];
  }

  get hitStop(): number {
    return this.hitStopLeft;
  }

  reset(): void {
    this.particles.clear();
    this.hitStopLeft = 0;
    this.sprayOwed = 0;
    this.quietUntil = -Infinity;
  }

  /**
   * Advances the particles and spends `dt` of any hit-stop. True while
   * gameplay should stay frozen; particles keep flying so the burst blooms
   * while the world hangs.
   */
  step(dt: number): boolean {
    this.particles.update(dt);
    if (this.hitStopLeft <= 0) return false;
    this.hitStopLeft -= dt;
    return true;
  }

  /** Throws spray out of the turn from the rider's skis at (x, y). */
  carve(dt: number, x: number, y: number, lean: number, speed: number): void {
    if (!this.profile.particles) return;
    const rate = sprayRate(lean, speed);
    if (rate === 0) {
      this.sprayOwed = 0;
      return;
    }
    const intensity = carveIntensity(lean, speed);
    const outward = lean > 0 ? -1 : 1;
    const size = CONFIG.spraySizeMin + (CONFIG.spraySizeMax - CONFIG.spraySizeMin) * intensity;
    const kick = CONFIG.sprayKick * intensity;
    this.sprayOwed += rate * dt;
    while (this.sprayOwed >= 1) {
      this.sprayOwed -= 1;
      this.particles.emit(
        x,
        y,
        outward * kick * this.jitter(),
        speed * CONFIG.sprayCarry - kick * CONFIG.particleJitter * this.random(),
        size * this.jitter(),
        CONFIG.sprayLifeS * this.jitter(),
      );
    }
  }

  /** Hit-stop, screen shake and a snow burst at (x, y), all bigger the faster the impact. */
  crash(x: number, y: number, speed: number): void {
    const { profile } = this;
    const impact = speedFraction(speed);
    this.hitStopLeft = CONFIG.crashHitStopS * profile.hitStop;
    if (profile.shake > 0) this.sinks.shake(CONFIG.crashShakePx * profile.shake * impact);
    if (!profile.particles) return;
    const count = Math.round(CONFIG.crashBurstCount * impact);
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const kick = CONFIG.crashBurstKick * this.jitter();
      this.particles.emit(
        x,
        y,
        Math.cos(angle) * kick,
        speed * CONFIG.sprayCarry + Math.sin(angle) * kick,
        CONFIG.spraySizeMax * this.jitter(),
        CONFIG.sprayLifeS * (1 + CONFIG.particleJitter) * this.jitter(),
      );
    }
  }

  /**
   * A near miss `gap` px from the obstacle's edge at game time `time`. Plays
   * the whoosh, louder for a closer and faster pass, and returns the "CLOSE!"
   * callout, unless one played within nearMissCooldownS.
   */
  nearMiss(gap: number, speed: number, time: number): JumpCallout | null {
    if (!this.profile.nearMiss || time < this.quietUntil) return null;
    this.quietUntil = time + CONFIG.nearMissCooldownS;
    const closeness = 1 - Math.min(1, Math.max(0, gap / CONFIG.nearMissMarginPx));
    this.sinks.whoosh((closeness + speedFraction(speed)) / 2);
    return { kind: 'close', at: time, flash: this.profile.flash };
  }

  /** 1 ± particleJitter. */
  private jitter(): number {
    return 1 + CONFIG.particleJitter * (this.random() * 2 - 1);
  }
}

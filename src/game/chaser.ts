import { CONFIG } from '../config.js';
import { circlesCollide } from './collisions.js';

/**
 * The "shadow beast" — an original chaser entity (NOT the SkiFree yeti).
 *
 * It appears after the player has travelled chaserTriggerDistance and homes
 * in on the player. It is slightly faster than coasting speed, so passive
 * players get caught; tucking outruns it for a while, but its acceleration
 * guarantees the run ends in roughly 60-120 seconds — a natural session cap
 * matched to plank endurance.
 *
 * It never moves past the player's y: once level it runs alongside and keeps
 * homing laterally, so a sidestep only delays the catch until the slope wall
 * corners the player.
 */
export class Chaser {
  active = false;
  x = 0;
  y = 0;
  private speed = CONFIG.chaserSpeed;

  /** Activate once the player passes the trigger distance. */
  maybeActivate(playerDistance: number, playerX: number, playerY: number): void {
    if (this.active || playerDistance < CONFIG.chaserTriggerDistance) return;
    this.active = true;
    this.x = playerX;
    this.y = playerY - CONFIG.chaserSpawnBehind;
    this.speed = CONFIG.chaserSpeed;
  }

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.active) return;
    this.speed += CONFIG.chaserAccel * dt;
    this.y = Math.min(this.y + this.speed * dt, playerY);
    // Limited lateral homing — it drifts toward the player's line.
    const dx = playerX - this.x;
    const maxStep = CONFIG.chaserTurnSpeed * dt;
    this.x += Math.max(-maxStep, Math.min(maxStep, dx));
  }

  caught(playerX: number, playerY: number): boolean {
    if (!this.active) return false;
    return circlesCollide(
      this.x, this.y, CONFIG.chaserCatchRadius,
      playerX, playerY, CONFIG.playerRadius,
    );
  }

  reset(): void {
    this.active = false;
    this.speed = CONFIG.chaserSpeed;
  }
}

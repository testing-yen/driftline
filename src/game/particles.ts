import { CONFIG } from '../config.js';

/**
 * Fixed-size pool of snow particles in world px, stored as parallel typed
 * arrays so emitting and stepping never allocate. A slot is free once its age
 * reaches its life; when every slot is busy the oldest emission is recycled.
 */
export class ParticlePool {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly age: Float64Array;
  readonly life: Float64Array;
  readonly size: Float64Array;
  private next = 0;

  constructor(readonly capacity: number) {
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.vx = new Float64Array(capacity);
    this.vy = new Float64Array(capacity);
    this.age = new Float64Array(capacity);
    this.life = new Float64Array(capacity);
    this.size = new Float64Array(capacity);
  }

  emit(x: number, y: number, vx: number, vy: number, size: number, life: number): void {
    const i = this.next;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.size[i] = size;
    this.life[i] = life;
    this.age[i] = 0;
    this.next = (i + 1) % this.capacity;
  }

  isAlive(i: number): boolean {
    return this.age[i] < this.life[i];
  }

  get alive(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i += 1) if (this.isAlive(i)) n += 1;
    return n;
  }

  update(dt: number): void {
    const damp = Math.exp(-CONFIG.particleDrag * dt);
    for (let i = 0; i < this.capacity; i += 1) {
      if (!this.isAlive(i)) continue;
      this.age[i] += dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.vx[i] *= damp;
      this.vy[i] *= damp;
    }
  }

  clear(): void {
    this.age.fill(0);
    this.life.fill(0);
    this.next = 0;
  }
}

import type { TiltInput, TiltSample } from './TiltInput.js';

/**
 * Desktop development input: arrow keys / WASD and pointer drag simulate tilt.
 *
 * This is how ~90% of development and tuning happens — no planking required.
 * ArrowLeft/Right = steer, ArrowUp = tuck (lean forward), ArrowDown = brake.
 * Dragging on the canvas also works: drag right/down from the press point.
 */
export class KeyboardTiltInput implements TiltInput {
  readonly name = 'keyboard';
  readonly needsUserGesture = false;

  private keys = new Set<string>();
  private current: TiltSample = { x: 0, y: 0 };
  private target: TiltSample = { x: 0, y: 0 };
  private dragStart: { x: number; y: number } | null = null;
  private dragCurrent: { x: number; y: number } | null = null;
  private attached = false;
  private canvas: HTMLCanvasElement | null = null;

  /** For tests / scripted demos: drive the target directly. */
  setSimulated(x: number, y: number): void {
    this.target = { x: clamp1(x), y: clamp1(y) };
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  start(): void {
    if (this.attached) return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas?.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.attached = true;
  }

  stop(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.attached = false;
    this.keys.clear();
    this.dragStart = null;
    this.dragCurrent = null;
  }

  calibrate(): void {
    // Nothing to calibrate on keyboard; neutral is always zero.
  }

  update(dt: number): void {
    this.updateTargetFromKeys();
    // Exponential smoothing toward the target for analog feel.
    const k = Math.min(1, dt * 10);
    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
  }

  sample(): TiltSample {
    return { x: this.current.x, y: this.current.y };
  }

  private updateTargetFromKeys(): void {
    // Pointer drag wins while active; otherwise derive from keys.
    if (this.dragStart && this.dragCurrent) {
      const dx = (this.dragCurrent.x - this.dragStart.x) / 160;
      const dy = (this.dragCurrent.y - this.dragStart.y) / 160;
      this.target = { x: clamp1(dx), y: clamp1(dy) };
      return;
    }
    const left = this.keys.has('ArrowLeft') || this.keys.has('a');
    const right = this.keys.has('ArrowRight') || this.keys.has('d');
    const up = this.keys.has('ArrowUp') || this.keys.has('w');
    const down = this.keys.has('ArrowDown') || this.keys.has('s');
    this.target = {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (up ? 1 : 0) - (down ? 1 : 0),
    };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key);
    if (e.key.startsWith('Arrow')) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragCurrent = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragStart) this.dragCurrent = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (): void => {
    this.dragStart = null;
    this.dragCurrent = null;
  };
}

function clamp1(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

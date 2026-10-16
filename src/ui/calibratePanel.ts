import { CONFIG } from '../config.js';
import { LEAN_DIRECTIONS, leanToward, saveReach, type BoardReach, type LeanDirection } from '../input/boardReach.js';
import { advance, holdProgress, startCalibration, type CalibStep } from '../input/reachCalibration.js';
import type { BoardAngles, TiltInput } from '../input/TiltInput.js';

const DIRECTION_LABEL: Record<LeanDirection, string> = {
  forward: 'Forward',
  back: 'Back',
  left: 'Left',
  right: 'Right',
};

/** Neutral plus one push per direction. */
const STEP_COUNT = 1 + LEAN_DIRECTIONS.length;

export function calibrateBoardButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'btn secondary';
  button.textContent = 'Calibrate board';
  button.addEventListener('click', onClick);
  return button;
}

export interface CalibrationOptions {
  ui: HTMLElement;
  input: TiltInput;
  angles: BoardAngles;
  /** Called after Save or Cancel; the caller puts its own panel back. */
  onClose: () => void;
}

/**
 * Replace the UI layer with the Calibrate board flow. It re-zeroes the neutral
 * first, so the pushes are measured from the same level the game rides on.
 * Cancel keeps the previous reach; Save stores the new one and applies it.
 */
export function showCalibration({ ui, input, angles, onClose }: CalibrationOptions): void {
  ui.innerHTML = '';
  const panel = el('div', 'panel calib');
  const stepLine = el('p', 'calib-step');
  const title = el('h1', 'calib-title');
  const live = el('p', 'calib-angle');
  const bar = el('div', 'calib-hold');
  const fill = el('span');
  bar.append(fill);
  const hint = el('p', 'calib-hint');
  const summary = el('table', 'calib-summary');
  const actions = el('div', 'panel-actions');
  panel.append(stepLine, title, live, bar, hint, summary, actions);
  ui.append(panel);

  const cancel = el('button', 'btn secondary', 'Cancel');
  cancel.addEventListener('click', onClose);

  let step: CalibStep = restart();
  let shown: string | null = null;

  function restart(): CalibStep {
    input.calibrate();
    return startCalibration(angles.reach);
  }

  /** Rebuilds the panel when the step changes; per-frame values are set in tick(). */
  function render(): void {
    live.hidden = step.kind !== 'push' && step.kind !== 'return';
    bar.hidden = step.kind !== 'push';
    live.classList.toggle('returning', step.kind === 'return');
    summary.hidden = step.kind !== 'done';
    hint.textContent = '';
    actions.replaceChildren(cancel);
    switch (step.kind) {
      case 'neutral':
        stepLine.textContent = `Step 1 of ${STEP_COUNT}`;
        title.textContent = 'Hold the board level';
        hint.textContent = 'Measuring level…';
        break;
      case 'push':
        stepLine.textContent = `Step ${2 + LEAN_DIRECTIONS.indexOf(step.dir)} of ${STEP_COUNT}`;
        title.textContent = `Push the ${step.dir.toUpperCase()} edge to the floor and hold`;
        hint.textContent = 'Hold still until the bar fills.';
        break;
      case 'return': {
        const captured = LEAN_DIRECTIONS[LEAN_DIRECTIONS.indexOf(step.next) - 1];
        stepLine.textContent = `${DIRECTION_LABEL[captured]}: ${step.reach[captured].toFixed(1)}° ✓`;
        title.textContent = 'Back to level';
        hint.textContent = `Under ${CONFIG.reachLevelDeg}° every way, then the ${step.next.toUpperCase()} edge.`;
        break;
      }
      case 'done': {
        stepLine.textContent = 'All edges captured ✓';
        title.textContent = 'Your board';
        fillSummary(summary, step.reach);
        const save = el('button', 'btn', 'Save');
        const reach = step.reach;
        save.addEventListener('click', () => {
          angles.reach = reach;
          saveReach(reach);
          onClose();
        });
        const redo = el('button', 'btn secondary', 'Redo');
        redo.addEventListener('click', () => {
          step = restart();
          shown = null;
        });
        actions.replaceChildren(save, redo, cancel);
        save.focus({ preventScroll: true });
        break;
      }
    }
  }

  function tick(): void {
    if (!panel.isConnected) return;
    const now = performance.now();
    step = advance(step, { lean: angles.now, calibrated: input.calibrated }, now);
    const key = step.kind === 'push' ? `push:${step.dir}` : step.kind === 'return' ? `return:${step.next}` : step.kind;
    if (key !== shown) {
      shown = key;
      render();
    }
    const { x, y } = angles.now;
    if (step.kind === 'push') {
      live.textContent = `${Math.max(0, leanToward(step.dir, x, y)).toFixed(1)}°`;
      fill.style.width = `${holdProgress(step, now) * 100}%`;
    } else if (step.kind === 'return') {
      live.textContent = `${Math.max(Math.abs(x), Math.abs(y)).toFixed(1)}°`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function fillSummary(table: HTMLTableElement, reach: BoardReach): void {
  table.replaceChildren();
  const row = (cells: string[], header: boolean) => {
    const tr = el('tr');
    for (const [i, text] of cells.entries()) tr.append(el(header || i === 0 ? 'th' : 'td', '', text));
    table.append(tr);
  };
  row(['', 'Edge down', 'Full speed'], true);
  for (const dir of LEAN_DIRECTIONS) {
    row([DIRECTION_LABEL[dir], `${reach[dir].toFixed(1)}°`, `${(reach[dir] * CONFIG.fullLeanFraction).toFixed(1)}°`], false);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

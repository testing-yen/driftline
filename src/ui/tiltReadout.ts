import { LEAN_DIRECTIONS, leanToward, type LeanDirection } from '../input/boardReach.js';
import type { TiltInput } from '../input/TiltInput.js';

const LABEL: Record<LeanDirection, string> = { forward: 'Fwd', back: 'Back', left: 'Left', right: 'Right' };

/**
 * Live lean angles and the furthest lean per direction, for measuring how far
 * a real board can tilt before its edge touches the floor. Returns null for
 * inputs without a real angle (keyboard).
 */
export function tiltReadout(input: TiltInput): HTMLElement | null {
  if (!input.angles) return null;

  const table = document.createElement('table');
  const line = (cells: string[], header: boolean) => {
    const tr = document.createElement('tr');
    for (const [i, text] of cells.entries()) {
      const cell = document.createElement(header || i === 0 ? 'th' : 'td');
      cell.textContent = text;
      tr.append(cell);
    }
    table.append(tr);
    return tr;
  };
  line(['Tilt °', 'Now', 'Max'], true);
  const rows = LEAN_DIRECTIONS.map((dir) => line([LABEL[dir], '', ''], false));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn secondary';
  reset.textContent = 'Reset max';
  reset.addEventListener('click', () => input.angles?.range.reset());

  const box = document.createElement('div');
  box.className = 'tilt-readout';
  box.append(table, reset);

  const update = () => {
    // Re-read every frame: the input replaces its angle sample on each motion event.
    const angles = input.angles;
    if (!box.isConnected || !angles) return;
    const { x, y } = angles.now;
    LEAN_DIRECTIONS.forEach((dir, i) => {
      rows[i].cells[1].textContent = Math.max(0, leanToward(dir, x, y)).toFixed(1);
      rows[i].cells[2].textContent = angles.range[dir].toFixed(1);
    });
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
  return box;
}

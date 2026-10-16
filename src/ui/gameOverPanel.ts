import { formatDuration, type RecordOutcome, type RunResult, type SessionBoard } from '../game/session.js';
import type { TiltInput } from '../input/TiltInput.js';

const BOARD_ROWS = 5;
const CONFETTI_PIECES = 36;
const CONFETTI_COLORS = ['#ffd34d', '#ff6b6b', '#4dd0ff', '#7be37b', '#ffffff', '#c78bff'];
const CONFETTI_LIFETIME_MS = 2500;
const RECENTER_CONFIRM_MS = 1500;

export interface GameOverOptions {
  ui: HTMLElement;
  run: RunResult;
  outcome: RecordOutcome;
  board: SessionBoard;
  input: TiltInput;
  onRideAgain: () => void;
}

/** Replace the UI layer with the end-of-run summary and session scoreboard. */
export function showGameOver({ ui, run, outcome, board, input, onRideAgain }: GameOverOptions): void {
  ui.innerHTML = '';
  const panel = el('div', 'panel gameover');

  const summary = el('section', 'go-summary');
  if (outcome.isNewBest && outcome.previousBest !== null) {
    summary.append(
      el('h1', 'go-title new-best', 'NEW BEST!'),
      el('p', 'go-delta', `+${run.score - outcome.previousBest} over your best`),
    );
  } else {
    summary.append(el('h1', 'go-title', 'Caught!'));
  }
  summary.append(
    el('p', 'go-score', `${run.score} pts`),
    el('p', 'go-stats', `${run.distanceM} m · ${plural(run.gatesCleared, 'gate')} · ${formatDuration(run.durationS)}`),
  );

  const actions = el('div', 'go-actions');
  const ride = el('button', 'btn', 'Ride again');
  ride.addEventListener('click', onRideAgain);
  actions.append(ride);
  if (input.needsUserGesture) {
    actions.append(recenterButton(input, ride));
  }
  summary.append(actions);

  const session = el('section', 'go-board');
  session.append(el('h2', 'go-heading', 'This session'), scoreTable(board, run, outcome));
  session.append(
    el('p', 'go-total', `Session plank time: ${formatDuration(board.totalDurationS)} · ${plural(board.runCount, 'run')}`),
  );

  panel.append(summary, session);
  ui.append(panel);
  if (outcome.isNewBest) ui.append(confettiBurst());
  ride.focus({ preventScroll: true });
}

function scoreTable(board: SessionBoard, run: RunResult, outcome: RecordOutcome): HTMLTableElement {
  const table = el('table', 'go-table');
  const head = el('tr');
  for (const label of ['#', 'Score', 'm', 'Gates', 'Time']) head.append(el('th', '', label));
  const thead = el('thead');
  const body = el('tbody');
  thead.append(head);
  table.append(thead, body);
  board.top(BOARD_ROWS).forEach((r, i) => body.append(scoreRow(i + 1, r, i + 1 === outcome.rank)));
  if (outcome.rank > BOARD_ROWS) {
    const extra = scoreRow(outcome.rank, run, true);
    extra.classList.add('extra');
    body.append(extra);
  }
  return table;
}

function scoreRow(rank: number, r: RunResult, isThisRun: boolean): HTMLTableRowElement {
  const row = el('tr', isThisRun ? 'this-run' : '');
  for (const cell of [rank, r.score, r.distanceM, r.gatesCleared, formatDuration(r.durationS)]) {
    row.append(el('td', '', String(cell)));
  }
  return row;
}

/**
 * Re-zeroes the IMU neutral without a page refresh (which would wipe the
 * session board). Ride is locked until the calibrator has its samples so a
 * run never starts on a half-collected neutral.
 */
function recenterButton(input: TiltInput, ride: HTMLButtonElement): HTMLButtonElement {
  const button = el('button', 'btn secondary', 'Re-center');
  button.addEventListener('click', () => {
    ride.disabled = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Hold the board level…';
    input.calibrate();
    const waitForNeutral = () => {
      if (!input.calibrated) {
        requestAnimationFrame(waitForNeutral);
        return;
      }
      button.removeAttribute('aria-busy');
      button.textContent = 'Re-centered ✓';
      button.disabled = false;
      ride.disabled = false;
      setTimeout(() => {
        if (!button.hasAttribute('aria-busy')) button.textContent = 'Re-center';
      }, RECENTER_CONFIRM_MS);
    };
    requestAnimationFrame(waitForNeutral);
  });
  return button;
}

function confettiBurst(): HTMLElement {
  const layer = el('div', 'confetti');
  for (let i = 0; i < CONFETTI_PIECES; i += 1) {
    const piece = el('i');
    piece.style.setProperty('--x', `${Math.random() * 100}%`);
    piece.style.setProperty('--drift', `${Math.round((Math.random() * 2 - 1) * 120)}px`);
    piece.style.setProperty('--spin', `${Math.round(360 + Math.random() * 720)}deg`);
    piece.style.setProperty('--delay', `${(Math.random() * 0.4).toFixed(2)}s`);
    piece.style.setProperty('--dur', `${(1.4 + Math.random() * 0.6).toFixed(2)}s`);
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    layer.append(piece);
  }
  setTimeout(() => layer.remove(), CONFETTI_LIFETIME_MS);
  return layer;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

import './style.css';
import { Game } from './game/game.js';
import { Renderer } from './game/renderer.js';
import { SessionBoard, boardsPerMode } from './game/session.js';
import { loadReach } from './input/boardReach.js';
import { DeviceMotionTiltInput } from './input/DeviceMotionTiltInput.js';
import { KeyboardTiltInput } from './input/KeyboardTiltInput.js';
import { LEAN_PROFILES, loadPlayMode, savePlayMode } from './input/playMode.js';
import type { TiltInput } from './input/TiltInput.js';
import { registerServiceWorker } from './pwa.js';
import { calibrateBoardButton, showCalibration } from './ui/calibratePanel.js';
import { showGameOver } from './ui/gameOverPanel.js';
import { MODE_COPY, modePicker } from './ui/modePicker.js';
import { showPauseButton, showPaused } from './ui/pausePanel.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLDivElement;

const isTouchDevice =
  'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

// Outlive every Game: each restart builds a fresh one.
const boards = boardsPerMode();
// Keyboard and touch-drag have no play mode, so they keep a scoreboard of their own.
const keysBoard = new SessionBoard();
const renderer = new Renderer(canvas);
let game: Game | null = null;
let wakeLock: WakeLockSentinel | null = null;

async function requestWakeLock(): Promise<void> {
  if (wakeLock && !wakeLock.released) return;
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock) {
      wakeLock = await nav.wakeLock.request('screen');
    }
  } catch {
    // Wake lock is best-effort; the game works without it.
  }
}

function showMenu(input: TiltInput): void {
  ui.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'panel menu';

  const title = document.createElement('h1');
  title.textContent = 'DRIFTLINE';
  const sub = document.createElement('p');
  sub.textContent =
    'Tilt to carve downhill. Thread the gates, dodge pines and rocks — and don’t let the avalanche golem catch you.';

  const angles = input.angles;
  const controls = document.createElement('p');
  controls.textContent = angles
    ? MODE_COPY[angles.profile.mode].instructions
    : 'Arrows / WASD or drag to steer. Hold Up to lean forward (faster); let go to slow down.';

  const startBtn = document.createElement('button');
  startBtn.className = 'btn';
  startBtn.textContent = input.needsUserGesture ? 'Enable motion & start' : 'Start run';

  const errLine = document.createElement('p');
  errLine.className = 'err';

  // Handheld mode covers riders without a board, so touch-drag is only the
  // fallback for when motion is denied or unsupported.
  const dragBtn = document.createElement('button');
  dragBtn.className = 'btn secondary';
  dragBtn.textContent = 'Use touch-drag instead';
  dragBtn.hidden = true;
  dragBtn.addEventListener('click', () => {
    const kb = new KeyboardTiltInput();
    kb.attach(canvas);
    kb.start();
    showMenu(kb);
  });
  const motionFailed = (err: unknown) => {
    errLine.textContent = `${err instanceof Error ? err.message : String(err)} You can still play with touch-drag.`;
    dragBtn.hidden = false;
  };

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    errLine.textContent = '';
    try {
      // Must run inside the tap gesture on iOS.
      await input.start();
      input.calibrate();
      await requestWakeLock();
      startGame(input);
    } catch (err) {
      motionFailed(err);
      startBtn.disabled = false;
    }
  });

  panel.append(title, sub);
  if (angles) {
    panel.append(
      modePicker(angles.profile.mode, (mode) => {
        angles.profile = LEAN_PROFILES[mode];
        savePlayMode(mode);
        showMenu(input);
      }),
    );
  }
  panel.append(controls, startBtn);

  if (angles?.profile.calibratesReach) {
    const calibrate = calibrateBoardButton(async () => {
      calibrate.disabled = true;
      errLine.textContent = '';
      try {
        // Motion permission must be granted inside this tap on iOS.
        await input.start();
        showCalibration({ ui, input, angles, onClose: () => showMenu(input) });
      } catch (err) {
        motionFailed(err);
        calibrate.disabled = false;
      }
    });
    panel.append(calibrate);
  }
  panel.append(errLine);

  if (input.needsUserGesture) panel.append(dragBtn);

  ui.append(panel);
}

function pauseGame(): void {
  if (game?.phase !== 'playing') return;
  game.pause();
  showPaused({
    ui,
    input: game.input,
    onResume: () => {
      showPauseButton(ui, pauseGame);
      void requestWakeLock();
      game?.resume();
    },
  });
}

function startGame(input: TiltInput): void {
  showPauseButton(ui, pauseGame);
  game?.stop();
  const mode = input.angles?.profile.mode;
  const board = mode ? boards[mode] : keysBoard;
  game = new Game(renderer, input, board.bestScore);
  game.onGameOverCallback((run) => {
    const outcome = board.record(run);
    const onRideAgain = () => {
      // The OS drops the wake lock whenever the page is hidden, including on this screen.
      void requestWakeLock();
      startGame(input);
    };
    showGameOver({
      ui,
      run,
      outcome,
      board,
      mode: mode ? MODE_COPY[mode] : null,
      input,
      onRideAgain,
      onChangeMode: () => showMenu(input),
    });
  });
  game.start();
}

function boot(): void {
  registerServiceWorker();

  // Coming back stays paused until the rider taps Resume.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    pauseGame();
    void wakeLock?.release().catch(() => undefined);
    wakeLock = null;
  });

  let input: TiltInput;
  if (isTouchDevice) {
    input = new DeviceMotionTiltInput(loadReach(), LEAN_PROFILES[loadPlayMode()]);
  } else {
    const kb = new KeyboardTiltInput();
    kb.attach(canvas);
    kb.start();
    input = kb;
  }
  showMenu(input);
}

if (import.meta.env.DEV && new URLSearchParams(location.search).has('sprites')) {
  void import('./dev/spriteSheet.js').then(({ showSpriteSheet }) => showSpriteSheet(canvas));
} else {
  boot();
}

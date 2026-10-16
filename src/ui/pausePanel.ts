import type { TiltInput } from '../input/TiltInput.js';
import { calibrateBoardButton, showCalibration } from './calibratePanel.js';
import { recenterButton } from './recenter.js';
import { tiltReadout } from './tiltReadout.js';

const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';

/** Replace the UI layer with the in-run pause button. */
export function showPauseButton(ui: HTMLElement, onPause: () => void): void {
  ui.innerHTML = '';
  const button = document.createElement('button');
  button.className = 'pause-btn';
  button.setAttribute('aria-label', 'Pause');
  button.innerHTML = PAUSE_ICON;
  button.addEventListener('click', onPause);
  ui.append(button);
}

export interface PausedOptions {
  ui: HTMLElement;
  input: TiltInput;
  onResume: () => void;
  /** Speed gauge picker, so the variant can be changed mid-run. */
  gaugeSwitch: HTMLElement;
}

/**
 * Replace the UI layer with the Paused panel. Resuming is always a tap, never
 * automatic: the rider has just picked the phone up and needs time to get
 * back on the board before the chaser moves again.
 */
export function showPaused(options: PausedOptions): void {
  const { ui, input, onResume, gaugeSwitch } = options;
  ui.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const title = document.createElement('h1');
  title.textContent = 'Paused';

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  const resume = document.createElement('button');
  resume.className = 'btn';
  resume.textContent = 'Resume';
  resume.addEventListener('click', onResume);
  actions.append(resume);
  if (input.needsUserGesture) {
    actions.append(recenterButton(input, resume));
  }
  const angles = input.angles;
  if (angles) {
    actions.append(
      calibrateBoardButton(() => showCalibration({ ui, input, angles, onClose: () => showPaused(options) })),
    );
  }

  const readout = tiltReadout(input);
  if (readout) {
    // Side by side: stacked, the readout would push the panel past a landscape phone's height.
    const main = document.createElement('div');
    main.append(title, actions, gaugeSwitch);
    panel.classList.add('with-readout');
    panel.append(main, readout);
  } else {
    panel.append(title, actions, gaugeSwitch);
  }
  ui.append(panel);
  resume.focus({ preventScroll: true });
}

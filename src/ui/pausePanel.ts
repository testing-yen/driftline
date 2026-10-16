import type { TiltInput } from '../input/TiltInput.js';
import { recenterButton } from './recenter.js';

export interface PausedOptions {
  ui: HTMLElement;
  input: TiltInput;
  onResume: () => void;
}

/**
 * Replace the UI layer with the Paused panel. Resuming is always a tap, never
 * automatic: the rider has just picked the phone up and needs time to get
 * back on the board before the chaser moves again.
 */
export function showPaused({ ui, input, onResume }: PausedOptions): void {
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

  panel.append(title, actions);
  ui.append(panel);
  resume.focus({ preventScroll: true });
}

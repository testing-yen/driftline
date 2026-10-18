import { PLAY_MODES, type PlayMode } from '../input/playMode.js';

export interface ModeCopy {
  /** Short name, as on the game-over heading ("This session · Handheld"). */
  label: string;
  /** The one-line instruction on its choice. */
  choice: string;
  /** Start-menu instructions while the mode is selected. */
  instructions: string;
  /** Shown on Re-center while the neutral is measured. */
  holdNeutral: string;
  /** Label for the session's summed run time on the game-over panel. */
  sessionTime: string;
}

export const MODE_COPY: Readonly<Record<PlayMode, ModeCopy>> = {
  board: {
    label: 'Board',
    choice: 'Phone mounted on a wobble board. Lean forward to go faster.',
    instructions:
      'Mount the phone in portrait, hold the board level, then tap Start. New board? Tap Calibrate board first. If your neutral drifts, tap ⏸ and Re‑center.',
    holdNeutral: 'Hold the board level…',
    sessionTime: 'Session plank time',
  },
  handheld: {
    label: 'Handheld',
    choice: 'Phone in your hands. Tilt the top edge toward you to go faster.',
    instructions:
      'Hold the phone in portrait the way you want to play, keep it still, then tap Start. Tilt left or right to steer. If your neutral drifts, tap ⏸ and Re‑center.',
    holdNeutral: 'Hold the phone still…',
    sessionTime: 'Session ride time',
  },
};

/** The two play modes as big radio choices; `onSelect` fires when the rider picks the other one. */
export function modePicker(selected: PlayMode, onSelect: (mode: PlayMode) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'mode-picker';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Play mode');
  for (const mode of PLAY_MODES) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'mode-choice';
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(mode === selected));
    const name = document.createElement('strong');
    name.textContent = MODE_COPY[mode].label;
    const line = document.createElement('span');
    line.textContent = MODE_COPY[mode].choice;
    option.append(name, line);
    if (mode !== selected) option.addEventListener('click', () => onSelect(mode));
    group.append(option);
  }
  return group;
}

import { JUICE_LEVELS, type JuiceLevel } from '../game/juice.js';

const LABELS: Readonly<Record<JuiceLevel, string>> = { full: 'Full', reduced: 'Reduced', off: 'Off' };

/** A compact Effects row: spray, crash shake and near-miss feedback at full, reduced or off. */
export function juicePicker(selected: JuiceLevel, onSelect: (level: JuiceLevel) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'juice-picker';
  const label = document.createElement('span');
  label.id = 'juice-label';
  label.textContent = 'Effects';
  const group = document.createElement('div');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', label.id);
  for (const level of JUICE_LEVELS) {
    const option = document.createElement('button');
    option.type = 'button';
    option.setAttribute('role', 'radio');
    option.setAttribute('aria-checked', String(level === selected));
    option.textContent = LABELS[level];
    if (level !== selected) option.addEventListener('click', () => onSelect(level));
    group.append(option);
  }
  row.append(label, group);
  return row;
}

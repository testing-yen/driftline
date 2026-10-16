import type { GaugeStyle } from '../game/speedGauge.js';

const OPTIONS: Record<GaugeStyle, { label: string; name: string }> = {
  side: { label: 'A', name: 'Side bar' },
  top: { label: 'B', name: 'Top bar' },
  rider: { label: 'C', name: 'Dial by the rider' },
  off: { label: 'Off', name: 'No gauge' },
};

/** Segmented "Speed gauge: A · B · C · Off" picker for comparing the gauge variants. */
export function gaugeSwitch(current: GaugeStyle, onChange: (style: GaugeStyle) => void): HTMLElement {
  const group = document.createElement('div');
  group.className = 'gauge-switch';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Speed gauge');

  const label = document.createElement('span');
  label.className = 'gauge-switch-label';
  label.textContent = 'Speed gauge';

  const options = document.createElement('div');
  options.className = 'gauge-switch-options';
  const buttons = (Object.keys(OPTIONS) as GaugeStyle[]).map((style) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = OPTIONS[style].label;
    button.title = OPTIONS[style].name;
    button.setAttribute('aria-label', OPTIONS[style].name);
    button.setAttribute('aria-pressed', String(style === current));
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      onChange(style);
    });
    return button;
  });
  options.append(...buttons);

  group.append(label, options);
  return group;
}

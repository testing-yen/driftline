import type { TiltInput } from '../input/TiltInput.js';

const RECENTER_CONFIRM_MS = 1500;

/**
 * Re-zeroes the IMU neutral without a page refresh (which would wipe the
 * session board). The panel's primary button is locked until the calibrator
 * has its samples so riding never starts on a half-collected neutral.
 */
export function recenterButton(input: TiltInput, primary: HTMLButtonElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'btn secondary';
  button.textContent = 'Re-center';
  button.addEventListener('click', () => {
    primary.disabled = true;
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
      primary.disabled = false;
      setTimeout(() => {
        if (!button.hasAttribute('aria-busy')) button.textContent = 'Re-center';
      }, RECENTER_CONFIRM_MS);
    };
    requestAnimationFrame(waitForNeutral);
  });
  return button;
}

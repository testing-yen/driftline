/** Register the hand-rolled service worker (production builds only). */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is a nice-to-have; the game runs fine without it.
    });
  });
}

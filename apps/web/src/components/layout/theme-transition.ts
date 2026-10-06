import { flushSync } from 'react-dom';

/**
 * Changes the theme as a circle of the new theme spreading out from where it
 * was asked for, rather than as a flash.
 *
 * Uses the View Transitions API (Baseline in every current browser): the
 * browser snapshots the page, the theme changes underneath, and the new
 * snapshot is revealed by a growing circle drawn in CSS (`theme-reveal` in
 * index.css). Where the API is missing, or the reader asked for reduced
 * motion, the theme simply changes.
 *
 * Deliberately limited to the theme: a view transition lays a snapshot over
 * the whole page while it runs, which would swallow a click made straight
 * after navigating -- page changes use a CSS entrance instead.
 */
export function switchTheme(change: () => void, origin?: { x: number; y: number }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = (document as Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void> };
  }).startViewTransition?.bind(document);

  if (!start || reduced) {
    change();
    return;
  }

  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 28;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.documentElement.style.setProperty('--reveal-x', `${x}px`);
  document.documentElement.style.setProperty('--reveal-y', `${y}px`);
  document.documentElement.style.setProperty('--reveal-r', `${radius}px`);
  document.documentElement.dataset.themeReveal = 'true';

  const transition = start(() => {
    // The change must land inside the callback, or the browser snapshots
    // before React has painted it.
    flushSync(change);
  });
  void transition.ready.finally(() => {
    window.setTimeout(() => delete document.documentElement.dataset.themeReveal, 600);
  });
}

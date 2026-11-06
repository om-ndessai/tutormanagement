import { useSyncExternalStore } from 'react';

/**
 * Phase 78 (the Phase 77 carry, JF35): ONE `now` for every relative time on a screen. Start's in-progress warning and
 * the row beneath it once said "started 2 minutes ago" and "1 minute ago", because each worked out the time when it
 * rendered. Every reader of this hook gets the same instant, refreshed together every 15 seconds, so two lines about
 * one moment always say the same words -- whichever component draws them (the Assessments page, the Assessment home).
 */
const TICK_MS = 15_000;
let now = new Date();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    now = new Date();
    timer = setInterval(() => {
      now = new Date();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useScreenNow(): Date {
  return useSyncExternalStore(subscribe, () => now);
}

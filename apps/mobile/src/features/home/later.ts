// "Later" on the Now card (Phase 43): the lessons put off for the rest of this app session. Held in
// memory only, so the card comes back the next time the app is started; never stored, never sent.
import { useSyncExternalStore } from 'react';

let later: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function putOff(key: string): void {
  if (later.has(key)) return;
  later = new Set([...later, key]);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The keys (`lessonKey`) put off with "Later" since the app started. */
export function usePutOff(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => later);
}

/** Tests only. */
export function resetPutOff(): void {
  later = new Set();
}

// "Later" on Next up (Phase 66, H2; Phase 43's Now card before it): the items put off for the rest of
// TODAY on this phone, per space. Kept in the phone's preferences (`tmi.homeLater`) as `nextUpKey`s with
// the date, so a restart keeps them and the next day starts clean; never sent. Ported in spirit from
// apps/web/src/features/home/api.ts (readPutOff / putOff, localStorage per space and day).
import { useEffect, useSyncExternalStore } from 'react';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';

interface Stored {
  day: string;
  /** Space slug → the keys put off that day. */
  spaces: Record<string, string[]>;
}

let stored: Stored = { day: '', spaces: {} };
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();
let cache = new Map<string, ReadonlySet<string>>();

function notify() {
  cache = new Map();
  listeners.forEach((listener) => listener());
}

/** Reads the phone's list once; a bad or missing value reads as nothing put off. */
function hydrate(): Promise<void> {
  if (hydrated) return Promise.resolve();
  hydrating ??= (async () => {
    try {
      const raw = await readPref(STORAGE_KEYS.homeLater);
      const value = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
      if (value && typeof value.day === 'string' && value.spaces && typeof value.spaces === 'object') {
        // Anything put off in this session before the read wins over nothing.
        if (!stored.day) stored = { day: value.day, spaces: value.spaces as Record<string, string[]> };
      }
    } catch {
      // Not readable: nothing is put off.
    }
    hydrated = true;
    notify();
  })();
  return hydrating;
}

function keysFor(space: string, day: string): ReadonlySet<string> {
  if (stored.day !== day) return EMPTY;
  const id = `${space}|${day}`;
  let set = cache.get(id);
  if (!set) {
    set = new Set(stored.spaces[space] ?? []);
    cache.set(id, set);
  }
  return set;
}

/** Puts one Next up item off for the rest of `day` in `space`. */
export function putOff(space: string | undefined, day: string, key: string): void {
  const slug = space ?? '';
  const spaces = stored.day === day ? { ...stored.spaces } : {};
  const list = spaces[slug] ?? [];
  if (list.includes(key)) return;
  spaces[slug] = [...list, key];
  stored = { day, spaces };
  notify();
  try {
    void writePref(STORAGE_KEYS.homeLater, JSON.stringify(stored));
  } catch {
    // Not saved: "Later" lasts until the app is restarted.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The keys put off today in this space (re-read when the date changes). */
export function usePutOff(space: string | undefined, day: string): ReadonlySet<string> {
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, () => keysFor(space ?? '', day));
}

/** Tests only. */
export function resetPutOff(): void {
  stored = { day: '', spaces: {} };
  hydrated = true;
  hydrating = null;
  notify();
}

// Ported from apps/web/src/features/guest/guest-api.ts @ 0e3ec7a (working tree). Phase 63 (P10, P15):
// a level's guest pool, and the anonymous counts.
//
// Mobile:
// - The pool is versioned and public, so it is kept: in this module for the run (signing up clears the
//   query cache mid-quest, and the quest must not lose its questions) and on the phone by version (the
//   web's browser keeps the `immutable` response). A new version (any console edit) fetches again.
// - The counts go through the api client (the app makes no bare fetch), batched by guest-events.ts and
//   sent when a quest ends, when sign-up starts and when the app goes to the background. A guest has no
//   session, so a count carries no cookie; it carries no id either way.
import { useQuery } from '@tanstack/react-query';
import type { ApiOk, GuestPool, PlayEvent } from '@tmi/shared';
import { AppState } from 'react-native';

import { apiClient } from '@/lib/api-client';
import { readGuestPoolRaw, writeGuestPoolRaw } from '@/lib/storage';
import { createEventQueue } from './guest-events';

const pools = new Map<string, GuestPool>();

export const guestPoolKey = (version: string | undefined, level: string | undefined) =>
  ['guest', 'pool', version, level] as const;

/** The pool for a version and level: from this run, then the phone, then the server. */
export async function fetchGuestPool(version: string, level: string): Promise<GuestPool> {
  const key = `${version}:${level}`;
  const held = pools.get(key);
  if (held) return held;
  try {
    const kept = JSON.parse((await readGuestPoolRaw(level)) ?? 'null') as GuestPool | null;
    if (kept && kept.version === version && Array.isArray(kept.questions)) {
      pools.set(key, kept);
      return kept;
    }
  } catch {
    // Not readable: fetched again.
  }
  const pool = (
    await apiClient.get<ApiOk<GuestPool>>(`/public/guest/${encodeURIComponent(version)}/${encodeURIComponent(level)}`)
  ).data;
  pools.set(key, pool);
  void writeGuestPoolRaw(level, JSON.stringify(pool));
  return pool;
}

/** Phase 63 (P10): a level's guest pool, by version (kept forever: `staleTime: Infinity`). */
export function useGuestPool(version: string | undefined, level: string | undefined) {
  const held = version && level ? pools.get(`${version}:${level}`) : undefined;
  return useQuery({
    queryKey: guestPoolKey(version, level),
    queryFn: () => fetchGuestPool(version!, level!),
    enabled: Boolean(version && level),
    staleTime: Infinity,
    initialData: held,
  });
}

/** For tests: forget the pools held in this run. */
export function forgetGuestPoolsForTests(): void {
  pools.clear();
}

const queue = createEventQueue((events) => apiClient.post('/public/events', { events }));
let watching = false;

/** Phase 63 (P15): one anonymous count, sent with the next batch. */
export function countEvent(event: PlayEvent): void {
  if (!watching) {
    watching = true;
    // The web's "page hidden": whatever is queued goes when the app leaves the screen.
    AppState.addEventListener('change', (next) => {
      if (next !== 'active') queue.flush();
    });
  }
  queue.count(event);
}

export function flushEvents(): void {
  queue.flush();
}

import { useQuery } from '@tanstack/react-query';
import { PLAY_EVENTS_PER_BATCH, type ApiOk, type GuestPool, type PlayEvent } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

/** Phase 63 (P10): a level's guest pool, by version (kept by the browser, `immutable`). */
export function useGuestPool(version: string | undefined, level: string | undefined) {
  return useQuery({
    queryKey: ['guest', 'pool', version, level] as const,
    queryFn: () => apiClient.get<ApiOk<GuestPool>>(`/public/guest/${encodeURIComponent(version!)}/${encodeURIComponent(level!)}`),
    enabled: Boolean(version && level),
    staleTime: Infinity,
  });
}

/**
 * Phase 63 (P15): anonymous counts, batched and sent with sendBeacon when a quest ends or the page is
 * hidden. No id, no cookie: the beacon carries only the events' names and their tile, variant and source.
 */
let queue: PlayEvent[] = [];

export function countEvent(event: PlayEvent): void {
  queue.push({ client: 'web', ...event });
  if (queue.length >= PLAY_EVENTS_PER_BATCH) flushEvents();
}

export function flushEvents(): void {
  if (queue.length === 0) return;
  const events = queue.slice(0, PLAY_EVENTS_PER_BATCH);
  queue = queue.slice(PLAY_EVENTS_PER_BATCH);
  const body = JSON.stringify({ events });
  try {
    const sent = navigator.sendBeacon?.('/api/public/events', new Blob([body], { type: 'application/json' }));
    if (!sent) void fetch('/api/public/events', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit' });
  } catch {
    // Counts are best effort.
  }
  if (queue.length > 0) flushEvents();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
}

// The tutor's Home (Phase 43): one read for the "Now" card and the next lesson's brief,
// `GET /api/home/tutor`. App-first by the owner's word (2026-10-20); the web's copy is owed and will
// keep this query key. Only the reader's own pairings; no money.
import { useQuery } from '@tanstack/react-query';
import type { ApiOk, TutorHome } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

export const tutorHomeKey = ['home', 'tutor'] as const;

/**
 * Read on every focus of Home (the screen refetches it) and on a pull; a recorded, started or
 * stopped lesson invalidates `['home']` with the dashboard (`useTeachingInvalidation`), and so do a
 * schedule change and a cancellation.
 */
export function useTutorHome(enabled = true) {
  return useQuery({
    queryKey: tutorHomeKey,
    queryFn: () => apiClient.get<ApiOk<TutorHome>>('/home/tutor'),
    enabled,
  });
}

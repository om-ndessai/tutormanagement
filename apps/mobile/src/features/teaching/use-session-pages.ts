// The sessions list a page at a time, for a phone list that grows as it is scrolled. The web pages
// with Previous/Next over `useSessions` (api.ts, copied verbatim); this is the same request, with
// the same 25 a page, held as an infinite query. Its key starts with 'sessions', so every teaching
// invalidation in api.ts refreshes it.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ApiList, SessionTotals, TutoringSession } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

export const SESSIONS_PAGE_SIZE = 25;

/** A page of the list, with the totals over the whole filter (the same on every page). */
export interface SessionPage extends ApiList<TutoringSession> {
  totals: SessionTotals;
}

export function useSessionPages(filter: { from?: string; to?: string }, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['sessions', 'pages', filter] as const,
    queryFn: ({ pageParam }) =>
      apiClient.get<SessionPage>(
        `/sessions${toQueryString({
          from: filter.from,
          to: filter.to,
          limit: SESSIONS_PAGE_SIZE,
          offset: pageParam,
        })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < last.totals.session_count && last.data.length > 0 ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

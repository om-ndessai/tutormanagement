// The activity log a page at a time, for a phone list that grows as it is scrolled. The web pages
// with Previous/Next over `useAuditEvents` (api.ts, copied verbatim); this is the same request, 50 a
// page, held as an infinite query. Its key starts with 'audit' (`auditKeys.all`), so every
// mutation that invalidates the log refreshes it too.
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import type { ApiList, AuditEvent } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import type { ActivityFilter } from './activity-model';

export const ACTIVITY_PAGE_SIZE = 50;

export function useAuditPages(filter: ActivityFilter) {
  return useInfiniteQuery({
    queryKey: ['audit', 'pages', filter] as const,
    queryFn: ({ pageParam }) =>
      apiClient.get<ApiList<AuditEvent>>(
        `/audit${toQueryString({
          user_id: filter.user_id,
          action: filter.action,
          from: filter.from,
          to: filter.to,
          limit: ACTIVITY_PAGE_SIZE,
          offset: pageParam,
        })}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < last.meta.total && last.data.length > 0 ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
}

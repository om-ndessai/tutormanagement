// Ported from apps/web/src/features/schedules/api.ts @ 1132322
// Only the dashboard's hook so far; the rest of the file arrives with the Schedule feature (23).
import { useInfiniteQuery } from '@tanstack/react-query';
import type { UpcomingSessionsResponse } from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';

/**
 * The next dated lessons, five at a time, for the dashboard's carousel. Its
 * key starts with 'schedules', so editing a schedule refreshes it too.
 */
export function useUpcomingSessions(tutorUserId?: string) {
  return useInfiniteQuery({
    queryKey: ['schedules', 'upcoming', tutorUserId ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiClient.get<UpcomingSessionsResponse>(
        `/schedules/upcoming${toQueryString({
          offset: pageParam,
          limit: 5,
          tutor_user_id: tutorUserId,
        })}`,
      ),
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.offset + last.meta.limit : undefined),
  });
}

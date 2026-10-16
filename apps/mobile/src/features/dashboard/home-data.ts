// What Home's top reads (UI upgrades U6), all from endpoints Home already used: the schedules'
// upcoming lessons, the sessions list (today's recorded ones), and the reader's own drafts.
import { zonedClockParts, type UpcomingSession, type UpcomingSessionsResponse } from '@tmi/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient, toQueryString } from '@/lib/api-client';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { needsMoreUpcoming } from './home-model';

/** The organization's clock, re-read every half minute so the countdowns and greeting stay true. */
export function useOrgClock(): { day: string; minutesOfDay: number } {
  const timeZone = useOrgTimeZone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return zonedClockParts(now.toISOString(), timeZone);
}

/** The endpoint's own maximum page, and how many pages Home reads at most (60 lessons). */
const PAGE = 10;
const MAX_PAGES = 6;

/**
 * Upcoming lessons through `until` (inclusive), read page by page from `GET /schedules/upcoming`
 * until the horizon is covered: a busy office has more than one page today. Its key starts with
 * 'schedules', so a schedule change, a cancellation or a recorded lesson refreshes it.
 */
export function useUpcomingThrough(until: string, tutorUserId?: string) {
  return useQuery({
    queryKey: ['schedules', 'upcoming', 'through', until, tutorUserId ?? null],
    queryFn: async (): Promise<UpcomingSession[]> => {
      const items: UpcomingSession[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const response = await apiClient.get<UpcomingSessionsResponse>(
          `/schedules/upcoming${toQueryString({ offset: page * PAGE, limit: PAGE, tutor_user_id: tutorUserId })}`,
        );
        items.push(...response.data);
        if (!needsMoreUpcoming(items, response.meta.has_more, until)) break;
      }
      return items.filter((occurrence) => occurrence.occurs_on <= until);
    },
  });
}

import { useMemo } from 'react';
import { formatDay, formatDaySpan, formatInstant, readableDates, todayIn, type DayFormat, type InstantFormat } from '@tmi/shared';

import { useOrgTimeZone } from '@/providers/auth-provider';

/**
 * Phase 78 (JF35): every date on screen goes through the ONE shared formatter (`packages/shared/src/dates.ts`).
 * This hook only supplies what a component cannot know by itself -- the space's clock and today's day on it --
 * so a screen never formats a date in the browser's zone or locale, and never prints an ISO day.
 *
 * - `day('2026-11-05')` -> "Nov 5" (a calendar day: a lesson's, a plan's target);
 * - `instant(iso)` -> "Nov 5, 4:05 PM" on the space's clock (a payment, a draft saved);
 * - `span(from, to)` -> "from Sep 1 to Dec 20";
 * - `text(sentence)` -> a server sentence with its ISO days in words.
 */
export function useDates() {
  const timeZone = useOrgTimeZone();
  const today = todayIn(timeZone);
  return useMemo(
    () => ({
      timeZone,
      today,
      day: (day: string, options?: DayFormat) => formatDay(day, today, options),
      instant: (iso: string, options?: Omit<InstantFormat, 'today'>) => formatInstant(iso, timeZone, { today, ...options }),
      span: (from: string, to: string | null) => formatDaySpan(from, to, today),
      text: (sentence: string) => readableDates(sentence, today),
    }),
    [timeZone, today],
  );
}

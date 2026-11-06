// ---------------------------------------------------------------------------
// How a date reads (Phase 78, docs/journey-fixes-plan.md, JF35)
// ---------------------------------------------------------------------------
// ONE formatter for both clients and the Worker, in en-US. A CALENDAR day (YYYY-MM-DD: a lesson's
// day, a plan's target) is read as the day it names, wherever the reader is -- composed from its
// own digits, the same as a Date at UTC noon would print it, so no time zone moves it a day. An
// INSTANT (an ISO timestamp: a payment's `paid_at`, a draft saved) becomes a day and a clock time
// only on the SPACE's clock, through `zonedClockParts` -- never the device's, never UTC.
//
// Built from tables rather than `toLocaleDateString`: the same words on V8 and Hermes, and none of
// Android's per-call Intl cost (apps/mobile/src/polyfills/intl-cache.ts). `formatRelativeTime`
// ("2 minutes ago", audit.ts) stays where it is; give it one `now` per screen, so two lines say the
// same thing.

import { addDays, weekdayOf } from './schedules.js';
import { formatMinutesOfDay, zonedClockParts } from './teaching.js';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const ISO_DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export interface DayFormat {
  /** "Tue, Nov 5" rather than "Nov 5". */
  weekday?: boolean;
  /** "Today", "Tomorrow" and "Yesterday" for those three days; any other day as it would read. */
  relative?: boolean;
  /**
   * 'auto' (the default): the year only when it is not today's -- "Nov 5, 2025". 'always': "Nov 5, 2026", for a
   * record read later (a plan's dates, a report). 'never': a compact label that cannot be misread (a chart's tick).
   */
  year?: 'auto' | 'always' | 'never';
}

/**
 * A calendar day, as a person reads it: "Nov 5"; `{ weekday: true }` "Tue, Nov 5"; another year "Nov 5, 2025"
 * ("Wed, Nov 5, 2025"); `{ relative: true }` "Today", "Tomorrow", "Yesterday". `today` is the space's day
 * (`todayIn`), which decides the year and the relative words. Anything that is not a YYYY-MM-DD day comes back
 * unchanged.
 */
export function formatDay(day: string, today: string, options: DayFormat = {}): string {
  if (!ISO_DAY_SHAPE.test(day)) return day;
  if (options.relative) {
    if (day === today) return 'Today';
    if (day === addDays(today, 1)) return 'Tomorrow';
    if (day === addDays(today, -1)) return 'Yesterday';
  }
  const month = MONTH_SHORT[Number(day.slice(5, 7)) - 1];
  if (!month) return day;
  const year = options.year ?? 'auto';
  const showYear = year === 'always' || (year === 'auto' && day.slice(0, 4) !== today.slice(0, 4));
  const date = `${month} ${Number(day.slice(8, 10))}${showYear ? `, ${day.slice(0, 4)}` : ''}`;
  return options.weekday ? `${WEEKDAY_SHORT[weekdayOf(day)]}, ${date}` : date;
}

/** Today's calendar day on a space's clock (`organizations.time_zone`). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return zonedClockParts(now.toISOString(), timeZone).day;
}

export interface InstantFormat extends DayFormat {
  /** With the clock time (the default): "Nov 5, 4:05 PM". False: the day alone, "Nov 5". */
  time?: boolean;
  /** The space's day, for the year and the relative words; worked out from the clock when absent. */
  today?: string;
}

/**
 * An instant on the space's clock: "Nov 5, 4:05 PM"; `{ relative: true }` "Today, 4:05 PM"; `{ weekday: true }`
 * "Tue, Nov 5, 4:05 PM"; another year "Nov 5, 2025, 4:05 PM"; `{ time: false }` "Nov 5". An unreadable value
 * comes back unchanged.
 */
export function formatInstant(iso: string, timeZone: string, options: InstantFormat = {}): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return iso;
  const parts = zonedClockParts(iso, timeZone);
  const day = formatDay(parts.day, options.today ?? todayIn(timeZone), options);
  return options.time === false ? day : `${day}, ${formatMinutesOfDay(parts.minutesOfDay)}`;
}

/** "4:05 PM": an instant's clock time on the space's clock. */
export function formatInstantTime(iso: string, timeZone: string): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return iso;
  return formatMinutesOfDay(zonedClockParts(iso, timeZone).minutesOfDay);
}

/** The calendar day an instant fell on, on the space's clock: "2026-11-05". */
export function instantDay(iso: string, timeZone: string): string {
  return zonedClockParts(iso, timeZone).day;
}

/**
 * A run of days, as a schedule reads: "from Sep 1 to Dec 20", or "from Sep 1, ongoing" with no end. Each end as
 * `formatDay` writes it (the year only when it is not today's).
 */
export function formatDaySpan(from: string, to: string | null, today: string): string {
  return to ? `from ${formatDay(from, today)} to ${formatDay(to, today)}` : `from ${formatDay(from, today)}, ongoing`;
}

const ISO_DAY_IN_TEXT = /\b(\d{4}-\d{2}-\d{2})\b/g;

/**
 * A sentence the server wrote with calendar days in it ("the 2026-09-15 lesson with Sofia"), as a person reads it
 * ("the Sep 15 lesson with Sofia"). The API and the audit log keep the ISO form; only what is shown changes.
 */
export function readableDates(text: string, today: string): string {
  return text.replace(ISO_DAY_IN_TEXT, (day) => formatDay(day, today));
}

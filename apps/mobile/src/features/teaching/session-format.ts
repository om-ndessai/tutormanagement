// How a recorded lesson's day and times read on the phone. Both are the clock strings the lesson
// was recorded with, on the organization's clock. An INSTANT (a live lesson's limit, when a draft
// was saved) becomes a clock time only through `zonedClockParts`, on the organization's clock.
import {
  formatClockTime,
  formatMinutesOfDay,
  formatTimeRange,
  parseClockTime,
  zonedClockParts,
} from '@tmi/shared';

/** "Tue, Sep 15", with the year when it is not this one: "Mon, Dec 1, 2025". */
export function formatSessionDay(day: string, today: string): string {
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** "4:00–5:30 PM" from "16:00" and "17:30". */
export function formatSessionTimes(startedAt: string, endedAt: string): string {
  const start = parseClockTime(startedAt);
  const end = parseClockTime(endedAt);
  if (start === null || end === null) return `${formatClockTime(startedAt)}–${formatClockTime(endedAt)}`;
  return formatTimeRange(start, end);
}

/** "4:05 PM": an instant as the organization's clock reads it -- never the device's, never UTC. */
export function formatInstantClock(instant: Date | string, timeZone: string): string {
  const iso = typeof instant === 'string' ? instant : instant.toISOString();
  return formatMinutesOfDay(zonedClockParts(iso, timeZone).minutesOfDay);
}

/** "Sep 15", with the year when it is not this one: "Dec 1, 2025". A calendar date, no clock. */
export function formatPlainDay(day: string, today: string): string {
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

const ISO_DAY = /\b(\d{4}-\d{2}-\d{2})\b/g;

/**
 * A sentence the server wrote with calendar dates in it ("on the 2026-09-15 session"), as a person
 * reads it ("on the Sep 15 session", ux-audit F-24). The shared helpers and the API keep the ISO
 * form the web also uses; only the phone's call sites change.
 */
export function readableDates(text: string, today: string): string {
  return text.replace(ISO_DAY, (day) => formatPlainDay(day, today));
}

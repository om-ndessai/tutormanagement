// How a recorded lesson's day and times read on the phone. Both are the clock strings the lesson
// was recorded with, on the organization's clock, so nothing here converts an instant.
import { formatClockTime, formatTimeRange, parseClockTime } from '@tmi/shared';

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

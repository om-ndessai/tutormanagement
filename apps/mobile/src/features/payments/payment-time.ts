// When a payment moved, on the organization's clock. The web's PaymentDialog reads a
// `datetime-local` on the browser's clock and sends the instant; the phone picks a date and a
// time on the ORGANIZATION's clock (the pickers work in UTC strings, see date-time-field.tsx) and
// turns them into the instant here, so a payment entered from another zone still lands on the day
// the office means. Pure: no device zone is ever read.
import { minutesToClock, parseClockTime, zonedClockParts } from '@tmi/shared';

/** "YYYY-MM-DD" + minutes past midnight as if it were UTC, in ms: a wall clock as a number. */
function wallMs(day: string, minutes: number): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) + minutes * 60_000;
}

/**
 * The instant at which the organization's clock showed `day` and `clock` ("HH:MM"). Corrects a
 * first guess by the zone's offset twice, which settles across a daylight-saving change; a time
 * that never existed (the spring-forward hour) lands an hour later, as a clock would.
 */
export function orgClockToInstant(day: string, clock: string, timeZone: string): string {
  const minutes = parseClockTime(clock) ?? 0;
  const wanted = wallMs(day, minutes);
  let guess = wanted;
  for (let i = 0; i < 2; i += 1) {
    const shown = zonedClockParts(new Date(guess).toISOString(), timeZone);
    guess += wanted - wallMs(shown.day, shown.minutesOfDay);
  }
  return new Date(guess).toISOString();
}

/** An instant as the organization's clock showed it: the day and "HH:MM", for the pickers. */
export function instantToOrgClock(iso: string, timeZone: string): { day: string; clock: string } {
  const parts = zonedClockParts(iso, timeZone);
  return { day: parts.day, clock: minutesToClock(parts.minutesOfDay) };
}

/** Now on the organization's clock, the minutes rounded down to five (the iOS picker's step). */
export function orgNow(timeZone: string, now: Date = new Date()): { day: string; clock: string } {
  const parts = zonedClockParts(now.toISOString(), timeZone);
  return { day: parts.day, clock: minutesToClock(parts.minutesOfDay - (parts.minutesOfDay % 5)) };
}

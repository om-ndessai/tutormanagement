// A standing lesson as an event for the person's own calendar app (ux-audit F-18, #43). Pure, so it
// is tested without a device. The event says "Lesson" and when: no student, no notes, no
// cancellation note and no money (immersive-design.md §16: exported events are generic unless the
// user opts in). The place is the schedule's own.
import { firstOccurrence, parseClockTime, zonedClockParts, type ScheduledSession } from '@tmi/shared';

const MINUTE_MS = 60_000;

/**
 * The instant a wall-clock time on `day` showed in `timeZone`: the inverse of `zonedClockParts`.
 * Guess the time as if it were UTC, see what that instant reads on the organization's clock, and
 * move by the difference; a second pass settles a guess that crossed a DST change.
 */
export function zonedInstant(day: string, minutesOfDay: number, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const wanted = Date.UTC(year!, (month ?? 1) - 1, date ?? 1) + minutesOfDay * MINUTE_MS;
  let instant = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = zonedClockParts(new Date(instant).toISOString(), timeZone);
    const [y, m, d] = shown.day.split('-').map(Number);
    const read = Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + shown.minutesOfDay * MINUTE_MS;
    instant += wanted - read;
  }
  return new Date(instant);
}

export interface LessonEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  timeZone: string;
  location?: string;
  recurrenceRule: { frequency: 'weekly'; endDate?: Date };
}

/**
 * The series from its next date (or its first, if it has not begun), weekly, until its last date
 * when it has one, at its time on the organization's clock -- so a phone in another time zone
 * still puts the lesson at the hour the organization means.
 */
export function lessonEvent(
  schedule: Pick<
    ScheduledSession,
    'day_of_week' | 'start_time' | 'duration_minutes' | 'starts_on' | 'ends_on' | 'location'
  >,
  today: string,
  timeZone: string,
): LessonEvent {
  const start = parseClockTime(schedule.start_time) ?? 0;
  const from = schedule.starts_on > today ? schedule.starts_on : today;
  let first = firstOccurrence(from, schedule.day_of_week);
  if (schedule.ends_on && first > schedule.ends_on) {
    first = firstOccurrence(schedule.starts_on, schedule.day_of_week);
  }
  const startDate = zonedInstant(first, start, timeZone);
  const endDate = new Date(startDate.getTime() + schedule.duration_minutes * MINUTE_MS);
  return {
    title: 'Lesson',
    startDate,
    endDate,
    timeZone,
    ...(schedule.location ? { location: schedule.location } : {}),
    recurrenceRule: {
      frequency: 'weekly',
      ...(schedule.ends_on
        ? { endDate: zonedInstant(schedule.ends_on, start + schedule.duration_minutes, timeZone) }
        : {}),
    },
  };
}

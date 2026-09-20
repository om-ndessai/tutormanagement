import { SESSION_MODE_LABELS, firstOccurrence, parseClockTime, type ScheduledSession } from '@tmi/shared';

/** RFC 5545 weekday codes, indexed the same way as day_of_week. */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/**
 * Escapes a text value: commas, semicolons and backslashes are delimiters in
 * iCalendar, and newlines have to be written as a literal "\n".
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Folds a line to 75 octets, as the spec requires. Long descriptions and URLs
 * are otherwise silently mangled by some clients.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);

  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }

  if (rest) parts.push(` ${rest}`);
  return parts.join('\r\n');
}

/** "2026-09-08" + "16:00" -> "20260908T160000" (floating local time). */
function localStamp(date: string, time: string): string {
  const minutes = parseClockTime(time) ?? 0;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    date.replace(/-/g, '') +
    'T' +
    pad(Math.floor(minutes / 60)) +
    pad(minutes % 60) +
    '00'
  );
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/**
 * One VEVENT per schedule, with a weekly RRULE.
 *
 * Times are written as FLOATING local values -- no trailing Z, no TZID. A
 * lesson is "Tuesday at four" wherever the reader is, and the portal stores
 * wall-clock times for exactly that reason. Attaching a timezone would mean
 * shipping a VTIMEZONE block and getting DST transitions right, to express
 * something the institute does not actually mean.
 */
function toEvent(schedule: ScheduledSession, now: Date): string[] {
  const start = firstOccurrence(schedule.starts_on, schedule.day_of_week);
  const startMinutes = parseClockTime(schedule.start_time) ?? 0;
  const endMinutes = startMinutes + schedule.duration_minutes;

  // A lesson running past midnight would need the end on the following day;
  // clamping keeps the event inside its own day, which is what a 15-minute to
  // 8-hour lesson always is in practice.
  const endTime = `${String(Math.min(23, Math.floor(endMinutes / 60))).padStart(2, '0')}:${String(
    endMinutes % 60,
  ).padStart(2, '0')}`;

  const rrule = [`FREQ=WEEKLY`, `BYDAY=${BYDAY[schedule.day_of_week]}`];

  if (schedule.ends_on) {
    // UNTIL is inclusive; end of that day in floating terms.
    rrule.push(`UNTIL=${schedule.ends_on.replace(/-/g, '')}T235900`);
  }

  const description = [
    `${SESSION_MODE_LABELS[schedule.mode]} tutoring session.`,
    schedule.notes,
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
    'BEGIN:VEVENT',
    // Stable per schedule, so re-downloading updates the event rather than
    // creating a duplicate.
    `UID:schedule-${schedule.id}@trianglemathinstitute.com`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(start, schedule.start_time)}`,
    `DTEND:${localStamp(start, endTime)}`,
    `RRULE:${rrule.join(';')}`,
    `SUMMARY:${escapeText(`Math tutoring: ${schedule.student_name} with ${schedule.tutor_name}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];

  if (schedule.location) lines.push(`LOCATION:${escapeText(schedule.location)}`);

  lines.push('END:VEVENT');
  return lines;
}

/** A complete .ics document for one or more standing lessons. */
export function buildCalendar(schedules: ScheduledSession[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mathematics Institute of the Triangle//TMI Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...schedules.flatMap((schedule) => toEvent(schedule, now)),
    'END:VCALENDAR',
  ];

  // CRLF line endings are required; some clients reject LF-only files.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A filename that says what the download contains. */
export function calendarFilename(schedules: ScheduledSession[]): string {
  if (schedules.length === 1) {
    const only = schedules[0]!;
    const slug = only.student_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `tmi-tutoring-${slug}.ics`;
  }

  return 'tmi-tutoring-schedule.ics';
}

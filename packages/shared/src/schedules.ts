import { z } from 'zod';
import { DAYS_OF_WEEK } from './profiles.js';
import {
  SESSION_MODES,
  formatDuration,
  formatTimeRange,
  minutesToClock,
  parseClockTime,
  zonedClockParts,
  type SessionMode,
} from './teaching.js';
import { optionalText } from './users.js';

/**
 * A standing weekly lesson. Distinct from a `session`, which records one that
 * actually happened: a schedule says "every Tuesday at four", and whether any
 * particular Tuesday went ahead is a separate fact.
 */
export interface ScheduledSession {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  mode: SessionMode;
  starts_on: string;
  ends_on: string | null;
  location: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-20.');

const clockTime = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, 'Use a time like 16:00.')
  .refine((value) => parseClockTime(value) !== null, 'That is not a real time.');

export const scheduleInputSchema = z
  .object({
    tutor_user_id: z.uuid(),
    student_user_id: z.uuid(),
    day_of_week: z.number().int().min(0).max(6),
    start_time: clockTime,
    /** Quarter-hour multiples, matching how sessions are billed. */
    duration_minutes: z
      .number()
      .int()
      .min(15)
      .max(8 * 60)
      .refine((value) => value % 15 === 0, 'Use a multiple of 15 minutes.'),
    mode: z.enum(SESSION_MODES).default('in_person'),
    starts_on: isoDate,
    /** Null means open-ended. */
    ends_on: z.union([isoDate, z.literal('')]).nullish().transform((v) => (v ? v : null)),
    location: optionalText(z.string().trim().max(300)),
    notes: optionalText(z.string().trim().max(1000)),
  })
  .refine((value) => !value.ends_on || value.ends_on >= value.starts_on, {
    message: 'The end date cannot be before the start date.',
    path: ['ends_on'],
  });

export type SchedulePayload = z.output<typeof scheduleInputSchema>;

export const scheduleUpdateSchema = z
  .object({
    day_of_week: z.number().int().min(0).max(6).optional(),
    start_time: clockTime.optional(),
    duration_minutes: z.number().int().min(15).max(8 * 60).optional(),
    mode: z.enum(SESSION_MODES).optional(),
    starts_on: isoDate.optional(),
    ends_on: z.union([isoDate, z.literal('')]).nullish().transform((v) => (v ? v : null)),
    location: optionalText(z.string().trim().max(300)),
    notes: optionalText(z.string().trim().max(1000)),
    is_active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type ScheduleUpdatePayload = z.output<typeof scheduleUpdateSchema>;

export const listSchedulesQuerySchema = z.object({
  tutor_user_id: z.uuid().optional(),
  student_user_id: z.uuid().optional(),
  include_inactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type ListSchedulesParams = z.output<typeof listSchedulesQuerySchema>;

/** "Tuesdays 4:00–5:00 PM · 1 hr" */
export function describeSchedule(schedule: ScheduledSession): string {
  const day = DAYS_OF_WEEK[schedule.day_of_week]?.label ?? '?';
  const start = parseClockTime(schedule.start_time) ?? 0;

  return (
    `${day}s ${formatTimeRange(start, start + schedule.duration_minutes)}` +
    ` · ${formatDuration(schedule.duration_minutes)}`
  );
}

/** The first date on or after `startsOn` that falls on `dayOfWeek`. */
export function firstOccurrence(startsOn: string, dayOfWeek: number): string {
  const [year, month, day] = startsOn.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));

  const shift = (dayOfWeek - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + shift);

  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Upcoming lessons (Phase 21)
// ---------------------------------------------------------------------------

/**
 * One dated lesson a schedule says is coming up. Derived, never stored: a
 * schedule is "every Tuesday at four", and this is "Tuesday the 30th at four".
 * It carries no money -- it is shown on the Tutoring half of the dashboard.
 */
export interface UpcomingSession {
  schedule_id: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  mode: SessionMode;
  location: string | null;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
}

export const upcomingSessionsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(500).default(0),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  /** Only lessons this tutor teaches: a tutor's dashboard, or an admin viewing it. */
  tutor_user_id: z.uuid().optional(),
});

export type UpcomingSessionsParams = z.output<typeof upcomingSessionsQuerySchema>;

/**
 * The list envelope, with `has_more` in place of a total: an open-ended
 * schedule has no last lesson to count up to.
 */
export interface UpcomingSessionsResponse {
  data: UpcomingSession[];
  meta: { offset: number; limit: number; has_more: boolean };
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return value.toISOString().slice(0, 10);
}

/** The key `expandUpcoming` matches recorded lessons on. */
export function upcomingTakenKey(tutorId: string, studentId: string, date: string): string {
  return `${tutorId}|${studentId}|${date}`;
}

/**
 * The next lessons the given schedules produce, soonest first.
 *
 * "Now" is read on the institute's clock (zonedClockParts), never from UTC
 * parts: a lesson at 8pm on a Tuesday is still Tuesday's lesson. Today's
 * occurrence counts until it has ENDED, so a lesson under way is still listed.
 * An occurrence already recorded as a session -- the same tutor and student
 * on that day, in `taken` -- is left out: it is in the past cards instead.
 *
 * Each schedule contributes at most `offset + limit + 1` occurrences, which is
 * all a page can need, so a long-running schedule costs nothing extra.
 */
export function expandUpcoming(
  schedules: ScheduledSession[],
  nowIso: string,
  options: { offset: number; limit: number; taken?: ReadonlySet<string> },
): { items: UpcomingSession[]; has_more: boolean } {
  const { day: today, minutesOfDay: nowMinutes } = zonedClockParts(nowIso);
  const wanted = options.offset + options.limit + 1;
  const all: UpcomingSession[] = [];

  for (const schedule of schedules) {
    if (!schedule.is_active) continue;

    const start = parseClockTime(schedule.start_time);
    if (start === null) continue;
    const end = start + schedule.duration_minutes;

    let date = firstOccurrence(
      schedule.starts_on > today ? schedule.starts_on : today,
      schedule.day_of_week,
    );
    let found = 0;

    // The guard bounds the walk even if every week were already recorded.
    for (let guard = 0; found < wanted && guard < wanted + 104; guard += 1, date = addDays(date, 7)) {
      if (schedule.ends_on && date > schedule.ends_on) break;
      if (date === today && end <= nowMinutes) continue;
      if (options.taken?.has(upcomingTakenKey(schedule.tutor_user_id, schedule.student_user_id, date))) {
        continue;
      }

      all.push({
        schedule_id: schedule.id,
        occurs_on: date,
        start_time: schedule.start_time,
        end_time: minutesToClock(end),
        duration_minutes: schedule.duration_minutes,
        mode: schedule.mode,
        location: schedule.location,
        tutor_user_id: schedule.tutor_user_id,
        tutor_name: schedule.tutor_name,
        student_user_id: schedule.student_user_id,
        student_name: schedule.student_name,
      });
      found += 1;
    }
  }

  all.sort(
    (a, b) =>
      a.occurs_on.localeCompare(b.occurs_on) ||
      (parseClockTime(a.start_time) ?? 0) - (parseClockTime(b.start_time) ?? 0) ||
      a.student_name.localeCompare(b.student_name),
  );

  return {
    items: all.slice(options.offset, options.offset + options.limit),
    has_more: all.length > options.offset + options.limit,
  };
}

import { z } from 'zod';
import { DAYS_OF_WEEK } from './profiles.js';
import { SESSION_MODES, formatDuration, parseClockTime, type SessionMode } from './teaching.js';
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

/** "Tuesdays 16:00–17:00 · 1 hr" */
export function describeSchedule(schedule: ScheduledSession): string {
  const day = DAYS_OF_WEEK[schedule.day_of_week]?.label ?? '?';
  const start = parseClockTime(schedule.start_time) ?? 0;
  const end = start + schedule.duration_minutes;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${day}s ${schedule.start_time}–${pad(Math.floor(end / 60))}:${pad(end % 60)}` +
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

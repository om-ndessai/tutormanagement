import { z } from 'zod';
import { optionalText } from './users.js';

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
// Everything monetary is whole cents in an integer. Floating point dollars
// accumulate rounding error, and these numbers drive what families are billed
// and what tutors are paid.

export const centsSchema = z
  .number()
  .int('Amount must be a whole number of cents.')
  .min(0, 'Amount cannot be negative.')
  .max(100_000_00, 'Amount looks too large.');

/** "$75.00" */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '—';

  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
  });
}

/** Parses "75", "$75", "75.50" into cents. Returns null for blank input. */
export function parseCentsInput(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return null;

  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) return null;

  return Math.round(dollars * 100);
}

/** Cents as a plain editable number, e.g. 7500 -> "75.00". */
export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Session duration
// ---------------------------------------------------------------------------

export const QUARTER_HOUR = 15;

/** "16:45" -> 1005 minutes past midnight. */
export function parseClockTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * The institute bills in quarter hours, so elapsed time is quantised before it
 * is priced.
 *
 * Rounds to the NEAREST quarter rather than up or down: rounding up
 * systematically overcharges families, rounding down systematically
 * underpays tutors. A session is never billed at zero -- anything that
 * happened is worth at least fifteen minutes.
 */
export function roundToQuarterHour(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(QUARTER_HOUR, Math.round(minutes / QUARTER_HOUR) * QUARTER_HOUR);
}

/** Minutes past midnight back to "HH:MM". */
export function minutesToClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

/**
 * Times are STORED as 24-hour "HH:MM" because that sorts correctly as text and
 * is unambiguous, and DISPLAYED as 12-hour with AM/PM because that is how the
 * institute talks about lessons. Everything below is the display half; nothing
 * here should ever be written back to the database.
 */
function periodOf(minutes: number): 'AM' | 'PM' {
  return Math.floor(minutes / 60) % 24 < 12 ? 'AM' : 'PM';
}

/** 960 -> "4:00 PM". Midnight and noon come out as 12, not 0. */
export function formatMinutesOfDay(minutes: number, omitPeriod = false): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const clock = `${hours12}:${String(total % 60).padStart(2, '0')}`;

  return omitPeriod ? clock : `${clock} ${periodOf(total)}`;
}

/** "16:00" -> "4:00 PM". Returns the input unchanged if it is not a time. */
export function formatClockTime(value: string): string {
  const minutes = parseClockTime(value);
  return minutes === null ? value : formatMinutesOfDay(minutes);
}

/**
 * "4:00-5:30 PM", or "11:00 AM - 1:00 PM" when the range crosses midday.
 *
 * The period is printed once when both ends share it, which is the common case
 * for a lesson and reads far better in a list of them.
 */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  const sharesPeriod = periodOf(startMinutes) === periodOf(endMinutes);
  // "4:00-5:00 PM" stays tight; "11:00 AM - 1:00 PM" needs room to breathe.
  const dash = sharesPeriod ? '–' : ' – ';

  return `${formatMinutesOfDay(startMinutes, sharesPeriod)}${dash}${formatMinutesOfDay(endMinutes)}`;
}

/**
 * A compact hour label for a dense grid: "7a", "12p", "9p".
 *
 * The availability picker shows fifteen columns across; "7:00 AM" in each
 * would not fit, and a bare "7" cannot tell morning from evening.
 */
export function formatHourShort(hour: number): string {
  const hours24 = ((hour % 24) + 24) % 24;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}${hours24 < 12 ? 'a' : 'p'}`;
}

/**
 * Snaps a wall-clock time to the nearest quarter hour.
 *
 * Distinct from roundToQuarterHour, which rounds a DURATION. A live session
 * rounds each endpoint as it is pressed -- "the start time will be nearest
 * 15 min ... it will again record session end to nearest 15 min" -- so the
 * duration falls out as a multiple of 15 rather than being rounded itself.
 *
 * Clamped to 23:45 so a late-evening start cannot roll past midnight and make
 * the session appear to end before it began.
 */
export function roundClockToQuarter(minutesOfDay: number): number {
  const rounded = Math.round(minutesOfDay / QUARTER_HOUR) * QUARTER_HOUR;
  return Math.max(0, Math.min(23 * 60 + 45, rounded));
}

/** Elapsed minutes between two HH:MM times, or null if either is unreadable. */
export function elapsedMinutes(startedAt: string, endedAt: string): number | null {
  const start = parseClockTime(startedAt);
  const end = parseClockTime(endedAt);

  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/** "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

/** What a session costs: the hourly rate, pro-rated over the billed minutes. */
export function computeAmountCents(durationMinutes: number, rateCents: number): number {
  return Math.round((rateCents * durationMinutes) / 60);
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export const SESSION_MODES = ['in_person', 'virtual'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
};

/** Optional money field: "" from a form means "no override". */
const optionalCents = z
  .union([centsSchema, z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value == null ? null : (value as number)));

export const assignmentInputSchema = z.object({
  tutor_user_id: z.uuid(),
  student_user_id: z.uuid(),
  /** NULL means "use the tutor's default for that mode". */
  rate_in_person_cents: optionalCents,
  rate_virtual_cents: optionalCents,
  is_active: z.boolean().default(true),
  notes: optionalText(z.string().trim().max(500)),
});

export type AssignmentInput = z.input<typeof assignmentInputSchema>;
export type AssignmentPayload = z.output<typeof assignmentInputSchema>;

export const assignmentUpdateSchema = assignmentInputSchema
  .omit({ tutor_user_id: true, student_user_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type AssignmentUpdatePayload = z.output<typeof assignmentUpdateSchema>;

/** An assignment with both people resolved, as the API returns it. */
export interface Assignment {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  rate_in_person_cents: number | null;
  rate_virtual_cents: number | null;
  /** The rates that actually apply, after falling back to the tutor's defaults. */
  effective_rate_in_person_cents: number | null;
  effective_rate_virtual_cents: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Rate resolution, in one place so the API and the UI preview cannot disagree:
 * a per-pair override wins, otherwise the tutor's default for that mode.
 */
export function resolveRateCents(
  mode: SessionMode,
  override: { in_person: number | null; virtual: number | null },
  tutorDefault: { in_person: number | null; virtual: number | null },
): number | null {
  const pick = mode === 'virtual' ? 'virtual' : 'in_person';
  return override[pick] ?? tutorDefault[pick];
}

export const listAssignmentsQuerySchema = z.object({
  tutor_user_id: z.uuid().optional(),
  student_user_id: z.uuid().optional(),
  include_inactive: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type ListAssignmentsParams = z.output<typeof listAssignmentsQuerySchema>;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-20.');

const clockTime = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/, 'Use a time like 16:30.')
  .refine((value) => parseClockTime(value) !== null, 'That is not a real time.');

/**
 * What the tutor submits. Note what is NOT here: duration and amount. Those are
 * derived on the server from the times and the assignment's rate, so a client
 * cannot bill whatever it likes.
 */
export const sessionInputSchema = z
  .object({
    tutor_user_id: z.uuid(),
    student_user_id: z.uuid(),
    occurred_on: isoDate,
    started_at: clockTime,
    ended_at: clockTime,
    mode: z.enum(SESSION_MODES),
    notes: optionalText(z.string().trim().max(4000)),
  })
  .refine((value) => elapsedMinutes(value.started_at, value.ended_at) !== null, {
    message: 'The end time must be after the start time.',
    path: ['ended_at'],
  });

export type SessionInput = z.input<typeof sessionInputSchema>;
export type SessionPayload = z.output<typeof sessionInputSchema>;

export const sessionUpdateSchema = z
  .object({
    occurred_on: isoDate.optional(),
    started_at: clockTime.optional(),
    ended_at: clockTime.optional(),
    mode: z.enum(SESSION_MODES).optional(),
    notes: optionalText(z.string().trim().max(4000)),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type SessionUpdatePayload = z.output<typeof sessionUpdateSchema>;

export interface TutoringSession {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  occurred_on: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  mode: SessionMode;
  rate_cents: number;
  amount_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const listSessionsQuerySchema = z.object({
  tutor_user_id: z.uuid().optional(),
  student_user_id: z.uuid().optional(),
  /** Inclusive date bounds, YYYY-MM-DD. */
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListSessionsParams = z.output<typeof listSessionsQuerySchema>;

/** Totals that accompany a session list, so the UI need not re-add them. */
export interface SessionTotals {
  session_count: number;
  total_minutes: number;
  total_amount_cents: number;
}

// ---------------------------------------------------------------------------
// Live sessions (Phase 7)
// ---------------------------------------------------------------------------

/**
 * A lesson currently being taught.
 *
 * Kept in its own table rather than as a half-filled `sessions` row: a session
 * is the billing record, and every column it has must be true of it. An
 * in-progress lesson has no end, no duration and no amount, so it is a
 * different thing until it finishes.
 */
export interface ActiveSession {
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  mode: SessionMode;
  /** The real instant the tutor pressed start, not the rounded value. */
  started_at: string;
  /** What the start time will be recorded as, already snapped to a quarter. */
  rounded_start: string;
  occurred_on: string;
  notes: string | null;
  /** The rate that will apply, resolved from the assignment at start time. */
  rate_cents: number | null;
}

export const startSessionSchema = z.object({
  student_user_id: z.uuid(),
  mode: z.enum(SESSION_MODES).default('in_person'),
});

export type StartSessionPayload = z.output<typeof startSessionSchema>;

/** Notes may be written during the lesson or left until after it. */
export const updateActiveSessionSchema = z
  .object({
    mode: z.enum(SESSION_MODES).optional(),
    notes: optionalText(z.string().trim().max(4000)),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type UpdateActiveSessionPayload = z.output<typeof updateActiveSessionSchema>;

export const stopSessionSchema = z.object({
  notes: optionalText(z.string().trim().max(4000)),
});

export type StopSessionPayload = z.output<typeof stopSessionSchema>;

/** Elapsed wall-clock time so far, for the ticking display. */
export function elapsedSince(startedAtIso: string, now: Date = new Date()): number {
  const started = new Date(startedAtIso).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((now.getTime() - started) / 1000));
}

/** "1:04:37" */
export function formatStopwatch(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

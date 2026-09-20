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

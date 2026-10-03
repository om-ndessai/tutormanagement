import { z } from 'zod';
import { addDays } from './schedules.js';
import { centsSchema } from './teaching.js';
import { optionalText } from './users.js';

/**
 * "The payment form need to be supported are venmo, zelle, cash, check."
 *
 * Distinct from PAYMENT_METHODS in profiles.ts, which is the narrower set of
 * services a person can register a handle for -- nobody has a "cash id".
 */
export const PAYMENT_FORMS = ['zelle', 'venmo', 'cash', 'check'] as const;
export type PaymentForm = (typeof PAYMENT_FORMS)[number];

export const PAYMENT_FORM_LABELS: Record<PaymentForm, string> = {
  zelle: 'Zelle',
  venmo: 'Venmo',
  cash: 'Cash',
  check: 'Check',
};

/** Which way the money went. */
export const PAYMENT_DIRECTIONS = ['from_parent', 'to_tutor'] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export const PAYMENT_DIRECTION_LABELS: Record<PaymentDirection, string> = {
  from_parent: 'Received from parent',
  to_tutor: 'Paid to tutor',
};

export interface Payment {
  id: string;
  direction: PaymentDirection;
  party_user_id: string;
  party_name: string;
  student_user_id: string | null;
  student_name: string | null;
  amount_cents: number;
  method: PaymentForm;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const paymentInputSchema = z
  .object({
    direction: z.enum(PAYMENT_DIRECTIONS),
    /** The parent who paid, or the tutor who was paid. */
    party_user_id: z.uuid(),
    /** Required for a parent payment; ignored for a payment to a tutor. */
    student_user_id: z.uuid().nullish(),
    amount_cents: centsSchema.min(1, 'Enter an amount.'),
    method: z.enum(PAYMENT_FORMS),
    /** When the money actually moved. */
    paid_at: z.string().min(1, 'Enter when it was paid.'),
    reference: optionalText(z.string().trim().max(80)),
    notes: optionalText(z.string().trim().max(1000)),
  })
  .refine((value) => value.direction !== 'from_parent' || Boolean(value.student_user_id), {
    // Mirrors the CHECK constraint: a family payment with no student would
    // belong to no balance at all.
    message: 'Choose which student this payment is for.',
    path: ['student_user_id'],
  });

export type PaymentInput = z.input<typeof paymentInputSchema>;
export type PaymentPayload = z.output<typeof paymentInputSchema>;

export const paymentUpdateSchema = z
  .object({
    amount_cents: centsSchema.min(1).optional(),
    method: z.enum(PAYMENT_FORMS).optional(),
    paid_at: z.string().min(1).optional(),
    reference: optionalText(z.string().trim().max(80)),
    notes: optionalText(z.string().trim().max(1000)),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type PaymentUpdatePayload = z.output<typeof paymentUpdateSchema>;

export const monthlyFinanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  /**
   * Admin only: the rundown as this person sees it, for "view as". Anyone
   * else naming somebody other than themselves is refused.
   */
  user_id: z.uuid().optional(),
});

export const listPaymentsQuerySchema = z.object({
  direction: z.enum(PAYMENT_DIRECTIONS).optional(),
  party_user_id: z.uuid().optional(),
  student_user_id: z.uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPaymentsParams = z.output<typeof listPaymentsQuerySchema>;

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

/**
 * What a tutor has earned and been paid.
 *
 * `balance_cents` is what the institute still owes them: positive means
 * outstanding, negative means they were overpaid.
 */
export interface TutorBalance {
  user_id: string;
  full_name: string;
  earned_cents: number;
  paid_cents: number;
  balance_cents: number;
  session_count: number;
  /**
   * The level the institute keeps this tutor's advance above, or null when
   * they are not on an advance. Null also for a viewer not entitled to see it:
   * a tutor's arrangement is theirs and the admin's, nobody else's.
   */
  topup_amount_cents: number | null;
}

/**
 * What the tutor is holding right now: money paid to them that they have not
 * yet worked off.
 *
 * The mirror image of `balance_cents`, and the figure the top-up arrangement
 * is about. Positive means they hold the institute's money; negative means
 * they have taught more than they have been paid for, so the institute owes
 * them and no top-up would fix that -- a payment is simply due.
 */
export function tutorAdvanceCents(balance: Pick<TutorBalance, 'earned_cents' | 'paid_cents'>) {
  return balance.paid_cents - balance.earned_cents;
}

/**
 * What to pay now to restore the floor, or null when the tutor is not on an
 * advance.
 *
 * Zero when the advance is still above the threshold -- the office does
 * nothing -- and otherwise exactly the shortfall, so paying it puts the tutor
 * back AT the agreed level rather than at a round number somebody guessed.
 */
export function topupDueCents(
  balance: Pick<TutorBalance, 'earned_cents' | 'paid_cents' | 'topup_amount_cents'>,
): number | null {
  if (balance.topup_amount_cents == null) return null;
  return Math.max(0, balance.topup_amount_cents - tutorAdvanceCents(balance));
}

/** Whether this tutor is due a top-up at all. */
export function needsTopup(
  balance: Pick<TutorBalance, 'earned_cents' | 'paid_cents' | 'topup_amount_cents'>,
): boolean {
  const due = topupDueCents(balance);
  return due !== null && due > 0;
}

// ---------------------------------------------------------------------------
// When each tutor next needs paying (the admin's Tutor payments panel)
// ---------------------------------------------------------------------------

/** How far ahead the next top-up is looked for: half a year of lessons. */
export const TOPUP_PROJECTION_WEEKS = 26;

/** A payment falling due within this many days is flagged as coming up. */
export const PAYMENT_SOON_DAYS = 7;

/**
 * How pressing a tutor's next payment is, worst first:
 *
 *   past_due  - on an advance and already below its top-up level
 *   due_soon  - due within PAYMENT_SOON_DAYS, or owed for lessons taught by
 *               a tutor who is paid after the work rather than before it
 *   on_track  - nothing to pay this week
 */
export const TUTOR_PAYMENT_URGENCIES = ['past_due', 'due_soon', 'on_track'] as const;
export type TutorPaymentUrgency = (typeof TUTOR_PAYMENT_URGENCIES)[number];

/**
 * A tutor's balance with what the office needs to plan the next payment.
 * Admin only: it is built from the tutor's advance arrangement.
 */
export interface TutorPaymentOutlook extends TutorBalance {
  /** The most recent payment to this tutor, or null if they have never been paid. */
  last_paid_cents: number | null;
  /** When that payment moved: an instant, like `paid_at`. */
  last_paid_at: string | null;
  /**
   * The day the lessons on their schedule are projected to take their advance
   * below its top-up level, which is when the next top-up falls due. Null when
   * it already has (they are past due), when they are not on an advance, or
   * when no lesson in the next TOPUP_PROJECTION_WEEKS weeks gets there.
   * Derived on every read, never stored, like the lessons it comes from.
   */
  next_topup_on: string | null;
  /** Lessons scheduled within that window, so "not in sight" can say why. */
  scheduled_lessons: number;
  urgency: TutorPaymentUrgency;
}

/**
 * The first day on which upcoming lessons take a tutor's advance below its
 * top-up level -- when the office will next have to top them up.
 *
 * `lessons` are in date order, each with what the tutor will earn for it.
 * "Below" is strictly below, as in `needsTopup`: a tutor holding exactly
 * their level is not yet due. Null when they are not on an advance, when they
 * are below it already (that is past due, not a date), or when these lessons
 * never get them there.
 */
export function projectTopupDate(
  balance: Pick<TutorBalance, 'earned_cents' | 'paid_cents' | 'topup_amount_cents'>,
  lessons: readonly { occurs_on: string; pay_cents: number }[],
): string | null {
  const topup = balance.topup_amount_cents;
  if (topup == null) return null;

  let held = tutorAdvanceCents(balance);
  if (held < topup) return null;

  for (const lesson of lessons) {
    held -= lesson.pay_cents;
    if (held < topup) return lesson.occurs_on;
  }

  return null;
}

/**
 * Which colour a tutor's row is. `today` is the institute's date
 * (zonedClockParts), and a top-up projected on or before a week from it is
 * due soon.
 *
 * A tutor who is not on an advance has no level to fall below, so they are
 * never past due; money owed to them for lessons already taught is a payment
 * waiting to be made, which is what due soon means.
 */
export function tutorPaymentUrgency(
  balance: Pick<TutorBalance, 'earned_cents' | 'paid_cents' | 'balance_cents' | 'topup_amount_cents'>,
  nextTopupOn: string | null,
  today: string,
): TutorPaymentUrgency {
  if (balance.topup_amount_cents == null) {
    return balance.balance_cents > 0 ? 'due_soon' : 'on_track';
  }

  if (needsTopup(balance)) return 'past_due';
  if (nextTopupOn !== null && nextTopupOn <= addDays(today, PAYMENT_SOON_DAYS)) return 'due_soon';
  return 'on_track';
}

/**
 * What a family has been charged and has paid.
 *
 * Keyed on the STUDENT rather than the parent, because charges arise from a
 * student's lessons and a student may have two guardians who both pay.
 */
export interface StudentBalance {
  student_user_id: string;
  student_name: string;
  /** Everyone responsible for this student, for "who do we chase". */
  guardians: { user_id: string; full_name: string; is_primary: boolean }[];
  charged_cents: number;
  paid_cents: number;
  balance_cents: number;
  session_count: number;
}

export interface BalancesResponse {
  tutors: TutorBalance[];
  students: StudentBalance[];
  totals: {
    owed_to_tutors_cents: number;
    owed_by_families_cents: number;
    /**
     * What it would cost to bring every tutor on an advance back up to their
     * agreed level. Null for a viewer who is not an admin: it is a figure
     * about the institute, not about them.
     */
    topups_due_cents: number | null;
  };
}

// ---------------------------------------------------------------------------
// The monthly rundown
// ---------------------------------------------------------------------------

/**
 * One month of the financial year.
 *
 * The family side is present only for an admin: a tutor may never see what a
 * family was billed, which is the same rule scopeSessionMoney applies row by
 * row. Their own figures are always here, so a tutor's rundown is their
 * teaching and their pay and nothing about anybody's margin.
 */
export interface MonthlyFinanceRow {
  /** YYYY-MM. */
  month: string;
  session_count: number;
  /** Time taught, in minutes, so the UI can round as it likes. */
  minutes: number;
  /** What families were billed for lessons taught that month. Admin only. */
  billed_cents: number | null;
  /** Money that came IN from families that month. Admin only. */
  received_from_families_cents: number | null;
  /** What tutors earned teaching that month -- for a tutor, their own. */
  earned_cents: number;
  /** Money that went OUT to tutors that month -- for a tutor, their own. */
  paid_to_tutors_cents: number;
}

export interface MonthlyFinanceResponse {
  year: number;
  /** 'institute' for an admin, 'tutor' for their own figures. */
  scope: 'institute' | 'tutor';
  months: MonthlyFinanceRow[];
}

/**
 * What the institute kept on the lessons taught that month: billed minus what
 * the tutors earned for them.
 *
 * Both figures are about the same lessons, so this is the margin earned in the
 * month rather than the cash that moved -- the two differ whenever a family
 * pays late, which is most of the time. Null for anyone not entitled to the
 * billed side.
 */
export function monthlyNetCents(row: MonthlyFinanceRow): number | null {
  return row.billed_cents === null ? null : row.billed_cents - row.earned_cents;
}

/** "Mar" for 2026-03, on the reader's own clock-free calendar. */
export function formatMonthShort(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][index] ?? month;
}

import { z } from 'zod';
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
  };
}

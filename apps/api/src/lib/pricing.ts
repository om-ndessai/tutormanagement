import {
  computeAmountCents,
  elapsedMinutes,
  missingRateMessage,
  resolveChargeRateCents,
  resolveRateCents,
  roundToQuarterHour,
  type Assignment,
  type SessionMode,
  type User,
} from '@tmi/shared';

import { ApiError } from './errors.js';
import { isAdmin } from './scope.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import { getStudentChargeRates } from '../repositories/users.js';
import type { OrgId } from './org.js';

/**
 * The two rates a lesson is written with.
 *
 * Kept apart from the route that records one because the same resolution runs
 * for a lesson a tutor types in, a lesson they stop, and a lesson the sweep
 * closes on their behalf -- and those must price identically.
 */
export interface SessionRates {
  tutorRateCents: number;
  chargeRateCents: number;
  /** Phase 54: the space has no organization now, so the family pays the tutor one price. */
  paidDirectly: boolean;
}

/**
 * Phase 54: whether the space is paid directly at this moment -- no organization
 * runs its money. Read at recording time on every path (typed, live, the sweep,
 * a draft posted), so a switch applies going forward and recorded lessons keep
 * the model they were recorded under.
 */
export async function spacePaidDirectly(db: D1Database, org: OrgId): Promise<boolean> {
  const row = await db
    .prepare('SELECT business_id FROM organizations WHERE id = ?')
    .bind(org)
    .first<{ business_id: string | null }>();
  return !row?.business_id;
}

/** Who is told a lesson cannot be priced, which decides the words (Phase 75, JF18). */
export interface PricingOptions {
  /** The person recording, starting or stopping: a tutor is told whom to ask, the office what is missing. */
  reader?: User | null;
  /** The live pairing, when the caller has read it already. */
  assignment?: Assignment | null;
}

/**
 * Both halves matter: a tutor can only bill for a student who was actually
 * assigned to them, and the rate comes from the assignment (or the tutor's
 * default) rather than from anything the client sent.
 *
 * Phase 75 (JF18): the same rule refuses at Start, before a lesson that could
 * not be recorded is under way, and every refusal's MESSAGE is in the reader's
 * words (`missingRateMessage`), the `mode` detail saying the same -- an older
 * app shows only the message.
 */
export async function resolveSessionRates(
  db: D1Database,
  org: OrgId,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
  options: PricingOptions = {},
): Promise<SessionRates> {
  // This organization's pairing and this organization's prices: the same two
  // people paired elsewhere authorise and price nothing here.
  const assignment = options.assignment ?? (await getActiveAssignmentFor(db, org, tutorUserId, studentUserId));

  if (!assignment) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['That student is not currently assigned to this tutor.'],
    });
  }

  const refuse = (missing: 'price' | 'pay_rate') => {
    const message = missingRateMessage({
      missing,
      mode,
      reader: options.reader && !isAdmin(options.reader) ? 'tutor' : 'office',
      student_name: assignment.student_name,
      tutor_name: assignment.tutor_name,
    });
    return ApiError.validation(message, { mode: [message] });
  };

  // What the tutor is paid: the pairing's override, else the tutor's default.
  const tutorRateCents = resolveRateCents(
    mode,
    { in_person: assignment.rate_in_person_cents, virtual: assignment.rate_virtual_cents },
    {
      in_person: assignment.effective_rate_in_person_cents,
      virtual: assignment.effective_rate_virtual_cents,
    },
  );

  if (tutorRateCents == null) throw refuse('pay_rate');

  // Phase 54: paid directly, the pairing's rate IS the price -- what the family
  // pays the tutor. The student's price belongs to the organization model.
  if (await spacePaidDirectly(db, org)) {
    return { tutorRateCents, chargeRateCents: tutorRateCents, paidDirectly: true };
  }

  // What the family is charged. Priced on the student, so it does not depend
  // on who teaches them.
  const studentRates = await getStudentChargeRates(db, org, studentUserId);
  const chargeRateCents = studentRates && resolveChargeRateCents(mode, studentRates);

  if (chargeRateCents == null) throw refuse('price');

  return { tutorRateCents, chargeRateCents, paidDirectly: false };
}

/** Rates plus the money they produce over a typed-in pair of clock times. */
export async function priceSession(
  db: D1Database,
  org: OrgId,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
  startedAt: string,
  endedAt: string,
  options: PricingOptions = {},
) {
  const { tutorRateCents, chargeRateCents, paidDirectly } = await resolveSessionRates(
    db,
    org,
    tutorUserId,
    studentUserId,
    mode,
    options,
  );

  const elapsed = elapsedMinutes(startedAt, endedAt);
  if (elapsed === null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      ended_at: ['The end time must be after the start time.'],
    });
  }

  const durationMinutes = roundToQuarterHour(elapsed);

  return {
    durationMinutes,
    paidDirectly,
    tutorRateCents,
    chargeRateCents,
    tutorAmountCents: computeAmountCents(durationMinutes, tutorRateCents),
    chargeAmountCents: computeAmountCents(durationMinutes, chargeRateCents),
  };
}

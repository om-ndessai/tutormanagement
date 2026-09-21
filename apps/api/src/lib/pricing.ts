import {
  computeAmountCents,
  elapsedMinutes,
  resolveChargeRateCents,
  resolveRateCents,
  roundToQuarterHour,
  type SessionMode,
} from '@tmi/shared';

import { ApiError } from './errors.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import { getStudentChargeRates } from '../repositories/users.js';

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
}

/**
 * Both halves matter: a tutor can only bill for a student who was actually
 * assigned to them, and the rate comes from the assignment (or the tutor's
 * default) rather than from anything the client sent.
 */
export async function resolveSessionRates(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
): Promise<SessionRates> {
  const assignment = await getActiveAssignmentFor(db, tutorUserId, studentUserId);

  if (!assignment) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['That student is not currently assigned to this tutor.'],
    });
  }

  const label = mode === 'virtual' ? 'virtual' : 'in-person';

  // What the tutor is paid: the pairing's override, else the tutor's default.
  const tutorRateCents = resolveRateCents(
    mode,
    { in_person: assignment.rate_in_person_cents, virtual: assignment.rate_virtual_cents },
    {
      in_person: assignment.effective_rate_in_person_cents,
      virtual: assignment.effective_rate_virtual_cents,
    },
  );

  if (tutorRateCents == null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      mode: [
        `No ${label} rate is set for this tutor. ` +
          'Set a default rate on their profile, or a rate on the assignment.',
      ],
    });
  }

  // What the family is charged. Priced on the student, so it does not depend
  // on who teaches them.
  const studentRates = await getStudentChargeRates(db, studentUserId);
  const chargeRateCents = studentRates && resolveChargeRateCents(mode, studentRates);

  if (chargeRateCents == null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      mode: [
        `No ${label} price is set for this student. ` +
          "Set it on the student's profile before recording the session.",
      ],
    });
  }

  return { tutorRateCents, chargeRateCents };
}

/** Rates plus the money they produce over a typed-in pair of clock times. */
export async function priceSession(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
  startedAt: string,
  endedAt: string,
) {
  const { tutorRateCents, chargeRateCents } = await resolveSessionRates(
    db,
    tutorUserId,
    studentUserId,
    mode,
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
    tutorRateCents,
    chargeRateCents,
    tutorAmountCents: computeAmountCents(durationMinutes, tutorRateCents),
    chargeAmountCents: computeAmountCents(durationMinutes, chargeRateCents),
  };
}

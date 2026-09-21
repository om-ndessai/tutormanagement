import { computeAmountCents, formatDuration, type User } from '@tmi/shared';

import { recordAudit } from './audit.js';
import { resolveSessionRates } from './pricing.js';
import {
  autoStopAt,
  clearActive,
  listActiveRows,
  maxMinutesFor,
  resolveTimes,
  type ActiveRow,
} from '../repositories/active-sessions.js';
import { createSession, type StoredSession } from '../repositories/sessions.js';

type Actor = Pick<User, 'id' | 'full_name'> | null;

/**
 * Closes a running lesson and writes the billing record.
 *
 * One function for both ways a lesson ends -- the tutor pressing stop, and the
 * sweep below reaching its limit -- because the two must produce the same row.
 * A null actor is the sweep: the audit entry is attributed to the System and
 * the session has nobody who recorded it.
 */
export async function recordRunningSession(
  db: D1Database,
  row: ActiveRow,
  options: { actor: Actor; notes?: string | null; now?: Date },
): Promise<StoredSession> {
  const { actor, now = new Date() } = options;
  const notes = options.notes === undefined ? row.notes : options.notes;

  const times = resolveTimes(row.started_at, now, maxMinutesFor(row));
  const rates = await resolveSessionRates(db, row.tutor_user_id, row.student_user_id, row.mode);

  const session = await createSession(db, {
    tutor_user_id: row.tutor_user_id,
    student_user_id: row.student_user_id,
    occurred_on: times.occurred_on,
    started_at: times.started_at,
    ended_at: times.ended_at,
    duration_minutes: times.duration_minutes,
    mode: row.mode,
    tutor_rate_cents: rates.tutorRateCents,
    tutor_amount_cents: computeAmountCents(times.duration_minutes, rates.tutorRateCents),
    charge_rate_cents: rates.chargeRateCents,
    charge_amount_cents: computeAmountCents(times.duration_minutes, rates.chargeRateCents),
    notes,
    auto_stopped: times.auto_stopped,
    recorded_by_user_id: actor?.id ?? null,
  });

  await clearActive(db, row.tutor_user_id);

  const shape =
    `${formatDuration(session.duration_minutes)} ` +
    `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
    `${session.student_name} on ${session.occurred_on} ` +
    `(${(session.charge_amount_cents / 100).toFixed(2)} USD)`;

  await recordAudit(db, actor, {
    action: actor ? 'session.recorded' : 'session.auto_stopped',
    description: actor
      ? `Recorded a ${shape}`
      : `Ended ${row.tutor_name}'s ${shape} automatically, ` +
        `after it ran past the ${formatDuration(maxMinutesFor(row))} session limit`,
    subject: { id: session.student_user_id, full_name: session.student_name },
    entity_type: 'session',
    entity_id: session.id,
  });

  return session;
}

/**
 * Ends every lesson that has run past its limit.
 *
 * The limit is the point of this: a tutor who forgets to press stop would
 * otherwise leave a timer running all night, and the institute would have no
 * honest figure for the lesson. Each one is recorded at its limit and flagged
 * `auto_stopped` so a person can confirm or correct it.
 *
 * Runs from the scheduled handler, and again whenever anyone reads the live
 * sessions -- so a portal nobody has open still settles up, and one somebody
 * is watching settles up promptly.
 */
export async function autoStopExpired(db: D1Database, now: Date = new Date()): Promise<number> {
  const rows = await listActiveRows(db);
  let closed = 0;

  for (const row of rows) {
    if (autoStopAt(row).getTime() > now.getTime()) continue;

    try {
      await recordRunningSession(db, row, { actor: null, now });
      closed += 1;
    } catch (error) {
      // The pairing lost the rate it needs to be priced, so there is nothing
      // honest to write. Leaving the lesson running keeps it visible to an
      // admin, and it will still be recorded at its limit once the rate is
      // fixed -- discarding it here would throw the lesson away instead.
      console.error('Could not auto-stop a session', row.tutor_user_id, error);
    }
  }

  return closed;
}

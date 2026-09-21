import type { ActiveSession, SessionMode, User } from '@tmi/shared';
import { minutesToClock, roundClockToQuarter, zonedClockParts } from '@tmi/shared';

import { isAdmin } from '../lib/scope.js';

const SELECT_ACTIVE = `
  SELECT a.tutor_user_id, t.full_name AS tutor_name,
         a.student_user_id, s.full_name AS student_name,
         a.mode, a.started_at, a.notes
  FROM active_sessions a
  JOIN users t ON t.id = a.tutor_user_id
  JOIN users s ON s.id = a.student_user_id
`;

interface ActiveRow {
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  mode: SessionMode;
  started_at: string;
  notes: string | null;
}

/**
 * A live lesson as the viewer may see it. The two rates are scoped the same
 * way a finished session's are: the tutor teaching it sees what they earn,
 * an admin sees both, and nobody else sees either.
 */
export function toActiveSession(
  row: ActiveRow,
  tutorRateCents: number | null,
  chargeRateCents: number | null,
  viewer: User,
): ActiveSession {
  const { day, minutesOfDay } = zonedClockParts(row.started_at);
  const admin = isAdmin(viewer);

  return {
    ...row,
    occurred_on: day,
    rounded_start: minutesToClock(roundClockToQuarter(minutesOfDay)),
    tutor_rate_cents: admin || row.tutor_user_id === viewer.id ? tutorRateCents : null,
    charge_rate_cents: admin ? chargeRateCents : null,
  };
}

export async function getActiveRow(db: D1Database, tutorUserId: string) {
  return db
    .prepare(`${SELECT_ACTIVE} WHERE a.tutor_user_id = ?`)
    .bind(tutorUserId)
    .first<ActiveRow>();
}

/** Every live lesson, for the admin's view. */
export async function listActiveRows(db: D1Database) {
  const result = await db.prepare(`${SELECT_ACTIVE} ORDER BY a.started_at`).all<ActiveRow>();
  return result.results ?? [];
}

export async function startActive(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO active_sessions (tutor_user_id, student_user_id, mode, started_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    )
    .bind(tutorUserId, studentUserId, mode)
    .run();
}

export async function updateActive(
  db: D1Database,
  tutorUserId: string,
  fields: { mode?: SessionMode; notes?: string | null },
): Promise<void> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    assignments.push(`${key} = ?`);
    values.push(value);
  }

  if (assignments.length === 0) return;

  await db
    .prepare(`UPDATE active_sessions SET ${assignments.join(', ')} WHERE tutor_user_id = ?`)
    .bind(...values, tutorUserId)
    .run();
}

export async function clearActive(db: D1Database, tutorUserId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM active_sessions WHERE tutor_user_id = ?')
    .bind(tutorUserId)
    .run();

  return Boolean(result.meta.changes);
}

/**
 * Turns a running lesson into the times it will be recorded as.
 *
 * Both endpoints are snapped to the nearest quarter, per the plan, so the
 * duration is inherently a multiple of 15. A lesson shorter than half a
 * quarter would otherwise round to nothing, so it is floored at 15 minutes:
 * anything that happened is worth recording.
 *
 * The raw instants are read on the institute's clock, not the Worker's UTC
 * one, so a lesson is recorded at the time the tutor watched it happen.
 */
export function resolveTimes(startedAtIso: string, endedAt: Date = new Date()) {
  const start = zonedClockParts(startedAtIso);
  const end = zonedClockParts(endedAt.toISOString());

  const roundedStart = roundClockToQuarter(start.minutesOfDay);
  let roundedEnd = roundClockToQuarter(end.minutesOfDay);

  // Crossing midnight, or a lesson too short to register, both land here.
  if (roundedEnd <= roundedStart) roundedEnd = roundedStart + 15;

  return {
    occurred_on: start.day,
    started_at: minutesToClock(roundedStart),
    ended_at: minutesToClock(roundedEnd),
    duration_minutes: roundedEnd - roundedStart,
  };
}

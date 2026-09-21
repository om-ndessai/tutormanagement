import type { ActiveSession, SessionMode, User } from '@tmi/shared';
import {
  DEFAULT_MAX_SESSION_MINUTES,
  QUARTER_HOUR,
  effectiveMaxSessionMinutes,
  minutesToClock,
  roundClockToQuarter,
  roundToQuarterHour,
  zonedClockParts,
} from '@tmi/shared';

import { isAdmin } from '../lib/scope.js';

const SELECT_ACTIVE = `
  SELECT a.tutor_user_id, t.full_name AS tutor_name,
         a.student_user_id, s.full_name AS student_name,
         a.mode, a.started_at, a.notes,
         tp.max_session_minutes AS tutor_max_session_minutes,
         sp.max_session_minutes AS student_max_session_minutes
  FROM active_sessions a
  JOIN users t ON t.id = a.tutor_user_id
  JOIN users s ON s.id = a.student_user_id
  -- Left joins: the limits are optional, and a missing profile must not hide
  -- a running lesson.
  LEFT JOIN tutor_profiles   tp ON tp.user_id = a.tutor_user_id
  LEFT JOIN student_profiles sp ON sp.user_id = a.student_user_id
`;

export interface ActiveRow {
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  mode: SessionMode;
  started_at: string;
  notes: string | null;
  tutor_max_session_minutes: number | null;
  student_max_session_minutes: number | null;
}

/** How long this particular lesson may run before it closes itself. */
export function maxMinutesFor(row: ActiveRow): number {
  return effectiveMaxSessionMinutes(
    row.tutor_max_session_minutes,
    row.student_max_session_minutes,
  );
}

/** The instant a running lesson reaches its limit. */
export function autoStopAt(row: ActiveRow): Date {
  return new Date(new Date(row.started_at).getTime() + maxMinutesFor(row) * 60_000);
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
    max_minutes: maxMinutesFor(row),
    auto_stop_at: autoStopAt(row).toISOString(),
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

/** 23:45, the last quarter-hour mark a session can be recorded against. */
const LAST_QUARTER = 23 * 60 + 45;

/**
 * Turns a running lesson into the times it will be recorded as.
 *
 * The start is snapped to the nearest quarter, per the plan. The length is
 * then the time that ACTUALLY elapsed between the two instants, rounded to a
 * quarter -- not the gap between two independently snapped endpoints, which
 * drifts by a whole quarter whenever the two round opposite ways: a lesson
 * from 4:53 to 5:52 is 59 minutes, but 5:00 to 5:45 is 45. The end then
 * follows from the start plus that length, so it still lands on a quarter and
 * the three fields cannot contradict each other.
 *
 * Measuring the instants rather than the clock also keeps a lesson correct
 * across a daylight-saving change, where the wall clock skips or repeats an
 * hour. On those two mornings the derived end can name a wall time that did
 * not exist, or existed twice; the LENGTH stays right, and that is what is
 * billed.
 *
 * `maxMinutes` is the end of the line: a timer left running is recorded at
 * the limit, not for as long as it ran, and `auto_stopped` says the end was
 * imposed rather than observed. That holds however the lesson is closed --
 * by the sweep, or by a tutor who presses stop hours late.
 *
 * A lesson shorter than half a quarter would round away to nothing, so it is
 * floored at fifteen minutes: anything that happened is worth recording.
 */
export function resolveTimes(
  startedAtIso: string,
  endedAt: Date = new Date(),
  maxMinutes: number = DEFAULT_MAX_SESSION_MINUTES,
) {
  const start = zonedClockParts(startedAtIso);

  // A session belongs to ONE date and its end must stay after its start, so a
  // lesson left running past midnight is recorded up to the end of the day it
  // began on. The start is held back far enough for a quarter to fit.
  const startMinutes = Math.min(
    roundClockToQuarter(start.minutesOfDay),
    LAST_QUARTER - QUARTER_HOUR,
  );

  const elapsed = (endedAt.getTime() - new Date(startedAtIso).getTime()) / 60_000;
  const measured = Math.max(QUARTER_HOUR, roundToQuarterHour(elapsed));
  const duration = Math.min(measured, maxMinutes, LAST_QUARTER - startMinutes);

  return {
    occurred_on: start.day,
    started_at: minutesToClock(startMinutes),
    ended_at: minutesToClock(startMinutes + duration),
    duration_minutes: duration,
    auto_stopped: measured > maxMinutes,
  };
}

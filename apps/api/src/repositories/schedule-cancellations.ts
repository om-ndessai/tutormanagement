import {
  minutesToClock,
  parseClockTime,
  type ListScheduleCancellationsParams,
  type ScheduleCancellation,
  type ScheduleCancellerRole,
  type User,
} from '@tmi/shared';

import { teachingScopeSql } from '../lib/scope.js';

/**
 * A cancellation that a lesson was recorded on anyway is no cancellation: a
 * person vouching for what happened outranks a plan that it would not. Every
 * read of a cancellation -- the lists, the calendar file, the progress count --
 * goes through this one fragment, over `c` (schedule_cancellations) and `ss`
 * (scheduled_sessions), so none of them can count a lesson as both held and
 * called off. Deleting that lesson brings the cancellation back.
 */
export const NOT_OVERTAKEN_SQL = `NOT EXISTS (
  SELECT 1 FROM sessions s
  WHERE s.tutor_user_id = ss.tutor_user_id
    AND s.student_user_id = ss.student_user_id
    AND s.occurred_on = c.occurs_on)`;

const SELECT_CANCELLATION = `
  SELECT c.schedule_id, c.occurs_on, ss.start_time, ss.duration_minutes,
         ss.tutor_user_id, t.full_name AS tutor_name,
         ss.student_user_id, st.full_name AS student_name,
         c.note, c.cancelled_by_user_id, cb.full_name AS cancelled_by_name,
         c.cancelled_as, c.created_at
  FROM schedule_cancellations c
  JOIN scheduled_sessions ss ON ss.id = c.schedule_id
  JOIN users t  ON t.id  = ss.tutor_user_id
  JOIN users st ON st.id = ss.student_user_id
  LEFT JOIN users cb ON cb.id = c.cancelled_by_user_id
`;

/** A cancellation as stored. Who may restore it depends on the reader. */
export type StoredCancellation = Omit<ScheduleCancellation, 'can_restore'>;

type CancellationRow = Omit<StoredCancellation, 'end_time'>;

/** The end time follows the schedule's current start and length. */
function toCancellation(row: CancellationRow): StoredCancellation {
  const start = parseClockTime(row.start_time) ?? 0;
  return { ...row, end_time: minutesToClock(start + row.duration_minutes) };
}

/**
 * The cancellations a reader may list, soonest first.
 *
 * Scoped by the joined schedule, with teachingScopeSql: the schedule's tutor,
 * the student, the student's guardians, and admins. A cancellation is read by
 * the people its schedule is, never more.
 */
export async function listScheduleCancellations(
  db: D1Database,
  viewer: User,
  params: ListScheduleCancellationsParams,
): Promise<StoredCancellation[]> {
  const where: string[] = [NOT_OVERTAKEN_SQL];
  const values: unknown[] = [];

  if (params.from) {
    where.push('c.occurs_on >= ?');
    values.push(params.from);
  }
  if (params.to) {
    where.push('c.occurs_on <= ?');
    values.push(params.to);
  }
  if (params.schedule_id) {
    where.push('c.schedule_id = ?');
    values.push(params.schedule_id);
  }
  if (params.student_user_id) {
    where.push('ss.student_user_id = ?');
    values.push(params.student_user_id);
  }
  if (params.tutor_user_id) {
    where.push('ss.tutor_user_id = ?');
    values.push(params.tutor_user_id);
  }

  const scope = teachingScopeSql(viewer, 'ss');
  if (scope) {
    where.push(scope.sql);
    values.push(...scope.values);
  }

  const result = await db
    .prepare(
      `${SELECT_CANCELLATION} WHERE ${where.join(' AND ')}
       ORDER BY c.occurs_on, ss.start_time, st.full_name
       LIMIT ?`,
    )
    .bind(...values, params.limit)
    .all<CancellationRow>();

  return (result.results ?? []).map(toCancellation);
}

/**
 * The cancellations of schedules the caller has ALREADY scoped -- the ones a
 * reader's list returned. Unscoped itself, so it must never be handed ids
 * that came from a request.
 *
 * The ids travel as one JSON parameter: D1 caps how many a statement may bind,
 * and a reader's schedules can outnumber it.
 */
export async function listCancellationsForSchedules(
  db: D1Database,
  scheduleIds: readonly string[],
  options: { from?: string } = {},
): Promise<StoredCancellation[]> {
  if (scheduleIds.length === 0) return [];

  const result = await db
    .prepare(
      `${SELECT_CANCELLATION}
       WHERE c.schedule_id IN (SELECT value FROM json_each(?))
         AND ${NOT_OVERTAKEN_SQL}
         ${options.from ? 'AND c.occurs_on >= ?' : ''}
       ORDER BY c.occurs_on, ss.start_time`,
    )
    .bind(JSON.stringify(scheduleIds), ...(options.from ? [options.from] : []))
    .all<CancellationRow>();

  return (result.results ?? []).map(toCancellation);
}

/**
 * Every cancellation of the given students' schedules, for their progress.
 * Unscoped: progress decides per reader which details to show (see
 * buildStudentProgress), and only after the student has been checked.
 */
export async function listCancellationsForStudents(
  db: D1Database,
  studentIds: readonly string[],
): Promise<StoredCancellation[]> {
  if (studentIds.length === 0) return [];

  const result = await db
    .prepare(
      `${SELECT_CANCELLATION}
       WHERE ss.student_user_id IN (SELECT value FROM json_each(?))
         AND ${NOT_OVERTAKEN_SQL}
       ORDER BY c.occurs_on, ss.start_time`,
    )
    .bind(JSON.stringify(studentIds))
    .all<CancellationRow>();

  return (result.results ?? []).map(toCancellation);
}

/** One cancellation as stored, whether or not a lesson has since overtaken it. */
export async function getCancellation(
  db: D1Database,
  scheduleId: string,
  occursOn: string,
): Promise<StoredCancellation | null> {
  const row = await db
    .prepare(`${SELECT_CANCELLATION} WHERE c.schedule_id = ? AND c.occurs_on = ?`)
    .bind(scheduleId, occursOn)
    .first<CancellationRow>();

  return row ? toCancellation(row) : null;
}

/** Records a cancellation. False when that date was already cancelled. */
export async function insertCancellation(
  db: D1Database,
  row: {
    schedule_id: string;
    occurs_on: string;
    note: string | null;
    cancelled_by_user_id: string;
    cancelled_as: ScheduleCancellerRole;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO schedule_cancellations
         (schedule_id, occurs_on, note, cancelled_by_user_id, cancelled_as)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (schedule_id, occurs_on) DO NOTHING`,
    )
    .bind(row.schedule_id, row.occurs_on, row.note, row.cancelled_by_user_id, row.cancelled_as)
    .run();

  return Boolean(result.meta.changes);
}

/** Restores a lesson: the date is back in the series. */
export async function deleteCancellation(
  db: D1Database,
  scheduleId: string,
  occursOn: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM schedule_cancellations WHERE schedule_id = ? AND occurs_on = ?')
    .bind(scheduleId, occursOn)
    .run();

  return Boolean(result.meta.changes);
}

/** Whether a lesson was recorded for this pair on this date. */
export async function hasLessonOn(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
  date: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM sessions
       WHERE tutor_user_id = ? AND student_user_id = ? AND occurred_on = ? LIMIT 1`,
    )
    .bind(tutorUserId, studentUserId, date)
    .first<{ found: number }>();

  return Boolean(row);
}

/**
 * The dates this schedule has cancelled from `from` on, as stored -- including
 * any a lesson has overtaken -- for working out which an edit orphans.
 */
export async function listCancelledDates(
  db: D1Database,
  scheduleId: string,
  from: string,
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT occurs_on FROM schedule_cancellations
       WHERE schedule_id = ? AND occurs_on >= ? ORDER BY occurs_on`,
    )
    .bind(scheduleId, from)
    .all<{ occurs_on: string }>();

  return (result.results ?? []).map((row) => row.occurs_on);
}

/** Clears the given dates of one schedule, as a statement for a batch. */
export function clearCancellationsStatement(
  db: D1Database,
  scheduleId: string,
  dates: readonly string[],
): D1PreparedStatement {
  return db
    .prepare(
      `DELETE FROM schedule_cancellations
       WHERE schedule_id = ? AND occurs_on IN (SELECT value FROM json_each(?))`,
    )
    .bind(scheduleId, JSON.stringify(dates));
}

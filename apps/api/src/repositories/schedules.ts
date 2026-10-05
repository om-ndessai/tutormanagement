import type {
  ListSchedulesParams,
  SchedulePayload,
  ScheduleUpdatePayload,
  ScheduledSession,
  User,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { teachingScopeSql } from '../lib/scope.js';
import { clearCancellationsStatement } from './schedule-cancellations.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SELECT_SCHEDULE = `
  SELECT ss.id, ss.tutor_user_id, t.full_name AS tutor_name,
         ss.student_user_id, st.full_name AS student_name,
         ss.day_of_week, ss.start_time, ss.duration_minutes, ss.mode,
         ss.starts_on, ss.ends_on, ss.location, ss.notes, ss.is_active,
         ss.created_at, ss.updated_at
  FROM scheduled_sessions ss
  JOIN users t  ON t.id  = ss.tutor_user_id
  JOIN users st ON st.id = ss.student_user_id
`;

interface ScheduleRow extends Omit<ScheduledSession, 'is_active'> {
  is_active: number;
}

const toSchedule = (row: ScheduleRow): ScheduledSession => ({
  ...row,
  is_active: row.is_active === 1,
});

export async function listSchedules(
  db: D1Database,
  org: OrgId,
  viewer: User,
  params: ListSchedulesParams,
): Promise<ScheduledSession[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (!params.include_inactive) where.push('ss.is_active = 1');

  if (params.tutor_user_id) {
    where.push('ss.tutor_user_id = ?');
    values.push(params.tutor_user_id);
  }

  if (params.student_user_id) {
    where.push('ss.student_user_id = ?');
    values.push(params.student_user_id);
  }

  // Same rule as sessions: you see it if you teach it, or it is about you or
  // one of your children.
  const scope = teachingScopeSql(viewer, 'ss', org);
  where.push(scope.sql);
  values.push(...scope.values);

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const result = await db
    .prepare(`${SELECT_SCHEDULE} ${whereSql} ORDER BY ss.day_of_week, ss.start_time, st.full_name`)
    .bind(...values)
    .all<ScheduleRow>();

  return (result.results ?? []).map(toSchedule);
}

/** A schedule of this organization. One from elsewhere is null. */
export async function getSchedule(
  db: D1Database,
  org: OrgId,
  id: string,
): Promise<ScheduledSession | null> {
  const row = await db
    .prepare(`${SELECT_SCHEDULE} WHERE ss.organization_id = ? AND ss.id = ?`)
    .bind(org, id)
    .first<ScheduleRow>();
  return row ? toSchedule(row) : null;
}

export async function createSchedule(
  db: D1Database,
  org: OrgId,
  input: SchedulePayload,
): Promise<ScheduledSession> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO scheduled_sessions
         (id, organization_id, tutor_user_id, student_user_id, day_of_week, start_time,
          duration_minutes, mode, starts_on, ends_on, location, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      org,
      input.tutor_user_id,
      input.student_user_id,
      input.day_of_week,
      input.start_time,
      input.duration_minutes,
      input.mode,
      input.starts_on,
      input.ends_on,
      input.location,
      input.notes,
    )
    .run();

  const created = await getSchedule(db, org, id);
  if (!created) throw new Error('Insert into scheduled_sessions returned no row.');

  return created;
}

/**
 * Applies an edit. `clearCancellations` names cancelled dates the edit leaves
 * the series no longer falling on -- a move from Tuesdays to Thursdays, an
 * earlier end -- which are removed in the same batch, so the edit and its
 * tidying cannot come apart.
 */
export async function updateSchedule(
  db: D1Database,
  org: OrgId,
  id: string,
  input: ScheduleUpdatePayload,
  options: { clearCancellations?: readonly string[] } = {},
): Promise<ScheduledSession | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const field of [
    'day_of_week',
    'start_time',
    'duration_minutes',
    'mode',
    'starts_on',
    'ends_on',
    'location',
    'notes',
  ] as const) {
    if (field in input) {
      assignments.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  if ('is_active' in input) {
    assignments.push('is_active = ?');
    values.push(input.is_active ? 1 : 0);
  }

  if (assignments.length === 0) return getSchedule(db, org, id);

  assignments.push(`updated_at = ${NOW}`);

  const statements = [
    db
      .prepare(
        `UPDATE scheduled_sessions SET ${assignments.join(', ')}
         WHERE organization_id = ? AND id = ?`,
      )
      .bind(...values, org, id),
  ];
  if (options.clearCancellations?.length) {
    statements.push(clearCancellationsStatement(db, id, options.clearCancellations));
  }

  const [result] = await db.batch(statements);
  if (!result?.meta.changes) return null;
  return getSchedule(db, org, id);
}

export async function deleteSchedule(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM scheduled_sessions WHERE organization_id = ? AND id = ?')
    .bind(org, id)
    .run();
  return Boolean(result.meta.changes);
}

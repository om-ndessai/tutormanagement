import {
  sortAssessments,
  type ListSessionsParams,
  type SessionAssessment,
  type SessionProgress,
  type SessionTotals,
  type SessionWriteUp,
  type TutoringSession,
  type User,
} from '@tmi/shared';

import { familyStudentIds, isAdmin, scopeSessionMoney, teachingScopeSql } from '../lib/scope.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SELECT_SESSION = `
  SELECT s.id,
         s.tutor_user_id,
         t.full_name AS tutor_name,
         s.student_user_id,
         st.full_name AS student_name,
         s.occurred_on,
         s.started_at,
         s.ended_at,
         s.duration_minutes,
         s.mode,
         s.tutor_rate_cents,
         s.tutor_amount_cents,
         s.charge_rate_cents,
         s.charge_amount_cents,
         s.notes,
         s.auto_stopped,
         sp.session_id AS progress_session_id,
         sp.goal_rating,
         (SELECT json_group_array(json_object('topic_id', r.topic_id, 'rating', r.rating))
            FROM session_topic_ratings r WHERE r.session_id = s.id) AS topic_ratings_json,
         w.session_id AS write_up_session_id,
         w.planned,
         w.previous_review,
         w.homework_review,
         w.homework_status,
         w.homework_assigned,
         (SELECT json_group_array(json_object(
                   'session_id', a.session_id,
                   'author_user_id', a.author_user_id,
                   'author_name', au.full_name,
                   'author_role', a.author_role,
                   'rating', a.rating,
                   'body', a.body,
                   'created_at', a.created_at,
                   'updated_at', a.updated_at))
            FROM session_assessments a JOIN users au ON au.id = a.author_user_id
            WHERE a.session_id = s.id) AS assessments_json,
         s.created_at,
         s.updated_at
  FROM sessions s
  JOIN users t  ON t.id  = s.tutor_user_id
  JOIN users st ON st.id = s.student_user_id
  LEFT JOIN session_progress sp ON sp.session_id = s.id
  LEFT JOIN session_write_ups w ON w.session_id = s.id
`;

/**
 * A session exactly as the table holds it: both sides of the money are always
 * present. `TutoringSession` widens them to nullable because a viewer may only
 * be shown one side, so keeping the stored shape separate means the compiler
 * catches any path that returns a row before scopeSessionMoney has run.
 */
export interface StoredSession
  extends Omit<
    TutoringSession,
    | 'tutor_rate_cents'
    | 'tutor_amount_cents'
    | 'charge_rate_cents'
    | 'charge_amount_cents'
    | 'money_view'
  > {
  tutor_rate_cents: number;
  tutor_amount_cents: number;
  charge_rate_cents: number;
  charge_amount_cents: number;
}

type SessionRow = Omit<StoredSession, 'auto_stopped' | 'progress' | 'write_up' | 'assessments'> &
  SessionWriteUp & {
    auto_stopped: number;
    progress_session_id: string | null;
    goal_rating: SessionProgress['goal_rating'];
    topic_ratings_json: string | null;
    write_up_session_id: string | null;
    assessments_json: string | null;
  };

/**
 * D1 stores the flag as 0/1; everything above this layer speaks booleans.
 * Progress is present exactly when the lesson was scored -- a progress row
 * exists -- so an unscored lesson reads as null rather than as zero topics.
 * The write-up follows the same rule.
 */
function toSession({
  progress_session_id,
  goal_rating,
  topic_ratings_json,
  write_up_session_id,
  planned,
  previous_review,
  homework_review,
  homework_status,
  homework_assigned,
  assessments_json,
  ...row
}: SessionRow): StoredSession {
  return {
    ...row,
    auto_stopped: Number(row.auto_stopped) === 1,
    progress: progress_session_id
      ? { goal_rating, topic_ratings: JSON.parse(topic_ratings_json ?? '[]') }
      : null,
    write_up: write_up_session_id
      ? { planned, previous_review, homework_review, homework_status, homework_assigned }
      : null,
    assessments: sortAssessments(JSON.parse(assessments_json ?? '[]') as SessionAssessment[]),
  };
}

/**
 * An extra condition from inside the API -- never from a query string -- for
 * views narrower than the viewer's whole scope, like one role's dashboard.
 */
export interface SessionNarrowing {
  sql: string;
  values: unknown[];
}

/** Builds the shared WHERE for list and totals, so the two cannot disagree. */
function buildFilter(viewer: User, params: ListSessionsParams, narrow?: SessionNarrowing) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (narrow) {
    where.push(narrow.sql);
    values.push(...narrow.values);
  }

  if (params.tutor_user_id) {
    where.push('s.tutor_user_id = ?');
    values.push(params.tutor_user_id);
  }

  if (params.student_user_id) {
    where.push('s.student_user_id = ?');
    values.push(params.student_user_id);
  }

  if (params.from) {
    where.push('s.occurred_on >= ?');
    values.push(params.from);
  }

  if (params.to) {
    where.push('s.occurred_on <= ?');
    values.push(params.to);
  }

  const scope = teachingScopeSql(viewer, 's');
  if (scope) {
    where.push(scope.sql);
    values.push(...scope.values);
  }

  return {
    sql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    values,
  };
}

export interface ListSessionsResult {
  sessions: TutoringSession[];
  totals: SessionTotals;
}

export async function listSessions(
  db: D1Database,
  viewer: User,
  params: ListSessionsParams,
  narrow?: SessionNarrowing,
): Promise<ListSessionsResult> {
  const filter = buildFilter(viewer, params, narrow);
  const admin = isAdmin(viewer);

  // Each side's total is summed over the rows the viewer sees THAT side on,
  // by the same rule scopeSessionMoney applies row by row: pay where they
  // taught, the price where it is their own or their child's lesson and they
  // did not teach it. An admin sums both over everything.
  const family =
    '(s.student_user_id = ? OR s.student_user_id IN ' +
    '(SELECT g.dependent_user_id FROM guardianships g WHERE g.guardian_user_id = ?))';
  const sides = admin
    ? {
        sql: `COALESCE(SUM(s.tutor_amount_cents), 0)  AS tutor_sum, COUNT(*) AS tutor_rows,
              COALESCE(SUM(s.charge_amount_cents), 0) AS charge_sum, COUNT(*) AS charge_rows`,
        values: [] as unknown[],
      }
    : {
        sql: `COALESCE(SUM(CASE WHEN s.tutor_user_id = ? THEN s.tutor_amount_cents END), 0) AS tutor_sum,
              COALESCE(SUM(CASE WHEN s.tutor_user_id = ? THEN 1 END), 0) AS tutor_rows,
              COALESCE(SUM(CASE WHEN s.tutor_user_id <> ? AND ${family} THEN s.charge_amount_cents END), 0) AS charge_sum,
              COALESCE(SUM(CASE WHEN s.tutor_user_id <> ? AND ${family} THEN 1 END), 0) AS charge_rows`,
        values: [
          viewer.id,
          viewer.id,
          viewer.id,
          viewer.id,
          viewer.id,
          viewer.id,
          viewer.id,
          viewer.id,
        ],
      };

  const [totalsResult, pageResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(*) AS session_count,
                COALESCE(SUM(s.duration_minutes), 0) AS total_minutes,
                ${sides.sql}
         FROM sessions s ${filter.sql}`,
      )
      .bind(...sides.values, ...filter.values),
    db
      .prepare(
        `${SELECT_SESSION} ${filter.sql}
         ORDER BY s.occurred_on DESC, s.started_at DESC, s.id
         LIMIT ? OFFSET ?`,
      )
      .bind(...filter.values, params.limit, params.offset),
  ]);

  const totalsRow = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;
  const familyIds = await familyStudentIds(db, viewer);

  const sessions = ((pageResult?.results ?? []) as unknown as SessionRow[]).map((row) =>
    scopeSessionMoney(toSession(row), viewer, familyIds),
  );

  return {
    sessions,
    totals: {
      session_count: Number(totalsRow.session_count ?? 0),
      total_minutes: Number(totalsRow.total_minutes ?? 0),
      total_tutor_amount_cents:
        admin || Number(totalsRow.tutor_rows ?? 0) > 0 ? Number(totalsRow.tutor_sum ?? 0) : null,
      total_charge_amount_cents:
        admin || Number(totalsRow.charge_rows ?? 0) > 0 ? Number(totalsRow.charge_sum ?? 0) : null,
    },
  };
}

/**
 * One session, but only if the viewer's list would contain it: the id alone
 * is never proof of access. The same teachingScopeSql the list uses, applied
 * to the one row, so a lookup can never be wider than the list.
 */
export async function getVisibleSession(
  db: D1Database,
  viewer: User,
  id: string,
): Promise<StoredSession | null> {
  const scope = teachingScopeSql(viewer, 's');
  const row = await db
    .prepare(`${SELECT_SESSION} WHERE s.id = ? ${scope ? `AND ${scope.sql}` : ''}`)
    .bind(id, ...(scope?.values ?? []))
    .first<SessionRow>();

  return row ? toSession(row) : null;
}

export async function getSession(db: D1Database, id: string): Promise<StoredSession | null> {
  const row = await db.prepare(`${SELECT_SESSION} WHERE s.id = ?`).bind(id).first<SessionRow>();
  return row ? toSession(row) : null;
}

export interface CreateSessionRow {
  tutor_user_id: string;
  student_user_id: string;
  occurred_on: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  mode: string;
  tutor_rate_cents: number;
  tutor_amount_cents: number;
  charge_rate_cents: number;
  charge_amount_cents: number;
  notes: string | null;
  /** True when the limit ended the lesson rather than a person. */
  auto_stopped: boolean;
  /** NULL when the sweep recorded it: nobody pressed stop. */
  recorded_by_user_id: string | null;
}

export async function createSession(
  db: D1Database,
  row: CreateSessionRow,
): Promise<StoredSession> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO sessions
         (id, tutor_user_id, student_user_id, occurred_on, started_at, ended_at,
          duration_minutes, mode, tutor_rate_cents, tutor_amount_cents,
          charge_rate_cents, charge_amount_cents, notes, auto_stopped,
          recorded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      row.tutor_user_id,
      row.student_user_id,
      row.occurred_on,
      row.started_at,
      row.ended_at,
      row.duration_minutes,
      row.mode,
      row.tutor_rate_cents,
      row.tutor_amount_cents,
      row.charge_rate_cents,
      row.charge_amount_cents,
      row.notes,
      row.auto_stopped ? 1 : 0,
      row.recorded_by_user_id,
    )
    .run();

  const created = await getSession(db, id);
  if (!created) throw new Error('Insert into sessions returned no row.');

  return created;
}

/**
 * Editing a session re-derives duration and BOTH amounts from the new times,
 * so a correction cannot leave either figure out of step with the hours. The
 * rates stay frozen at whatever applied when the session was recorded.
 */
export async function updateSessionRow(
  db: D1Database,
  id: string,
  fields: Partial<{
    occurred_on: string;
    started_at: string;
    ended_at: string;
    mode: string;
    notes: string | null;
    duration_minutes: number;
    tutor_amount_cents: number;
    tutor_rate_cents: number;
    charge_amount_cents: number;
    charge_rate_cents: number;
    auto_stopped: boolean;
  }>,
): Promise<StoredSession | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    assignments.push(`${key} = ?`);
    // The one boolean among them; D1 stores it as 0/1 like the schema says.
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }

  if (assignments.length === 0) return getSession(db, id);

  assignments.push(`updated_at = ${NOW}`);

  const result = await db
    .prepare(`UPDATE sessions SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  if (!result.meta.changes) return null;
  return getSession(db, id);
}

export async function deleteSession(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

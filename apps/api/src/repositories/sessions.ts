import type {
  ListSessionsParams,
  SessionTotals,
  TutoringSession,
  User,
} from '@tmi/shared';

import { teachingScopeSql } from '../lib/scope.js';

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
         s.rate_cents,
         s.amount_cents,
         s.notes,
         s.created_at,
         s.updated_at
  FROM sessions s
  JOIN users t  ON t.id  = s.tutor_user_id
  JOIN users st ON st.id = s.student_user_id
`;

type SessionRow = TutoringSession;

/** Builds the shared WHERE for list and totals, so the two cannot disagree. */
function buildFilter(viewer: User, params: ListSessionsParams) {
  const where: string[] = [];
  const values: unknown[] = [];

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
): Promise<ListSessionsResult> {
  const filter = buildFilter(viewer, params);

  const [totalsResult, pageResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(*) AS session_count,
                COALESCE(SUM(s.duration_minutes), 0) AS total_minutes,
                COALESCE(SUM(s.amount_cents), 0) AS total_amount_cents
         FROM sessions s ${filter.sql}`,
      )
      .bind(...filter.values),
    db
      .prepare(
        `${SELECT_SESSION} ${filter.sql}
         ORDER BY s.occurred_on DESC, s.started_at DESC, s.id
         LIMIT ? OFFSET ?`,
      )
      .bind(...filter.values, params.limit, params.offset),
  ]);

  const totalsRow = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;

  return {
    sessions: (pageResult?.results ?? []) as unknown as TutoringSession[],
    totals: {
      session_count: Number(totalsRow.session_count ?? 0),
      total_minutes: Number(totalsRow.total_minutes ?? 0),
      total_amount_cents: Number(totalsRow.total_amount_cents ?? 0),
    },
  };
}

export async function getSession(db: D1Database, id: string): Promise<TutoringSession | null> {
  const row = await db.prepare(`${SELECT_SESSION} WHERE s.id = ?`).bind(id).first<SessionRow>();
  return row ?? null;
}

export interface CreateSessionRow {
  tutor_user_id: string;
  student_user_id: string;
  occurred_on: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  mode: string;
  rate_cents: number;
  amount_cents: number;
  notes: string | null;
  recorded_by_user_id: string;
}

export async function createSession(
  db: D1Database,
  row: CreateSessionRow,
): Promise<TutoringSession> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO sessions
         (id, tutor_user_id, student_user_id, occurred_on, started_at, ended_at,
          duration_minutes, mode, rate_cents, amount_cents, notes, recorded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      row.rate_cents,
      row.amount_cents,
      row.notes,
      row.recorded_by_user_id,
    )
    .run();

  const created = await getSession(db, id);
  if (!created) throw new Error('Insert into sessions returned no row.');

  return created;
}

/**
 * Editing a session re-derives duration and amount from the new times, so a
 * correction cannot leave the billed figure out of step with the hours. The
 * rate itself stays frozen at whatever applied when the session was recorded.
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
    amount_cents: number;
    rate_cents: number;
  }>,
): Promise<TutoringSession | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    assignments.push(`${key} = ?`);
    values.push(value);
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

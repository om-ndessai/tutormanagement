import type {
  Assignment,
  AssignmentPayload,
  AssignmentUpdatePayload,
  ListAssignmentsParams,
  User,
} from '@tmi/shared';

import { teachingScopeSql } from '../lib/scope.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Joins in both names and the tutor's defaults, so the caller gets the rates
 * that actually apply without a second lookup. COALESCE is the rate-resolution
 * rule in SQL: the per-pair override wins, else the tutor's default.
 */
const SELECT_ASSIGNMENT = `
  SELECT a.id,
         a.tutor_user_id,
         t.full_name AS tutor_name,
         a.student_user_id,
         s.full_name AS student_name,
         a.rate_in_person_cents,
         a.rate_virtual_cents,
         COALESCE(a.rate_in_person_cents, tp.default_rate_in_person_cents) AS effective_rate_in_person_cents,
         COALESCE(a.rate_virtual_cents,   tp.default_rate_virtual_cents)   AS effective_rate_virtual_cents,
         a.is_active,
         a.notes,
         a.created_at,
         a.updated_at
  FROM assignments a
  JOIN users t ON t.id = a.tutor_user_id
  JOIN users s ON s.id = a.student_user_id
  LEFT JOIN tutor_profiles tp ON tp.user_id = a.tutor_user_id
`;

interface AssignmentRow {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  rate_in_person_cents: number | null;
  rate_virtual_cents: number | null;
  effective_rate_in_person_cents: number | null;
  effective_rate_virtual_cents: number | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toAssignment(row: AssignmentRow): Assignment {
  return { ...row, is_active: row.is_active === 1 };
}

export async function listAssignments(
  db: D1Database,
  viewer: User,
  params: ListAssignmentsParams,
): Promise<Assignment[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (!params.include_inactive) where.push('a.is_active = 1');

  if (params.tutor_user_id) {
    where.push('a.tutor_user_id = ?');
    values.push(params.tutor_user_id);
  }

  if (params.student_user_id) {
    where.push('a.student_user_id = ?');
    values.push(params.student_user_id);
  }

  const scope = teachingScopeSql(viewer, 'a');
  if (scope) {
    where.push(scope.sql);
    values.push(...scope.values);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const result = await db
    .prepare(`${SELECT_ASSIGNMENT} ${whereSql} ORDER BY t.full_name, s.full_name`)
    .bind(...values)
    .all<AssignmentRow>();

  return (result.results ?? []).map(toAssignment);
}

export async function getAssignment(db: D1Database, id: string): Promise<Assignment | null> {
  const row = await db.prepare(`${SELECT_ASSIGNMENT} WHERE a.id = ?`).bind(id).first<AssignmentRow>();
  return row ? toAssignment(row) : null;
}

/** The live pairing for a tutor/student, used to authorise and price a session. */
export async function getActiveAssignmentFor(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
): Promise<Assignment | null> {
  const row = await db
    .prepare(
      `${SELECT_ASSIGNMENT} WHERE a.tutor_user_id = ? AND a.student_user_id = ? AND a.is_active = 1`,
    )
    .bind(tutorUserId, studentUserId)
    .first<AssignmentRow>();

  return row ? toAssignment(row) : null;
}

/**
 * Re-assigning a pair that was ended before reactivates the original row
 * instead of creating a duplicate, which is what the UNIQUE constraint on
 * (tutor, student) requires.
 */
export async function upsertAssignment(
  db: D1Database,
  input: AssignmentPayload,
): Promise<Assignment> {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO assignments
         (id, tutor_user_id, student_user_id, rate_in_person_cents, rate_virtual_cents, is_active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (tutor_user_id, student_user_id) DO UPDATE SET
         rate_in_person_cents = excluded.rate_in_person_cents,
         rate_virtual_cents   = excluded.rate_virtual_cents,
         is_active            = excluded.is_active,
         notes                = excluded.notes,
         updated_at           = ${NOW}`,
    )
    .bind(
      id,
      input.tutor_user_id,
      input.student_user_id,
      input.rate_in_person_cents,
      input.rate_virtual_cents,
      input.is_active ? 1 : 0,
      input.notes,
    )
    .run();

  const assignment = await db
    .prepare(`${SELECT_ASSIGNMENT} WHERE a.tutor_user_id = ? AND a.student_user_id = ?`)
    .bind(input.tutor_user_id, input.student_user_id)
    .first<AssignmentRow>();

  if (!assignment) throw new Error('Assignment upsert returned no row.');
  return toAssignment(assignment);
}

export async function updateAssignment(
  db: D1Database,
  id: string,
  input: AssignmentUpdatePayload,
): Promise<Assignment | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const field of ['rate_in_person_cents', 'rate_virtual_cents', 'notes'] as const) {
    if (field in input) {
      assignments.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  if ('is_active' in input) {
    assignments.push('is_active = ?');
    values.push(input.is_active ? 1 : 0);
  }

  if (assignments.length === 0) return getAssignment(db, id);

  assignments.push(`updated_at = ${NOW}`);

  const result = await db
    .prepare(`UPDATE assignments SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  if (!result.meta.changes) return null;
  return getAssignment(db, id);
}

export async function deleteAssignment(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM assignments WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

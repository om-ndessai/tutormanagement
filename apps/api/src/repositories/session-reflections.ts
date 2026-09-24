import type {
  ReflectionDigest,
  ReflectionPrompt,
  SessionReflection,
  SessionReflectionPayload,
  SessionReflectorRole,
} from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Records the student's reflection on a lesson, replacing any given before:
 * one per lesson, and a revision is the same reflection said again. Whoever
 * typed it last is who it is recorded as entered by.
 */
export async function saveReflection(
  db: D1Database,
  sessionId: string,
  enteredBy: { user_id: string; role: SessionReflectorRole },
  input: SessionReflectionPayload,
): Promise<{ revised: boolean }> {
  const before = await db
    .prepare('SELECT 1 AS found FROM session_reflections WHERE session_id = ?')
    .bind(sessionId)
    .first<{ found: number }>();

  await db
    .prepare(
      `INSERT INTO session_reflections
         (session_id, learned_new, difficulty, understanding, pace, homework_notes, comment,
          entered_by_user_id, entered_as)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id) DO UPDATE SET
         learned_new        = excluded.learned_new,
         difficulty         = excluded.difficulty,
         understanding      = excluded.understanding,
         pace               = excluded.pace,
         homework_notes     = excluded.homework_notes,
         comment            = excluded.comment,
         entered_by_user_id = excluded.entered_by_user_id,
         entered_as         = excluded.entered_as,
         updated_at         = ${NOW}`,
    )
    .bind(
      sessionId,
      input.learned_new,
      input.difficulty,
      input.understanding,
      input.pace,
      input.homework_notes,
      input.comment,
      enteredBy.user_id,
      enteredBy.role,
    )
    .run();

  return { revised: Boolean(before) };
}

export async function deleteReflection(db: D1Database, sessionId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM session_reflections WHERE session_id = ?')
    .bind(sessionId)
    .run();
  return Boolean(result.meta.changes);
}

interface ReflectionRow extends Omit<SessionReflection, 'session_id'> {
  session_id: string;
  occurred_on: string;
  student_user_id: string;
  student_name: string;
}

/**
 * The latest reflections on lessons a tutor TAUGHT, newest first -- for their
 * dashboard. Only their own lessons, even when they also parent or are
 * taught themselves: a role's dashboard shows that role's data.
 */
export async function listRecentReflections(
  db: D1Database,
  tutorUserId: string,
  limit = 5,
): Promise<ReflectionDigest[]> {
  const result = await db
    .prepare(
      `SELECT r.session_id, s.occurred_on, s.student_user_id, st.full_name AS student_name,
              r.learned_new, r.difficulty, r.understanding, r.pace,
              r.homework_notes, r.comment, r.entered_by_user_id,
              eb.full_name AS entered_by_name, r.entered_as, r.created_at, r.updated_at
       FROM session_reflections r
       JOIN sessions s  ON s.id  = r.session_id
       JOIN users st    ON st.id = s.student_user_id
       LEFT JOIN users eb ON eb.id = r.entered_by_user_id
       WHERE s.tutor_user_id = ?
       ORDER BY r.updated_at DESC
       LIMIT ?`,
    )
    .bind(tutorUserId, limit)
    .all<ReflectionRow>();

  return (result.results ?? []).map(({ occurred_on, student_user_id, student_name, ...reflection }) => ({
    session_id: reflection.session_id,
    occurred_on,
    student_user_id,
    student_name,
    reflection,
  }));
}

/**
 * Recent lessons still waiting for the student's reflection, newest first,
 * for a dashboard prompt. `where` narrows to the dashboard's own lessons --
 * a student's, or a parent's children's that they did not teach -- and is
 * built from bound values inside the API, never from a request.
 */
export async function listAwaitingReflection(
  db: D1Database,
  where: { sql: string; values: unknown[] },
  since: string,
  limit = 5,
): Promise<ReflectionPrompt[]> {
  const result = await db
    .prepare(
      `SELECT s.id AS session_id, s.occurred_on, s.started_at,
              s.student_user_id, st.full_name AS student_name,
              s.tutor_user_id, t.full_name AS tutor_name
       FROM sessions s
       JOIN users st ON st.id = s.student_user_id
       JOIN users t  ON t.id  = s.tutor_user_id
       WHERE ${where.sql}
         AND s.occurred_on >= ?
         AND NOT EXISTS (SELECT 1 FROM session_reflections r WHERE r.session_id = s.id)
       ORDER BY s.occurred_on DESC, s.started_at DESC
       LIMIT ?`,
    )
    .bind(...where.values, since, limit)
    .all<ReflectionPrompt>();

  return result.results ?? [];
}

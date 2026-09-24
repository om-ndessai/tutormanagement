import {
  isWriteUpEmpty,
  type SessionAssessorRole,
  type SessionWriteUpPayload,
} from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Writes a lesson's structured notes, replacing whatever was there.
 *
 * A write-up with every part empty is removed rather than stored, so a lesson
 * reads as having no write-up -- null -- instead of as five blanks.
 */
export async function saveWriteUp(
  db: D1Database,
  sessionId: string,
  writeUp: SessionWriteUpPayload,
): Promise<void> {
  if (isWriteUpEmpty(writeUp)) {
    await db.prepare('DELETE FROM session_write_ups WHERE session_id = ?').bind(sessionId).run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO session_write_ups
         (session_id, planned, previous_review, homework_review, homework_status, homework_assigned)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id) DO UPDATE SET
         planned           = excluded.planned,
         previous_review   = excluded.previous_review,
         homework_review   = excluded.homework_review,
         homework_status   = excluded.homework_status,
         homework_assigned = excluded.homework_assigned,
         updated_at        = ${NOW}`,
    )
    .bind(
      sessionId,
      writeUp.planned,
      writeUp.previous_review,
      writeUp.homework_review,
      writeUp.homework_status,
      writeUp.homework_assigned,
    )
    .run();
}

/**
 * Records somebody's assessment of a lesson, or replaces the one they gave
 * before. Returns whether they had already assessed it, so the log can say
 * "revised" rather than "gave".
 *
 * The role is recorded again on a revision: it is decided afresh from how
 * they relate to the lesson each time they write, and somebody who no longer
 * relates to it cannot see it to revise it.
 */
export async function saveAssessment(
  db: D1Database,
  sessionId: string,
  authorUserId: string,
  role: SessionAssessorRole,
  input: { rating: number | null; body: string | null },
): Promise<{ revised: boolean }> {
  const before = await db
    .prepare('SELECT 1 AS found FROM session_assessments WHERE session_id = ? AND author_user_id = ?')
    .bind(sessionId, authorUserId)
    .first<{ found: number }>();

  await db
    .prepare(
      `INSERT INTO session_assessments (session_id, author_user_id, author_role, rating, body)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (session_id, author_user_id) DO UPDATE SET
         author_role = excluded.author_role,
         rating      = excluded.rating,
         body        = excluded.body,
         updated_at  = ${NOW}`,
    )
    .bind(sessionId, authorUserId, role, input.rating, input.body)
    .run();

  return { revised: Boolean(before) };
}

/** Withdraws somebody's own assessment. Nobody may remove another's. */
export async function deleteAssessment(
  db: D1Database,
  sessionId: string,
  authorUserId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM session_assessments WHERE session_id = ? AND author_user_id = ?')
    .bind(sessionId, authorUserId)
    .run();

  return Boolean(result.meta.changes);
}

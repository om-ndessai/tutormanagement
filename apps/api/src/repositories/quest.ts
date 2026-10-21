import {
  QUEST_POINTS,
  checkAnswer,
  zonedClockParts,
  type PointsReason,
  type QuestQuestion,
  type QuestReviewDecision,
  type QuestReviewItem,
  type QuestStudent,
  type QuestionChecks,
  type QuestionDifficulty,
  type QuestionKind,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

// Question Quest (Phase 42, docs/gamification-plan.md). Every query names the
// organization; the bank itself is platform reference data, read here only for
// questions this organization's students are served or have answered.

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** A WHERE fragment: the attempts a reviewer may see -- an admin's, every one; a tutor's, their current students'. */
function reviewerScope(org: OrgId, reviewer: { id: string; admin: boolean }): { sql: string; values: unknown[] } {
  if (reviewer.admin) return { sql: '1 = 1', values: [] };
  return {
    sql: `a.student_user_id IN (SELECT s.student_user_id FROM assignments s
                                WHERE s.organization_id = ? AND s.tutor_user_id = ? AND s.is_active = 1)`,
    values: [org, reviewer.id],
  };
}

// ---------------------------------------------------------------------------
// The student's side
// ---------------------------------------------------------------------------

export async function getQuestLevel(db: D1Database, org: OrgId, studentId: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT quest_level_id FROM student_profiles WHERE organization_id = ? AND user_id = ?')
    .bind(org, studentId)
    .first<{ quest_level_id: string | null }>();
  return row?.quest_level_id ?? null;
}

/** Sets a student's level; false when they hold no student profile here. */
export async function setQuestLevel(
  db: D1Database,
  org: OrgId,
  studentId: string,
  levelId: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE student_profiles SET quest_level_id = ?, updated_at = ${NOW}
       WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(levelId, org, studentId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * The next question of a level for a student: the bank's checked questions,
 * chapter by chapter and easier first, from just after the last one they
 * answered in this level (so the read never walks back over what they have
 * done), skipping any they answered, any waiting for a review here already
 * (one answer per question at a time) and standards that need a figure.
 */
export async function nextQuestQuestion(
  db: D1Database,
  org: OrgId,
  studentId: string,
  levelId: string,
): Promise<QuestQuestion | null> {
  const cursor = await db
    .prepare(
      // org-scope: names the organization on quest_attempts; questions is the platform bank.
      `SELECT q.topic_id, q.difficulty, q.rowid AS rid
       FROM quest_attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.organization_id = ? AND a.student_user_id = ? AND a.level_id = ?
       ORDER BY a.submitted_at DESC
       LIMIT 1`,
    )
    .bind(org, studentId, levelId)
    .first<{ topic_id: string; difficulty: number; rid: number }>();

  const row = await db
    .prepare(
      `SELECT q.id, q.kind, q.stem, q.choices FROM questions q
       WHERE q.topic_id >= ?1 AND q.topic_id < ?2 AND q.status = 'checked'
         AND (?3 IS NULL OR q.topic_id > ?3
              OR (q.topic_id = ?3 AND (q.difficulty > ?4 OR (q.difficulty = ?4 AND q.rowid > ?5))))
         AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
         AND NOT EXISTS (SELECT 1 FROM quest_attempts a
                         WHERE a.question_id = q.id AND a.organization_id = ?6
                           AND (a.student_user_id = ?7 OR a.reviewed_at IS NULL))
       ORDER BY q.topic_id, q.difficulty, q.rowid
       LIMIT 1`,
    )
    .bind(
      cursor?.topic_id ?? `${levelId}.`,
      `${levelId}/`,
      cursor?.topic_id ?? null,
      cursor?.difficulty ?? 0,
      cursor?.rid ?? 0,
      org,
      studentId,
    )
    .first<{ id: string; kind: QuestionKind; stem: string; choices: string }>();
  if (!row) return null;
  return { id: row.id, kind: row.kind, stem: row.stem, choices: JSON.parse(row.choices) as string[], level_id: levelId };
}

/** A person's points and counts here, from the daily rollup (a row per active day). */
export async function questTotals(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<{ points: number; answered: number; reviewed: number }> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS points, COALESCE(SUM(answers), 0) AS answered,
              COALESCE(SUM(reviews), 0) AS reviewed
       FROM activity_days WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(org, userId)
    .first<{ points: number; answered: number; reviewed: number }>();
  return row ?? { points: 0, answered: 0, reviewed: 0 };
}

/** The statements that award points: the ledger row and the day's rollup, in one batch with the action. */
function award(
  db: D1Database,
  org: OrgId,
  input: { userId: string; reason: PointsReason; attemptId: string; day: string; answers?: number; reviews?: number },
): D1PreparedStatement[] {
  const points = QUEST_POINTS[input.reason];
  return [
    db
      .prepare(
        `INSERT INTO points_ledger (id, organization_id, user_id, points, reason, attempt_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), org, input.userId, points, input.reason, input.attemptId),
    db
      .prepare(
        `INSERT INTO activity_days (organization_id, user_id, day, answers, reviews, points)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (organization_id, user_id, day) DO UPDATE SET
           answers = answers + ?4, reviews = reviews + ?5, points = points + ?6`,
      )
      .bind(org, input.userId, input.day, input.answers ?? 0, input.reviews ?? 0, points),
  ];
}

/** Records a student's answer, marked by code, with its attempt point. */
export async function recordQuestAnswer(
  db: D1Database,
  org: OrgId,
  input: { studentId: string; question: { id: string; kind: QuestionKind; key: string }; levelId: string; answer: string; timeZone: string },
): Promise<{ attemptId: string; correct: boolean }> {
  const attemptId = crypto.randomUUID();
  const correct = checkAnswer({ kind: input.question.kind, answer: input.question.key }, input.answer);
  const day = zonedClockParts(new Date().toISOString(), input.timeZone).day;
  await db.batch([
    db
      .prepare(
        `INSERT INTO quest_attempts (id, organization_id, student_user_id, question_id, level_id, answer, correct)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(attemptId, org, input.studentId, input.question.id, input.levelId, input.answer, correct ? 1 : 0),
    ...award(db, org, { userId: input.studentId, reason: 'student_attempt', attemptId, day, answers: 1 }),
  ]);
  return { attemptId, correct };
}

/** The key a student's answer is marked against: a checked question, never shown to them. */
export async function questionKey(
  db: D1Database,
  questionId: string,
): Promise<{ id: string; kind: QuestionKind; key: string; status: string } | null> {
  return db
    .prepare(
      // org-scope: the platform bank's own row, read to mark an answer; nothing of an organization's.
      'SELECT id, kind, answer AS key, status FROM questions WHERE id = ?',
    )
    .bind(questionId)
    .first();
}

// ---------------------------------------------------------------------------
// The tutor's side
// ---------------------------------------------------------------------------

interface ReviewRow {
  attempt_id: string;
  student_user_id: string;
  student_name: string;
  submitted_at: string;
  answer: string;
  correct: number;
  question_id: string;
  kind: QuestionKind;
  difficulty: number;
  level_id: string;
  topic_code: string;
  topic_name: string;
  skill: string | null;
  stem: string;
  choices: string;
  key: string;
  solution: string;
  checks: string;
}

const REVIEW_SELECT = `
  SELECT a.id AS attempt_id, a.student_user_id, u.full_name AS student_name, a.submitted_at, a.answer, a.correct,
         q.id AS question_id, q.kind, q.difficulty, a.level_id, COALESCE(t.code, t.id) AS topic_code,
         t.name AS topic_name, q.skill, q.stem, q.choices, q.answer AS key, q.solution, q.checks
  FROM quest_attempts a
  JOIN users u ON u.id = a.student_user_id
  JOIN questions q ON q.id = a.question_id
  JOIN curriculum_topics t ON t.id = q.topic_id`;

function toReviewItem(row: ReviewRow): QuestReviewItem {
  const checks = JSON.parse(row.checks) as QuestionChecks;
  return {
    attempt_id: row.attempt_id,
    student_user_id: row.student_user_id,
    student_name: row.student_name,
    submitted_at: row.submitted_at,
    answer: row.answer,
    correct: row.correct === 1,
    question: {
      id: row.question_id,
      kind: row.kind,
      difficulty: row.difficulty as QuestionDifficulty,
      level_id: row.level_id,
      topic_code: row.topic_code,
      topic_name: row.topic_name,
      skill: row.skill,
      stem: row.stem,
      choices: JSON.parse(row.choices) as string[],
      answer: row.key,
      solution: row.solution,
      solver_answer: checks.solve?.answer ?? null,
      solver_issues: checks.solve?.issues || null,
    },
  };
}

/** The oldest answer waiting for this reviewer, and how many wait. */
export async function nextQuestReview(
  db: D1Database,
  org: OrgId,
  reviewer: { id: string; admin: boolean },
): Promise<{ item: QuestReviewItem | null; waiting: number }> {
  const scope = reviewerScope(org, reviewer);
  const [row, count] = await Promise.all([
    db
      .prepare(
        // org-scope: the catalog row names the standard of a question this organization's student answered.
        `${REVIEW_SELECT}
         WHERE a.organization_id = ? AND a.reviewed_at IS NULL AND ${scope.sql}
         ORDER BY a.submitted_at
         LIMIT 1`,
      )
      .bind(org, ...scope.values)
      .first<ReviewRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM quest_attempts a
         WHERE a.organization_id = ? AND a.reviewed_at IS NULL AND ${scope.sql}`,
      )
      .bind(org, ...scope.values)
      .first<{ n: number }>(),
  ]);
  return { item: row ? toReviewItem(row) : null, waiting: count?.n ?? 0 };
}

/** One attempt as this reviewer may see it (404 otherwise), reviewed or not. */
export async function getQuestAttempt(
  db: D1Database,
  org: OrgId,
  reviewer: { id: string; admin: boolean },
  attemptId: string,
): Promise<(QuestReviewItem & { reviewed: boolean }) | null> {
  const scope = reviewerScope(org, reviewer);
  const row = await db
    .prepare(
      // org-scope: the catalog row names the standard of a question this organization's student answered.
      `${REVIEW_SELECT.replace('SELECT a.id', 'SELECT a.reviewed_at IS NOT NULL AS reviewed, a.id')}
       WHERE a.organization_id = ? AND a.id = ? AND ${scope.sql}`,
    )
    .bind(org, attemptId, ...scope.values)
    .first<ReviewRow & { reviewed: number }>();
  return row ? { ...toReviewItem(row), reviewed: row.reviewed === 1 } : null;
}

/**
 * Applies a tutor's review in one batch: the attempt's review; the question
 * approved for the whole platform (approved_via 'quest') or flagged with the
 * reason, only while it is still checked; and the points -- the review point
 * to the tutor whatever the outcome, and when the student was right and the
 * question approved, a correctness point to the student. False when somebody
 * reviewed it first.
 */
export async function applyQuestReview(
  db: D1Database,
  org: OrgId,
  input: {
    attempt: QuestReviewItem;
    reviewerId: string;
    reviewerName: string;
    decision: QuestReviewDecision;
    note: string | null;
    timeZone: string;
  },
): Promise<boolean> {
  const { attempt } = input;
  const claimed = await db
    .prepare(
      `UPDATE quest_attempts SET review = ?, review_note = ?, reviewed_by_user_id = ?, reviewed_at = ${NOW}
       WHERE organization_id = ? AND id = ? AND reviewed_at IS NULL`,
    )
    .bind(input.decision === 'approve' ? 'approved' : 'flagged', input.note, input.reviewerId, org, attempt.attempt_id)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) return false;

  const day = zonedClockParts(new Date().toISOString(), input.timeZone).day;
  const statements: D1PreparedStatement[] = [
    input.decision === 'approve'
      ? db
          .prepare(
            // org-scope: approving a platform question is the platform's act, done here by the owner's rule (Phase 42).
            `UPDATE questions SET status = 'approved', reviewed_by = ?, reviewed_at = ${NOW}, approved_via = 'quest',
                    updated_at = ${NOW}
             WHERE id = ? AND status = 'checked'`,
          )
          .bind(input.reviewerId, attempt.question.id)
      : db
          .prepare(
            // org-scope: flagging a platform question, with the tutor's reason for the console.
            `UPDATE questions SET status = 'flagged',
                    checks = json_set(checks, '$.quest_flag', json_object('note', ?, 'by', ?, 'at', ${NOW})),
                    updated_at = ${NOW}
             WHERE id = ? AND status = 'checked'`,
          )
          .bind(input.note ?? '', input.reviewerName, attempt.question.id),
    ...award(db, org, { userId: input.reviewerId, reason: 'tutor_review', attemptId: attempt.attempt_id, day, reviews: 1 }),
  ];
  if (input.decision === 'approve' && attempt.correct) {
    statements.push(
      ...award(db, org, { userId: attempt.student_user_id, reason: 'student_correct', attemptId: attempt.attempt_id, day }),
    );
  }
  await db.batch(statements);
  return true;
}

// ---------------------------------------------------------------------------
// Managing students' Quest
// ---------------------------------------------------------------------------

/** The students a reviewer manages: an admin's, every student here; a tutor's, their current students. */
export async function listQuestStudents(
  db: D1Database,
  org: OrgId,
  reviewer: { id: string; admin: boolean },
): Promise<QuestStudent[]> {
  const scope = reviewer.admin
    ? { sql: '1 = 1', values: [] as unknown[] }
    : {
        sql: `p.user_id IN (SELECT s.student_user_id FROM assignments s
                            WHERE s.organization_id = ? AND s.tutor_user_id = ? AND s.is_active = 1)`,
        values: [org, reviewer.id] as unknown[],
      };
  const result = await db
    .prepare(
      `SELECT p.user_id, u.full_name, p.quest_level_id AS level_id,
              (SELECT COALESCE(SUM(d.answers), 0) FROM activity_days d
                WHERE d.organization_id = p.organization_id AND d.user_id = p.user_id) AS answered,
              (SELECT COALESCE(SUM(d.points), 0) FROM activity_days d
                WHERE d.organization_id = p.organization_id AND d.user_id = p.user_id) AS points,
              (SELECT MAX(d.day) FROM activity_days d
                WHERE d.organization_id = p.organization_id AND d.user_id = p.user_id) AS last_active,
              (SELECT COUNT(*) FROM quest_attempts a
                WHERE a.organization_id = p.organization_id AND a.student_user_id = p.user_id
                  AND a.reviewed_at IS NULL) AS waiting,
              (SELECT COUNT(*) FROM quest_attempts a
                WHERE a.organization_id = p.organization_id AND a.student_user_id = p.user_id
                  AND a.review = 'approved' AND a.correct = 1) AS confirmed
       FROM student_profiles p
       JOIN users u ON u.id = p.user_id
       JOIN org_members m ON m.organization_id = p.organization_id AND m.user_id = p.user_id
       WHERE p.organization_id = ? AND u.deleted_at IS NULL AND m.removed_at IS NULL AND m.status != 'suspended'
         AND ${scope.sql}
       ORDER BY u.full_name`,
    )
    .bind(org, ...scope.values)
    .all<QuestStudent>();
  return result.results ?? [];
}

/** Whether a reviewer manages this student here (an admin: any student here). */
export async function managesQuestStudent(
  db: D1Database,
  org: OrgId,
  reviewer: { id: string; admin: boolean },
  studentId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM student_profiles p
       WHERE p.organization_id = ?1 AND p.user_id = ?2
         AND (?3 = 1 OR EXISTS (SELECT 1 FROM assignments s
                                WHERE s.organization_id = ?1 AND s.student_user_id = ?2
                                  AND s.tutor_user_id = ?4 AND s.is_active = 1))`,
    )
    .bind(org, studentId, reviewer.admin ? 1 : 0, reviewer.id)
    .first();
  return Boolean(row);
}

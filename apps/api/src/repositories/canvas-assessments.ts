import {
  QUESTION_BANK_LEVEL_IDS,
  QUESTION_BANK_LEVEL_LABELS,
  drawableStatuses,
  type CanvasAssessment,
  type CanvasAssessmentLevel,
  type CanvasAssessmentStatus,
  type QuestionBankLevelId,
  type User,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { isAdmin, studentScopeSql } from '../lib/scope.js';

// Phase 38: the Assessment menu (beta). Who reads what is R17
// (docs/data-exposure.md): the rows reach the student's audience
// (studentScopeSql); the PDF only the student's current tutors and the admins.

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export type CanvasFileKind = 'answers' | 'strokes' | 'evaluated';

interface AssessmentRow {
  id: string;
  student_user_id: string;
  student_name: string;
  started_by_user_id: string;
  started_by_name: string;
  level_id: string;
  question_ids: string;
  status: CanvasAssessmentStatus;
  questions_written: number;
  choice_questions: number;
  choices_answered: number;
  choices_correct: number;
  unreviewed_questions: number;
  started_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_status: 'draft' | 'final' | null;
  tutors_student: number;
}

/** The row as stored, for the routes that act on it. */
export interface StoredCanvasAssessment {
  id: string;
  student_user_id: string;
  student_name: string;
  started_by_user_id: string;
  started_by_name: string;
  level_id: string;
  question_ids: string[];
  status: CanvasAssessmentStatus;
  started_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** The viewer may open its PDF: an admin, or one of the student's current tutors. */
  can_review: boolean;
}

/**
 * Every column a reader is shown, and whether the viewer currently tutors the
 * student -- which decides the PDF and the name of whoever started it.
 */
const SELECT_ROWS = `
  SELECT c.id, c.student_user_id, s.full_name AS student_name, c.started_by_user_id,
         b.full_name AS started_by_name, c.level_id, c.question_ids, c.status,
         c.questions_written, c.choice_questions, c.choices_answered, c.choices_correct,
         c.unreviewed_questions, c.started_at, c.submitted_at, c.reviewed_at,
         r.full_name AS reviewed_by_name, v.status AS review_status,
         EXISTS (SELECT 1 FROM assignments a
                 WHERE a.organization_id = c.organization_id AND a.student_user_id = c.student_user_id
                   AND a.tutor_user_id = ? AND a.is_active = 1) AS tutors_student
  FROM canvas_assessments c
  JOIN users s ON s.id = c.student_user_id
  JOIN users b ON b.id = c.started_by_user_id
  LEFT JOIN users r ON r.id = c.reviewed_by_user_id
  LEFT JOIN canvas_assessment_reviews v ON v.assessment_id = c.id`;

function canReview(viewer: User, row: AssessmentRow): boolean {
  return isAdmin(viewer) || row.tutors_student === 1;
}

function toStored(viewer: User, row: AssessmentRow): StoredCanvasAssessment {
  return {
    id: row.id,
    student_user_id: row.student_user_id,
    student_name: row.student_name,
    started_by_user_id: row.started_by_user_id,
    started_by_name: row.started_by_name,
    level_id: row.level_id,
    question_ids: JSON.parse(row.question_ids) as string[],
    status: row.status,
    started_at: row.started_at,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    can_review: canReview(viewer, row),
  };
}

/** What a reader is shown (R17): who started it only to its reviewers and to that person. */
export function toCanvasAssessment(viewer: User, row: AssessmentRow): CanvasAssessment {
  const review = canReview(viewer, row);
  const mine = row.started_by_user_id === viewer.id;
  return {
    id: row.id,
    student_user_id: row.student_user_id,
    student_name: row.student_name,
    started_by_name: review || mine ? row.started_by_name : null,
    level_id: row.level_id,
    status: row.status,
    question_count: (JSON.parse(row.question_ids) as string[]).length,
    questions_written: row.questions_written,
    // The score is the reviewers' to tell the family, as the PDF is (R17).
    choice_questions: review && row.status === 'submitted' ? row.choice_questions : null,
    choices_answered: review && row.status === 'submitted' ? row.choices_answered : null,
    choices_correct: review && row.status === 'submitted' ? row.choices_correct : null,
    unreviewed_questions: review ? row.unreviewed_questions : null,
    started_at: row.started_at,
    submitted_at: row.submitted_at,
    can_review: review && row.status === 'submitted',
    can_continue: mine && row.status === 'in_progress',
    // Phase 40: once saved as reviewed, the student's whole audience reads the review.
    reviewed_at: row.reviewed_at,
    reviewed_by_name: row.reviewed_at ? row.reviewed_by_name : null,
    review_draft: review ? row.review_status === 'draft' : null,
  };
}

export async function listCanvasAssessments(
  db: D1Database,
  org: OrgId,
  viewer: User,
  limit = 100,
): Promise<CanvasAssessment[]> {
  const scope = studentScopeSql(viewer, 'c.student_user_id', org);
  const result = await db
    .prepare(
      `${SELECT_ROWS}
       WHERE c.organization_id = ? AND ${scope.sql}
       ORDER BY c.started_at DESC
       LIMIT ?`,
    )
    .bind(viewer.id, org, ...scope.values, limit)
    .all<AssessmentRow>();
  return (result.results ?? []).map((row) => toCanvasAssessment(viewer, row));
}

/** One the viewer may list, or null: a row they cannot list reads as missing (404). */
export async function getVisibleCanvasAssessment(
  db: D1Database,
  org: OrgId,
  viewer: User,
  id: string,
): Promise<{ shown: CanvasAssessment; stored: StoredCanvasAssessment } | null> {
  const scope = studentScopeSql(viewer, 'c.student_user_id', org);
  const row = await db
    .prepare(`${SELECT_ROWS} WHERE c.id = ? AND c.organization_id = ? AND ${scope.sql}`)
    .bind(viewer.id, id, org, ...scope.values)
    .first<AssessmentRow>();
  return row ? { shown: toCanvasAssessment(viewer, row), stored: toStored(viewer, row) } : null;
}

/**
 * How many approved questions each bank level can draw on. Standards marked
 * "needs a figure" are left out, as from every test. The bank is platform
 * reference data; the approved few are read through `questions_status_idx`.
 */
export async function countDrawableQuestions(
  db: D1Database,
  includeUnreviewed: boolean,
): Promise<CanvasAssessmentLevel[]> {
  const statuses = drawableStatuses(includeUnreviewed);
  // One row per standard and status: about 100 standards, so the grouping is
  // small even when the 9,700 checked questions are counted.
  const result = await db
    .prepare(
      `SELECT q.topic_id, q.status, COUNT(*) AS n FROM questions q
       WHERE q.status IN (${statuses.map(() => '?').join(', ')})
         AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
       GROUP BY q.topic_id, q.status`,
    )
    .bind(...statuses)
    .all<{ topic_id: string; status: string; n: number }>();
  const counts = new Map<string, { available: number; unreviewed: number }>();
  for (const row of result.results ?? []) {
    const level = QUESTION_BANK_LEVEL_IDS.find((id) => row.topic_id.startsWith(`${id}.`));
    if (!level) continue;
    const entry = counts.get(level) ?? { available: 0, unreviewed: 0 };
    entry.available += row.n;
    if (row.status !== 'approved') entry.unreviewed += row.n;
    counts.set(level, entry);
  }
  return QUESTION_BANK_LEVEL_IDS.map((level_id: QuestionBankLevelId) => ({
    level_id,
    label: QUESTION_BANK_LEVEL_LABELS[level_id],
    available: counts.get(level_id)?.available ?? 0,
    unreviewed: counts.get(level_id)?.unreviewed ?? 0,
  }));
}

/**
 * Up to `count` questions of a level, at random: approved ones, and -- on the
 * organization's trial flag -- checked ones too. Through `questions_topic_idx`
 * (topic, status), so even the checked thousands are read by range.
 */
export async function drawQuestionIds(
  db: D1Database,
  levelId: QuestionBankLevelId,
  count: number,
  includeUnreviewed: boolean,
): Promise<{ ids: string[]; unreviewed: number }> {
  const statuses = drawableStatuses(includeUnreviewed);
  const result = await db
    .prepare(
      `SELECT q.id, q.status FROM questions q
       WHERE q.topic_id >= ? AND q.topic_id < ? AND q.status IN (${statuses.map(() => '?').join(', ')})
         AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
       ORDER BY random()
       LIMIT ?`,
    )
    // Every topic of the level sorts between 'NC26.5.' and 'NC26.5/' ('/' follows '.').
    .bind(`${levelId}.`, `${levelId}/`, ...statuses, count)
    .all<{ id: string; status: string }>();
  const rows = result.results ?? [];
  return { ids: rows.map((row) => row.id), unreviewed: rows.filter((row) => row.status !== 'approved').length };
}

export async function insertCanvasAssessment(
  db: D1Database,
  org: OrgId,
  input: { studentId: string; startedBy: string; levelId: string; questionIds: string[]; unreviewed: number },
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO canvas_assessments
         (id, organization_id, student_user_id, started_by_user_id, level_id, question_ids, unreviewed_questions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, org, input.studentId, input.startedBy, input.levelId, JSON.stringify(input.questionIds), input.unreviewed)
    .run();
  return id;
}

export interface CanvasFile {
  kind: CanvasFileKind;
  contentType: string;
  bytes: Uint8Array;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stores the files and marks it submitted, in one batch. Only an attempt
 * still in progress changes; the caller has checked that, and the files are
 * replaced rather than duplicated if two submissions ever race.
 */
export async function submitCanvasAssessment(
  db: D1Database,
  org: OrgId,
  id: string,
  counts: { written: number; choiceQuestions: number; choicesAnswered: number; choicesCorrect: number },
  files: readonly CanvasFile[],
): Promise<boolean> {
  const statements = [];
  for (const file of files) {
    statements.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO canvas_assessment_files
             (assessment_id, kind, organization_id, content_type, bytes, size, sha256)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, file.kind, org, file.contentType, file.bytes, file.bytes.length, await sha256Hex(file.bytes)),
    );
  }
  statements.push(
    db
      .prepare(
        `UPDATE canvas_assessments
         SET status = 'submitted', submitted_at = ${NOW}, questions_written = ?,
             choice_questions = ?, choices_answered = ?, choices_correct = ?
         WHERE id = ? AND organization_id = ? AND status = 'in_progress'`,
      )
      .bind(counts.written, counts.choiceQuestions, counts.choicesAnswered, counts.choicesCorrect, id, org),
  );
  const results = await db.batch(statements);
  return (results.at(-1)?.meta.changes ?? 0) > 0;
}

export async function discardCanvasAssessment(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE canvas_assessments SET status = 'discarded'
       WHERE id = ? AND organization_id = ? AND status = 'in_progress'`,
    )
    .bind(id, org)
    .run();
  return result.meta.changes > 0;
}

export async function getCanvasAssessmentFile(
  db: D1Database,
  org: OrgId,
  id: string,
  kind: CanvasFileKind,
): Promise<{ contentType: string; bytes: Uint8Array } | null> {
  const row = await db
    .prepare(
      `SELECT content_type, bytes FROM canvas_assessment_files
       WHERE assessment_id = ? AND organization_id = ? AND kind = ?`,
    )
    .bind(id, org, kind)
    .first<{ content_type: string; bytes: ArrayBuffer | number[] }>();
  if (!row) return null;
  return {
    contentType: row.content_type,
    bytes: Array.isArray(row.bytes) ? new Uint8Array(row.bytes) : new Uint8Array(row.bytes),
  };
}

// ---------------------------------------------------------------------------
// Reviews (Phase 40)
// ---------------------------------------------------------------------------

export interface StoredReview {
  status: 'draft' | 'final';
  notes: Record<string, string>;
  comment: string;
  /** Still deflated: the routes inflate it. */
  ink: Uint8Array | null;
  reviewer_name: string;
  updated_at: string;
  finished_at: string | null;
}

function asBytes(value: ArrayBuffer | number[] | null): Uint8Array | null {
  if (value === null) return null;
  return Array.isArray(value) ? new Uint8Array(value) : new Uint8Array(value);
}

export async function getReview(db: D1Database, org: OrgId, id: string): Promise<StoredReview | null> {
  const row = await db
    .prepare(
      `SELECT v.status, v.notes, v.comment, v.ink, u.full_name AS reviewer_name, v.updated_at, v.finished_at
       FROM canvas_assessment_reviews v JOIN users u ON u.id = v.reviewer_user_id
       WHERE v.assessment_id = ? AND v.organization_id = ?`,
    )
    .bind(id, org)
    .first<{
      status: 'draft' | 'final';
      notes: string;
      comment: string;
      ink: ArrayBuffer | number[] | null;
      reviewer_name: string;
      updated_at: string;
      finished_at: string | null;
    }>();
  if (!row) return null;
  return { ...row, notes: JSON.parse(row.notes) as Record<string, string>, ink: asBytes(row.ink) };
}

/** Saves the draft: a new one, or the existing draft. A final review is reopened first. */
export async function saveReviewDraft(
  db: D1Database,
  org: OrgId,
  id: string,
  reviewer: string,
  input: { notes: Record<string, string>; comment: string; ink: Uint8Array },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO canvas_assessment_reviews (assessment_id, organization_id, reviewer_user_id, notes, comment, ink)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (assessment_id) DO UPDATE SET
         reviewer_user_id = excluded.reviewer_user_id, notes = excluded.notes, comment = excluded.comment,
         ink = excluded.ink, updated_at = ${NOW}
       WHERE canvas_assessment_reviews.status = 'draft'`,
    )
    .bind(id, org, reviewer, JSON.stringify(input.notes), input.comment, input.ink)
    .run();
  return result.meta.changes > 0;
}

/** Saves it as reviewed: the PDF on the review, and who and when on the assessment. */
export async function finishReview(
  db: D1Database,
  org: OrgId,
  id: string,
  reviewer: string,
  pdf: Uint8Array,
): Promise<boolean> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE canvas_assessment_reviews
         SET status = 'final', pdf = ?, pdf_size = ?, finished_at = ${NOW}, updated_at = ${NOW}, reviewer_user_id = ?
         WHERE assessment_id = ? AND organization_id = ? AND status = 'draft'`,
      )
      .bind(pdf, pdf.length, reviewer, id, org),
    db
      .prepare(
        `UPDATE canvas_assessments SET reviewed_by_user_id = ?, reviewed_at = ${NOW}
         WHERE id = ? AND organization_id = ? AND status = 'submitted'
           AND EXISTS (SELECT 1 FROM canvas_assessment_reviews v
                       WHERE v.assessment_id = canvas_assessments.id AND v.status = 'final')`,
      )
      .bind(reviewer, id, org),
  ]);
  return (results[0]?.meta.changes ?? 0) > 0;
}

/** Reopens a finished review as a draft; its PDF goes until it is saved as reviewed again. */
export async function reopenReview(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE canvas_assessment_reviews
         SET status = 'draft', pdf = NULL, pdf_size = NULL, finished_at = NULL, updated_at = ${NOW}
         WHERE assessment_id = ? AND organization_id = ? AND status = 'final'`,
      )
      .bind(id, org),
    db
      .prepare(
        `UPDATE canvas_assessments SET reviewed_by_user_id = NULL, reviewed_at = NULL
         WHERE id = ? AND organization_id = ?`,
      )
      .bind(id, org),
  ]);
  return (results[0]?.meta.changes ?? 0) > 0;
}

export async function getReviewedPdf(db: D1Database, org: OrgId, id: string): Promise<Uint8Array | null> {
  const row = await db
    .prepare(
      `SELECT pdf FROM canvas_assessment_reviews
       WHERE assessment_id = ? AND organization_id = ? AND status = 'final'`,
    )
    .bind(id, org)
    .first<{ pdf: ArrayBuffer | number[] | null }>();
  return row ? asBytes(row.pdf) : null;
}

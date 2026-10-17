import {
  QUESTION_BANK_LEVEL_IDS,
  type Question,
  type QuestionChecks,
  type QuestionCoverageLevel,
  type QuestionDifficulty,
  type QuestionKind,
  type QuestionStatus,
} from '@tmi/shared';

import type { BankStandard } from '../lib/ai/question-bank.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const LEVELS_SQL = QUESTION_BANK_LEVEL_IDS.map(() => '?').join(', ');

// The question bank (Phase 36): platform reference data. Its queries read the
// catalog without an organization's list -- the console runs outside every
// organization, and the bank is the platform's -- so each says so with an
// `org-scope:` comment, as check-org-scope.mjs asks.

interface QuestionRow {
  id: string;
  topic_id: string;
  topic_code: string;
  topic_name: string;
  level_id: string;
  level_name: string;
  difficulty: number;
  kind: QuestionKind;
  skill: string | null;
  stem: string;
  choices: string;
  answer: string;
  compute: string | null;
  solution: string;
  status: QuestionStatus;
  checks: string;
  source: 'ai' | 'manual';
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  times_used: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
}

const SELECT_QUESTION = `
  SELECT q.id, q.topic_id, COALESCE(t.code, t.id) AS topic_code, t.name AS topic_name,
         t.level_id, l.name AS level_name, q.difficulty, q.kind, q.skill, q.stem, q.choices,
         q.answer, q.compute, q.solution, q.status, q.checks, q.source,
         u.full_name AS reviewed_by_name, q.reviewed_at, q.times_used, q.times_correct,
         q.created_at, q.updated_at
  FROM questions q
  JOIN curriculum_topics t ON t.id = q.topic_id
  JOIN curriculum_levels l ON l.id = t.level_id
  LEFT JOIN users u ON u.id = q.reviewed_by`;

function toQuestion(row: QuestionRow): Question {
  return {
    ...row,
    difficulty: row.difficulty as QuestionDifficulty,
    choices: JSON.parse(row.choices) as string[],
    checks: JSON.parse(row.checks) as QuestionChecks,
  };
}

/** A standard the bank covers, for the prompts; null for any other topic. */
export async function getBankStandard(db: D1Database, topicId: string): Promise<BankStandard | null> {
  return db
    .prepare(
      // org-scope: the platform's question bank reads the platform catalog.
      `SELECT COALESCE(t.code, t.id) AS code, t.name, t.description, t.unit, l.name AS level_name
       FROM curriculum_topics t JOIN curriculum_levels l ON l.id = t.level_id
       WHERE t.id = ? AND l.id IN (${LEVELS_SQL})`,
    )
    .bind(topicId, ...QUESTION_BANK_LEVEL_IDS)
    .first<BankStandard>();
}

export async function listQuestions(
  db: D1Database,
  filter: { topic_id?: string; status?: QuestionStatus; level_id?: string; limit: number },
): Promise<Question[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.topic_id) {
    where.push('q.topic_id = ?');
    binds.push(filter.topic_id);
  }
  if (filter.status) {
    where.push('q.status = ?');
    binds.push(filter.status);
  }
  if (filter.level_id) {
    where.push('t.level_id = ?');
    binds.push(filter.level_id);
  }
  const result = await db
    .prepare(
      // org-scope: the platform's question bank reads the platform catalog.
      `${SELECT_QUESTION}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY l.stage, t.number, q.difficulty, q.created_at
       LIMIT ?`,
    )
    .bind(...binds, filter.limit)
    .all<QuestionRow>();
  return (result.results ?? []).map(toQuestion);
}

export async function getQuestions(db: D1Database, ids: readonly string[]): Promise<Question[]> {
  if (ids.length === 0) return [];
  const result = await db
    .prepare(
      // org-scope: the platform's question bank reads the platform catalog.
      `${SELECT_QUESTION} WHERE q.id IN (${ids.map(() => '?').join(', ')})`,
    )
    .bind(...ids)
    .all<QuestionRow>();
  // In the order asked for: a check's refs follow it.
  const order = new Map(ids.map((id, index) => [id, index]));
  return (result.results ?? []).map(toQuestion).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function getQuestion(db: D1Database, id: string): Promise<Question | null> {
  return (await getQuestions(db, [id]))[0] ?? null;
}

/** The stems on a standard a new question must not repeat: everything not retired. */
export async function liveStems(db: D1Database, topicId: string, exceptId?: string): Promise<string[]> {
  const result = await db
    .prepare(`SELECT stem FROM questions WHERE topic_id = ? AND status != 'retired' AND id != ?`)
    .bind(topicId, exceptId ?? '')
    .all<{ stem: string }>();
  return (result.results ?? []).map((row) => row.stem);
}

export async function countQuestions(db: D1Database, topicId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM questions WHERE topic_id = ?')
    .bind(topicId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export interface NewQuestion {
  topic_id: string;
  difficulty: number;
  kind: QuestionKind;
  skill: string | null;
  stem: string;
  choices: string[];
  answer: string;
  compute: string | null;
  solution: string;
  status: QuestionStatus;
  checks: QuestionChecks;
  draft_run_id: string | null;
}

export async function insertQuestions(db: D1Database, questions: readonly NewQuestion[]): Promise<string[]> {
  if (questions.length === 0) return [];
  const ids = questions.map(() => crypto.randomUUID());
  await db.batch(
    questions.map((q, index) =>
      db
        .prepare(
          `INSERT INTO questions (id, topic_id, difficulty, kind, skill, stem, choices, answer, compute,
                                  solution, status, checks, source, draft_run_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?)`,
        )
        .bind(
          ids[index],
          q.topic_id,
          q.difficulty,
          q.kind,
          q.skill,
          q.stem,
          JSON.stringify(q.choices),
          q.answer,
          q.compute,
          q.solution,
          q.status,
          JSON.stringify(q.checks),
          q.draft_run_id,
        ),
    ),
  );
  return ids;
}

/** The content and checks after an edit; the status follows from the checks. */
export async function updateQuestion(
  db: D1Database,
  id: string,
  fields: {
    difficulty: number;
    kind: QuestionKind;
    stem: string;
    choices: string[];
    answer: string;
    compute: string | null;
    solution: string;
    status: QuestionStatus;
    checks: QuestionChecks;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE questions SET difficulty = ?, kind = ?, stem = ?, choices = ?, answer = ?, compute = ?,
              solution = ?, status = ?, checks = ?, source = 'manual', reviewed_by = NULL,
              reviewed_at = NULL, updated_at = ${NOW}
       WHERE id = ?`,
    )
    .bind(
      fields.difficulty,
      fields.kind,
      fields.stem,
      JSON.stringify(fields.choices),
      fields.answer,
      fields.compute,
      fields.solution,
      fields.status,
      JSON.stringify(fields.checks),
      id,
    )
    .run();
}

/** A check's result. Only a question still in the state it was checked in moves. */
export async function setChecks(
  db: D1Database,
  id: string,
  checkedAt: string,
  status: QuestionStatus,
  checks: QuestionChecks,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE questions SET status = ?, checks = ?, updated_at = ${NOW}
       WHERE id = ? AND updated_at = ? AND status IN ('draft', 'checked', 'flagged')`,
    )
    .bind(status, JSON.stringify(checks), id, checkedAt)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function setStatus(
  db: D1Database,
  id: string,
  status: QuestionStatus,
  reviewer: string | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE questions SET status = ?, reviewed_by = ?, reviewed_at = CASE WHEN ? IS NULL THEN NULL ELSE ${NOW} END,
              updated_at = ${NOW}
       WHERE id = ?`,
    )
    .bind(status, reviewer, reviewer, id)
    .run();
}

export async function setNeedsFigure(db: D1Database, topicId: string, needsFigure: boolean): Promise<void> {
  await db
    .prepare(
      `INSERT INTO question_bank_topics (topic_id, needs_figure) VALUES (?, ?)
       ON CONFLICT (topic_id) DO UPDATE SET needs_figure = excluded.needs_figure, updated_at = ${NOW}`,
    )
    .bind(topicId, needsFigure ? 1 : 0)
    .run();
}

interface CoverageRow {
  level_id: string;
  level_name: string;
  topic_id: string;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  needs_figure: number;
  a1: number;
  a2: number;
  a3: number;
  checked: number;
  flagged: number;
  draft: number;
}

/** Every standard the bank covers, in catalog order, with its counts. */
export async function coverage(db: D1Database): Promise<QuestionCoverageLevel[]> {
  const result = await db
    .prepare(
      // org-scope: the platform's question bank reads the platform catalog.
      `SELECT l.id AS level_id, l.name AS level_name, t.id AS topic_id, COALESCE(t.code, t.id) AS code,
              t.name, t.unit, t.description, COALESCE(b.needs_figure, 0) AS needs_figure,
              COALESCE(SUM(q.status = 'approved' AND q.difficulty = 1), 0) AS a1,
              COALESCE(SUM(q.status = 'approved' AND q.difficulty = 2), 0) AS a2,
              COALESCE(SUM(q.status = 'approved' AND q.difficulty = 3), 0) AS a3,
              COALESCE(SUM(q.status = 'checked'), 0) AS checked,
              COALESCE(SUM(q.status = 'flagged'), 0) AS flagged,
              COALESCE(SUM(q.status = 'draft'), 0) AS draft
       FROM curriculum_levels l
       JOIN curriculum_topics t ON t.level_id = l.id
       LEFT JOIN question_bank_topics b ON b.topic_id = t.id
       LEFT JOIN questions q ON q.topic_id = t.id
       WHERE l.id IN (${LEVELS_SQL})
       GROUP BY t.id
       ORDER BY l.stage, t.number`,
    )
    .bind(...QUESTION_BANK_LEVEL_IDS)
    .all<CoverageRow>();

  const levels: QuestionCoverageLevel[] = [];
  for (const row of result.results ?? []) {
    let level = levels.at(-1);
    if (!level || level.level_id !== row.level_id) {
      level = { level_id: row.level_id, name: row.level_name, topics: [] };
      levels.push(level);
    }
    level.topics.push({
      topic_id: row.topic_id,
      code: row.code,
      name: row.name,
      unit: row.unit,
      description: row.description,
      needs_figure: row.needs_figure === 1,
      approved: [row.a1, row.a2, row.a3],
      checked: row.checked,
      flagged: row.flagged,
      draft: row.draft,
    });
  }
  return levels;
}

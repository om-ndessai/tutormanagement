import {
  computeProgress,
  type Assessment,
  type AssessmentPayload,
  type AssessmentUpdatePayload,
  type CurriculumLevel,
  type CurriculumTopic,
  type LearningPlan,
  type PlanPayload,
  type PlanUpdatePayload,
  type ProgressOverview,
  type Rating,
  type SessionProgressPayload,
  type StudentProgress,
  type User,
  zonedClockParts,
} from '@tmi/shared';

import { studentScopeSql } from '../lib/scope.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Today on the institute's clock. Lessons are dated in that timezone, so
 * "where should they be by today" has to be asked in it too -- UTC would roll
 * the day over at eight in the evening.
 */
function instituteToday(): string {
  return zonedClockParts(new Date().toISOString()).day;
}

// ---------------------------------------------------------------------------
// The curriculum catalog
// ---------------------------------------------------------------------------

export async function listCurriculum(db: D1Database): Promise<CurriculumLevel[]> {
  const [levels, topics] = await db.batch<Record<string, unknown>>([
    db.prepare(
      'SELECT id, program, name, stage, grade_band, description FROM curriculum_levels ORDER BY stage',
    ),
    db.prepare(
      `SELECT t.id, t.level_id, t.number, t.unit, t.name
       FROM curriculum_topics t JOIN curriculum_levels l ON l.id = t.level_id
       ORDER BY l.stage, t.number`,
    ),
  ]);

  const byLevel = new Map<string, CurriculumTopic[]>();
  for (const row of (topics?.results ?? []) as unknown as CurriculumTopic[]) {
    const list = byLevel.get(row.level_id) ?? [];
    list.push(row);
    byLevel.set(row.level_id, list);
  }

  return ((levels?.results ?? []) as unknown as Omit<CurriculumLevel, 'topics'>[]).map((level) => ({
    ...level,
    topics: byLevel.get(level.id) ?? [],
  }));
}

/**
 * Which of these ids are not in the catalog. Checked up front so a bad id is
 * a field-level message rather than a foreign-key failure halfway through a
 * batch. One JSON parameter rather than one per id: D1 caps bound parameters.
 */
export async function findUnknownCurriculumIds(
  db: D1Database,
  table: 'curriculum_levels' | 'curriculum_topics',
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const result = await db
    .prepare(
      `SELECT j.value AS id FROM json_each(?) j
       WHERE NOT EXISTS (SELECT 1 FROM ${table} c WHERE c.id = j.value)`,
    )
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();

  return (result.results ?? []).map((row) => row.id);
}

// ---------------------------------------------------------------------------
// Who may see a student's progress
// ---------------------------------------------------------------------------

/** True when the viewer may read this student's assessments, plan and progress. */
export async function canViewStudentProgress(
  db: D1Database,
  viewer: User,
  studentId: string,
): Promise<boolean> {
  const scope = studentScopeSql(viewer, 'u.id');

  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       WHERE u.id = ? AND u.deleted_at IS NULL ${scope ? `AND ${scope.sql}` : ''}`,
    )
    .bind(studentId, ...(scope?.values ?? []))
    .first<{ ok: number }>();

  return row !== null;
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

const SELECT_ASSESSMENT = `
  SELECT a.id, a.student_user_id, s.full_name AS student_name,
         a.assessor_user_id, x.full_name AS assessor_name,
         a.assessed_on, a.school_course, a.recommended_level_id, a.summary,
         (SELECT json_group_array(json_object('topic_id', r.topic_id, 'rating', r.rating))
            FROM (SELECT topic_id, rating FROM assessment_topic_ratings
                  WHERE assessment_id = a.id ORDER BY topic_id) r) AS ratings_json,
         a.created_at, a.updated_at
  FROM assessments a
  JOIN users s ON s.id = a.student_user_id
  LEFT JOIN users x ON x.id = a.assessor_user_id
`;

type AssessmentRow = Omit<Assessment, 'ratings'> & { ratings_json: string | null };

function toAssessment({ ratings_json, ...row }: AssessmentRow): Assessment {
  return { ...row, ratings: JSON.parse(ratings_json ?? '[]') };
}

export async function listAssessments(db: D1Database, studentId: string): Promise<Assessment[]> {
  const result = await db
    .prepare(
      `${SELECT_ASSESSMENT} WHERE a.student_user_id = ? ORDER BY a.assessed_on DESC, a.created_at DESC`,
    )
    .bind(studentId)
    .all<AssessmentRow>();

  return (result.results ?? []).map(toAssessment);
}

export async function getAssessment(db: D1Database, id: string): Promise<Assessment | null> {
  const row = await db.prepare(`${SELECT_ASSESSMENT} WHERE a.id = ?`).bind(id).first<AssessmentRow>();
  return row ? toAssessment(row) : null;
}

function ratingStatements(
  db: D1Database,
  table: 'assessment_topic_ratings' | 'session_topic_ratings',
  keyColumn: 'assessment_id' | 'session_id',
  key: string,
  ratings: { topic_id: string; rating: number }[],
) {
  return [
    db.prepare(`DELETE FROM ${table} WHERE ${keyColumn} = ?`).bind(key),
    ...ratings.map((row) =>
      db
        .prepare(`INSERT INTO ${table} (${keyColumn}, topic_id, rating) VALUES (?, ?, ?)`)
        .bind(key, row.topic_id, row.rating),
    ),
  ];
}

export async function createAssessment(
  db: D1Database,
  input: AssessmentPayload,
  assessorId: string,
): Promise<Assessment> {
  const id = crypto.randomUUID();

  // One batch, so an assessment never exists without the scores it was saved with.
  await db.batch([
    db
      .prepare(
        `INSERT INTO assessments
           (id, student_user_id, assessor_user_id, assessed_on, school_course,
            recommended_level_id, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.student_user_id,
        assessorId,
        input.assessed_on,
        input.school_course,
        input.recommended_level_id,
        input.summary,
      ),
    ...ratingStatements(db, 'assessment_topic_ratings', 'assessment_id', id, input.ratings).slice(1),
  ]);

  const created = await getAssessment(db, id);
  if (!created) throw new Error('Insert into assessments returned no row.');
  return created;
}

export async function updateAssessment(
  db: D1Database,
  id: string,
  input: AssessmentUpdatePayload,
): Promise<Assessment | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of ['assessed_on', 'school_course', 'recommended_level_id', 'summary'] as const) {
    if (input[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  // Touch the row even for a ratings-only change, so updated_at says so.
  sets.push(`updated_at = ${NOW}`);

  const statements = [
    db.prepare(`UPDATE assessments SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id),
    ...(input.ratings
      ? ratingStatements(db, 'assessment_topic_ratings', 'assessment_id', id, input.ratings)
      : []),
  ];

  const [update] = await db.batch(statements);
  if (!update?.meta.changes) return null;

  return getAssessment(db, id);
}

export async function deleteAssessment(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM assessments WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

// ---------------------------------------------------------------------------
// Learning plans
// ---------------------------------------------------------------------------

const SELECT_PLAN = `
  SELECT p.id, p.student_user_id, p.assessment_id, p.goal, p.target_level_id,
         p.starts_on, p.target_on, p.sessions_per_week, p.session_minutes,
         p.recommendation, p.status,
         (SELECT json_group_array(t.topic_id)
            FROM (SELECT topic_id FROM learning_plan_topics
                  WHERE plan_id = p.id ORDER BY position) t) AS topics_json,
         c.full_name AS created_by_name,
         p.created_at, p.updated_at
  FROM learning_plans p
  LEFT JOIN users c ON c.id = p.created_by_user_id
`;

type PlanRow = Omit<LearningPlan, 'topic_ids'> & { topics_json: string | null };

function toPlan({ topics_json, ...row }: PlanRow): LearningPlan {
  return { ...row, topic_ids: JSON.parse(topics_json ?? '[]') };
}

/** Every plan for a student, the active one first, then newest first. */
export async function listPlans(db: D1Database, studentId: string): Promise<LearningPlan[]> {
  const result = await db
    .prepare(
      `${SELECT_PLAN} WHERE p.student_user_id = ?
       ORDER BY (p.status = 'active') DESC, p.starts_on DESC, p.created_at DESC`,
    )
    .bind(studentId)
    .all<PlanRow>();

  return (result.results ?? []).map(toPlan);
}

export async function getPlan(db: D1Database, id: string): Promise<LearningPlan | null> {
  const row = await db.prepare(`${SELECT_PLAN} WHERE p.id = ?`).bind(id).first<PlanRow>();
  return row ? toPlan(row) : null;
}

export async function getActivePlanId(db: D1Database, studentId: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT id FROM learning_plans WHERE student_user_id = ? AND status = 'active'`)
    .bind(studentId)
    .first<{ id: string }>();

  return row?.id ?? null;
}

function planTopicStatements(db: D1Database, planId: string, topicIds: string[]) {
  return [
    db.prepare('DELETE FROM learning_plan_topics WHERE plan_id = ?').bind(planId),
    ...topicIds.map((topicId, position) =>
      db
        .prepare('INSERT INTO learning_plan_topics (plan_id, topic_id, position) VALUES (?, ?, ?)')
        .bind(planId, topicId, position),
    ),
  ];
}

export async function createPlan(
  db: D1Database,
  input: PlanPayload,
  createdBy: string,
): Promise<LearningPlan> {
  const id = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `INSERT INTO learning_plans
           (id, student_user_id, assessment_id, goal, target_level_id, starts_on, target_on,
            sessions_per_week, session_minutes, recommendation, status, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      )
      .bind(
        id,
        input.student_user_id,
        input.assessment_id,
        input.goal,
        input.target_level_id,
        input.starts_on,
        input.target_on,
        input.sessions_per_week,
        input.session_minutes,
        input.recommendation,
        createdBy,
      ),
    ...planTopicStatements(db, id, input.topic_ids).slice(1),
  ]);

  const created = await getPlan(db, id);
  if (!created) throw new Error('Insert into learning_plans returned no row.');
  return created;
}

export async function updatePlan(
  db: D1Database,
  id: string,
  input: PlanUpdatePayload,
): Promise<LearningPlan | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const field of [
    'assessment_id',
    'goal',
    'target_level_id',
    'starts_on',
    'target_on',
    'sessions_per_week',
    'session_minutes',
    'recommendation',
    'status',
  ] as const) {
    if (input[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  sets.push(`updated_at = ${NOW}`);

  const [update] = await db.batch([
    db.prepare(`UPDATE learning_plans SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id),
    ...(input.topic_ids ? planTopicStatements(db, id, input.topic_ids) : []),
  ]);

  if (!update?.meta.changes) return null;
  return getPlan(db, id);
}

export async function deletePlan(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM learning_plans WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

// ---------------------------------------------------------------------------
// A lesson's progress record
// ---------------------------------------------------------------------------

/**
 * Replaces a lesson's progress record in one batch.
 *
 * The plan it is scored against is frozen the first time it is scored: a
 * later edit keeps the original plan, so replacing a plan never quietly
 * re-files old lessons under the new one.
 */
export async function saveSessionProgress(
  db: D1Database,
  sessionId: string,
  studentId: string,
  input: SessionProgressPayload,
): Promise<void> {
  const planId = await getActivePlanId(db, studentId);

  await db.batch([
    db
      .prepare(
        `INSERT INTO session_progress (session_id, plan_id, goal_rating)
         VALUES (?, ?, ?)
         ON CONFLICT (session_id) DO UPDATE SET
           goal_rating = excluded.goal_rating,
           plan_id     = COALESCE(session_progress.plan_id, excluded.plan_id),
           updated_at  = ${NOW}`,
      )
      .bind(sessionId, planId, input.goal_rating),
    ...ratingStatements(db, 'session_topic_ratings', 'session_id', sessionId, input.topic_ratings),
  ]);
}

// ---------------------------------------------------------------------------
// Progress towards the goal
// ---------------------------------------------------------------------------

interface ProgressSessionRow {
  session_id: string;
  student_user_id: string;
  occurred_on: string;
  started_at: string;
  tutor_name: string;
  duration_minutes: number;
  goal_rating: Rating | null;
  ratings_json: string | null;
}

const SELECT_PROGRESS_SESSIONS = `
  SELECT s.id AS session_id, s.student_user_id, s.occurred_on, s.started_at,
         t.full_name AS tutor_name, s.duration_minutes, sp.goal_rating,
         (SELECT json_group_array(json_object('topic_id', r.topic_id, 'rating', r.rating))
            FROM session_topic_ratings r WHERE r.session_id = s.id) AS ratings_json
  FROM sessions s
  JOIN users t ON t.id = s.tutor_user_id
  LEFT JOIN session_progress sp ON sp.session_id = s.id
`;

function toProgressSession(row: ProgressSessionRow) {
  return {
    session_id: row.session_id,
    occurred_on: row.occurred_on,
    started_at: row.started_at,
    tutor_name: row.tutor_name,
    duration_minutes: Number(row.duration_minutes),
    goal_rating: row.goal_rating,
    topic_ratings: JSON.parse(row.ratings_json ?? '[]') as { topic_id: string; rating: Rating }[],
  };
}

/**
 * The scores a plan's progress starts from: the assessment the plan answers,
 * or failing that the student's latest one.
 */
function baselineFor(plan: LearningPlan | null, assessments: Assessment[]): Assessment | null {
  if (plan?.assessment_id) {
    const linked = assessments.find((assessment) => assessment.id === plan.assessment_id);
    if (linked) return linked;
  }
  return assessments[0] ?? null;
}

/** Everything the progress page shows for one student. Authorise first. */
export async function buildStudentProgress(
  db: D1Database,
  studentId: string,
  today?: string,
): Promise<StudentProgress | null> {
  const student = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, sp.current_math_course
       FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
    )
    .bind(studentId)
    .first<StudentProgress['student']>();

  if (!student) return null;

  const [assessments, plans, sessions] = await Promise.all([
    listAssessments(db, studentId),
    listPlans(db, studentId),
    db
      .prepare(`${SELECT_PROGRESS_SESSIONS} WHERE s.student_user_id = ?`)
      .bind(studentId)
      .all<ProgressSessionRow>(),
  ]);

  const plan = plans.find((candidate) => candidate.status === 'active') ?? null;
  const baseline = baselineFor(plan, assessments);
  const on = today ?? instituteToday();

  const computed = computeProgress({
    plan,
    baseline: baseline?.ratings ?? [],
    baselineOn: baseline?.assessed_on ?? null,
    sessions: (sessions.results ?? []).map(toProgressSession),
    today: on,
  });

  return {
    today: on,
    student,
    assessments,
    plan,
    past_plans: plans.filter((candidate) => candidate.status !== 'active'),
    ...computed,
  };
}

/**
 * One row per student the viewer may follow, with where they stand.
 *
 * Built from four set-wide queries and computed in memory, rather than one
 * buildStudentProgress per student: fifty students is fifty round trips the
 * other way, and the dashboards call this on every load.
 */
export async function listProgressOverview(
  db: D1Database,
  viewer: User,
  options: { studentIds?: string[]; today?: string } = {},
): Promise<ProgressOverview[]> {
  const scope = studentScopeSql(viewer, 'u.id');
  const only = options.studentIds;

  const students = await db
    .prepare(
      `SELECT u.id, u.full_name FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       WHERE u.deleted_at IS NULL
         ${scope ? `AND ${scope.sql}` : ''}
         ${only ? 'AND u.id IN (SELECT value FROM json_each(?))' : ''}
       ORDER BY u.full_name`,
    )
    .bind(...(scope?.values ?? []), ...(only ? [JSON.stringify(only)] : []))
    .all<{ id: string; full_name: string }>();

  const rows = students.results ?? [];
  if (rows.length === 0) return [];

  const ids = JSON.stringify(rows.map((row) => row.id));
  const inStudents = '(SELECT value FROM json_each(?))';

  const [planResult, assessmentResult, sessionResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`${SELECT_PLAN} WHERE p.status = 'active' AND p.student_user_id IN ${inStudents}`).bind(ids),
    db
      .prepare(
        `${SELECT_ASSESSMENT} WHERE a.student_user_id IN ${inStudents}
         ORDER BY a.assessed_on DESC, a.created_at DESC`,
      )
      .bind(ids),
    db.prepare(`${SELECT_PROGRESS_SESSIONS} WHERE s.student_user_id IN ${inStudents}`).bind(ids),
  ]);

  const plans = new Map<string, LearningPlan>();
  for (const row of (planResult?.results ?? []) as unknown as PlanRow[]) {
    plans.set(row.student_user_id, toPlan(row));
  }

  const assessments = new Map<string, Assessment[]>();
  for (const row of (assessmentResult?.results ?? []) as unknown as AssessmentRow[]) {
    const list = assessments.get(row.student_user_id) ?? [];
    list.push(toAssessment(row));
    assessments.set(row.student_user_id, list);
  }

  const sessions = new Map<string, ReturnType<typeof toProgressSession>[]>();
  for (const row of (sessionResult?.results ?? []) as unknown as ProgressSessionRow[]) {
    const list = sessions.get(row.student_user_id) ?? [];
    list.push(toProgressSession(row));
    sessions.set(row.student_user_id, list);
  }

  return rows.map((student) => {
    const plan = plans.get(student.id) ?? null;
    const history = assessments.get(student.id) ?? [];
    const baseline = baselineFor(plan, history);

    const { summary } = computeProgress({
      plan,
      baseline: baseline?.ratings ?? [],
      baselineOn: baseline?.assessed_on ?? null,
      sessions: sessions.get(student.id) ?? [],
      today: options.today ?? instituteToday(),
    });

    return {
      student_user_id: student.id,
      student_name: student.full_name,
      goal: plan?.goal ?? null,
      starts_on: plan?.starts_on ?? null,
      target_on: plan?.target_on ?? null,
      last_assessed_on: history[0]?.assessed_on ?? null,
      summary,
    };
  });
}

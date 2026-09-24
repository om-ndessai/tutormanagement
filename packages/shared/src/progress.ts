import { z } from 'zod';
// Type-only, so erased at build: schedules.ts imports teaching.ts, which
// imports this module, and a runtime import back would close the cycle.
import type { ScheduleCancellerRole } from './schedules.js';
import { refuseSsn } from './tax.js';
import { optionalText } from './users.js';

/**
 * The unit lessons are recorded in. Restated rather than imported from
 * teaching.ts, which imports THIS module for the session schema -- a cycle
 * would leave one of them reading the other half-initialised.
 */
const QUARTER_HOUR = 15;

// ---------------------------------------------------------------------------
// The curriculum ladder (Phase 16)
// ---------------------------------------------------------------------------
// Beast Academy levels 1-5, then the Art of Problem Solving books. The catalog
// itself is reference data inserted by db/schema.sql; these are its shapes.
//
// Naming convention, which is also the id of every row:
//
//   level   BA1 .. BA5   Beast Academy Level 1 .. 5
//           PRE          AoPS Prealgebra
//           ALG          AoPS Introduction to Algebra
//           GEO          AoPS Introduction to Geometry
//   topic   <level>.<nn> BA3.10 is "topic 10 of Beast Academy Level 3"
//
// Short, sortable, and readable aloud -- "BA3 point 10" -- which is what an
// assessor jotting on paper actually writes.

export const CURRICULUM_PROGRAMS = ['beast_academy', 'aops'] as const;
export type CurriculumProgram = (typeof CURRICULUM_PROGRAMS)[number];

export const CURRICULUM_PROGRAM_LABELS: Record<CurriculumProgram, string> = {
  beast_academy: 'Beast Academy',
  aops: 'Art of Problem Solving',
};

export interface CurriculumTopic {
  /** "BA3.10" */
  id: string;
  level_id: string;
  number: number;
  /** The Beast Academy guide book ("3D"); null for an AoPS chapter. */
  unit: string | null;
  name: string;
}

export interface CurriculumLevel {
  /** "BA3", "PRE", "ALG", "GEO" */
  id: string;
  program: CurriculumProgram;
  name: string;
  /** Position on the ladder; lower is earlier. */
  stage: number;
  grade_band: string | null;
  description: string | null;
  topics: CurriculumTopic[];
}

const levelId = z.string().trim().regex(/^[A-Z]{2,3}\d?$/, 'Choose a level from the list.');
const topicId = z
  .string()
  .trim()
  .regex(/^[A-Z]{2,3}\d?\.\d{2}$/, 'Choose a topic from the list.');

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/**
 * One scale for every rating: the assessment, each lesson's topic scores, and
 * the lesson's step towards the goal. Using one scale is what lets a lesson's
 * "4" be read against the assessment's "1" on the same topic.
 */
export const RATINGS = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATINGS)[number];

const rating = z
  .number()
  .int('Ratings are whole numbers from 1 to 5.')
  .min(1, 'Ratings run from 1 to 5.')
  .max(5, 'Ratings run from 1 to 5.');

/** Where a student stands on a topic. 1 means they perform poorly or need help. */
export const TOPIC_RATING_LABELS: Record<Rating, string> = {
  1: 'Needs help',
  2: 'Developing',
  3: 'Getting there',
  4: 'Confident',
  5: 'Mastered',
};

/** How far one lesson moved the student towards the plan's goal. */
export const GOAL_RATING_LABELS: Record<Rating, string> = {
  1: 'No progress',
  2: 'A little progress',
  3: 'Steady progress',
  4: 'Good progress',
  5: 'Big step forward',
};

/**
 * A topic counts as done at "Confident". Requiring a 5 would leave a plan
 * permanently short of complete over one wobbly chapter, and a 3 is by its
 * own label not there yet.
 */
export const MASTERED_RATING = 4;

export const topicRatingSchema = z.object({ topic_id: topicId, rating });
export type TopicRatingInput = z.infer<typeof topicRatingSchema>;

/** At most one score per topic, like the tables' primary keys. */
const topicRatings = z
  .array(topicRatingSchema)
  .max(200)
  .refine((rows) => new Set(rows.map((row) => row.topic_id)).size === rows.length, {
    message: 'The same topic was rated twice.',
  });

const isoDate = z.iso.date({ message: 'Use a date like 2026-09-20.' });

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export const assessmentInputSchema = z
  .object({
    student_user_id: z.uuid(),
    assessed_on: isoDate,
    /** What the student is enrolled in at school, as the family put it. */
    school_course: optionalText(z.string().trim().max(160)),
    recommended_level_id: levelId.nullish().transform((value) => value ?? null),
    /** The long-form write-up. */
    summary: optionalText(z.string().trim().max(20_000)),
    ratings: topicRatings.default([]),
  })
  .refine((value) => value.summary !== null || value.ratings.length > 0, {
    message: 'Write up the assessment or rate at least one topic.',
    path: ['summary'],
  });

export type AssessmentInput = z.input<typeof assessmentInputSchema>;
export type AssessmentPayload = z.output<typeof assessmentInputSchema>;

/** PATCH: the student is fixed; `ratings`, when sent, replaces the whole set. */
export const assessmentUpdateSchema = z
  .object({
    assessed_on: isoDate.optional(),
    school_course: optionalText(z.string().trim().max(160)),
    recommended_level_id: levelId.nullish(),
    summary: optionalText(z.string().trim().max(20_000)),
    ratings: topicRatings.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type AssessmentUpdatePayload = z.output<typeof assessmentUpdateSchema>;

export interface Assessment {
  id: string;
  student_user_id: string;
  student_name: string;
  assessor_user_id: string | null;
  assessor_name: string | null;
  assessed_on: string;
  school_course: string | null;
  recommended_level_id: string | null;
  summary: string | null;
  ratings: { topic_id: string; rating: Rating }[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Learning plans
// ---------------------------------------------------------------------------

export const PLAN_STATUSES = ['active', 'achieved', 'closed'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  active: 'Active',
  achieved: 'Goal achieved',
  closed: 'Closed',
};

const planFields = {
  // Required, so not built from optionalText -- the SSN guard is applied
  // directly, as on a comment body.
  // 1000, like the profile's goal: the two are the same fact kept in step,
  // so what one accepts the other must too.
  goal: refuseSsn(
    z.string().trim().min(1, 'Say what the goal is.').max(1000, 'Goal must be 1000 characters or fewer.'),
  ),
  target_level_id: levelId.nullish().transform((value) => value ?? null),
  starts_on: isoDate,
  target_on: isoDate,
  sessions_per_week: z
    .number()
    .int()
    .min(1, 'At least one session a week.')
    .max(7, 'At most one session a day.'),
  session_minutes: z
    .number()
    .int()
    .min(QUARTER_HOUR, 'Sessions are at least 15 minutes.')
    .max(480, 'A session cannot run longer than eight hours.')
    .refine((value) => value % QUARTER_HOUR === 0, 'Use a multiple of 15 minutes.'),
  recommendation: optionalText(z.string().trim().max(20_000)),
  /** In teaching order. */
  topic_ids: z
    .array(topicId)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'The same topic was added twice.',
    }),
};

export const planInputSchema = z
  .object({
    student_user_id: z.uuid(),
    assessment_id: z.uuid().nullish().transform((value) => value ?? null),
    ...planFields,
    topic_ids: planFields.topic_ids.default([]),
  })
  .refine((value) => value.target_on > value.starts_on, {
    message: 'The goal date must be after tutoring starts.',
    path: ['target_on'],
  });

export type PlanInput = z.input<typeof planInputSchema>;
export type PlanPayload = z.output<typeof planInputSchema>;

/**
 * PATCH. Omitted keys are left alone, so no defaults here; `topic_ids`, when
 * sent, replaces the list. The date order is re-checked in the route against
 * whichever of the two dates is not being changed.
 */
export const planUpdateSchema = z
  .object({
    assessment_id: z.uuid().nullish(),
    goal: planFields.goal.optional(),
    target_level_id: levelId.nullish(),
    starts_on: isoDate.optional(),
    target_on: isoDate.optional(),
    sessions_per_week: planFields.sessions_per_week.optional(),
    session_minutes: planFields.session_minutes.optional(),
    recommendation: planFields.recommendation,
    topic_ids: planFields.topic_ids.optional(),
    status: z.enum(PLAN_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type PlanUpdatePayload = z.output<typeof planUpdateSchema>;

export interface LearningPlan {
  id: string;
  student_user_id: string;
  assessment_id: string | null;
  goal: string;
  target_level_id: string | null;
  starts_on: string;
  target_on: string;
  sessions_per_week: number;
  session_minutes: number;
  recommendation: string | null;
  status: PlanStatus;
  /** In teaching order. */
  topic_ids: string[];
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// A lesson, scored against the plan
// ---------------------------------------------------------------------------

/**
 * What a tutor records about a lesson's progress, alongside its times.
 * Optional throughout: a lesson with no plan, or a tutor in a hurry, records
 * nothing here and the billing record is unaffected.
 */
export const sessionProgressInputSchema = z.object({
  goal_rating: rating.nullish().transform((value) => value ?? null),
  topic_ratings: topicRatings.default([]),
});

export type SessionProgressInput = z.input<typeof sessionProgressInputSchema>;
export type SessionProgressPayload = z.output<typeof sessionProgressInputSchema>;

export interface SessionProgress {
  goal_rating: Rating | null;
  topic_ratings: { topic_id: string; rating: Rating }[];
}

// ---------------------------------------------------------------------------
// Progress towards the goal -- derived, never stored
// ---------------------------------------------------------------------------

export const PROGRESS_STATUSES = [
  'no_plan',
  'not_started',
  'ahead',
  'on_track',
  'behind',
  'achieved',
  'closed',
] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  no_plan: 'No plan yet',
  not_started: 'Not started',
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Behind',
  achieved: 'Goal achieved',
  closed: 'Closed',
};

/** Where one plan topic stands: first score, latest score, and when. */
export interface TopicProgress {
  topic_id: string;
  baseline: Rating | null;
  current: Rating | null;
  last_rated_on: string | null;
  mastered: boolean;
}

/** One lesson on the timeline, and the mastery it left the plan at. */
export interface ProgressPoint {
  session_id: string;
  occurred_on: string;
  tutor_name: string;
  duration_minutes: number;
  goal_rating: Rating | null;
  topics_rated: number;
  /** Share of plan topics at MASTERED_RATING or above after this lesson, 0-100. */
  percent: number;
}

/**
 * A lesson of the student's standing schedule that was called off (Phase 24),
 * past or still ahead, within the plan's dates.
 *
 * Deliberately without ids, like ProgressPoint: progress is read by every tutor
 * currently teaching the student, a wider audience than any one schedule's. The
 * date and the tutor are the same kind of fact as a lesson on the timeline;
 * the note and who cancelled are not, and reach only readers of the schedule
 * itself -- null for anybody else.
 */
export interface ProgressCancellation {
  schedule_id: string;
  occurs_on: string;
  start_time: string;
  tutor_name: string;
  cancelled_as: ScheduleCancellerRole;
  note: string | null;
  cancelled_by_name: string | null;
}

export interface ProgressSummary {
  status: ProgressStatus;
  topic_count: number;
  mastered_count: number;
  /** Share of plan topics mastered now, 0-100. */
  percent: number;
  /** Share mastered before the first lesson, from the assessment alone. */
  start_percent: number;
  /** Where a straight line from start to goal says it should be today, 0-100. */
  expected_percent: number;
  sessions_held: number;
  /**
   * What the recommended cadence adds up to between the start and today, less
   * the lessons cancelled in that time: a vacation week was never going to be
   * held, so it is not counted as missed.
   */
  sessions_planned_to_date: number;
  /** Lessons cancelled in the plan window before today. */
  sessions_cancelled_to_date: number;
  /** Lessons cancelled from today to the goal date. */
  sessions_cancelled_upcoming: number;
  /** Mean of the goal ratings of the last few scored lessons. */
  recent_goal_rating: number | null;
}

/** GET /api/progress/:studentId */
export interface StudentProgress {
  /** The date the summary was computed for, on the institute's clock. */
  today: string;
  student: {
    user_id: string;
    full_name: string;
    current_math_course: string | null;
    /** The goal on their profile -- the active plan's goal, when there is one. */
    academic_year_goal: string | null;
  };
  assessments: Assessment[];
  plan: LearningPlan | null;
  /** Plans that are no longer active, newest first. */
  past_plans: LearningPlan[];
  summary: ProgressSummary;
  topics: TopicProgress[];
  timeline: ProgressPoint[];
  /** Called-off lessons in the plan's dates, soonest first (Phase 24). */
  cancellations: ProgressCancellation[];
}

/** One row of GET /api/progress: a student the viewer may follow. */
export interface ProgressOverview {
  student_user_id: string;
  student_name: string;
  goal: string | null;
  starts_on: string | null;
  target_on: string | null;
  last_assessed_on: string | null;
  summary: ProgressSummary;
}

/** How many recent lessons the "recent goal rating" averages. */
const RECENT_WINDOW = 3;

/** Within this many percentage points of the pace line counts as on track. */
const ON_TRACK_BAND = 10;

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** Today's calendar date as YYYY-MM-DD, in UTC. Callers may pass their own. */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Everything the progress views show, from the plan, the ratings and the
 * lessons. Pure, and shared, so the dashboards and the detail page cannot
 * disagree about whether a student is behind.
 *
 * Mastery: a plan topic counts once its LATEST score -- from the assessment
 * or any lesson since -- reaches MASTERED_RATING. Latest rather than best,
 * because a topic that slipped has not been mastered.
 *
 * Pace: a straight line from 0% on the start date to 100% on the goal date.
 * Crude, deliberately. Tutoring is not linear, but a straight line is the one
 * expectation a family can check for themselves, and the band around it is
 * wide enough not to cry wolf over one slow week.
 */
export function computeProgress(input: {
  plan: Pick<LearningPlan, 'status' | 'starts_on' | 'target_on' | 'sessions_per_week' | 'topic_ids'> | null;
  /** Scores from the assessment the plan answers, dated. */
  baseline: { topic_id: string; rating: Rating }[];
  baselineOn: string | null;
  /** The student's lessons, any order. */
  sessions: {
    session_id: string;
    occurred_on: string;
    started_at: string;
    tutor_name: string;
    duration_minutes: number;
    goal_rating: Rating | null;
    topic_ratings: { topic_id: string; rating: Rating }[];
  }[];
  /**
   * Called-off lessons of the student's schedules, any order -- ones a lesson
   * was recorded on anyway already left out, since a recorded lesson wins.
   */
  cancellations?: ProgressCancellation[];
  today?: string;
}): {
  summary: ProgressSummary;
  topics: TopicProgress[];
  timeline: ProgressPoint[];
  cancellations: ProgressCancellation[];
} {
  const today = input.today ?? isoToday();
  const plan = input.plan;
  const planTopics = plan?.topic_ids ?? [];
  const inPlan = new Set(planTopics);

  const current = new Map<string, { rating: Rating; on: string | null }>();
  const baseline = new Map<string, Rating>();

  for (const row of input.baseline) {
    baseline.set(row.topic_id, row.rating);
    current.set(row.topic_id, { rating: row.rating, on: input.baselineOn });
  }

  const masteredCount = () =>
    planTopics.filter((id) => (current.get(id)?.rating ?? 0) >= MASTERED_RATING).length;
  const percentNow = () =>
    planTopics.length === 0 ? 0 : Math.round((masteredCount() / planTopics.length) * 100);

  // Lessons before the plan began still show on the timeline, but only those
  // inside the plan window count towards the cadence.
  const ordered = [...input.sessions].sort((a, b) =>
    a.occurred_on === b.occurred_on
      ? a.started_at.localeCompare(b.started_at)
      : a.occurred_on.localeCompare(b.occurred_on),
  );

  const timeline: ProgressPoint[] = [];
  let startPercent = percentNow();

  for (const session of ordered) {
    for (const row of session.topic_ratings) {
      if (!baseline.has(row.topic_id) && !current.has(row.topic_id) && inPlan.has(row.topic_id)) {
        // First time this topic was ever scored: that is its baseline.
        baseline.set(row.topic_id, row.rating);
      }
      current.set(row.topic_id, { rating: row.rating, on: session.occurred_on });
    }

    // Lessons from before this plan still shape where each topic stands, but
    // the timeline is the plan's own: it begins when the plan does.
    if (plan && session.occurred_on < plan.starts_on) {
      startPercent = percentNow();
      continue;
    }

    timeline.push({
      session_id: session.session_id,
      occurred_on: session.occurred_on,
      tutor_name: session.tutor_name,
      duration_minutes: session.duration_minutes,
      goal_rating: session.goal_rating,
      topics_rated: session.topic_ratings.length,
      percent: percentNow(),
    });
  }

  const topics: TopicProgress[] = planTopics.map((id) => {
    const latest = current.get(id);
    return {
      topic_id: id,
      baseline: baseline.get(id) ?? null,
      current: latest?.rating ?? null,
      last_rated_on: latest?.on ?? null,
      mastered: (latest?.rating ?? 0) >= MASTERED_RATING,
    };
  });

  const scored = ordered.filter((session) => session.goal_rating !== null);
  const recent = scored.slice(-RECENT_WINDOW);
  const recentGoalRating =
    recent.length === 0
      ? null
      : Math.round((recent.reduce((sum, s) => sum + (s.goal_rating ?? 0), 0) / recent.length) * 10) /
        10;

  const inWindow = plan
    ? ordered.filter((s) => s.occurred_on >= plan.starts_on && s.occurred_on <= today)
    : [];

  // Cancellations count inside the plan's own dates. "To date" is strictly
  // before today, matching the cadence below, which does not count today's
  // lesson until the day is out.
  const cancellations = plan
    ? (input.cancellations ?? [])
        .filter((row) => row.occurs_on >= plan.starts_on && row.occurs_on <= plan.target_on)
        .sort(
          (a, b) => a.occurs_on.localeCompare(b.occurs_on) || a.start_time.localeCompare(b.start_time),
        )
    : [];
  const cancelledToDate = cancellations.filter((row) => row.occurs_on < today).length;

  let expected = 0;
  let plannedToDate = 0;

  if (plan) {
    const start = dayNumber(plan.starts_on);
    const end = dayNumber(plan.target_on);
    const now = Math.min(dayNumber(today), end);
    const elapsed = Math.max(0, now - start);
    expected = end > start ? Math.round((elapsed / (end - start)) * 100) : 0;
    plannedToDate = Math.max(
      0,
      Math.floor((elapsed / 7) * plan.sessions_per_week) - cancelledToDate,
    );
  }

  const percent = percentNow();
  let status: ProgressStatus;

  if (!plan) status = 'no_plan';
  else if (plan.status === 'achieved') status = 'achieved';
  else if (plan.status === 'closed') status = 'closed';
  else if (today < plan.starts_on || inWindow.length === 0) status = 'not_started';
  else if (planTopics.length === 0) {
    // With no topics to master, the lessons' own scores are all there is.
    status = recentGoalRating === null ? 'on_track' : recentGoalRating >= 3 ? 'on_track' : 'behind';
  } else if (percent >= expected + ON_TRACK_BAND) status = 'ahead';
  else if (percent >= expected - ON_TRACK_BAND) status = 'on_track';
  else status = 'behind';

  return {
    summary: {
      status,
      topic_count: planTopics.length,
      mastered_count: masteredCount(),
      percent,
      start_percent: startPercent,
      expected_percent: expected,
      sessions_held: inWindow.length,
      sessions_planned_to_date: plannedToDate,
      sessions_cancelled_to_date: cancelledToDate,
      sessions_cancelled_upcoming: cancellations.length - cancelledToDate,
      recent_goal_rating: recentGoalRating,
    },
    topics,
    timeline,
    cancellations,
  };
}

/** "Twice a week, 1 hr" */
export function formatCadence(sessionsPerWeek: number, sessionMinutes: number): string {
  const times =
    sessionsPerWeek === 1 ? 'Once' : sessionsPerWeek === 2 ? 'Twice' : `${sessionsPerWeek} times`;
  const hours = Math.floor(sessionMinutes / 60);
  const rest = sessionMinutes % 60;
  const length =
    hours === 0 ? `${rest} min` : rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;

  return `${times} a week, ${length}`;
}

// Fixtures shaped like the API's responses. Money fields are deliberately filled in, so a test
// can prove a Tutoring view never renders them.
import type {
  AdminDashboard,
  AuditEvent,
  ReflectionDigest,
  StudentProgress,
  TutorDashboard,
  TutoringSession,
  UpcomingSession,
} from '@tmi/shared';

export const TODAY = '2026-10-07';

export function session(overrides: Partial<TutoringSession> = {}): TutoringSession {
  return {
    id: 's1',
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    occurred_on: '2026-10-06',
    started_at: '16:00',
    ended_at: '17:30',
    duration_minutes: 90,
    mode: 'in_person',
    tutor_rate_cents: 6500,
    tutor_amount_cents: 9750,
    charge_rate_cents: 9000,
    charge_amount_cents: 13500,
    money_view: 'admin',
    notes: 'Fractions and word problems.',
    auto_stopped: false,
    progress: null,
    ...overrides,
  } as TutoringSession;
}

export function upcoming(overrides: Partial<UpcomingSession> = {}): UpcomingSession {
  return {
    schedule_id: 'sch-1',
    occurs_on: '2026-10-08',
    start_time: '16:00',
    end_time: '17:00',
    duration_minutes: 60,
    mode: 'in_person',
    location: 'Room 2',
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    cancellation: null,
    ...overrides,
  };
}

const progress = {
  today: TODAY,
  student: {
    user_id: 'student-1',
    full_name: 'Sofia Okafor',
    current_math_course: null,
    academic_year_goal: null,
  },
  assessments: [],
  plan: {
    id: 'plan-1',
    student_user_id: 'student-1',
    assessment_id: null,
    goal: 'Fractions',
    target_level_id: null,
    starts_on: '2026-09-01',
    target_on: '2027-01-31',
    sessions_per_week: 1,
    session_minutes: 60,
    recommendation: null,
    status: 'active',
    topic_ids: [],
    created_by_name: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  past_plans: [],
  summary: {
    status: 'on_track',
    topic_count: 8,
    mastered_count: 2,
    percent: 25,
    start_percent: 10,
    expected_percent: 22,
    sessions_held: 3,
    sessions_planned_to_date: 5,
    sessions_cancelled_to_date: 0,
    sessions_cancelled_upcoming: 0,
    recent_goal_rating: 4,
  },
  topics: [],
  timeline: [
    {
      session_id: 's1',
      occurred_on: '2026-09-15',
      tutor_name: 'Alex Chen',
      duration_minutes: 60,
      goal_rating: 4,
      topics_rated: 2,
      percent: 25,
    },
  ],
  cancellations: [],
} as unknown as StudentProgress;

const activity: AuditEvent[] = [
  {
    id: 'a1',
    actor_user_id: 'admin-1',
    actor_name: 'Priya Raghavan',
    subject_user_id: 'student-1',
    subject_name: 'Sofia Okafor',
    action: 'user.created',
    description: 'Priya Raghavan added Sofia Okafor.',
    entity_type: 'user',
    entity_id: 'student-1',
    created_at: '2026-10-07T12:00:00Z',
  },
];

const reflection: ReflectionDigest = {
  session_id: 's1',
  occurred_on: '2026-10-06',
  student_user_id: 'student-1',
  student_name: 'Sofia Okafor',
  reflection: {
    session_id: 's1',
    learned_new: 4,
    difficulty: 3,
    understanding: 4,
    pace: 5,
    homework_notes: 'Problem 5 took me ages.',
    comment: null,
    entered_by_user_id: 'student-1',
    entered_by_name: 'Sofia Okafor',
    entered_as: 'student',
    created_at: '2026-10-06T20:00:00Z',
    updated_at: '2026-10-06T20:00:00Z',
  },
};

export const adminDashboard: AdminDashboard = {
  kind: 'admin',
  counts: { students: 50, parents: 30, tutors: 10, live_sessions: 1 },
  totals: {
    owed_to_tutors_cents: 123_400,
    owed_by_families_cents: 456_700,
    billed_all_time_cents: 9_876_500,
    tutor_cost_all_time_cents: 5_432_100,
    margin_all_time_cents: 4_444_400,
    session_count: 321,
  },
  tutor_balances: [],
  tutors_missing_ssn: [],
  student_balances: [],
  recent_activity: activity,
  recent_sessions: [session()],
  progress_spotlight: [progress],
};

export const tutorDashboard: TutorDashboard = {
  kind: 'tutor',
  students: [],
  earnings: {
    user_id: 'tutor-1',
    full_name: 'Alex Chen',
    earned_cents: 97_500,
    paid_cents: 80_000,
    balance_cents: 17_500,
    session_count: 3,
    topup_amount_cents: null,
  } as TutorDashboard['earnings'],
  ssn_received_on: null,
  live_sessions: 0,
  recent_sessions: [session({ money_view: 'tutor', charge_rate_cents: null, charge_amount_cents: null })],
  recent_payments: [],
  recent_activity: activity,
  progress_spotlight: [progress],
  recent_reflections: [reflection],
};

/** One student's progress with a plan, for the progress cards. */
export { progress as studentProgress };

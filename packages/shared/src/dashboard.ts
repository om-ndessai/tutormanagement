import { z } from 'zod';
import type { AuditEvent } from './audit.js';
import type { Payment, StudentBalance, TutorBalance } from './payments.js';
import type { StudentProgress } from './progress.js';
import type { SessionReflection } from './session-notes.js';
import type { TutoringSession } from './teaching.js';
import { USER_ROLES, type UserRole } from './users.js';

/**
 * Which dashboard to render.
 *
 * A person can hold several roles, so the dashboard is chosen rather than
 * derived: a parent who also tutors needs both views, not a merged one that
 * serves neither.
 */
export const dashboardQuerySchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  /**
   * Render someone else's dashboard. Admin only -- "the admin should be able
   * to see all users and can then select a user to see the dashboard as shown
   * to that user."
   */
  user_id: z.uuid().optional(),
});

export type DashboardParams = z.output<typeof dashboardQuerySchema>;

/** Who the dashboard is about, and which views they can switch between. */
export interface DashboardSubject {
  user_id: string;
  full_name: string;
  roles: UserRole[];
  /** True when an admin is looking at someone else's dashboard. */
  viewing_as_other: boolean;
}

export interface AdminDashboard {
  kind: 'admin';
  counts: {
    students: number;
    parents: number;
    tutors: number;
    /** Lessons being taught right this minute. */
    live_sessions: number;
  };
  totals: {
    owed_to_tutors_cents: number;
    owed_by_families_cents: number;
    /** All-time revenue: what families have been charged for lessons. */
    billed_all_time_cents: number;
    /** All-time cost: what tutors have earned for those same lessons. */
    tutor_cost_all_time_cents: number;
    /** What the institute kept. Derived from the two figures above. */
    margin_all_time_cents: number;
    session_count: number;
  };
  tutor_balances: TutorBalance[];
  /**
   * Tutors whose SSN the office does not have. Empty is the resting state and
   * the panel says so; anything in it is work the admin has to chase before
   * year end.
   */
  tutors_missing_ssn: { user_id: string; full_name: string }[];
  student_balances: StudentBalance[];
  /** The last 5 events, newest first, less payments (their lines name amounts). */
  recent_activity: AuditEvent[];
  /** The last 5 lessons, for the past half of the sessions carousel. */
  recent_sessions: TutoringSession[];
  /**
   * Up to 5 students picked at random, those on a plan first, each with the
   * timeline their card charts (Phase 21). "All Progress" has the rest.
   */
  progress_spotlight: StudentProgress[];
}

/** A student's reflection on a lesson the reader taught (Phase 25). */
export interface ReflectionDigest {
  session_id: string;
  occurred_on: string;
  student_user_id: string;
  student_name: string;
  reflection: SessionReflection;
}

/**
 * A recent lesson still waiting for the student's reflection. Deliberately
 * not a TutoringSession: a prompt carries no money, only enough to name the
 * lesson and open it.
 */
export interface ReflectionPrompt {
  session_id: string;
  occurred_on: string;
  started_at: string;
  student_user_id: string;
  student_name: string;
  tutor_user_id: string;
  tutor_name: string;
}

/** How far back a dashboard asks for reflections. Older lessons can still have one. */
export const REFLECTION_PROMPT_DAYS = 21;

export interface TutorDashboard {
  kind: 'tutor';
  students: {
    user_id: string;
    full_name: string;
    school: string | null;
    current_math_course: string | null;
    session_count: number;
    last_session_on: string | null;
    earned_cents: number;
    rate_in_person_cents: number | null;
    rate_virtual_cents: number | null;
  }[];
  earnings: TutorBalance;
  /**
   * The date the office confirmed it holds this tutor's SSN, or null when it
   * does not -- in which case their dashboard asks them to send it. The
   * portal never offers anywhere to type it.
   */
  ssn_received_on: string | null;
  /** Their own lesson running right now: 0 or 1. */
  live_sessions: number;
  /** The last 5 lessons they taught. */
  recent_sessions: TutoringSession[];
  recent_payments: Payment[];
  /** The last 5 events they acted in or were the subject of, less payments. */
  recent_activity: AuditEvent[];
  /** Up to 5 of the students they teach, at random, with timelines. */
  progress_spotlight: StudentProgress[];
  /** The last 5 reflections on lessons they taught, newest first (Phase 25). */
  recent_reflections: ReflectionDigest[];
}

export interface ParentDashboard {
  kind: 'parent';
  children: StudentBalance[];
  totals: { charged_cents: number; paid_cents: number; balance_cents: number };
  recent_sessions: TutoringSession[];
  recent_payments: Payment[];
  /** Each child's plan and progress in full, so the dashboard can chart it. */
  progress: StudentProgress[];
  /** Their children's recent lessons still waiting for a reflection. */
  awaiting_reflection: ReflectionPrompt[];
}

export interface StudentDashboard {
  kind: 'student';
  goal: string | null;
  current_math_course: string | null;
  tutors: { user_id: string; full_name: string; session_count: number }[];
  totals: { session_count: number; total_minutes: number };
  recent_sessions: TutoringSession[];
  /** Their own plan and progress. */
  progress: StudentProgress | null;
  /** Their recent lessons still waiting for their reflection. */
  awaiting_reflection: ReflectionPrompt[];
}

export type DashboardData =
  | AdminDashboard
  | TutorDashboard
  | ParentDashboard
  | StudentDashboard;

export interface DashboardResponse {
  subject: DashboardSubject;
  /** The role this payload was built for. */
  role: UserRole;
  data: DashboardData;
}

export const DASHBOARD_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  tutor: 'Tutor',
  student: 'Student',
  parent: 'Parent',
};

/**
 * Which view to open on when none was asked for.
 *
 * Admin first because it is the widest, then tutor: somebody who both tutors
 * and parents is far more often here to do the former.
 */
export function defaultDashboardRole(roles: UserRole[]): UserRole | null {
  const preference: UserRole[] = ['admin', 'tutor', 'parent', 'student'];
  return preference.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}

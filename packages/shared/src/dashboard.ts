import { z } from 'zod';
import type { AuditEvent } from './audit.js';
import type { Payment, StudentBalance, TutorBalance } from './payments.js';
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
    admins: number;
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
  student_balances: StudentBalance[];
  recent_activity: AuditEvent[];
  recent_sessions: TutoringSession[];
}

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
  recent_sessions: TutoringSession[];
  recent_payments: Payment[];
  recent_activity: AuditEvent[];
}

export interface ParentDashboard {
  kind: 'parent';
  children: StudentBalance[];
  totals: { charged_cents: number; paid_cents: number; balance_cents: number };
  recent_sessions: TutoringSession[];
  recent_payments: Payment[];
}

export interface StudentDashboard {
  kind: 'student';
  goal: string | null;
  current_math_course: string | null;
  tutors: { user_id: string; full_name: string; session_count: number }[];
  totals: { session_count: number; total_minutes: number };
  recent_sessions: TutoringSession[];
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

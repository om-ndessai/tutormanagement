import type {
  AdminDashboard,
  AuditEvent,
  DashboardData,
  ParentDashboard,
  Payment,
  StudentProgress,
  StudentDashboard,
  TutorDashboard,
  User,
  UserRole,
} from '@tmi/shared';

import { computeBalances } from './balances.js';
import { getSsnReceivedOn, listTutorsMissingSsn } from './users.js';
import { listAuditEvents } from './audit.js';
import { listPayments } from './payments.js';
import { listSessions } from './sessions.js';
import { buildStudentProgress } from './progress.js';

/** How many events the Tutoring tab's Recent Activity shows. */
const ACTIVITY_SIZE = 5;

/**
 * The newest events for the Tutoring tab, less the money ones. A payment's log
 * line names its amount, and the Tutoring tab carries no money -- a tutor may
 * have it open beside a student (Phase 19). Payments are the Finance tab's
 * business; the full log still lists them.
 */
async function teachingActivity(
  db: D1Database,
  visibleToUserId?: string,
): Promise<AuditEvent[]> {
  const { events } = await listAuditEvents(
    db,
    { limit: 40, offset: 0, include_deleted: false } as never,
    visibleToUserId,
  );
  return (events as AuditEvent[])
    .filter((event) => !event.action.startsWith('payment.'))
    .slice(0, ACTIVITY_SIZE);
}

/** How many students the dashboard's Progress section shows. */
const SPOTLIGHT_SIZE = 5;

/**
 * Up to five students at random, each with their full progress (timeline
 * included) so the card can chart it. Students on an active plan come first
 * -- a card with nothing to chart is the least useful one -- and the rest top
 * the five up. `among` limits the draw (a tutor's own students); null means
 * every student, for an admin.
 */
async function progressSpotlight(
  db: D1Database,
  among: string[] | null,
): Promise<StudentProgress[]> {
  if (among !== null && among.length === 0) return [];

  const within = among === null ? '' : `AND u.id IN (${among.map(() => '?').join(', ')})`;
  const picked = await db
    .prepare(
      `SELECT u.id
       FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
       WHERE u.deleted_at IS NULL ${within}
       ORDER BY EXISTS (SELECT 1 FROM learning_plans p
                        WHERE p.student_user_id = u.id AND p.status = 'active') DESC,
                RANDOM()
       LIMIT ${SPOTLIGHT_SIZE}`,
    )
    .bind(...(among ?? []))
    .all<{ id: string }>();

  const progress = await Promise.all(
    (picked.results ?? []).map((row) => buildStudentProgress(db, row.id)),
  );
  return progress.filter((row): row is StudentProgress => row !== null);
}

/**
 * Assembles exactly what one dashboard needs.
 *
 * Built as one endpoint rather than by composing the existing list endpoints,
 * for two reasons: a dashboard is half a dozen queries that would otherwise be
 * half a dozen round trips, and "view this as another user" needs a single
 * place to swap the subject instead of an impersonation parameter on every
 * endpoint.
 *
 * `subject` is whose dashboard this is. For everyone but an admin it is always
 * the viewer; the caller is responsible for having authorised any difference.
 */
export async function buildDashboard(
  db: D1Database,
  subject: User,
  role: UserRole,
): Promise<DashboardData> {
  switch (role) {
    case 'admin':
      return buildAdmin(db, subject);
    case 'tutor':
      return buildTutor(db, subject);
    case 'parent':
      return buildParent(db, subject);
    default:
      return buildStudent(db, subject);
  }
}

async function buildAdmin(db: D1Database, subject: User): Promise<AdminDashboard> {
  const [countsResult, totalsResult] = await db.batch<Record<string, unknown>>([
    db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student' WHERE u.deleted_at IS NULL) AS students,
         (SELECT COUNT(*) FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'parent'  WHERE u.deleted_at IS NULL) AS parents,
         (SELECT COUNT(*) FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'   WHERE u.deleted_at IS NULL) AS tutors,
         (SELECT COUNT(*) FROM active_sessions) AS live_sessions`,
    ),
    db.prepare(
      `SELECT COALESCE(SUM(charge_amount_cents), 0) AS billed,
              COALESCE(SUM(tutor_amount_cents), 0)  AS tutor_cost,
              COUNT(*) AS sessions
       FROM sessions`,
    ),
  ]);

  const counts = (countsResult?.results?.[0] ?? {}) as Record<string, number>;
  const totals = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;

  const balances = await computeBalances(db, subject);
  const missingSsn = await listTutorsMissingSsn(db);
  const sessions = await listSessions(db, subject, { limit: 5, offset: 0 } as never);

  return {
    kind: 'admin',
    counts: {
      students: Number(counts.students ?? 0),
      parents: Number(counts.parents ?? 0),
      tutors: Number(counts.tutors ?? 0),
      live_sessions: Number(counts.live_sessions ?? 0),
    },
    totals: {
      owed_to_tutors_cents: balances.totals.owed_to_tutors_cents,
      owed_by_families_cents: balances.totals.owed_by_families_cents,
      billed_all_time_cents: Number(totals.billed ?? 0),
      tutor_cost_all_time_cents: Number(totals.tutor_cost ?? 0),
      margin_all_time_cents: Number(totals.billed ?? 0) - Number(totals.tutor_cost ?? 0),
      session_count: Number(totals.sessions ?? 0),
    },
    // Worth chasing first.
    tutor_balances: [...balances.tutors].sort((a, b) => b.balance_cents - a.balance_cents),
    tutors_missing_ssn: missingSsn,
    student_balances: [...balances.students].sort((a, b) => b.balance_cents - a.balance_cents),
    recent_activity: await teachingActivity(db),
    recent_sessions: sessions.sessions,
    progress_spotlight: await progressSpotlight(db, null),
  };
}

async function buildTutor(db: D1Database, subject: User): Promise<TutorDashboard> {
  const studentsResult = await db
    .prepare(
      `SELECT a.student_user_id AS user_id, u.full_name,
              sp.school, sp.current_math_course,
              a.rate_in_person_cents, a.rate_virtual_cents,
              COALESCE((SELECT COUNT(*)            FROM sessions s WHERE s.tutor_user_id = a.tutor_user_id AND s.student_user_id = a.student_user_id), 0) AS session_count,
              COALESCE((SELECT SUM(s.tutor_amount_cents) FROM sessions s WHERE s.tutor_user_id = a.tutor_user_id AND s.student_user_id = a.student_user_id), 0) AS earned_cents,
              (SELECT MAX(s.occurred_on) FROM sessions s WHERE s.tutor_user_id = a.tutor_user_id AND s.student_user_id = a.student_user_id) AS last_session_on
       FROM assignments a
       JOIN users u ON u.id = a.student_user_id
       LEFT JOIN student_profiles sp ON sp.user_id = a.student_user_id
       WHERE a.tutor_user_id = ? AND a.is_active = 1
       ORDER BY u.full_name`,
    )
    .bind(subject.id)
    .all<Record<string, unknown>>();

  const balances = await computeBalances(db, subject);
  // Only lessons they TAUGHT. Someone who also parents (or is taught) would
  // otherwise see their family's lessons here, priced, under "Your recent
  // sessions" -- and have them counted as students they teach.
  const sessions = await listSessions(db, subject, {
    limit: 5,
    offset: 0,
    tutor_user_id: subject.id,
  } as never);
  const payments = await listPayments(db, subject, {
    limit: 5,
    offset: 0,
    direction: 'to_tutor',
    party_user_id: subject.id,
  } as never);
  const live = await db
    .prepare('SELECT COUNT(*) AS n FROM active_sessions WHERE tutor_user_id = ?')
    .bind(subject.id)
    .first<{ n: number }>();

  return {
    kind: 'tutor',
    students: (studentsResult.results ?? []).map((row) => ({
      user_id: String(row.user_id),
      full_name: String(row.full_name),
      school: (row.school as string | null) ?? null,
      current_math_course: (row.current_math_course as string | null) ?? null,
      session_count: Number(row.session_count ?? 0),
      last_session_on: (row.last_session_on as string | null) ?? null,
      earned_cents: Number(row.earned_cents ?? 0),
      rate_in_person_cents: (row.rate_in_person_cents as number | null) ?? null,
      rate_virtual_cents: (row.rate_virtual_cents as number | null) ?? null,
    })),
    ssn_received_on: await getSsnReceivedOn(db, subject.id),
    earnings: balances.tutors.find((t) => t.user_id === subject.id) ?? {
      user_id: subject.id,
      full_name: subject.full_name,
      earned_cents: 0,
      paid_cents: 0,
      balance_cents: 0,
      session_count: 0,
      topup_amount_cents: null,
    },
    live_sessions: Number(live?.n ?? 0),
    recent_sessions: sessions.sessions,
    recent_payments: payments.payments as Payment[],
    recent_activity: await teachingActivity(db, subject.id),
    // Only the students they teach: someone who also parents sees their own
    // children on the parent dashboard, not here.
    progress_spotlight: await progressSpotlight(
      db,
      (studentsResult.results ?? []).map((row) => String(row.user_id)),
    ),
  };
}

async function buildParent(db: D1Database, subject: User): Promise<ParentDashboard> {
  const balances = await computeBalances(db, subject);

  // The parent view is about their CHILDREN: their lessons (other than any
  // the parent taught themselves, which are on the tutor view), and family
  // payments -- not money the parent was paid as a tutor.
  const sessions = await listSessions(db, subject, { limit: 8, offset: 0 } as never, {
    sql:
      's.student_user_id IN (SELECT g.dependent_user_id FROM guardianships g WHERE g.guardian_user_id = ?)' +
      ' AND s.tutor_user_id <> ?',
    values: [subject.id, subject.id],
  });
  const payments = await listPayments(db, subject, {
    limit: 5,
    offset: 0,
    direction: 'from_parent',
  } as never);

  // computeBalances scopes to this person's own student row and their
  // children's; a parent who is also taught is not their own child.
  const children = balances.students.filter((row) => row.student_user_id !== subject.id);

  return {
    kind: 'parent',
    children,
    totals: {
      charged_cents: children.reduce((sum, child) => sum + child.charged_cents, 0),
      paid_cents: children.reduce((sum, child) => sum + child.paid_cents, 0),
      balance_cents: children.reduce((sum, child) => sum + child.balance_cents, 0),
    },
    recent_sessions: sessions.sessions,
    recent_payments: payments.payments as Payment[],
    progress: (
      await Promise.all(children.map((child) => buildStudentProgress(db, child.student_user_id)))
    ).filter((row) => row !== null),
  };
}

async function buildStudent(db: D1Database, subject: User): Promise<StudentDashboard> {
  const [profileResult, tutorsResult, totalsResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        'SELECT academic_year_goal, current_math_course FROM student_profiles WHERE user_id = ?',
      )
      .bind(subject.id),
    db
      .prepare(
        `SELECT a.tutor_user_id AS user_id, u.full_name,
                COALESCE((SELECT COUNT(*) FROM sessions s WHERE s.tutor_user_id = a.tutor_user_id AND s.student_user_id = ?), 0) AS session_count
         FROM assignments a
         JOIN users u ON u.id = a.tutor_user_id
         WHERE a.student_user_id = ? AND a.is_active = 1
         ORDER BY u.full_name`,
      )
      .bind(subject.id, subject.id),
    db
      .prepare(
        `SELECT COUNT(*) AS session_count, COALESCE(SUM(duration_minutes), 0) AS total_minutes
         FROM sessions WHERE student_user_id = ?`,
      )
      .bind(subject.id),
  ]);

  const profile = (profileResult?.results?.[0] ?? {}) as Record<string, string | null>;
  const totals = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;
  // Their own lessons, not ones they taught or their children's.
  const sessions = await listSessions(db, subject, {
    limit: 8,
    offset: 0,
    student_user_id: subject.id,
  } as never);

  return {
    kind: 'student',
    goal: profile.academic_year_goal ?? null,
    current_math_course: profile.current_math_course ?? null,
    tutors: (tutorsResult?.results ?? []).map((row) => ({
      user_id: String(row.user_id),
      full_name: String(row.full_name),
      session_count: Number(row.session_count ?? 0),
    })),
    totals: {
      session_count: Number(totals.session_count ?? 0),
      total_minutes: Number(totals.total_minutes ?? 0),
    },
    recent_sessions: sessions.sessions,
    progress: await buildStudentProgress(db, subject.id),
  };
}

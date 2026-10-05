import {
  REFLECTION_PROMPT_DAYS,
  zonedClockParts,
  type AdminDashboard,
  type AuditEvent,
  type DashboardData,
  type ParentDashboard,
  type Payment,
  type StudentProgress,
  type StudentDashboard,
  type TutorDashboard,
  type User,
  type UserRole,
} from '@tmi/shared';

import type { OrgContext } from '../lib/org.js';
import { computeBalances, computeTutorPaymentOutlook } from './balances.js';
import { getSsnReceivedOn, listTutorsMissingSsn } from './users.js';
import { listAuditEvents } from './audit.js';
import { listPayments } from './payments.js';
import { listSessions } from './sessions.js';
import { buildStudentProgress, progressReader, type ProgressReader } from './progress.js';
import { listAwaitingReflection, listRecentReflections } from './session-reflections.js';

/**
 * The first day a dashboard still asks for a reflection on, on the
 * organization's clock. Older lessons can have one; they are just not nagged.
 */
function reflectionPromptSince(timeZone: string): string {
  const [year, month, day] = zonedClockParts(new Date().toISOString(), timeZone)
    .day.split('-')
    .map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! - REFLECTION_PROMPT_DAYS))
    .toISOString()
    .slice(0, 10);
}

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
  org: OrgContext,
  visibleToUserId?: string,
): Promise<AuditEvent[]> {
  const { events } = await listAuditEvents(
    db,
    org.id,
    { limit: 40, offset: 0, include_deleted: false } as never,
    visibleToUserId,
  );
  return (events as AuditEvent[])
    // Payments name amounts; "finished the portal tour" is nobody's news.
    .filter((event) => !event.action.startsWith('payment.') && !event.action.startsWith('onboarding.'))
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
  org: OrgContext,
  among: string[] | null,
  reader: ProgressReader,
): Promise<StudentProgress[]> {
  if (among !== null && among.length === 0) return [];

  const within = among === null ? '' : `AND u.id IN (${among.map(() => '?').join(', ')})`;
  const picked = await db
    .prepare(
      `SELECT u.id
       FROM org_members m
       JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
       JOIN user_roles r ON r.organization_id = m.organization_id AND r.user_id = u.id
                        AND r.role = 'student'
       WHERE m.organization_id = ? AND m.removed_at IS NULL ${within}
       ORDER BY EXISTS (SELECT 1 FROM learning_plans p
                        WHERE p.organization_id = m.organization_id
                          AND p.student_user_id = u.id AND p.status = 'active') DESC,
                RANDOM()
       LIMIT ${SPOTLIGHT_SIZE}`,
    )
    .bind(org.id, ...(among ?? []))
    .all<{ id: string }>();

  const progress = await Promise.all(
    (picked.results ?? []).map((row) => buildStudentProgress(db, row.id, reader)),
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
  org: OrgContext,
  subject: User,
  role: UserRole,
): Promise<DashboardData> {
  switch (role) {
    case 'admin':
      return buildAdmin(db, org, subject);
    case 'tutor':
      return buildTutor(db, org, subject);
    case 'parent':
      return buildParent(db, org, subject);
    default:
      return buildStudent(db, org, subject);
  }
}

/** Members of this organization holding a role, counted. */
const MEMBERS_WITH_ROLE = (role: string) =>
  `(SELECT COUNT(*) FROM user_roles r
    JOIN org_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
    JOIN users u ON u.id = r.user_id
    WHERE r.organization_id = ?1 AND r.role = '${role}'
      AND m.removed_at IS NULL AND u.deleted_at IS NULL)`;

async function buildAdmin(db: D1Database, org: OrgContext, subject: User): Promise<AdminDashboard> {
  const [countsResult, totalsResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT
           ${MEMBERS_WITH_ROLE('student')} AS students,
           ${MEMBERS_WITH_ROLE('parent')} AS parents,
           ${MEMBERS_WITH_ROLE('tutor')} AS tutors,
           (SELECT COUNT(*) FROM active_sessions WHERE organization_id = ?1) AS live_sessions`,
      )
      .bind(org.id),
    db
      .prepare(
        `SELECT COALESCE(SUM(charge_amount_cents), 0) AS billed,
                COALESCE(SUM(tutor_amount_cents), 0)  AS tutor_cost,
                COUNT(*) AS sessions
         FROM sessions WHERE organization_id = ?`,
      )
      .bind(org.id),
  ]);

  const counts = (countsResult?.results?.[0] ?? {}) as Record<string, number>;
  const totals = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;

  const balances = await computeBalances(db, org.id, subject);
  const missingSsn = await listTutorsMissingSsn(db, org.id);
  const sessions = await listSessions(db, org.id, subject, { limit: 5, offset: 0 } as never);

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
    // Every tutor, most pressing payment first (the Finance tab's Tutor
    // payments panel). Only ever built here, for an admin.
    tutor_balances: await computeTutorPaymentOutlook(
      db,
      org.id,
      org.time_zone,
      subject,
      balances.tutors,
      new Date().toISOString(),
    ),
    tutors_missing_ssn: missingSsn,
    student_balances: [...balances.students].sort((a, b) => b.balance_cents - a.balance_cents),
    recent_activity: await teachingActivity(db, org),
    recent_sessions: sessions.sessions,
    progress_spotlight: await progressSpotlight(
      db,
      org,
      null,
      await progressReader(db, org, subject),
    ),
  };
}

async function buildTutor(db: D1Database, org: OrgContext, subject: User): Promise<TutorDashboard> {
  const studentsResult = await db
    .prepare(
      `SELECT a.student_user_id AS user_id, u.full_name,
              sp.school, sp.current_math_course,
              a.rate_in_person_cents, a.rate_virtual_cents,
              COALESCE((SELECT COUNT(*) FROM sessions s
                        WHERE s.organization_id = a.organization_id AND s.tutor_user_id = a.tutor_user_id
                          AND s.student_user_id = a.student_user_id), 0) AS session_count,
              COALESCE((SELECT SUM(s.tutor_amount_cents) FROM sessions s
                        WHERE s.organization_id = a.organization_id AND s.tutor_user_id = a.tutor_user_id
                          AND s.student_user_id = a.student_user_id), 0) AS earned_cents,
              (SELECT MAX(s.occurred_on) FROM sessions s
               WHERE s.organization_id = a.organization_id AND s.tutor_user_id = a.tutor_user_id
                 AND s.student_user_id = a.student_user_id) AS last_session_on
       FROM assignments a
       JOIN users u ON u.id = a.student_user_id
       LEFT JOIN student_profiles sp ON sp.organization_id = a.organization_id
                                    AND sp.user_id = a.student_user_id
       WHERE a.organization_id = ? AND a.tutor_user_id = ? AND a.is_active = 1
       ORDER BY u.full_name`,
    )
    .bind(org.id, subject.id)
    .all<Record<string, unknown>>();

  const balances = await computeBalances(db, org.id, subject);
  // Only lessons they TAUGHT. Someone who also parents (or is taught) would
  // otherwise see their family's lessons here, priced, under "Your recent
  // sessions" -- and have them counted as students they teach.
  const sessions = await listSessions(db, org.id, subject, {
    limit: 5,
    offset: 0,
    tutor_user_id: subject.id,
  } as never);
  const payments = await listPayments(db, org.id, subject, {
    limit: 5,
    offset: 0,
    direction: 'to_tutor',
    party_user_id: subject.id,
  } as never);
  const live = await db
    .prepare('SELECT COUNT(*) AS n FROM active_sessions WHERE organization_id = ? AND tutor_user_id = ?')
    .bind(org.id, subject.id)
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
    ssn_received_on: await getSsnReceivedOn(db, org.id, subject.id),
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
    recent_activity: await teachingActivity(db, org, subject.id),
    // Only the students they teach: someone who also parents sees their own
    // children on the parent dashboard, not here.
    progress_spotlight: await progressSpotlight(
      db,
      org,
      (studentsResult.results ?? []).map((row) => String(row.user_id)),
      await progressReader(db, org, subject),
    ),
    // Only lessons they taught, like everything else on this dashboard.
    recent_reflections: await listRecentReflections(db, org.id, subject.id),
  };
}

async function buildParent(db: D1Database, org: OrgContext, subject: User): Promise<ParentDashboard> {
  const balances = await computeBalances(db, org.id, subject);
  // Their children here: guardianships are each organization's own.
  const children_sql =
    's.student_user_id IN (SELECT g.dependent_user_id FROM guardianships g' +
    ' WHERE g.organization_id = s.organization_id AND g.guardian_user_id = ?)' +
    ' AND s.tutor_user_id <> ?';

  // The parent view is about their CHILDREN: their lessons (other than any
  // the parent taught themselves, which are on the tutor view), and family
  // payments -- not money the parent was paid as a tutor.
  const sessions = await listSessions(db, org.id, subject, { limit: 8, offset: 0 } as never, {
    sql: children_sql,
    values: [subject.id, subject.id],
  });
  const payments = await listPayments(db, org.id, subject, {
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
    progress: await (async () => {
      // Built for the dashboard's subject, once for all their children.
      const reader = await progressReader(db, org, subject);
      const rows = await Promise.all(
        children.map((child) => buildStudentProgress(db, child.student_user_id, reader)),
      );
      return rows.filter((row) => row !== null);
    })(),
    // Their children's lessons, less any they taught themselves -- the same
    // narrowing as the lessons above.
    awaiting_reflection: await listAwaitingReflection(
      db,
      org.id,
      { sql: children_sql, values: [subject.id, subject.id] },
      reflectionPromptSince(org.time_zone),
    ),
  };
}

async function buildStudent(db: D1Database, org: OrgContext, subject: User): Promise<StudentDashboard> {
  const [profileResult, tutorsResult, totalsResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT academic_year_goal, current_math_course FROM student_profiles
         WHERE organization_id = ? AND user_id = ?`,
      )
      .bind(org.id, subject.id),
    db
      .prepare(
        `SELECT a.tutor_user_id AS user_id, u.full_name,
                COALESCE((SELECT COUNT(*) FROM sessions s
                          WHERE s.organization_id = a.organization_id
                            AND s.tutor_user_id = a.tutor_user_id AND s.student_user_id = ?), 0) AS session_count
         FROM assignments a
         JOIN users u ON u.id = a.tutor_user_id
         WHERE a.organization_id = ? AND a.student_user_id = ? AND a.is_active = 1
         ORDER BY u.full_name`,
      )
      .bind(subject.id, org.id, subject.id),
    db
      .prepare(
        `SELECT COUNT(*) AS session_count, COALESCE(SUM(duration_minutes), 0) AS total_minutes
         FROM sessions WHERE organization_id = ? AND student_user_id = ?`,
      )
      .bind(org.id, subject.id),
  ]);

  const profile = (profileResult?.results?.[0] ?? {}) as Record<string, string | null>;
  const totals = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;
  // Their own lessons, not ones they taught or their children's.
  const sessions = await listSessions(db, org.id, subject, {
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
    progress: await buildStudentProgress(db, subject.id, await progressReader(db, org, subject)),
    awaiting_reflection: await listAwaitingReflection(
      db,
      org.id,
      { sql: 's.student_user_id = ?', values: [subject.id] },
      reflectionPromptSince(org.time_zone),
    ),
  };
}

import {
  TOPUP_PROJECTION_WEEKS,
  addDays,
  cancellationKey,
  computeAmountCents,
  expandUpcoming,
  projectTopupDate,
  resolveRateCents,
  topupDueCents,
  tutorPaymentUrgency,
  upcomingTakenKey,
  zonedClockParts,
} from '@tmi/shared';
import type {
  BalancesResponse,
  MonthlyFinanceResponse,
  MonthlyFinanceRow,
  StudentBalance,
  TutorBalance,
  TutorPaymentOutlook,
  TutorPaymentUrgency,
  User,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { isAdmin } from '../lib/scope.js';
import { listAssignments } from './assignments.js';
import { listCancellationsForSchedules } from './schedule-cancellations.js';
import { listSchedules } from './schedules.js';

/**
 * What everybody owes and is owed.
 *
 * Two independent ledgers that happen to share a table:
 *
 *   tutor   balance = what they earned teaching  - what we have paid them
 *   student balance = what their lessons cost    - what their family has paid
 *
 * The two sums come from DIFFERENT columns on the same session: the tutor is
 * paid `tutor_amount_cents` and the family is billed `charge_amount_cents`.
 * Reading one column for both made the institute's margin structurally zero.
 *
 * Families are keyed on the STUDENT, not the parent, because charges arise
 * from a student's lessons and a student may have two guardians who both pay.
 * The guardians are listed alongside so the screen can still answer "who do we
 * chase".
 */
export async function computeBalances(
  db: D1Database,
  org: OrgId,
  viewer: User,
): Promise<BalancesResponse> {
  const admin = isAdmin(viewer);
  const id = viewer.id;

  // Everything below is this organization's: its members, its lessons, its
  // payments. A tutor who also teaches elsewhere has a separate ledger there.
  // Non-admins see only their own row, or their children's.
  const tutorFilter = admin ? '' : 'AND u.id = ?';
  const tutorValues = admin ? [] : [id];

  const studentFilter = admin
    ? ''
    : `AND (u.id = ? OR u.id IN (
         SELECT g.dependent_user_id FROM guardianships g
         WHERE g.organization_id = m.organization_id AND g.guardian_user_id = ?
       ))`;
  const studentValues = admin ? [] : [id, id];

  const [tutorResult, studentResult, guardianResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT u.id AS user_id, u.full_name,
                tp.topup_amount_cents,
                COALESCE((SELECT SUM(s.tutor_amount_cents) FROM sessions s
                          WHERE s.organization_id = m.organization_id AND s.tutor_user_id = u.id), 0) AS earned_cents,
                COALESCE((SELECT COUNT(*) FROM sessions s
                          WHERE s.organization_id = m.organization_id AND s.tutor_user_id = u.id), 0) AS session_count,
                COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                          WHERE p.organization_id = m.organization_id AND p.party_user_id = u.id
                            AND p.direction = 'to_tutor'), 0) AS paid_cents
         FROM org_members m
         JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
         JOIN user_roles r ON r.organization_id = m.organization_id AND r.user_id = u.id
                          AND r.role = 'tutor'
         -- Left join: a tutor may hold the role with no profile row yet, and
         -- must still appear in the ledger.
         LEFT JOIN tutor_profiles tp ON tp.organization_id = m.organization_id AND tp.user_id = u.id
         WHERE m.organization_id = ? ${tutorFilter}
         ORDER BY u.full_name`,
      )
      .bind(org, ...tutorValues),
    db
      .prepare(
        `SELECT u.id AS student_user_id, u.full_name AS student_name,
                COALESCE((SELECT SUM(s.charge_amount_cents) FROM sessions s
                          WHERE s.organization_id = m.organization_id AND s.student_user_id = u.id), 0) AS charged_cents,
                COALESCE((SELECT COUNT(*) FROM sessions s
                          WHERE s.organization_id = m.organization_id AND s.student_user_id = u.id), 0) AS session_count,
                COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                          WHERE p.organization_id = m.organization_id AND p.student_user_id = u.id
                            AND p.direction = 'from_parent'), 0) AS paid_cents
         FROM org_members m
         JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
         JOIN user_roles r ON r.organization_id = m.organization_id AND r.user_id = u.id
                          AND r.role = 'student'
         WHERE m.organization_id = ? ${studentFilter}
         ORDER BY u.full_name`,
      )
      .bind(org, ...studentValues),
    db
      .prepare(
        `SELECT g.dependent_user_id, g.guardian_user_id, g.is_primary, p.full_name
         FROM guardianships g JOIN users p ON p.id = g.guardian_user_id
         WHERE g.organization_id = ?
         ORDER BY g.is_primary DESC, p.full_name`,
      )
      .bind(org),
  ]);

  const tutors: TutorBalance[] = ((tutorResult?.results ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const earned = Number(row.earned_cents ?? 0);
      const paid = Number(row.paid_cents ?? 0);

      return {
        user_id: String(row.user_id),
        full_name: String(row.full_name),
        earned_cents: earned,
        paid_cents: paid,
        balance_cents: earned - paid,
        session_count: Number(row.session_count ?? 0),
        // Scoped by the query itself: a non-admin only ever gets their own row.
        topup_amount_cents: (row.topup_amount_cents as number | null) ?? null,
      };
    },
  );

  const guardiansByStudent = new Map<string, StudentBalance['guardians']>();

  for (const row of (guardianResult?.results ?? []) as Record<string, unknown>[]) {
    const key = String(row.dependent_user_id);
    const list = guardiansByStudent.get(key) ?? [];
    list.push({
      user_id: String(row.guardian_user_id),
      full_name: String(row.full_name),
      is_primary: row.is_primary === 1,
    });
    guardiansByStudent.set(key, list);
  }

  const students: StudentBalance[] = (
    (studentResult?.results ?? []) as Record<string, unknown>[]
  ).map((row) => {
    const charged = Number(row.charged_cents ?? 0);
    const paid = Number(row.paid_cents ?? 0);
    const studentId = String(row.student_user_id);

    return {
      student_user_id: studentId,
      student_name: String(row.student_name),
      guardians: guardiansByStudent.get(studentId) ?? [],
      charged_cents: charged,
      paid_cents: paid,
      balance_cents: charged - paid,
      session_count: Number(row.session_count ?? 0),
    };
  });

  return {
    tutors,
    students,
    totals: {
      // Only outstanding amounts; an overpaid tutor should not offset someone
      // else's unpaid balance in the headline figure.
      owed_to_tutors_cents: tutors.reduce((sum, t) => sum + Math.max(0, t.balance_cents), 0),
      owed_by_families_cents: students.reduce((sum, s) => sum + Math.max(0, s.balance_cents), 0),
      // Advances are the office's own cash-flow question, so only an admin is
      // given the total; a tutor sees their own shortfall and nobody else's.
      topups_due_cents: admin
        ? tutors.reduce((sum, t) => sum + (topupDueCents(t) ?? 0), 0)
        : null,
    },
  };
}

const URGENCY_ORDER: Record<TutorPaymentUrgency, number> = { past_due: 0, due_soon: 1, on_track: 2 };

/** Soonest first, and no date after every date. */
function bySoonest(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * The tutors' balances with what the admin's Tutor payments panel adds: the
 * last payment each received, and the day their schedule is projected to
 * take their advance below its top-up level. Most pressing first.
 *
 * The projection walks the lessons the tutor's schedules say are coming --
 * the dates the sessions carousel shows (expandUpcoming), less any recorded
 * already or called off -- priced at the rate each would be recorded at, and
 * stops at the first that leaves them below their level. Nothing is stored:
 * recording, cancelling or rescheduling a lesson moves the date on the next
 * read. A schedule whose pairing has ended, or that has no rate for its mode,
 * cannot be recorded, so it earns the tutor nothing and is left out.
 *
 * Admin only, and the caller must have checked: the arrangement is the
 * tutor's and the office's, nobody else's.
 */
export async function computeTutorPaymentOutlook(
  db: D1Database,
  org: OrgId,
  timeZone: string,
  viewer: User,
  tutors: TutorBalance[],
  nowIso: string,
): Promise<TutorPaymentOutlook[]> {
  const today = zonedClockParts(nowIso, timeZone).day;
  const horizon = addDays(today, TOPUP_PROJECTION_WEEKS * 7);

  const [schedules, assignments, [lastPaidResult, recordedResult]] = await Promise.all([
    listSchedules(db, org, viewer, { include_inactive: false }),
    listAssignments(db, org, viewer, { include_inactive: false }),
    db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT party_user_id, amount_cents, paid_at
           FROM (
             SELECT p.party_user_id, p.amount_cents, p.paid_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY p.party_user_id ORDER BY p.paid_at DESC, p.created_at DESC
                    ) AS position
             FROM payments p
             WHERE p.organization_id = ? AND p.direction = 'to_tutor'
           )
           WHERE position = 1`,
        )
        .bind(org),
      // Lessons already recorded are in what the tutor has earned, so the
      // schedule's occurrence of them must not be counted a second time.
      db
        .prepare(
          `SELECT tutor_user_id, student_user_id, occurred_on FROM sessions
           WHERE organization_id = ? AND occurred_on >= ?`,
        )
        .bind(org, today),
    ]),
  ]);

  const cancelled = new Set(
    (
      await listCancellationsForSchedules(db, org, schedules.map((s) => s.id), { from: today })
    ).map((row) => cancellationKey(row.schedule_id, row.occurs_on)),
  );
  const taken = new Set(
    ((recordedResult?.results ?? []) as Record<string, unknown>[]).map((row) =>
      upcomingTakenKey(String(row.tutor_user_id), String(row.student_user_id), String(row.occurred_on)),
    ),
  );
  const pairings = new Map(assignments.map((a) => [`${a.tutor_user_id}|${a.student_user_id}`, a]));

  const lessonsByTutor = new Map<string, { occurs_on: string; pay_cents: number }[]>();

  for (const schedule of schedules) {
    const pairing = pairings.get(`${schedule.tutor_user_id}|${schedule.student_user_id}`);
    if (!pairing) continue;

    // The same resolution a recorded lesson goes through (lib/pricing.ts).
    const rate = resolveRateCents(
      schedule.mode,
      { in_person: pairing.rate_in_person_cents, virtual: pairing.rate_virtual_cents },
      {
        in_person: pairing.effective_rate_in_person_cents,
        virtual: pairing.effective_rate_virtual_cents,
      },
    );
    if (rate == null) continue;

    // One schedule at a time: a week has at most one of its dates, so this
    // many always reaches the horizon, however many schedules a tutor has.
    const { items } = expandUpcoming([schedule], nowIso, {
      offset: 0,
      limit: TOPUP_PROJECTION_WEEKS + 1,
      taken,
      timeZone,
    });

    const lessons = lessonsByTutor.get(schedule.tutor_user_id) ?? [];
    for (const lesson of items) {
      if (lesson.occurs_on > horizon) break;
      if (cancelled.has(cancellationKey(schedule.id, lesson.occurs_on))) continue;
      lessons.push({
        occurs_on: lesson.occurs_on,
        pay_cents: computeAmountCents(lesson.duration_minutes, rate),
      });
    }
    lessonsByTutor.set(schedule.tutor_user_id, lessons);
  }

  const lastPaid = new Map(
    ((lastPaidResult?.results ?? []) as Record<string, unknown>[]).map((row) => [
      String(row.party_user_id),
      { amount_cents: Number(row.amount_cents), paid_at: String(row.paid_at) },
    ]),
  );

  const rows = tutors.map((tutor): TutorPaymentOutlook => {
    // By day only: two lessons on one day cross the level on that day,
    // whichever is taught first.
    const lessons = (lessonsByTutor.get(tutor.user_id) ?? []).sort((a, b) =>
      a.occurs_on.localeCompare(b.occurs_on),
    );
    const next = projectTopupDate(tutor, lessons);
    const paid = lastPaid.get(tutor.user_id);

    return {
      ...tutor,
      last_paid_cents: paid?.amount_cents ?? null,
      last_paid_at: paid?.paid_at ?? null,
      next_topup_on: next,
      scheduled_lessons: lessons.length,
      urgency: tutorPaymentUrgency(tutor, next, today),
    };
  });

  // Within a colour: the biggest shortfall, then the soonest top-up, then
  // whoever is owed the most.
  return rows.sort(
    (a, b) =>
      URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
      (topupDueCents(b) ?? 0) - (topupDueCents(a) ?? 0) ||
      bySoonest(a.next_topup_on, b.next_topup_on) ||
      b.balance_cents - a.balance_cents ||
      a.full_name.localeCompare(b.full_name),
  );
}

/**
 * A month-by-month rundown of a financial year.
 *
 * Lessons are grouped by the date they were TAUGHT and payments by the date
 * they MOVED, because those answer different questions -- what the month
 * earned, and what the month's cash did. Keeping them in one row is the point:
 * the gap between the two columns is the institute's collection problem, and
 * it is invisible in either figure alone.
 *
 * A tutor gets their own teaching and their own pay; the family side is
 * withheld from them exactly as it is on a single session.
 */
export async function computeMonthlyFinance(
  db: D1Database,
  org: OrgId,
  viewer: User,
  year: number,
): Promise<MonthlyFinanceResponse> {
  const admin = isAdmin(viewer);
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  // A tutor's rundown covers the lessons they taught and the money they were
  // paid; an admin's covers the institute.
  const sessionScope = admin ? '' : 'AND s.tutor_user_id = ?';
  const sessionValues = admin ? [] : [viewer.id];

  const [sessionResult, paymentResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT substr(s.occurred_on, 1, 7) AS month,
                COUNT(*) AS session_count,
                COALESCE(SUM(s.duration_minutes), 0) AS minutes,
                COALESCE(SUM(s.charge_amount_cents), 0) AS billed_cents,
                COALESCE(SUM(s.tutor_amount_cents), 0) AS earned_cents
         FROM sessions s
         WHERE s.organization_id = ? AND s.occurred_on >= ? AND s.occurred_on < ? ${sessionScope}
         GROUP BY month`,
      )
      .bind(org, from, to, ...sessionValues),
    db
      .prepare(
        `SELECT substr(p.paid_at, 1, 7) AS month,
                COALESCE(SUM(CASE WHEN p.direction = 'from_parent' THEN p.amount_cents END), 0)
                  AS received_from_families_cents,
                COALESCE(SUM(CASE WHEN p.direction = 'to_tutor' ${admin ? '' : 'AND p.party_user_id = ?'}
                             THEN p.amount_cents END), 0) AS paid_to_tutors_cents
         FROM payments p
         WHERE p.organization_id = ? AND p.paid_at >= ? AND p.paid_at < ?
         GROUP BY month`,
      )
      .bind(...(admin ? [] : [viewer.id]), org, from, to),
  ]);

  const sessions = new Map<string, Record<string, unknown>>();
  for (const row of sessionResult?.results ?? []) sessions.set(String(row.month), row);

  const payments = new Map<string, Record<string, unknown>>();
  for (const row of paymentResult?.results ?? []) payments.set(String(row.month), row);

  // Every month of the year, not just the ones with activity: a gap in the
  // table is itself the answer to "what happened in August".
  const months: MonthlyFinanceRow[] = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const taught = sessions.get(month);
    const moved = payments.get(month);

    return {
      month,
      session_count: Number(taught?.session_count ?? 0),
      minutes: Number(taught?.minutes ?? 0),
      billed_cents: admin ? Number(taught?.billed_cents ?? 0) : null,
      received_from_families_cents: admin
        ? Number(moved?.received_from_families_cents ?? 0)
        : null,
      earned_cents: Number(taught?.earned_cents ?? 0),
      paid_to_tutors_cents: Number(moved?.paid_to_tutors_cents ?? 0),
    };
  });

  return { year, scope: admin ? 'institute' : 'tutor', months };
}

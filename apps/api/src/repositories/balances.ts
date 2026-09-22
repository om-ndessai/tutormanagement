import { topupDueCents } from '@tmi/shared';
import type {
  BalancesResponse,
  MonthlyFinanceResponse,
  MonthlyFinanceRow,
  StudentBalance,
  TutorBalance,
  User,
} from '@tmi/shared';

import { isAdmin } from '../lib/scope.js';

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
export async function computeBalances(db: D1Database, viewer: User): Promise<BalancesResponse> {
  const admin = isAdmin(viewer);
  const id = viewer.id;

  // Non-admins see only their own row, or their children's.
  const tutorFilter = admin ? '' : 'WHERE u.id = ?';
  const tutorValues = admin ? [] : [id];

  const studentFilter = admin
    ? ''
    : `WHERE u.id = ? OR u.id IN (
         SELECT g.dependent_user_id FROM guardianships g WHERE g.guardian_user_id = ?
       )`;
  const studentValues = admin ? [] : [id, id];

  const [tutorResult, studentResult, guardianResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT u.id AS user_id, u.full_name,
                tp.topup_amount_cents,
                COALESCE((SELECT SUM(s.tutor_amount_cents) FROM sessions s WHERE s.tutor_user_id = u.id), 0) AS earned_cents,
                COALESCE((SELECT COUNT(*)            FROM sessions s WHERE s.tutor_user_id = u.id), 0) AS session_count,
                COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.party_user_id = u.id AND p.direction = 'to_tutor'), 0) AS paid_cents
         FROM users u
         JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'
         -- Left join: a tutor may hold the role with no profile row yet, and
         -- must still appear in the ledger.
         LEFT JOIN tutor_profiles tp ON tp.user_id = u.id
         ${tutorFilter}
         ORDER BY u.full_name`,
      )
      .bind(...tutorValues),
    db
      .prepare(
        `SELECT u.id AS student_user_id, u.full_name AS student_name,
                COALESCE((SELECT SUM(s.charge_amount_cents) FROM sessions s WHERE s.student_user_id = u.id), 0) AS charged_cents,
                COALESCE((SELECT COUNT(*)            FROM sessions s WHERE s.student_user_id = u.id), 0) AS session_count,
                COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.student_user_id = u.id AND p.direction = 'from_parent'), 0) AS paid_cents
         FROM users u
         JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
         ${studentFilter}
         ORDER BY u.full_name`,
      )
      .bind(...studentValues),
    db
      .prepare(
        `SELECT g.dependent_user_id, g.guardian_user_id, g.is_primary, p.full_name
         FROM guardianships g JOIN users p ON p.id = g.guardian_user_id
         ORDER BY g.is_primary DESC, p.full_name`,
      ),
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
         WHERE s.occurred_on >= ? AND s.occurred_on < ? ${sessionScope}
         GROUP BY month`,
      )
      .bind(from, to, ...sessionValues),
    db
      .prepare(
        `SELECT substr(p.paid_at, 1, 7) AS month,
                COALESCE(SUM(CASE WHEN p.direction = 'from_parent' THEN p.amount_cents END), 0)
                  AS received_from_families_cents,
                COALESCE(SUM(CASE WHEN p.direction = 'to_tutor' ${admin ? '' : 'AND p.party_user_id = ?'}
                             THEN p.amount_cents END), 0) AS paid_to_tutors_cents
         FROM payments p
         WHERE p.paid_at >= ? AND p.paid_at < ?
         GROUP BY month`,
      )
      .bind(...(admin ? [] : [viewer.id]), from, to),
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

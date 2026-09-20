import type { BalancesResponse, StudentBalance, TutorBalance, User } from '@tmi/shared';

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
                COALESCE((SELECT SUM(s.tutor_amount_cents) FROM sessions s WHERE s.tutor_user_id = u.id), 0) AS earned_cents,
                COALESCE((SELECT COUNT(*)            FROM sessions s WHERE s.tutor_user_id = u.id), 0) AS session_count,
                COALESCE((SELECT SUM(p.amount_cents) FROM payments p WHERE p.party_user_id = u.id AND p.direction = 'to_tutor'), 0) AS paid_cents
         FROM users u
         JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'
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
    },
  };
}

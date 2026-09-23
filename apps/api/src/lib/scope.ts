import { hasRole, type User } from '@tmi/shared';

/** Admins are unrestricted; everyone else sees only what concerns them. */
export function isAdmin(viewer: User): boolean {
  return hasRole(viewer, 'admin');
}

/**
 * The people a non-admin may see, as a set of user ids.
 *
 * Returns `null` for an admin, meaning "no restriction" -- callers treat null
 * as unbounded rather than empty, which keeps the common case free of an extra
 * query.
 *
 * The rules, all of which exist so somebody can do their job:
 *   - yourself
 *   - if you tutor: your assigned students, and their parents (to contact them)
 *   - if you are taught: your tutors
 *   - if you are a parent: your children, and the tutors teaching them
 *   - if you are a child: your parents
 *
 * Written as EXISTS clauses over `users` rather than a UNION of id lists:
 * D1 caps how many terms a compound SELECT may have, and the union form
 * exceeded it.
 */
export async function visibleUserIds(db: D1Database, viewer: User): Promise<Set<string> | null> {
  if (isAdmin(viewer)) return null;

  const id = viewer.id;

  const result = await db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.id = ?
          OR EXISTS (
               SELECT 1 FROM assignments a
               WHERE a.is_active = 1
                 AND ((a.tutor_user_id = ? AND a.student_user_id = u.id)
                   OR (a.student_user_id = ? AND a.tutor_user_id = u.id))
             )
          OR EXISTS (
               SELECT 1 FROM guardianships g
               WHERE (g.guardian_user_id = ? AND g.dependent_user_id = u.id)
                  OR (g.dependent_user_id = ? AND g.guardian_user_id = u.id)
             )
          OR EXISTS (
               -- parents of the students I teach
               SELECT 1 FROM guardianships g
               JOIN assignments a ON a.student_user_id = g.dependent_user_id
               WHERE a.tutor_user_id = ? AND a.is_active = 1 AND g.guardian_user_id = u.id
             )
          OR EXISTS (
               -- tutors teaching my children
               SELECT 1 FROM assignments a
               JOIN guardianships g ON g.dependent_user_id = a.student_user_id
               WHERE g.guardian_user_id = ? AND a.is_active = 1 AND a.tutor_user_id = u.id
             )`,
    )
    .bind(id, id, id, id, id, id, id)
    .all<{ id: string }>();

  return new Set((result.results ?? []).map((row) => row.id));
}

/**
 * A WHERE fragment restricting rows that carry `tutor_user_id` and
 * `student_user_id` -- sessions and assignments both do.
 *
 * You see a row if you taught it, or if it is about you or one of your
 * children. Returns null for an admin.
 */
export function teachingScopeSql(
  viewer: User,
  alias: string,
): { sql: string; values: unknown[] } | null {
  if (isAdmin(viewer)) return null;

  return {
    sql:
      `(${alias}.tutor_user_id = ?` +
      ` OR ${alias}.student_user_id = ?` +
      ` OR ${alias}.student_user_id IN (` +
      `SELECT g.dependent_user_id FROM guardianships g WHERE g.guardian_user_id = ?))`,
    values: [viewer.id, viewer.id, viewer.id],
  };
}

/**
 * A WHERE fragment restricting rows that belong to ONE student -- their
 * assessment, their learning plan, the progress of their lessons.
 *
 * Wider than teachingScopeSql in one direction only: every tutor currently
 * assigned to the student sees the whole of it, not just the lessons they
 * taught themselves, because a plan is shared work and a tutor picking up a
 * student needs to know where the last one left off. A tutor whose pairing has
 * ended loses sight of it, as they lose sight of the student.
 *
 * `column` is the SQL expression naming the student, e.g. "p.student_user_id".
 * Returns null for an admin.
 */
export function studentScopeSql(
  viewer: User,
  column: string,
): { sql: string; values: unknown[] } | null {
  if (isAdmin(viewer)) return null;

  return {
    sql:
      `(${column} = ?` +
      ` OR ${column} IN (SELECT g.dependent_user_id FROM guardianships g WHERE g.guardian_user_id = ?)` +
      ` OR ${column} IN (SELECT a.student_user_id FROM assignments a` +
      ` WHERE a.tutor_user_id = ? AND a.is_active = 1))`,
    values: [viewer.id, viewer.id, viewer.id],
  };
}

/**
 * Hides the half of a session's money the viewer has no business seeing.
 *
 * The institute buys tutoring at one rate and sells it at another, and keeps
 * the difference. Showing a tutor what the family pays, or a family what the
 * tutor is paid, would expose that margin to both sides of the deal, so each
 * party sees only their own side. An admin sees both, which is what makes the
 * margin visible to them alone.
 *
 * Applied on the way out, after the query: the columns are always read, so the
 * totals an admin sees and the ones a tutor sees come from the same rows.
 */
export function scopeSessionMoney<
  T extends {
    tutor_user_id: string;
    tutor_rate_cents: number | null;
    tutor_amount_cents: number | null;
    charge_rate_cents: number | null;
    charge_amount_cents: number | null;
  },
>(row: T, viewer: User): T {
  if (isAdmin(viewer)) return row;

  // A tutor looking at a lesson they taught sees their pay, not the price.
  // Everybody else here is the student or their guardian, so they see the
  // price and not the tutor's pay.
  return row.tutor_user_id === viewer.id
    ? { ...row, charge_rate_cents: null, charge_amount_cents: null }
    : { ...row, tutor_rate_cents: null, tutor_amount_cents: null };
}

/**
 * Hides what a student's family is charged from anyone but an admin.
 *
 * A tutor can read the record of a student they teach, and already knows their
 * own rate; showing them the price alongside it would hand them the
 * institute's margin. The same reasoning as scopeSessionMoney, applied to the
 * profile the price is set on.
 */
export function scopeStudentCharges<
  T extends {
    student_profile: {
      charge_rate_in_person_cents: number | null;
      charge_rate_virtual_cents: number | null;
    } | null;
  },
>(detail: T, viewer: User): T {
  if (isAdmin(viewer) || !detail.student_profile) return detail;

  return {
    ...detail,
    student_profile: {
      ...detail.student_profile,
      charge_rate_in_person_cents: null,
      charge_rate_virtual_cents: null,
    },
  };
}

/**
 * Hides a tutor's advance arrangement from everyone but that tutor and an
 * admin.
 *
 * A parent can open the record of the tutor teaching their child, and a
 * student the record of their own tutor -- neither has any business knowing
 * what the office pays that tutor up front. The tutor themselves does: it is
 * their money, and the threshold is what tells them when the next payment is
 * coming.
 *
 * Same shape as scopeStudentCharges, and for the same reason: applied on the
 * way out, after the query, so one code path reads the column and one decides
 * who may see it.
 */
export function scopeTutorTopup<
  T extends {
    id: string;
    tutor_profile: { topup_amount_cents: number | null } | null;
  },
>(detail: T, viewer: User): T {
  if (isAdmin(viewer) || detail.id === viewer.id || !detail.tutor_profile) return detail;

  return {
    ...detail,
    tutor_profile: { ...detail.tutor_profile, topup_amount_cents: null },
  };
}

/**
 * Hides the institute's TIN from anyone who is not an admin.
 *
 * A tutor or a parent can open an admin's record -- they are people in the
 * same directory -- and the number the institute files its taxes under is not
 * theirs to read. Unlike the tutor's advance, there is no "unless it is your
 * own" clause worth making: an admin's own record is already covered by being
 * an admin.
 */
export function scopeAdminTin<T extends { admin_profile: { tin: string | null } | null }>(
  detail: T,
  viewer: User,
): T {
  if (isAdmin(viewer) || !detail.admin_profile) return detail;

  return { ...detail, admin_profile: { ...detail.admin_profile, tin: null } };
}

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

import { hasRole, type User } from '@tmi/shared';

/** Admins are unrestricted; everyone else sees only what concerns them. */
export function isAdmin(viewer: User): boolean {
  return hasRole(viewer, 'admin');
}

/**
 * The people a non-admin may see, as a set of user ids. Returns `null` for an
 * admin, meaning "no restriction" -- callers treat null as unbounded rather
 * than empty, which keeps the common case free of an extra query.
 *
 * Today that is yourself and your immediate family links. Phase 4 widens it to
 * the people you teach or are taught by.
 */
export async function visibleUserIds(db: D1Database, viewer: User): Promise<Set<string> | null> {
  if (isAdmin(viewer)) return null;

  const id = viewer.id;

  const result = await db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.id = ?
          OR EXISTS (
               SELECT 1 FROM guardianships g
               WHERE (g.guardian_user_id = ? AND g.dependent_user_id = u.id)
                  OR (g.dependent_user_id = ? AND g.guardian_user_id = u.id)
             )`,
    )
    .bind(id, id, id)
    .all<{ id: string }>();

  return new Set((result.results ?? []).map((row) => row.id));
}

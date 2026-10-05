/**
 * The PERSON, across every organization: their sign-in identity and how to
 * reach them. Nothing an organization records about someone is read here --
 * that is the users repository, always for one organization.
 *
 * Used by sign-in, the request gate and the platform console, which work
 * before (or outside) any organization.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export interface Person {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  /** Whether a Google account is pinned. The `sub` itself never leaves here. */
  google_sub_pinned: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  /** Read in the same query, so the gate on every request is one round trip. */
  platform_admin: boolean;
}

interface PersonRow {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  google_sub: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  platform_admin: number;
}

const SELECT_PERSON = `SELECT id, email, full_name, phone, google_sub, last_login_at, created_at, updated_at,
       EXISTS (SELECT 1 FROM platform_admins p WHERE p.user_id = users.id) AS platform_admin
  FROM users`;

function toPerson(row: PersonRow): Person {
  const { google_sub, platform_admin, ...rest } = row;
  return { ...rest, google_sub_pinned: google_sub !== null, platform_admin: platform_admin === 1 };
}

export async function getPersonById(db: D1Database, id: string): Promise<Person | null> {
  const row = await db
    .prepare(`${SELECT_PERSON} WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<PersonRow>();
  return row ? toPerson(row) : null;
}

export async function getPersonByEmail(db: D1Database, email: string): Promise<Person | null> {
  // A blank address must never match a row that stores one.
  if (!email.trim()) return null;
  const row = await db
    .prepare(`${SELECT_PERSON} WHERE lower(email) = ? AND deleted_at IS NULL`)
    .bind(email.trim().toLowerCase())
    .first<PersonRow>();
  return row ? toPerson(row) : null;
}

/**
 * Who a verified Google identity is.
 *
 * The pinned `sub` is looked up FIRST, so an account survives a change of
 * address. An email match is refused when that row is already pinned to a
 * DIFFERENT Google account: otherwise whoever could edit someone's email in
 * one organization could sign in as them in every other.
 */
export async function resolveSignIn(
  db: D1Database,
  identity: { sub: string; email: string },
): Promise<{ person: Person | null; pinnedToAnother: boolean }> {
  const bySub = await db
    .prepare(`${SELECT_PERSON} WHERE google_sub = ? AND deleted_at IS NULL`)
    .bind(identity.sub)
    .first<PersonRow>();
  if (bySub) return { person: toPerson(bySub), pinnedToAnother: false };

  const byEmail = await db
    .prepare(`${SELECT_PERSON} WHERE lower(email) = ? AND deleted_at IS NULL`)
    .bind(identity.email.trim().toLowerCase())
    .first<PersonRow>();
  if (!byEmail) return { person: null, pinnedToAnother: false };

  if (byEmail.google_sub !== null && byEmail.google_sub !== identity.sub) {
    return { person: null, pinnedToAnother: true };
  }
  return { person: toPerson(byEmail), pinnedToAnother: false };
}

/**
 * Records a sign-in and pins the Google `sub` the first time it is seen.
 *
 * Someone who had never signed in before accepts every organization that
 * invited them, by signing in: there is nothing of theirs elsewhere to
 * protect. Anyone who has signed in before answers each new invitation
 * themselves.
 */
export async function recordSignIn(db: D1Database, id: string, googleSub: string): Promise<void> {
  const before = await db
    .prepare('SELECT last_login_at FROM users WHERE id = ?')
    .bind(id)
    .first<{ last_login_at: string | null }>();

  const statements = [
    db
      .prepare(
        `UPDATE users SET last_login_at = ${NOW}, updated_at = ${NOW},
           google_sub = COALESCE(google_sub, ?)
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(googleSub, id),
  ];
  if (before && before.last_login_at === null) {
    statements.push(
      db
        .prepare(
          // org-scope: a first sign-in accepts every organization that invited them.
          `UPDATE org_members SET status = 'active', updated_at = ${NOW}
           WHERE user_id = ? AND status = 'invited' AND removed_at IS NULL`,
        )
        .bind(id),
    );
  }
  await db.batch(statements);
}

export async function createPerson(
  db: D1Database,
  input: { email: string | null; full_name: string; phone?: string | null; google_sub?: string | null },
): Promise<Person> {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO users (id, email, full_name, phone, google_sub) VALUES (?, ?, ?, ?, ?)')
    .bind(id, input.email, input.full_name, input.phone ?? null, input.google_sub ?? null)
    .run();
  const person = await getPersonById(db, id);
  if (!person) throw new Error('Insert into users returned no row.');
  return person;
}

/** How many organizations a person belongs to (removed memberships included). */
export async function countMemberships(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      // org-scope: the person's standing across organizations, for the console.
      'SELECT COUNT(*) AS total FROM org_members WHERE user_id = ?',
    )
    .bind(userId)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

/**
 * Shared fields, changed for every organization at once. Only a platform
 * admin -- or an organization admin when the person belongs to that
 * organization alone -- may call this; the routes decide which.
 */
export async function updatePersonFields(
  db: D1Database,
  id: string,
  fields: { full_name?: string; email?: string | null; phone?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of ['full_name', 'email', 'phone'] as const) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      values.push(fields[key] ?? null);
    }
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = ${NOW}`);
  await db
    .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
    .bind(...values, id)
    .run();
}

/** Lets a recreated Google account sign in again. Platform admins only. */
export async function unpinGoogleSub(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE users SET google_sub = NULL, updated_at = ${NOW} WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .run();
  return Boolean(result.meta.changes);
}

// ---------------------------------------------------------------------------
// Platform admins
// ---------------------------------------------------------------------------

export async function isPlatformAdmin(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM platform_admins WHERE user_id = ?')
    .bind(userId)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

export async function countPlatformAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM platform_admins')
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function addPlatformAdmin(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('INSERT INTO platform_admins (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING')
    .bind(userId)
    .run();
}

export async function listPlatformAdmins(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, u.email, p.created_at
       FROM platform_admins p JOIN users u ON u.id = p.user_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.full_name COLLATE NOCASE`,
    )
    .all<{ user_id: string; full_name: string; email: string | null; created_at: string }>();
  return result.results ?? [];
}

/** The first person anywhere, for the sign-in-off bypass on a database with no members. */
export async function getFirstPerson(db: D1Database): Promise<Person | null> {
  const row = await db
    .prepare(`${SELECT_PERSON} WHERE deleted_at IS NULL ORDER BY created_at, id LIMIT 1`)
    .first<PersonRow>();
  return row ? toPerson(row) : null;
}

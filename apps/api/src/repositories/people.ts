import { mayLinkByEmail, type AgeBand, type AuthProvider, type PlatformAccount, type UserIdentity } from '@tmi/shared';

import type { VerifiedIdentity } from '../lib/identity.js';
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

// ---------------------------------------------------------------------------
// Phase 55: one person, several ways in (user_identities)
// ---------------------------------------------------------------------------

export type IdentityRefusal = 'pinned' | 'unverified';

/**
 * Who a verified provider account is (docs/social-login-plan.md).
 *
 * The account itself first -- `(provider, subject)`, or for Google a pinned
 * `users.google_sub` an older Worker wrote -- so a person survives a change of
 * address. Otherwise their email may join it to an existing person only under
 * `mayLinkByEmail`'s three rules: verified by the provider, not an Apple relay
 * address, and no account from that provider on the person yet. A person who
 * HAS one from that provider is refused ('pinned', today's rule); an address
 * the provider does not vouch for is refused ('unverified') rather than made
 * into a second person with the same email.
 */
export async function resolveIdentity(
  db: D1Database,
  identity: VerifiedIdentity,
): Promise<{ person: Person | null; refusal: IdentityRefusal | null }> {
  const linked = await db
    .prepare(
      `${SELECT_PERSON} WHERE deleted_at IS NULL AND (
         id = (SELECT i.user_id FROM user_identities i WHERE i.provider = ? AND i.subject = ?)
         ${identity.provider === 'google' ? 'OR google_sub = ?' : ''})
       LIMIT 1`,
    )
    .bind(identity.provider, identity.subject, ...(identity.provider === 'google' ? [identity.subject] : []))
    .first<PersonRow>();
  if (linked) return { person: toPerson(linked), refusal: null };

  if (!identity.email) return { person: null, refusal: null };
  const byEmail = await db
    .prepare(`${SELECT_PERSON} WHERE lower(email) = ? AND deleted_at IS NULL`)
    .bind(identity.email)
    .first<PersonRow>();
  if (!byEmail) return { person: null, refusal: null };

  const has = await db
    .prepare('SELECT 1 AS hit FROM user_identities WHERE user_id = ? AND provider = ?')
    .bind(byEmail.id, identity.provider)
    .first<{ hit: number }>();
  const personHasProvider = Boolean(has) || (identity.provider === 'google' && byEmail.google_sub !== null);
  if (personHasProvider) return { person: null, refusal: 'pinned' };
  if (!mayLinkByEmail({ emailVerified: identity.emailVerified, email: identity.email, personHasProvider })) {
    return { person: null, refusal: 'unverified' };
  }
  return { person: toPerson(byEmail), refusal: null };
}

/**
 * The statements that record a provider account on a person: its row (made, or
 * its last use stamped) and, for Google, `users.google_sub`, which older Workers
 * read. A second account from the same provider on one person fails the
 * `user_identities_one_per_provider` index (a unique-constraint error).
 */
export function identityStatements(
  db: D1Database,
  userId: string,
  identity: Pick<VerifiedIdentity, 'provider' | 'subject' | 'email'>,
  revokeToken: string | null = null,
): D1PreparedStatement[] {
  const statements = [
    db
      .prepare(
        `INSERT INTO user_identities (provider, subject, user_id, email_at_link, revoke_token, last_used_at)
         VALUES (?, ?, ?, ?, ?, ${NOW})
         ON CONFLICT (provider, subject) DO UPDATE SET last_used_at = ${NOW},
           revoke_token = COALESCE(excluded.revoke_token, user_identities.revoke_token)
         WHERE user_identities.user_id = excluded.user_id`,
      )
      .bind(identity.provider, identity.subject, userId, identity.email, revokeToken),
  ];
  if (identity.provider === 'google') {
    statements.push(
      db
        .prepare(`UPDATE users SET google_sub = COALESCE(google_sub, ?) WHERE id = ?`)
        .bind(identity.subject, userId),
    );
  }
  return statements;
}

/** The person's own ways in, for My profile. Never the subject or the revoke token. */
export async function listIdentities(db: D1Database, userId: string): Promise<UserIdentity[]> {
  const result = await db
    .prepare(
      `SELECT provider, email_at_link, created_at, last_used_at FROM user_identities
       WHERE user_id = ? ORDER BY created_at`,
    )
    .bind(userId)
    .all<UserIdentity>();
  return result.results ?? [];
}

/**
 * Removes one way in. The last one cannot go (the caller checks). Removing
 * Google also unpins `users.google_sub`, so an older Worker forgets it too.
 * Returns Apple's revoke token, when there was one, for the caller to revoke.
 */
export async function removeIdentity(
  db: D1Database,
  userId: string,
  provider: AuthProvider,
): Promise<{ removed: boolean; revokeToken: string | null }> {
  const row = await db
    .prepare('SELECT revoke_token FROM user_identities WHERE user_id = ? AND provider = ?')
    .bind(userId, provider)
    .first<{ revoke_token: string | null }>();
  if (!row) return { removed: false, revokeToken: null };
  await db.batch([
    db.prepare('DELETE FROM user_identities WHERE user_id = ? AND provider = ?').bind(userId, provider),
    ...(provider === 'google'
      ? [db.prepare(`UPDATE users SET google_sub = NULL, updated_at = ${NOW} WHERE id = ?`).bind(userId)]
      : []),
  ]);
  return { removed: true, revokeToken: row.revoke_token };
}

/** Every Apple revoke token a person holds, for account deletion. */
export async function appleRevokeTokens(db: D1Database, userId: string): Promise<string[]> {
  const result = await db
    .prepare("SELECT revoke_token FROM user_identities WHERE user_id = ? AND provider = 'apple' AND revoke_token IS NOT NULL")
    .bind(userId)
    .all<{ revoke_token: string }>();
  return (result.results ?? []).map((row) => row.revoke_token);
}

/** Apple's notice that a person withdrew consent or deleted their Apple account: that way in is gone. */
export async function forgetIdentity(db: D1Database, provider: AuthProvider, subject: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM user_identities WHERE provider = ? AND subject = ?')
    .bind(provider, subject)
    .run();
  return Boolean(result.meta.changes);
}

/** Phase 53/55 (the test portal): the person's provider accounts, for re-checking the invited list. */
export async function listIdentitySubjects(
  db: D1Database,
  userId: string,
): Promise<{ provider: string; subject: string }[]> {
  const result = await db
    .prepare('SELECT provider, subject FROM user_identities WHERE user_id = ?')
    .bind(userId)
    .all<{ provider: string; subject: string }>();
  return result.results ?? [];
}

/**
 * Records a sign-in and pins the Google `sub` the first time it is seen.
 *
 * Someone who had never signed in before accepts every organization a
 * platform admin made that invited them, by signing in: there is nothing of
 * theirs elsewhere to protect. A self-serve space's invitation (Phase 51), and
 * any invitation to someone who has signed in before, is answered by the
 * person themselves.
 */
export async function recordSignIn(
  db: D1Database,
  id: string,
  identity: Pick<VerifiedIdentity, 'provider' | 'subject' | 'email'>,
  revokeToken: string | null = null,
): Promise<void> {
  const before = await db
    .prepare('SELECT last_login_at FROM users WHERE id = ?')
    .bind(id)
    .first<{ last_login_at: string | null }>();

  const statements = [
    db
      .prepare(
        `UPDATE users SET last_login_at = ${NOW}, updated_at = ${NOW} WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(id),
    ...identityStatements(db, id, identity, revokeToken),
  ];
  if (before && before.last_login_at === null) {
    statements.push(
      db
        .prepare(
          // org-scope: a first sign-in accepts every CONSOLE organization that invited them.
          // Phase 51: a self-serve space's invitation is always answered by the person.
          `UPDATE org_members SET status = 'active', invited_name = NULL, updated_at = ${NOW}
           WHERE user_id = ? AND status = 'invited' AND removed_at IS NULL
             AND organization_id IN (SELECT o.id FROM organizations o WHERE o.created_via = 'console')`,
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
  const [result] = await db.batch([
    db.prepare(`UPDATE users SET google_sub = NULL, updated_at = ${NOW} WHERE id = ? AND deleted_at IS NULL`).bind(id),
    // Phase 55: the Google way in goes with the pin.
    db.prepare("DELETE FROM user_identities WHERE user_id = ? AND provider = 'google'").bind(id),
  ]);
  return Boolean(result?.meta.changes);
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

// ---------------------------------------------------------------------------
// Phase 52: people who signed themselves up
// ---------------------------------------------------------------------------

export async function getPlatformAccount(db: D1Database, userId: string): Promise<PlatformAccount | null> {
  const row = await db
    .prepare('SELECT age_band FROM platform_accounts WHERE user_id = ?')
    .bind(userId)
    .first<{ age_band: AgeBand }>();
  return row ? { age_band: row.age_band } : null;
}

/** A newcomer who answered the age question (13 or over) and accepted the terms: the person, in one batch. */
export async function createSignedUpPerson(
  db: D1Database,
  input: {
    email: string;
    fullName: string;
    /** Phase 55: the provider account they signed up with; null with sign-in off (local, the demo). */
    identity: Pick<VerifiedIdentity, 'provider' | 'subject' | 'email'> | null;
    ageBand: AgeBand;
    termsVersion: string;
    privacyVersion: string;
  },
): Promise<Person> {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(`INSERT INTO users (id, email, full_name, last_login_at) VALUES (?, ?, ?, ${NOW})`)
      .bind(id, input.email, input.fullName),
    ...(input.identity ? identityStatements(db, id, input.identity) : []),
    db
      .prepare(
        `INSERT INTO platform_accounts (user_id, age_band, age_confirmed_at, terms_version, privacy_version, accepted_at)
         VALUES (?, ?, ${NOW}, ?, ?, ${NOW})`,
      )
      .bind(id, input.ageBand, input.termsVersion, input.privacyVersion),
  ]);
  const person = await getPersonById(db, id);
  if (!person) throw new Error('Insert into users returned no row.');
  return person;
}

/**
 * Whether the person may delete their account themselves: they belong to no space (removed from
 * every one), have no open request, and are not a platform admin.
 */
export async function accountDeletable(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      // org-scope: a person's own memberships and requests across spaces, as counts.
      `SELECT (SELECT COUNT(*) FROM org_members WHERE user_id = ?1 AND removed_at IS NULL)
            + (SELECT COUNT(*) FROM join_requests WHERE user_id = ?1 AND outcome IS NULL)
            + (SELECT COUNT(*) FROM platform_admins WHERE user_id = ?1) AS n`,
    )
    .bind(userId)
    .first<{ n: number }>();
  return (row?.n ?? 1) === 0;
}

/** Deletes the account: the name, address, phone and Google id go; the row stays for history. */
export async function deleteOwnAccount(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db
      .prepare(
        `UPDATE users SET full_name = 'Deleted account', email = NULL, phone = NULL, google_sub = NULL,
                deleted_at = ${NOW}, updated_at = ${NOW}
         WHERE id = ?`,
      )
      .bind(userId),
    // Phase 55: every way in goes with it (the caller revoked Apple's tokens first).
    db.prepare('DELETE FROM user_identities WHERE user_id = ?').bind(userId),
    // Phase 56: their public links read "no longer available".
    // org-scope: a person's own shares, in every space, as their account goes.
    db.prepare(`UPDATE shares SET withdrawn_at = COALESCE(withdrawn_at, ${NOW}) WHERE user_id = ?`).bind(userId),
    db.prepare('DELETE FROM platform_accounts WHERE user_id = ?').bind(userId),
  ]);
}


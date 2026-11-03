import {
  DEFAULT_ACCESS_SETTINGS,
  accessSettingsSchema,
  type AccessAccount,
  type AccessListEntry,
  type AccessListEntryInput,
  type AccessSettings,
  type AccountAccess,
  type AgeBand,
  type InvitedEntry,
} from '@tmi/shared';

/**
 * Phase 65 (docs/access-approval-plan.md): sign-up access -- the console's mode, the platform's list
 * (`access_list`) and the accounts' access (`platform_accounts.access`). The platform's, not an
 * organization's: no query here names one.
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const SETTINGS_TTL_MS = 15_000;

let memo: { value: AccessSettings; at: number } | null = null;

/** The mode. No row (or one that no longer parses): open. Memoised a few seconds; `now` 0 reads afresh. */
export async function getAccessSettings(db: D1Database, now = Date.now()): Promise<AccessSettings> {
  if (memo && now - memo.at >= 0 && now - memo.at < SETTINGS_TTL_MS) return memo.value;
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'access'").first<{ value: string }>();
  let value = DEFAULT_ACCESS_SETTINGS;
  if (row) {
    try {
      const parsed = accessSettingsSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) value = parsed.data;
    } catch {
      // Open, as before Phase 65.
    }
  }
  memo = { value, at: now };
  return value;
}

export async function putAccessSettings(db: D1Database, value: AccessSettings, actorId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_by) VALUES ('access', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(value), actorId)
    .run();
  memo = { value, at: Date.now() };
}

/** The list's entries for matching: short, so read whole and matched in code (invitedMatch). */
export async function accessListEntries(db: D1Database): Promise<InvitedEntry[]> {
  const result = await db.prepare('SELECT email, provider, subject FROM access_list').all<InvitedEntry>();
  return result.results ?? [];
}

export async function listAccessList(db: D1Database): Promise<AccessListEntry[]> {
  const result = await db
    .prepare(
      `SELECT a.id, a.email, a.provider, a.subject, a.note, a.added_at, u.full_name AS added_by_name
         FROM access_list a LEFT JOIN users u ON u.id = a.added_by
        ORDER BY a.added_at DESC`,
    )
    .all<AccessListEntry>();
  return result.results ?? [];
}

export async function addAccessListEntry(db: D1Database, input: AccessListEntryInput, actorId: string): Promise<AccessListEntry> {
  const id = crypto.randomUUID();
  await db
    .prepare('INSERT INTO access_list (id, email, provider, subject, note, added_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.email ?? null, input.provider ?? null, input.subject ?? null, input.note ?? null, actorId)
    .run();
  const entry = (await listAccessList(db)).find((row) => row.id === id);
  if (!entry) throw new Error('Insert into access_list returned no row.');
  return entry;
}

/** Removes an entry; the removed one, or null when there was none. */
export async function removeAccessListEntry(db: D1Database, id: string): Promise<AccessListEntry | null> {
  const entry = (await listAccessList(db)).find((row) => row.id === id) ?? null;
  if (entry) await db.prepare('DELETE FROM access_list WHERE id = ?').bind(id).run();
  return entry;
}

interface AccountRow {
  user_id: string;
  full_name: string;
  email: string | null;
  age_band: AgeBand;
  access: AccountAccess;
  providers: string | null;
  signed_up_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
}

const SELECT_ACCOUNT = `SELECT p.user_id, u.full_name, u.email, p.age_band, p.access, p.accepted_at AS signed_up_at,
       p.access_decided_at AS decided_at, d.full_name AS decided_by_name,
       (SELECT group_concat(i.provider) FROM user_identities i WHERE i.user_id = p.user_id) AS providers
  FROM platform_accounts p
  JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
  LEFT JOIN users d ON d.id = p.access_decided_by`;

function toAccount(row: AccountRow): AccessAccount {
  return { ...row, providers: row.providers ? [...new Set(row.providers.split(','))] : [] };
}

/** Everyone waiting, oldest first (A6). */
export async function listWaitingAccounts(db: D1Database): Promise<AccessAccount[]> {
  const result = await db
    .prepare(`${SELECT_ACCOUNT} WHERE p.access = 'pending' ORDER BY p.accepted_at ASC LIMIT 200`)
    .all<AccountRow>();
  return (result.results ?? []).map(toAccount);
}

/** The accounts decided lately, newest first: the declined, and the approved that someone decided. */
export async function listDecidedAccounts(db: D1Database): Promise<AccessAccount[]> {
  const result = await db
    .prepare(`${SELECT_ACCOUNT} WHERE p.access_decided_at IS NOT NULL ORDER BY p.access_decided_at DESC LIMIT 50`)
    .all<AccountRow>();
  return (result.results ?? []).map(toAccount);
}

export async function getAccessAccount(db: D1Database, userId: string): Promise<AccessAccount | null> {
  const row = await db.prepare(`${SELECT_ACCOUNT} WHERE p.user_id = ?`).bind(userId).first<AccountRow>();
  return row ? toAccount(row) : null;
}

export async function decideAccess(db: D1Database, userId: string, access: 'approved' | 'declined', actorId: string): Promise<void> {
  await db
    .prepare(`UPDATE platform_accounts SET access = ?, access_decided_at = ${NOW}, access_decided_by = ? WHERE user_id = ?`)
    .bind(access, actorId, userId)
    .run();
}

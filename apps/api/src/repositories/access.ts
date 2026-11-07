import {
  DEFAULT_ACCESS_SETTINGS,
  accessSettingsSchema,
  featureOn,
  type AccessAccount,
  type AccessListEntry,
  type AccessListEntryInput,
  type AccessSettings,
  type AccountAccess,
  type AgeBand,
  type InvitedEntry,
  type PlacementHow,
  type PlacementSpace,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { joinRequestStatement } from './organizations.js';

/**
 * Phase 65 (docs/access-approval-plan.md): sign-up access -- the console's mode, the platform's list
 * (`access_list`) and the accounts' access (`platform_accounts.access`). The platform's, not an
 * organization's -- except Phase 80's placement (below), whose cross-space statements say so.
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
  // Phase 80 (A11): placed nowhere until `listDecidedAccounts` reads where an approval placed them.
  return { ...row, providers: row.providers ? [...new Set(row.providers.split(','))] : [], placed_in: null };
}

/** Everyone waiting, oldest first (A6). */
export async function listWaitingAccounts(db: D1Database): Promise<AccessAccount[]> {
  const result = await db
    .prepare(`${SELECT_ACCOUNT} WHERE p.access = 'pending' ORDER BY p.accepted_at ASC LIMIT 200`)
    .all<AccountRow>();
  return (result.results ?? []).map(toAccount);
}

/**
 * The accounts decided lately, newest first: the declined, and the approved that someone decided -- each approved one
 * with where its approval placed it (Phase 80, A11), read in one more query for the whole list.
 */
export async function listDecidedAccounts(db: D1Database): Promise<AccessAccount[]> {
  const result = await db
    .prepare(`${SELECT_ACCOUNT} WHERE p.access_decided_at IS NOT NULL ORDER BY p.access_decided_at DESC LIMIT 50`)
    .all<AccountRow>();
  const accounts = (result.results ?? []).map(toAccount);
  const placed = await placementsOf(
    db,
    accounts.filter((account) => account.access === 'approved').map((account) => account.user_id),
  );
  return accounts.map((account) => ({ ...account, placed_in: placed.get(account.user_id) ?? null }));
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

// ---------------------------------------------------------------------------
// Phase 80 (docs/members-plan.md A10-A15): approved into a space
// ---------------------------------------------------------------------------
// Under Post-approved a sign-up makes no space; approving may place the person in one. A console-made space takes
// them at once (an active membership, no acceptance step, their default); a self-started one is asked to let them in
// (a join request its admins answer). Either way they are offered a space of their own (`personal_offer`).

/**
 * How the platform log's approval line records a placement: its entity is the space, and its entity type says how --
 * joined at once ('organization') or a request filed ('join_request'). An approval with no place keeps the person as
 * its entity ('user'). `placementsOf` reads it back for the console's Decided list.
 */
export const PLACEMENT_ENTITY: Record<PlacementHow, 'organization' | 'join_request'> = {
  joined: 'organization',
  requested: 'join_request',
};

interface PlacementSpaceRow {
  id: string;
  name: string;
  short_name: string;
  created_via: string;
  feature_tutoring: number;
  feature_assessment: number;
  feature_quest: number;
  canvas_assessments: number;
  gamify_question_quest: number;
}

/**
 * The approve sheet's picker: every live space that is not someone's own, by name, with how it was made and what it
 * may use. Lean on purpose -- one read of the organizations table, none of the console list's per-space counts.
 */
export async function listPlacementSpaces(db: D1Database): Promise<PlacementSpace[]> {
  const result = await db
    .prepare(
      `SELECT id, name, short_name, created_via, feature_tutoring, feature_assessment, feature_quest,
              canvas_assessments, gamify_question_quest
         FROM organizations
        WHERE archived_at IS NULL AND personal = 0
        ORDER BY name COLLATE NOCASE`,
    )
    .all<PlacementSpaceRow>();
  return (result.results ?? []).map((row) => {
    const sets = {
      feature_tutoring: row.feature_tutoring === 1,
      feature_assessment: row.feature_assessment === 1,
      feature_quest: row.feature_quest === 1,
      canvas_assessments: row.canvas_assessments === 1,
      gamify_question_quest: row.gamify_question_quest === 1,
    };
    return {
      id: row.id,
      name: row.name,
      short_name: row.short_name,
      created_via: row.created_via === 'self_serve' ? 'self_serve' : 'console',
      quest_on: featureOn(sets, 'quest'),
      tutoring_on: featureOn(sets, 'tutoring'),
      assessment_on: featureOn(sets, 'assessment'),
    };
  });
}

/** The person's standing in one space, for a placement: their membership (live, removed or none) and an open request. */
export async function placementStanding(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<{ membership: 'live' | 'removed' | null; requested: boolean }> {
  const [member, request] = await db.batch<{ removed_at?: string | null; ok?: number }>([
    db.prepare('SELECT removed_at FROM org_members WHERE organization_id = ? AND user_id = ?').bind(org, userId),
    db
      .prepare('SELECT 1 AS ok FROM join_requests WHERE organization_id = ? AND user_id = ? AND outcome IS NULL LIMIT 1')
      .bind(org, userId),
  ]);
  const row = member?.results?.[0];
  return {
    membership: row ? (row.removed_at ? 'removed' : 'live') : null,
    requested: (request?.results ?? []).length > 0,
  };
}

/** The live personal spaces the person made and is still in: a space of their own. */
export async function ownPersonalSpaceIds(db: D1Database, userId: string): Promise<string[]> {
  const result = await db
    .prepare(
      // org-scope: a person's own memberships across spaces -- which of them is a personal space they made.
      `SELECT o.id FROM org_members m JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ?1 AND m.removed_at IS NULL
          AND o.personal = 1 AND o.archived_at IS NULL AND o.created_by_user_id = ?1`,
    )
    .bind(userId)
    .all<{ id: string }>();
  return (result.results ?? []).map((row) => row.id);
}

/**
 * Approves an account and places it, in one batch: the decision (and the offer of a space of their own), then either
 * the membership of a console-made space -- active at once, their default, Admin only if chosen -- or a join request
 * to a self-started one. The caller has checked the space, the role and the person's standing there.
 */
export async function approveAccount(
  db: D1Database,
  input: {
    userId: string;
    actorId: string;
    /** Offer them a space of their own (`personal_offer` 'open'): they have none. */
    offer: boolean;
    /** A console-made space: `existing` when they already belong (their roles kept; it only becomes their default). */
    join?: { org: OrgId; admin: boolean; existing: boolean };
    /** A self-started space: a request for its admins to answer. */
    request?: { org: OrgId };
  },
): Promise<void> {
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE platform_accounts
            SET access = 'approved', access_decided_at = ${NOW}, access_decided_by = ?,
                personal_offer = CASE WHEN ? = 1 THEN 'open' ELSE personal_offer END
          WHERE user_id = ?`,
      )
      .bind(input.actorId, input.offer ? 1 : 0, input.userId),
  ];
  if (input.join) {
    const { org, admin, existing } = input.join;
    statements.push(
      db
        .prepare(
          // org-scope: a person's default is one choice across all their spaces (setDefaultOrganization).
          'UPDATE org_members SET is_default = 0 WHERE user_id = ? AND is_default = 1',
        )
        .bind(input.userId),
    );
    if (existing) {
      statements.push(
        db
          .prepare('UPDATE org_members SET is_default = 1 WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL')
          .bind(org, input.userId),
      );
    } else {
      // Active at once: the platform vouches for them, as for a space's maker. Nobody in the space invited them.
      statements.push(
        db
          .prepare("INSERT INTO org_members (organization_id, user_id, status, is_default) VALUES (?, ?, 'active', 1)")
          .bind(org, input.userId),
      );
      if (admin) {
        statements.push(
          db.prepare("INSERT INTO user_roles (organization_id, user_id, role) VALUES (?, ?, 'admin')").bind(org, input.userId),
        );
      }
    }
  }
  if (input.request) statements.push(joinRequestStatement(db, input.request.org, input.userId, { role: null, note: null }));
  await db.batch(statements);
}

/**
 * Where each of these approved accounts' approval placed it: the newest `platform.access_approved` line about them
 * on the platform log, whose entity is the space it placed them in (`PLACEMENT_ENTITY`). One query for the whole
 * list, through `audit_events_subject_idx` (the platform's lines are `organization_id IS NULL`). An approval with no
 * place, or one from before Phase 80, places nobody: null.
 */
async function placementsOf(
  db: D1Database,
  userIds: string[],
): Promise<Map<string, { name: string; how: PlacementHow } | null>> {
  const placed = new Map<string, { name: string; how: PlacementHow } | null>();
  if (userIds.length === 0) return placed;
  // No ORDER BY: with one, SQLite walks every platform line newest first (audit_events_recent_idx) instead of
  // seeking each person's (organization_id, subject_user_id). The newest line per person is picked here.
  const result = await db
    .prepare(
      // org-scope: the platform's own log (organization_id IS NULL), joined to the space a line names.
      `SELECT a.subject_user_id AS user_id, a.entity_type, a.created_at, o.name
         FROM audit_events a
         LEFT JOIN organizations o
           ON a.entity_type IN ('organization', 'join_request') AND o.id = a.entity_id
        WHERE a.organization_id IS NULL AND a.action = 'platform.access_approved'
          AND a.subject_user_id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(userIds))
    .all<{ user_id: string; entity_type: string | null; created_at: string; name: string | null }>();
  const newest = new Map<string, { entity_type: string | null; created_at: string; name: string | null }>();
  for (const row of result.results ?? []) {
    const seen = newest.get(row.user_id);
    if (!seen || row.created_at > seen.created_at) newest.set(row.user_id, row);
  }
  for (const [userId, row] of newest) {
    const how: PlacementHow | null =
      row.entity_type === PLACEMENT_ENTITY.joined ? 'joined' : row.entity_type === PLACEMENT_ENTITY.requested ? 'requested' : null;
    placed.set(userId, how && row.name ? { name: row.name, how } : null);
  }
  return placed;
}

/**
 * Phase 80 (A12): whether the session offers the person a space of their own -- the offer is open and none of their
 * spaces is a personal one they made. One primary-key read (the subquery runs only while the offer is open).
 */
export async function personalSpaceOffered(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      // org-scope: a person's own memberships across spaces -- whether one is a personal space they made.
      `SELECT CASE WHEN a.personal_offer = 'open' THEN NOT EXISTS (
                SELECT 1 FROM org_members m JOIN organizations o ON o.id = m.organization_id
                 WHERE m.user_id = a.user_id AND m.removed_at IS NULL
                   AND o.personal = 1 AND o.archived_at IS NULL AND o.created_by_user_id = a.user_id)
              ELSE 0 END AS offered
         FROM platform_accounts a WHERE a.user_id = ?`,
    )
    .bind(userId)
    .first<{ offered: number }>();
  return row?.offered === 1;
}

/** The offer as it stands, with the age band a space of their own is made for; null without a platform account. */
export async function getPersonalOffer(
  db: D1Database,
  userId: string,
): Promise<{ age_band: AgeBand; personal_offer: 'open' | 'declined' | 'made' | null } | null> {
  return db
    .prepare('SELECT age_band, personal_offer FROM platform_accounts WHERE user_id = ?')
    .bind(userId)
    .first();
}

/**
 * Takes up the offer: a compare-and-set to 'made' from the value just read, never from 'made', and only while they
 * have no space of their own -- so a second "Make my space" (another tab, a double tap) finds nothing to claim. False
 * when nothing was claimed.
 */
export async function claimPersonalSpace(
  db: D1Database,
  userId: string,
  from: 'open' | 'declined' | null,
): Promise<boolean> {
  const result = await db
    .prepare(
      // org-scope: a person's own memberships across spaces -- whether one is a personal space they made.
      `UPDATE platform_accounts SET personal_offer = 'made'
        WHERE user_id = ?1 AND personal_offer IS ?2
          AND NOT EXISTS (
                SELECT 1 FROM org_members m JOIN organizations o ON o.id = m.organization_id
                 WHERE m.user_id = ?1 AND m.removed_at IS NULL
                   AND o.personal = 1 AND o.archived_at IS NULL AND o.created_by_user_id = ?1)`,
    )
    .bind(userId, from)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Puts the offer back as it was, when the space could not be made after all. */
export async function releasePersonalSpace(db: D1Database, userId: string, to: 'open' | 'declined' | null): Promise<void> {
  await db
    .prepare("UPDATE platform_accounts SET personal_offer = ? WHERE user_id = ? AND personal_offer = 'made'")
    .bind(to, userId)
    .run();
}

/** No thanks: the offer is put away (they may still make one from Spaces or Welcome). A preference: no log line. */
export async function declinePersonalSpace(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare("UPDATE platform_accounts SET personal_offer = 'declined' WHERE user_id = ? AND personal_offer = 'open'")
    .bind(userId)
    .run();
}

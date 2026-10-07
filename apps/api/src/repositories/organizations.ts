import {
  USER_ROLES,
  type CreateOrganizationPayload,
  type Invitation,
  type LogoContentType,
  type LogoKind,
  type Membership,
  type Organization,
  type OrganizationAdmin,
  type OrganizationBrand,
  type OrganizationListItem,
  type OrganizationSettings,
  type OrgPalette,
  type OrgTimeZone,
  type UpdateOrganizationPayload,
  type UpdateOrganizationSettingsPayload,
  type UserRole,
} from '@tmi/shared';
import { orgIdFromRow, type OrgContext, type OrgId } from '../lib/org.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

interface OrgRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  tagline: string | null;
  blurb: string | null;
  place: string | null;
  palette: string;
  builtin_logo: string | null;
  time_zone: string;
  email_notifications: number;
  calendar_domain: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  mark_sha: string | null;
  full_sha: string | null;
}

/** Every organization column, plus the logo versions that make its URLs. */
const SELECT_ORG = `SELECT o.id, o.slug, o.name, o.short_name, o.tagline, o.blurb, o.place,
       o.palette, o.builtin_logo, o.time_zone, o.email_notifications, o.calendar_domain, o.archived_at,
       o.created_at, o.updated_at,
       (SELECT sha256 FROM organization_logos l WHERE l.organization_id = o.id AND l.kind = 'mark') AS mark_sha,
       (SELECT sha256 FROM organization_logos l WHERE l.organization_id = o.id AND l.kind = 'full') AS full_sha
  FROM organizations o`;

function logoUrl(slug: string, kind: LogoKind, sha: string | null): string | null {
  return sha ? `/api/organizations/${slug}/logo/${kind}?v=${sha.slice(0, 16)}` : null;
}

function toBrand(row: OrgRow): OrganizationBrand {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_name: row.short_name,
    tagline: row.tagline,
    blurb: row.blurb,
    place: row.place,
    palette: row.palette as OrgPalette,
    builtin_logo: row.builtin_logo === 'institute' ? 'institute' : null,
    logo_mark_url: logoUrl(row.slug, 'mark', row.mark_sha),
    logo_full_url: logoUrl(row.slug, 'full', row.full_sha),
  };
}

function toOrganization(row: OrgRow): Organization {
  return {
    ...toBrand(row),
    time_zone: row.time_zone as OrgTimeZone,
    email_notifications: row.email_notifications === 1,
    calendar_domain: row.calendar_domain,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toOrgContext(org: Organization): OrgContext {
  return { ...org, id: orgIdFromRow(org.id) };
}

function parseRoles(csv: string | null): UserRole[] {
  if (!csv) return [];
  const found = new Set(csv.split(','));
  return USER_ROLES.filter((role) => found.has(role));
}

// ---------------------------------------------------------------------------
// Looking organizations up
// ---------------------------------------------------------------------------

/** The statement behind getOrganizationBySlug, for a batch. */
export function organizationBySlugStatement(db: D1Database, slug: string): D1PreparedStatement {
  return db.prepare(`${SELECT_ORG} WHERE o.slug = ?`).bind(slug.toLowerCase());
}

/** A row from organizationBySlugStatement, as an organization. */
export function organizationFromRow(row: unknown): Organization {
  return toOrganization(row as OrgRow);
}

export async function getOrganizationBySlug(
  db: D1Database,
  slug: string,
): Promise<Organization | null> {
  const row = await db.prepare(`${SELECT_ORG} WHERE o.slug = ?`).bind(slug.toLowerCase()).first<OrgRow>();
  return row ? toOrganization(row) : null;
}

export async function getOrganizationById(db: D1Database, id: string): Promise<Organization | null> {
  const row = await db.prepare(`${SELECT_ORG} WHERE o.id = ?`).bind(id).first<OrgRow>();
  return row ? toOrganization(row) : null;
}

/** The public face of a live organization, for the sign-in page. */
export async function getPublicBrand(db: D1Database, slug: string): Promise<OrganizationBrand | null> {
  const row = await db
    .prepare(`${SELECT_ORG} WHERE o.slug = ? AND o.archived_at IS NULL`)
    .bind(slug.toLowerCase())
    .first<OrgRow>();
  return row ? toBrand(row) : null;
}

/**
 * A person's standing in one organization, read on every request by
 * `requireOrg`: their membership and their roles there.
 */
export async function getMembership(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<{ status: 'active' | 'invited' | 'suspended'; removed: boolean; roles: UserRole[] } | null> {
  const row = await db
    .prepare(
      `SELECT m.status, m.removed_at,
              (SELECT GROUP_CONCAT(r.role) FROM user_roles r
               WHERE r.organization_id = m.organization_id AND r.user_id = m.user_id) AS roles_csv
       FROM org_members m
       WHERE m.organization_id = ? AND m.user_id = ?`,
    )
    .bind(org, userId)
    .first<{ status: 'active' | 'invited' | 'suspended'; removed_at: string | null; roles_csv: string | null }>();
  if (!row) return null;
  return { status: row.status, removed: row.removed_at !== null, roles: parseRoles(row.roles_csv) };
}

/** Every live organization the person may enter (active, or suspended so they can be told). */
export async function listMemberships(db: D1Database, userId: string): Promise<Membership[]> {
  const result = await db
    .prepare(
      `${SELECT_ORG.replace(
        'FROM organizations o',
        `, m.status AS member_status, m.is_default AS member_is_default,
           (SELECT GROUP_CONCAT(r.role) FROM user_roles r
            WHERE r.organization_id = o.id AND r.user_id = m.user_id) AS roles_csv
         FROM organizations o JOIN org_members m ON m.organization_id = o.id`,
      )}
       WHERE m.user_id = ? AND m.removed_at IS NULL AND m.status IN ('active', 'suspended')
         AND o.archived_at IS NULL
       ORDER BY o.name COLLATE NOCASE`,
    )
    .bind(userId)
    .all<OrgRow & {
      member_status: 'active' | 'suspended';
      member_is_default: number;
      roles_csv: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    ...toBrand(row),
    roles: parseRoles(row.roles_csv),
    status: row.member_status,
    is_default: row.member_is_default === 1,
  }));
}

/**
 * Makes `org` the organization the person lands in on signing in, or clears
 * the choice (`null`). One batch, so there is never a moment with two -- the
 * partial unique index would refuse one anyway. The caller has checked the
 * person may enter `org`.
 */
export async function setDefaultOrganization(
  db: D1Database,
  userId: string,
  org: OrgId | null,
): Promise<void> {
  const clear = db
    .prepare(
      // org-scope: a person's default is one choice across all their organizations.
      'UPDATE org_members SET is_default = 0 WHERE user_id = ? AND is_default = 1',
    )
    .bind(userId);
  if (!org) {
    await clear.run();
    return;
  }
  await db.batch([
    clear,
    db
      .prepare('UPDATE org_members SET is_default = 1 WHERE organization_id = ? AND user_id = ?')
      .bind(org, userId),
  ]);
}

/** Organizations waiting for the person's answer. */
export async function listInvitations(db: D1Database, userId: string): Promise<Invitation[]> {
  const result = await db
    .prepare(
      `${SELECT_ORG.replace(
        'FROM organizations o',
        `, m.created_at AS invited_at,
           (SELECT GROUP_CONCAT(r.role) FROM user_roles r
            WHERE r.organization_id = o.id AND r.user_id = m.user_id) AS roles_csv
         FROM organizations o JOIN org_members m ON m.organization_id = o.id`,
      )}
       WHERE m.user_id = ? AND m.removed_at IS NULL AND m.status = 'invited'
         AND o.archived_at IS NULL
       ORDER BY m.created_at DESC`,
    )
    .bind(userId)
    .all<OrgRow & { invited_at: string; roles_csv: string | null }>();

  return (result.results ?? []).map((row) => ({
    ...toBrand(row),
    roles: parseRoles(row.roles_csv),
    invited_at: row.invited_at,
  }));
}

/** Accepts or declines an invitation. Returns false when there was none. */
export async function answerInvitation(
  db: D1Database,
  org: OrgId,
  userId: string,
  accept: boolean,
): Promise<boolean> {
  const result = await db
    .prepare(
      accept
        ? `UPDATE org_members SET status = 'active', updated_at = ${NOW}
           WHERE organization_id = ? AND user_id = ? AND status = 'invited' AND removed_at IS NULL`
        : `UPDATE org_members SET removed_at = ${NOW}, updated_at = ${NOW}
           WHERE organization_id = ? AND user_id = ? AND status = 'invited' AND removed_at IS NULL`,
    )
    .bind(org, userId)
    .run();
  return Boolean(result.meta.changes);
}

/**
 * Notes that the person entered the organization. Returns true when this is
 * the first entry since `sinceIso` (their sign-in), so the caller logs it once.
 */
export async function recordEntry(
  db: D1Database,
  org: OrgId,
  userId: string,
  sinceIso: string | null,
): Promise<{ firstEver: boolean; firstSinceSignIn: boolean }> {
  const before = await db
    .prepare('SELECT first_entered_at, last_entered_at FROM org_members WHERE organization_id = ? AND user_id = ?')
    .bind(org, userId)
    .first<{ first_entered_at: string | null; last_entered_at: string | null }>();

  await db
    .prepare(
      `UPDATE org_members
       SET first_entered_at = COALESCE(first_entered_at, ${NOW}), last_entered_at = ${NOW}
       WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(org, userId)
    .run();

  const last = before?.last_entered_at ?? null;
  return {
    firstEver: !before?.first_entered_at,
    firstSinceSignIn: last === null || (sinceIso !== null && last < sinceIso),
  };
}

// ---------------------------------------------------------------------------
// Organization settings (its own admins)
// ---------------------------------------------------------------------------

export async function getOrganizationSettings(
  db: D1Database,
  org: OrgId,
): Promise<OrganizationSettings> {
  const row = await db
    .prepare(
      `SELECT tin, payer_address_line1, payer_address_line2, payer_city, payer_state, payer_postal_code,
              email_notifications
       FROM organizations WHERE id = ?`,
    )
    .bind(org)
    .first<Omit<OrganizationSettings, 'email_notifications'> & { email_notifications: number }>();
  if (!row) {
    return {
      tin: null,
      payer_address_line1: null,
      payer_address_line2: null,
      payer_city: null,
      payer_state: null,
      payer_postal_code: null,
      email_notifications: false,
    };
  }
  return { ...row, email_notifications: row.email_notifications === 1 };
}

export async function updateOrganizationSettings(
  db: D1Database,
  org: OrgId,
  input: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    // Keys come from a Zod object, never from the request directly.
    sets.push(`${key} = ?`);
    // SQLite has no boolean: the one flag is stored 0/1.
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null));
  }
  if (sets.length > 0) {
    sets.push(`updated_at = ${NOW}`);
    await db.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`).bind(...values, org).run();
  }
  return getOrganizationSettings(db, org);
}

// ---------------------------------------------------------------------------
// The platform console
// ---------------------------------------------------------------------------

export async function listOrganizations(db: D1Database): Promise<OrganizationListItem[]> {
  const result = await db
    .prepare(
      `${SELECT_ORG.replace(
        'FROM organizations o',
        `, (SELECT COUNT(*) FROM user_roles r JOIN org_members m
              ON m.organization_id = r.organization_id AND m.user_id = r.user_id
            WHERE r.organization_id = o.id AND r.role = 'admin' AND m.removed_at IS NULL) AS admin_count,
           (SELECT COUNT(*) FROM org_members m
            WHERE m.organization_id = o.id AND m.removed_at IS NULL) AS member_count
         FROM organizations o`,
      )}
       ORDER BY o.archived_at IS NOT NULL, o.name COLLATE NOCASE`,
    )
    .all<OrgRow & { admin_count: number; member_count: number }>();

  return (result.results ?? []).map((row) => ({
    ...toOrganization(row),
    admin_count: Number(row.admin_count ?? 0),
    member_count: Number(row.member_count ?? 0),
  }));
}

export async function createOrganization(
  db: D1Database,
  input: CreateOrganizationPayload,
  calendarDomain: string,
): Promise<Organization> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO organizations
         (id, slug, name, short_name, tagline, blurb, place, palette, builtin_logo, time_zone,
          email_notifications, calendar_domain)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.slug,
      input.name,
      input.short_name,
      input.tagline,
      input.blurb,
      input.place,
      input.palette,
      input.builtin_logo,
      input.time_zone,
      input.email_notifications ? 1 : 0,
      calendarDomain,
    )
    .run();
  const org = await getOrganizationById(db, id);
  if (!org) throw new Error('Insert into organizations returned no row.');
  return org;
}

export async function updateOrganization(
  db: D1Database,
  id: string,
  input: UpdateOrganizationPayload,
): Promise<Organization | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    sets.push(`${key} = ?`);
    // SQLite has no boolean: the one flag is stored 0/1.
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null));
  }
  if (sets.length > 0) {
    sets.push(`updated_at = ${NOW}`);
    await db.prepare(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
  }
  return getOrganizationById(db, id);
}

export async function setOrganizationArchived(
  db: D1Database,
  id: string,
  archived: boolean,
): Promise<Organization | null> {
  await db
    .prepare(
      `UPDATE organizations SET archived_at = ${archived ? NOW : 'NULL'}, updated_at = ${NOW}
       WHERE id = ?`,
    )
    .bind(id)
    .run();
  return getOrganizationById(db, id);
}

export async function putLogo(
  db: D1Database,
  orgId: string,
  kind: LogoKind,
  contentType: LogoContentType,
  bytes: ArrayBuffer,
  sha256: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO organization_logos (organization_id, kind, content_type, bytes, sha256, updated_at)
       VALUES (?, ?, ?, ?, ?, ${NOW})
       ON CONFLICT (organization_id, kind) DO UPDATE SET
         content_type = excluded.content_type, bytes = excluded.bytes,
         sha256 = excluded.sha256, updated_at = excluded.updated_at`,
    )
    .bind(orgId, kind, contentType, bytes, sha256)
    .run();
}

export async function deleteLogo(db: D1Database, orgId: string, kind: LogoKind): Promise<void> {
  await db
    .prepare('DELETE FROM organization_logos WHERE organization_id = ? AND kind = ?')
    .bind(orgId, kind)
    .run();
}

export async function getLogo(
  db: D1Database,
  slug: string,
  kind: LogoKind,
): Promise<{ content_type: string; bytes: ArrayBuffer; sha256: string } | null> {
  const row = await db
    .prepare(
      `SELECT l.content_type, l.bytes, l.sha256
       FROM organization_logos l JOIN organizations o ON o.id = l.organization_id
       WHERE o.slug = ? AND l.kind = ?`,
    )
    .bind(slug.toLowerCase(), kind)
    .first<{ content_type: string; bytes: ArrayBuffer | number[]; sha256: string }>();
  if (!row) return null;
  const bytes = Array.isArray(row.bytes) ? new Uint8Array(row.bytes).buffer : row.bytes;
  return { content_type: row.content_type, bytes, sha256: row.sha256 };
}

export async function listOrganizationAdmins(
  db: D1Database,
  orgId: string,
): Promise<OrganizationAdmin[]> {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, u.email, m.status
       FROM user_roles r
       JOIN org_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
       JOIN users u ON u.id = r.user_id
       WHERE r.organization_id = ? AND r.role = 'admin'
         AND m.removed_at IS NULL AND u.deleted_at IS NULL
       ORDER BY u.full_name COLLATE NOCASE`,
    )
    .bind(orgId)
    .all<OrganizationAdmin>();
  return result.results ?? [];
}

/**
 * Makes a person a member of an organization with these roles, creating the
 * membership as an invitation when there is none. A removed membership is
 * revived as an invitation. Returns the membership's status afterwards.
 */
export async function ensureMembershipWithRoles(
  db: D1Database,
  orgId: string,
  userId: string,
  roles: UserRole[],
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO org_members (organization_id, user_id, status) VALUES (?, ?, 'invited')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET
           status = CASE WHEN org_members.removed_at IS NOT NULL THEN 'invited' ELSE org_members.status END,
           removed_at = NULL, updated_at = ${NOW}`,
      )
      .bind(orgId, userId),
    ...roles.map((role) =>
      db
        .prepare(
          `INSERT INTO user_roles (organization_id, user_id, role) VALUES (?, ?, ?)
           ON CONFLICT DO NOTHING`,
        )
        .bind(orgId, userId, role),
    ),
  ]);
}

export async function removeRole(
  db: D1Database,
  orgId: string,
  userId: string,
  role: UserRole,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM user_roles WHERE organization_id = ? AND user_id = ? AND role = ?')
    .bind(orgId, userId, role)
    .run();
  return Boolean(result.meta.changes);
}

/** The platform's audit view: what the platform itself did, and nothing an organization wrote. */
export async function listPlatformAudit(db: D1Database, limit: number) {
  const result = await db
    .prepare(
      `SELECT a.id, a.organization_id, o.name AS organization_name, a.actor_name, a.subject_name,
              a.action, a.description, a.created_at
       FROM audit_events a LEFT JOIN organizations o ON o.id = a.organization_id
       WHERE a.action LIKE 'organization.%' OR a.action LIKE 'platform_admin.%'
          OR a.action LIKE 'person.%'
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

/** The first live organization, for the sign-in-off bypass. */
export async function getFirstOrganization(db: D1Database): Promise<Organization | null> {
  const row = await db
    .prepare(`${SELECT_ORG} WHERE o.archived_at IS NULL ORDER BY o.created_at, o.id LIMIT 1`)
    .first<OrgRow>();
  return row ? toOrganization(row) : null;
}

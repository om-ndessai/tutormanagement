import {
  DEFAULT_CURRICULUM_ID,
  SPACE_CODE_ALPHABET,
  SPACE_CODE_LENGTH,
  spaceSlugFor,
  type JoinRequest,
  type MyJoinRequest,
  USER_ROLES,
  type Business,
  type BusinessListItem,
  type CreateBusinessPayload,
  type UpdateBusinessPayload,
  type SpacePayer,
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
  canvas_assessments: number;
  canvas_assessments_unreviewed: number;
  gamify_question_quest: number;
  canvas_assessment_questions: number;
  feature_tutoring: number;
  feature_assessment: number;
  feature_quest: number;
  created_via: string;
  quest_trusted: number;
  calendar_domain: string;
  business_id: string | null;
  business_name: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  mark_sha: string | null;
  full_sha: string | null;
}

/** Every organization column, plus the logo versions that make its URLs. */
const SELECT_ORG = `SELECT o.id, o.slug, o.name, o.short_name, o.tagline, o.blurb, o.place,
       o.palette, o.builtin_logo, o.time_zone, o.email_notifications, o.canvas_assessments, o.canvas_assessments_unreviewed, o.canvas_assessment_questions, o.gamify_question_quest, o.feature_tutoring, o.feature_assessment, o.feature_quest, o.created_via, o.quest_trusted, o.calendar_domain, o.archived_at,
       o.created_at, o.updated_at, o.business_id,
       (SELECT b.name FROM businesses b WHERE b.id = o.business_id) AS business_name,
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
    canvas_assessments: row.canvas_assessments === 1,
    canvas_assessments_unreviewed: row.canvas_assessments_unreviewed === 1,
    gamify_question_quest: row.gamify_question_quest === 1,
    canvas_assessment_questions: row.canvas_assessment_questions,
    feature_tutoring: row.feature_tutoring === 1,
    feature_assessment: row.feature_assessment === 1,
    feature_quest: row.feature_quest === 1,
    created_via: row.created_via === 'self_serve' ? 'self_serve' : 'console',
    quest_trusted: row.quest_trusted === 1,
    business: row.business_id ? { id: row.business_id, name: row.business_name ?? '' } : null,
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
): Promise<{ status: 'active' | 'invited' | 'suspended'; removed: boolean; roles: UserRole[]; is_default: boolean } | null> {
  const row = await db
    .prepare(
      `SELECT m.status, m.removed_at, m.is_default,
              (SELECT GROUP_CONCAT(r.role) FROM user_roles r
               WHERE r.organization_id = m.organization_id AND r.user_id = m.user_id) AS roles_csv
       FROM org_members m
       WHERE m.organization_id = ? AND m.user_id = ?`,
    )
    .bind(org, userId)
    .first<{ status: 'active' | 'invited' | 'suspended'; removed_at: string | null; is_default: number; roles_csv: string | null }>();
  if (!row) return null;
  return {
    status: row.status,
    removed: row.removed_at !== null,
    roles: parseRoles(row.roles_csv),
    is_default: row.is_default === 1,
  };
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
 * Makes `org` the organization the person lands in on signing in -- since Phase 60 the last
 * one they opened (`POST /api/auth/enter`) -- or clears the choice (`null`). One batch, so there is never a moment with two -- the
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

/** Phase 60: a space the person has left is no longer their last choice. */
export async function forgetLastChoice(db: D1Database, org: OrgId, userId: string): Promise<void> {
  await db
    .prepare('UPDATE org_members SET is_default = 0 WHERE organization_id = ? AND user_id = ? AND is_default = 1')
    .bind(org, userId)
    .run();
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

/**
 * Accepts or declines an invitation. Returns null when there was none; otherwise the name the
 * inviting organization typed (`invited_name`, null when it typed none) -- which is all it may
 * know of them until they accept, so a decline is logged under it (S6, R21).
 */
export async function answerInvitation(
  db: D1Database,
  org: OrgId,
  userId: string,
  accept: boolean,
): Promise<{ invited_name: string | null } | null> {
  const before = await db
    .prepare(
      `SELECT invited_name FROM org_members
       WHERE organization_id = ? AND user_id = ? AND status = 'invited' AND removed_at IS NULL`,
    )
    .bind(org, userId)
    .first<{ invited_name: string | null }>();
  if (!before) return null;
  const result = await db
    .prepare(
      accept
        ? `UPDATE org_members SET status = 'active', invited_name = NULL, updated_at = ${NOW}
           WHERE organization_id = ? AND user_id = ? AND status = 'invited' AND removed_at IS NULL`
        : `UPDATE org_members SET removed_at = ${NOW}, updated_at = ${NOW}
           WHERE organization_id = ? AND user_id = ? AND status = 'invited' AND removed_at IS NULL`,
    )
    .bind(org, userId)
    .run();
  return result.meta.changes ? { invited_name: before.invited_name } : null;
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
  // Phase 54: the payer is the space's organization (its business); a space paid
  // directly has none, and every payer field reads null.
  const row = await db
    .prepare(
      `SELECT o.business_id, b.name AS business_name,
              b.tin, b.payer_address_line1, b.payer_address_line2, b.payer_city, b.payer_state, b.payer_postal_code,
              o.email_notifications, o.canvas_assessments, o.canvas_assessments_unreviewed, o.canvas_assessment_questions,
              o.gamify_question_quest
       FROM organizations o LEFT JOIN businesses b ON b.id = o.business_id
       WHERE o.id = ?`,
    )
    .bind(org)
    .first<{
      business_id: string | null;
      business_name: string | null;
      tin: string | null;
      payer_address_line1: string | null;
      payer_address_line2: string | null;
      payer_city: string | null;
      payer_state: string | null;
      payer_postal_code: string | null;
      email_notifications: number;
      canvas_assessments: number;
      canvas_assessments_unreviewed: number;
      canvas_assessment_questions: number;
      gamify_question_quest: number;
    }>();
  if (!row) {
    return {
      business: null,
      tin: null,
      payer_address_line1: null,
      payer_address_line2: null,
      payer_city: null,
      payer_state: null,
      payer_postal_code: null,
      email_notifications: false,
      canvas_assessments: false,
      canvas_assessments_unreviewed: false,
      canvas_assessment_questions: 10,
      gamify_question_quest: false,
    };
  }
  const { business_id, business_name, ...rest } = row;
  return {
    ...rest,
    business: business_id ? { id: business_id, name: business_name ?? '' } : null,
    email_notifications: row.email_notifications === 1,
    canvas_assessments: row.canvas_assessments === 1,
    canvas_assessments_unreviewed: row.canvas_assessments_unreviewed === 1,
    gamify_question_quest: row.gamify_question_quest === 1,
  };
}

/** The payer fields, which since Phase 54 live on the space's business. */
export const PAYER_FIELDS = [
  'tin',
  'payer_address_line1',
  'payer_address_line2',
  'payer_city',
  'payer_state',
  'payer_postal_code',
] as const;

export async function updateOrganizationSettings(
  db: D1Database,
  org: OrgId,
  input: UpdateOrganizationSettingsPayload,
): Promise<OrganizationSettings> {
  const orgSets: string[] = [];
  const orgValues: unknown[] = [];
  const bizSets: string[] = [];
  const bizValues: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    // Keys come from a Zod object, never from the request directly.
    const payer = (PAYER_FIELDS as readonly string[]).includes(key);
    (payer ? bizSets : orgSets).push(`${key} = ?`);
    // SQLite has no boolean: the flags are stored 0/1.
    (payer ? bizValues : orgValues).push(typeof value === 'boolean' ? (value ? 1 : 0) : (value ?? null));
  }
  const statements: D1PreparedStatement[] = [];
  if (orgSets.length > 0) {
    orgSets.push(`updated_at = ${NOW}`);
    statements.push(
      db.prepare(`UPDATE organizations SET ${orgSets.join(', ')} WHERE id = ?`).bind(...orgValues, org),
    );
  }
  if (bizSets.length > 0) {
    // The caller has checked the space has a business; the subquery finds it.
    bizSets.push(`updated_at = ${NOW}`);
    statements.push(
      db
        .prepare(
          `UPDATE businesses SET ${bizSets.join(', ')}
           WHERE id = (SELECT business_id FROM organizations WHERE id = ?)`,
        )
        .bind(...bizValues, org),
    );
  }
  if (statements.length > 0) await db.batch(statements);
  return getOrganizationSettings(db, org);
}

// ---------------------------------------------------------------------------
// Businesses: organizations in the money sense (Phase 54, the console)
// ---------------------------------------------------------------------------

const SELECT_BUSINESS = `SELECT b.id, b.name, b.tin, b.payer_address_line1, b.payer_address_line2, b.payer_city,
       b.payer_state, b.payer_postal_code, b.archived_at, b.created_at, b.updated_at
  FROM businesses b`;

export async function listBusinesses(db: D1Database): Promise<BusinessListItem[]> {
  const [businesses, spaces] = await db.batch<Record<string, unknown>>([
    db.prepare(`${SELECT_BUSINESS} ORDER BY b.archived_at IS NOT NULL, b.name COLLATE NOCASE`),
    db.prepare(
      // org-scope: the console lists which spaces each business runs, across organizations.
      `SELECT o.id, o.slug, o.name, o.business_id FROM organizations o
       WHERE o.business_id IS NOT NULL ORDER BY o.name COLLATE NOCASE`,
    ),
  ]);
  const bySpace = new Map<string, BusinessListItem['spaces']>();
  for (const row of (spaces?.results ?? []) as Record<string, unknown>[]) {
    const key = String(row.business_id);
    const list = bySpace.get(key) ?? [];
    list.push({ id: String(row.id), slug: String(row.slug), name: String(row.name) });
    bySpace.set(key, list);
  }
  return ((businesses?.results ?? []) as unknown as Business[]).map((b) => ({
    ...b,
    spaces: bySpace.get(b.id) ?? [],
  }));
}

export async function getBusiness(db: D1Database, id: string): Promise<Business | null> {
  return (await db.prepare(`${SELECT_BUSINESS} WHERE b.id = ?`).bind(id).first<Business>()) ?? null;
}

export async function createBusiness(db: D1Database, input: CreateBusinessPayload): Promise<Business> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO businesses (id, name, tin, payer_address_line1, payer_address_line2, payer_city, payer_state, payer_postal_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.tin ?? null,
      input.payer_address_line1 ?? null,
      input.payer_address_line2 ?? null,
      input.payer_city ?? null,
      input.payer_state ?? null,
      input.payer_postal_code ?? null,
    )
    .run();
  const created = await getBusiness(db, id);
  if (!created) throw new Error('Insert into businesses returned no row.');
  return created;
}

export async function updateBusiness(
  db: D1Database,
  id: string,
  input: UpdateBusinessPayload | { archived_at: string | null },
): Promise<Business | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value ?? null);
  }
  if (sets.length > 0) {
    sets.push(`updated_at = ${NOW}`);
    const result = await db.prepare(`UPDATE businesses SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
    if (!result.meta.changes) return null;
  }
  return getBusiness(db, id);
}

/** Phase 54: the business that collects a space's payments from now on, or null (paid directly). */
export async function setSpaceBusiness(db: D1Database, orgId: string, businessId: string | null): Promise<void> {
  await db
    .prepare(`UPDATE organizations SET business_id = ?, updated_at = ${NOW} WHERE id = ?`)
    .bind(businessId, orgId)
    .run();
}

/** The spaces a business is the payer of: one, or none (decision 5: never two). */
export async function spacesOfBusiness(db: D1Database, businessId: string): Promise<string[]> {
  const result = await db
    // org-scope: whether a payer record is any other space's, which is what makes it shared.
    .prepare('SELECT o.id FROM organizations o WHERE o.business_id = ?')
    .bind(businessId)
    .all<{ id: string }>();
  return (result.results ?? []).map((row) => row.id);
}

/**
 * The spaces other than `spaceId` a payer record belongs to: any space linked to it now, and the
 * space it is keyed by (its own record, decision 5), even while that space is paid directly and
 * the record sits unlinked. Linking a record this returns anything for would share it.
 */
export async function otherSpacesOfPayer(db: D1Database, businessId: string, spaceId: string | null): Promise<string[]> {
  const result = await db
    // org-scope: whether a payer record is any other space's, linked or keyed by its id.
    .prepare('SELECT o.id FROM organizations o WHERE (o.business_id = ?1 OR o.id = ?1) AND o.id IS NOT ?2')
    .bind(businessId, spaceId)
    .all<{ id: string }>();
  return (result.results ?? []).map((row) => row.id);
}

/**
 * Phase 59: "The space" collects payments -- link the space's OWN payer record, keyed by its id:
 * made (named after the space) if missing, restored if archived.
 */
export async function linkOwnPayer(db: D1Database, org: Organization): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO businesses (id, name) VALUES (?, ?)
         ON CONFLICT (id) DO UPDATE SET archived_at = NULL, updated_at = ${NOW}`,
      )
      .bind(org.id, org.name),
    db.prepare(`UPDATE organizations SET business_id = ?, updated_at = ${NOW} WHERE id = ?`).bind(org.id, org.id),
  ]);
}

/**
 * Phase 59: the console's PATCH of a space's payer details, written to the business it points at.
 * The caller has checked there is one, and that it is this space's alone.
 */
export async function updateSpacePayer(
  db: D1Database,
  orgId: string,
  input: Partial<Record<'payer_name' | 'tin' | 'payer_address_line1' | 'payer_address_line2' | 'payer_city' | 'payer_state' | 'payer_postal_code', string | null>>,
  spaceName: string,
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    // Keys come from a Zod object; the name on the 1099 is the business's own `name`, never empty.
    sets.push(`${key === 'payer_name' ? 'name' : key} = ?`);
    values.push(key === 'payer_name' ? (value ?? spaceName) : (value ?? null));
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = ${NOW}`);
  await db
    .prepare(
      `UPDATE businesses SET ${sets.join(', ')}
       WHERE id = (SELECT business_id FROM organizations WHERE id = ?)`,
    )
    .bind(...values, orgId)
    .run();
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
            WHERE m.organization_id = o.id AND m.removed_at IS NULL) AS member_count,
           pb.name AS payer_name, pb.tin AS payer_tin, pb.payer_address_line1 AS payer_line1,
           pb.payer_address_line2 AS payer_line2, pb.payer_city AS payer_city_, pb.payer_state AS payer_state_,
           pb.payer_postal_code AS payer_postal_code_
         FROM organizations o LEFT JOIN businesses pb ON pb.id = o.business_id`,
      )}
       ORDER BY o.archived_at IS NOT NULL, o.name COLLATE NOCASE`,
    )
    .all<OrgRow & { admin_count: number; member_count: number } & PayerColumns>();

  return (result.results ?? []).map((row) => ({
    ...toOrganization(row),
    admin_count: Number(row.admin_count ?? 0),
    member_count: Number(row.member_count ?? 0),
    payer: toPayer(row),
  }));
}

/** The payer columns the console's list reads, aliased apart from the organization's own. */
interface PayerColumns {
  business_id: string | null;
  payer_name: string | null;
  payer_tin: string | null;
  payer_line1: string | null;
  payer_line2: string | null;
  payer_city_: string | null;
  payer_state_: string | null;
  payer_postal_code_: string | null;
}

function toPayer(row: PayerColumns): SpacePayer | null {
  if (!row.business_id) return null;
  return {
    name: row.payer_name ?? '',
    tin: row.payer_tin,
    payer_address_line1: row.payer_line1,
    payer_address_line2: row.payer_line2,
    payer_city: row.payer_city_,
    payer_state: row.payer_state_,
    payer_postal_code: row.payer_postal_code_,
  };
}

export async function createOrganization(
  db: D1Database,
  input: CreateOrganizationPayload,
  calendarDomain: string,
): Promise<Organization> {
  const id = crypto.randomUUID();
  // Phase 59: a space that collects its payments is its own payer: a business row with the
  // space's id, made in the same batch, before the space that points at it.
  const ownPayer = input.payment_model === 'space';
  const businessId = ownPayer ? id : input.payment_model === 'direct' ? null : (input.business_id ?? null);
  // Phase 61 (S10): every space made from now on starts with its admins' Assessment and Quest
  // switches on, so each set is on wherever it is allowed (`featureOn`). Existing spaces keep
  // theirs; nothing is restated.
  // One batch: an organization never exists without its default curriculum,
  // which every catalog read goes through (Phase 34). This is the only path
  // that creates one -- the console and the sign-in-off fallback both use it.
  await db.batch([
    ...(ownPayer
      ? [
          db
            .prepare(
              `INSERT INTO businesses (id, name, tin, payer_address_line1, payer_address_line2, payer_city, payer_state, payer_postal_code)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              id,
              input.payer_name ?? input.name,
              input.tin ?? null,
              input.payer_address_line1 ?? null,
              input.payer_address_line2 ?? null,
              input.payer_city ?? null,
              input.payer_state ?? null,
              input.payer_postal_code ?? null,
            ),
        ]
      : []),
    db
      .prepare(
        `INSERT INTO organizations
           (id, slug, name, short_name, tagline, blurb, place, palette, builtin_logo, time_zone,
            email_notifications, calendar_domain, feature_tutoring, feature_assessment, feature_quest,
            canvas_assessments, gamify_question_quest, business_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
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
        input.feature_tutoring ? 1 : 0,
        input.feature_assessment ? 1 : 0,
        input.feature_quest ? 1 : 0,
        businessId,
      ),
    db
      .prepare(
        `INSERT INTO organization_curricula (organization_id, curriculum_id, is_default)
         VALUES (?, ?, 1)`,
      )
      .bind(id, DEFAULT_CURRICULUM_ID),
  ]);
  const org = await getOrganizationById(db, id);
  if (!org) throw new Error('Creating the space returned no row.');
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
          OR a.action LIKE 'person.%' OR a.action LIKE 'ai.%'
          OR a.action LIKE 'question.%' OR a.action LIKE 'question_bank.%'
          -- Phase 54: an organization's own line; its copies in the spaces it runs are theirs.
          OR (a.action LIKE 'business.%' AND a.organization_id IS NULL)
          -- Phase 55: a person's ways to sign in.
          OR a.action LIKE 'identity.%'
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

/** Phase 50: which feature sets an organization is allowed. A platform admin's act; null when it does not exist. */
export async function updateOrganizationFeatures(
  db: D1Database,
  id: string,
  input: { feature_tutoring: boolean; feature_assessment: boolean; feature_quest: boolean; quest_trusted?: boolean },
): Promise<Organization | null> {
  await db
    .prepare(
      `UPDATE organizations SET feature_tutoring = ?, feature_assessment = ?, feature_quest = ?,
              quest_trusted = COALESCE(?, quest_trusted),
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
    .bind(
      input.feature_tutoring ? 1 : 0,
      input.feature_assessment ? 1 : 0,
      input.feature_quest ? 1 : 0,
      input.quest_trusted === undefined ? null : input.quest_trusted ? 1 : 0,
      id,
    )
    .run();
  return getOrganizationById(db, id);
}

// ---------------------------------------------------------------------------
// Phase 52: spaces -- their codes, requests to join, and making one
// ---------------------------------------------------------------------------

/** A fresh space code from SPACE_CODE_ALPHABET, by rejection sampling (no bias). */
export function newSpaceCode(): string {
  const out: string[] = [];
  const bytes = new Uint8Array(32);
  while (out.length < SPACE_CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 240 && out.length < SPACE_CODE_LENGTH) out.push(SPACE_CODE_ALPHABET[b % 30]!);
    }
  }
  return out.join('');
}

/** The space a code opens, while joining by code is on and it is not archived; null otherwise. */
export async function findSpaceByCode(db: D1Database, code: string): Promise<Organization | null> {
  const row = await db
    .prepare(`${SELECT_ORG} WHERE o.join_code = ? AND o.join_by_code = 1 AND o.archived_at IS NULL`)
    .bind(code)
    .first<OrgRow>();
  return row ? toOrganization(row) : null;
}

/** The space's code and switch, for its admins. */
export async function getSpaceCode(db: D1Database, org: OrgId): Promise<{ code: string | null; join_by_code: boolean }> {
  const row = await db
    .prepare('SELECT join_code, join_by_code FROM organizations WHERE id = ?')
    .bind(org)
    .first<{ join_code: string | null; join_by_code: number }>();
  return { code: row?.join_code ?? null, join_by_code: row?.join_by_code === 1 };
}

/** Gives the space a new code (the old one stops working at once). Retries a clash. */
export async function renewSpaceCode(db: D1Database, org: OrgId): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newSpaceCode();
    try {
      await db
        .prepare(`UPDATE organizations SET join_code = ?, updated_at = ${NOW} WHERE id = ?`)
        .bind(code, org)
        .run();
      return code;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error('No space code could be made.');
}

export async function setJoinByCode(db: D1Database, org: OrgId, on: boolean): Promise<void> {
  await db
    .prepare(`UPDATE organizations SET join_by_code = ?, updated_at = ${NOW} WHERE id = ?`)
    .bind(on ? 1 : 0, org)
    .run();
}

/** The person's standing in a space: a member (any status but removed), an open request, or nothing. */
export async function spaceStanding(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<'member' | 'requested' | null> {
  const [member, request] = await db.batch<{ ok: number }>([
    db.prepare('SELECT 1 AS ok FROM org_members WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL').bind(org, userId),
    db
      .prepare('SELECT 1 AS ok FROM join_requests WHERE organization_id = ? AND user_id = ? AND outcome IS NULL')
      .bind(org, userId),
  ]);
  if ((member?.results ?? []).length > 0) return 'member';
  if ((request?.results ?? []).length > 0) return 'requested';
  return null;
}

/** How many open requests the person has, anywhere (their daily cap). */
export async function countOpenRequests(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      // org-scope: a person's own requests across spaces, a count only.
      'SELECT COUNT(*) AS n FROM join_requests WHERE user_id = ? AND outcome IS NULL',
    )
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createJoinRequest(db: D1Database, org: OrgId, userId: string): Promise<void> {
  await db.prepare('INSERT INTO join_requests (organization_id, user_id) VALUES (?, ?)').bind(org, userId).run();
}

/**
 * The person's own requests: open ones, and declined ones not yet seen -- never an archived space's,
 * which can be neither entered nor answered (S4, S5), as listMemberships and listInvitations hide them.
 */
export async function listMyJoinRequests(db: D1Database, userId: string): Promise<MyJoinRequest[]> {
  const result = await db
    .prepare(
      // org-scope: the person's own requests across spaces, with each space's public face.
      `${SELECT_ORG.replace('FROM organizations o', ', j.requested_at, j.outcome FROM organizations o JOIN join_requests j ON j.organization_id = o.id')}
       WHERE j.user_id = ? AND o.archived_at IS NULL
         AND (j.outcome IS NULL OR (j.outcome = 'declined' AND j.seen_at IS NULL))
       ORDER BY j.requested_at DESC`,
    )
    .bind(userId)
    .all<OrgRow & { requested_at: string; outcome: string | null }>();
  return (result.results ?? []).map((row) => {
    const brand = toBrand(row);
    return {
      slug: brand.slug,
      name: brand.name,
      short_name: brand.short_name,
      palette: brand.palette,
      logo_mark_url: brand.logo_mark_url,
      requested_at: row.requested_at,
      outcome: row.outcome === 'declined' ? 'declined' : null,
    };
  });
}

/** Marks the person's declined requests as seen (they were shown once). */
export async function markDeclinesSeen(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      // org-scope: the person's own requests across spaces.
      `UPDATE join_requests SET seen_at = ${NOW} WHERE user_id = ? AND outcome = 'declined' AND seen_at IS NULL`,
    )
    .bind(userId)
    .run();
}

/** Closes the person's open request to this space. False when there was none. */
export async function answerJoinRequest(
  db: D1Database,
  org: OrgId,
  userId: string,
  outcome: 'approved' | 'declined' | 'withdrawn',
  answeredBy: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE join_requests SET outcome = ?, answered_by = ?, answered_at = ${NOW}
       WHERE organization_id = ? AND user_id = ? AND outcome IS NULL`,
    )
    .bind(outcome, answeredBy, org, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** A space's open requests, oldest first, with who Google says each person is. */
export async function listJoinRequests(db: D1Database, org: OrgId): Promise<JoinRequest[]> {
  const result = await db
    .prepare(
      `SELECT j.user_id, u.full_name, u.email, j.requested_at
       FROM join_requests j JOIN users u ON u.id = j.user_id AND u.deleted_at IS NULL
       WHERE j.organization_id = ? AND j.outcome IS NULL
       ORDER BY j.requested_at`,
    )
    .bind(org)
    .all<JoinRequest>();
  return result.results ?? [];
}

/** Whether this person has an open request here, and the address it was made with. */
export async function openJoinRequest(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<{ email: string | null; full_name: string } | null> {
  return db
    .prepare(
      `SELECT u.email, u.full_name FROM join_requests j JOIN users u ON u.id = j.user_id
       WHERE j.organization_id = ? AND j.user_id = ? AND j.outcome IS NULL`,
    )
    .bind(org, userId)
    .first();
}

/** How many self-serve spaces the person made (their lifetime cap counts the live ones). */
export async function countSpacesMadeBy(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM organizations WHERE created_by_user_id = ? AND archived_at IS NULL')
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** The names of the organizations the platform made: a space may not take one. */
export async function consoleOrganizationNames(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare("SELECT name FROM organizations WHERE created_via = 'console'")
    .all<{ name: string }>();
  return (result.results ?? []).map((row) => row.name);
}

/**
 * Makes a self-serve space in one batch: the organization (Phase 61, S10: Assessment and Quest
 * allowed and switched on, approved questions only; no Tutoring; untrusted for Quest; no email),
 * its default curriculum, its code with joining on, and its maker as its active admin.
 */
export async function createSpace(
  db: D1Database,
  input: { name: string; timeZone: string; makerId: string; requestHost: string },
): Promise<Organization> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = crypto.randomUUID();
    const code = newSpaceCode();
    const slug = spaceSlugFor(code);
    const shortName = input.name.length > 40 ? `${input.name.slice(0, 39)}…` : input.name;
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO organizations
               (id, slug, name, short_name, palette, time_zone, email_notifications, calendar_domain,
                canvas_assessments, canvas_assessments_unreviewed, gamify_question_quest,
                feature_tutoring, feature_assessment, feature_quest,
                created_via, quest_trusted, join_code, join_by_code, created_by_user_id)
             VALUES (?, ?, ?, ?, 'platform', ?, 0, ?, 1, 0, 1, 0, 1, 1, 'self_serve', 0, ?, 1, ?)`,
          )
          .bind(id, slug, input.name, shortName, input.timeZone, `${slug}.${input.requestHost}`, code, input.makerId),
        db
          .prepare('INSERT INTO organization_curricula (organization_id, curriculum_id, is_default) VALUES (?, ?, 1)')
          .bind(id, DEFAULT_CURRICULUM_ID),
        db
          .prepare(
            `INSERT INTO org_members (organization_id, user_id, status, first_entered_at, last_entered_at)
             VALUES (?, ?, 'active', ${NOW}, ${NOW})`,
          )
          .bind(id, input.makerId),
        db.prepare("INSERT INTO user_roles (organization_id, user_id, role) VALUES (?, ?, 'admin')").bind(id, input.makerId),
      ]);
      const org = await getOrganizationById(db, id);
      if (!org) throw new Error('Creating the space returned no row.');
      return org;
    } catch (error) {
      // A clash of code or slug (one in a few hundred billion) tries again; anything else is real.
      if (attempt === 4 || !String(error).includes('UNIQUE')) throw error;
    }
  }
  throw new Error('No space could be made.');
}

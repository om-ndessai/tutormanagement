import {
  USER_ROLES,
  type AvailabilitySlot,
  type CreateUserPayload,
  type GuardianLink,
  type TutorTaxStatus,
  type ListUsersParams,
  type PaymentHandle,
  type StudentProfile,
  type TutorProfile,
  type UpdateUserPayload,
  type UpdateUserSectionsPayload,
  type User,
  type UserDetail,
  type UserRole,
  type UserSortField,
} from '@tmi/shared';
import type { OrgId } from '../lib/org.js';

/**
 * A person AS A MEMBER OF ONE ORGANIZATION. Every function here takes the
 * organization, and every read goes through the membership:
 *
 *   status        - the membership's (suspending in one organization leaves
 *                   the others alone)
 *   roles         - held in this organization only (ROLES_CSV)
 *   created_at    - when they joined this organization
 *   last_login_at - when they last ENTERED this organization; their global
 *                   sign-in time is nobody's business here
 *   deleted_at    - when they were removed from this organization
 *
 * `google_sub` is never exposed.
 */
const COLUMNS = [
  'u.id',
  'u.email',
  'u.full_name',
  'u.phone',
  'm.status',
  'm.created_at',
  'u.updated_at',
  'm.last_entered_at AS last_login_at',
  'm.removed_at AS deleted_at',
].join(', ');

/**
 * Folds the person's roles IN THIS ORGANIZATION into one column. This is the
 * hinge of the whole design: every admin check reads `user.roles`, so filtering
 * them here is what makes an admin of one organization nobody special in
 * another.
 */
const ROLES_CSV = `(SELECT GROUP_CONCAT(r.role) FROM user_roles r
   WHERE r.organization_id = m.organization_id AND r.user_id = u.id) AS roles_csv`;

/** Always followed by a WHERE that starts with `m.organization_id = ?`. */
const SELECT_USER = `SELECT ${COLUMNS}, ${ROLES_CSV}
  FROM org_members m JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL`;

/** SQLite has no date type, so the app writes ISO-8601 UTC strings. */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SORT_SQL: Record<UserSortField, string> = {
  full_name: 'u.full_name COLLATE NOCASE',
  email: 'u.email COLLATE NOCASE',
  status: 'm.status',
  created_at: 'm.created_at',
};

interface UserRow {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
  roles_csv: string | null;
}

/** Stable display order regardless of how GROUP_CONCAT happened to order them. */
function parseRoles(csv: string | null): UserRole[] {
  if (!csv) return [];

  const found = new Set(csv.split(','));
  return USER_ROLES.filter((role) => found.has(role));
}

function toUser(row: UserRow): User {
  const { roles_csv, ...rest } = row;
  return { ...rest, roles: parseRoles(roles_csv) } as User;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListUsersResult {
  users: User[];
  total: number;
}

export async function listUsers(
  db: D1Database,
  org: OrgId,
  params: ListUsersParams,
  /**
   * Ids this viewer may see, or null for an admin. Applied here rather than in
   * the route so that no caller can forget it.
   */
  visibleIds?: Set<string> | null,
): Promise<ListUsersResult> {
  const where: string[] = ['m.organization_id = ?'];
  const values: unknown[] = [org];

  if (visibleIds) {
    if (visibleIds.size === 0) return { users: [], total: 0 };
    where.push(`u.id IN (${[...visibleIds].map(() => '?').join(', ')})`);
    values.push(...visibleIds);
  }

  if (!params.include_deleted) where.push('m.removed_at IS NULL');

  if (params.search) {
    const term = `%${params.search.toLowerCase()}%`;
    where.push('(lower(u.full_name) LIKE ? OR lower(u.email) LIKE ?)');
    values.push(term, term);
  }

  // "Holds this role", not "is exactly this role" -- users have several.
  if (params.role) {
    where.push(
      'EXISTS (SELECT 1 FROM user_roles r WHERE r.organization_id = m.organization_id AND r.user_id = u.id AND r.role = ?)',
    );
    values.push(params.role);
  }

  if (params.status) {
    where.push('m.status = ?');
    values.push(params.status);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  // `sort` and `order` come from Zod enums, so they are safe to interpolate.
  const orderSql = `ORDER BY ${SORT_SQL[params.sort]} ${params.order === 'desc' ? 'DESC' : 'ASC'}, u.id ASC`;

  const [countResult, pageResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(*) AS total FROM org_members m
         JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL ${whereSql}`,
      )
      .bind(...values),
    db
      .prepare(`${SELECT_USER} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .bind(...values, params.limit, params.offset),
  ]);

  return {
    total: Number((countResult?.results?.[0] as { total?: number } | undefined)?.total ?? 0),
    users: ((pageResult?.results ?? []) as unknown as UserRow[]).map(toUser),
  };
}

/** A member of this organization, removed ones included. */
export async function getUserById(db: D1Database, org: OrgId, id: string): Promise<User | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE m.organization_id = ? AND u.id = ?`)
    .bind(org, id)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

/** A current member of this organization. Anyone else -- elsewhere, or nowhere -- is null. */
export async function getLiveUserById(
  db: D1Database,
  org: OrgId,
  id: string,
): Promise<User | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE m.organization_id = ? AND u.id = ? AND m.removed_at IS NULL`)
    .bind(org, id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** A current member of this organization with this address. */
export async function getLiveUserByEmail(
  db: D1Database,
  org: OrgId,
  email: string,
): Promise<User | null> {
  if (!email.trim()) return null;

  const row = await db
    .prepare(
      `${SELECT_USER} WHERE m.organization_id = ? AND lower(u.email) = ? AND m.removed_at IS NULL`,
    )
    .bind(org, email.trim().toLowerCase())
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Whether this person belongs to any OTHER organization; their shared fields are then locked. */
export async function belongsElsewhere(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS ok FROM org_members WHERE user_id = ? AND organization_id <> ? LIMIT 1')
    .bind(id, org)
    .first<{ ok: number }>();
  return row?.ok === 1;
}

/**
 * The whole graph for one person: their row, their role-specific profiles, and
 * everything that hangs off them. Issued as one batch, so it costs a single
 * round trip to D1.
 */
export async function getUserDetail(
  db: D1Database,
  org: OrgId,
  id: string,
): Promise<UserDetail | null> {
  const [
    userRes,
    elsewhereRes,
    tutorRes,
    studentRes,
    payRes,
    availRes,
    guardiansRes,
    dependentsRes,
  ] =
    await db.batch<Record<string, unknown>>([
      db.prepare(`${SELECT_USER} WHERE m.organization_id = ? AND u.id = ?`).bind(org, id),
      db
        .prepare('SELECT COUNT(*) AS total FROM org_members WHERE user_id = ? AND organization_id <> ?')
        .bind(id, org),
      db
        .prepare(
          `SELECT highest_education, school, area,
                  address_line1, address_line2, city, state, postal_code,
                  availability_notes, virtual_available,
                  default_rate_in_person_cents, default_rate_virtual_cents,
                  max_session_minutes, topup_amount_cents, ssn_received_on
           FROM tutor_profiles WHERE organization_id = ? AND user_id = ?`,
        )
        .bind(org, id),
      db
        .prepare(
          `SELECT school, current_math_course, academic_year_goal, virtual_available,
                  charge_rate_in_person_cents, charge_rate_virtual_cents,
                  max_session_minutes
           FROM student_profiles WHERE organization_id = ? AND user_id = ?`,
        )
        .bind(org, id),
      db
        .prepare(
          `SELECT method, handle FROM payment_handles
           WHERE organization_id = ? AND user_id = ? ORDER BY method`,
        )
        .bind(org, id),
      db
        .prepare(
          `SELECT day_of_week, hour FROM availability_slots
           WHERE organization_id = ? AND user_id = ? ORDER BY day_of_week, hour`,
        )
        .bind(org, id),
      // People responsible for this user.
      db
        .prepare(
          `SELECT g.guardian_user_id AS user_id, p.full_name, p.email, g.relationship, g.is_primary
           FROM guardianships g JOIN users p ON p.id = g.guardian_user_id
           WHERE g.organization_id = ? AND g.dependent_user_id = ?
           ORDER BY g.is_primary DESC, p.full_name`,
        )
        .bind(org, id),
      // People this user is responsible for.
      db
        .prepare(
          `SELECT g.dependent_user_id AS user_id, c.full_name, c.email, g.relationship, g.is_primary
           FROM guardianships g JOIN users c ON c.id = g.dependent_user_id
           WHERE g.organization_id = ? AND g.guardian_user_id = ?
           ORDER BY c.full_name`,
        )
        .bind(org, id),
    ]);

  const userRow = userRes?.results?.[0] as UserRow | undefined;
  if (!userRow) return null;

  const elsewhere = Number(
    (elsewhereRes?.results?.[0] as { total?: number } | undefined)?.total ?? 0,
  );
  const rawTutor = tutorRes?.results?.[0] as Record<string, unknown> | undefined;
  const rawStudent = studentRes?.results?.[0] as Record<string, unknown> | undefined;

  const toGuardianLinks = (rows: unknown[]): GuardianLink[] =>
    (rows as Record<string, unknown>[]).map((row) => ({
      user_id: String(row.user_id),
      full_name: String(row.full_name),
      // Not String(): a child with no address would become the text "null".
      email: (row.email as string | null) ?? null,
      relationship: row.relationship as GuardianLink['relationship'],
      is_primary: row.is_primary === 1,
    }));

  const member = toUser(userRow);
  return {
    ...member,
    shared_fields_locked: elsewhere > 0,
    last_entered_at: member.last_login_at,
    tutor_profile: rawTutor
      ? ({
          highest_education: (rawTutor.highest_education as string | null) ?? null,
          school: (rawTutor.school as string | null) ?? null,
          area: (rawTutor.area as string | null) ?? null,
          address_line1: (rawTutor.address_line1 as string | null) ?? null,
          address_line2: (rawTutor.address_line2 as string | null) ?? null,
          city: (rawTutor.city as string | null) ?? null,
          state: (rawTutor.state as string | null) ?? null,
          postal_code: (rawTutor.postal_code as string | null) ?? null,
          availability_notes: (rawTutor.availability_notes as string | null) ?? null,
          virtual_available: rawTutor.virtual_available === 1,
          default_rate_in_person_cents:
            (rawTutor.default_rate_in_person_cents as number | null) ?? null,
          default_rate_virtual_cents:
            (rawTutor.default_rate_virtual_cents as number | null) ?? null,
          max_session_minutes: (rawTutor.max_session_minutes as number | null) ?? null,
          topup_amount_cents: (rawTutor.topup_amount_cents as number | null) ?? null,
          ssn_received_on: (rawTutor.ssn_received_on as string | null) ?? null,
        } satisfies TutorProfile)
      : null,
    student_profile: rawStudent
      ? ({
          school: (rawStudent.school as string | null) ?? null,
          current_math_course: (rawStudent.current_math_course as string | null) ?? null,
          academic_year_goal: (rawStudent.academic_year_goal as string | null) ?? null,
          virtual_available: rawStudent.virtual_available === 1,
          charge_rate_in_person_cents:
            (rawStudent.charge_rate_in_person_cents as number | null) ?? null,
          charge_rate_virtual_cents:
            (rawStudent.charge_rate_virtual_cents as number | null) ?? null,
          max_session_minutes: (rawStudent.max_session_minutes as number | null) ?? null,
        } satisfies StudentProfile)
      : null,
    payment_handles: (payRes?.results ?? []) as unknown as PaymentHandle[],
    availability: (availRes?.results ?? []) as unknown as AvailabilitySlot[],
    guardians: toGuardianLinks(guardiansRes?.results ?? []),
    dependents: toGuardianLinks(dependentsRes?.results ?? []),
  };
}

/**
 * How many guardians a student has IN THIS ORGANIZATION. Backs the rule "a
 * student has at least one guardian who is a member here".
 */
export async function countGuardians(
  db: D1Database,
  org: OrgId,
  dependentId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM guardianships g
       JOIN org_members m ON m.organization_id = g.organization_id AND m.user_id = g.guardian_user_id
       WHERE g.organization_id = ? AND g.dependent_user_id = ? AND m.removed_at IS NULL`,
    )
    .bind(org, dependentId)
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

/**
 * The ids that are NOT current members of this organization. Every person a
 * write names goes through here, so somebody from another organization
 * answers exactly as somebody who does not exist.
 */
export async function findMissingUserIds(
  db: D1Database,
  org: OrgId,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const unique = [...new Set(ids)];
  const placeholders = unique.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `SELECT m.user_id AS id FROM org_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = ? AND m.user_id IN (${placeholders})
         AND m.removed_at IS NULL AND u.deleted_at IS NULL`,
    )
    .bind(org, ...unique)
    .all<{ id: string }>();

  const found = new Set((result.results ?? []).map((row) => row.id));
  return ids.filter((id) => !found.has(id));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function roleStatements(db: D1Database, org: OrgId, userId: string, roles: UserRole[]) {
  return roles.map((role) =>
    db
      .prepare('INSERT INTO user_roles (organization_id, user_id, role) VALUES (?, ?, ?)')
      .bind(org, userId, role),
  );
}

/**
 * A profile row may exist only while its role is held -- in this
 * organization -- so dropping a role drops the profile with it.
 */
function profileCleanupStatements(db: D1Database, org: OrgId, userId: string, roles: UserRole[]) {
  const statements = [];

  if (!roles.includes('tutor')) {
    statements.push(
      db
        .prepare('DELETE FROM tutor_profiles WHERE organization_id = ? AND user_id = ?')
        .bind(org, userId),
    );
  }
  if (!roles.includes('student')) {
    statements.push(
      db
        .prepare('DELETE FROM student_profiles WHERE organization_id = ? AND user_id = ?')
        .bind(org, userId),
    );
  }

  return statements;
}

/** What creating a user turned out to be. */
export type CreateUserOutcome =
  /** A brand-new person, invited until they first sign in (or active, if so asked). */
  | { kind: 'created'; user: User }
  /**
   * Someone with an account already: they are invited to this organization
   * and accept when they next sign in. Answered exactly like `created`, so an
   * admin cannot use it to learn whether an address has an account.
   */
  | { kind: 'invited'; user: User }
  /** Already a member here (or once was): the address is taken. */
  | { kind: 'already_member' };

export async function createUser(
  db: D1Database,
  org: OrgId,
  input: CreateUserPayload,
): Promise<CreateUserOutcome> {
  if (input.email) {
    const existing = await db
      .prepare('SELECT id FROM users WHERE lower(email) = ? AND deleted_at IS NULL')
      .bind(input.email.toLowerCase())
      .first<{ id: string }>();

    if (existing) {
      const membership = await db
        .prepare('SELECT 1 AS ok FROM org_members WHERE organization_id = ? AND user_id = ?')
        .bind(org, existing.id)
        .first<{ ok: number }>();
      if (membership) return { kind: 'already_member' };

      // Their shared fields are theirs: the name and phone typed here do not
      // overwrite what they already have.
      await db.batch([
        db
          .prepare(
            "INSERT INTO org_members (organization_id, user_id, status) VALUES (?, ?, 'invited')",
          )
          .bind(org, existing.id),
        ...roleStatements(db, org, existing.id, input.roles),
      ]);

      const user = await getUserById(db, org, existing.id);
      if (!user) throw new Error('Membership insert returned no row.');
      return { kind: 'invited', user };
    }
  }

  const id = crypto.randomUUID();

  // Batched, so a failure part-way leaves no member without roles.
  await db.batch([
    db
      .prepare('INSERT INTO users (id, email, full_name, phone) VALUES (?, ?, ?, ?)')
      .bind(id, input.email, input.full_name, input.phone),
    db
      .prepare('INSERT INTO org_members (organization_id, user_id, status) VALUES (?, ?, ?)')
      .bind(org, id, input.status),
    ...roleStatements(db, org, id, input.roles),
  ]);

  const user = await getUserById(db, org, id);
  if (!user) throw new Error('Insert into users returned no row.');

  return { kind: 'created', user };
}

/**
 * Returns null when this organization has no current member with that id.
 *
 * Shared fields (name, email, phone) are written only when the caller has
 * already decided they may be -- see the users route: a person who belongs to
 * another organization too is changed by a platform admin, not from here.
 */
export async function updateUser(
  db: D1Database,
  org: OrgId,
  id: string,
  input: UpdateUserPayload,
): Promise<User | null> {
  const existing = await getLiveUserById(db, org, id);
  if (!existing) return null;

  const personSets: string[] = [];
  const personValues: unknown[] = [];

  for (const field of ['email', 'full_name', 'phone'] as const) {
    if (field in input) {
      personSets.push(`${field} = ?`);
      personValues.push(input[field]);
    }
  }

  // Always bump updated_at, even for a roles-only change: the person's record
  // did change. Setting it inline also stops the trigger doing a second write.
  personSets.push(`updated_at = ${NOW}`);

  const statements = [
    db
      .prepare(`UPDATE users SET ${personSets.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
      .bind(...personValues, id),
  ];

  if (input.status) {
    statements.push(
      db
        .prepare(
          `UPDATE org_members SET status = ?, updated_at = ${NOW}
           WHERE organization_id = ? AND user_id = ?`,
        )
        .bind(input.status, org, id),
    );
  }

  // Supplying `roles` replaces the whole set -- in this organization.
  if (input.roles) {
    statements.push(
      db.prepare('DELETE FROM user_roles WHERE organization_id = ? AND user_id = ?').bind(org, id),
      ...roleStatements(db, org, id, input.roles),
      ...profileCleanupStatements(db, org, id, input.roles),
    );
  }

  await db.batch(statements);
  return getUserById(db, org, id);
}

/**
 * A student's goal is ONE fact, held in two places: the profile carries it
 * before any plan exists, and the active learning plan carries it after. The
 * two are kept equal on every write, in the same batch, so neither screen can
 * show a goal the other does not.
 *
 * From the profile side: a goal typed in the user dialog becomes the active
 * plan's goal. A plan cannot be without one, so clearing it in the dialog
 * puts the plan's goal back rather than leaving the two apart.
 * The plan side is in the progress repository (planGoalSyncStatement).
 */
function goalSyncFromProfile(db: D1Database, org: OrgId, studentId: string, goal: string | null) {
  return goal === null
    ? [
        db
          .prepare(
            `UPDATE student_profiles
             SET academic_year_goal = (SELECT goal FROM learning_plans
                                       WHERE organization_id = ? AND student_user_id = ?
                                         AND status = 'active')
             WHERE organization_id = ? AND user_id = ?
               AND EXISTS (SELECT 1 FROM learning_plans
                           WHERE organization_id = ? AND student_user_id = ? AND status = 'active')`,
          )
          .bind(org, studentId, org, studentId, org, studentId),
      ]
    : [
        db
          .prepare(
            `UPDATE learning_plans
             SET goal = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE organization_id = ? AND student_user_id = ? AND status = 'active' AND goal <> ?`,
          )
          .bind(goal, org, studentId, goal),
      ];
}

/**
 * Replaces whole sections rather than diffing them, which keeps "set my
 * availability" one idempotent call. An omitted key leaves that section alone.
 * Every section is this organization's own.
 */
export async function updateUserSections(
  db: D1Database,
  org: OrgId,
  id: string,
  sections: UpdateUserSectionsPayload,
): Promise<void> {
  const statements = [];

  if (sections.tutor_profile !== undefined) {
    statements.push(
      db
        .prepare('DELETE FROM tutor_profiles WHERE organization_id = ? AND user_id = ?')
        .bind(org, id),
    );

    if (sections.tutor_profile !== null) {
      const p = sections.tutor_profile;
      statements.push(
        db
          .prepare(
            `INSERT INTO tutor_profiles
               (organization_id, user_id, highest_education, school, area,
                address_line1, address_line2, city, state, postal_code,
                availability_notes, virtual_available,
                default_rate_in_person_cents, default_rate_virtual_cents, max_session_minutes,
                topup_amount_cents, ssn_received_on)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            org,
            id,
            p.highest_education,
            p.school,
            p.area,
            p.address_line1,
            p.address_line2,
            p.city,
            p.state,
            p.postal_code,
            p.availability_notes,
            p.virtual_available ? 1 : 0,
            p.default_rate_in_person_cents,
            p.default_rate_virtual_cents,
            p.max_session_minutes,
            p.topup_amount_cents,
            p.ssn_received_on,
          ),
      );
    }
  }

  if (sections.student_profile !== undefined) {
    statements.push(
      db
        .prepare('DELETE FROM student_profiles WHERE organization_id = ? AND user_id = ?')
        .bind(org, id),
    );

    if (sections.student_profile !== null) {
      const p = sections.student_profile;
      statements.push(
        db
          .prepare(
            `INSERT INTO student_profiles
               (organization_id, user_id, school, current_math_course, academic_year_goal,
                virtual_available, charge_rate_in_person_cents, charge_rate_virtual_cents,
                max_session_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            org,
            id,
            p.school,
            p.current_math_course,
            p.academic_year_goal,
            p.virtual_available ? 1 : 0,
            p.charge_rate_in_person_cents,
            p.charge_rate_virtual_cents,
            p.max_session_minutes,
          ),
        ...goalSyncFromProfile(db, org, id, p.academic_year_goal),
      );
    }
  }

  if (sections.payment_handles) {
    statements.push(
      db
        .prepare('DELETE FROM payment_handles WHERE organization_id = ? AND user_id = ?')
        .bind(org, id),
    );
    for (const handle of sections.payment_handles) {
      statements.push(
        db
          .prepare(
            'INSERT INTO payment_handles (organization_id, user_id, method, handle) VALUES (?, ?, ?, ?)',
          )
          .bind(org, id, handle.method, handle.handle),
      );
    }
  }

  if (sections.availability) {
    statements.push(
      db
        .prepare('DELETE FROM availability_slots WHERE organization_id = ? AND user_id = ?')
        .bind(org, id),
    );
    for (const slot of sections.availability) {
      statements.push(
        db
          .prepare(
            `INSERT INTO availability_slots (organization_id, user_id, day_of_week, hour)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(org, id, slot.day_of_week, slot.hour),
      );
    }
  }

  if (sections.guardians) {
    statements.push(
      db
        .prepare('DELETE FROM guardianships WHERE organization_id = ? AND dependent_user_id = ?')
        .bind(org, id),
    );
    for (const link of sections.guardians) {
      statements.push(
        db
          .prepare(
            `INSERT INTO guardianships
               (organization_id, guardian_user_id, dependent_user_id, relationship, is_primary)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(org, link.guardian_user_id, id, link.relationship, link.is_primary ? 1 : 0),
      );
    }
  }

  if (statements.length > 0) {
    // One batch, so a half-applied section is impossible.
    statements.push(
      db
        .prepare(
          `UPDATE org_members SET updated_at = ${NOW} WHERE organization_id = ? AND user_id = ?`,
        )
        .bind(org, id),
    );
    await db.batch(statements);
  }
}

/** Removes someone from THIS organization. Null if they are not a current member. */
export async function deactivateUser(db: D1Database, org: OrgId, id: string): Promise<User | null> {
  const result = await db
    .prepare(
      `UPDATE org_members SET removed_at = ${NOW}, updated_at = ${NOW}
       WHERE organization_id = ? AND user_id = ? AND removed_at IS NULL`,
    )
    .bind(org, id)
    .run();

  if (!result.meta.changes) return null;
  return getUserById(db, org, id);
}

/** Null if they were never removed from this organization. */
export async function restoreUser(db: D1Database, org: OrgId, id: string): Promise<User | null> {
  const result = await db
    .prepare(
      `UPDATE org_members SET removed_at = NULL, updated_at = ${NOW}
       WHERE organization_id = ? AND user_id = ? AND removed_at IS NOT NULL`,
    )
    .bind(org, id)
    .run();

  if (!result.meta.changes) return null;
  return getUserById(db, org, id);
}

/**
 * Erases everything THIS organization holds about a person, then the
 * membership. Explicit deletes by organization -- never a cascade from
 * `users`, which would reach every organization they belong to. The person
 * themselves is erased only when no membership remains anywhere.
 */
export async function purgeUser(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const member = await db
    .prepare('SELECT 1 AS ok FROM org_members WHERE organization_id = ? AND user_id = ?')
    .bind(org, id)
    .first<{ ok: number }>();
  if (!member) return false;

  const byPerson = (sql: string, binds: number) =>
    db.prepare(sql).bind(org, ...Array<string>(binds).fill(id));

  await db.batch([
    byPerson(
      'DELETE FROM comments WHERE organization_id = ? AND (author_user_id = ? OR target_user_id = ?)',
      2,
    ),
    byPerson(
      'DELETE FROM session_drafts WHERE organization_id = ? AND (tutor_user_id = ? OR student_user_id = ? OR author_user_id = ?)',
      3,
    ),
    byPerson(
      'DELETE FROM active_sessions WHERE organization_id = ? AND (tutor_user_id = ? OR student_user_id = ?)',
      2,
    ),
    byPerson(
      'DELETE FROM sessions WHERE organization_id = ? AND (tutor_user_id = ? OR student_user_id = ?)',
      2,
    ),
    byPerson(
      'DELETE FROM scheduled_sessions WHERE organization_id = ? AND (tutor_user_id = ? OR student_user_id = ?)',
      2,
    ),
    byPerson(
      'DELETE FROM assignments WHERE organization_id = ? AND (tutor_user_id = ? OR student_user_id = ?)',
      2,
    ),
    byPerson(
      'DELETE FROM payments WHERE organization_id = ? AND (party_user_id = ? OR student_user_id = ?)',
      2,
    ),
    byPerson('DELETE FROM learning_plans WHERE organization_id = ? AND student_user_id = ?', 1),
    byPerson('DELETE FROM assessments WHERE organization_id = ? AND student_user_id = ?', 1),
    // Roles, profiles, handles, availability and guardianships cascade from the membership.
    byPerson('DELETE FROM org_members WHERE organization_id = ? AND user_id = ?', 1),
    db
      .prepare(
        // org-scope: erases the PERSON only once no organization has them.
        `DELETE FROM users WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = ?)
           AND NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = ?)`,
      )
      .bind(id, id, id),
  ]);
  return true;
}

// ---------------------------------------------------------------------------
// Sign-in-off support
// ---------------------------------------------------------------------------

/**
 * The first admin of any organization, with that organization -- the
 * AUTH_ENABLED=false bypass runs as them when nobody is named.
 */
export async function getFirstAdminMembership(
  db: D1Database,
): Promise<{ user_id: string; organization_id: string } | null> {
  const row = await db
    .prepare(
      `SELECT r.user_id, r.organization_id
       FROM user_roles r
       JOIN org_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
       JOIN organizations o ON o.id = r.organization_id
       JOIN users u ON u.id = r.user_id
       WHERE r.role = 'admin' AND m.removed_at IS NULL AND m.status <> 'suspended'
         AND o.archived_at IS NULL AND u.deleted_at IS NULL
       ORDER BY o.created_at, u.created_at, u.id
       LIMIT 1`,
    )
    .first<{ user_id: string; organization_id: string }>();
  return row ?? null;
}

/**
 * The hourly prices this organization charges for one student, or null if
 * they have no student profile here.
 */
export async function getStudentChargeRates(
  db: D1Database,
  org: OrgId,
  studentUserId: string,
): Promise<{
  charge_rate_in_person_cents: number | null;
  charge_rate_virtual_cents: number | null;
} | null> {
  const row = await db
    .prepare(
      `SELECT charge_rate_in_person_cents, charge_rate_virtual_cents
       FROM student_profiles WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(org, studentUserId)
    .first<{
      charge_rate_in_person_cents: number | null;
      charge_rate_virtual_cents: number | null;
    }>();

  return row ?? null;
}

/**
 * Records, or withdraws, this organization's confirmation that it holds a
 * tutor's SSN. The number is not a parameter here and has nowhere to go if it
 * were.
 */
export async function setSsnReceived(
  db: D1Database,
  org: OrgId,
  userId: string,
  received: boolean,
): Promise<string | null> {
  await db
    .prepare(
      `UPDATE tutor_profiles
       SET ssn_received_on = ${received ? "date('now')" : 'NULL'},
           updated_at = ${NOW}
       WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(org, userId)
    .run();

  return getSsnReceivedOn(db, org, userId);
}

/**
 * Every tutor's tax-document readiness in this organization, with what it paid
 * them in the given calendar year.
 */
export async function listTutorTaxStatus(
  db: D1Database,
  org: OrgId,
  year: number,
): Promise<TutorTaxStatus[]> {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, tp.ssn_received_on,
              tp.address_line1, tp.address_line2, tp.city, tp.state, tp.postal_code,
              COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                        WHERE p.organization_id = m.organization_id
                          AND p.party_user_id = u.id
                          AND p.direction = 'to_tutor'
                          AND p.paid_at >= ? AND p.paid_at < ?), 0) AS paid_this_year_cents
       FROM org_members m
       JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
       JOIN user_roles r ON r.organization_id = m.organization_id AND r.user_id = u.id
                        AND r.role = 'tutor'
       LEFT JOIN tutor_profiles tp ON tp.organization_id = m.organization_id AND tp.user_id = u.id
       WHERE m.organization_id = ? AND m.removed_at IS NULL
       ORDER BY u.full_name`,
    )
    .bind(`${year}-01-01`, `${year + 1}-01-01`, org)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    user_id: String(row.user_id),
    full_name: String(row.full_name),
    ssn_received_on: (row.ssn_received_on as string | null) ?? null,
    paid_this_year_cents: Number(row.paid_this_year_cents ?? 0),
    address: {
      address_line1: (row.address_line1 as string | null) ?? null,
      address_line2: (row.address_line2 as string | null) ?? null,
      city: (row.city as string | null) ?? null,
      state: (row.state as string | null) ?? null,
      postal_code: (row.postal_code as string | null) ?? null,
    },
  }));
}

/** Tutors this organization cannot file a tax document for yet. */
export async function listTutorsMissingSsn(
  db: D1Database,
  org: OrgId,
): Promise<{ user_id: string; full_name: string }[]> {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name
       FROM org_members m
       JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
       JOIN user_roles r ON r.organization_id = m.organization_id AND r.user_id = u.id
                        AND r.role = 'tutor'
       LEFT JOIN tutor_profiles tp ON tp.organization_id = m.organization_id AND tp.user_id = u.id
       WHERE m.organization_id = ? AND m.removed_at IS NULL AND m.status <> 'suspended'
         AND tp.ssn_received_on IS NULL
       ORDER BY u.full_name`,
    )
    .bind(org)
    .all<{ user_id: string; full_name: string }>();

  return result.results ?? [];
}

/** One tutor's own tax-document readiness in this organization. */
export async function getSsnReceivedOn(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      'SELECT ssn_received_on FROM tutor_profiles WHERE organization_id = ? AND user_id = ?',
    )
    .bind(org, userId)
    .first<{ ssn_received_on: string | null }>();

  return row?.ssn_received_on ?? null;
}

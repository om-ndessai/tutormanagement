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

/**
 * Columns of `users` itself. Roles live in their own table and are folded in
 * by ROLES_CSV below; `google_sub` is never exposed.
 */
const COLUMNS = [
  'u.id',
  'u.email',
  'u.full_name',
  'u.phone',
  'u.status',
  'u.created_at',
  'u.updated_at',
  'u.last_login_at',
  'u.deleted_at',
].join(', ');

/**
 * Folds the many-to-many roles into one column so listing users stays a single
 * query. Role names contain no commas, so the default separator is safe.
 */
const ROLES_CSV =
  '(SELECT GROUP_CONCAT(r.role) FROM user_roles r WHERE r.user_id = u.id) AS roles_csv';

const SELECT_USER = `SELECT ${COLUMNS}, ${ROLES_CSV} FROM users u`;

/** SQLite has no date type, so the app writes ISO-8601 UTC strings. */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SORT_SQL: Record<UserSortField, string> = {
  full_name: 'u.full_name COLLATE NOCASE',
  email: 'u.email COLLATE NOCASE',
  status: 'u.status',
  created_at: 'u.created_at',
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
  params: ListUsersParams,
  /**
   * Ids this viewer may see, or null for an admin. Applied here rather than in
   * the route so that no caller can forget it.
   */
  visibleIds?: Set<string> | null,
): Promise<ListUsersResult> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (visibleIds) {
    if (visibleIds.size === 0) return { users: [], total: 0 };
    where.push(`u.id IN (${[...visibleIds].map(() => '?').join(', ')})`);
    values.push(...visibleIds);
  }

  if (!params.include_deleted) where.push('u.deleted_at IS NULL');

  if (params.search) {
    const term = `%${params.search.toLowerCase()}%`;
    where.push('(lower(u.full_name) LIKE ? OR lower(u.email) LIKE ?)');
    values.push(term, term);
  }

  // "Holds this role", not "is exactly this role" -- users have several.
  if (params.role) {
    where.push('EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ?)');
    values.push(params.role);
  }

  if (params.status) {
    where.push('u.status = ?');
    values.push(params.status);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // `sort` and `order` come from Zod enums, so they are safe to interpolate.
  const orderSql = `ORDER BY ${SORT_SQL[params.sort]} ${params.order === 'desc' ? 'DESC' : 'ASC'}, u.id ASC`;

  const [countResult, pageResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total FROM users u ${whereSql}`).bind(...values),
    db
      .prepare(`${SELECT_USER} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .bind(...values, params.limit, params.offset),
  ]);

  return {
    total: Number((countResult?.results?.[0] as { total?: number } | undefined)?.total ?? 0),
    users: ((pageResult?.results ?? []) as unknown as UserRow[]).map(toUser),
  };
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare(`${SELECT_USER} WHERE u.id = ?`).bind(id).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getLiveUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE u.id = ? AND u.deleted_at IS NULL`)
    .bind(id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/**
 * Sign-in matches on email, because an admin creates the row long before the
 * person has ever presented a Google token.
 */
export async function getLiveUserByEmail(db: D1Database, email: string): Promise<User | null> {
  // A blank address must never match. SQL equality against NULL is already
  // never true, so a child's row is unreachable this way; this guards the
  // other direction, where a caller passes "" and matches a row storing "".
  if (!email.trim()) return null;

  const row = await db
    .prepare(`${SELECT_USER} WHERE lower(u.email) = ? AND u.deleted_at IS NULL`)
    .bind(email.trim().toLowerCase())
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/**
 * The whole graph for one person: their row, their role-specific profiles, and
 * everything that hangs off them. Issued as one batch, so it costs a single
 * round trip to D1.
 */
export async function getUserDetail(db: D1Database, id: string): Promise<UserDetail | null> {
  const [userRes, tutorRes, studentRes, payRes, availRes, guardiansRes, dependentsRes] =
    await db.batch<Record<string, unknown>>([
      db.prepare(`${SELECT_USER} WHERE u.id = ?`).bind(id),
      db
        .prepare(
          `SELECT highest_education, school, area, availability_notes, virtual_available,
                  default_rate_in_person_cents, default_rate_virtual_cents,
                  max_session_minutes, topup_amount_cents, ssn_received_on
           FROM tutor_profiles WHERE user_id = ?`,
        )
        .bind(id),
      db
        .prepare(
          `SELECT school, current_math_course, academic_year_goal, virtual_available,
                  charge_rate_in_person_cents, charge_rate_virtual_cents,
                  max_session_minutes
           FROM student_profiles WHERE user_id = ?`,
        )
        .bind(id),
      db
        .prepare('SELECT method, handle FROM payment_handles WHERE user_id = ? ORDER BY method')
        .bind(id),
      db
        .prepare(
          `SELECT day_of_week, hour FROM availability_slots
           WHERE user_id = ? ORDER BY day_of_week, hour`,
        )
        .bind(id),
      // People responsible for this user.
      db
        .prepare(
          `SELECT g.guardian_user_id AS user_id, p.full_name, p.email, g.relationship, g.is_primary
           FROM guardianships g JOIN users p ON p.id = g.guardian_user_id
           WHERE g.dependent_user_id = ?
           ORDER BY g.is_primary DESC, p.full_name`,
        )
        .bind(id),
      // People this user is responsible for.
      db
        .prepare(
          `SELECT g.dependent_user_id AS user_id, c.full_name, c.email, g.relationship, g.is_primary
           FROM guardianships g JOIN users c ON c.id = g.dependent_user_id
           WHERE g.guardian_user_id = ?
           ORDER BY c.full_name`,
        )
        .bind(id),
    ]);

  const userRow = userRes?.results?.[0] as UserRow | undefined;
  if (!userRow) return null;

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

  return {
    ...toUser(userRow),
    tutor_profile: rawTutor
      ? ({
          highest_education: (rawTutor.highest_education as string | null) ?? null,
          school: (rawTutor.school as string | null) ?? null,
          area: (rawTutor.area as string | null) ?? null,
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

/** How many guardians a user currently has. Backs the "students need a parent" rule. */
export async function countGuardians(db: D1Database, dependentId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM guardianships WHERE dependent_user_id = ?')
    .bind(dependentId)
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

/** Validates guardian ids before they are written, so FK errors never surface raw. */
export async function findMissingUserIds(db: D1Database, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(', ');
  const result = await db
    .prepare(`SELECT id FROM users WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
    .bind(...ids)
    .all<{ id: string }>();

  const found = new Set((result.results ?? []).map((row) => row.id));
  return ids.filter((id) => !found.has(id));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function roleStatements(db: D1Database, userId: string, roles: UserRole[]) {
  return roles.map((role) =>
    db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)').bind(userId, role),
  );
}

/**
 * A profile row may exist only while its role is held, so dropping a role
 * drops the profile with it rather than leaving an orphan behind.
 */
function profileCleanupStatements(db: D1Database, userId: string, roles: UserRole[]) {
  const statements = [];

  if (!roles.includes('tutor')) {
    statements.push(db.prepare('DELETE FROM tutor_profiles WHERE user_id = ?').bind(userId));
  }
  if (!roles.includes('student')) {
    statements.push(db.prepare('DELETE FROM student_profiles WHERE user_id = ?').bind(userId));
  }

  return statements;
}

export async function createUser(db: D1Database, input: CreateUserPayload): Promise<User> {
  const id = crypto.randomUUID();

  // Batched, so a failure part-way leaves no user without roles.
  await db.batch([
    db
      .prepare('INSERT INTO users (id, email, full_name, phone, status) VALUES (?, ?, ?, ?, ?)')
      .bind(id, input.email, input.full_name, input.phone, input.status),
    ...roleStatements(db, id, input.roles),
  ]);

  const user = await getUserById(db, id);
  if (!user) throw new Error('Insert into users returned no row.');

  return user;
}

/** Returns null when no live user has that id. */
export async function updateUser(
  db: D1Database,
  id: string,
  input: UpdateUserPayload,
): Promise<User | null> {
  const existing = await getLiveUserById(db, id);
  if (!existing) return null;

  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const field of ['email', 'full_name', 'phone', 'status'] as const) {
    if (field in input) {
      assignments.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  // Always bump updated_at, even for a roles-only change: the person's record
  // did change. Setting it inline also stops the trigger doing a second write.
  assignments.push(`updated_at = ${NOW}`);

  const statements = [
    db
      .prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
      .bind(...values, id),
  ];

  // Supplying `roles` replaces the whole set.
  if (input.roles) {
    statements.push(
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id),
      ...roleStatements(db, id, input.roles),
      ...profileCleanupStatements(db, id, input.roles),
    );
  }

  await db.batch(statements);
  return getUserById(db, id);
}

/**
 * Replaces whole sections rather than diffing them, which keeps "set my
 * availability" one idempotent call. An omitted key leaves that section alone.
 */
export async function updateUserSections(
  db: D1Database,
  id: string,
  sections: UpdateUserSectionsPayload,
): Promise<void> {
  const statements = [];

  if (sections.tutor_profile !== undefined) {
    statements.push(db.prepare('DELETE FROM tutor_profiles WHERE user_id = ?').bind(id));

    if (sections.tutor_profile !== null) {
      const p = sections.tutor_profile;
      statements.push(
        db
          .prepare(
            `INSERT INTO tutor_profiles
               (user_id, highest_education, school, area, availability_notes, virtual_available,
                default_rate_in_person_cents, default_rate_virtual_cents, max_session_minutes,
                topup_amount_cents, ssn_received_on)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            p.highest_education,
            p.school,
            p.area,
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
    statements.push(db.prepare('DELETE FROM student_profiles WHERE user_id = ?').bind(id));

    if (sections.student_profile !== null) {
      const p = sections.student_profile;
      statements.push(
        db
          .prepare(
            `INSERT INTO student_profiles
               (user_id, school, current_math_course, academic_year_goal, virtual_available,
                charge_rate_in_person_cents, charge_rate_virtual_cents, max_session_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            p.school,
            p.current_math_course,
            p.academic_year_goal,
            p.virtual_available ? 1 : 0,
            p.charge_rate_in_person_cents,
            p.charge_rate_virtual_cents,
            p.max_session_minutes,
          ),
      );
    }
  }

  if (sections.payment_handles) {
    statements.push(db.prepare('DELETE FROM payment_handles WHERE user_id = ?').bind(id));
    for (const handle of sections.payment_handles) {
      statements.push(
        db
          .prepare('INSERT INTO payment_handles (user_id, method, handle) VALUES (?, ?, ?)')
          .bind(id, handle.method, handle.handle),
      );
    }
  }

  if (sections.availability) {
    statements.push(db.prepare('DELETE FROM availability_slots WHERE user_id = ?').bind(id));
    for (const slot of sections.availability) {
      statements.push(
        db
          .prepare('INSERT INTO availability_slots (user_id, day_of_week, hour) VALUES (?, ?, ?)')
          .bind(id, slot.day_of_week, slot.hour),
      );
    }
  }

  if (sections.guardians) {
    statements.push(db.prepare('DELETE FROM guardianships WHERE dependent_user_id = ?').bind(id));
    for (const link of sections.guardians) {
      statements.push(
        db
          .prepare(
            `INSERT INTO guardianships
               (guardian_user_id, dependent_user_id, relationship, is_primary)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(link.guardian_user_id, id, link.relationship, link.is_primary ? 1 : 0),
      );
    }
  }

  if (statements.length > 0) {
    // One batch, so a half-applied section is impossible.
    statements.push(db.prepare(`UPDATE users SET updated_at = ${NOW} WHERE id = ?`).bind(id));
    await db.batch(statements);
  }
}

/** Soft delete. Returns null if the user is missing or already deleted. */
export async function deactivateUser(db: D1Database, id: string): Promise<User | null> {
  const result = await db
    .prepare(
      `UPDATE users SET deleted_at = ${NOW}, updated_at = ${NOW}
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(id)
    .run();

  if (!result.meta.changes) return null;
  return getUserById(db, id);
}

/** Returns null if the user is missing or was never deleted. */
export async function restoreUser(db: D1Database, id: string): Promise<User | null> {
  const result = await db
    .prepare(
      `UPDATE users SET deleted_at = NULL, updated_at = ${NOW}
       WHERE id = ? AND deleted_at IS NOT NULL`,
    )
    .bind(id)
    .run();

  if (!result.meta.changes) return null;
  return getUserById(db, id);
}

/** Permanent removal. Roles, profiles and links go with it via ON DELETE CASCADE. */
export async function purgeUser(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

// ---------------------------------------------------------------------------
// Sign-in support
// ---------------------------------------------------------------------------

/** Used by the AUTH_ENABLED=false bypass when no DEV_USER_EMAIL is configured. */
export async function getFirstAdmin(db: D1Database): Promise<User | null> {
  const row = await db
    .prepare(
      `${SELECT_USER}
       WHERE u.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
       ORDER BY u.created_at ASC, u.id ASC
       LIMIT 1`,
    )
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Last-resort identity for the AUTH_ENABLED=false bypass. */
export async function getFirstLiveUser(db: D1Database): Promise<User | null> {
  const row = await db
    .prepare(`${SELECT_USER} WHERE u.deleted_at IS NULL ORDER BY u.created_at ASC, u.id ASC LIMIT 1`)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Gate for the bootstrap-admin path: once any admin exists, it closes. */
export async function countAdmins(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total FROM users u
       WHERE u.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')`,
    )
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

/**
 * Records a successful sign-in and pins the Google `sub` the first time we see
 * it, so the account survives a later email change.
 */
export async function recordSignIn(
  db: D1Database,
  id: string,
  googleSub: string,
): Promise<User | null> {
  const result = await db
    .prepare(
      `UPDATE users
       SET last_login_at = ${NOW},
           updated_at = ${NOW},
           google_sub = COALESCE(google_sub, ?),
           -- 'invited' means "added, but has never signed in", so the first
           -- successful sign-in is exactly when it stops being true.
           status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
       WHERE id = ? AND deleted_at IS NULL`,
    )
    .bind(googleSub, id)
    .run();

  if (!result.meta.changes) return null;
  return getUserById(db, id);
}

/** Creates the very first admin from BOOTSTRAP_ADMIN_EMAILS on their first sign-in. */
export async function createBootstrapAdmin(
  db: D1Database,
  input: { email: string; full_name: string; google_sub: string | null },
): Promise<User> {
  const id = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, email, full_name, status, google_sub, last_login_at)
         VALUES (?, ?, ?, 'active', ?, ${NOW})`,
      )
      .bind(id, input.email, input.full_name, input.google_sub),
    db.prepare("INSERT INTO user_roles (user_id, role) VALUES (?, 'admin')").bind(id),
  ]);

  const user = await getUserById(db, id);
  if (!user) throw new Error('Bootstrap admin insert returned no row.');

  return user;
}

/**
 * The hourly prices charged for one student, or null if they have no student
 * profile. Its own query because pricing a session needs nothing else from the
 * profile, and runs on every session write.
 */
export async function getStudentChargeRates(
  db: D1Database,
  studentUserId: string,
): Promise<{
  charge_rate_in_person_cents: number | null;
  charge_rate_virtual_cents: number | null;
} | null> {
  const row = await db
    .prepare(
      `SELECT charge_rate_in_person_cents, charge_rate_virtual_cents
       FROM student_profiles WHERE user_id = ?`,
    )
    .bind(studentUserId)
    .first<{
      charge_rate_in_person_cents: number | null;
      charge_rate_virtual_cents: number | null;
    }>();

  return row ?? null;
}

/**
 * Records, or withdraws, the office's confirmation that it holds a tutor's
 * SSN. The number is not a parameter here and has nowhere to go if it were.
 */
export async function setSsnReceived(
  db: D1Database,
  userId: string,
  received: boolean,
): Promise<string | null> {
  await db
    .prepare(
      `UPDATE tutor_profiles
       SET ssn_received_on = ${received ? "date('now')" : 'NULL'},
           updated_at = ${NOW}
       WHERE user_id = ?`,
    )
    .bind(userId)
    .run();

  const row = await db
    .prepare('SELECT ssn_received_on FROM tutor_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ ssn_received_on: string | null }>();

  return row?.ssn_received_on ?? null;
}

/**
 * Every tutor's tax-document readiness, with what they have been paid in the
 * given calendar year.
 *
 * One query rather than a balance recomputation: a year-end document covers
 * money that MOVED in that year, which is the payments table, not the
 * sessions that earned it.
 */
export async function listTutorTaxStatus(
  db: D1Database,
  year: number,
): Promise<TutorTaxStatus[]> {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, tp.ssn_received_on,
              COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                        WHERE p.party_user_id = u.id
                          AND p.direction = 'to_tutor'
                          AND p.paid_at >= ? AND p.paid_at < ?), 0) AS paid_this_year_cents
       FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'
       LEFT JOIN tutor_profiles tp ON tp.user_id = u.id
       WHERE u.deleted_at IS NULL
       ORDER BY u.full_name`,
    )
    .bind(`${year}-01-01`, `${year + 1}-01-01`)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    user_id: String(row.user_id),
    full_name: String(row.full_name),
    ssn_received_on: (row.ssn_received_on as string | null) ?? null,
    paid_this_year_cents: Number(row.paid_this_year_cents ?? 0),
  }));
}

/** Tutors the office cannot file a tax document for yet. */
export async function listTutorsMissingSsn(
  db: D1Database,
): Promise<{ user_id: string; full_name: string }[]> {
  const result = await db
    .prepare(
      `SELECT u.id AS user_id, u.full_name
       FROM users u
       JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'
       LEFT JOIN tutor_profiles tp ON tp.user_id = u.id
       WHERE u.deleted_at IS NULL AND u.status <> 'suspended'
         AND tp.ssn_received_on IS NULL
       ORDER BY u.full_name`,
    )
    .all<{ user_id: string; full_name: string }>();

  return result.results ?? [];
}

/** One tutor's own tax-document readiness, for their dashboard. */
export async function getSsnReceivedOn(db: D1Database, userId: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT ssn_received_on FROM tutor_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ ssn_received_on: string | null }>();

  return row?.ssn_received_on ?? null;
}

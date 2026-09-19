import type {
  CreateUserPayload,
  ListUsersParams,
  UpdateUserPayload,
  User,
  UserSortField,
} from '@tmi/shared';

/** Column list shared by every read. `google_sub` is intentionally not exposed. */
const COLUMNS = 'id, email, full_name, phone, role, status, created_at, updated_at, deleted_at';

/** SQLite has no date type, so the app writes ISO-8601 UTC strings. */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Maps a sortable field to the SQL it is safe to interpolate. */
const SORT_SQL: Record<UserSortField, string> = {
  full_name: 'full_name COLLATE NOCASE',
  email: 'email COLLATE NOCASE',
  role: 'role',
  status: 'status',
  created_at: 'created_at',
};

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function toUser(row: UserRow): User {
  return row as User;
}

export interface ListUsersResult {
  users: User[];
  total: number;
}

export async function listUsers(db: D1Database, params: ListUsersParams): Promise<ListUsersResult> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (!params.include_deleted) {
    where.push('deleted_at IS NULL');
  }

  if (params.search) {
    const term = `%${params.search.toLowerCase()}%`;
    where.push('(lower(full_name) LIKE ? OR lower(email) LIKE ?)');
    values.push(term, term);
  }

  if (params.role) {
    where.push('role = ?');
    values.push(params.role);
  }

  if (params.status) {
    where.push('status = ?');
    values.push(params.status);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // `sort` and `order` come from Zod enums, so they are safe to interpolate.
  const orderSql = `ORDER BY ${SORT_SQL[params.sort]} ${params.order === 'desc' ? 'DESC' : 'ASC'}, id ASC`;

  const [countResult, pageResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total FROM users ${whereSql}`).bind(...values),
    db
      .prepare(`SELECT ${COLUMNS} FROM users ${whereSql} ${orderSql} LIMIT ? OFFSET ?`)
      .bind(...values, params.limit, params.offset),
  ]);

  const total = Number((countResult?.results?.[0] as { total?: number } | undefined)?.total ?? 0);
  const users = ((pageResult?.results ?? []) as unknown as UserRow[]).map(toUser);

  return { users, total };
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

export async function createUser(db: D1Database, input: CreateUserPayload): Promise<User> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, email, full_name, phone, role, status)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING ${COLUMNS}`,
    )
    .bind(crypto.randomUUID(), input.email, input.full_name, input.phone, input.role, input.status)
    .first<UserRow>();

  if (!row) {
    throw new Error('Insert into users returned no row.');
  }

  return toUser(row);
}

/** Returns null when no live user has that id. */
export async function updateUser(
  db: D1Database,
  id: string,
  input: UpdateUserPayload,
): Promise<User | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const field of ['email', 'full_name', 'phone', 'role', 'status'] as const) {
    if (field in input) {
      assignments.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  if (assignments.length === 0) {
    return getUserById(db, id);
  }

  // Set updated_at here rather than leaning on the trigger: the trigger only
  // fires when updated_at was left untouched, and doing it inline saves a write.
  assignments.push(`updated_at = ${NOW}`);

  const row = await db
    .prepare(
      `UPDATE users SET ${assignments.join(', ')}
       WHERE id = ? AND deleted_at IS NULL
       RETURNING ${COLUMNS}`,
    )
    .bind(...values, id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Soft delete. Returns null if the user is missing or already deleted. */
export async function deactivateUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(
      `UPDATE users SET deleted_at = ${NOW}, updated_at = ${NOW}
       WHERE id = ? AND deleted_at IS NULL
       RETURNING ${COLUMNS}`,
    )
    .bind(id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Returns null if the user is missing or was never deleted. */
export async function restoreUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(
      `UPDATE users SET deleted_at = NULL, updated_at = ${NOW}
       WHERE id = ? AND deleted_at IS NOT NULL
       RETURNING ${COLUMNS}`,
    )
    .bind(id)
    .first<UserRow>();

  return row ? toUser(row) : null;
}

/** Permanent removal, used by the "delete forever" action. */
export async function purgeUser(db: D1Database, id: string): Promise<boolean> {
  const row = await db
    .prepare('DELETE FROM users WHERE id = ? RETURNING id')
    .bind(id)
    .first<{ id: string }>();

  return row !== null;
}

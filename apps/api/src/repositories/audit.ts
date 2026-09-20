import type { AuditEvent, ListAuditParams } from '@tmi/shared';

const SELECT_EVENT = `
  SELECT id, actor_user_id, actor_name, subject_user_id, subject_name,
         action, description, entity_type, entity_id, created_at
  FROM audit_events
`;

export interface ListAuditResult {
  events: AuditEvent[];
  total: number;
}

/**
 * @param visibleToUserId when set, restricts the log to events where this user
 *   is the actor or the subject. Non-admins never see anyone else's activity.
 */
export async function listAuditEvents(
  db: D1Database,
  params: ListAuditParams,
  visibleToUserId?: string | null,
): Promise<ListAuditResult> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (visibleToUserId) {
    where.push('(actor_user_id = ? OR subject_user_id = ?)');
    values.push(visibleToUserId, visibleToUserId);
  }

  // A person's feed covers what they did and what was done to them.
  if (params.user_id) {
    where.push('(actor_user_id = ? OR subject_user_id = ?)');
    values.push(params.user_id, params.user_id);
  }

  if (params.actor_user_id) {
    where.push('actor_user_id = ?');
    values.push(params.actor_user_id);
  }

  if (params.action) {
    where.push('action = ?');
    values.push(params.action);
  }

  if (params.entity) {
    // "user" matches user.created, user.updated, ...
    where.push('action LIKE ?');
    values.push(`${params.entity}.%`);
  }

  if (params.from) {
    where.push('created_at >= ?');
    values.push(params.from);
  }

  if (params.to) {
    // Inclusive of the whole day, since created_at carries a time.
    where.push('created_at <= ?');
    values.push(`${params.to}T23:59:59.999Z`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countResult, pageResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total FROM audit_events ${whereSql}`).bind(...values),
    db
      .prepare(`${SELECT_EVENT} ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...values, params.limit, params.offset),
  ]);

  return {
    total: Number((countResult?.results?.[0] as { total?: number } | undefined)?.total ?? 0),
    events: (pageResult?.results ?? []) as unknown as AuditEvent[],
  };
}

/** Distinct actions present in the log, so filters offer only what exists. */
export async function listAuditActions(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare('SELECT DISTINCT action FROM audit_events ORDER BY action')
    .all<{ action: string }>();

  return (result.results ?? []).map((row) => row.action);
}

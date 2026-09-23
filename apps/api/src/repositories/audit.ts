import type { AuditEvent, ListAuditParams } from '@tmi/shared';

const SELECT_EVENT = `
  SELECT id, actor_user_id, actor_name, subject_user_id, subject_name,
         action, description, entity_type, entity_id, created_at
  FROM audit_events
`;

/**
 * Until Phase 17 a recorded lesson's log line ended with the FAMILY's price,
 * "(95.00 USD)" -- and the tutor who recorded it reads their own activity.
 * New lines carry no amount. The old ones cannot be rewritten (the log is
 * append-only), so the figure is taken out on the way to anyone but an admin.
 */
const SESSION_PRICE = /\s*\(\d+(?:\.\d+)? USD\)/g;

/**
 * Until Phase 21 a payment's line named its amount too -- "Recorded $241.25
 * paid to Alex Chen by Zelle" -- and the tutor or parent it concerns reads
 * their own log. Old lines are reworded the same way on the way out.
 */
const PAYMENT_AMOUNT = /\$[\d,]+(?:\.\d{2})?/;

function withoutPaymentAmount(description: string): string {
  return description
    .replace(new RegExp(`Recorded ${PAYMENT_AMOUNT.source} paid to`), 'Recorded a payment to')
    .replace(new RegExp(`Recorded ${PAYMENT_AMOUNT.source} received from`), 'Recorded a payment from')
    .replace(new RegExp(` a ${PAYMENT_AMOUNT.source} payment`), ' a payment')
    .replace(new RegExp(PAYMENT_AMOUNT.source, 'g'), 'an amount');
}

function withoutAmounts(event: AuditEvent): AuditEvent {
  if (event.action.startsWith('session.')) {
    return { ...event, description: event.description.replace(SESSION_PRICE, '') };
  }
  if (event.action.startsWith('payment.')) {
    return { ...event, description: withoutPaymentAmount(event.description) };
  }
  return event;
}

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
    events: ((pageResult?.results ?? []) as unknown as AuditEvent[]).map((event) =>
      // A scoped read is a non-admin's (or an admin viewing as one).
      visibleToUserId ? withoutAmounts(event) : event,
    ),
  };
}

/**
 * Distinct actions present in the log, so filters offer only what exists.
 * Scoped like the feed: a non-admin's filter lists only actions in their own
 * events, not every kind of thing the institute has ever logged.
 */
export async function listAuditActions(
  db: D1Database,
  visibleToUserId?: string | null,
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT action FROM audit_events
       ${visibleToUserId ? 'WHERE actor_user_id = ? OR subject_user_id = ?' : ''}
       ORDER BY action`,
    )
    .bind(...(visibleToUserId ? [visibleToUserId, visibleToUserId] : []))
    .all<{ action: string }>();

  return (result.results ?? []).map((row) => row.action);
}

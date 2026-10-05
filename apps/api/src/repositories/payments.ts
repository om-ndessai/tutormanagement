import type { ListPaymentsParams, Payment, PaymentPayload, PaymentUpdatePayload, User } from '@tmi/shared';

import type { OrgId } from '../lib/org.js';
import { isAdmin } from '../lib/scope.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SELECT_PAYMENT = `
  SELECT p.id, p.direction, p.party_user_id, party.full_name AS party_name,
         p.student_user_id, student.full_name AS student_name,
         p.amount_cents, p.method, p.paid_at, p.reference, p.notes,
         p.created_at, p.updated_at
  FROM payments p
  JOIN users party ON party.id = p.party_user_id
  LEFT JOIN users student ON student.id = p.student_user_id
`;

/**
 * You see a payment if you are the party to it, or if it concerns one of your
 * children. Tutors see what they were paid; parents see what they paid.
 */
function scopeFor(org: OrgId, viewer: User): { sql: string; values: unknown[] } {
  // The organization first, for everyone: an admin's view is exactly this.
  if (isAdmin(viewer)) return { sql: 'p.organization_id = ?', values: [org] };

  return {
    sql:
      '(p.organization_id = ? AND (p.party_user_id = ?' +
      ' OR p.student_user_id = ?' +
      ' OR p.student_user_id IN (SELECT g.dependent_user_id FROM guardianships g' +
      ' WHERE g.organization_id = ? AND g.guardian_user_id = ?)))',
    values: [org, viewer.id, viewer.id, org, viewer.id],
  };
}

export interface ListPaymentsResult {
  payments: Payment[];
  total: number;
  total_amount_cents: number;
}

export async function listPayments(
  db: D1Database,
  org: OrgId,
  viewer: User,
  params: ListPaymentsParams,
): Promise<ListPaymentsResult> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.direction) {
    where.push('p.direction = ?');
    values.push(params.direction);
  }
  if (params.party_user_id) {
    where.push('p.party_user_id = ?');
    values.push(params.party_user_id);
  }
  if (params.student_user_id) {
    where.push('p.student_user_id = ?');
    values.push(params.student_user_id);
  }
  if (params.from) {
    where.push('p.paid_at >= ?');
    values.push(params.from);
  }
  if (params.to) {
    where.push('p.paid_at <= ?');
    values.push(`${params.to}T23:59:59.999Z`);
  }

  const scope = scopeFor(org, viewer);
  where.push(scope.sql);
  values.push(...scope.values);

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [totalsResult, pageResult] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT COUNT(*) AS total, COALESCE(SUM(p.amount_cents), 0) AS amount
         FROM payments p ${whereSql}`,
      )
      .bind(...values),
    db
      .prepare(`${SELECT_PAYMENT} ${whereSql} ORDER BY p.paid_at DESC, p.id LIMIT ? OFFSET ?`)
      .bind(...values, params.limit, params.offset),
  ]);

  const totals = (totalsResult?.results?.[0] ?? {}) as Record<string, number>;

  return {
    payments: (pageResult?.results ?? []) as unknown as Payment[],
    total: Number(totals.total ?? 0),
    total_amount_cents: Number(totals.amount ?? 0),
  };
}

/** One payment, only if the viewer's list would contain it. */
export async function getVisiblePayment(
  db: D1Database,
  org: OrgId,
  viewer: User,
  id: string,
): Promise<Payment | null> {
  const scope = scopeFor(org, viewer);
  const row = await db
    .prepare(`${SELECT_PAYMENT} WHERE p.id = ? AND ${scope.sql}`)
    .bind(id, ...scope.values)
    .first<Payment>();

  return row ?? null;
}

/** A payment of this organization. One from elsewhere is null. */
export async function getPayment(db: D1Database, org: OrgId, id: string): Promise<Payment | null> {
  const row = await db
    .prepare(`${SELECT_PAYMENT} WHERE p.organization_id = ? AND p.id = ?`)
    .bind(org, id)
    .first<Payment>();
  return row ?? null;
}

export async function createPayment(
  db: D1Database,
  org: OrgId,
  input: PaymentPayload,
  recordedBy: string,
) {
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO payments
         (id, organization_id, direction, party_user_id, student_user_id, amount_cents, method,
          paid_at, reference, notes, recorded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      org,
      input.direction,
      input.party_user_id,
      // A payment to a tutor is not about any one student.
      input.direction === 'from_parent' ? (input.student_user_id ?? null) : null,
      input.amount_cents,
      input.method,
      input.paid_at,
      input.reference,
      input.notes,
      recordedBy,
    )
    .run();

  const created = await getPayment(db, org, id);
  if (!created) throw new Error('Insert into payments returned no row.');

  return created;
}

export async function updatePayment(
  db: D1Database,
  org: OrgId,
  id: string,
  input: PaymentUpdatePayload,
): Promise<Payment | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const field of ['amount_cents', 'method', 'paid_at', 'reference', 'notes'] as const) {
    if (field in input) {
      assignments.push(`${field} = ?`);
      values.push(input[field]);
    }
  }

  if (assignments.length === 0) return getPayment(db, org, id);

  assignments.push(`updated_at = ${NOW}`);

  const result = await db
    .prepare(`UPDATE payments SET ${assignments.join(', ')} WHERE organization_id = ? AND id = ?`)
    .bind(...values, org, id)
    .run();

  if (!result.meta.changes) return null;
  return getPayment(db, org, id);
}

export async function deletePayment(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM payments WHERE organization_id = ? AND id = ?')
    .bind(org, id)
    .run();
  return Boolean(result.meta.changes);
}

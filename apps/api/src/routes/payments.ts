import { Hono } from 'hono';
import { z } from 'zod';
import {
  formatCents,
  listPaymentsQuerySchema,
  paymentInputSchema,
  paymentUpdateSchema,
  PAYMENT_FORM_LABELS,
  type ApiList,
  type ApiOk,
  type BalancesResponse,
  type Payment,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { computeBalances } from '../repositories/balances.js';
import {
  createPayment,
  deletePayment,
  getPayment,
  listPayments,
  updatePayment,
} from '../repositories/payments.js';
import { getLiveUserById } from '../repositories/users.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid payment id.' }) });

interface PaymentListBody extends ApiList<Payment> {
  total_amount_cents: number;
}

/**
 * A payment must name the right kind of person, or the balances it feeds are
 * nonsense: money "from a parent" who is not a parent belongs to no family
 * ledger.
 */
async function assertParties(
  db: D1Database,
  direction: string,
  partyId: string,
  studentId: string | null | undefined,
) {
  const details: Record<string, string[]> = {};
  const party = await getLiveUserById(db, partyId);

  if (!party) {
    details.party_user_id = ['That person no longer exists.'];
  } else if (direction === 'from_parent' && !party.roles.includes('parent')) {
    details.party_user_id = [`${party.full_name} does not have the Parent role.`];
  } else if (direction === 'to_tutor' && !party.roles.includes('tutor')) {
    details.party_user_id = [`${party.full_name} does not have the Tutor role.`];
  }

  if (direction === 'from_parent' && studentId) {
    const student = await getLiveUserById(db, studentId);

    if (!student) details.student_user_id = ['That student no longer exists.'];
    else if (!student.roles.includes('student')) {
      details.student_user_id = [`${student.full_name} does not have the Student role.`];
    }
  }

  if (Object.keys(details).length > 0) {
    throw ApiError.validation('Please correct the highlighted fields.', details);
  }
}

export const paymentsRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listPaymentsQuerySchema), async (c) => {
    const params = c.req.valid('query');
    const { payments, total, total_amount_cents } = await listPayments(
      c.env.DB,
      c.get('user'),
      params,
    );

    const body: PaymentListBody = {
      data: payments,
      meta: { total, limit: params.limit, offset: params.offset },
      total_amount_cents,
    };
    return c.json(body);
  })

  /**
   * "Balances need to be supported for parents as well as tutors."
   *
   * Placed under /payments because it is the same ledger read the other way,
   * and scoped so a tutor sees only their own figure.
   */
  .get('/balances', async (c) => {
    const body: ApiOk<BalancesResponse> = {
      data: await computeBalances(c.env.DB, c.get('user')),
    };
    return c.json(body);
  })

  /** Only an admin records money: this is the institute's own ledger. */
  .post('/', requireAdmin, zValidator('json', paymentInputSchema), async (c) => {
    const input = c.req.valid('json');
    await assertParties(c.env.DB, input.direction, input.party_user_id, input.student_user_id);

    const payment = await createPayment(c.env.DB, input, c.get('user').id);

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'payment.recorded',
      description:
        input.direction === 'from_parent'
          ? `Recorded ${formatCents(payment.amount_cents)} received from ${payment.party_name}` +
            ` for ${payment.student_name} by ${PAYMENT_FORM_LABELS[payment.method]}`
          : `Recorded ${formatCents(payment.amount_cents)} paid to ${payment.party_name}` +
            ` by ${PAYMENT_FORM_LABELS[payment.method]}`,
      subject: { id: payment.party_user_id, full_name: payment.party_name },
      entity_type: 'payment',
      entity_id: payment.id,
    });

    const body: ApiOk<Payment> = { data: payment };
    return c.json(body, 201);
  })

  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const payment = await getPayment(c.env.DB, id);

    if (!payment) throw ApiError.notFound('That payment does not exist.');

    const viewer = c.get('user');
    if (!isAdmin(viewer)) {
      const { total } = await listPayments(c.env.DB, viewer, {
        limit: 1,
        offset: 0,
        party_user_id: payment.party_user_id,
      });
      if (total === 0) throw ApiError.notFound('That payment does not exist.');
    }

    const body: ApiOk<Payment> = { data: payment };
    return c.json(body);
  })

  .patch(
    '/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', paymentUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const updated = await updatePayment(c.env.DB, id, c.req.valid('json'));

      if (!updated) throw ApiError.notFound('That payment does not exist.');

      await recordAudit(c.env.DB, c.get('user'), {
        action: 'payment.updated',
        description: `Updated a ${formatCents(updated.amount_cents)} payment involving ${updated.party_name}`,
        subject: { id: updated.party_user_id, full_name: updated.party_name },
        entity_type: 'payment',
        entity_id: id,
      });

      const body: ApiOk<Payment> = { data: updated };
      return c.json(body);
    },
  )

  .delete('/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const doomed = await getPayment(c.env.DB, id);

    if (!(await deletePayment(c.env.DB, id))) {
      throw ApiError.notFound('That payment does not exist.');
    }

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'payment.deleted',
      description: doomed
        ? `Deleted a ${formatCents(doomed.amount_cents)} payment involving ${doomed.party_name}`
        : 'Deleted a payment',
      ...(doomed ? { subject: { id: doomed.party_user_id, full_name: doomed.party_name } } : {}),
      entity_type: 'payment',
      entity_id: id,
    });

    return c.body(null, 204);
  });

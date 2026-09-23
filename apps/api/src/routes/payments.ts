import { Hono } from 'hono';
import { z } from 'zod';
import {
  formatCents,
  listPaymentsQuerySchema,
  paymentInputSchema,
  paymentUpdateSchema,
  PAYMENT_DIRECTION_LABELS,
  PAYMENT_FORM_LABELS,
  type ApiList,
  type ApiOk,
  type BalancesResponse,
  type Payment,
  taxSummaryQuerySchema,
  monthlyFinanceQuerySchema,
  type MonthlyFinanceResponse,
  type TutorTaxStatus,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { buildCsv, csvMoney, csvResponse, datedFilename } from '../lib/csv.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { computeBalances, computeMonthlyFinance } from '../repositories/balances.js';
import { listTutorTaxStatus } from '../repositories/users.js';
import {
  createPayment,
  deletePayment,
  getPayment,
  getVisiblePayment,
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

  /** The payment ledger as a spreadsheet, scoped exactly like the list. */
  .get('/export.csv', zValidator('query', listPaymentsQuerySchema), async (c) => {
    const params = c.req.valid('query');
    const { payments } = await listPayments(c.env.DB, c.get('user'), {
      ...params,
      limit: 5000,
      offset: 0,
    });

    const body = buildCsv(
      ['Date', 'Direction', 'Person', 'For student', 'Form', 'Amount (USD)', 'Reference', 'Notes'],
      payments.map((payment) => [
        payment.paid_at.slice(0, 10),
        PAYMENT_DIRECTION_LABELS[payment.direction],
        payment.party_name,
        payment.student_name ?? '',
        PAYMENT_FORM_LABELS[payment.method],
        csvMoney(payment.amount_cents),
        payment.reference ?? '',
        payment.notes ?? '',
      ]),
    );

    return csvResponse(datedFilename('tmi-payments'), body);
  })

  /**
   * "Balances need to be supported for parents as well as tutors."
   *
   * Placed under /payments because it is the same ledger read the other way,
   * and scoped so a tutor sees only their own figure.
   */
  /**
   * The same year-end figures as the CSV, for the screen that offers to print
   * a 1099. Admin only, and it carries no SSN -- only whether the office has
   * one, which is all the portal ever knows.
   */
  .get('/tax-status', requireAdmin, zValidator('query', taxSummaryQuerySchema), async (c) => {
    const { year } = c.req.valid('query');

    const body: ApiOk<TutorTaxStatus[]> = {
      data: await listTutorTaxStatus(c.env.DB, year),
    };
    return c.json(body);
  })

  /**
   * The year-end tutor summary the tax documents are prepared from: what each
   * tutor was PAID in a calendar year, and whether the office has their SSN.
   *
   * Payments rather than earnings, because a tax document reports money that
   * moved in the year. The SSN column is a yes/no with the date it was
   * confirmed -- the number is not in this file, this database or this
   * portal.
   */
  .get('/tax-summary.csv', requireAdmin, zValidator('query', taxSummaryQuerySchema), async (c) => {
    const { year } = c.req.valid('query');
    const tutors = await listTutorTaxStatus(c.env.DB, year);

    const body = buildCsv(
      ['Tutor', 'Paid in ' + year, 'SSN on file', 'Confirmed on'],
      tutors.map((tutor) => [
        tutor.full_name,
        csvMoney(tutor.paid_this_year_cents),
        tutor.ssn_received_on ? 'Yes' : 'NOT RECEIVED',
        tutor.ssn_received_on ?? '',
      ]),
    );

    return csvResponse(`tmi-tax-summary-${year}.csv`, body);
  })

  /**
   * The month-by-month rundown of a financial year.
   *
   * Scoped by who is asking, in the repository rather than here: an admin gets
   * the institute, a tutor gets their own teaching and their own pay.
   */
  .get('/monthly', zValidator('query', monthlyFinanceQuerySchema), async (c) => {
    const { year, user_id } = c.req.valid('query');
    const viewer = c.get('user');
    let subject = viewer;

    // An admin viewing someone's dashboard sees THEIR rundown, which is what
    // makes "view as" show exactly what that person sees.
    if (user_id && user_id !== viewer.id) {
      if (!isAdmin(viewer)) {
        throw new ApiError(403, 'forbidden', 'Only an administrator can view another rundown.');
      }
      const other = await getLiveUserById(c.env.DB, user_id);
      if (!other) throw ApiError.notFound('That user does not exist.');
      subject = other;
    }

    const body: ApiOk<MonthlyFinanceResponse> = {
      data: await computeMonthlyFinance(c.env.DB, subject, year),
    };
    return c.json(body);
  })

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
    // Scoped to the row, not the payer: a guardian who shares one child with
    // another adult must not reach that adult's payments for a different one.
    const payment = await getVisiblePayment(c.env.DB, c.get('user'), c.req.valid('param').id);
    if (!payment) throw ApiError.notFound('That payment does not exist.');

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

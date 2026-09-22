import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 13: tutors are paid before they teach, and the office keeps what they
 * hold above an agreed level.
 *
 * The figures are all derived, so the tests that matter are the derivation
 * itself and who is allowed to see the arrangement.
 */
test.describe('tutor advances', () => {
  test('a payment restores the level, and the shortfall follows the arithmetic', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    const before = await unwrap<any>(
      await admin.request.get('/api/payments/balances'),
      'reading balances',
    );
    const row = before.tutors.find((t: any) => t.user_id === tutorId);
    expect(row.topup_amount_cents).toBeGreaterThan(0);

    const advance = row.paid_cents - row.earned_cents;
    const due = Math.max(0, row.topup_amount_cents - advance);
    expect(due).toBeGreaterThan(0);

    // Paying exactly the shortfall puts them back AT their level, and nothing
    // more is due.
    await unwrap(
      await admin.request.post('/api/payments', {
        data: {
          direction: 'to_tutor',
          party_user_id: tutorId,
          amount_cents: due,
          method: 'zelle',
          paid_at: new Date().toISOString(),
          notes: 'Top-up test.',
        },
      }),
      'recording the top-up',
    );

    const after = await unwrap<any>(
      await admin.request.get('/api/payments/balances'),
      'reading balances again',
    );
    const settled = after.tutors.find((t: any) => t.user_id === tutorId);

    expect(settled.paid_cents - settled.earned_cents).toBe(settled.topup_amount_cents);
    expect(after.totals.topups_due_cents).toBe(before.totals.topups_due_cents - due);
  });

  test('the arrangement is the tutor’s and the office’s, nobody else’s', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    const read = async (page: Awaited<ReturnType<typeof as>>) =>
      (await unwrap<any>(await page.request.get(`/api/users/${tutorId}`), 'reading the tutor'))
        .tutor_profile.topup_amount_cents;

    expect(await read(admin)).toBeGreaterThan(0);
    // The tutor sees their own: it is their money and it tells them when the
    // next payment is coming.
    expect(await read(await as('tutor'))).toBeGreaterThan(0);
    // A family who can open that tutor's record cannot see it.
    expect(await read(await as('parentTutor'))).toBeNull();
    expect(await read(await as('student'))).toBeNull();

    // Nor can they see the institute's total exposure.
    const asParent = await unwrap<any>(
      await (await as('parent')).request.get('/api/payments/balances'),
      'reading balances as a parent',
    );
    expect(asParent.totals.topups_due_cents).toBeNull();
  });

  test('only an admin can set the level, and the dashboards show it', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    const detail = await unwrap<any>(
      await admin.request.get(`/api/users/${tutorId}`),
      'reading the tutor',
    );

    // A tutor cannot raise their own float.
    const refused = await tutor.request.patch(`/api/users/${tutorId}`, {
      data: { tutor_profile: { ...detail.tutor_profile, topup_amount_cents: 500_00 } },
    });
    expect(refused.status()).toBe(403);

    // The level has to be a whole number of cents and within reason.
    const bad = await admin.request.patch(`/api/users/${tutorId}`, {
      data: { tutor_profile: { ...detail.tutor_profile, topup_amount_cents: -1 } },
    });
    expect(bad.status()).toBe(422);

    // The tutor's own dashboard carries the arrangement, so the card can show it.
    const board = await unwrap<any>(
      await tutor.request.get('/api/dashboard?role=tutor'),
      'reading the tutor dashboard',
    );
    expect(board.data.earnings.topup_amount_cents).toBe(detail.tutor_profile.topup_amount_cents);

    // And the admin's lists every tutor's, which is what the top-up panel reads.
    const adminBoard = await unwrap<any>(
      await admin.request.get('/api/dashboard?role=admin'),
      'reading the admin dashboard',
    );
    const onAdvance = adminBoard.data.tutor_balances.filter(
      (t: any) => t.topup_amount_cents !== null,
    );
    expect(onAdvance.length).toBeGreaterThan(0);
  });
});

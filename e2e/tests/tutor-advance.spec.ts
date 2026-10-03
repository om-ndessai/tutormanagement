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

  /**
   * The admin's Tutor payments panel: the day the lessons on a tutor's
   * schedule will take their advance below its level. A tutor of the test's
   * own, so no other lesson can move the date, and a slot starting tomorrow,
   * so nothing depends on what day or hour the suite runs.
   */
  test('the office sees the day each tutor will next need a top-up', async ({ as }) => {
    const admin = await as('admin');
    const guardianId = await idOf(admin, PEOPLE.parent.email);

    // The institute's own date, which is what the API dates lessons by.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
      new Date(),
    );
    const [year, month, day] = today.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);

    // Paid $80 an hour, and kept above $100.
    const tutor = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: 'Tess Projection',
          email: `tess.projection.${Date.now()}@gmail.com`,
          roles: ['tutor'],
          tutor_profile: { default_rate_in_person_cents: 80_00, topup_amount_cents: 100_00 },
        },
      }),
      'adding a tutor',
    );
    const student = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: 'Theo Projection',
          email: '',
          roles: ['student'],
          guardians: [{ guardian_user_id: guardianId, relationship: 'mother', is_primary: true }],
        },
      }),
      'adding a student',
    );

    const row = async () => {
      const board = await unwrap<any>(
        await admin.request.get('/api/dashboard?role=admin'),
        'reading the admin dashboard',
      );
      return board.data.tutor_balances.find((t: any) => t.user_id === tutor.id);
    };

    try {
      await unwrap(
        await admin.request.post('/api/assignments', {
          data: { tutor_user_id: tutor.id, student_user_id: student.id },
        }),
        'pairing them',
      );
      const slot = await unwrap<any>(
        await admin.request.post('/api/schedules', {
          data: {
            tutor_user_id: tutor.id,
            student_user_id: student.id,
            day_of_week: new Date(`${tomorrow}T12:00:00Z`).getUTCDay(),
            start_time: '16:00',
            duration_minutes: 60,
            mode: 'in_person',
            starts_on: tomorrow,
          },
        }),
        'scheduling an hour a week',
      );
      const [first, second, third] = await unwrap<any[]>(
        await admin.request.get(`/api/schedules/upcoming?schedule_id=${slot.id}&limit=3`),
        'reading the dates',
      );
      expect(first.occurs_on).toBe(tomorrow);

      // Not paid yet, so already below the level: past due, and no date.
      expect(await row()).toMatchObject({ urgency: 'past_due', next_topup_on: null, last_paid_cents: null });

      // $220 up front: the first $80 lesson leaves $140 and the second $60,
      // below $100 -- so the second lesson is when the next top-up falls due.
      const paidAt = new Date().toISOString();
      await unwrap(
        await admin.request.post('/api/payments', {
          data: {
            direction: 'to_tutor',
            party_user_id: tutor.id,
            amount_cents: 220_00,
            method: 'zelle',
            paid_at: paidAt,
          },
        }),
        'paying the advance',
      );

      const projected = await row();
      expect(projected).toMatchObject({
        last_paid_cents: 220_00,
        next_topup_on: second.occurs_on,
        // Eight days off, and the line for "due soon" is a week.
        urgency: 'on_track',
      });
      expect(Date.parse(projected.last_paid_at)).toBe(Date.parse(paidAt));

      // A lesson called off earns nothing, so the date moves a week on.
      await unwrap(
        await admin.request.post(`/api/schedules/${slot.id}/cancellations`, {
          data: { occurs_on: first.occurs_on },
        }),
        'cancelling the first lesson',
      );
      expect((await row()).next_topup_on).toBe(third.occurs_on);
      expect(
        (await admin.request.delete(`/api/schedules/${slot.id}/cancellations/${first.occurs_on}`)).status(),
      ).toBe(204);

      const detail = await unwrap<any>(
        await admin.request.get(`/api/users/${tutor.id}`),
        'reading the tutor',
      );
      const setLevel = async (cents: number) =>
        unwrap(
          await admin.request.patch(`/api/users/${tutor.id}`, {
            data: { tutor_profile: { ...detail.tutor_profile, topup_amount_cents: cents } },
          }),
          'changing the level',
        );

      // A higher level is reached sooner: tomorrow's lesson takes them below $150.
      await setLevel(150_00);
      expect(await row()).toMatchObject({ next_topup_on: tomorrow, urgency: 'due_soon' });

      // Above what they hold: past due again, and the row says by how much.
      await setLevel(300_00);
      expect(await row()).toMatchObject({ next_topup_on: null, urgency: 'past_due' });

      await admin.goto('/?tab=finance');
      const line = admin.getByRole('row', { name: /Tess Projection/ });
      await expect(line.getByText('Past due')).toBeVisible();
      await expect(line.getByText('$80.00 below')).toBeVisible();
    } finally {
      // The payment, the pairing and the schedule go with them.
      for (const id of [student.id, tutor.id]) {
        await admin.request.delete(`/api/users/${id}?hard=true`);
      }
    }
  });
});

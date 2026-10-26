import { expect, test, ORGS, PEOPLE } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 54 (docs/tutor-spaces-plan.md): a space with no organization is PAID
 * DIRECTLY. Families pay each lesson's tutor; a lesson is one price; nobody
 * takes a cut; payments name the tutor who received them; there are no
 * payments to tutors and no 1099s. A space run by an organization works as it
 * always has. Rule R24 in docs/data-exposure.md.
 *
 * Serial: one test switches the seeded space `solo` to an organization and
 * back, and the balances read here move as lessons and payments are recorded.
 */
test.describe.configure({ mode: 'serial' });

const solo = { org: ORGS.d.slug };
const OCCURRED_ON = '2026-10-20';

test.describe('tutor spaces, paid directly', () => {
  test('a lesson is one price, and the family and tutor each read it from their side', async ({ as }) => {
    const hannah = await as('soloAdmin', solo);
    const hannahId = await idOf(hannah, PEOPLE.soloAdmin.email);
    const ella = (await unwrap<any[]>(await hannah.request.get('/api/users?search=Ella%20Kim'), 'finding Ella'))[0];

    const recorded = await unwrap<any>(
      await hannah.request.post('/api/sessions', {
        data: {
          tutor_user_id: hannahId,
          student_user_id: ella.id,
          occurred_on: OCCURRED_ON,
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
        },
      }),
      'recording a lesson paid directly',
    );
    // No price on Ella's profile: in a space paid directly the pairing's rate IS the price.
    expect(recorded.paid_directly).toBe(true);
    expect(recorded.tutor_rate_cents).toBe(6000);
    expect(recorded.charge_rate_cents).toBe(6000);
    expect(recorded.charge_amount_cents).toBe(recorded.tutor_amount_cents);

    const grace = await as('soloParent', solo);
    const seen = await unwrap<any>(await grace.request.get(`/api/sessions/${recorded.id}`), 'the family reading it');
    expect(seen.money_view).toBe('family');
    expect(seen.charge_amount_cents).toBe(6000);
    expect(seen.tutor_amount_cents).toBeNull();

    // Diego teaches neither Ella nor this lesson: it is not his to read (R24).
    const diego = await as('soloTutor', solo);
    expect((await diego.request.get(`/api/sessions/${recorded.id}`)).status()).toBe(404);

    await hannah.request.delete(`/api/sessions/${recorded.id}`);
  });

  test('a family keeps one balance with each tutor, and nobody sees another tutor’s', async ({ as }) => {
    const sam = await as('soloParentTwo', solo);
    const mine = await unwrap<any>(await sam.request.get('/api/payments/balances'), 'Sam’s balances');
    expect(mine.paid_directly).toBe(true);
    // Zoe has two tutors, so her father has two balances.
    const zoe = mine.direct.filter((row: any) => row.student_name === 'Zoe Okafor');
    expect(zoe.map((row: any) => row.tutor_name).sort()).toEqual(['Diego Ramos', 'Hannah Brooks']);
    expect(mine.direct.every((row: any) => row.student_name === 'Zoe Okafor')).toBe(true);
    // The organization's ledgers carry nothing here.
    expect(mine.students.every((row: any) => row.charged_cents === 0 && row.paid_cents === 0)).toBe(true);

    const diego = await as('soloTutor', solo);
    const his = await unwrap<any>(await diego.request.get('/api/payments/balances'), 'Diego’s balances');
    expect(his.direct.length).toBeGreaterThan(0);
    expect(his.direct.every((row: any) => row.tutor_name === 'Diego Ramos')).toBe(true);
    expect(his.totals.topups_due_cents).toBeNull();

    // Payments: Diego reads the ones made to him, never Hannah's.
    const payments = await unwrap<any[]>(await diego.request.get('/api/payments'), 'Diego’s payments');
    expect(payments.length).toBeGreaterThan(0);
    expect(payments.every((p: any) => p.payee_name === 'Diego Ramos')).toBe(true);
    const hannah = await as('soloAdmin', solo);
    const all = await unwrap<any[]>(await hannah.request.get('/api/payments'), 'every payment, as the space’s admin');
    const hannahs = all.find((p: any) => p.payee_name === 'Hannah Brooks');
    expect((await diego.request.get(`/api/payments/${hannahs.id}`)).status()).toBe(404);
  });

  test('a tutor records what a family paid them, and only that', async ({ as }) => {
    const diego = await as('soloTutor', solo);
    const diegoId = await idOf(diego, PEOPLE.soloTutor.email);
    const samId = await idOf(diego, PEOPLE.soloParentTwo.email);
    const zoe = (await unwrap<any[]>(await diego.request.get('/api/users?search=Zoe%20Okafor'), 'finding Zoe'))[0];
    const base = {
      direction: 'from_parent',
      party_user_id: samId,
      student_user_id: zoe.id,
      amount_cents: 2500,
      method: 'venmo',
      paid_at: '2026-10-21T18:00:00.000Z',
    };

    const before = await unwrap<any>(await diego.request.get('/api/payments/balances'), 'before');
    const row = (b: any) => b.direct.find((r: any) => r.student_name === 'Zoe Okafor' && r.tutor_name === 'Diego Ramos');

    const paid = await unwrap<any>(
      await diego.request.post('/api/payments', { data: { ...base, payee_user_id: diegoId } }),
      'recording a payment received',
    );
    expect(paid.payee_name).toBe('Diego Ramos');
    const after = await unwrap<any>(await diego.request.get('/api/payments/balances'), 'after');
    expect(row(after).paid_cents - row(before).paid_cents).toBe(2500);

    const hannahId = await idOf(await as('soloAdmin', solo), PEOPLE.soloAdmin.email);
    // Not to someone else.
    expect((await diego.request.post('/api/payments', { data: { ...base, payee_user_id: hannahId } })).status()).toBe(403);
    // Nobody "pays a tutor" here.
    const toTutor = await diego.request.post('/api/payments', {
      data: { direction: 'to_tutor', party_user_id: diegoId, amount_cents: 2500, method: 'cash', paid_at: base.paid_at },
    });
    expect(toTutor.status()).toBe(409);
    expect((await toTutor.json()).error.code).toBe('paid_directly');
    // A payment must name its tutor.
    expect((await diego.request.post('/api/payments', { data: base })).status()).toBe(422);
    // A family records nothing.
    const sam = await as('soloParentTwo', solo);
    expect((await sam.request.post('/api/payments', { data: { ...base, payee_user_id: diegoId } })).status()).toBe(403);

    // The year-end summary is the tutor's own.
    const csv = await diego.request.get(`/api/payments/direct-summary.csv?year=2026`);
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text).toContain('Diego Ramos');
    expect(text).not.toContain('Hannah Brooks');

    // The recorder may take it back.
    expect((await diego.request.delete(`/api/payments/${paid.id}`)).status()).toBe(204);
  });

  test('the space has no payer, and its screens say families pay each tutor', async ({ as }) => {
    const hannah = await as('soloAdmin', solo);
    const tin = await hannah.request.patch('/api/organization/settings', { data: { tin: '12-3456789' } });
    expect(tin.status()).toBe(409);

    await hannah.goto('/organization');
    await expect(visible(hannah, 'Families pay each tutor directly')).toBeVisible();

    await hannah.goto('/billing');
    await expect(visible(hannah, 'Families and tutors')).toBeVisible();
    await expect(hannah.getByRole('link', { name: 'Tax summary' })).toHaveCount(0);
    await expect(hannah.getByRole('link', { name: 'Year-end summary' })).toBeVisible();

    const diego = await as('soloTutor', solo);
    await diego.goto('/billing');
    await expect(diego.getByRole('button', { name: 'Record a payment you received' })).toBeVisible();

    await diego.goto('/dashboard?tab=finance');
    await expect(visible(diego, 'Your families')).toBeVisible();
    await expect(diego.getByText('Action needed: your SSN')).toHaveCount(0);
  });

  test('a space run by an organization works as before', async ({ as }) => {
    const admin = await as('admin');
    const settings = await unwrap<any>(await admin.request.get('/api/organization/settings'), 'A’s settings');
    expect(settings.business?.name).toBe('Chapel Hill Math Institute');
    expect(settings.tin).toBe('47-2019388');

    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const anitaId = await idOf(admin, PEOPLE.parent.email);
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    // A family pays the organization here, never a tutor.
    const withPayee = await admin.request.post('/api/payments', {
      data: {
        direction: 'from_parent',
        party_user_id: anitaId,
        student_user_id: sanjayId,
        payee_user_id: tutorId,
        amount_cents: 1000,
        method: 'cash',
        paid_at: '2026-10-21T18:00:00.000Z',
      },
    });
    expect(withPayee.status()).toBe(422);

    const tutor = await as('tutor');
    expect((await tutor.request.post('/api/payments', { data: {} })).status()).toBe(403);
    const sessions = await unwrap<any[]>(await tutor.request.get('/api/sessions?limit=5'), 'A’s lessons');
    expect(sessions.every((s: any) => s.paid_directly === false)).toBe(true);
  });

  test('a space that gains an organization follows it from then on', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'spaces');
    const space = spaces.find((s: any) => s.slug === ORGS.d.slug);
    expect(space.business).toBeNull();

    const business = await unwrap<any>(
      await platform.request.post('/api/platform/businesses', {
        data: { name: `Brooks Learning ${Date.now()}`, tin: '88-1234567' },
      }),
      'creating an organization',
    );
    // Never an SSN, here either.
    expect(
      (await platform.request.post('/api/platform/businesses', { data: { name: 'X', tin: '123-45-6789' } })).status(),
    ).toBe(422);

    try {
      await unwrap(
        await platform.request.put(`/api/platform/organizations/${space.id}/business`, {
          data: { business_id: business.id },
        }),
        'linking the space',
      );

      const hannah = await as('soloAdmin', solo);
      const hannahId = await idOf(hannah, PEOPLE.soloAdmin.email);
      const ella = (await unwrap<any[]>(await hannah.request.get('/api/users?search=Ella%20Kim'), 'finding Ella'))[0];
      // Now the family pays the organization, at the student's price -- which Ella does not have.
      const lesson = await hannah.request.post('/api/sessions', {
        data: {
          tutor_user_id: hannahId,
          student_user_id: ella.id,
          occurred_on: OCCURRED_ON,
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
        },
      });
      expect(lesson.status()).toBe(422);
      // Lessons already recorded keep the model they were recorded under.
      const recorded = await unwrap<any[]>(await hannah.request.get('/api/sessions?limit=50'), 'recorded lessons');
      expect(recorded.length).toBeGreaterThan(0);
      expect(recorded.every((s: any) => s.paid_directly === true)).toBe(true);
      // The payer box is the organization's now.
      const settings = await unwrap<any>(await hannah.request.get('/api/organization/settings'), 'settings');
      expect(settings.business.name).toBe(business.name);
      // Linked, it cannot be archived.
      expect((await platform.request.post(`/api/platform/businesses/${business.id}/archive`)).status()).toBe(409);
    } finally {
      await platform.request.put(`/api/platform/organizations/${space.id}/business`, { data: { business_id: null } });
      await platform.request.post(`/api/platform/businesses/${business.id}/archive`);
    }

    const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the platform log');
    expect(audit.some((e: any) => e.action === 'business.created')).toBe(true);
  });

  test('the console lists organizations and which spaces they run', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/platform/organizations');
    const list = platform.getByRole('list', { name: 'Organizations' });
    await expect(list.getByText('Chapel Hill Math Institute', { exact: true })).toBeVisible();
    await expect(list.getByText(/runs Chapel Hill Math Institute/)).toBeVisible();
    await platform.goto('/platform');
    await expect(visible(platform, /paid directly/).first()).toBeVisible();
  });
});

import { expect, test, ORGS, PEOPLE } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 54 (docs/tutor-spaces-plan.md): a space where families pay each tutor is
 * PAID DIRECTLY. Families pay each lesson's tutor; a lesson is one price; nobody
 * takes a cut; payments name the tutor who received them; there are no
 * payments to tutors and no 1099s. A space that collects its payments works as it
 * always has. Rule R24 in docs/data-exposure.md.
 *
 * Phase 59 (docs/spaces-plan.md, S2): who families pay is the space's PAYMENT
 * MODEL, chosen in the console's space dialog (`PUT .../payment-model`), and the
 * payer details are the space's own (one payer record per space, never shared).
 * Phase 54's business routes stay for app builds already on phones.
 *
 * Serial: one test switches the seeded space `solo` to collect payments and
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

  test('a space that collects its payments works as before', async ({ as }) => {
    const admin = await as('admin');
    const settings = await unwrap<any>(await admin.request.get('/api/organization/settings'), 'A’s settings');
    expect(settings.business?.name).toBe('Chapel Hill Math Institute');
    expect(settings.tin).toBe('47-2019388');

    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const anitaId = await idOf(admin, PEOPLE.parent.email);
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    // A family pays the space here, never a tutor.
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

  test('a space set to collect payments follows it from then on, with its own payer details', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'spaces');
    const space = spaces.find((s: any) => s.slug === ORGS.d.slug);
    const chmi = spaces.find((s: any) => s.slug === ORGS.a.slug);
    expect(space.business).toBeNull();
    expect(space.payer).toBeNull();
    // The console reads a collecting space's own payer details, keyed by the space.
    expect(chmi.business.id).toBe(chmi.id);
    expect(chmi.payer).toMatchObject({ name: ORGS.a.name, tin: '47-2019388' });

    const model = (value: string) =>
      platform.request.put(`/api/platform/organizations/${space.id}/payment-model`, { data: { model: value } });
    // Payer details belong to a space that collects: none to edit while families pay each tutor.
    const early = await platform.request.patch(`/api/platform/organizations/${space.id}`, { data: { tin: '88-1234567' } });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.code).toBe('paid_directly');
    expect((await model('nobody')).status()).toBe(422);

    try {
      const collecting = await unwrap<any>(await model('space'), 'the space collects');
      // Its OWN payer record: the space's id, named after it.
      expect(collecting.business).toEqual({ id: space.id, name: space.name });

      // The payer details travel on the space; never an SSN.
      expect(
        (await platform.request.patch(`/api/platform/organizations/${space.id}`, { data: { tin: '123-45-6789' } })).status(),
      ).toBe(422);
      await unwrap(
        await platform.request.patch(`/api/platform/organizations/${space.id}`, {
          data: { payer_name: 'Brooks Learning LLC', tin: '88-1234567', payer_city: 'Raleigh', payer_state: 'nc' },
        }),
        'payer details',
      );
      const listed = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'spaces again'))
        .find((s: any) => s.slug === ORGS.d.slug);
      expect(listed.payer).toMatchObject({ name: 'Brooks Learning LLC', tin: '88-1234567', payer_city: 'Raleigh', payer_state: 'NC' });

      const hannah = await as('soloAdmin', solo);
      const hannahId = await idOf(hannah, PEOPLE.soloAdmin.email);
      const ella = (await unwrap<any[]>(await hannah.request.get('/api/users?search=Ella%20Kim'), 'finding Ella'))[0];
      // Now the family pays the space, at the student's price -- which Ella does not have.
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
      // The Space page shows the space's own details, editable by its admins.
      const settings = await unwrap<any>(await hannah.request.get('/api/organization/settings'), 'settings');
      expect(settings).toMatchObject({ business: { id: space.id, name: 'Brooks Learning LLC' }, tin: '88-1234567' });
      await hannah.goto('/organization');
      await expect(hannah.getByTestId('space-business-name')).toContainText('Brooks Learning LLC');
      await expect(hannah.getByLabel(/Payer TIN/)).toHaveValue('88-1234567');
      await expect(hannah.getByText(/organization/i)).toHaveCount(0);

      // Phase 54's routes still answer for older apps, and never share a payer record.
      const businesses = await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'older app list');
      expect(businesses.find((b: any) => b.id === space.id)?.spaces.map((x: any) => x.slug)).toEqual([ORGS.d.slug]);
      const shared = await platform.request.put(`/api/platform/organizations/${space.id}/business`, {
        data: { business_id: chmi.id },
      });
      expect(shared.status()).toBe(409);
      expect((await shared.json()).error.code).toBe('shared_payer');
      // A payer record in use cannot be archived.
      expect((await platform.request.post(`/api/platform/businesses/${space.id}/archive`)).status()).toBe(409);
    } finally {
      await unwrap(await model('direct'), 'families pay each tutor again');
    }

    const back = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'after'))
      .find((s: any) => s.slug === ORGS.d.slug);
    expect(back.business).toBeNull();
    // Switching to the model it is on already changes nothing, and logs nothing.
    await unwrap(await model('direct'), 'no change');

    const hannah = await as('soloAdmin', solo);
    const log = await unwrap<any[]>(await hannah.request.get('/api/audit?limit=30'), 'the space’s log');
    const switches = log.filter((e: any) => e.action === 'organization.business_set' || e.action === 'organization.business_cleared');
    expect(switches.slice(0, 2).map((e: any) => e.description)).toEqual([
      `Set ${ORGS.d.name} so families pay each tutor directly from now on`,
      `Set ${ORGS.d.name} to collect its families’ payments from now on`,
    ]);
    // Never a TIN in the log: only which payer fields changed.
    expect(JSON.stringify(log)).not.toContain('88-1234567');
  });

  test('the console has no separate payer records: a space’s dialog says who families pay', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/platform');
    await expect(platform.getByRole('link', { name: 'Organizations' })).toHaveCount(0);
    await expect(visible(platform, /families pay each tutor/).first()).toBeVisible();
    await expect(visible(platform, /families pay the space/).first()).toBeVisible();
    // An old link to the Organizations tab lands on the spaces.
    await platform.goto('/platform/organizations');
    await expect(platform).toHaveURL(/\/platform$/);

    await platform.getByRole('button', { name: `Edit ${ORGS.d.name}` }).click();
    const dialog = platform.getByRole('dialog');
    const who = dialog.getByRole('radiogroup', { name: 'Who families pay' });
    await expect(who.getByRole('radio', { name: /Each tutor, directly/ })).toBeChecked();
    await expect(dialog.getByTestId('org-payer')).toHaveCount(0);
    await expect(dialog.getByText(/organization/i)).toHaveCount(0);
    await platform.keyboard.press('Escape');

    await platform.getByRole('button', { name: `Edit ${ORGS.a.name}` }).click();
    const chmi = platform.getByRole('dialog');
    await expect(chmi.getByRole('radio', { name: /The space/ })).toBeChecked();
    await expect(chmi.getByLabel(/Payer TIN/)).toHaveValue('47-2019388');
  });
});

/**
 * Phase 59, S2, in a space this test makes for itself (so nothing seeded moves): a switch of who
 * families pay is logged in the space's own words, recorded lessons keep the model they were recorded
 * under, and the Space page shows the space's own payer details to its admins.
 */
test.describe('S2: a space’s own payer details, in a space of its own', () => {
  test('a switch is logged, lessons keep their model, and the Space page shows the space’s own details', async ({ as }) => {
    const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    const slug = `s2-ledger-${tag}`;
    const name = `S2 Ledger ${tag}`;
    const email = (who: string) => `s2.${who}.${tag}@gmail.com`;

    const platform = await as('platformAdmin', { org: null });
    const space = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: { name, short_name: 'S2 Ledger', slug, payment_model: 'direct' },
      }),
      'making the space, families paying each tutor',
    );
    expect(space.business).toBeNull();
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${space.id}/admins`, {
        data: { email: email('admin'), full_name: `Avery Ledger ${tag}` },
      }),
      'its admin',
    );
    const invited = await as('admin', { email: email('admin'), org: null });
    expect((await invited.request.post(`/api/auth/invitations/${slug}/accept`)).ok()).toBe(true);

    const admin = await as('admin', { email: email('admin'), org: slug });
    // A new admin meets the welcome wizard (Phase 26), which would sit over the Space page.
    await unwrap(await admin.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    const tutor = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { email: email('tutor'), full_name: `Toni Ledger ${tag}`, roles: ['tutor'] },
      }),
      'a tutor',
    );
    const parent = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { email: email('parent'), full_name: `Pat Ledger ${tag}`, roles: ['parent'] },
      }),
      'a parent',
    );
    const student = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: `Sky Ledger ${tag}`,
          roles: ['student'],
          // The family's price: read only once the space collects.
          student_profile: { charge_rate_in_person_cents: 9000 },
          guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a student',
    );
    await unwrap(
      await admin.request.post('/api/assignments', {
        data: { tutor_user_id: tutor.id, student_user_id: student.id, rate_in_person_cents: 6000, is_active: true },
      }),
      'the pairing',
    );
    const record = (occurred_on: string) =>
      admin.request.post('/api/sessions', {
        data: {
          tutor_user_id: tutor.id,
          student_user_id: student.id,
          occurred_on,
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
        },
      });

    // Families pay each tutor: one price, the pairing's.
    const direct = await unwrap<any>(await record('2026-10-12'), 'a lesson paid directly');
    expect(direct).toMatchObject({ paid_directly: true, tutor_rate_cents: 6000, charge_rate_cents: 6000 });
    await admin.goto('/organization');
    await expect(visible(admin, 'Families pay each tutor directly')).toBeVisible();
    await expect(admin.getByTestId('space-business-name')).toHaveCount(0);
    // No payer details to edit while families pay each tutor.
    const early = await admin.request.patch('/api/organization/settings', { data: { tin: '64-1230987' } });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.code).toBe('paid_directly');

    const model = (value: 'space' | 'direct') =>
      platform.request.put(`/api/platform/organizations/${space.id}/payment-model`, { data: { model: value } });
    const collecting = await unwrap<any>(await model('space'), 'the space collects');
    expect(collecting.business).toEqual({ id: space.id, name });

    // From now on the family pays the space, at the student's price.
    const viaSpace = await unwrap<any>(await record('2026-10-13'), 'a lesson the space collects');
    expect(viaSpace).toMatchObject({ paid_directly: false, tutor_rate_cents: 6000, charge_rate_cents: 9000 });
    const lessons = async () =>
      new Map(
        (await unwrap<any[]>(await admin.request.get(`/api/sessions?student_user_id=${student.id}`), 'the lessons'))
          .map((s: any) => [s.id, s.paid_directly]),
      );
    // The lesson recorded before keeps its model.
    expect(await lessons()).toEqual(new Map([[direct.id, true], [viaSpace.id, false]]));

    // The space's admins keep its own payer details, which the console reads too.
    await unwrap(
      await admin.request.patch('/api/organization/settings', {
        data: { tin: '64-1230987', payer_address_line1: '9 Ledger Lane', payer_city: 'Wake Forest' },
      }),
      'the space’s payer details',
    );
    expect(
      (await admin.request.patch('/api/organization/settings', { data: { tin: '123-45-6789' } })).status(),
    ).toBe(422);
    const seen = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the console'))
      .find((s: any) => s.id === space.id);
    expect(seen.payer).toMatchObject({ name, tin: '64-1230987', payer_city: 'Wake Forest' });
    await unwrap(
      await platform.request.patch(`/api/platform/organizations/${space.id}`, { data: { payer_name: `Ledger Payer ${tag} LLC` } }),
      'the name on the 1099, from the console',
    );

    await admin.goto('/organization');
    await expect(admin.getByTestId('space-business-name')).toContainText(`Ledger Payer ${tag} LLC`);
    const payerForm = admin.getByRole('form', { name: '1099 payer details' });
    await expect(payerForm.getByLabel(/Payer TIN/)).toHaveValue('64-1230987');
    await expect(payerForm.getByLabel('City')).toHaveValue('Wake Forest');
    await expect(admin.getByTestId('paid-directly-card')).toHaveCount(0);
    await expect(admin.getByText(/organization/i)).toHaveCount(0);
    // Edited on the Space page, it reaches the console.
    await payerForm.getByLabel('City').fill('Rolesville');
    await payerForm.getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () =>
      (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the console'))
        .find((s: any) => s.id === space.id)?.payer?.payer_city,
    ).toBe('Rolesville');

    // The payer details are the space's admins' alone: a family never reads the TIN.
    const family = await as('parent', { email: email('parent'), org: slug });
    expect((await family.request.get('/api/organization/settings')).status()).toBe(403);

    // Back to each tutor: the lesson the space collected stays the space's.
    expect((await unwrap<any>(await model('direct'), 'families pay each tutor again')).business).toBeNull();
    const backToDirect = await unwrap<any>(await record('2026-10-14'), 'a lesson paid directly again');
    expect(backToDirect.paid_directly).toBe(true);
    expect(await lessons()).toEqual(
      new Map([[direct.id, true], [viaSpace.id, false], [backToDirect.id, true]]),
    );

    // Both switches are in the space's log, in its words, with no TIN.
    const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=50'), 'the space’s log');
    const switches = log.filter((e: any) => e.action === 'organization.business_set' || e.action === 'organization.business_cleared');
    expect(switches.map((e: any) => e.description)).toEqual([
      `Set ${name} so families pay each tutor directly from now on`,
      `Set ${name} to collect its families’ payments from now on`,
    ]);
    expect(JSON.stringify(log)).not.toContain('64-1230987');
    await admin.goto('/activity');
    await expect(visible(admin, 'Families pay tutors directly').first()).toBeVisible();
    await expect(visible(admin, 'Space collects payments').first()).toBeVisible();
    await expect(admin.getByText(/organization/i)).toHaveCount(0);

    await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/archive`), 'tidying away');
  });
});

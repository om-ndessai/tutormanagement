import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * A tutor's mailing address is recorded on their profile and printed as the
 * recipient's address on their 1099-NEC. Only the office and the tutor may
 * read it back.
 *
 * The seed gives Alex "88 Kildaire Farm Road, Apt 12, Cary, NC 27513", and
 * leaves some tutors without one.
 */
const ALEX_STREET = '88 Kildaire Farm Road';

test.describe('a tutor’s mailing address', () => {
  test('fills the 1099 and the year-end sheet', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);
    const year = new Date().getFullYear();

    const status = await unwrap<any[]>(
      await admin.request.get(`/api/payments/tax-status?year=${year}`),
      'tax status',
    );
    const alex = status.find((row) => row.user_id === alexId);
    expect(alex.address).toEqual({
      address_line1: ALEX_STREET,
      address_line2: 'Apt 12',
      city: 'Cary',
      state: 'NC',
      postal_code: '27513',
    });

    const csv = await (await admin.request.get(`/api/payments/tax-summary.csv?year=${year}`)).text();
    expect(csv).toContain('Street address');
    expect(csv).toContain(ALEX_STREET);

    await admin.goto('/?tab=finance');
    const row = admin
      .locator('li')
      .filter({ hasText: PEOPLE.tutor.name })
      .filter({ hasText: /paid in \d{4}|Nothing paid in \d{4}/ })
      .first();
    await expect(row.getByText(/No full address/)).toHaveCount(0);
    await row.getByRole('button', { name: '1099-NEC' }).click();

    const address = admin.getByRole('dialog').getByLabel(/Recipient.s address/);
    await expect(address).toHaveValue(`${ALEX_STREET}\nApt 12\nCary, NC 27513`);

    // A tutor with nothing recorded is flagged on the panel.
    await admin.keyboard.press('Escape');
    await expect(admin.getByText(/No full address/).first()).toBeVisible();
  });

  test('is seen by the office and the tutor, and nobody else', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);

    const own = await unwrap<any>(await (await as('tutor')).request.get(`/api/users/${alexId}`), 'own record');
    expect(own.tutor_profile.address_line1).toBe(ALEX_STREET);

    // Anita's son is not Alex's student, so she may not see Alex at all; Sofia
    // is, and a colleague who also parents is another kind of reader.
    for (const who of ['student', 'parentTutor', 'studentTutor'] as const) {
      const response = await (await as(who)).request.get(`/api/users/${alexId}`);
      if (response.status() === 404) continue;

      const record = (await response.json()).data;
      for (const field of ['address_line1', 'address_line2', 'city', 'state', 'postal_code']) {
        expect(record.tutor_profile?.[field] ?? null, `${who} reading ${field}`).toBeNull();
      }
    }
  });

  test('rejects a state or ZIP a 1099 could not use', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);
    const before = await unwrap<any>(await admin.request.get(`/api/users/${alexId}`), 'record');

    for (const bad of [{ state: 'North Carolina' }, { postal_code: '2751' }, { postal_code: 'ABCDE' }]) {
      const response = await admin.request.patch(`/api/users/${alexId}`, {
        data: { tutor_profile: { ...before.tutor_profile, ...bad } },
      });
      expect(response.status(), JSON.stringify(bad)).toBe(422);
    }

    // A lower-case state is accepted and stored as the code.
    const saved = await unwrap<any>(
      await admin.request.patch(`/api/users/${alexId}`, {
        data: { tutor_profile: { ...before.tutor_profile, state: 'nc' } },
      }),
      'saving a lower-case state',
    );
    expect(saved.tutor_profile.state).toBe('NC');
  });
});

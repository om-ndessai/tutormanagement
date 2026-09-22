import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Most students are children who have no email address and never sign in --
 * their parents read their dashboard from their own login. The directory has
 * to hold them without inventing an address for them.
 */
test.describe('people without an email address', () => {
  test('a child can be added with none, and more than one of them', async ({ as }) => {
    const admin = await as('admin');
    const guardianId = await idOf(admin, PEOPLE.parent.email);
    const guardians = [
      { guardian_user_id: guardianId, relationship: 'mother' as const, is_primary: true },
    ];

    const first = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { full_name: 'Nima Patel', email: '', roles: ['student'], guardians },
      }),
      'adding a child with no email',
    );
    expect(first.email).toBeNull();

    // A second one must not collide with the first: absence is not a value.
    const second = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { full_name: 'Rafi Patel', email: '', roles: ['student'], guardians },
      }),
      'adding a second child with no email',
    );
    expect(second.email).toBeNull();

    // Tidy up so the roster the other specs assert on is unchanged.
    for (const id of [first.id, second.id]) {
      await admin.request.delete(`/api/users/${id}?hard=true`);
    }
  });

  test('anyone who signs in still needs one', async ({ as }) => {
    const admin = await as('admin');

    for (const roles of [['tutor'], ['parent'], ['admin'], ['student', 'tutor']]) {
      const response = await admin.request.post('/api/users', {
        data: { full_name: `No Address ${roles.join('+')}`, email: '', roles },
      });
      expect(response.status(), `${roles.join('+')} must require an email`).toBe(422);
      expect(await response.text()).toContain('required for anyone who signs in');
    }
  });

  test('a role change cannot strand somebody without a way in', async ({ as }) => {
    const admin = await as('admin');
    const guardianId = await idOf(admin, PEOPLE.parent.email);

    const child = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: 'Esme Patel',
          email: '',
          roles: ['student'],
          guardians: [
            { guardian_user_id: guardianId, relationship: 'mother' as const, is_primary: true },
          ],
        },
      }),
      'adding a child',
    );

    // Making them a tutor without giving them an address has to fail...
    const refused = await admin.request.patch(`/api/users/${child.id}`, {
      data: { roles: ['student', 'tutor'] },
    });
    expect(refused.status()).toBe(422);

    // ...and succeed when the address comes with it.
    const allowed = await admin.request.patch(`/api/users/${child.id}`, {
      data: { roles: ['student', 'tutor'], email: 'esme.patel@gmail.com' },
    });
    expect(allowed.status()).toBe(200);

    await admin.request.delete(`/api/users/${child.id}?hard=true`);
  });

  test('the directory says "No email" rather than showing a made-up one', async ({ as }) => {
    const admin = await as('admin');

    await admin.goto('/users');
    await admin.getByPlaceholder(/Search/i).first().fill('Ben Whitfield');
    await expect(visible(admin, 'No email').first()).toBeVisible();

    // Never a mailto pointing at nothing.
    await expect(admin.locator('a[href="mailto:null"], a[href="mailto:"]')).toHaveCount(0);
  });
});

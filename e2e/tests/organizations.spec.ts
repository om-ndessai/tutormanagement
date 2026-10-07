import { ORGS, PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';

/**
 * Belonging to several organizations (docs/multi-organization.md): choosing
 * one after sign-in, switching, each tab in its own, invitations, the
 * shared-field lock, and suspension that is per organization.
 */
test.describe('people in several organizations', () => {
  test('somebody in two organizations chooses, and each wears its own look', async ({ as }) => {
    const priya = await as('admin', { org: null });
    await priya.goto('/');

    await expect(priya).toHaveURL(/\/select-organization$/);
    await expect(priya.getByRole('heading', { name: 'Choose an organization' })).toBeVisible();
    await expect(priya.getByRole('button', { name: /^Chapel Hill Math Institute.*Admin · Tutor/ })).toBeVisible();
    await expect(priya.getByRole('button', { name: /^Riverside Tutoring.*Tutor/ })).toBeVisible();

    await priya.getByRole('button', { name: /^Riverside Tutoring/ }).click();
    await expect(priya).toHaveURL(/\/$/);
    await expect(priya.locator('html')).toHaveAttribute('data-palette', 'teal');
    await expect(priya).toHaveTitle(/Riverside/);

    // A tutor here: no Users-wide admin powers, no Organization page.
    await expect(priya.getByRole('link', { name: 'Organization' })).toHaveCount(0);
    const session = await unwrap<any>(await priya.request.get('/api/auth/session', {
      headers: { 'X-Organization': ORGS.b.slug },
    }), 'session in B');
    expect(session.user.roles).toEqual(['tutor']);
  });

  test('the sign-in page wears the address, never the organization last used', async ({ as }) => {
    // This browser was last in Riverside. The shared address's sign-in page
    // still shows the neutral platform look: an organization's logo and
    // colours appear only once someone signs in and enters it.
    const priya = await as('admin', { org: ORGS.b.slug });
    const config = await unwrap<any>(await priya.request.get('/api/auth/config'), 'config');
    expect(config.brand.name).toBe('Tutor Portal');
    expect(config.brand.palette).toBe('platform');

    // Signed in but not yet in one: still the platform's look.
    const choosing = await as('admin', { org: null });
    await choosing.goto('/select-organization');
    await expect(choosing.getByRole('heading', { name: 'Choose an organization' })).toBeVisible();
    await expect(choosing.locator('html')).toHaveAttribute('data-palette', 'platform');
  });

  test('the switcher moves this tab, and another tab stays where it was', async ({ as }) => {
    const priya = await as('admin');
    await priya.goto('/');
    await expect(priya.locator('html')).toHaveAttribute('data-palette', 'indigo');

    const other = await priya.context().newPage();
    await other.goto('/');
    await expect(other.locator('html')).toHaveAttribute('data-palette', 'indigo');

    await priya.getByTestId('org-switcher').first().click();
    await priya.getByRole('menuitem', { name: /Riverside Tutoring/ }).click();
    await expect(priya.locator('html')).toHaveAttribute('data-palette', 'teal');

    // The second tab keeps working in A, as A's admin.
    await other.goto('/users');
    await expect(other.locator('html')).toHaveAttribute('data-palette', 'indigo');
    await expect(other.getByText('Everyone at Chapel Hill Math Institute')).toBeVisible();
  });

  test('adding an existing person invites them, and only they can accept', async ({ as }) => {
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });

    // Grace is a parent in A only. Riverside adds her by email and she is
    // INVITED: she accepts before Riverside's admin or anybody there can treat
    // her as a member. (A brand-new person takes the status the admin chose,
    // so the admin can tell the two apart -- the documented price of asking
    // consent; docs/multi-organization.md.)
    const created = await rosa.request.post('/api/users', {
      data: {
        full_name: 'Typed by Riverside',
        email: 'grace.lee.nc@gmail.com',
        roles: ['parent'],
      },
    });
    expect(created.status()).toBe(201);
    const invited = (await created.json()).data;
    expect(invited.status).toBe('invited');

    const fresh = await rosa.request.post('/api/users', {
      data: { full_name: 'Brand New', email: 'brand.new.parent@gmail.com', roles: ['parent'] },
    });
    expect(fresh.status()).toBe(201);
    expect((await fresh.json()).data.status).toBe('active');

    // Her shared name was not overwritten by what Riverside typed.
    expect(invited.full_name).toBe('Grace Lee');

    // Until she accepts she cannot enter Riverside, and A is untouched.
    const grace = await as('parent', { email: 'grace.lee.nc@gmail.com', org: null });
    await grace.goto('/select-organization');
    await expect(grace.getByRole('region', { name: 'Invitations' }).getByText('Riverside Tutoring')).toBeVisible();
    expect(
      (await grace.request.get('/api/users', { headers: { 'X-Organization': ORGS.b.slug } })).status(),
    ).toBe(403);

    await grace.getByRole('button', { name: 'Accept' }).click();
    await expect(grace.getByText('You have joined Riverside Tutoring.')).toBeVisible();
    await expect(grace.getByRole('button', { name: /^Riverside Tutoring/ })).toBeVisible();
    expect(
      (await grace.request.get('/api/dashboard', { headers: { 'X-Organization': ORGS.b.slug } })).status(),
    ).toBe(200);
  });

  test('a person in two organizations has shared fields only the platform changes', async ({ as }) => {
    const admin = await as('admin');
    const anitaId = await idOf(admin, PEOPLE.parent.email);

    const detail = await unwrap<any>(await admin.request.get(`/api/users/${anitaId}`), 'Anita in A');
    expect(detail.shared_fields_locked).toBe(true);

    const refused = await admin.request.patch(`/api/users/${anitaId}`, { data: { phone: '(919) 555-0000' } });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error.code).toBe('shared_fields_locked');

    // Sending her record back unchanged is no edit, and is not refused.
    const same = await admin.request.patch(`/api/users/${anitaId}`, {
      data: { full_name: detail.full_name, phone: detail.phone, email: detail.email },
    });
    expect(same.status()).toBe(200);

    await admin.goto('/users?search=Anita');
    await admin.getByRole('button', { name: 'Actions for Anita Patel' }).filter({ visible: true }).first().click();
    await admin.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(admin.getByTestId('shared-fields-locked')).toBeVisible();
    await expect(admin.getByLabel('Full name')).toBeDisabled();

    // The platform admin can, and the change shows in both organizations.
    const platform = await as('platformAdmin', { org: null });
    const person = await unwrap<any>(
      await platform.request.get(`/api/platform/people?email=${encodeURIComponent(PEOPLE.parent.email)}`),
      'lookup',
    );
    expect(person.organization_count).toBe(2);
    await unwrap(
      await platform.request.patch(`/api/platform/people/${person.id}`, { data: { phone: '(919) 555-0101' } }),
      'platform correcting the phone',
    );
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const inB = await unwrap<any>(await rosa.request.get(`/api/users/${anitaId}`), 'Anita in B');
    expect(inB.phone).toBe('(919) 555-0101');
  });

  test('suspending someone in one organization leaves the other alone', async ({ as }) => {
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const alexId = await idOf(rosa, PEOPLE.tutor.email);

    await unwrap(
      await rosa.request.patch(`/api/users/${alexId}`, { data: { status: 'suspended' } }),
      'suspending Alex in B',
    );

    const alexInB = await as('tutor', { org: ORGS.b.slug });
    const refused = await alexInB.request.get('/api/dashboard');
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('account_suspended');

    const alexInA = await as('tutor');
    expect((await alexInA.request.get('/api/dashboard')).status()).toBe(200);
    const session = await unwrap<any>(await alexInA.request.get('/api/auth/session', {
      headers: { 'X-Organization': ORGS.a.slug },
    }), 'Alex in A');
    expect(session.user.status).toBe('active');
  });
});

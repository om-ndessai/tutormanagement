import { ORGS, PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

/**
 * Belonging to several organizations (docs/multi-organization.md): choosing
 * one after sign-in, switching, each tab in its own, invitations, the
 * shared-field lock, and suspension that is per organization.
 */
test.describe('people in several organizations', () => {
  test('somebody in two organizations chooses, and each wears its own look', async ({ as }) => {
    const priya = await as('admin', { org: null });
    // Phase 60: an arriving tab lands in the last space opened; with none, the selector.
    await priya.request.put('/api/auth/default-organization', { data: { slug: null } });
    await priya.goto('/');

    await expect(priya).toHaveURL(/\/spaces$/);
    await expect(priya.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
    await expect(priya.getByRole('button', { name: /^Chapel Hill Math Institute.*Admin · Tutor/ })).toBeVisible();
    await expect(priya.getByRole('button', { name: /^Riverside Tutoring.*Tutor/ })).toBeVisible();

    await priya.getByRole('button', { name: /^Riverside Tutoring/ }).click();
    await expect(priya).toHaveURL(/\/$/);
    await expect(priya.locator('html')).toHaveAttribute('data-palette', 'teal');
    await expect(priya).toHaveTitle(/Riverside/);

    // A tutor here: no Users-wide admin powers, no Organization page.
    await expect(priya.getByRole('link', { name: 'Space settings' })).toHaveCount(0);
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
    expect(config.brand.name).toBe('Aimtrue');
    expect(config.brand.palette).toBe('platform');

    // Signed in but not yet in one: still the platform's look.
    const choosing = await as('admin', { org: null });
    await choosing.request.put('/api/auth/default-organization', { data: { slug: null } });
    // The old picker's address leads to the Spaces page, shown as the selector.
    await choosing.goto('/select-organization');
    await expect(choosing).toHaveURL(/\/spaces$/);
    await expect(choosing.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
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

    // Phase 51: until she accepts, Riverside sees only what it typed -- and her own record, in A,
    // is untouched by it.
    expect(invited).toMatchObject({ full_name: 'Typed by Riverside', phone: null });
    const inA = await unwrap<any[]>(await (await as('admin')).request.get('/api/users?search=grace.lee'), 'Grace in A');
    expect(inA[0].full_name).toBe('Grace Lee');

    // Until she accepts she cannot enter Riverside, and A is untouched.
    const grace = await as('parent', { email: 'grace.lee.nc@gmail.com', org: null });
    await grace.goto('/select-organization');
    await expect(grace.getByRole('region', { name: 'Invitations' }).getByText('Riverside Tutoring')).toBeVisible();
    expect(
      (await grace.request.get('/api/users', { headers: { 'X-Organization': ORGS.b.slug } })).status(),
    ).toBe(403);

    // Phase 60 (S6): accepting enters the space at once, and it becomes her last choice.
    await grace.getByRole('button', { name: 'Accept' }).click();
    await expect(grace.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.b.short);
    await expect(grace.locator('html')).toHaveAttribute('data-palette', 'teal');
    const after = await unwrap<any>(await grace.request.get('/api/auth/session'), 'Grace after');
    expect(after.memberships.filter((m: any) => m.is_default).map((m: any) => m.slug)).toEqual([ORGS.b.slug]);
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

/**
 * Phase 60, S9 (docs/spaces-plan.md): what the phase does not change on the web. Two tabs may still
 * sit in two spaces; the landing rule decides only an ARRIVING tab; the remembered-space cookie,
 * the X-Organization header and requireOrg's membership check behave as before. The person and
 * both spaces are made here.
 */
test.describe('per-tab spaces are unchanged (S9)', () => {
  test('two tabs in two spaces; an arrival lands by the rule and moves neither', async ({ page, as }) => {
    const run = `${Date.now()}`;
    const email = `s9.tabs.${run}@example.com`;
    const first = `Heron House ${run}`;
    const second = `Kestrel House ${run}`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: 'Tamsin Tabs',
          birth_month: 4,
          birth_year: 1982,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      'sign up',
    );
    const maker = await as('admin', { email, org: null });
    const a = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name: first } }), 'space one');
    const b = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name: second } }), 'space two');
    // The welcome wizard is not this test's subject.
    for (const slug of [a.slug, b.slug]) {
      await unwrap(
        await maker.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' }, headers: { 'X-Organization': slug } }),
        `wizard in ${slug}`,
      );
    }
    const switcher = (tab: typeof page) => tab.getByTestId('org-switcher').filter({ visible: true }).first();

    // Tab one in the first space; a second tab of the same browser switches to the second.
    const tabA = await as('admin', { email, org: a.slug });
    await tabA.goto('/');
    await expect(switcher(tabA)).toContainText(first);
    const tabB = await tabA.context().newPage();
    await tabB.goto('/');
    await expect(switcher(tabB)).toContainText(first);
    await switcher(tabB).click();
    await tabB.getByRole('menuitem', { name: new RegExp(second) }).click();
    await expect(switcher(tabB)).toContainText(second);

    // Tab one stays in the first, and its own requests still name it.
    const named = tabA.waitForRequest((r) => r.url().includes('/api/') && !!r.headers()['x-organization']);
    await tabA.goto('/users');
    expect((await named).headers()['x-organization']).toBe(a.slug);
    await expect(switcher(tabA)).toContainText(first);
    expect(await tabA.evaluate(() => sessionStorage.getItem('tmi_org'))).toBe(a.slug);
    expect(await tabB.evaluate(() => sessionStorage.getItem('tmi_org'))).toBe(b.slug);

    // An arriving tab lands by the rule: the last space chosen, the second. Neither open tab moves.
    const arriving = await as('admin', { email, org: null });
    await arriving.goto('/');
    await expect(arriving).not.toHaveURL(/\/spaces/);
    await expect(switcher(arriving)).toContainText(second);
    await tabA.reload();
    await expect(switcher(tabA)).toContainText(first);
    await tabB.reload();
    await expect(switcher(tabB)).toContainText(second);

    // The cookie still remembers the browser's last choice and, with sign-in off, stands in for
    // the header; the header still wins; requireOrg still re-checks the membership.
    const cookies = await tabA.context().cookies();
    expect(cookies.find((c) => c.name === 'tmi_last_org')?.value).toBe(b.slug);
    const byCookie = await unwrap<any>(await tabA.request.get('/api/auth/session'), 'session by cookie');
    expect(byCookie.organization?.slug).toBe(b.slug);
    const byHeader = await unwrap<any>(
      await tabA.request.get('/api/auth/session', { headers: { 'X-Organization': a.slug } }),
      'session by header',
    );
    expect(byHeader.organization?.slug).toBe(a.slug);
    expect(byHeader.user.roles).toEqual(['admin']);
    const elsewhere = await tabA.request.get('/api/users', { headers: { 'X-Organization': ORGS.a.slug } });
    expect(elsewhere.status()).toBe(403);
    expect((await elsewhere.json()).error.code).toBe('organization_required');
  });
});

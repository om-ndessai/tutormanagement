import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION, inviteRowRequest, type AuthProvider } from '@tmi/shared';

import { ORGS, PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';

/**
 * Phase 61, S11 (docs/spaces-plan.md): the first sign-in, join or start. An unknown person who
 * signs in with any offered provider goes through About you (age band, terms), then Welcome: Join
 * with a code, or Start a space (adults only). An invited person is not unknown: they skip both and
 * see the selector with their invitation. With sign-up closed, an unknown account is refused.
 *
 * The real providers cannot be reached unattended, so the local Worker takes the suite's fake
 * tokens (AUTH_FAKE_PROVIDERS): `fake:<provider>:<subject>:<email>:<verified>[:<name>]`. They pass
 * through the Worker's own completion (`completeSignIn`), so the sign-up token, the matching and
 * the refusals are the real ones. The web's redirect flows hand the sign-up token to the page in
 * the address's fragment (`#signup=<token>&email&name`): the About you step below is reached that
 * way, the page itself then posts the token to POST /api/auth/signup.
 *
 * Sign-in is off locally, so the browser acts as a person through X-Dev-User (`as(..., { email })`).
 * Every test makes its own people and spaces; nothing here depends on the order of runs.
 */

const PROVIDERS: AuthProvider[] = ['google', 'microsoft', 'apple', 'facebook'];
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const fake = (provider: AuthProvider, subject: string, email: string, name?: string) =>
  `fake:${provider}:${subject}:${email}:1${name ? `:${name}` : ''}`;

/** POST /api/auth/<provider> the way each client sends that provider's token. */
function signInWith(page: Page, provider: AuthProvider, token: string, signup: boolean) {
  const data =
    provider === 'google'
      ? { credential: token }
      : provider === 'facebook'
        ? { access_token: token }
        : { id_token: token };
  return page.request.post(`/api/auth/${provider}`, { data: signup ? { ...data, signup: true } : data });
}

/** An adult made through the API (sign-in off: `dev_email` stands in for a provider). */
async function adultViaApi(page: Page, email: string, name: string) {
  await unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: name,
        birth_year: 1984,
        birth_month: 4,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${email}`,
  );
}

/** About you, through the page: the month, the year, the terms, Continue. */
async function aboutYou(page: Page, signup: { token: string; email: string; name: string }, month: string, year: number) {
  await page.goto(`/signup#${new URLSearchParams({ signup: signup.token, email: signup.email, name: signup.name })}`);
  await expect(page.getByTestId('signup')).toBeVisible();
  await expect(page.getByRole('heading', { name: `Welcome, ${signup.name.split(' ')[0]}` })).toBeVisible();
  await expect(page.getByText(signup.email)).toBeVisible();
  await page.getByTestId('signup-month').click();
  await page.getByRole('option', { name: month, exact: true }).click();
  await page.getByTestId('signup-year').click();
  await page.getByRole('option', { name: String(year), exact: true }).click();
  await page.getByTestId('signup-accept').check();
  await page.getByTestId('signup-submit').click();
  await expect(page.getByTestId('signup')).toHaveCount(0, { timeout: 15_000 });
}

const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

test.describe('S11: the first sign-in, join or start (Phase 61)', () => {
  for (const provider of PROVIDERS) {
    test(`an adult signing in with ${provider} goes through About you and Welcome, starts a space, and lands in it`, async ({
      page,
      as,
    }) => {
      const email = `s11.${provider}.${run}@example.com`;
      const name = `Robin ${provider[0]!.toUpperCase()}${provider.slice(1)}`;
      const token = fake(provider, `s11-${provider}-${run}`, email, name);

      // Unknown, from a client that can sign a newcomer up: a sign-up token, nothing stored yet.
      const started = await unwrap<any>(await signInWith(page, provider, token, true), `${provider}: a newcomer`);
      expect(started.user).toBeUndefined();
      expect(started.signup).toMatchObject({ email, name });
      expect(typeof started.signup.token).toBe('string');
      const nobody = await as('admin', { email, org: null });
      expect((await nobody.request.get('/api/auth/session')).status()).toBe(404);

      // 1. About you, as today.
      await aboutYou(page, started.signup, 'March', 1985);
      const robin = await as('admin', { email, org: null });
      await expect.poll(async () => (await robin.request.get('/api/auth/session')).status()).toBe(200);
      const fresh = await session(robin);
      expect(fresh).toMatchObject({ account: { age_band: 'adult' }, memberships: [], invitations: [], join_requests: [] });
      expect(fresh.user.full_name).toBe(name);

      // The provider's account is theirs from now on: signing in again is a session, not a sign-up.
      const back = await unwrap<any>(await signInWith(robin, provider, token, true), `${provider}: signing in again`);
      expect(back.signup).toBeUndefined();
      expect(back.user.email).toBe(email);

      // 2. Welcome, with the two choices side by side.
      await robin.goto('/');
      await expect(robin).toHaveURL(/\/spaces$/);
      await expect(robin.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
      await expect(robin.getByText('Join a space with its code, or start your own.')).toBeVisible();
      const join = robin.getByTestId('welcome-join');
      const make = robin.getByTestId('welcome-make');
      await expect(join).toBeVisible();
      await expect(make).toBeVisible();
      await expect(join.getByText('Join with a code')).toBeVisible();
      await expect(make.getByText('Start a space')).toBeVisible();
      const [joinBox, makeBox] = [await join.boundingBox(), await make.boundingBox()];
      expect(joinBox && makeBox).toBeTruthy();
      expect(Math.abs(joinBox!.y - makeBox!.y)).toBeLessThan(2);
      expect(makeBox!.x).toBeGreaterThan(joinBox!.x + joinBox!.width - 1);

      // Start a space: name it, then "Invite people" (S12), skipped, then the space itself.
      const spaceName = `Robin household ${provider} ${run}`;
      await robin.getByTestId('welcome-space-name').fill(spaceName);
      await robin.getByTestId('welcome-make-submit').click();
      await expect(robin.getByTestId('invite-step')).toBeVisible({ timeout: 15_000 });
      await robin.getByTestId('invite-skip').click();
      await expect(robin.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
      await expect(robin).not.toHaveURL(/\/spaces/);

      const after = await session(robin);
      expect(after.memberships).toHaveLength(1);
      expect(after.memberships[0]).toMatchObject({ name: spaceName, roles: ['admin'], status: 'active' });
      const slug = after.memberships[0].slug as string;

      // Signing in again with the provider: the space is waiting, and the next arrival lands in it.
      const again = await unwrap<any>(await signInWith(robin, provider, token, true), `${provider}: back again`);
      expect(again.memberships.map((m: any) => m.slug)).toEqual([slug]);
      const arriving = await as('admin', { email, org: null });
      await arriving.goto('/');
      await expect(arriving.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
      await expect(arriving).not.toHaveURL(/\/spaces/);
      await expect(arriving.getByRole('heading', { name: 'Welcome to Aimtrue' })).toHaveCount(0);
    });
  }

  test('a 13-17 sees only “Join with a code”: types it, sees the space, asks, waits on Welcome, withdraws', async ({
    page,
    as,
  }) => {
    // A space to join, made by an adult of this test's own (joining by code is on for a new space).
    const hostEmail = `s11.host.${run}@example.com`;
    await adultViaApi(page, hostEmail, 'Hana Host');
    const hostOutside = await as('admin', { email: hostEmail, org: null });
    const made = await unwrap<any>(
      await hostOutside.request.post('/api/spaces', { data: { name: `Hana’s maths club ${run}` } }),
      'the host makes a space',
    );
    const host = await as('admin', { email: hostEmail, org: made.slug });
    const { code } = await unwrap<any>(await host.request.get('/api/organization/code'), 'its code');
    expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    // A teenager, with Microsoft, through About you.
    const email = `s11.teen.${run}@example.com`;
    const token = fake('microsoft', `s11-teen-${run}`, email, 'Tali Teen');
    const started = await unwrap<any>(await signInWith(page, 'microsoft', token, true), 'a teen at Microsoft');
    await aboutYou(page, started.signup, 'January', new Date().getFullYear() - 15);
    const tali = await as('admin', { email, org: null });
    await expect.poll(async () => (await tali.request.get('/api/auth/session')).status()).toBe(200);
    expect((await session(tali)).account).toMatchObject({ age_band: '13-17' });

    // Welcome: Join with a code alone; starting a space is for adults, and the API agrees.
    await tali.goto('/');
    await expect(tali.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await expect(tali.getByTestId('welcome-join')).toBeVisible();
    await expect(tali.getByTestId('welcome-make')).toHaveCount(0);
    await expect(tali.getByTestId('welcome-space-name')).toHaveCount(0);
    await expect(tali.getByTestId('welcome-adults-only')).toBeVisible();
    expect((await tali.request.post('/api/spaces', { data: { name: 'Tali’s club' } })).status()).toBe(403);

    // Type the code (any old way), see the space's name and mark, then Ask to join.
    await tali.getByTestId('welcome-code').fill(code.toLowerCase().replace('-', ' '));
    await tali.getByTestId('welcome-find').click();
    const found = tali.getByTestId('welcome-found');
    await expect(found).toBeVisible();
    await expect(found).toContainText(`Hana’s maths club ${run}`);
    await expect(found.locator('span[aria-hidden], img').first()).toBeAttached();
    await found.getByTestId('welcome-ask').click();

    // They wait on Welcome, where they can withdraw -- still there after a reload.
    const waiting = tali.getByTestId(`welcome-request-${made.slug}`);
    await expect(waiting).toBeVisible({ timeout: 15_000 });
    await tali.reload();
    await expect(tali.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await expect(waiting).toBeVisible();
    expect((await session(tali)).join_requests).toEqual([
      expect.objectContaining({ slug: made.slug, outcome: null }),
    ]);
    await waiting.getByRole('button', { name: 'Withdraw' }).click();
    await expect(waiting).toHaveCount(0, { timeout: 15_000 });
    expect((await session(tali)).join_requests).toEqual([]);
  });

  test('a student a console space added, with no age given, is not offered Start a space, nor after leaving it', async ({
    page,
    as,
  }) => {
    // The institute adds a student with an email, a seeded parent their guardian. They never gave an age.
    const admin = await as('admin');
    const parentId = await idOf(admin, PEOPLE.parent.email);
    const email = `s11.pupil.${run}@example.com`;
    await unwrap(
      await admin.request.post('/api/users', {
        data: {
          email,
          full_name: 'Pia Pupil',
          roles: ['student'],
          student_profile: {},
          guardians: [{ guardian_user_id: parentId, relationship: 'mother', is_primary: true }],
        },
      }),
      'adding the student',
    );

    const pia = await as('admin', { email, org: null });
    const before = await session(pia);
    expect(before.account).toBeNull();
    expect(before.memberships).toEqual([expect.objectContaining({ slug: ORGS.a.slug, roles: ['student'] })]);

    // The API refuses, and the Spaces page offers only joining, with the adults-only line.
    const refused = await pia.request.post('/api/spaces', { data: { name: `Kid space ${run}` } });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('forbidden');
    await pia.goto('/spaces');
    await expect(pia.getByTestId('welcome-join')).toBeVisible({ timeout: 15_000 });
    await expect(pia.getByTestId('welcome-make')).toHaveCount(0);
    await expect(pia.getByTestId('welcome-adults-only')).toBeVisible();

    // They leave their only space, then sign in again with a provider (sign-up open): still no age, still no.
    await unwrap(await pia.request.post(`/api/spaces/${ORGS.a.slug}/leave`), 'leaving the institute');
    const signedIn = await unwrap<any>(
      await signInWith(page, 'google', fake('google', `s11-pupil-${run}`, email, 'Pia Pupil'), true),
      'the former student signs in',
    );
    expect(signedIn.signup).toBeUndefined();
    const alone = await session(pia);
    expect(alone).toMatchObject({ account: null, memberships: [] });
    const again = await pia.request.post('/api/spaces', { data: { name: `Kid space ${run}` } });
    expect(again.status()).toBe(403);
    expect((await again.json()).error.code).toBe('forbidden');
    await pia.goto('/');
    await expect(pia.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible({ timeout: 15_000 });
    await expect(pia.getByTestId('welcome-join')).toBeVisible();
    await expect(pia.getByTestId('welcome-make')).toHaveCount(0);
    await expect(pia.getByTestId('welcome-adults-only')).toBeVisible();
  });

  test('About you refuses an under-13 who came from a provider, keeps nothing, and they never reach Welcome', async ({
    page,
    as,
  }) => {
    const email = `s11.child.${run}@example.com`;
    const started = await unwrap<any>(
      await signInWith(page, 'google', fake('google', `s11-child-${run}`, email, 'Kit Child'), true),
      'a child at Google',
    );
    await page.goto(`/signup#${new URLSearchParams({ signup: started.signup.token, email, name: 'Kit Child' })}`);
    await page.getByTestId('signup-month').click();
    await page.getByRole('option', { name: 'June', exact: true }).click();
    await page.getByTestId('signup-year').click();
    await page.getByRole('option', { name: String(new Date().getFullYear() - 9), exact: true }).click();
    await page.getByTestId('signup-accept').check();
    await page.getByTestId('signup-submit').click();
    await expect(page.getByTestId('signup-too-young')).toBeVisible();
    // Nothing was stored: the address is still unknown, and never reaches Welcome.
    const kit = await as('admin', { email, org: null });
    expect((await kit.request.get('/api/auth/session')).status()).toBe(404);
  });

  test('a client that does not ask to sign a newcomer up is refused, with every provider, as before', async ({ page }) => {
    for (const provider of PROVIDERS) {
      const email = `s11.refused.${provider}.${run}@example.com`;
      const refused = await signInWith(page, provider, fake(provider, `s11-refused-${provider}-${run}`, email), false);
      expect(refused.status(), provider).toBe(403);
      expect((await refused.json()).error.code, provider).toBe('no_account');
    }
    // And POST /api/auth/signup with no token (nor a dev address) signs nobody up.
    const tokenless = await page.request.post('/api/auth/signup', {
      data: { birth_year: 1980, birth_month: 1, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
    });
    expect(tokenless.status()).toBe(400);
  });

  test('with sign-up closed (SIGNUP_OPEN "false"), an unknown account is refused', async ({ page }) => {
    const config = await unwrap<any>(await page.request.get('/api/auth/config'), 'config');
    test.skip(config.signup_open !== false, 'This Worker runs with SIGNUP_OPEN "true" (.dev.vars); the closed case needs it "false".');
    for (const provider of PROVIDERS) {
      const email = `s11.closed.${provider}.${run}@example.com`;
      const refused = await signInWith(page, provider, fake(provider, `s11-closed-${provider}-${run}`, email), true);
      expect(refused.status(), provider).toBe(403);
      expect((await refused.json()).error.code, provider).toBe('no_account');
    }
    const signup = await page.request.post('/api/auth/signup', {
      data: {
        dev_email: `s11.closed.${run}@example.com`,
        birth_year: 1980,
        birth_month: 1,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    });
    expect(signup.status()).toBe(403);
  });

  for (const provider of PROVIDERS) {
    test(`an invited person signing in with ${provider} never sees About you or Welcome: the selector, with the invitation`, async ({
      page,
      as,
    }) => {
      // A space of this test's own, whose admin invites a new email as a parent (the S12 row).
      const hostEmail = `s11.inviter.${provider}.${run}@example.com`;
      await adultViaApi(page, hostEmail, 'Ines Inviter');
      const outside = await as('admin', { email: hostEmail, org: null });
      const made = await unwrap<any>(
        await outside.request.post('/api/spaces', { data: { name: `Inviter family ${provider} ${run}` } }),
        'the host makes a space',
      );
      const host = await as('admin', { email: hostEmail, org: made.slug });
      const email = `s11.invitee.${provider}.${run}@example.com`;
      const invited = await unwrap<any>(
        await host.request.post('/api/users', {
          data: inviteRowRequest({ email, full_name: 'Ivo Invitee', role: 'parent' }),
        }),
        'the invitation',
      );
      expect(invited.status).toBe('invited');

      // Signing in with the provider: not unknown -- a session, no sign-up token, the invitation waiting.
      const token = fake(provider, `s11-invitee-${provider}-${run}`, email, 'Ivo Invitee');
      const signedIn = await unwrap<any>(await signInWith(page, provider, token, true), `${provider}: the invitee`);
      expect(signedIn.signup).toBeUndefined();
      expect(signedIn.user.email).toBe(email);
      expect(signedIn.memberships).toEqual([]);
      expect(signedIn.invitations.map((i: any) => i.slug)).toEqual([made.slug]);
      // A self-serve space's invitation is never accepted for them, even on a first sign-in.
      expect(signedIn.invitations[0].roles).toEqual(['parent']);
      // About you is not for them: the address has an account.
      const aboutYouAgain = await page.request.post('/api/auth/signup', {
        data: { dev_email: email, birth_year: 1980, birth_month: 1, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
      });
      expect(aboutYouAgain.status()).toBe(409);

      // The browser: the selector with the invitation, never the newcomer's Welcome or About you.
      const ivo = await as('admin', { email, org: null });
      await ivo.goto('/');
      await expect(ivo).toHaveURL(/\/spaces$/);
      await expect(ivo.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
      await expect(ivo.getByRole('heading', { name: 'Welcome to Aimtrue' })).toHaveCount(0);
      await expect(ivo.getByText('Join a space with its code, or start your own.')).toHaveCount(0);
      await expect(ivo.getByTestId('signup')).toHaveCount(0);
      const card = ivo.getByTestId(`invitation-${made.slug}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(`Inviter family ${provider} ${run}`);
      await expect(card).toContainText('Invited as Parent');
      await ivo.goto('/signup');
      await expect(ivo.getByTestId('signup')).toHaveCount(0);

      // Accepting enters the space, with the role they were invited as.
      await ivo.goto('/');
      await ivo.getByTestId(`invitation-${made.slug}`).getByRole('button', { name: 'Accept' }).click();
      await expect(ivo).not.toHaveURL(/\/spaces/, { timeout: 15_000 });
      const after = await session(ivo);
      expect(after.invitations).toEqual([]);
      expect(after.memberships).toEqual([expect.objectContaining({ slug: made.slug, roles: ['parent'], status: 'active' })]);
    });
  }

  /**
   * A space archived under them leaves a person in it with nothing on their session (the session,
   * like the selector, lists live spaces only) and nothing to leave (leaving an archived space is
   * 404). Welcome then offers Delete my account, and the API must agree: an archived space does not
   * count as belonging (S7, S8, S11).
   */
  async function archive(as: (who: any, o?: any) => Promise<Page>, slug: string) {
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the spaces');
    const space = orgs.find((o) => o.slug === slug);
    await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/archive`), `archiving ${slug}`);
  }

  async function deletesFromWelcome(person: Page) {
    const s = await session(person);
    expect(s.memberships).toEqual([]);
    expect(s.invitations).toEqual([]);
    await person.goto('/');
    await expect(person.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await expect(person.getByTestId('welcome-delete-account')).toBeVisible();
    await person.getByTestId('welcome-delete-account').click();
    const deleted = person.waitForResponse((r) => r.url().endsWith('/api/auth/account') && r.request().method() === 'DELETE');
    await person.getByTestId('welcome-delete-confirm').click();
    expect((await deleted).status()).toBe(204);
    await expect(person).toHaveURL(/\/login/, { timeout: 15_000 });
    expect((await person.request.get('/api/auth/session')).status()).toBe(404);
  }

  test('a newcomer whose only space was archived lands on Welcome and can delete the account', async ({ page, as }) => {
    const email = `s11.archived.${run}@example.com`;
    await adultViaApi(page, email, 'Arlo Archived');
    const outside = await as('admin', { email, org: null });
    const made = await unwrap<any>(
      await outside.request.post('/api/spaces', { data: { name: `Archived family ${run}` } }),
      'they start a space',
    );
    await archive(as, made.slug);
    // Leaving it is not a way out: an archived space answers 404.
    expect((await outside.request.post(`/api/spaces/${made.slug}/leave`)).status()).toBe(404);
    await deletesFromWelcome(await as('admin', { email, org: null }));
  });

  test('a person whose only invitation was to a space since archived lands on Welcome and can delete the account', async ({ page, as }) => {
    const hostEmail = `s11.archhost.${run}@example.com`;
    await adultViaApi(page, hostEmail, 'Hana Host');
    const outside = await as('admin', { email: hostEmail, org: null });
    const made = await unwrap<any>(
      await outside.request.post('/api/spaces', { data: { name: `Archived inviter ${run}` } }),
      'the host makes a space',
    );
    const host = await as('admin', { email: hostEmail, org: made.slug });
    const email = `s11.archinvitee.${run}@example.com`;
    const invited = await unwrap<any>(
      await host.request.post('/api/users', { data: inviteRowRequest({ email, full_name: 'Ida Invitee', role: 'parent' }) }),
      'the invitation',
    );
    expect(invited.status).toBe('invited');
    await archive(as, made.slug);
    await deletesFromWelcome(await as('admin', { email, org: null }));
  });
});

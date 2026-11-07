import { test, expect } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';
import type { Page } from '@playwright/test';

/**
 * Older clients (Phase 49's backward-compatibility test, docs/open-signup-plan.md).
 *
 * The phones keep the app build they were given until someone reinstalls it, so the API keeps
 * answering the request shapes older builds send. Each test here is one such shape, named for the
 * release that changed it. Tagged @compat: `npm run test:compat` runs them on the last release's
 * database, migrated by hand, as well as in the full suite.
 */

test.describe('older clients @compat', () => {
  test('Phase 54: a space from before has an organization of its own, and takes payments as before', async ({ as }) => {
    const admin = await as('admin');
    // The backfill gave every existing space a business with its own name and TIN.
    const settings = await unwrap<any>(await admin.request.get('/api/organization/settings'), 'settings');
    expect(settings.business?.name).toBe('Chapel Hill Math Institute');
    expect(settings.tin).toBe('47-2019388');
    // Exactly what a Phase 53 app sends: no payee.
    const balances = await unwrap<any>(await admin.request.get('/api/payments/balances'), 'balances');
    const family = balances.students.find((row: any) => row.guardians.length > 0);
    const payment = await unwrap<any>(
      await admin.request.post('/api/payments', {
        data: {
          direction: 'from_parent',
          party_user_id: family.guardians[0].user_id,
          student_user_id: family.student_user_id,
          amount_cents: 100,
          method: 'cash',
          paid_at: '2026-10-21T18:00:00.000Z',
        },
      }),
      'a payment without a payee',
    );
    expect(payment.payee_user_id).toBeNull();
    expect((await admin.request.delete(`/api/payments/${payment.id}`)).status()).toBe(204);
    const lessons = await unwrap<any[]>(await admin.request.get('/api/sessions?limit=5'), 'lessons');
    expect(lessons.every((s: any) => s.paid_directly === false)).toBe(true);
  });

  test('Phase 46: a game made without the Phase 47 fields is a Phase 46 game', async ({ as }) => {
    const admin = await as('admin');
    const set = (on: boolean) =>
      admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on, canvas_assessments_unreviewed: on } });
    expect((await set(true)).status()).toBe(200);
    try {
      // Exactly what the Phase 46 app sends: level, length, negative marking and team size.
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 2, negative_marking: true, max_team_size: 2 },
        }),
        'a Phase 46 game',
      );
      expect(game).toMatchObject({ status: 'lobby', negative_marking: true });
      expect(game.code).toMatch(/^[A-Z2-9]{6}$/);
      await unwrap(await admin.request.post(`/api/quest/games/${game.id}/end`), 'end');
    } finally {
      await set(false);
    }
  });

  test('Phase 42: an approval still reads as a known way of approving', async ({ as }) => {
    // The console's lists carry approved_via; older builds know 'console' and 'quest' and show
    // nothing for a value they do not know, so a new value is never a crash. This pins the shape.
    const platform = await as('platformAdmin', { org: null });
    const approved = await unwrap<any[]>(await platform.request.get('/api/platform/questions?status=approved&limit=5'), 'approved');
    for (const q of approved) expect(['console', 'quest', 'quest_consensus', null]).toContain(q.approved_via);
  });
});

/**
 * S13 (Phase 61, docs/spaces-plan.md): an app built before Phase 60 still signs in, its star still
 * sets where its person lands, and its leave route (inside the space) still works; and an older
 * app, which never sends `signup: true`, still gets 403 for an unknown account. Each test signs up
 * its own people (`dev_email`, sign-in being off locally) and makes its own spaces, so it runs the
 * same on today's seed and on the last release's database.
 */

const S13_RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const fakeGoogle = (subject: string, email: string) => `fake:google:${subject}:${email}:1`;

async function signUpAdult(page: Page, email: string, name: string) {
  await unwrap(
    await page.request.post('/api/auth/signup', {
      data: { dev_email: email, dev_name: name, birth_year: 1980, birth_month: 6, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
    }),
    `signing up ${email}`,
  );
}

const sessionOf = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
const defaults = async (page: Page) => (await sessionOf(page)).memberships.filter((m: any) => m.is_default).map((m: any) => m.slug);

test.describe('older clients, Phases 60-61 (S13) @compat', () => {
  test('Phase 60: an app from before signs in with Google as it always did, with or without signup', async ({ page, as }) => {
    const email = `oldapp.signin.${S13_RUN}@example.com`;
    await signUpAdult(page, email, 'Olga Oldapp');
    const olga = await as('admin', { email, org: null });
    const space = await unwrap<any>(await olga.request.post('/api/spaces', { data: { name: `Olga Den ${S13_RUN}` } }), 'a space');

    // Exactly what a Phase 52-59 app sends: the credential and signup: true; a Phase 51 app sends the credential alone.
    for (const data of [{ credential: fakeGoogle(`old-${S13_RUN}`, email), signup: true }, { credential: fakeGoogle(`old-${S13_RUN}`, email) }]) {
      const signedIn = await page.request.post('/api/auth/google', { data });
      const session = await unwrap<any>(signedIn, 'an older app signs in');
      // What an older app reads off the answer.
      expect(session.user.email).toBe(email);
      expect(session.signup).toBeUndefined();
      expect(Array.isArray(session.memberships)).toBe(true);
      expect(Array.isArray(session.invitations)).toBe(true);
      expect(typeof session.platform_admin).toBe('boolean');
      expect(session.onboarding).toBeDefined();
      const mine = session.memberships.find((m: any) => m.slug === space.slug);
      expect(mine).toMatchObject({ slug: space.slug, roles: ['admin'], status: 'active' });
      expect(typeof mine.is_default).toBe('boolean');
    }
  });

  test('Phase 60: an older app’s star still sets where its person lands, and clears it', async ({ page, as }) => {
    const email = `oldapp.star.${S13_RUN}@example.com`;
    await signUpAdult(page, email, 'Stella Star');
    const stella = await as('admin', { email, org: null });
    const first = await unwrap<any>(await stella.request.post('/api/spaces', { data: { name: `Stella One ${S13_RUN}` } }), 'first space');
    const second = await unwrap<any>(await stella.request.post('/api/spaces', { data: { name: `Stella Two ${S13_RUN}` } }), 'second space');

    // The star on the second space: PUT /api/auth/default-organization, as the app has always sent it.
    const starred = await stella.request.put('/api/auth/default-organization', { data: { slug: second.slug } });
    expect(starred.status()).toBe(200);
    expect(await starred.json()).toEqual({ data: { default_organization: second.slug } });
    expect(await defaults(stella)).toEqual([second.slug]);
    // An older app lands on the starred one (is_default); so does today's web on arriving.
    const arriving = await as('admin', { email, org: null });
    const secondShort = (await sessionOf(stella)).memberships.find((m: any) => m.slug === second.slug).short_name;
    await arriving.goto('/');
    await expect(arriving).not.toHaveURL(/\/spaces/);
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(secondShort, { timeout: 15_000 });

    // Moving the star moves it; a space they cannot enter is reported as missing.
    await unwrap(await stella.request.put('/api/auth/default-organization', { data: { slug: first.slug } }), 'star the first');
    expect(await defaults(stella)).toEqual([first.slug]);
    const elsewhere = await stella.request.put('/api/auth/default-organization', { data: { slug: `no-such-${S13_RUN}` } });
    expect(elsewhere.status()).toBe(404);
    expect(await defaults(stella)).toEqual([first.slug]);

    // Clearing the star: no last choice, and with two spaces an arriving tab is asked to choose.
    const cleared = await stella.request.put('/api/auth/default-organization', { data: { slug: null } });
    expect(await cleared.json()).toEqual({ data: { default_organization: null } });
    expect(await defaults(stella)).toEqual([]);
    const choosing = await as('admin', { email, org: null });
    await choosing.goto('/');
    await expect(choosing.getByTestId('spaces-page')).toBeVisible({ timeout: 15_000 });
    await expect(choosing.getByTestId(`org-${first.slug}`)).toBeVisible();
    await expect(choosing.getByTestId(`org-${second.slug}`)).toBeVisible();
  });

  test('Phase 60: an older app’s leave route, inside the space, still works; its last admin is still refused', async ({ page, as }) => {
    const ownerEmail = `oldapp.owner.${S13_RUN}@example.com`;
    const memberEmail = `oldapp.member.${S13_RUN}@example.com`;
    await signUpAdult(page, ownerEmail, 'Ottilie Owner');
    await signUpAdult(page, memberEmail, 'Milo Member');
    const ownerHome = await as('admin', { email: ownerEmail, org: null });
    const space = await unwrap<any>(await ownerHome.request.post('/api/spaces', { data: { name: `Ottilie Yard ${S13_RUN}` } }), 'a space');
    const ownerIn = await as('admin', { email: ownerEmail, org: space.slug });
    await unwrap(
      await ownerIn.request.post('/api/users', { data: { full_name: 'Milo', email: memberEmail, roles: ['parent'], status: 'active' } }),
      'invite Milo',
    );
    const milo = await as('admin', { email: memberEmail, org: null });
    await unwrap(await milo.request.post(`/api/auth/invitations/${space.slug}/accept`), 'Milo accepts');
    expect((await sessionOf(milo)).memberships.map((m: any) => m.slug)).toContain(space.slug);

    // Exactly what an older app sends: POST /api/organization/leave, in the space.
    const left = await milo.request.post('/api/organization/leave', { headers: { 'X-Organization': space.slug } });
    expect(left.status()).toBe(200);
    expect(await left.json()).toEqual({ data: { left: true } });
    expect((await sessionOf(milo)).memberships.map((m: any) => m.slug)).not.toContain(space.slug);
    expect((await milo.request.get('/api/users', { headers: { 'X-Organization': space.slug } })).status()).toBe(403);

    // The space's only admin, the same way: refused, and still there.
    const refused = await ownerIn.request.post('/api/organization/leave');
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error.code).toBe('last_admin');
    expect((await sessionOf(ownerHome)).memberships.map((m: any) => m.slug)).toContain(space.slug);
  });

  test('Phase 59: an app built with the 2026-10-29 terms still signs up', async ({ page, as }) => {
    const email = `oldapp.terms.${S13_RUN}@example.com`;
    const old = { dev_email: email, dev_name: 'Tess Oldterms', birth_year: 1980, birth_month: 6 };
    // A version nobody ever published is refused.
    const refused = await page.request.post('/api/auth/signup', {
      data: { ...old, terms_version: '2020-01-01', privacy_version: '2020-01-01' },
    });
    expect(refused.status()).toBe(422);
    // What an app already on a phone sends: the version it was built with.
    await unwrap(
      await page.request.post('/api/auth/signup', { data: { ...old, terms_version: '2026-10-29', privacy_version: '2026-10-29' } }),
      'signing up with the earlier terms',
    );
    // They exist now: as them, the session is theirs.
    const them = await as('parent', { email, org: null });
    expect((await sessionOf(them)).user.email).toBe(email);
  });

  test('Phase 52: POST /api/auth/google without signup: true still gets 403 for an unknown account', async ({ page }) => {
    const email = `oldapp.unknown.${S13_RUN}@example.com`;
    const subject = `unknown-${S13_RUN}`;
    // An older app: no signup field at all, or signup: false.
    for (const data of [{ credential: fakeGoogle(subject, email) }, { credential: fakeGoogle(subject, email), signup: false }]) {
      const refused = await page.request.post('/api/auth/google', { data });
      expect(refused.status()).toBe(403);
      const body = await refused.json();
      expect(body.error.code).toBe('no_account');
      expect(body.data).toBeUndefined();
    }
    // Nothing was made: the address is still unknown, and today's client is offered sign-up instead.
    const today = await unwrap<any>(
      await page.request.post('/api/auth/google', { data: { credential: fakeGoogle(subject, email), signup: true } }),
      'today’s client',
    );
    expect(today.signup).toMatchObject({ email });
    expect(typeof today.signup.token).toBe('string');
    // And the older app, asking again after that, is still refused: being offered sign-up made no account.
    const still = await page.request.post('/api/auth/google', { data: { credential: fakeGoogle(subject, email) } });
    expect(still.status()).toBe(403);
    expect((await still.json()).error.code).toBe('no_account');
  });
});

/**
 * Phase 80 (A11, docs/members-plan.md): a console from before sends `{ access: 'approved' }` alone. Under Post-approved
 * that still leaves the person with exactly one space of their own -- made at the approval now (A10: none at sign-up),
 * at sign-up by the last release's Worker -- so the same request reads the same on both.
 */
test.describe('older consoles, Phase 80 @compat', () => {
  test('Phase 80: an older console’s { access: "approved" } still gives a waiting sign-up a space of its own', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const before = await unwrap<any>(await platform.request.get('/api/platform/access'), 'the console');
    const email = `oldconsole.${S13_RUN}@example.com`;
    await unwrap(await platform.request.put('/api/platform/access', { data: { mode: 'postapproved' } }), 'Post-approved');
    try {
      const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' });
      const waiting = await request.post('/api/auth/signup', {
        data: { dev_email: email, dev_name: 'Opal Oldconsole', birth_year: 1980, birth_month: 6, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION },
      });
      expect(waiting.status()).toBe(403);
      await request.dispose();
      const row = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'the console')).waiting.find(
        (account: any) => account.email === email,
      );
      // Exactly what a Phase 65-79 console sends.
      await unwrap(await platform.request.put(`/api/platform/access/accounts/${row.user_id}`, { data: { access: 'approved' } }), 'approving');

      const opal = await as('admin', { email, org: null });
      const session = await sessionOf(opal);
      expect(session.memberships).toEqual([
        expect.objectContaining({ name: "Opal's space", roles: ['admin'], status: 'active', is_default: true }),
      ]);
      const inIt = await unwrap<any>(
        await opal.request.get('/api/auth/session', { headers: { 'X-Organization': session.memberships[0].slug } }),
        'the session in it',
      );
      expect(inIt.organization).toMatchObject({ personal: true });
    } finally {
      await unwrap(await platform.request.put('/api/platform/access', { data: { mode: before.settings.mode } }), 'the mode put back');
    }
  });
});

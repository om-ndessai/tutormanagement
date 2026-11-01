import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 60 (S8, docs/spaces-plan.md): leaving a space, from anywhere. `POST /api/spaces/:slug/leave`
 * sits outside `requireOrg` and acts on the person's own membership: the last admin is refused
 * (409 `last_admin`), anyone else's membership goes, logged in the space left. Leaving the space a
 * tab is in sends it to the landing rule: the other space, the selector, or Welcome.
 *
 * Every test builds its own people and spaces (newcomers who sign up, make a space, and invite each
 * other), so nothing seeded changes and the order of runs does not matter.
 */

type Space = { slug: string; name: string; short_name: string };

const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
let serial = 0;
const address = (who: string) => `leave.${who}.${run}.${++serial}@example.com`;

const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
const slugs = async (page: Page) => (await session(page)).memberships.map((m: any) => m.slug as string);

/** A newcomer (an adult) signs up; with sign-in off, `dev_email` stands in for the provider. */
async function signUp(page: Page, email: string, name: string) {
  await unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: name,
        birth_year: 1985,
        birth_month: 6,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${email}`,
  );
}

/** The person's welcome wizard there is done, so it does not open over the page. */
async function tourDone(person: Page, slug: string) {
  await unwrap(
    await person.request.post('/api/onboarding/tour', { headers: { 'X-Organization': slug }, data: { outcome: 'skipped' } }),
    `the wizard in ${slug}`,
  );
}

/** The maker of a new space is its one admin. */
async function makeSpace(maker: Page, name: string): Promise<Space> {
  const made = await unwrap<{ slug: string; name: string }>(await maker.request.post('/api/spaces', { data: { name } }), `making ${name}`);
  await tourDone(maker, made.slug);
  const row = (await session(maker)).memberships.find((m: any) => m.slug === made.slug);
  return { slug: made.slug, name: made.name, short_name: row?.short_name ?? made.name };
}

/** The space's admin invites someone who has an account (as a parent); they accept. */
async function inviteAndAccept(admin: Page, space: Space, person: Page, email: string, name: string) {
  await unwrap(
    await admin.request.post('/api/users', {
      headers: { 'X-Organization': space.slug },
      data: { full_name: name, email, roles: ['parent'], status: 'active' },
    }),
    `inviting ${email} to ${space.name}`,
  );
  await unwrap(await person.request.post(`/api/auth/invitations/${space.slug}/accept`), `accepting ${space.name}`);
  await tourDone(person, space.slug);
}

/** A signed-up person, as a page in no space. */
async function newcomer(page: Page, as: (who: 'admin', o: { email: string; org: string | null }) => Promise<Page>, who: string, name: string) {
  const email = address(who);
  await signUp(page, email, name);
  return { email, name, page: await as('admin', { email, org: null }) };
}

const switcher = (page: Page) => page.getByTestId('org-switcher').filter({ visible: true }).first();

async function openSpacesPage(page: Page) {
  await page.goto('/spaces');
  await expect(page.getByTestId('spaces-page')).toBeVisible();
}

async function leaveFromPage(page: Page, space: Space) {
  await page.getByTestId(`space-leave-${space.slug}`).click();
  const confirm = page.getByTestId(`space-leave-confirm-${space.slug}`);
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(`You stop being a member of ${space.name}.`);
  await confirm.getByRole('button', { name: /^Leave / }).click();
}

test.describe('leaving a space, from anywhere (S8)', () => {
  test('leave B from the Spaces page while inside A: A carries on, and B is gone from the switcher', async ({ page, as }) => {
    const lena = await newcomer(page, as, 'lena', 'Lena Leaver');
    const hugo = await newcomer(page, as, 'hugo', 'Hugo Host');
    const a = await makeSpace(lena.page, `Lena home ${run}`);
    const b = await makeSpace(hugo.page, `Hugo club ${run}`);
    await inviteAndAccept(hugo.page, b, lena.page, lena.email, lena.name);

    const inA = await as('admin', { email: lena.email, org: a.slug });
    await inA.goto('/');
    await expect(switcher(inA)).toContainText(a.short_name);
    await switcher(inA).click();
    await expect(inA.getByRole('menuitem', { name: new RegExp(b.name) })).toBeVisible();
    await inA.keyboard.press('Escape');

    await openSpacesPage(inA);
    await expect(inA.getByTestId(`org-${a.slug}`)).toContainText('Here now');
    await expect(inA.getByTestId(`org-${b.slug}`)).toBeVisible();
    await leaveFromPage(inA, b);
    await expect(visible(inA, `You have left ${b.name}.`)).toBeVisible();
    await expect(inA.getByTestId(`org-${b.slug}`)).toHaveCount(0);

    // Still in A, in the portal's frame: the same tab, the same space.
    await expect(inA).toHaveURL(/\/spaces$/);
    await expect(inA.getByTestId(`org-${a.slug}`)).toContainText('Here now');
    await expect(switcher(inA)).toContainText(a.short_name);
    await switcher(inA).click();
    await expect(inA.getByRole('menuitem', { name: new RegExp(a.name) })).toBeVisible();
    await expect(inA.getByRole('menuitem', { name: new RegExp(b.name) })).toHaveCount(0);
    await inA.keyboard.press('Escape');
    await inA.goto('/');
    await expect(switcher(inA)).toContainText(a.short_name);
    expect((await inA.request.get('/api/users', { headers: { 'X-Organization': a.slug } })).status()).toBe(200);

    // The membership is gone: B refuses her, and a second leave finds nothing.
    expect(await slugs(lena.page)).toEqual([a.slug]);
    expect((await lena.page.request.get('/api/users', { headers: { 'X-Organization': b.slug } })).status()).toBe(403);
    expect((await lena.page.request.post(`/api/spaces/${b.slug}/leave`)).status()).toBe(404);

    // Logged in the space left, naming her and nothing else.
    const log = await unwrap<any[]>(
      await hugo.page.request.get('/api/audit?limit=20', { headers: { 'X-Organization': b.slug } }),
      'B’s log',
    );
    const left = log.find((e) => e.action === 'membership.left');
    expect(left).toBeTruthy();
    expect(left.description).toBe(`${lena.name} left ${b.name}`);
    // Not in A's.
    const aLog = await unwrap<any[]>(await lena.page.request.get('/api/audit?limit=20', { headers: { 'X-Organization': a.slug } }), 'A’s log');
    expect(aLog.some((e) => e.action === 'membership.left')).toBe(false);
  });

  test('leave the space the tab is in: the landing rule takes it to the other space', async ({ page, as }) => {
    const kit = await newcomer(page, as, 'kit', 'Kit Current');
    const hugo = await newcomer(page, as, 'host', 'Hana Host');
    const a = await makeSpace(kit.page, `Kit home ${run}`);
    const b = await makeSpace(hugo.page, `Hana club ${run}`);
    await inviteAndAccept(hugo.page, b, kit.page, kit.email, kit.name);

    const inB = await as('admin', { email: kit.email, org: b.slug });
    await inB.goto('/');
    await expect(switcher(inB)).toContainText(b.short_name);
    await openSpacesPage(inB);
    await expect(inB.getByTestId(`org-${b.slug}`)).toContainText('Here now');
    await leaveFromPage(inB, b);

    // One space left and nothing pending: straight into it, not the selector.
    await expect(switcher(inB)).toContainText(a.short_name, { timeout: 15_000 });
    await expect(inB).not.toHaveURL(/\/spaces/);
    await expect(inB.getByRole('heading', { name: 'Choose a space' })).toHaveCount(0);
    expect(await slugs(kit.page)).toEqual([a.slug]);
    // The left space is no one's last choice: an arriving tab lands in A too.
    const arriving = await as('admin', { email: kit.email, org: null });
    await arriving.goto('/');
    await expect(switcher(arriving)).toContainText(a.short_name);
  });

  test('leave the current space with two others left and no last choice: the selector', async ({ page, as }) => {
    const pia = await newcomer(page, as, 'pia', 'Pia Plenty');
    const host = await newcomer(page, as, 'twohost', 'Tom Twohost');
    const a = await makeSpace(pia.page, `Pia home ${run}`);
    const b = await makeSpace(host.page, `Tom one ${run}`);
    const c = await makeSpace(host.page, `Tom two ${run}`);
    await inviteAndAccept(host.page, b, pia.page, pia.email, pia.name);
    await inviteAndAccept(host.page, c, pia.page, pia.email, pia.name);

    const inC = await as('admin', { email: pia.email, org: c.slug });
    await inC.goto('/');
    await expect(switcher(inC)).toContainText(c.short_name);
    await openSpacesPage(inC);
    await leaveFromPage(inC, c);

    await expect(inC.getByRole('heading', { name: 'Choose a space' })).toBeVisible({ timeout: 15_000 });
    await expect(inC.getByTestId(`org-${a.slug}`)).toBeVisible();
    await expect(inC.getByTestId(`org-${b.slug}`)).toBeVisible();
    await expect(inC.getByTestId(`org-${c.slug}`)).toHaveCount(0);
    const me = await session(pia.page);
    expect(me.memberships.map((m: any) => m.slug).sort()).toEqual([a.slug, b.slug].sort());
    expect(me.memberships.filter((m: any) => m.is_default)).toEqual([]);
  });

  test('the last admin is refused, with the reason on screen', async ({ page, as }) => {
    const ada = await newcomer(page, as, 'ada', 'Ada Alone');
    const a = await makeSpace(ada.page, `Ada home ${run}`);

    const refused = await ada.page.request.post(`/api/spaces/${a.slug}/leave`);
    expect(refused.status()).toBe(409);
    const body = await refused.json();
    expect(body.error.code).toBe('last_admin');
    expect(body.error.message).toContain('only administrator');

    const inA = await as('admin', { email: ada.email, org: a.slug });
    await openSpacesPage(inA);
    await leaveFromPage(inA, a);
    const problem = inA.getByTestId(`space-leave-problem-${a.slug}`);
    await expect(problem).toBeVisible();
    await expect(problem).toContainText(`You are ${a.name}'s only administrator.`);
    await expect(problem).toContainText('Make someone else an administrator first, or delete the space.');
    // Nothing changed: still in it, still its admin.
    await expect(inA.getByTestId(`org-${a.slug}`)).toContainText('Here now');
    const me = await session(ada.page);
    expect(me.memberships).toEqual([expect.objectContaining({ slug: a.slug, roles: ['admin'] })]);
  });

  test('a second admin may leave; the one left is then the last', async ({ page, as }) => {
    const host = await newcomer(page, as, 'coadmin-host', 'Cora Host');
    const co = await newcomer(page, as, 'coadmin', 'Cal Coadmin');
    const a = await makeSpace(host.page, `Cora place ${run}`);
    await unwrap(
      await host.page.request.post('/api/users', {
        headers: { 'X-Organization': a.slug },
        data: { full_name: co.name, email: co.email, roles: ['admin'], status: 'active' },
      }),
      'inviting a second admin',
    );
    await unwrap(await co.page.request.post(`/api/auth/invitations/${a.slug}/accept`), 'accepting');
    await unwrap(await co.page.request.post(`/api/spaces/${a.slug}/leave`), 'the second admin leaves');
    expect(await slugs(co.page)).toEqual([]);
    expect((await host.page.request.post(`/api/spaces/${a.slug}/leave`)).status()).toBe(409);
  });

  test('a suspended admin who is not the last admin may leave', async ({ page, as }) => {
    const host = await newcomer(page, as, 'susp-host', 'Sue Host');
    const co = await newcomer(page, as, 'susp-admin', 'Sam Suspended');
    const a = await makeSpace(host.page, `Sue place ${run}`);
    const added = await unwrap<{ id: string }>(
      await host.page.request.post('/api/users', {
        headers: { 'X-Organization': a.slug },
        data: { full_name: co.name, email: co.email, roles: ['admin'], status: 'active' },
      }),
      'inviting a second admin',
    );
    await unwrap(await co.page.request.post(`/api/auth/invitations/${a.slug}/accept`), 'accepting');
    // The space's first admin suspends the second there.
    await unwrap(
      await host.page.request.patch(`/api/users/${added.id}`, {
        headers: { 'X-Organization': a.slug },
        data: { status: 'suspended' },
      }),
      'suspending the second admin',
    );

    // Another admin is active, so the suspended one is not the last: leaving succeeds.
    const left = await co.page.request.post(`/api/spaces/${a.slug}/leave`);
    expect(left.status(), await left.text()).toBe(200);
    expect((await left.json()).data.left).toBe(true);
    expect(await slugs(co.page)).toEqual([]);
    const me = await session(host.page);
    expect(me.memberships).toEqual([expect.objectContaining({ slug: a.slug, roles: ['admin'] })]);
  });

  test('a suspended admin may leave while another admin remains', async ({ page, as }) => {
    const yan = await newcomer(page, as, 'yan', 'Yan Keeper');
    const xia = await newcomer(page, as, 'xia', 'Xia Paused');
    const b = await makeSpace(yan.page, `Yan club ${run}`);
    const own = await makeSpace(xia.page, `Xia home ${run}`);
    const added = await unwrap<{ id: string }>(
      await yan.page.request.post('/api/users', {
        headers: { 'X-Organization': b.slug },
        data: { full_name: xia.name, email: xia.email, roles: ['admin'], status: 'active' },
      }),
      'inviting a second admin',
    );
    await unwrap(await xia.page.request.post(`/api/auth/invitations/${b.slug}/accept`), 'accepting');
    await tourDone(xia.page, b.slug);
    // Y suspends X in B.
    await unwrap(
      await yan.page.request.patch(`/api/users/${added.id}`, {
        headers: { 'X-Organization': b.slug },
        data: { status: 'suspended' },
      }),
      'suspending X',
    );

    const inOwn = await as('admin', { email: xia.email, org: own.slug });
    await inOwn.goto('/');
    await openSpacesPage(inOwn);
    await expect(inOwn.getByTestId(`org-${b.slug}`)).toContainText('Suspended');
    const answered = inOwn.waitForResponse(
      (r) => r.url().endsWith(`/api/spaces/${b.slug}/leave`) && r.request().method() === 'POST',
    );
    await leaveFromPage(inOwn, b);
    const response = await answered;
    expect(response.status(), await response.text()).toBe(200);
    await expect(inOwn.getByTestId(`space-leave-problem-${b.slug}`)).toHaveCount(0);
    await expect(inOwn.getByTestId(`org-${b.slug}`)).toHaveCount(0);
    await inOwn.reload();
    await expect(inOwn.getByTestId('spaces-page')).toBeVisible();
    await expect(inOwn.getByTestId(`org-${own.slug}`)).toBeVisible();
    await expect(inOwn.getByTestId(`org-${b.slug}`)).toHaveCount(0);
    expect(await slugs(xia.page)).toEqual([own.slug]);
    // Y still runs B.
    expect((await session(yan.page)).memberships).toEqual([expect.objectContaining({ slug: b.slug, roles: ['admin'] })]);
  });

  test('leave the only space: Welcome, where they can delete their account', async ({ page, as }) => {
    const sol = await newcomer(page, as, 'sol', 'Sol Single');
    const hugo = await newcomer(page, as, 'solhost', 'Sid Host');
    const b = await makeSpace(hugo.page, `Sid club ${run}`);
    await inviteAndAccept(hugo.page, b, sol.page, sol.email, sol.name);

    const inB = await as('admin', { email: sol.email, org: b.slug });
    await inB.goto('/');
    await expect(switcher(inB)).toContainText(b.short_name);
    await openSpacesPage(inB);
    await leaveFromPage(inB, b);

    await expect(inB.getByTestId('welcome')).toBeVisible({ timeout: 15_000 });
    await expect(inB.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await expect(inB.getByTestId('welcome-join')).toBeVisible();
    await expect(inB.getByTestId(`org-${b.slug}`)).toHaveCount(0);
    expect(await slugs(sol.page)).toEqual([]);

    await inB.getByTestId('welcome-delete-account').click();
    await inB.getByTestId('welcome-delete-confirm').click();
    await expect(inB).toHaveURL(/\/login/, { timeout: 15_000 });
    expect((await sol.page.request.get('/api/auth/session')).status()).toBe(404);
  });

  test('only the person’s own membership: unknown, never-joined and invited spaces are 404; the older route still works', async ({ page, as }) => {
    const vic = await newcomer(page, as, 'vic', 'Vic Visitor');
    const host = await newcomer(page, as, 'vichost', 'Val Host');
    const b = await makeSpace(host.page, `Val club ${run}`);
    const c = await makeSpace(host.page, `Val two ${run}`);

    expect((await vic.page.request.post('/api/spaces/no-such-space/leave')).status()).toBe(404);
    // A space they never belonged to answers as one that does not exist.
    const never = await vic.page.request.post(`/api/spaces/${ORGS.a.slug}/leave`);
    expect(never.status()).toBe(404);
    expect((await never.json()).error.code).toBe('not_found');

    // Invited, not yet accepted: nothing to leave, and the invitation still waits.
    await unwrap(
      await host.page.request.post('/api/users', {
        headers: { 'X-Organization': b.slug },
        data: { full_name: vic.name, email: vic.email, roles: ['parent'], status: 'active' },
      }),
      'inviting',
    );
    expect((await vic.page.request.post(`/api/spaces/${b.slug}/leave`)).status()).toBe(404);
    expect((await session(vic.page)).invitations.map((i: any) => i.slug)).toEqual([b.slug]);

    // The older app's route, inside the space: the same act.
    await inviteAndAccept(host.page, c, vic.page, vic.email, vic.name);
    await unwrap(await vic.page.request.post('/api/organization/leave', { headers: { 'X-Organization': c.slug } }), 'older route');
    expect(await slugs(vic.page)).toEqual([]);
    const log = await unwrap<any[]>(await host.page.request.get('/api/audit?limit=20', { headers: { 'X-Organization': c.slug } }), 'C’s log');
    expect(log.some((e) => e.action === 'membership.left' && e.description === `${vic.name} left ${c.name}`)).toBe(true);
  });
});

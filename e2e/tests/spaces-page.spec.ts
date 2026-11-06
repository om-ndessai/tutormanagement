import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, ORGS, PEOPLE, test } from '../support/fixtures.js';
import { dropPersonalSpace, personalSpaceOf, unwrap } from '../support/api.js';
import type { PersonKey } from '../support/people.js';

/**
 * Phase 60 (S7, docs/spaces-plan.md): `/spaces`, the person's own console. Reached from the
 * switcher's "All spaces" (always, even with one space), the user menu, and the selector (the same
 * page without the frame); `/select-organization` redirects to it. Its sections: Your spaces (Open,
 * Leave), Invitations (Accept, Decline), Join with a code (and Requests sent, withdrawn there),
 * Start a space, the Platform console link (platform admins only), and Delete my account (only for
 * someone who belongs nowhere). It reads only the person's own session.
 *
 * Every test that changes anything signs up its own people (with sign-in off, `dev_email` stands in
 * for Google) and makes its own spaces, so the order of runs does not matter. Since Phase 63 (P13)
 * sign-up makes each of them a space of their own, "<First name>'s space": it is their "own" space
 * below; a test about someone in no space deletes it first.
 */

const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let serial = 0;

/** A new adult, signed up through the real route; returns their address. */
async function newAdult(page: Page, first: string): Promise<string> {
  serial += 1;
  const email = `spaces.page.${first.toLowerCase()}.${stamp}.${serial}@example.com`;
  await unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: `${first} Pagetest`,
        birth_year: 1984,
        birth_month: 6,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${first}`,
  );
  return email;
}

const sessionOf = async (page: Page, org?: string) =>
  unwrap<any>(
    await page.request.get('/api/auth/session', org ? { headers: { 'X-Organization': org } } : undefined),
    'the session',
  );

/** Makes a self-serve space as `page`'s person; returns its slug and name. */
async function makeSpace(page: Page, name: string): Promise<{ slug: string; name: string }> {
  const made = await unwrap<any>(await page.request.post('/api/spaces', { data: { name } }), `making ${name}`);
  return { slug: made.slug, name: made.name };
}

/** The welcome wizard, already been through in that space, so it never covers the page. */
async function tourDone(page: Page, slug: string) {
  await unwrap(
    await page.request.post('/api/onboarding/tour', {
      data: { outcome: 'skipped' },
      headers: { 'X-Organization': slug },
    }),
    'skipping the tour',
  );
}

/** As an admin of `slug` (its page), invites `email` as a parent. */
async function invite(admin: Page, slug: string, email: string, name: string) {
  await unwrap(
    await admin.request.post('/api/users', {
      data: { full_name: name, email, roles: ['parent'], status: 'active' },
      headers: { 'X-Organization': slug },
    }),
    `inviting ${email}`,
  );
}

const switcher = (page: Page) => page.getByTestId('org-switcher').filter({ visible: true }).first();

test.describe('the Spaces page (S7)', () => {
  test('reachable from inside a space with one membership: switcher, user menu, and the old address @smoke', async ({ page, as }) => {
    const email = await newAdult(page, 'Una');
    const outside = await as('admin', { email, org: null });
    const space = await personalSpaceOf(outside);
    await tourDone(outside, space.slug);

    const una = await as('admin', { email, org: space.slug });
    await una.goto('/');
    await expect(switcher(una)).toContainText("Una's space");
    expect((await sessionOf(una)).memberships).toHaveLength(1);

    // The switcher's "All spaces", shown with one space.
    await switcher(una).click();
    await una.getByTestId('org-switcher-all').click();
    await expect(una).toHaveURL(/\/spaces$/);
    await expect(una.getByRole('heading', { name: 'Spaces', exact: true })).toBeVisible();
    // Inside the portal's frame, the one space marked as here.
    await expect(switcher(una)).toBeVisible();
    await expect(una.getByTestId(`org-${space.slug}`)).toContainText('Here now');
    // Her own space reads "Just you" rather than her roles (Phase 72, JF33).
    await expect(una.getByTestId(`org-${space.slug}`)).toContainText('Just you');

    // The user menu's Spaces.
    await una.goto('/profile');
    await una.getByRole('button', { name: 'Account menu' }).filter({ visible: true }).first().click();
    await una.getByRole('menuitem', { name: 'Spaces', exact: true }).click();
    await expect(una).toHaveURL(/\/spaces$/);
    await expect(una.getByTestId('spaces-page')).toBeVisible();

    // The old address.
    await una.goto('/select-organization');
    await expect(una).toHaveURL(/\/spaces$/);
    await expect(una.getByTestId('spaces-page')).toBeVisible();

    // The sections a member sees: Your spaces, Join with a code, Start a space. No console link,
    // no invitations, and no Delete my account while she belongs somewhere.
    await expect(una.getByRole('region', { name: 'Your spaces' })).toBeVisible();
    await expect(una.getByTestId('welcome-join')).toBeVisible();
    await expect(una.getByTestId('welcome-make')).toBeVisible();
    await expect(una.getByRole('region', { name: 'Invitations' })).toHaveCount(0);
    await expect(una.getByRole('link', { name: /Platform console/ })).toHaveCount(0);
    await expect(una.getByTestId('welcome-delete-account')).toHaveCount(0);
  });

  test('Invitations: Accept enters the space; Your spaces: Open, Leave, and the last admin refused', async ({ page, as }) => {
    const pEmail = await newAdult(page, 'Pia');
    const hEmail = await newAdult(page, 'Hal');
    const pOut = await as('admin', { email: pEmail, org: null });
    const hOut = await as('admin', { email: hEmail, org: null });
    const own = await personalSpaceOf(pOut);
    const hosted = await makeSpace(hOut, `Hal’s club ${stamp}`);
    await tourDone(pOut, own.slug);
    await invite(hOut, hosted.slug, pEmail, 'Pia Pagetest');

    const pia = await as('admin', { email: pEmail, org: own.slug });
    await pia.goto('/spaces');
    const invitations = pia.getByRole('region', { name: 'Invitations' });
    await expect(invitations).toBeVisible();
    const card = pia.getByTestId(`invitation-${hosted.slug}`);
    await expect(card).toContainText(hosted.name);
    await expect(card).toContainText('Invited as Parent');
    // Waiting, not entered.
    expect((await sessionOf(pia)).memberships.map((m: any) => m.slug)).toEqual([own.slug]);

    await card.getByRole('button', { name: 'Accept' }).click();
    // Accepting enters the space at once (the tab reloads into it).
    await expect(pia).not.toHaveURL(/\/spaces/);
    await expect(switcher(pia)).toContainText(hosted.name.slice(0, 8));
    await expect.poll(async () => (await sessionOf(pia, hosted.slug)).organization?.slug).toBe(hosted.slug);
    await expect
      .poll(async () => (await sessionOf(pia)).memberships.map((m: any) => m.slug).sort())
      .toEqual([own.slug, hosted.slug].sort());
    expect((await sessionOf(pia)).invitations).toEqual([]);
    // The tour in the new space is S6's business; mark it done so it never covers the page here.
    await tourDone(pia, hosted.slug);

    // Your spaces: both, the current one marked; Open moves this tab to the other.
    await pia.goto('/spaces');
    await expect(pia.getByRole('region', { name: 'Invitations' })).toHaveCount(0);
    await expect(pia.getByTestId(`org-${hosted.slug}`)).toContainText('Here now');
    await expect(pia.getByTestId(`org-${hosted.slug}`)).toContainText('Parent');
    await expect(pia.getByTestId(`org-${own.slug}`)).not.toContainText('Here now');
    await pia.getByTestId(`org-${own.slug}`).getByRole('button', { name: new RegExp(`^${own.name.slice(0, 8)}`) }).click();
    await expect(pia).not.toHaveURL(/\/spaces/);
    await expect(switcher(pia)).toContainText(own.name.slice(0, 8));

    // Leave the other space from here, while inside her own: she carries on where she is.
    await pia.goto('/spaces');
    await expect(pia.getByTestId(`org-${own.slug}`)).toContainText('Here now');
    // Phase 78 (JF35): Leave says so in a word beside its icon, and names the space to a screen reader.
    await expect(pia.getByTestId(`space-leave-${hosted.slug}`)).toHaveText('Leave');
    await expect(pia.getByTestId(`space-leave-${hosted.slug}`)).toHaveAccessibleName(`Leave ${hosted.name}`);
    await pia.getByTestId(`space-leave-${hosted.slug}`).click();
    const confirm = pia.getByTestId(`space-leave-confirm-${hosted.slug}`);
    await expect(confirm).toContainText(`You stop being a member of ${hosted.name}. Its records of you stay.`);
    // "Stay" closes it without leaving.
    await confirm.getByRole('button', { name: 'Stay' }).click();
    await expect(confirm).toHaveCount(0);
    await pia.getByTestId(`space-leave-${hosted.slug}`).click();
    await pia.getByTestId(`space-leave-confirm-${hosted.slug}`).getByRole('button', { name: /^Leave / }).click();
    await expect(pia.getByText(`You have left ${hosted.name}.`)).toBeVisible();
    await expect(pia.getByTestId(`org-${hosted.slug}`)).toHaveCount(0);
    await expect(pia).toHaveURL(/\/spaces$/);
    await expect(pia.getByTestId(`org-${own.slug}`)).toContainText('Here now');
    expect((await sessionOf(pia)).memberships.map((m: any) => m.slug)).toEqual([own.slug]);
    // Gone from the switcher too.
    await switcher(pia).click();
    await expect(pia.getByRole('menuitem', { name: new RegExp(hosted.name) })).toHaveCount(0);
    await pia.keyboard.press('Escape');

    // The last admin of her own space is refused, with the reason on screen.
    await pia.getByTestId(`space-leave-${own.slug}`).click();
    await pia.getByTestId(`space-leave-confirm-${own.slug}`).getByRole('button', { name: /^Leave / }).click();
    await expect(pia.getByTestId(`space-leave-problem-${own.slug}`)).toBeVisible();
    await expect(pia.getByTestId(`space-leave-problem-${own.slug}`)).not.toBeEmpty();
    expect((await sessionOf(pia)).memberships.map((m: any) => m.slug)).toEqual([own.slug]);
  });

  test('a suspended admin may leave while another admin is active', async ({ page, as }) => {
    const xEmail = await newAdult(page, 'Xia');
    const yEmail = await newAdult(page, 'Yul');
    const xOut = await as('admin', { email: xEmail, org: null });
    const yOut = await as('admin', { email: yEmail, org: null });
    const own = await personalSpaceOf(xOut);
    const shared = await makeSpace(yOut, `Yul’s club ${stamp}`);
    await tourDone(xOut, own.slug);
    // Yul makes Xia a second admin of his space; she accepts; then he suspends her.
    const added = await unwrap<any>(
      await yOut.request.post('/api/users', {
        data: { full_name: 'Xia Pagetest', email: xEmail, roles: ['admin'], status: 'active' },
        headers: { 'X-Organization': shared.slug },
      }),
      'adding Xia as an admin',
    );
    await unwrap(await xOut.request.post(`/api/auth/invitations/${shared.slug}/accept`), 'Xia accepts');
    await unwrap(
      await yOut.request.patch(`/api/users/${added.id}`, {
        data: { status: 'suspended' },
        headers: { 'X-Organization': shared.slug },
      }),
      'suspending Xia',
    );
    expect((await sessionOf(xOut)).memberships.find((m: any) => m.slug === shared.slug)?.status).toBe('suspended');

    const xia = await as('admin', { email: xEmail, org: own.slug });
    await xia.goto('/spaces');
    const row = xia.getByTestId(`org-${shared.slug}`);
    await expect(row).toContainText('Your access here is suspended.');
    await xia.getByTestId(`space-leave-${shared.slug}`).click();
    const answered = xia.waitForResponse(
      (r) => r.url().endsWith(`/api/spaces/${shared.slug}/leave`) && r.request().method() === 'POST',
    );
    await xia.getByTestId(`space-leave-confirm-${shared.slug}`).getByRole('button', { name: /^Leave / }).click();
    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ data: { left: true } });
    await expect(xia.getByTestId(`space-leave-problem-${shared.slug}`)).toHaveCount(0);
    await expect(row).toHaveCount(0);
    expect((await sessionOf(xia)).memberships.map((m: any) => m.slug)).toEqual([own.slug]);
  });

  test('Invitations: Decline removes it, and nothing is entered', async ({ page, as }) => {
    const dEmail = await newAdult(page, 'Dev');
    const hEmail = await newAdult(page, 'Hoa');
    const dOut = await as('admin', { email: dEmail, org: null });
    const hOut = await as('admin', { email: hEmail, org: null });
    const own = await personalSpaceOf(dOut);
    const hosted = await makeSpace(hOut, `Hoa’s circle ${stamp}`);
    await tourDone(dOut, own.slug);
    await invite(hOut, hosted.slug, dEmail, 'Dev Pagetest');

    const dev = await as('admin', { email: dEmail, org: own.slug });
    await dev.goto('/spaces');
    const card = dev.getByTestId(`invitation-${hosted.slug}`);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Decline' }).click();
    await expect(dev.getByText(`Invitation to ${hosted.name} declined.`)).toBeVisible();
    await expect(card).toHaveCount(0);
    await expect(dev.getByRole('region', { name: 'Invitations' })).toHaveCount(0);
    await expect(dev).toHaveURL(/\/spaces$/);
    const after = await sessionOf(dev);
    expect(after.invitations).toEqual([]);
    expect(after.memberships.map((m: any) => m.slug)).toEqual([own.slug]);
  });

  test('Join with a code: found, asked, listed under Requests sent, withdrawn', async ({ page, as }) => {
    const jEmail = await newAdult(page, 'Jo');
    const hEmail = await newAdult(page, 'Hugo');
    const jOut = await as('admin', { email: jEmail, org: null });
    const hOut = await as('admin', { email: hEmail, org: null });
    const own = await personalSpaceOf(jOut);
    const hosted = await makeSpace(hOut, `Hugo’s maths ${stamp}`);
    await tourDone(jOut, own.slug);
    const hugo = await as('admin', { email: hEmail, org: hosted.slug });
    await unwrap(await hugo.request.put('/api/organization/code', { data: { join_by_code: true } }), 'joining on');
    const { code } = await unwrap<any>(await hugo.request.get('/api/organization/code'), 'the code');
    expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    const jo = await as('admin', { email: jEmail, org: own.slug });
    await jo.goto('/spaces');
    // A code that opens nothing says so.
    await jo.getByTestId('welcome-code').fill('ZZZZ-2222');
    await jo.getByTestId('welcome-find').click();
    await expect(jo.getByTestId('welcome-found')).toHaveCount(0);
    await expect(jo.getByTestId('welcome-join').locator('.text-destructive')).toBeVisible();

    await jo.getByTestId('welcome-code').fill(code);
    await jo.getByTestId('welcome-find').click();
    await expect(jo.getByTestId('welcome-found')).toContainText(hosted.name);
    await jo.getByTestId('welcome-ask').click();
    const request = jo.getByTestId(`welcome-request-${hosted.slug}`);
    await expect(request).toBeVisible();
    await expect(jo.getByRole('region', { name: 'Requests sent' })).toContainText(hosted.name);
    // Asking does not let her in (S9): the space's admins answer it.
    const asked = await sessionOf(jo);
    expect(asked.memberships.map((m: any) => m.slug)).toEqual([own.slug]);
    expect(asked.join_requests).toEqual([expect.objectContaining({ slug: hosted.slug, outcome: null })]);
    const waiting = await unwrap<any[]>(await hugo.request.get('/api/organization/join-requests'), 'Hugo’s requests');
    expect(waiting.map((r) => r.email)).toContain(jEmail);

    // Looking it up again: "You have asked already."
    await jo.getByTestId('welcome-code').fill(code);
    await jo.getByTestId('welcome-find').click();
    await expect(jo.getByTestId('welcome-found')).toContainText('You have asked already.');

    await request.getByRole('button', { name: 'Withdraw' }).click();
    await expect(request).toHaveCount(0);
    await expect(jo.getByRole('region', { name: 'Requests sent' })).toHaveCount(0);
    expect((await sessionOf(jo)).join_requests).toEqual([]);
    const after = await unwrap<any[]>(await hugo.request.get('/api/organization/join-requests'), 'after');
    expect(after.map((r) => r.email)).not.toContain(jEmail);
  });

  test('Start a space from the Spaces page: made, entered, the invite step, then the space', async ({ page, as }) => {
    const email = await newAdult(page, 'Sol');
    const out = await as('admin', { email, org: null });
    const own = await personalSpaceOf(out);
    await tourDone(out, own.slug);

    const sol = await as('admin', { email, org: own.slug });
    await sol.goto('/spaces');
    const name = `Sol’s second ${stamp}`;
    await sol.getByTestId('welcome-space-name').fill(name);
    await sol.getByTestId('welcome-make-submit').click();
    // Entering the new space reloads the page (chooseOrganization), so no toast survives it; the
    // invite step inside the new space is the sign that it was made and entered.
    // Phase 61 (S12): "Invite people" first; skipping goes on.
    await expect(sol.getByTestId('invite-step')).toBeVisible({ timeout: 15_000 });
    await sol.getByTestId('invite-skip').click();
    await expect(sol.getByTestId('invite-step')).toHaveCount(0);
    const wizard = sol.getByTestId('onboarding-wizard');
    await expect(wizard).toBeVisible({ timeout: 10_000 });
    await sol.keyboard.press('Escape');
    await expect(wizard).toHaveCount(0);

    const after = await sessionOf(sol);
    const made = after.memberships.find((m: any) => m.name === name);
    expect(made).toMatchObject({ roles: ['admin'], status: 'active' });
    expect(after.memberships.map((m: any) => m.slug)).toContain(own.slug);
    // This tab is in the new space now, and the Spaces page says so.
    await sol.goto('/spaces');
    await expect(sol.getByTestId(`org-${made.slug}`)).toContainText('Here now');
    await expect(sol.getByTestId(`org-${own.slug}`)).toBeVisible();
  });

  test('Platform console: a link for platform admins only', async ({ as }) => {
    const nav = await as('platformAdmin', { org: null });
    await nav.goto('/spaces');
    await expect(nav.getByTestId('spaces-page')).toBeVisible();
    const link = nav.getByRole('link', { name: /Platform console/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/platform');
    await link.click();
    await expect(nav).toHaveURL(/\/platform/);

    // A space's own admin is not a platform admin: no link, on the page or in the user menu.
    const priya = await as('admin');
    await priya.goto('/spaces');
    await expect(priya.getByTestId('spaces-page')).toBeVisible();
    await expect(priya.getByRole('link', { name: /Platform console/ })).toHaveCount(0);
    await priya.getByRole('button', { name: 'Account menu' }).filter({ visible: true }).first().click();
    await expect(priya.getByRole('menuitem', { name: 'Spaces', exact: true })).toBeVisible();
    await expect(priya.getByRole('menuitem', { name: 'Platform console' })).toHaveCount(0);
  });

  test('Delete my account: offered only to someone who belongs nowhere, and it deletes', async ({ page, as }) => {
    const email = await newAdult(page, 'Zed');
    const zed = await as('admin', { email, org: null });
    await dropPersonalSpace(zed);
    await zed.goto('/spaces');
    await expect(zed.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await expect(zed.getByRole('region', { name: 'Your spaces' })).toHaveCount(0);
    await zed.getByTestId('welcome-delete-account').click();
    // "Keep it" keeps it.
    await zed.getByRole('button', { name: 'Keep it' }).click();
    await expect(zed.getByTestId('welcome-delete-confirm')).toHaveCount(0);
    await zed.getByTestId('welcome-delete-account').click();
    await zed.getByTestId('welcome-delete-confirm').click();
    await expect(zed).toHaveURL(/\/login/);
    expect((await zed.request.get('/api/auth/session')).status()).toBe(404);

    // With a request open, it is not offered (the API refuses the same).
    const email2 = await newAdult(page, 'Yan');
    const hostEmail = await newAdult(page, 'Hana');
    const host = await as('admin', { email: hostEmail, org: null });
    const hosted = await makeSpace(host, `Hana’s group ${stamp}`);
    const hana = await as('admin', { email: hostEmail, org: hosted.slug });
    await unwrap(await hana.request.put('/api/organization/code', { data: { join_by_code: true } }), 'joining on');
    const { code } = await unwrap<any>(await hana.request.get('/api/organization/code'), 'the code');
    const yan = await as('admin', { email: email2, org: null });
    await dropPersonalSpace(yan);
    await unwrap(await yan.request.post('/api/spaces/join-requests', { data: { code } }), 'Yan asks');
    await yan.goto('/spaces');
    await expect(yan.getByTestId(`welcome-request-${hosted.slug}`)).toBeVisible();
    await expect(yan.getByTestId('welcome-delete-account')).toHaveCount(0);
    await unwrap(await yan.request.delete(`/api/spaces/join-requests/${hosted.slug}`), 'withdraw');
  });

  test('Delete my account: not offered to a platform admin in no space (the API refuses one)', async ({ page, as }) => {
    const email = await newAdult(page, 'Pam');
    const nav = await as('platformAdmin', { org: null });
    await unwrap(
      await nav.request.post('/api/platform/admins', { data: { email, full_name: 'Pam Pagetest' } }),
      'making Pam a platform admin',
    );
    const pam = await as('admin', { email, org: null });
    await dropPersonalSpace(pam);
    const own = await sessionOf(pam);
    expect(own.memberships).toEqual([]);
    expect(own.platform_admin).toBe(true);
    await pam.goto('/spaces');
    await expect(pam.getByTestId('spaces-page')).toBeVisible();
    await expect(pam.getByRole('link', { name: /Platform console/ })).toBeVisible();
    await expect(pam.getByTestId('welcome-delete-account')).toHaveCount(0);
    // And the API agrees: a platform admin's account is not theirs to delete.
    expect((await pam.request.delete('/api/auth/account')).status()).toBe(409);
  });

  test('Delete my account: a person whose only space was archived may delete, and it works', async ({ page, as }) => {
    const email = await newAdult(page, 'Ari');
    const out = await as('admin', { email, org: null });
    // This is about a person whose ONLY space was archived: the space of her own (P13) goes first.
    await dropPersonalSpace(out);
    const space = await makeSpace(out, `Ari’s archived ${stamp}`);
    const id = (await sessionOf(out, space.slug)).organization.id;
    const nav = await as('platformAdmin', { org: null });
    await unwrap(await nav.request.post(`/api/platform/organizations/${id}/archive`), 'archiving Ari’s space');

    const ari = await as('admin', { email, org: null });
    expect((await sessionOf(ari)).memberships).toEqual([]);
    await ari.goto('/spaces');
    await expect(ari.getByRole('heading', { name: 'Welcome to Aimtrue' })).toBeVisible();
    await ari.getByTestId('welcome-delete-account').click();
    const answered = ari.waitForResponse((r) => r.url().endsWith('/api/auth/account') && r.request().method() === 'DELETE');
    await ari.getByTestId('welcome-delete-confirm').click();
    expect((await answered).status()).toBe(204);
    await expect(ari).toHaveURL(/\/login/);
    expect((await ari.request.get('/api/auth/session')).status()).toBe(404);

    // Restored, the space no longer counts the deleted account as a member.
    await unwrap(await nav.request.post(`/api/platform/organizations/${id}/restore`), 'restoring it');
    const admins = await unwrap<any[]>(await nav.request.get(`/api/platform/organizations/${id}/admins`), 'its admins');
    expect(admins).toEqual([]);
  });

  test('it shows only the person’s own memberships, as every persona', async ({ as }) => {
    const everyone = Object.keys(PEOPLE) as PersonKey[];
    for (const who of everyone) {
      const page = await as(who, { org: null });
      const response = await page.request.get('/api/auth/session');
      expect(response.status(), who).toBe(200);
      const body = await response.text();
      const session = JSON.parse(body).data;
      expect(session.user.email, who).toBe(PEOPLE[who].email);
      // Nobody else's address anywhere in it.
      for (const other of everyone) {
        if (PEOPLE[other].email === PEOPLE[who].email) continue;
        expect(body.includes(PEOPLE[other].email), `${who}'s session names ${other}`).toBe(false);
      }
      // Each membership is theirs: inside it, the session is them, with the roles listed.
      for (const m of session.memberships as any[]) {
        if (m.status !== 'active') continue;
        const inside = await sessionOf(page, m.slug);
        expect(inside.organization?.slug, `${who} in ${m.slug}`).toBe(m.slug);
        expect(inside.user.email).toBe(PEOPLE[who].email);
        expect([...inside.user.roles].sort(), `${who}'s roles in ${m.slug}`).toEqual([...m.roles].sort());
      }
      await page.context().close();
    }

    // On the page: Maria (CHMI alone) sees CHMI and no other; Anita (A and B) both, and no other.
    const maria = await as('parentTutor');
    await maria.goto('/spaces');
    await expect(maria.getByTestId(`org-${ORGS.a.slug}`)).toBeVisible();
    for (const other of [ORGS.b, ORGS.c, ORGS.d]) await expect(maria.getByTestId(`org-${other.slug}`)).toHaveCount(0);

    const anita = await as('parent');
    await anita.goto('/spaces');
    await expect(anita.getByTestId(`org-${ORGS.a.slug}`)).toBeVisible();
    await expect(anita.getByTestId(`org-${ORGS.b.slug}`)).toBeVisible();
    for (const other of [ORGS.c, ORGS.d]) await expect(anita.getByTestId(`org-${other.slug}`)).toHaveCount(0);
  });
});

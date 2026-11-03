import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { dropPersonalSpace, personalSpaceOf, unwrap } from '../support/api.js';
// S4's own block (below): the landing rule is the shared one.
import { decideLanding } from '@tmi/shared';
import { visible } from '../support/ui.js';

/**
 * Phase 60 (S4, S5, docs/spaces-plan.md): where a person lands. An ARRIVING tab (no space of its
 * own) goes to a link's space, else the last space they opened on any device (`is_default`, moved
 * by POST /api/auth/enter), else their only space when nothing is pending, else the selector.
 * The star is gone; an older app's PUT /api/auth/default-organization still sets the same choice.
 * (These cases were default-organization.spec.ts.)
 *
 * Anita Patel is a parent in A and B. Every test leaves her with no last choice.
 */

const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

const lastChoice = async (page: Page) =>
  (await session(page)).memberships.filter((m: any) => m.is_default).map((m: any) => m.slug);

const clear = (page: Page) => page.request.put('/api/auth/default-organization', { data: { slug: null } });

test.describe('landing in the last space chosen (S4, S5)', () => {
  test('two spaces and no last choice: the selector; choosing one is where the next arrival lands', async ({ as }) => {
    const anita = await as('parent', { org: null });
    await clear(anita);
    try {
      await anita.goto('/');
      await expect(anita).toHaveURL(/\/spaces$/);
      await expect(anita.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
      // No star anywhere.
      await expect(anita.getByText(/on sign-in|Make this your default/)).toHaveCount(0);

      await anita.getByRole('button', { name: new RegExp(`^${ORGS.b.name}`) }).click();
      await expect(anita.getByTestId('org-switcher')).toContainText(ORGS.b.short);
      await expect.poll(() => lastChoice(anita)).toEqual([ORGS.b.slug]);

      // A new arrival lands in B -- even one whose browser cookie was last in A.
      const fresh = await as('parent', { org: null });
      await fresh.context().addCookies([{ name: 'tmi_last_org', value: ORGS.a.slug, url: test.info().project.use.baseURL! }]);
      await fresh.goto('/');
      await expect(fresh).not.toHaveURL(/\/spaces/);
      await expect(fresh.getByTestId('org-switcher')).toContainText(ORGS.b.short);

      // Switching to A in the switcher moves the choice: the next arrival lands in A.
      await fresh.getByTestId('org-switcher').filter({ visible: true }).first().click();
      await fresh.getByRole('menuitem', { name: new RegExp(ORGS.a.name) }).click();
      await expect(fresh.getByTestId('org-switcher')).toContainText(ORGS.a.short);
      await expect.poll(() => lastChoice(fresh)).toEqual([ORGS.a.slug]);
      const later = await as('parent', { org: null });
      await later.goto('/');
      await expect(later.getByTestId('org-switcher')).toContainText(ORGS.a.short);

      // A tab that has chosen stays where it is, whatever another tab opens.
      await fresh.reload();
      await expect(fresh.getByTestId('org-switcher')).toContainText(ORGS.a.short);
    } finally {
      await clear(anita);
    }
  });

  test('a link to A while the last choice is B: A, and A becomes the last choice', async ({ as }) => {
    const anita = await as('parent', { org: null });
    try {
      await unwrap(await anita.request.put('/api/auth/default-organization', { data: { slug: ORGS.b.slug } }), 'older app star');
      await anita.goto(`/sessions?org=${ORGS.a.slug}`);
      await expect(anita.getByTestId('org-switcher')).toContainText(ORGS.a.short);
      await expect(anita).toHaveURL(/\/sessions$/);
      await expect.poll(() => lastChoice(anita)).toEqual([ORGS.a.slug]);
    } finally {
      await clear(anita);
    }
  });

  test('entering moves the choice with no log line of its own; an older app’s star still sets it', async ({ as }) => {
    const anita = await as('parent', { org: null });
    try {
      const entered = await anita.request.post('/api/auth/enter', { headers: { 'X-Organization': ORGS.b.slug } });
      expect(entered.status()).toBe(200);
      expect(await lastChoice(anita)).toEqual([ORGS.b.slug]);
      // Only one, ever.
      await anita.request.post('/api/auth/enter', { headers: { 'X-Organization': ORGS.a.slug } });
      expect(await lastChoice(anita)).toEqual([ORGS.a.slug]);
      const log = await unwrap<any[]>(await (await as('admin')).request.get('/api/audit?limit=50'), 'A’s log');
      expect(log.filter((e) => e.action === 'membership.default_set' && e.actor_name === 'Anita Patel')).toEqual([]);

      // The older app's route: only a space they may enter, else 404.
      expect((await anita.request.put('/api/auth/default-organization', { data: { slug: ORGS.c.slug } })).status()).toBe(404);
      expect((await anita.request.put('/api/auth/default-organization', { data: { slug: 'no-such-org' } })).status()).toBe(404);
      await unwrap(await anita.request.put('/api/auth/default-organization', { data: { slug: ORGS.b.slug } }), 'star');
      const arriving = await as('parent', { org: null });
      await arriving.goto('/');
      await expect(arriving.getByTestId('org-switcher')).toContainText(ORGS.b.short);
    } finally {
      await clear(anita);
    }
  });

  test('one space and nothing pending: no selector, straight in; the switcher still offers All spaces', async ({ as }) => {
    const maria = await as('parentTutor', { org: null });
    await maria.goto('/');
    await expect(maria.getByTestId('member-home')).toBeVisible();
    await expect(maria).not.toHaveURL(/\/spaces/);
    await maria.getByTestId('org-switcher').filter({ visible: true }).first().click();
    await maria.getByRole('menuitem', { name: 'All spaces' }).click();
    await expect(maria).toHaveURL(/\/spaces$/);
    await expect(maria.getByRole('heading', { name: 'Spaces', exact: true })).toBeVisible();
  });
});

/**
 * S5 (docs/spaces-plan.md): the selector. When the landing rule finds nowhere to go, "Choose a space"
 * fills the screen, without the portal's frame: the spaces they may enter (each with its mark and
 * their roles there), invitations waiting and requests sent. Choosing one enters it, and it becomes
 * the last choice; there is no star.
 *
 * Every test signs up its own newcomers and makes their own spaces, so the order of runs, and what
 * other specs do to the seeded cast, does not matter. Since Phase 63 (P13) a newcomer starts with a
 * space of their own, made at sign-up ("Sel's space"): it counts as one of their spaces below, and a
 * test about someone with no space of their own deletes it first.
 */
test.describe('selector', () => {
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  let serial = 0;

  /** An adult who signed up just now, in their own space alone: their page, arriving with no space chosen. */
  async function newcomer(as: (who: 'admin', o: { email: string; org: null }) => Promise<Page>, label: string) {
    const email = `selector.${label}.${run}.${++serial}@example.com`;
    const page = await as('admin', { email, org: null });
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: `Sel ${label[0]!.toUpperCase()}${label.slice(1)}`,
          birth_year: 1985,
          birth_month: 6,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      `signing ${label} up`,
    );
    const own = await personalSpaceOf(page);
    expect(own.name).toBe("Sel's space");
    return { page, email, own };
  }

  async function makeSpace(page: Page, name: string): Promise<{ slug: string; name: string }> {
    return unwrap(await page.request.post('/api/spaces', { data: { name } }), `making ${name}`);
  }

  /** The space's admin invites `email` as a parent, the way the invite step does. */
  async function invite(host: Page, slug: string, email: string) {
    await unwrap(
      await host.request.post('/api/users', {
        headers: { 'X-Organization': slug },
        data: { email, full_name: 'Invited Person', roles: ['parent'], status: 'invited' },
      }),
      `inviting ${email}`,
    );
  }

  /** The space's code, with joining on. */
  async function codeOf(host: Page, slug: string): Promise<string> {
    const code = await unwrap<{ code: string | null; join_by_code: boolean }>(
      await host.request.get('/api/organization/code', { headers: { 'X-Organization': slug } }),
      'the code',
    );
    if (code.code && code.join_by_code) return code.code;
    const on = await unwrap<{ code: string }>(
      await host.request.put('/api/organization/code', { headers: { 'X-Organization': slug }, data: { join_by_code: true } }),
      'joining on',
    );
    return on.code;
  }

  const initials = (short: string) =>
    short
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  test('two spaces and no last choice: "Choose a space", full screen, each space with its mark and roles; choosing enters it', async ({ as }) => {
    const { page: maker, email, own } = await newcomer(as, 'two');
    // Their own space, made at sign-up, is one of the two.
    const first = own;
    const second = await makeSpace(maker, `Selector Second ${run}`);
    await unwrap(await clear(maker), 'no last choice');
    expect(await lastChoice(maker)).toEqual([]);
    const memberships = (await session(maker)).memberships as any[];
    const shortOf = (slug: string) => memberships.find((m) => m.slug === slug).short_name as string;

    const arriving = maker;
    await arriving.goto('/');
    await expect(arriving).toHaveURL(/\/spaces$/);
    await expect(arriving.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
    // Without the portal's frame: no switcher, no sidebar.
    await expect(arriving.getByTestId('org-switcher')).toHaveCount(0);
    // No star anywhere.
    await expect(arriving.getByText(/on sign-in|Make this your default/)).toHaveCount(0);

    const yours = arriving.getByRole('region', { name: 'Your spaces' });
    for (const space of [first, second]) {
      const row = yours.getByTestId(`org-${space.slug}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText(space.name);
      // Its mark (no logo uploaded: its initials on its colour), and the person's roles there.
      await expect(row).toContainText(initials(shortOf(space.slug)));
      await expect(row).toContainText('Admin');
      await expect(row).not.toContainText('Here now');
    }
    // Nothing pending: no Invitations, no Requests sent.
    await expect(arriving.getByRole('region', { name: 'Invitations' })).toHaveCount(0);
    await expect(arriving.getByRole('region', { name: 'Requests sent' })).toHaveCount(0);

    // Choosing enters it, and it becomes the last choice.
    await yours
      .getByTestId(`org-${second.slug}`)
      .getByRole('button', { name: new RegExp(`^${escape(second.name)}`) })
      .click();
    await expect(arriving).not.toHaveURL(/\/spaces/);
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(shortOf(second.slug));
    await expect.poll(() => lastChoice(arriving)).toEqual([second.slug]);

    // The next arrival skips the selector.
    const later = await as('admin', { email, org: null });
    await later.goto('/');
    await expect(later.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(shortOf(second.slug));
    await expect(later).not.toHaveURL(/\/spaces/);
  });

  test('the selector lists invitations waiting and requests sent beside the spaces', async ({ as }) => {
    const { page: host } = await newcomer(as, 'host');
    const invitingSpace = await makeSpace(host, `Selector Inviting ${run}`);
    const askedSpace = await makeSpace(host, `Selector Asked ${run}`);
    const code = await codeOf(host, askedSpace.slug);

    const { page: person, email, own } = await newcomer(as, 'busy');
    const a = own;
    const b = await makeSpace(person, `Selector Busy B ${run}`);
    await invite(host, invitingSpace.slug, email);
    await unwrap(await person.request.post('/api/spaces/join-requests', { data: { code } }), 'asking to join');
    await unwrap(await clear(person), 'no last choice');

    await person.goto('/');
    await expect(person).toHaveURL(/\/spaces$/);
    await expect(person.getByRole('heading', { name: 'Choose a space' })).toBeVisible();

    const invitations = person.getByRole('region', { name: 'Invitations' });
    const invitation = invitations.getByTestId(`invitation-${invitingSpace.slug}`);
    await expect(invitation).toBeVisible();
    await expect(invitation).toContainText(invitingSpace.name);
    await expect(invitation).toContainText('Invited as Parent');
    await expect(invitation.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(invitation.getByRole('button', { name: 'Decline' })).toBeVisible();

    const yours = person.getByRole('region', { name: 'Your spaces' });
    await expect(yours.getByTestId(`org-${a.slug}`)).toBeVisible();
    await expect(yours.getByTestId(`org-${b.slug}`)).toBeVisible();
    // The invitation is not a space they may enter yet.
    await expect(yours.getByTestId(`org-${invitingSpace.slug}`)).toHaveCount(0);

    const requests = person.getByRole('region', { name: 'Requests sent' });
    await expect(requests.getByTestId(`welcome-request-${askedSpace.slug}`)).toBeVisible();
    await expect(requests.getByTestId(`welcome-request-${askedSpace.slug}`)).toContainText(askedSpace.name);
    await expect(visible(person, askedSpace.name)).toHaveCount(1);

    // Still nothing entered: the selector changed no last choice.
    expect(await lastChoice(person)).toEqual([]);
  });

  test('one space and nothing pending: never the selector; one space and an invitation waiting: the selector', async ({ as }) => {
    const { page: solo, email, own } = await newcomer(as, 'solo');
    // Their one space: their own, made at sign-up.
    const only = own;
    await unwrap(await clear(solo), 'no last choice');

    await solo.goto('/');
    await expect(solo.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
    await expect(solo).not.toHaveURL(/\/spaces/);
    await expect(solo.getByRole('heading', { name: 'Choose a space' })).toHaveCount(0);
    // The single space becomes their last choice.
    await expect.poll(() => lastChoice(solo)).toEqual([only.slug]);

    // An invitation waiting: one space is no longer the whole answer.
    const { page: host } = await newcomer(as, 'solohost');
    const other = await makeSpace(host, `Selector Other ${run}`);
    await invite(host, other.slug, email);
    await unwrap(await clear(solo), 'no last choice again');
    const arriving = await as('admin', { email, org: null });
    await arriving.goto('/');
    await expect(arriving).toHaveURL(/\/spaces$/);
    await expect(arriving.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
    await expect(arriving.getByTestId(`invitation-${other.slug}`)).toBeVisible();
    await expect(arriving.getByRole('region', { name: 'Your spaces' }).getByTestId(`org-${only.slug}`)).toBeVisible();
  });

  test('one space let in and another request declined: nothing pending, so straight in, never the selector', async ({ as }) => {
    const { page: hostA } = await newcomer(as, 'lethost');
    const spaceA = await makeSpace(hostA, `Selector Lets In ${run}`);
    const codeA = await codeOf(hostA, spaceA.slug);
    const { page: hostB } = await newcomer(as, 'declhost');
    const spaceB = await makeSpace(hostB, `Selector Declines ${run}`);
    const codeB = await codeOf(hostB, spaceB.slug);

    const { page: person, email } = await newcomer(as, 'asker');
    // This is about someone whose ONE space is the one let in: the space of their own goes first.
    await dropPersonalSpace(person);
    await unwrap(await person.request.post('/api/spaces/join-requests', { data: { code: codeA } }), 'asking A');
    await unwrap(await person.request.post('/api/spaces/join-requests', { data: { code: codeB } }), 'asking B');

    // A's admin lets them in through the user form; B's admin declines.
    const requestsA = await unwrap<any[]>(
      await hostA.request.get('/api/organization/join-requests', { headers: { 'X-Organization': spaceA.slug } }),
      'A requests',
    );
    const reqA = requestsA.find((r) => r.email === email);
    await unwrap(
      await hostA.request.post('/api/users', {
        headers: { 'X-Organization': spaceA.slug },
        data: { full_name: reqA.full_name, email, roles: ['parent'], status: 'active', join_request_user_id: reqA.user_id },
      }),
      'letting in',
    );
    const requestsB = await unwrap<any[]>(
      await hostB.request.get('/api/organization/join-requests', { headers: { 'X-Organization': spaceB.slug } }),
      'B requests',
    );
    const reqB = requestsB.find((r) => r.email === email);
    await unwrap(
      await hostB.request.post(`/api/organization/join-requests/${reqB.user_id}/decline`, { headers: { 'X-Organization': spaceB.slug } }),
      'declining',
    );
    await unwrap(await clear(person), 'no last choice');

    // The decline is answered, not pending: one space they may enter and nothing pending.
    const before = await session(person);
    expect(before.invitations).toEqual([]);
    expect(before.memberships.filter((m: any) => m.status === 'active').map((m: any) => m.slug)).toEqual([spaceA.slug]);
    expect(before.join_requests.filter((r: any) => r.outcome === null)).toEqual([]);
    expect(decideLanding(before)).toBe(spaceA.slug);

    const arriving = await as('admin', { email, org: null });
    await arriving.goto('/');
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
    await expect(arriving).not.toHaveURL(/\/spaces/);
    await expect(arriving.getByRole('heading', { name: 'Choose a space' })).toHaveCount(0);
    await expect.poll(() => lastChoice(arriving)).toEqual([spaceA.slug]);
  });

  test('one space and a request to a space since archived: nothing pending, so straight in, and the request is not listed', async ({ as }) => {
    const { page: host } = await newcomer(as, 'archhost');
    const spaceB = await makeSpace(host, `Selector Archived ${run}`);
    const codeB = await codeOf(host, spaceB.slug);

    const { page: person, email, own } = await newcomer(as, 'archasker');
    const spaceA = own;
    await unwrap(await person.request.post('/api/spaces/join-requests', { data: { code: codeB } }), 'asking B');

    // A platform admin archives B: it can no longer be entered, joined or answered.
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the spaces');
    const b = orgs.find((o) => o.slug === spaceB.slug);
    await unwrap(await platform.request.post(`/api/platform/organizations/${b.id}/archive`), 'archiving B');
    await unwrap(await clear(person), 'no last choice');

    const before = await session(person);
    expect((before.join_requests ?? []).filter((r: any) => r.slug === spaceB.slug)).toEqual([]);
    expect(decideLanding(before)).toBe(spaceA.slug);

    const arriving = await as('admin', { email, org: null });
    await arriving.goto('/');
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
    await expect(arriving).not.toHaveURL(/\/spaces/);
    await expect(arriving.getByRole('heading', { name: 'Choose a space' })).toHaveCount(0);
    await expect(arriving.getByTestId(`welcome-request-${spaceB.slug}`)).toHaveCount(0);
    await expect.poll(() => lastChoice(arriving)).toEqual([spaceA.slug]);
  });

  test('only an invitation: the selector (not the Welcome), with the invitation and nothing entered; Accept enters it', async ({ as }) => {
    const { page: host } = await newcomer(as, 'invhost');
    const space = await makeSpace(host, `Selector Invites ${run}`);
    const { page: invitee, email } = await newcomer(as, 'invitee');
    // Only an invitation: no space of their own either.
    await dropPersonalSpace(invitee);
    await invite(host, space.slug, email);

    await invitee.goto('/');
    await expect(invitee).toHaveURL(/\/spaces$/);
    await expect(invitee.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
    await expect(invitee.getByRole('heading', { name: /^Welcome to/ })).toHaveCount(0);
    await expect(invitee.getByTestId('org-switcher')).toHaveCount(0);
    await expect(invitee.getByTestId(`invitation-${space.slug}`)).toBeVisible();
    // Nothing entered: no spaces of their own, and the API agrees.
    await expect(invitee.getByRole('region', { name: 'Your spaces' })).toHaveCount(0);
    const before = await session(invitee);
    expect(before.memberships.filter((m: any) => m.status === 'active')).toEqual([]);
    expect(before.invitations.map((i: any) => i.slug)).toEqual([space.slug]);
    expect((await invitee.request.get('/api/users', { headers: { 'X-Organization': space.slug } })).status()).toBe(403);

    await invitee.getByTestId(`invitation-${space.slug}`).getByRole('button', { name: 'Accept' }).click();
    await expect(invitee).not.toHaveURL(/\/spaces/);
    await expect(invitee.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
    await expect.poll(() => lastChoice(invitee)).toEqual([space.slug]);
  });
});

/**
 * S4's acceptance checks (docs/spaces-plan.md, Phase 60), each on people and spaces the test makes
 * itself, so no other spec's entering can move their last choice and the order of runs is free.
 *
 * Each test: an adult owner signs up and makes two or three self-serve spaces; a second adult, the
 * member, signs up, is invited to each as a parent and accepts by API (accepting alone never moves
 * the choice -- the client's entering does). Their last choice is then cleared, so every check
 * starts from "no last choice". A new browser context with no space of its own is an arriving tab:
 * the web's sign-out clears the tab's space, and the sign-in after it arrives the same way. With
 * sign-in off there is no Sign out to press, so "sign out; sign in" is a new arriving tab, one of
 * them carrying a stale `tmi_last_org` cookie to prove the server's choice outranks the browser's.
 */
test.describe('S4: land in the last space chosen (own people)', () => {
  let counter = 0;

  interface Cast {
    owner: string;
    member: string;
    spaces: { slug: string; name: string }[];
    /** The owner, inside each space (for adding, suspending, removing, deleting). */
    ownerIn: Page[];
    memberId: string[];
  }

  const signupAdult = async (page: Page, email: string, name: string) =>
    unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: name,
          birth_year: 1984,
          birth_month: 5,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      `signing up ${email}`,
    );

  /** Owner and member, in `count` spaces the owner made; the member has no last choice. */
  async function cast(page: Page, as: (who: any, o?: any) => Promise<Page>, count: number): Promise<Cast> {
    const id = `${Date.now().toString(36)}${(counter++).toString(36)}`;
    const owner = `landing.owner.${id}@example.com`;
    const member = `landing.member.${id}@example.com`;
    await signupAdult(page, owner, 'Olga Owner');
    await signupAdult(page, member, 'Lena Lander');

    const ownerBare = await as('admin', { email: owner, org: null });
    const spaces: Cast['spaces'] = [];
    for (const word of ['Alder', 'Birch', 'Cedar'].slice(0, count)) {
      const name = `${word} Landing ${id}`;
      const made = await unwrap<any>(await ownerBare.request.post('/api/spaces', { data: { name } }), `making ${name}`);
      spaces.push({ slug: made.slug, name });
    }

    const ownerIn: Page[] = [];
    const memberId: string[] = [];
    for (const space of spaces) {
      const inside = await as('admin', { email: owner, org: space.slug });
      ownerIn.push(inside);
      const added = await unwrap<any>(
        await inside.request.post('/api/users', { data: { full_name: 'Lena Lander', email: member, roles: ['parent'] } }),
        `inviting the member to ${space.name}`,
      );
      memberId.push(added.id);
    }

    const memberBare = await as('admin', { email: member, org: null });
    // The member's own space (Phase 63, P13) goes: these checks are about the spaces made here.
    await dropPersonalSpace(memberBare);
    for (const space of spaces) {
      await unwrap(await memberBare.request.post(`/api/auth/invitations/${space.slug}/accept`), `accepting ${space.name}`);
    }
    // Been through the welcome wizard (it is per person), so a first visit opens nothing over the page.
    const memberIn = await as('admin', { email: member, org: spaces[0]!.slug });
    await unwrap(await memberIn.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'the wizard');
    await unwrap(await memberBare.request.put('/api/auth/default-organization', { data: { slug: null } }), 'no last choice');

    const start = await session(memberBare);
    expect(start.memberships.map((m: any) => m.slug).sort()).toEqual(spaces.map((s) => s.slug).sort());
    expect(start.memberships.filter((m: any) => m.is_default)).toEqual([]);
    expect(start.invitations).toEqual([]);
    return { owner, member, spaces, ownerIn, memberId };
  }

  /** Best effort: the spaces go with everything in them, then both accounts. */
  async function tidy(as: (who: any, o?: any) => Promise<Page>, c: Cast | undefined) {
    if (!c) return;
    for (const [i, space] of c.spaces.entries()) {
      await c.ownerIn[i]!.request.delete('/api/organization', { data: { confirm_name: space.name } }).catch(() => undefined);
    }
    for (const email of [c.member, c.owner]) {
      await (await as('admin', { email, org: null })).request.delete('/api/auth/account').catch(() => undefined);
    }
  }

  /** An arriving tab: no space of its own, optionally a browser cookie from an earlier visit. */
  async function arrive(as: (who: any, o?: any) => Promise<Page>, email: string, opts: { cookie?: string; path?: string } = {}) {
    const tab = await as('admin', { email, org: null });
    if (opts.cookie) {
      await tab.context().addCookies([{ name: 'tmi_last_org', value: opts.cookie, url: test.info().project.use.baseURL! }]);
    }
    await tab.goto(opts.path ?? '/');
    return tab;
  }

  const switcher = (page: Page) => page.getByTestId('org-switcher').filter({ visible: true }).first();

  /** The space this tab is in (the page wrote its cookie, which page.request sends). */
  const here = async (page: Page) => (await session(page)).organization?.slug ?? null;

  async function expectIn(page: Page, space: { slug: string; name: string }) {
    await expect(page).not.toHaveURL(/\/spaces/);
    await expect(switcher(page)).toContainText(space.name, { timeout: 15_000 });
    await expect.poll(() => here(page)).toBe(space.slug);
  }

  async function expectSelector(page: Page) {
    await expect(page).toHaveURL(/\/spaces$/);
    await expect(page.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
  }

  const openFromSelector = (page: Page, space: { slug: string; name: string }) =>
    page.getByTestId(`org-${space.slug}`).getByRole('button', { name: new RegExp(`^${space.name}`) }).click();

  test('choose B; sign out and in: B. Switch to A; sign out and in: A', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // No last choice and two spaces: the selector. Choose B.
      const first = await arrive(as, c.member);
      await expectSelector(first);
      await expect(first.getByTestId(`org-${a.slug}`)).toBeVisible();
      await openFromSelector(first, b);
      await expectIn(first, b);
      await expect.poll(() => lastChoice(first)).toEqual([b.slug]);

      // Signed out and in again, in the same browser (its cookie says B too): B, not the selector.
      await first.evaluate(() => sessionStorage.removeItem('tmi_org'));
      await first.request.post('/api/auth/logout');
      await first.goto('/');
      await expectIn(first, b);

      // On another browser that was last in A: still B -- the server's choice outranks the cookie.
      const second = await arrive(as, c.member, { cookie: a.slug });
      await expectIn(second, b);

      // Switch to A in the switcher: A becomes the last choice.
      await switcher(second).click();
      await second.getByRole('menuitem', { name: new RegExp(a.name) }).click();
      await expectIn(second, a);
      await expect.poll(() => lastChoice(second)).toEqual([a.slug]);

      // Signed out and in again (a browser last in B, this time): A.
      const third = await arrive(as, c.member, { cookie: b.slug });
      await expectIn(third, a);
      expect(await lastChoice(third)).toEqual([a.slug]);
    } finally {
      await tidy(as, c);
    }
  });

  test('across clients: the choice is the server’s, so web and app land in the same space', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // Chosen on the web.
      const web = await arrive(as, c.member);
      await expectSelector(web);
      await openFromSelector(web, b);
      await expectIn(web, b);

      // The app signs in: it names no space and has no cookie, reads the session and lands by the
      // shared rule (apps/mobile landingFor -> decideLanding). The server says B.
      const app = await as('admin', { email: c.member, org: null });
      const appSession = await session(app);
      expect(appSession.organization ?? null).toBeNull();
      expect(decideLanding(appSession)).toBe(b.slug);

      // And the other way: the app opens A (POST /auth/enter with its X-Organization header, as the
      // app sends it); the next web sign-in lands in A.
      const entered = await app.request.post('/api/auth/enter', { headers: { 'X-Organization': a.slug } });
      expect(entered.status()).toBe(200);
      expect(await lastChoice(app)).toEqual([a.slug]);
      const later = await arrive(as, c.member, { cookie: b.slug });
      await expectIn(later, a);
    } finally {
      await tidy(as, c);
    }
  });

  test('the last space removed: the selector when two remain; a tab sitting in it lands by the rule', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 3);
      const [x, y, z] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0], Cast['spaces'][0]];

      // Z is the last choice, and a tab sits in it.
      const inZ = await arrive(as, c.member, { path: `/?org=${z.slug}` });
      await expectIn(inZ, z);
      await expect.poll(() => lastChoice(inZ)).toEqual([z.slug]);

      // Z's admin removes the member.
      await unwrap(await c.ownerIn[2]!.request.delete(`/api/users/${c.memberId[2]}`), 'removing the member from Z');

      // Arriving: Z is gone and X and Y remain -- the selector, without Z.
      const after = await arrive(as, c.member, { cookie: z.slug });
      await expectSelector(after);
      await expect(after.getByTestId(`org-${x.slug}`)).toBeVisible();
      await expect(after.getByTestId(`org-${y.slug}`)).toBeVisible();
      await expect(after.getByTestId(`org-${z.slug}`)).toHaveCount(0);
      expect(await lastChoice(after)).toEqual([]);

      // The tab that was in Z, reloaded: it may not enter Z any more, so it lands by the rule too.
      await inZ.reload();
      await expectSelector(inZ);
      await expect(inZ.getByTestId(`org-${z.slug}`)).toHaveCount(0);

      // Entering Z by hand is refused.
      expect((await after.request.post('/api/auth/enter', { headers: { 'X-Organization': z.slug } })).status()).toBe(403);
    } finally {
      await tidy(as, c);
    }
  });

  test('the last space suspended: straight into the single remaining space, which becomes the last choice', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [x, y] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      const inY = await arrive(as, c.member, { path: `/?org=${y.slug}` });
      await expectIn(inY, y);
      await expect.poll(() => lastChoice(inY)).toEqual([y.slug]);

      // Y's admin suspends the member there.
      await unwrap(
        await c.ownerIn[1]!.request.patch(`/api/users/${c.memberId[1]}`, { data: { status: 'suspended' } }),
        'suspending the member in Y',
      );
      const bare = await as('admin', { email: c.member, org: null });
      const suspended = (await session(bare)).memberships.find((m: any) => m.slug === y.slug);
      expect(suspended?.status).toBe('suspended');

      // Arriving: one space they may enter, nothing pending -- X, with no selector.
      const after = await arrive(as, c.member, { cookie: y.slug });
      await expectIn(after, x);
      await expect.poll(() => lastChoice(after)).toEqual([x.slug]);

      // The older app's star cannot point at the suspended space either.
      expect((await after.request.put('/api/auth/default-organization', { data: { slug: y.slug } })).status()).toBe(404);
    } finally {
      await tidy(as, c);
    }
  });

  test('a link to A while the last choice is B: A, and A becomes the last choice', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // B is the last choice (opened on some device).
      const device = await as('admin', { email: c.member, org: null });
      await unwrap(await device.request.post('/api/auth/enter', { headers: { 'X-Organization': b.slug } }), 'entering B');
      expect(await lastChoice(device)).toEqual([b.slug]);

      // A link naming A (a notification email's): A, and the address loses its ?org=.
      const linked = await arrive(as, c.member, { path: `/profile?org=${a.slug}`, cookie: b.slug });
      await expect(linked).toHaveURL(/\/profile$/);
      await expect(switcher(linked)).toContainText(a.name, { timeout: 15_000 });
      await expect.poll(() => here(linked)).toBe(a.slug);
      await expect.poll(() => lastChoice(linked)).toEqual([a.slug]);

      // The next arrival, with no link: A.
      const next = await arrive(as, c.member, { cookie: b.slug });
      await expectIn(next, a);

      // A link to a space they may not enter is passed over: the last choice still decides.
      const elsewhere = await arrive(as, c.member, { path: `/?org=${ORGS.a.slug}` });
      await expectIn(elsewhere, a);
      expect(await lastChoice(elsewhere)).toEqual([a.slug]);
    } finally {
      await tidy(as, c);
    }
  });

  test('a link survives a redirect provider’s sign-in: the button carries it, and the return lands in it', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // B is the last choice.
      const device = await as('admin', { email: c.member, org: null });
      await unwrap(await device.request.post('/api/auth/enter', { headers: { 'X-Organization': b.slug } }), 'entering B');
      expect(await lastChoice(device)).toEqual([b.slug]);

      // Signed out, at an address offering Microsoft (a redirect provider), she opens a link naming A.
      const tab = await as('admin', { email: c.member, org: null });
      await tab.route('**/api/auth/session', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }),
        }),
      );
      await tab.route('**/api/auth/config', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.data.providers = [{ id: 'microsoft', label: 'Microsoft' }];
        body.data.google_client_id ??= 'e2e-client.apps.googleusercontent.com';
        await route.fulfill({ response, json: body });
      });
      await tab.goto(`/profile?org=${a.slug}`);
      await expect(tab).toHaveURL(/\/login/);

      // The Microsoft button's return address still names A...
      const button = tab.getByTestId('provider-buttons').getByRole('link', { name: /Microsoft/ });
      const href = await button.getAttribute('href');
      const returnTo = new URL(href!, 'http://localhost').searchParams.get('return');
      expect(returnTo).toContain(`org=${a.slug}`);

      // ...so the provider's callback, a full load of that address signed in, lands in A.
      await tab.unroute('**/api/auth/session');
      await tab.unroute('**/api/auth/config');
      await tab.goto(returnTo!);
      await expectIn(tab, a);
      await expect.poll(() => lastChoice(tab)).toEqual([a.slug]);
    } finally {
      await tidy(as, c);
    }
  });

  test('a tab whose session ended elsewhere arrives afresh on signing in again: the last choice, not its old space', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // Tab 2 sits in A.
      const tab2 = await arrive(as, c.member, { path: `/?org=${a.slug}` });
      await expectIn(tab2, a);

      // Tab 1, in the same browser, arrives (A, the last choice) and switches to B.
      const tab1 = await tab2.context().newPage();
      await tab1.goto('/');
      await expectIn(tab1, a);
      await switcher(tab1).click();
      await tab1.getByRole('menuitem', { name: new RegExp(b.name) }).click();
      await expectIn(tab1, b);
      await expect.poll(() => lastChoice(tab1)).toEqual([b.slug]);

      // Tab 1 signs out, which ends the browser's session: tab 2's next request is a 401.
      await tab2.route('**/api/**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }),
        }),
      );
      await tab2.getByRole('link', { name: 'My profile' }).first().dispatchEvent('click');
      await expect(tab2).toHaveURL(/\/login/, { timeout: 15_000 });

      // She signs in again from tab 2 (a full load, as a redirect provider's return is): B.
      await tab2.unroute('**/api/**');
      const entered = firstEnter(tab2);
      await tab2.goto('/');
      await expectIn(tab2, b);
      // Arriving: its first entry after signing in is an opening (S9's `opened: false` is a reload's).
      expect((await entered).postDataJSON()?.opened).not.toBe(false);
      expect(await lastChoice(tab2)).toEqual([b.slug]);
    } finally {
      await tidy(as, c);
    }
  });

  test('somebody else signing in where a tab sat in A lands in their own last space, and it is counted', async ({ page, as }) => {
    let c: Cast | undefined;
    try {
      c = await cast(page, as, 2);
      const [a, b] = c.spaces as [Cast['spaces'][0], Cast['spaces'][0]];

      // The owner (in A and B too) has been through the wizard, and B is her last choice.
      const ownerBare = await as('admin', { email: c.owner, org: null });
      await unwrap(await c.ownerIn[0]!.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'the wizard');
      await unwrap(await ownerBare.request.put('/api/auth/default-organization', { data: { slug: b.slug } }), 'her last choice');

      // The member's tab sits in A.
      const tab = await arrive(as, c.member, { path: `/?org=${a.slug}` });
      await expectIn(tab, a);
      await expect.poll(() => lastChoice(tab)).toEqual([a.slug]);

      // Her session ends elsewhere: the tab's next request is a 401.
      await tab.route('**/api/**', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }),
        }),
      );
      await tab.getByRole('link', { name: 'My profile' }).first().dispatchEvent('click');
      await expect(tab).toHaveURL(/\/login/, { timeout: 15_000 });

      // The owner signs in in that same tab: her own last space, B, not the member's A.
      await tab.unroute('**/api/**');
      await tab.context().setExtraHTTPHeaders({ 'X-Dev-User': c.owner });
      const entered = firstEnter(tab);
      await tab.goto('/');
      await expectIn(tab, b);
      expect((await entered).postDataJSON()?.opened).not.toBe(false);
      expect(await lastChoice(tab)).toEqual([b.slug]);
    } finally {
      await tidy(as, c);
    }
  });
});

/** The tab's next POST /api/auth/enter. */
const firstEnter = (page: Page) =>
  page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/auth/enter', { timeout: 20_000 });

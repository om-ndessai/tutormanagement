import type { APIRequestContext, Page, PlaywrightWorkerArgs } from '@playwright/test';
import { expect, test, type AsOptions } from '../support/fixtures.js';
import { personalSpaceOf, unwrap } from '../support/api.js';
import type { PersonKey } from '../support/people.js';

/**
 * Phase 80 (A12, A13, docs/members-plan.md): under Post-approved a sign-up makes no space of its own; a platform admin
 * who approves it may place the person in a space. Someone placed in a space made in the console lands there and is
 * OFFERED a space of their own on their home -- Make my space, or No thanks -- and "Make my own space" stays on Spaces
 * for anyone who signed up themselves and has none (a teen's only door). Someone placed in a self-started space has a
 * request waiting, and lands on Spaces. Locally sign-in is off: a newcomer signs up with a developer address and is
 * "signed in" by X-Dev-User.
 *
 * Serial: the platform's Sign-up access, set to Post-approved and put back to Open.
 */
test.describe.configure({ mode: 'serial' });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const LEGAL = { terms_version: '2026-11-01', privacy_version: '2026-11-01', birth_year: 1990, birth_month: 3 };
const fresh = (tag: string) => `${tag}-${Date.now().toString(36)}`;

async function setMode(platform: { request: APIRequestContext }, mode: 'open' | 'preapproved' | 'postapproved') {
  return unwrap<any>(await platform.request.put('/api/platform/access', { data: { mode } }), `mode ${mode}`);
}

async function signUp(request: APIRequestContext, email: string, name: string, birthYear = 1990) {
  return request.post('/api/auth/signup', { data: { ...LEGAL, birth_year: birthYear, dev_email: email, dev_name: name } });
}

type As = (who: PersonKey, options?: AsOptions) => Promise<Page>;

/**
 * A waiting sign-up, approved by the console into `space` (as a member): what Phase 80's approve sheet sends. The
 * console's own sheet is access.spec.ts's.
 */
async function approvedInto(
  as: As,
  playwright: PlaywrightWorkerArgs['playwright'],
  space: { id: string },
  person: { email: string; name: string; birthYear?: number },
) {
  const platform = await as('platformAdmin', { org: null });
  await setMode(platform, 'postapproved');
  const request = await playwright.request.newContext({ baseURL: BASE });
  expect((await signUp(request, person.email, person.name, person.birthYear)).status()).toBe(403);
  await request.dispose();
  const waiting = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).waiting;
  const account = waiting.find((row: any) => row.email === person.email);
  await unwrap(
    await platform.request.put(`/api/platform/access/accounts/${account.user_id}`, {
      data: { access: 'approved', space: { organization_id: space.id, role: 'member' } },
    }),
    `approving ${person.name} into the space`,
  );
  return as('student', { email: person.email, org: null });
}

/** A space made in the console: an approval joins the person to it at once. */
async function consoleSpace(as: As, stamp: string) {
  const platform = await as('platformAdmin', { org: null });
  return unwrap<any>(
    await platform.request.post('/api/platform/organizations', {
      data: { name: `Offer Hall ${stamp}`, short_name: 'Offer Hall', slug: `p80-offer-${stamp}` },
    }),
    'the console space',
  );
}

/** The short name a space wears in the switcher, from the person's own session. */
async function shortNameOf(page: Page, slug: string): Promise<string> {
  const session = await unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
  return session.memberships.find((m: any) => m.slug === slug).short_name;
}

const switcher = (page: Page) => page.getByTestId('org-switcher').filter({ visible: true }).first();

test.describe('a space of their own, offered (Phase 80)', () => {
  test.afterAll(async ({ as }) => {
    await setMode(await as('platformAdmin', { org: null }), 'open');
  });

  test('Phase 80 UI: placed in a console space, they land there and are offered a space of their own; Make my space, then Open it, goes there', async ({
    as,
    playwright,
  }) => {
    const stamp = fresh('make');
    const space = await consoleSpace(as, stamp);
    const page = await approvedInto(as, playwright, space, { email: `${stamp}@example.com`, name: 'Owen Offered' });

    await page.goto('/');
    // Placed in a console space: they land in it.
    await expect(page.getByTestId('member-home')).toBeVisible();
    await expect(switcher(page)).toContainText('Offer Hall');
    const card = page.getByTestId('home-personal-offer');
    await expect(card).toContainText('Want a space of your own too?');
    await expect(card.getByTestId('home-personal-offer-text')).toHaveText(
      `You're in ${space.name}. A space of your own is for practising on your own, or with your family later.`,
    );

    await card.getByTestId('home-personal-offer-make').click();
    await expect(page.getByText('Your own space is ready.')).toBeVisible();
    // Answered: the card is put away.
    await expect(card).toHaveCount(0);
    const own = await personalSpaceOf(page);
    const short = await shortNameOf(page, own.slug);

    // Open it reloads the page, in the new space.
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Open it' }).click();
    await reloaded;
    await expect(page.getByTestId('member-home')).toBeVisible();
    await expect(switcher(page)).toContainText(short);
    await expect(page.getByTestId('home-personal-offer')).toHaveCount(0);

    // Spaces lists it as their own, and has no door to a second one.
    await page.goto('/spaces');
    await expect(page.getByTestId(`org-${own.slug}`)).toContainText('Just you');
    await expect(page.getByTestId('welcome-make-own')).toHaveCount(0);
  });

  test('Phase 80 UI: No thanks puts the offer away; Spaces keeps "Make my own space", which makes it and opens it', async ({
    as,
    playwright,
  }) => {
    const stamp = fresh('nothanks');
    const space = await consoleSpace(as, stamp);
    const page = await approvedInto(as, playwright, space, { email: `${stamp}@example.com`, name: 'Nell Nothanks' });

    await page.goto('/');
    const card = page.getByTestId('home-personal-offer');
    await expect(card).toBeVisible();
    await card.getByTestId('home-personal-offer-no').click();
    await expect(card).toHaveCount(0);
    // A preference, kept: not offered again.
    await page.reload();
    await expect(page.getByTestId('member-home')).toBeVisible();
    await expect(page.getByTestId('home-personal-offer')).toHaveCount(0);

    // Spaces still has the door, below the space they are in.
    await page.goto('/spaces');
    await expect(page.getByTestId(`org-${space.slug}`)).toBeVisible();
    const door = page.getByTestId('welcome-make-own');
    await expect(door).toContainText('A space of your own');
    await expect(door).toContainText('Just for you: practise on your own, or with your family later.');
    await door.getByTestId('welcome-make-own-submit').click();

    // Made, and opened at once.
    await page.waitForURL((url) => url.pathname === '/');
    const own = await personalSpaceOf(page);
    await expect(switcher(page)).toContainText(await shortNameOf(page, own.slug));
    await page.goto('/spaces');
    await expect(page.getByTestId(`org-${own.slug}`)).toContainText('Just you');
    await expect(page.getByTestId('welcome-make-own')).toHaveCount(0);
  });

  test('Phase 80 UI: a 13-17 placed in a self-started space lands on Spaces, with the request waiting and "Make my own space"', async ({
    as,
    playwright,
  }) => {
    const stamp = fresh('teen');
    // A self-started space: an adult who signed up while sign-up was open starts it.
    const platform = await as('platformAdmin', { org: null });
    await setMode(platform, 'open');
    const makerEmail = `maker-${stamp}@example.com`;
    const request = await playwright.request.newContext({ baseURL: BASE });
    expect((await signUp(request, makerEmail, 'Moss Maker')).status()).toBe(201);
    await request.dispose();
    const maker = await as('admin', { email: makerEmail, org: null });
    const made = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name: `Offer Den ${stamp}` } }), 'the self-started space');
    const offered = await unwrap<any[]>(await platform.request.get('/api/platform/access/spaces'), 'the spaces to place in');
    const den = offered.find((space: any) => space.name === made.name);

    const page = await approvedInto(as, playwright, den, { email: `${stamp}@example.com`, name: 'Tess Teen', birthYear: 2011 });
    await page.goto('/');
    // In no space yet: Spaces, with the request the approval filed for them.
    await expect(page).toHaveURL(/\/spaces$/);
    await expect(page.getByTestId(`welcome-request-${made.slug}`)).toContainText(made.name);
    // A teen cannot start a shared space; a space of their own is their door.
    await expect(page.getByTestId('welcome-make')).toHaveCount(0);
    const door = page.getByTestId('welcome-make-own');
    await expect(door).toBeVisible();
    await door.getByTestId('welcome-make-own-submit').click();

    await page.waitForURL((url) => url.pathname === '/');
    const own = await personalSpaceOf(page);
    await expect(switcher(page)).toContainText(await shortNameOf(page, own.slug));
    // The request is still waiting for the space's admins.
    await page.goto('/spaces');
    await expect(page.getByTestId(`welcome-request-${made.slug}`)).toBeVisible();
    await expect(page.getByTestId('welcome-make-own')).toHaveCount(0);
  });
});

/**
 * Phase 80 (A12), at the API: POST /api/spaces/personal { make } answers the offer on the person's own account. Make
 * claims it once (a compare-and-set: a second make is 409) and leaves them where they are; No thanks puts it away, and
 * making one later still works; someone a space added has no account of their own (403); a teen's space takes nobody
 * by code.
 */
test.describe('a space of their own, offered (Phase 80): the API', () => {
  test.afterAll(async ({ as }) => {
    await setMode(await as('platformAdmin', { org: null }), 'open');
  });

  const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
  const answer = (page: Page, make: boolean) => page.request.post('/api/spaces/personal', { data: { make } });

  test('Phase 80 API: make is 201 and a space of their own, where they stay put; a second make is 409', async ({ as, playwright }) => {
    const stamp = fresh('apimake');
    const space = await consoleSpace(as, stamp);
    const page = await approvedInto(as, playwright, space, { email: `${stamp}@example.com`, name: 'Mae Maker' });
    const before = await session(page);
    expect(before.personal_space_offer).toBe(true);
    expect(before.memberships).toEqual([expect.objectContaining({ slug: space.slug, roles: [], status: 'active', is_default: true })]);

    const made = await answer(page, true);
    expect(made.status()).toBe(201);
    const result = (await made.json()).data;
    expect(result).toEqual({ made: true, slug: expect.any(String), name: "Mae's space" });

    const after = await session(page);
    expect(after.personal_space_offer).toBe(false);
    expect(after.memberships.find((m: any) => m.slug === result.slug)).toMatchObject({
      roles: ['admin'],
      status: 'active',
      personal: true,
      is_default: false,
    });
    // They stay where they were placed.
    expect(after.memberships.find((m: any) => m.slug === space.slug)).toMatchObject({ is_default: true });
    const log = await unwrap<any[]>(
      await page.request.get('/api/audit?action=account.personal_space', { headers: { 'X-Organization': result.slug } }),
      'the new space’s log',
    );
    expect(log.map((event: any) => event.description)).toContain('Mae Maker made their own space');

    const again = await answer(page, true);
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe('conflict');
    expect((await session(page)).memberships.filter((m: any) => m.personal)).toHaveLength(1);
  });

  test('Phase 80 API: no thanks puts the offer away, and making one later still works', async ({ as, playwright }) => {
    const stamp = fresh('apino');
    const space = await consoleSpace(as, stamp);
    const page = await approvedInto(as, playwright, space, { email: `${stamp}@example.com`, name: 'Ned Nothanks' });

    const no = await answer(page, false);
    expect(no.status()).toBe(200);
    expect(await no.json()).toEqual({ data: { made: false, slug: null, name: null } });
    const declined = await session(page);
    expect(declined.personal_space_offer).toBe(false);
    expect(declined.memberships.map((m: any) => m.slug)).toEqual([space.slug]);
    // Saying it twice changes nothing.
    expect((await answer(page, false)).status()).toBe(200);

    const made = await answer(page, true);
    expect(made.status()).toBe(201);
    expect((await made.json()).data).toMatchObject({ made: true, name: "Ned's space" });
    expect((await session(page)).memberships).toHaveLength(2);
  });

  test('Phase 80 API: someone a space added has no account of their own to answer for (403); someone who has a space of their own gets 409', async ({ as, playwright }) => {
    // Anita was added by CHMI: no platform account.
    const parent = await as('parent', { org: null });
    for (const make of [true, false]) {
      const refused = await answer(parent, make);
      expect(refused.status(), `make: ${make}`).toBe(403);
      expect((await refused.json()).error.code).toBe('forbidden');
    }
    expect((await session(parent)).personal_space_offer).toBe(false);

    // Signed up while it was open: their own space was made at sign-up, and there is nothing to offer.
    const platform = await as('platformAdmin', { org: null });
    await setMode(platform, 'open');
    const email = `${fresh('apiown')}@example.com`;
    const request = await playwright.request.newContext({ baseURL: BASE });
    expect((await signUp(request, email, 'Oona Own')).status()).toBe(201);
    await request.dispose();
    const oona = await as('admin', { email, org: null });
    expect((await session(oona)).personal_space_offer).toBe(false);
    const second = await answer(oona, true);
    expect(second.status()).toBe(409);
    await personalSpaceOf(oona);
  });

  test('Phase 80 API: a teen’s space of their own takes nobody by code', async ({ as, playwright }) => {
    const stamp = fresh('apiteen');
    const space = await consoleSpace(as, stamp);
    const page = await approvedInto(as, playwright, space, { email: `${stamp}@example.com`, name: 'Tia Teen', birthYear: 2011 });
    expect((await session(page)).personal_space_offer).toBe(true);

    const made = await answer(page, true);
    expect(made.status()).toBe(201);
    const { slug } = (await made.json()).data;
    const headers = { 'X-Organization': slug };
    const code = await unwrap<any>(await page.request.get('/api/organization/code', { headers }), 'the space’s code');
    expect(code).toEqual({ code: null, join_by_code: false });
    expect((await page.request.put('/api/organization/code', { headers, data: { join_by_code: true } })).status()).toBe(403);
  });
});

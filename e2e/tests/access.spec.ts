import type { APIRequestContext, Page } from '@playwright/test';
import { PLACEMENT_QUEST_OFF, placementWords } from '@tmi/shared';
import { TEEN_ADMIN_MESSAGE, letInStartRole } from '@tmi/shared';
import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { localSql } from '../support/local-sql.js';

/**
 * Phase 65 (docs/access-approval-plan.md): who may sign up -- the console's Sign-up access. A1 the
 * mode, A2/A3 the platform's list (Pre-approved: refused before anything is stored), A4/A5 Post-approved
 * (the account waits; refused at sign-up, at sign-in and on every request until approved; revoked on the
 * next request), A6 the console's waiting list and decisions, A7 the web's screens. Locally sign-in is off,
 * so a newcomer signs up with a developer address and is "signed in" by X-Dev-User.
 *
 * Serial: the platform's mode, set and put back to Open.
 */
test.describe.configure({ mode: 'serial' });

const LEGAL = { terms_version: '2026-11-01', privacy_version: '2026-11-01', birth_year: 1990, birth_month: 3 };
const fresh = (tag: string) => `${tag}-${Date.now().toString(36)}`;

async function setMode(platform: { request: APIRequestContext }, mode: 'open' | 'preapproved' | 'postapproved') {
  return unwrap<any>(await platform.request.put('/api/platform/access', { data: { mode } }), `mode ${mode}`);
}

async function signUp(request: APIRequestContext, email: string, name: string) {
  return request.post('/api/auth/signup', { data: { ...LEGAL, dev_email: email, dev_name: name } });
}

async function guestPlayOn(platform: { request: APIRequestContext }) {
  const now = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console');
  await unwrap(await platform.request.put('/api/platform/guest', { data: { ...now.settings, enabled: true } }), 'guest play on');
}

async function signedOut(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }) }),
  );
}

test.describe('sign-up access', () => {
  test.afterAll(async ({ as }) => {
    await setMode(await as('platformAdmin', { org: null }), 'open');
  });

  test('A1-A5: Pre-approved refuses before storing; Post-approved waits, then approval and revoking take effect at once', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    // Nobody's context: the newcomer's requests name them alone (X-Dev-User once, per request).
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' });

    // Open by default; only platform admins read or change it.
    expect((await setMode(platform, 'open')).settings.mode).toBe('open');
    const tutor = await as('tutor', { org: null });
    expect((await tutor.request.get('/api/platform/access')).status()).toBe(403);
    expect((await tutor.request.put('/api/platform/access', { data: { mode: 'open' } })).status()).toBe(403);

    // Pre-approved: not on the list, refused -- and nothing kept, so the same address may sign up once listed.
    await setMode(platform, 'preapproved');
    const listed = `${fresh('lee')}@listed.example`;
    const refused = await signUp(request, listed, 'Lee Listed');
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('not_on_list');
    expect((await platform.request.post('/api/platform/access/list', { data: { email: 'nope' } })).status()).toBe(422);
    const added = await unwrap<any>(await platform.request.post('/api/platform/access/list', { data: { email: '*@listed.example', note: 'e2e' } }), 'listing');
    const entry = added.list.find((row: any) => row.email === '*@listed.example');
    expect(entry.note).toBe('e2e');
    expect((await signUp(request, listed, 'Lee Listed')).status()).toBe(201);
    await unwrap(await platform.request.delete(`/api/platform/access/list/${entry.id}`), 'unlisting');

    // Post-approved: the account is made and waits; no session until a platform admin approves.
    await setMode(platform, 'postapproved');
    const waiting = `${fresh('pat')}@example.com`;
    const pending = await signUp(request, waiting, 'Pat Pending');
    expect(pending.status()).toBe(403);
    const body = await pending.json();
    expect(body.error.code).toBe('access_pending');
    expect(body.error.message).toContain('Thanks, Pat.');
    const pat = await request.get('/api/auth/session', { headers: { 'X-Dev-User': waiting } });
    expect(pat.status()).toBe(403);
    expect((await pat.json()).error.code).toBe('access_pending');

    let console0 = await unwrap<any>(await platform.request.get('/api/platform/access'), 'console');
    const row = console0.waiting.find((account: any) => account.email === waiting);
    expect(row).toMatchObject({ full_name: 'Pat Pending', access: 'pending', age_band: 'adult' });

    console0 = await unwrap<any>(await platform.request.put(`/api/platform/access/accounts/${row.user_id}`, { data: { access: 'approved' } }), 'approving');
    expect(console0.waiting.some((account: any) => account.email === waiting)).toBe(false);
    expect(console0.decided.find((account: any) => account.email === waiting)).toMatchObject({ access: 'approved' });
    expect((await request.get('/api/auth/session', { headers: { 'X-Dev-User': waiting } })).status()).toBe(200);

    // Revoked: refused on the very next request.
    await unwrap(await platform.request.put(`/api/platform/access/accounts/${row.user_id}`, { data: { access: 'declined' } }), 'revoking');
    const revoked = await request.get('/api/auth/session', { headers: { 'X-Dev-User': waiting } });
    expect(revoked.status()).toBe(403);
    expect((await revoked.json()).error.code).toBe('access_declined');

    // Existing accounts are untouched by the mode.
    expect((await tutor.request.get('/api/auth/session')).status()).toBe(200);

    // Each decision and change is on the platform log, naming the person.
    const log = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'platform log');
    const actions = log.map((event: any) => event.action);
    expect(actions).toEqual(
      expect.arrayContaining(['platform.access_updated', 'platform.access_listed', 'platform.access_unlisted', 'platform.access_approved', 'platform.access_declined']),
    );
    expect(log.some((event: any) => event.description === "Approved Pat Pending's access.")).toBe(true);
    await request.dispose();
  });

  test('A6/A7: a newcomer signs up from the guest home and waits; the console approves them', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    await guestPlayOn(platform);
    await setMode(platform, 'postapproved');

    const page = await as('student', { org: null });
    await signedOut(page);
    await page.goto('/');
    await page.getByTestId('guest-sign-in').click();
    const sheet = page.getByTestId('signup-sheet');
    // Signing up says, before the buttons, that a person checks new accounts (JF2) -- not after the whole form.
    await sheet.getByTestId('signup-sheet-to-signup').click();
    await expect(sheet.getByTestId('signup-access-note')).toHaveText(
      'A person at Aimtrue checks every new account before you can sign in, usually within a day.',
    );
    const email = `${fresh('wren')}@example.com`;
    await sheet.getByTestId('signup-dev-email').fill(email);
    await sheet.getByTestId('signup-dev-name').fill('Wren Waiting');
    await sheet.getByTestId('signup-dev-continue').click();
    await sheet.getByTestId('signup-month').click();
    await page.getByRole('option', { name: 'March' }).click();
    await sheet.getByTestId('signup-year').click();
    await page.getByRole('option', { name: '1990' }).click();
    await sheet.getByTestId('signup-accept').check();
    await sheet.getByTestId('signup-submit').click();
    await expect(sheet.getByTestId('access-refused-title')).toHaveText('Waiting for approval');
    await expect(sheet.getByTestId('access-refused-message')).toHaveText(
      'Thanks, Wren. A person at Aimtrue checks every new account, usually within a day. Keep playing meanwhile, and sign in again tomorrow.',
    );
    await expect(sheet.getByRole('link', { name: /Contact us/ })).toHaveAttribute('href', 'mailto:om.ndessai@gmail.com');
    // One heading, and a next step (UI audit JF2): Keep playing leads; the address is shown in full.
    await expect(sheet.getByText('Almost there')).toHaveCount(0);
    await expect(sheet.getByTestId('access-refused-keep-line')).toHaveText('You can keep playing without an account.');
    await expect(sheet.getByTestId('access-refused-contact')).toHaveText('Contact us: om.ndessai@gmail.com');
    await expect(sheet.getByTestId('access-refused-keep-playing')).toBeVisible();

    // The console: Sign-up access in Settings > Guest play, with the waiting count and the row.
    await platform.goto('/platform/settings');
    // The row at the top says who waits, and Review jumps past the tiles to the section.
    await expect(platform.getByTestId('access-jump')).toContainText('Sign-up access: Post-approved');
    await expect(platform.getByTestId('access-jump-waiting')).toContainText('waiting for approval');
    await platform.getByTestId('access-jump-review').click();
    const section = platform.getByTestId('access-section');
    await expect(section).toBeInViewport();
    await expect(section.getByTestId('access-mode-postapproved')).toHaveAttribute('aria-checked', 'true');
    await expect(section.getByTestId('access-waiting-count')).toBeVisible();
    const console0 = await unwrap<any>(await platform.request.get('/api/platform/access'), 'console');
    const wren = console0.waiting.find((account: any) => account.email === email);
    const row = section.getByTestId(`access-waiting-${wren.user_id}`);
    await expect(row).toContainText('Wren Waiting');
    await row.getByTestId(`access-approve-${wren.user_id}`).click();
    // Phase 80 (A15): Approve asks where to place them first; Nowhere (the default) gives them a space of their own.
    await platform.getByTestId('access-approve-sheet').getByTestId('access-approve-confirm').click();
    await expect(row).toHaveCount(0);
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' });
    expect((await request.get('/api/auth/session', { headers: { 'X-Dev-User': email } })).status()).toBe(200);
    await request.dispose();

    // Pre-approved from the console's own controls: the list appears and takes an address.
    await section.getByTestId('access-mode-preapproved').click();
    await expect(section.getByTestId('access-mode-preapproved')).toHaveAttribute('aria-checked', 'true');
    const address = `${fresh('ivy')}@example.com`;
    await section.getByTestId('access-list-add-email').fill(address);
    await section.getByTestId('access-list-add').click();
    await expect(section.getByText(address)).toBeVisible();
    const after = await unwrap<any>(await platform.request.get('/api/platform/access'), 'console');
    const ivy = after.list.find((entry: any) => entry.email === address);
    await section.getByTestId(`access-list-remove-${ivy.id}`).click();
    await expect(section.getByText(address)).toHaveCount(0);
  });
});

/**
 * Phase 80 (A11, A15, docs/members-plan.md): Approve opens a short sheet -- an optional space to place the person in,
 * the role there (Member; Admin only in a space made in the console, never for a 13-17), what will happen in words, and
 * a warning where Quest is off -- and a decided row says where the approval placed them. The same sheet approves a
 * declined account from Recently decided.
 */
test.describe('approved into a space (Phase 80): the console', () => {
  test.afterAll(async ({ as }) => {
    await setMode(await as('platformAdmin', { org: null }), 'open');
  });

  test('Phase 80 UI: Approve opens a sheet: a space to place them in, its role, and what happens, in words', async ({ as, playwright }) => {
    test.slow();
    const platform = await as('platformAdmin', { org: null });
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173' });
    const stamp = fresh('p80ui');

    // The places, made while sign-up is open: a space made in the console, one with Quest off, and one an adult started.
    await setMode(platform, 'open');
    const hall = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', { data: { name: `Placement Hall ${stamp}`, short_name: 'Hall', slug: `p80-hall-${stamp}` } }),
      'the console space',
    );
    const quiet = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: { name: `Placement Quiet ${stamp}`, short_name: 'Quiet', slug: `p80-quiet-${stamp}`, feature_quest: false },
      }),
      'the console space with Quest off',
    );
    const makerEmail = `${fresh('mara')}@example.com`;
    expect((await signUp(request, makerEmail, 'Mara Maker')).status()).toBe(201);
    const maker = await as('admin', { email: makerEmail, org: null });
    const denMade = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name: `Placement Den ${stamp}` } }), 'the self-started space');
    // The sheet's own list, for the self-started space's id.
    const offered = await unwrap<any[]>(await platform.request.get('/api/platform/access/spaces'), 'the spaces to place in');
    const den = offered.find((space: any) => space.name === denMade.name);
    expect(den).toMatchObject({ created_via: 'self_serve' });

    // Two waiting: an adult and a 13-17.
    await setMode(platform, 'postapproved');
    const adaEmail = `${fresh('ada')}@example.com`;
    const tamEmail = `${fresh('tam')}@example.com`;
    expect((await signUp(request, adaEmail, 'Ada Placed')).status()).toBe(403);
    expect((await request.post('/api/auth/signup', { data: { ...LEGAL, birth_year: 2011, dev_email: tamEmail, dev_name: 'Tam Teen' } })).status()).toBe(403);
    await request.dispose();
    const waiting = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).waiting;
    const ada = waiting.find((account: any) => account.email === adaEmail);
    const tam = waiting.find((account: any) => account.email === tamEmail);
    expect(tam).toMatchObject({ age_band: '13-17' });

    await platform.goto('/platform/settings');
    const section = platform.getByTestId('access-section');
    await section.getByTestId(`access-approve-${ada.user_id}`).click();
    const sheet = platform.getByTestId('access-approve-sheet');
    await expect(sheet.getByRole('heading', { name: 'Approve Ada Placed' })).toBeVisible();
    await expect(sheet.getByTestId('access-approve-place-label')).toHaveText('Place them in a space (optional)');
    // Nowhere until a space is chosen: no role, no words.
    const nowhere = sheet.getByTestId('access-approve-nowhere');
    await expect(nowhere).toHaveText('Nowhere: they get a space of their own');
    await expect(nowhere).toHaveAttribute('data-chosen', 'true');
    await expect(sheet.getByTestId('access-approve-role')).toHaveCount(0);
    await expect(sheet.getByTestId('access-approve-words')).toHaveCount(0);

    // The picker searches by name.
    const search = sheet.getByTestId('access-approve-search');
    await search.fill(`Nothing is called this ${stamp}`);
    await expect(sheet.getByTestId('access-approve-none')).toHaveText('No space has that name.');
    await search.fill(stamp);
    for (const space of [hall, quiet, den]) await expect(sheet.getByTestId(`access-approve-space-${space.id}`)).toBeVisible();

    // A console space: Member (the default) or Admin, and they join at once.
    await sheet.getByTestId(`access-approve-space-${hall.id}`).click();
    await expect(sheet.getByTestId(`access-approve-space-${hall.id}`)).toHaveAttribute('data-chosen', 'true');
    await expect(nowhere).toHaveAttribute('data-chosen', 'false');
    await expect(sheet.getByTestId('access-approve-role-member')).toBeChecked();
    await expect(sheet.getByTestId('access-approve-role-admin')).toBeVisible();
    await expect(sheet.getByTestId('access-approve-words')).toHaveText(placementWords({ name: hall.name, created_via: 'console' }, 'Ada'));
    await expect(sheet.getByTestId('access-approve-quest-off')).toHaveCount(0);

    // Quest off there: the warning.
    await sheet.getByTestId(`access-approve-space-${quiet.id}`).click();
    await expect(sheet.getByTestId('access-approve-quest-off')).toHaveText(PLACEMENT_QUEST_OFF);

    // A self-started space: Member only, and its admins are asked to let them in.
    await sheet.getByTestId(`access-approve-space-${den.id}`).click();
    await expect(sheet.getByTestId('access-approve-role-member')).toBeChecked();
    await expect(sheet.getByTestId('access-approve-role-admin')).toHaveCount(0);
    await expect(sheet.getByTestId('access-approve-words')).toHaveText(placementWords({ name: den.name, created_via: 'self_serve' }, 'Ada'));
    await expect(sheet.getByTestId('access-approve-quest-off')).toHaveCount(0);

    // Into the console space, as an admin.
    await sheet.getByTestId(`access-approve-space-${hall.id}`).click();
    await sheet.getByTestId('access-approve-role-admin').check();
    await sheet.getByTestId('access-approve-confirm').click();
    await expect(sheet).toHaveCount(0);
    await expect(section.getByTestId(`access-waiting-${ada.user_id}`)).toHaveCount(0);

    // A 13-17 is never an admin, even of a console space. Declined at once, then approved from Recently decided --
    // the same sheet -- into the self-started space.
    await section.getByTestId(`access-decline-${tam.user_id}`).click();
    await expect(section.getByTestId(`access-waiting-${tam.user_id}`)).toHaveCount(0);
    await section.getByText(/^Recently decided/).click();
    const decidedTam = section.getByTestId(`access-decided-${tam.user_id}`);
    await decidedTam.getByTestId(`access-approve-${tam.user_id}`).click();
    await expect(sheet.getByRole('heading', { name: 'Approve Tam Teen' })).toBeVisible();
    await sheet.getByTestId('access-approve-search').fill(stamp);
    await sheet.getByTestId(`access-approve-space-${hall.id}`).click();
    await expect(sheet.getByTestId('access-approve-role-member')).toBeChecked();
    await expect(sheet.getByTestId('access-approve-role-admin')).toHaveCount(0);
    await sheet.getByTestId(`access-approve-space-${den.id}`).click();
    await expect(sheet.getByTestId('access-approve-words')).toHaveText(placementWords({ name: den.name, created_via: 'self_serve' }, 'Tam'));
    await sheet.getByTestId('access-approve-confirm').click();
    await expect(sheet).toHaveCount(0);

    // Each decided row says where the approval placed them.
    await expect(section.getByTestId(`access-placed-${ada.user_id}`)).toHaveText(`Joined ${hall.name}`);
    await expect(decidedTam.getByTestId(`access-placed-${tam.user_id}`)).toHaveText(`Asked to join ${den.name}`);
  });
});

/**
 * Phase 80 (A10-A14, docs/members-plan.md), at the API. Under Post-approved a sign-up makes no space; approving with no
 * place (what an older console sends) makes the person's own space then; approving into a space made in the console
 * makes them an active member there at once, their default, and offers them a space of their own; approving into a
 * self-started space files a request its admins answer. A place applies only on the change to approved, a membership
 * the space removed is never revived, and Admin is offered only in a console space and never to a 13-17. A self
 * sign-up's name, email and phone are their own (A14). Each test makes its own people; CHMI is the console space.
 */
test.describe('approved into a space (Phase 80): the API', () => {
  const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  const CHMI = 'Chapel Hill Math Institute';
  /** A first name nobody else has, so "<First>'s space" is theirs alone. */
  const uniqueFirst = (tag: string) => `${tag}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  test.afterAll(async ({ as }) => {
    await setMode(await as('platformAdmin', { org: null }), 'open');
  });

  /** A sign-up under Post-approved: refused with access_pending, and on the console's waiting list. */
  async function waitingSignUp(
    platform: Page,
    playwright: { request: { newContext: (options: { baseURL: string }) => Promise<APIRequestContext> } },
    email: string,
    name: string,
    birthYear = 1990,
  ) {
    await setMode(platform, 'postapproved');
    const request = await playwright.request.newContext({ baseURL: BASE });
    const refused = await request.post('/api/auth/signup', { data: { ...LEGAL, birth_year: birthYear, dev_email: email, dev_name: name } });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('access_pending');
    await request.dispose();
    const console0 = await unwrap<any>(await platform.request.get('/api/platform/access'), 'console');
    const account = console0.waiting.find((row: any) => row.email === email);
    expect(account, `${email} waits`).toBeTruthy();
    return account as { user_id: string; full_name: string };
  }

  const decide = (platform: Page, userId: string, data: unknown) =>
    platform.request.put(`/api/platform/access/accounts/${userId}`, { data });

  async function placementSpace(platform: Page, name: string) {
    const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/access/spaces'), 'the spaces to place in');
    const found = spaces.find((space: any) => space.name === name);
    expect(found, `${name} is offered`).toBeTruthy();
    return found as { id: string; name: string; created_via: string };
  }

  /** A space an adult started (sign-up open while they do), with its maker's page inside it. */
  async function selfStartedSpace(as: any, platform: Page, playwright: any, stamp: string) {
    await setMode(platform, 'open');
    const makerEmail = `${stamp}.maker@example.com`;
    const request = await playwright.request.newContext({ baseURL: BASE });
    expect((await signUp(request, makerEmail, 'Mo Maker')).status()).toBe(201);
    await request.dispose();
    const maker = await as('admin', { email: makerEmail, org: null });
    const made = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name: `Den ${stamp}` } }), 'the self-started space');
    const space = await placementSpace(platform, made.name);
    expect(space.created_via).toBe('self_serve');
    return { ...space, slug: made.slug as string, maker: await as('admin', { email: makerEmail, org: made.slug }) };
  }

  const sessionOf = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
  const personalNamed = async (platform: Page, name: string) =>
    (await unwrap<any[]>(await platform.request.get('/api/platform/organizations?personal=1'), 'personal spaces')).filter(
      (space: any) => space.name === name,
    );

  test('Phase 80 API: a Post-approved sign-up makes no space; approving with no place makes exactly one of their own', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const first = uniqueFirst('Nox');
    const email = `${first.toLowerCase()}@example.com`;
    const account = await waitingSignUp(platform, playwright, email, `${first} Noplace`);
    // A10: nothing made while they wait.
    expect(await personalNamed(platform, `${first}'s space`)).toHaveLength(0);

    await unwrap(await decide(platform, account.user_id, { access: 'approved' }), 'approving with no place');
    const person = await as('student', { email, org: null });
    const session = await sessionOf(person);
    expect(session.memberships).toEqual([
      expect.objectContaining({ name: `${first}'s space`, roles: ['admin'], status: 'active', is_default: true, personal: true }),
    ]);
    expect(session.personal_space_offer).toBe(false);
    expect(await personalNamed(platform, `${first}'s space`)).toHaveLength(1);
    // Logged in their space; the platform's line is today's, word for word.
    const slug = session.memberships[0].slug;
    const log = await unwrap<any[]>(
      await person.request.get('/api/audit?action=account.personal_space', { headers: { 'X-Organization': slug } }),
      'their space’s log',
    );
    expect(log.map((event: any) => event.description)).toContain(`${first} Noplace's own space was made when their account was approved`);
    const platformLog = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'platform log');
    expect(platformLog.some((event: any) => event.description === `Approved ${first} Noplace's access.`)).toBe(true);
    // The console's decided row: placed nowhere.
    const decided = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).decided;
    expect(decided.find((row: any) => row.user_id === account.user_id)).toMatchObject({ access: 'approved', placed_in: null });
  });

  test('Phase 80 API: approving into a console space (CHMI) makes them an active member there, their default, offered a space of their own', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const first = uniqueFirst('Cleo');
    const email = `${first.toLowerCase()}@example.com`;
    const name = `${first} Placed`;
    const account = await waitingSignUp(platform, playwright, email, name);
    const chmi = await placementSpace(platform, CHMI);
    expect(chmi.created_via).toBe('console');

    await unwrap(
      await decide(platform, account.user_id, { access: 'approved', space: { organization_id: chmi.id, role: 'member' } }),
      'approving into CHMI',
    );
    const person = await as('student', { email, org: null });
    const session = await sessionOf(person);
    // Joined at once (no acceptance step), with no role, and it is where they land. No space of their own -- offered.
    expect(session.memberships).toEqual([
      expect.objectContaining({ slug: 'chmi', roles: [], status: 'active', is_default: true }),
    ]);
    expect(session.invitations).toEqual([]);
    expect(session.personal_space_offer).toBe(true);
    expect(await personalNamed(platform, `${first}'s space`)).toHaveLength(0);

    // A line in the space's own log, and one on the platform's naming the space.
    const admin = await as('admin');
    const spaceLog = await unwrap<any[]>(await admin.request.get('/api/audit?action=organization.member_added'), 'CHMI’s log');
    expect(spaceLog.map((event: any) => event.description)).toContain(`Approved ${name}'s account and added them to the space as a member`);
    const platformLog = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'platform log');
    expect(platformLog.some((event: any) => event.description === `Approved ${name}'s access, into ${CHMI} as a member.`)).toBe(true);
    const decided = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).decided;
    expect(decided.find((row: any) => row.user_id === account.user_id)).toMatchObject({
      access: 'approved',
      placed_in: { name: CHMI, how: 'joined' },
    });

    // Put back: CHMI's admin removes them.
    const id = session.user.id;
    expect((await admin.request.delete(`/api/users/${id}`)).status()).toBe(200);
  });

  test('Phase 80 API: approving into a self-started space files a request its admin answers (Let in starts on Member); they belong nowhere yet, and may sign in', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const stamp = fresh('p80den');
    const den = await selfStartedSpace(as, platform, playwright, stamp);
    const first = uniqueFirst('Rue');
    const email = `${first.toLowerCase()}@example.com`;
    const name = `${first} Requested`;
    const account = await waitingSignUp(platform, playwright, email, name);

    await unwrap(
      await decide(platform, account.user_id, { access: 'approved', space: { organization_id: den.id, role: 'member' } }),
      'approving into the self-started space',
    );
    // Its admin sees the request: no role asked, so Let in starts on Member.
    const requests = await unwrap<any[]>(await den.maker.request.get('/api/organization/join-requests'), 'the requests');
    const row = requests.find((request: any) => request.user_id === account.user_id);
    expect(row).toMatchObject({ full_name: name, email, role: null, note: null, teen: false });
    expect(letInStartRole(row.role, { teen: row.teen, tutoring: false })).toBe('member');
    const denLog = await unwrap<any[]>(await den.maker.request.get('/api/audit?action=membership.requested'), 'the den’s log');
    expect(denLog.map((event: any) => event.description)).toContain(`${name} was put forward to join ${den.name} when their account was approved`);
    const platformLog = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'platform log');
    expect(platformLog.some((event: any) => event.description === `Approved ${name}'s access, and asked ${den.name} to let them in.`)).toBe(true);
    const decided = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).decided;
    expect(decided.find((r: any) => r.user_id === account.user_id)).toMatchObject({ placed_in: { name: den.name, how: 'requested' } });

    // In no space, with the request waiting, and offered a space of their own.
    const person = await as('student', { email, org: null });
    const session = await sessionOf(person);
    expect(session.memberships).toEqual([]);
    expect(session.join_requests.map((request: any) => request.slug)).toEqual([den.slug]);
    expect(session.personal_space_offer).toBe(true);

    // A13: signing in from a client that does not offer sign-up is no longer refused for being in no space.
    const request = await playwright.request.newContext({ baseURL: BASE });
    const signedIn = await request.post('/api/auth/google', { data: { credential: `fake:google:p80-${first}:${email}:1` } });
    expect(signedIn.status()).toBe(200);
    expect((await signedIn.json()).data).toMatchObject({ user: { email }, memberships: [], personal_space_offer: true });
    await request.dispose();
  });

  test('Phase 80 API: Admin is refused for a 13-17 and in a self-started space; an unknown or personal space is not found', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const den = await selfStartedSpace(as, platform, playwright, fresh('p80adm'));
    const chmi = await placementSpace(platform, CHMI);
    const teenFirst = uniqueFirst('Tal');
    const teen = await waitingSignUp(platform, playwright, `${teenFirst.toLowerCase()}@example.com`, `${teenFirst} Teen`, 2011);
    const adultFirst = uniqueFirst('Ada');
    const adult = await waitingSignUp(platform, playwright, `${adultFirst.toLowerCase()}@example.com`, `${adultFirst} Adult`);

    const asTeenAdmin = await decide(platform, teen.user_id, { access: 'approved', space: { organization_id: chmi.id, role: 'admin' } });
    expect(asTeenAdmin.status()).toBe(422);
    expect((await asTeenAdmin.json()).error.details['space.role']).toEqual([TEEN_ADMIN_MESSAGE]);

    const adminOfDen = await decide(platform, adult.user_id, { access: 'approved', space: { organization_id: den.id, role: 'admin' } });
    expect(adminOfDen.status()).toBe(422);
    expect((await adminOfDen.json()).error.details['space.role']).toEqual(["Only that space's admins can make someone an admin there."]);

    const nowhere = await decide(platform, adult.user_id, { access: 'approved', space: { organization_id: crypto.randomUUID(), role: 'member' } });
    expect(nowhere.status()).toBe(404);
    expect((await nowhere.json()).error.message).toBe('That space was not found.');
    const someonesOwn = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations?personal=1'), 'personal')).find(
      (space: any) => space.personal,
    );
    const intoOwn = await decide(platform, adult.user_id, { access: 'approved', space: { organization_id: someonesOwn.id, role: 'member' } });
    expect(intoOwn.status()).toBe(404);

    // Refused, nothing changed: both still wait.
    const waiting = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).waiting;
    expect(waiting.map((row: any) => row.user_id)).toEqual(expect.arrayContaining([teen.user_id, adult.user_id]));
    // The teen as a member is fine.
    await unwrap(
      await decide(platform, teen.user_id, { access: 'approved', space: { organization_id: den.id, role: 'member' } }),
      'the teen into the den, as a member',
    );
  });

  test('Phase 80 API: a place goes only with the change to approved, and a membership the space removed is never revived', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const chmi = await placementSpace(platform, CHMI);
    const first = uniqueFirst('Rex');
    const email = `${first.toLowerCase()}@example.com`;
    const account = await waitingSignUp(platform, playwright, email, `${first} Removed`);
    const into = { access: 'approved', space: { organization_id: chmi.id, role: 'member' } };
    await unwrap(await decide(platform, account.user_id, into), 'approving into CHMI');

    // Already approved: a place is refused; the decision alone is today's no-op.
    const again = await decide(platform, account.user_id, into);
    expect(again.status()).toBe(409);
    expect((await again.json()).error.message).toBe("Already approved: add them from the space's People.");
    await unwrap(await decide(platform, account.user_id, { access: 'approved' }), 'the same decision again');
    const person = await as('student', { email, org: null });
    expect((await sessionOf(person)).memberships.map((m: any) => m.slug)).toEqual(['chmi']);

    // CHMI's admins remove them; revoked, then approved into CHMI again: refused, in words, and still declined.
    const admin = await as('admin');
    const id = (await sessionOf(person)).user.id;
    expect((await admin.request.delete(`/api/users/${id}`)).status()).toBe(200);
    await unwrap(await decide(platform, account.user_id, { access: 'declined' }), 'revoking');
    const revived = await decide(platform, account.user_id, into);
    expect(revived.status()).toBe(409);
    expect((await revived.json()).error.message).toBe(`${first} was removed from ${CHMI} by its admins.`);
    const decided = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).decided;
    expect(decided.find((row: any) => row.user_id === account.user_id)).toMatchObject({ access: 'declined' });
  });

  test('Phase 80 API: the picker lists live shared spaces only -- not anyone’s own, not an archived one -- to platform admins', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const stamp = fresh('p80gone');
    const gone = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', { data: { name: `Gone Hall ${stamp}`, short_name: 'Gone', slug: stamp } }),
      'a console space',
    );
    let spaces = await unwrap<any[]>(await platform.request.get('/api/platform/access/spaces'), 'the picker');
    expect(spaces.find((space: any) => space.id === gone.id)).toMatchObject({ name: gone.name, created_via: 'console', quest_on: true });
    await unwrap(await platform.request.post(`/api/platform/organizations/${gone.id}/archive`), 'archiving it');

    spaces = await unwrap<any[]>(await platform.request.get('/api/platform/access/spaces'), 'the picker');
    expect(spaces.some((space: any) => space.id === gone.id)).toBe(false);
    const personal = await unwrap<any[]>(await platform.request.get('/api/platform/organizations?personal=1'), 'personal');
    const ownIds = new Set(personal.filter((space: any) => space.personal).map((space: any) => space.id));
    expect(ownIds.size).toBeGreaterThan(0);
    expect(spaces.some((space: any) => ownIds.has(space.id))).toBe(false);
    expect(spaces.find((space: any) => space.name === CHMI)).toMatchObject({ created_via: 'console' });
    // Lean: what the sheet needs and nothing more.
    expect(Object.keys(spaces[0]).sort()).toEqual(
      ['assessment_on', 'created_via', 'id', 'name', 'quest_on', 'short_name', 'tutoring_on'].sort(),
    );
    expect((await (await as('admin', { org: null })).request.get('/api/platform/access/spaces')).status()).toBe(403);
  });

  test('Phase 80 API: a self sign-up’s name, email and phone are their own -- a space’s admin is refused, and they still edit themselves (A14)', async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const chmi = await placementSpace(platform, CHMI);
    const first = uniqueFirst('Lou');
    const email = `${first.toLowerCase()}@example.com`;
    const account = await waitingSignUp(platform, playwright, email, `${first} Locked`);
    await unwrap(
      await decide(platform, account.user_id, { access: 'approved', space: { organization_id: chmi.id, role: 'member' } }),
      'approving into CHMI',
    );
    const admin = await as('admin');
    const person = await as('student', { email, org: null });
    const id = (await sessionOf(person)).user.id;
    // CHMI alone is all they belong to -- before Phase 80 its admins could have changed the address that signs them in.
    const read = await unwrap<any>(await admin.request.get(`/api/users/${id}`), 'CHMI reads them');
    expect(read.shared_fields_locked).toBe(true);
    for (const data of [{ email: `${first.toLowerCase()}.other@example.com` }, { full_name: 'Someone Else' }, { phone: '(919) 555-0180' }]) {
      const refused = await admin.request.patch(`/api/users/${id}`, { data });
      expect(refused.status()).toBe(409);
      const body = await refused.json();
      expect(body.error.code).toBe('shared_fields_locked');
      expect(body.error.message).toBe(
        'This person made their own account, so their name, email and phone are theirs. A platform administrator changes them.',
      );
    }
    // Sending them back unchanged is no change.
    await unwrap(await admin.request.patch(`/api/users/${id}`, { data: { full_name: `${first} Locked`, email } }), 'unchanged');
    expect((await admin.request.delete(`/api/users/${id}`)).status()).toBe(200);

    // The person themselves: an adult who signed up while it was open, in a space they started -- My profile saves.
    await setMode(platform, 'open');
    const selfFirst = uniqueFirst('Sam');
    const selfEmail = `${selfFirst.toLowerCase()}@example.com`;
    const request = await playwright.request.newContext({ baseURL: BASE });
    expect((await signUp(request, selfEmail, `${selfFirst} Self`)).status()).toBe(201);
    await request.dispose();
    const home = await as('admin', { email: selfEmail, org: null });
    const made = await unwrap<any>(await home.request.post('/api/spaces', { data: { name: `Self Den ${selfFirst}` } }), 'their space');
    const inside = await as('admin', { email: selfEmail, org: made.slug });
    const selfId = (await sessionOf(inside)).user.id;
    expect((await unwrap<any>(await inside.request.get(`/api/users/${selfId}`), 'their own record')).shared_fields_locked).toBe(false);
    const renamed = await unwrap<any>(await inside.request.patch(`/api/users/${selfId}`, { data: { full_name: `${selfFirst} Renamed` } }), 'renaming themselves');
    expect(renamed.full_name).toBe(`${selfFirst} Renamed`);
  });

  /**
   * A11's purge. Before Phase 80 a Post-approved sign-up made its own space at once and then waited, so nobody ever
   * opened that space: a waiting account has no session. The API no longer makes such an account, so it is set up by
   * hand: signed up while Open (which makes the space), then put back to waiting in the LOCAL database (localSql).
   * Placed in a console space on approval, the unused space goes, logged on the platform's log. Not @smoke.
   */
  test("Phase 80 API: a pending account's never-opened space from before is removed when it is placed", async ({ as, playwright }) => {
    const platform = await as('platformAdmin', { org: null });
    const chmi = await placementSpace(platform, CHMI);
    const first = uniqueFirst('Pia');
    const email = `${first.toLowerCase()}@example.com`;
    const name = `${first} Before`;
    let userId: string | undefined;
    try {
      // Signed up while Open: the account and a space of their own, as a Post-approved sign-up made them before.
      await setMode(platform, 'open');
      const request = await playwright.request.newContext({ baseURL: BASE });
      expect((await signUp(request, email, name)).status()).toBe(201);
      await request.dispose();
      const person = await as('student', { email, org: null });
      const before = await sessionOf(person);
      userId = before.user.id as string;
      expect(before.memberships).toEqual([
        expect.objectContaining({ name: `${first}'s space`, roles: ['admin'], is_default: true, personal: true }),
      ]);
      const own = before.memberships[0].id as string;
      expect(localSql('SELECT id FROM organizations WHERE id = ?', [own])).toHaveLength(1);

      // Back to waiting, by hand -- and the Worker reads the same database: the console lists them as waiting.
      localSql("UPDATE platform_accounts SET access = 'pending', access_decided_at = NULL, access_decided_by = NULL WHERE user_id = ?", [userId]);
      expect(localSql('SELECT access, personal_offer FROM platform_accounts WHERE user_id = ?', [userId])).toEqual([
        { access: 'pending', personal_offer: null },
      ]);
      const waiting = (await unwrap<any>(await platform.request.get('/api/platform/access'), 'console')).waiting;
      expect(waiting.find((row: any) => row.user_id === userId)).toMatchObject({ full_name: name, access: 'pending' });

      await unwrap(
        await decide(platform, userId, { access: 'approved', space: { organization_id: chmi.id, role: 'member' } }),
        'approving into CHMI',
      );

      // Their own space is gone -- its row and its memberships -- and the console no longer lists it.
      expect(localSql('SELECT id FROM organizations WHERE id = ?', [own])).toEqual([]);
      expect(localSql('SELECT user_id FROM org_members WHERE organization_id = ?', [own])).toEqual([]);
      expect(await personalNamed(platform, `${first}'s space`)).toHaveLength(0);

      // In CHMI at once, with no role, and it is where they land; and offered a space of their own.
      const after = await sessionOf(person);
      expect(after.memberships).toEqual([
        expect.objectContaining({ slug: 'chmi', roles: [], status: 'active', is_default: true }),
      ]);
      expect(after.memberships.some((membership: any) => membership.personal)).toBe(false);
      expect(after.personal_space_offer).toBe(true);
      expect(localSql('SELECT access, personal_offer FROM platform_accounts WHERE user_id = ?', [userId])).toEqual([
        { access: 'approved', personal_offer: 'open' },
      ]);

      // The removal is a platform line (no space: it is gone), naming the person. GET /api/platform/audit lists only
      // organization.%, platform.% and the like, not space.%, so it is read from the table.
      expect(
        localSql(
          'SELECT organization_id, subject_user_id, entity_type, description FROM audit_events WHERE action = ? AND entity_id = ?',
          ['space.deleted', own],
        ),
      ).toEqual([
        {
          organization_id: null,
          subject_user_id: userId,
          entity_type: 'organization',
          description: `${name}'s own space, made at sign-up while they waited and never opened, was removed when their account was approved`,
        },
      ]);
      const platformLog = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'platform log');
      expect(platformLog.some((event: any) => event.description === `Approved ${name}'s access, into ${CHMI} as a member.`)).toBe(true);
    } finally {
      if (userId) {
        // Never leave a hand-made waiting account on the console's list; then CHMI forgets them (a 404 if never placed).
        localSql("UPDATE platform_accounts SET access = 'approved' WHERE user_id = ? AND access = 'pending'", [userId]);
        await (await as('admin')).request.delete(`/api/users/${userId}?hard=true`);
      }
    }
  });
});

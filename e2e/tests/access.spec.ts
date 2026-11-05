import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

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

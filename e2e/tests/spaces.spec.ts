import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';
import type { Page } from '@playwright/test';

/**
 * Open sign-up and spaces (Phase 52, docs/open-signup-plan.md). With sign-in off, `dev_email`
 * stands in for Google on POST /api/auth/signup; everything after it is the real path.
 *
 * The seed: Nina Newcomer (an adult, in no space), Theo Teen (15, asked to join Riverside), and the
 * self-serve space `assess` (code FMXY-2345, joining on). Riverside's code RVRS-2345 is on; the
 * institute's CHMX-2345 is off.
 */

test.describe.configure({ mode: 'serial' });

const stamp = Date.now();
const signup = (page: Page, data: Record<string, unknown>) =>
  page.request.post('/api/auth/signup', {
    data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, birth_month: 6, ...data },
  });

test.describe('signing up (Phase 52)', () => {
  test('under 13 stores nothing; 13-17 may join but not make a space; an adult makes one @smoke', async ({ page, as }) => {
    const kid = `kid.${stamp}@example.com`;
    const refused = await signup(page, { dev_email: kid, birth_year: new Date().getFullYear() - 10 });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('too_young');
    // Nothing was stored: the address is unknown.
    expect((await (await as('admin', { email: kid, org: null })).request.get('/api/auth/session')).status()).toBe(404);

    // A teenager: may ask to join, may not make a space.
    const teen = `teen.${stamp}@example.com`;
    await unwrap(await signup(page, { dev_email: teen, dev_name: 'Tess Teen', birth_year: new Date().getFullYear() - 15 }), 'teen signs up');
    const tess = await as('admin', { email: teen, org: null });
    const session = await unwrap<any>(await tess.request.get('/api/auth/session'), 'session');
    expect(session).toMatchObject({ account: { age_band: '13-17' }, memberships: [], join_requests: [] });
    expect((await tess.request.post('/api/spaces', { data: { name: 'Tess’s club' } })).status()).toBe(403);
    // Riverside's seeded code (the compatibility test runs this on an older seed, which has none).
    if ((await tess.request.post('/api/spaces/lookup', { data: { code: 'rvrs-2345' } })).ok()) {
      await unwrap(await tess.request.post('/api/spaces/join-requests', { data: { code: 'rvrs-2345' } }), 'asks to join');
    }

    // An adult, through the pages: the age question, the terms, then the Welcome page.
    const adult = `adam.adult.${stamp}@example.com`;
    await page.goto(`/signup?dev_email=${encodeURIComponent(adult)}&dev_name=Adam%20Adult`);
    await page.getByTestId('signup-month').click();
    await page.getByRole('option', { name: 'March' }).click();
    await page.getByTestId('signup-year').click();
    await page.getByRole('option', { name: '1985' }).click();
    await page.getByTestId('signup-accept').check();
    await page.getByTestId('signup-submit').click();
    const adam = await as('admin', { email: adult, org: null });
    await adam.goto('/');
    await expect(adam.getByTestId('welcome')).toBeVisible();
    await adam.getByTestId('welcome-space-name').fill('The Adams family');
    await adam.getByTestId('welcome-make-submit').click();
    // In the new space: the Assessment home, and its code on the Space page.
    await expect(adam.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
    const me = await unwrap<any>(await adam.request.get('/api/auth/session'), 'session after');
    const space = me.memberships[0];
    expect(space).toMatchObject({ name: 'The Adams family', roles: ['admin'] });
    expect(space.slug).toMatch(/^s-[a-z2-9]{8}$/);
  });

  test('a code: asking to join, letting in, declining, withdrawing; a new code kills the old', async ({ as }) => {
    const nina = await as('admin', { email: 'nina.newcomer@example.com', org: null });
    // A code with joining off is no code at all.
    expect((await nina.request.post('/api/spaces/lookup', { data: { code: 'CHMX-2345' } })).status()).toBe(404);
    expect((await nina.request.post('/api/spaces/lookup', { data: { code: 'not a code' } })).status()).toBe(422);
    const found = await unwrap<any>(await nina.request.post('/api/spaces/lookup', { data: { code: 'fmxy 2345' } }), 'lookup');
    expect(found).toEqual({ name: 'Ferreira Family Practice', short_name: 'Ferreira', palette: 'platform', logo_mark_url: null, standing: null });

    // Nina asks, through the Welcome page.
    await nina.goto('/');
    await nina.getByTestId('welcome-code').fill('FMXY-2345');
    await nina.getByTestId('welcome-find').click();
    await expect(nina.getByTestId('welcome-found')).toContainText('Ferreira Family Practice');
    await nina.getByTestId('welcome-ask').click();
    await expect(nina.getByTestId('welcome-request-assess')).toBeVisible();

    // Ines lets her in as a parent, from the People page.
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    const requests = await unwrap<any[]>(await ines.request.get('/api/organization/join-requests'), 'requests');
    const request = requests.find((r) => r.email === 'nina.newcomer@example.com');
    expect(request).toMatchObject({ full_name: 'Nina Newcomer' });
    // The address must be the one she asked with.
    const wrong = await ines.request.post('/api/users', {
      data: { full_name: 'Nina', email: 'someone.else@example.com', roles: ['parent'], status: 'active', join_request_user_id: request.user_id },
    });
    expect(wrong.status()).toBe(422);
    await ines.goto('/users');
    await ines.getByTestId(`join-request-let-in-${request.user_id}`).click();
    await ines.getByRole('checkbox', { name: /Parent/ }).check();
    await ines.getByRole('button', { name: /^Save|Add/ }).last().click();
    await expect(ines.getByTestId(`join-request-${request.user_id}`)).toHaveCount(0);
    const ninaSession = await unwrap<any>(await nina.request.get('/api/auth/session'), 'nina after');
    expect(ninaSession.memberships.map((m: any) => m.slug)).toContain(ORGS.c.slug);

    // Riverside declines Theo; he sees it once.
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const theoReq = (await unwrap<any[]>(await rosa.request.get('/api/organization/join-requests'), 'riverside')).find((r) => r.full_name === 'Theo Teen');
    await unwrap(await rosa.request.post(`/api/organization/join-requests/${theoReq.user_id}/decline`), 'decline');
    const theo = await as('admin', { email: 'theo.teen@example.com', org: null });
    expect((await unwrap<any>(await theo.request.get('/api/auth/session'), 'theo')).join_requests).toEqual([
      expect.objectContaining({ slug: ORGS.b.slug, outcome: 'declined' }),
    ]);
    await unwrap(await theo.request.post('/api/spaces/join-requests/seen'), 'seen');
    expect((await unwrap<any>(await theo.request.get('/api/auth/session'), 'theo again')).join_requests).toEqual([]);

    // Asking, then withdrawing.
    await unwrap(await theo.request.post('/api/spaces/join-requests', { data: { code: 'FMXY2345' } }), 'theo asks');
    expect((await theo.request.post('/api/spaces/join-requests', { data: { code: 'FMXY2345' } })).status()).toBe(409);
    await unwrap(await theo.request.delete(`/api/spaces/join-requests/${ORGS.c.slug}`), 'withdraw');

    // A new code: the old one stops working.
    const renewed = await unwrap<any>(await ines.request.post('/api/organization/code'), 'renew');
    expect(renewed.code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect((await theo.request.post('/api/spaces/lookup', { data: { code: 'FMXY-2345' } })).status()).toBe(404);
    expect((await theo.request.post('/api/spaces/lookup', { data: { code: renewed.code } })).status()).toBe(200);
    // Joining off: the new code opens nothing either.
    await unwrap(await ines.request.put('/api/organization/code', { data: { join_by_code: false } }), 'off');
    expect((await theo.request.post('/api/spaces/lookup', { data: { code: renewed.code } })).status()).toBe(404);
    await unwrap(await ines.request.put('/api/organization/code', { data: { join_by_code: true } }), 'on');
  });

  test('a self-serve space: a student needs a parent’s consent; its admin deletes it with everything in it', async ({ page, as }) => {
    const owner = `olive.owner.${stamp}@example.com`;
    await unwrap(await signup(page, { dev_email: owner, dev_name: 'Olive Owner', birth_year: 1980 }), 'owner');
    const olive = await as('admin', { email: owner, org: null });
    const made = await unwrap<any>(await olive.request.post('/api/spaces', { data: { name: 'Olive’s practice' } }), 'make');
    const inSpace = await as('admin', { email: owner, org: made.slug });
    const me = (await unwrap<any[]>(await inSpace.request.get('/api/users'), 'people'))[0];
    await unwrap(await inSpace.request.patch(`/api/users/${me.id}`, { data: { roles: ['admin', 'parent'] } }), 'parent too');
    const child = { full_name: 'Ollie Owner', email: null, roles: ['student'], status: 'active', guardians: [{ guardian_user_id: me.id, relationship: 'mother', is_primary: true }] };
    const without = await inSpace.request.post('/api/users', { data: child });
    expect(without.status()).toBe(422);
    expect((await without.json()).error.details.parent_consent).toBeTruthy();
    await unwrap(await inSpace.request.post('/api/users', { data: { ...child, parent_consent: true } }), 'with consent');
    const log = await unwrap<any[]>(await inSpace.request.get('/api/audit?limit=20'), 'audit');
    expect(log.some((e) => e.action === 'consent.recorded')).toBe(true);
    // No email, no AI, no Tutoring or Quest in a self-serve space.
    expect((await inSpace.request.patch('/api/organization/settings', { data: { email_notifications: true } })).status()).toBe(403);
    expect((await inSpace.request.get('/api/sessions')).status()).toBe(403);

    // An institute cannot be deleted this way; a wrong name is refused; the right one deletes it all.
    const admin = await as('admin');
    expect((await admin.request.delete('/api/organization', { data: { confirm_name: 'Chapel Hill Math Institute' } })).status()).toBe(403);
    expect((await inSpace.request.delete('/api/organization', { data: { confirm_name: 'Something else' } })).status()).toBe(422);
    await inSpace.goto('/organization');
    // A new space's admin meets the welcome wizard first (Phase 26); close it.
    const wizard = inSpace.getByTestId('onboarding-wizard');
    await expect(wizard).toBeVisible({ timeout: 10_000 });
    await inSpace.keyboard.press('Escape');
    await expect(wizard).toHaveCount(0);
    await inSpace.getByTestId('space-delete-name').fill('Olive’s practice');
    await inSpace.getByTestId('space-delete').click();
    await expect(inSpace.getByTestId('welcome')).toBeVisible({ timeout: 15_000 });
    const after = await unwrap<any>(await olive.request.get('/api/auth/session'), 'after');
    expect(after.memberships).toEqual([]);
    // With no space left, she deletes her account.
    expect((await olive.request.delete('/api/auth/account')).status()).toBe(204);
    expect((await olive.request.get('/api/auth/session')).status()).toBe(404);
  });

  test('a member leaves; the last admin cannot', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    expect((await ines.request.post('/api/organization/leave')).status()).toBe(409);
    const omar = await as('assessParent', { org: ORGS.c.slug });
    await unwrap(await omar.request.post('/api/organization/leave'), 'omar leaves');
    expect((await omar.request.get('/api/users')).status()).toBe(403);
  });
});

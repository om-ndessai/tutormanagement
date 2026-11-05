import { test, expect, ORGS } from '../support/fixtures.js';
import { personalSpaceOf, unwrap } from '../support/api.js';
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
    // Phase 63 (P13): a space of her own, which takes nobody in (no code, joining off).
    expect(session).toMatchObject({ account: { age_band: '13-17' }, join_requests: [] });
    expect(session.memberships).toEqual([expect.objectContaining({ name: "Tess's space", roles: ['admin'] })]);
    expect((await tess.request.post('/api/spaces', { data: { name: 'Tess’s club' } })).status()).toBe(403);
    // Riverside's seeded code (the compatibility test runs this on an older seed, which has none).
    if ((await tess.request.post('/api/spaces/lookup', { data: { code: 'rvrs-2345' } })).ok()) {
      await unwrap(await tess.request.post('/api/spaces/join-requests', { data: { code: 'rvrs-2345' } }), 'asks to join');
    }

    // An adult, through the pages: the age question, the terms, then their own space (P13), and a
    // second space started from the Spaces page.
    const adult = `adam.adult.${stamp}@example.com`;
    await page.goto(`/signup?dev_email=${encodeURIComponent(adult)}&dev_name=Adam%20Adult`);
    await page.getByTestId('signup-month').click();
    await page.getByRole('option', { name: 'March' }).click();
    await page.getByTestId('signup-year').click();
    await page.getByRole('option', { name: '1985' }).click();
    await page.getByTestId('signup-accept').check();
    await page.getByTestId('signup-submit').click();
    const adam = await as('admin', { email: adult, org: null });
    await expect.poll(async () => (await adam.request.get('/api/auth/session')).status()).toBe(200);
    await adam.goto('/');
    await expect(adam.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
    await expect(adam.getByTestId('welcome')).toHaveCount(0);
    expect((await personalSpaceOf(adam)).name).toBe("Adam's space");
    // Phase 61 (S11): joining and starting, on the Spaces page.
    await adam.goto('/spaces');
    await expect(adam.getByTestId('welcome-join')).toBeVisible();
    await expect(adam.getByTestId('welcome-make')).toBeVisible();
    await adam.getByTestId('welcome-space-name').fill('The Adams family');
    await adam.getByTestId('welcome-make-submit').click();
    // Phase 61 (S12): the new space opens on "Invite people", before the tour; skipping goes on.
    await expect(adam.getByTestId('invite-step')).toBeVisible({ timeout: 15_000 });
    await adam.getByTestId('invite-skip').click();
    await expect(adam.getByTestId('invite-step')).toHaveCount(0);
    await expect(adam.getByTestId('onboarding-wizard')).toBeVisible();
    // In the new space: the Assessment home.
    await expect(adam.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
    const me = await unwrap<any>(await adam.request.get('/api/auth/session'), 'session after');
    expect(me.memberships).toHaveLength(2);
    const space = me.memberships.find((m: any) => m.name === 'The Adams family');
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
    // No email, no AI, no Tutoring in a self-serve space (Quest is on since Phase 61, S10).
    expect((await inSpace.request.patch('/api/organization/settings', { data: { email_notifications: true } })).status()).toBe(403);
    expect((await inSpace.request.get('/api/sessions')).status()).toBe(403);

    // An institute cannot be deleted this way; a wrong name is refused; the right one deletes it all.
    const admin = await as('admin');
    expect((await admin.request.delete('/api/organization', { data: { confirm_name: 'Chapel Hill Math Institute' } })).status()).toBe(403);
    expect((await inSpace.request.delete('/api/organization', { data: { confirm_name: 'Something else' } })).status()).toBe(422);
    await inSpace.goto('/organization');
    // No Tutoring here, so no welcome wizard (the tour is Tutoring's, owner 2026-11-04; the space was made
    // through the API, so its "Invite people" step is not this browser's either).
    await expect(inSpace.getByTestId('space-delete-name')).toBeVisible({ timeout: 10_000 });
    await expect(inSpace.getByTestId('onboarding-wizard')).toHaveCount(0);
    await inSpace.getByTestId('space-delete-name').fill('Olive’s practice');
    await inSpace.getByTestId('space-delete').click();
    // She is taken to the space she still has: her own, made at sign-up (P13).
    await expect(inSpace.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText("Olive's space", { timeout: 15_000 });
    const after = await unwrap<any>(await olive.request.get('/api/auth/session'), 'after');
    expect(after.memberships).toEqual([expect.objectContaining({ name: "Olive's space" })]);
    // Alone in her own space, she deletes her account, and it goes with her.
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

/**
 * Phase 60, S9 (docs/spaces-plan.md): what the phase does not change. A join request is still
 * answered by the space's admins (Phase 52, decision 1): a code does not let anyone in by itself,
 * and a member who is not an admin cannot answer one. Every person and the space are made here.
 */
test.describe('join requests are still the admins’ to answer (S9)', () => {
  test('asking with a code lets nobody in; only an admin lets in or declines', async ({ page, as }) => {
    const run = `${Date.now()}`;
    const makerEmail = `s9.maker.${run}@example.com`;
    const joinerEmail = `s9.joiner.${run}@example.com`;
    const otherEmail = `s9.other.${run}@example.com`;
    const name = `Wren Circle ${run}`;
    for (const [email, who] of [[makerEmail, 'Mara Maker'], [joinerEmail, 'Jory Joiner'], [otherEmail, 'Odile Other']]) {
      await unwrap(await signup(page, { dev_email: email, dev_name: who, birth_year: 1984 }), `${who} signs up`);
    }

    // The maker's space: joining by code is on from the start.
    const maker = await as('admin', { email: makerEmail, org: null });
    const made = await unwrap<any>(await maker.request.post('/api/spaces', { data: { name } }), 'make the space');
    const admin = await as('admin', { email: makerEmail, org: made.slug });
    const code = await unwrap<any>(await admin.request.get('/api/organization/code'), 'the code');
    expect(code.join_by_code).toBe(true);

    // The joiner asks from the Spaces page (she is in her own space, made at sign-up: Phase 63, P13),
    // with the code typed any old way.
    const joiner = await as('admin', { email: joinerEmail, org: null });
    const joinerOwn = await personalSpaceOf(joiner);
    const otherOwn = await personalSpaceOf(await as('admin', { email: otherEmail, org: null }));
    await joiner.goto('/spaces');
    await expect(joiner.getByTestId('welcome')).toBeVisible();
    await joiner.getByTestId('welcome-code').fill(code.code.replace('-', ' ').toLowerCase());
    await joiner.getByTestId('welcome-find').click();
    await expect(joiner.getByTestId('welcome-found')).toContainText(name);
    await joiner.getByTestId('welcome-ask').click();
    await expect(joiner.getByTestId(`welcome-request-${made.slug}`)).toBeVisible();

    // Asking let nobody in: no membership there, the space refuses her, and an arriving tab is still
    // in her own space, the request waiting on the Spaces page.
    const asked = await unwrap<any>(await joiner.request.get('/api/auth/session'), 'joiner after asking');
    expect(asked.memberships.map((m: any) => m.slug)).toEqual([joinerOwn.slug]);
    expect(asked.join_requests).toEqual([expect.objectContaining({ slug: made.slug, outcome: null })]);
    const refused = await joiner.request.get('/api/users', { headers: { 'X-Organization': made.slug } });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('organization_required');
    const lookup = await unwrap<any>(await joiner.request.post('/api/spaces/lookup', { data: { code: code.code } }), 'lookup again');
    expect(lookup.standing).toBe('requested');
    const arriving = await as('admin', { email: joinerEmail, org: null });
    await arriving.goto('/');
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(joinerOwn.name);
    await arriving.goto('/spaces');
    await expect(arriving.getByTestId(`welcome-request-${made.slug}`)).toBeVisible();
    await expect(arriving.getByTestId(`org-${made.slug}`)).toHaveCount(0);

    // The admin sees the request and lets her in, as a parent.
    const requests = await unwrap<any[]>(await admin.request.get('/api/organization/join-requests'), 'requests');
    const request = requests.find((r) => r.email === joinerEmail);
    expect(request).toMatchObject({ full_name: 'Jory Joiner' });
    await unwrap(
      await admin.request.post('/api/users', {
        data: { full_name: 'Jory Joiner', email: joinerEmail, roles: ['parent'], status: 'active', join_request_user_id: request.user_id },
      }),
      'let in',
    );
    const inside = await unwrap<any>(await joiner.request.get('/api/auth/session'), 'joiner let in');
    expect(inside.memberships.map((m: any) => m.slug).sort()).toEqual([joinerOwn.slug, made.slug].sort());
    expect(inside.join_requests).toEqual([]);
    const landed = await as('admin', { email: joinerEmail, org: null });
    await landed.goto('/spaces');
    await expect(landed.getByTestId(`org-${made.slug}`)).toContainText(name);

    // A second newcomer asks. A member who is not an admin cannot see or answer the request.
    const other = await as('admin', { email: otherEmail, org: null });
    await unwrap(await other.request.post('/api/spaces/join-requests', { data: { code: code.code } }), 'other asks');
    const parent = await as('admin', { email: joinerEmail, org: made.slug });
    expect((await parent.request.get('/api/organization/join-requests')).status()).toBe(403);
    const otherId = (await unwrap<any[]>(await admin.request.get('/api/organization/join-requests'), 'requests again'))
      .find((r) => r.email === otherEmail).user_id;
    expect((await parent.request.post(`/api/organization/join-requests/${otherId}/decline`)).status()).toBe(403);
    expect(
      (await parent.request.post('/api/users', {
        data: { full_name: 'Odile Other', email: otherEmail, roles: ['parent'], status: 'active', join_request_user_id: otherId },
      })).status(),
    ).toBe(403);
    expect((await unwrap<any>(await other.request.get('/api/auth/session'), 'other still waiting')).memberships.map((m: any) => m.slug)).toEqual([otherOwn.slug]);

    // The admin declines: she is told once, and is still in no space.
    await unwrap(await admin.request.post(`/api/organization/join-requests/${otherId}/decline`), 'decline');
    const declined = await unwrap<any>(await other.request.get('/api/auth/session'), 'other declined');
    expect(declined.memberships.map((m: any) => m.slug)).toEqual([otherOwn.slug]);
    expect(declined.join_requests).toEqual([expect.objectContaining({ slug: made.slug, outcome: 'declined' })]);
    expect((await other.request.get('/api/users', { headers: { 'X-Organization': made.slug } })).status()).toBe(403);
  });
});

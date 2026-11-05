import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 60 (S6, docs/spaces-plan.md): an invitation is accepted by hand, then entered.
 *
 * A first sign-in still accepts a CONSOLE space's invitations by itself (Phase 51, decision 3); every
 * other invitation -- a self-serve space's, or one reaching someone who has signed in before -- waits
 * for the person's Accept. Accept enters the space at once (it becomes the last choice, and the
 * welcome tour runs); Decline removes it. Someone already in a space lands by S4, with a banner
 * ("<first name> invited you to <space>", Accept / Not now), a count on the switcher, and the Spaces page's list.
 *
 * Signing in is the real path: the suite's fake Google token (AUTH_FAKE_PROVIDERS, local only)
 * through POST /api/auth/google, which is where `recordSignIn` accepts a console space's invitations.
 * The page itself then acts as the person with X-Dev-User, as every spec does.
 *
 * Every test makes its own people (and its own self-serve space), so the order of runs does not
 * matter and a rerun on the same database meets nobody it made before.
 */

const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const fakeGoogle = (subject: string, email: string) => `fake:google:${subject}:${email}:1`;

const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

/**
 * Signs the person in with Google (the fake token): their first sign-in, or a later one. A first sign-in of someone
 * a space added owes the terms once (Phase 72), which journey-fixes-72.spec walks through on the
 * page; here they are accepted at once, so these tests see the portal.
 */
async function signInWithGoogle(page: Page, subject: string, email: string) {
  const signedIn = unwrap<any>(
    await page.request.post('/api/auth/google', { data: { credential: fakeGoogle(subject, email) } }),
    `signing ${email} in with Google`,
  );
  await page.request.post('/api/auth/legal', { data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } });
  return signedIn;
}

/**
 * Someone who belongs to Riverside, has signed in there before and been through the wizard, and is
 * then invited to the institute by Priya under a name the institute typed.
 */
async function riversideMemberInvitedToTheInstitute(
  as: (who: any, options?: any) => Promise<Page>,
  label: string,
) {
  const email = `s6.${label}.${run}@example.com`;
  const fullName = `S6 ${label} ${run}`;
  const typedName = `Typed by CHMI ${label} ${run}`;
  const subject = `s6-${label}-${run}`;

  const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
  const added = await unwrap<any>(
    await rosa.request.post('/api/users', {
      data: { full_name: fullName, email, roles: ['parent'], status: 'active' },
    }),
    'Riverside adding the person',
  );
  expect(added.status).toBe('active');

  const person = await as('parent', { email, org: null });
  await signInWithGoogle(person, subject, email);
  await unwrap(
    await person.request.post('/api/onboarding/tour', {
      data: { outcome: 'skipped' },
      headers: { 'X-Organization': ORGS.b.slug },
    }),
    'the wizard, done',
  );

  const priya = await as('admin');
  const invited = await unwrap<any>(
    await priya.request.post('/api/users', { data: { full_name: typedName, email, roles: ['parent'] } }),
    'the institute inviting them',
  );
  expect(invited.status).toBe('invited');
  // Masking (Phase 51, unchanged): the institute sees only the name it typed until they accept.
  expect(invited).toMatchObject({ full_name: typedName, phone: null });

  return { email, fullName, typedName, subject, person, priya };
}

test.describe('an invitation is accepted by hand, then entered (S6)', () => {
  test('a new tutor added by the institute signs in for the first time and walks straight in', async ({ as }) => {
    const email = `s6.tutor.${run}@example.com`;
    const priya = await as('admin');
    const added = await unwrap<any>(
      await priya.request.post('/api/users', {
        data: { full_name: `S6 Tutor ${run}`, email, roles: ['tutor'], status: 'invited' },
      }),
      'the institute adding a tutor',
    );
    expect(added.status).toBe('invited');

    const tutor = await as('tutor', { email, org: null });
    // Before signing in, the membership is an invitation.
    expect((await session(tutor)).invitations.map((i: any) => i.slug)).toEqual([ORGS.a.slug]);

    // The first sign-in accepts a console space's invitation by itself.
    await signInWithGoogle(tutor, `s6-tutor-${run}`, email);
    const after = await session(tutor);
    expect(after.invitations).toEqual([]);
    expect(after.memberships.map((m: any) => [m.slug, m.status])).toEqual([[ORGS.a.slug, 'active']]);

    // No Accept anywhere: they land in the institute.
    await tutor.goto('/');
    await expect(tutor.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.a.short);
    await expect(tutor).not.toHaveURL(/\/spaces/);
    await expect(tutor.getByRole('heading', { name: 'Choose a space' })).toHaveCount(0);
    await expect(tutor.getByTestId('invitation-banner')).toHaveCount(0);
    expect((await tutor.request.get('/api/dashboard', { headers: { 'X-Organization': ORGS.a.slug } })).status()).toBe(200);

    // Remove the tutor: an active institute tutor with no SSN receipt would sit in tax.spec's chase panel.
    expect((await priya.request.delete(`/api/users/${added.id}?hard=true`)).ok()).toBe(true);
  });

  test('a newcomer invited to a self-serve space: the selector with nothing entered; Accept lands them there', async ({ page, as }) => {
    // An adult makes a self-serve space.
    const ownerEmail = `s6.owner.${run}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: ownerEmail,
          dev_name: 'Opal Owner',
          birth_year: 1982,
          birth_month: 4,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      'the owner signing up',
    );
    const owner = await as('admin', { email: ownerEmail, org: null });
    const made = await unwrap<any>(
      await owner.request.post('/api/spaces', { data: { name: `Opal family ${run}` } }),
      'making the space',
    );
    const ownerInside = await as('admin', { email: ownerEmail, org: made.slug });
    expect((await session(ownerInside)).organization.created_via).toBe('self_serve');

    // The owner invites a brand-new address.
    const email = `s6.newcomer.${run}@example.com`;
    const typedName = `Nell Newcomer ${run}`;
    const invited = await unwrap<any>(
      await ownerInside.request.post('/api/users', {
        data: { full_name: typedName, email, roles: ['parent'], status: 'invited' },
      }),
      'inviting the newcomer',
    );
    expect(invited.status).toBe('invited');

    try {
      // Their first sign-in does NOT accept a self-serve space's invitation.
      const nell = await as('parent', { email, org: null, fresh: true });
      await signInWithGoogle(nell, `s6-newcomer-${run}`, email);
      const before = await session(nell);
      expect(before.memberships).toEqual([]);
      expect(before.invitations.map((i: any) => i.slug)).toEqual([made.slug]);
      // requireOrg refuses an invited (unaccepted) member.
      const refused = await nell.request.get('/api/users', { headers: { 'X-Organization': made.slug } });
      expect(refused.status()).toBe(403);
      expect((await refused.json()).error.code).toBe('organization_required');

      // The selector, with the invitation and nothing entered.
      await nell.goto('/');
      await expect(nell).toHaveURL(/\/spaces$/);
      await expect(nell.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
      const card = nell.getByTestId(`invitation-${made.slug}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(made.name);
      await expect(nell.getByRole('region', { name: 'Your spaces' })).toHaveCount(0);
      await expect(nell.getByTestId('org-switcher')).toHaveCount(0);

      // Accept: in at once, the last choice. A self-serve space has no Tutoring, so no tour (the tour is
      // Tutoring's, owner 2026-11-04).
      await card.getByRole('button', { name: 'Accept' }).click();
      await expect(nell.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
      await expect(nell).not.toHaveURL(/\/spaces/);
      await expect(nell.getByTestId('member-home')).toBeVisible({ timeout: 15_000 });
      await expect(nell.getByTestId('onboarding-wizard')).toHaveCount(0);
      const after = await session(nell);
      expect(after.invitations).toEqual([]);
      expect(after.memberships.map((m: any) => [m.slug, m.status, m.is_default])).toEqual([[made.slug, 'active', true]]);
      expect((await nell.request.get('/api/users', { headers: { 'X-Organization': made.slug } })).status()).toBe(200);

      // The space now sees them as they are, and its log says they accepted.
      const people = await unwrap<any[]>(await ownerInside.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'the space’s people');
      expect(people.map((p) => p.status)).toEqual(['active']);
      const log = await unwrap<any[]>(await ownerInside.request.get('/api/audit?limit=50'), 'the space’s log');
      expect(log.some((e) => e.action === 'membership.accepted')).toBe(true);
    } finally {
      await ownerInside.request.delete('/api/organization', { data: { confirm_name: made.name } });
    }
  });

  test('someone who has signed in before, invited by the institute: the invitation waits for Accept', async ({ as }) => {
    const { email, subject, person } = await riversideMemberInvitedToTheInstitute(as, 'returning');

    // A later sign-in accepts nothing by itself, console space or not.
    await signInWithGoogle(person, subject, email);
    const after = await session(person);
    expect(after.invitations.map((i: any) => i.slug)).toEqual([ORGS.a.slug]);
    expect(after.memberships.map((m: any) => m.slug)).toEqual([ORGS.b.slug]);

    // requireOrg still refuses an invited (unaccepted) member, and entering is refused too.
    const refused = await person.request.get('/api/dashboard', { headers: { 'X-Organization': ORGS.a.slug } });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe('organization_required');
    expect((await person.request.post('/api/auth/enter', { headers: { 'X-Organization': ORGS.a.slug } })).status()).toBe(403);
    expect((await person.request.get('/api/users', { headers: { 'X-Organization': ORGS.a.slug } })).status()).toBe(403);

    // The Spaces page lists it, with Accept and Decline.
    await person.goto('/spaces');
    const card = person.getByTestId(`invitation-${ORGS.a.slug}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(ORGS.a.name);
    await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Decline' })).toBeVisible();
  });

  test('someone in A, invited to B, signs in: A, with the banner and the count; Not now is this tab only; Accept enters B', async ({ as }) => {
    const { email, subject, person, typedName, fullName, priya } = await riversideMemberInvitedToTheInstitute(as, 'banner');
    await signInWithGoogle(person, subject, email);
    // Riverside is their last choice: they land there by S4, not in the space that invited them.
    await unwrap(await person.request.post('/api/auth/enter', { headers: { 'X-Organization': ORGS.b.slug } }), 'entering Riverside');

    await person.goto('/');
    await expect(person).not.toHaveURL(/\/spaces/);
    const switcher = person.getByTestId('org-switcher').filter({ visible: true }).first();
    await expect(switcher).toContainText(ORGS.b.short);

    // The banner across the top of the portal.
    const banner = person.getByTestId('invitation-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(`invited you to ${ORGS.a.name}`);
    await expect(banner.getByTestId('invitation-banner-accept')).toBeVisible();
    await expect(banner.getByTestId('invitation-banner-not-now')).toBeVisible();

    // The switcher carries a count, and its menu says how many are waiting.
    await expect(person.getByTestId('org-switcher-invitations').filter({ visible: true }).first()).toHaveText('1');
    await switcher.click();
    await expect(person.getByRole('menuitem', { name: '1 invitation waiting' })).toBeVisible();
    await person.keyboard.press('Escape');

    // The Spaces page lists it.
    await person.goto('/spaces');
    await expect(person.getByTestId(`invitation-${ORGS.a.slug}`)).toBeVisible();
    await person.goto('/');

    // Not now: hidden for this tab, through a reload -- and still waiting.
    await person.getByTestId('invitation-banner-not-now').click();
    await expect(person.getByTestId('invitation-banner')).toHaveCount(0);
    await person.reload();
    await expect(person.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.b.short);
    await expect(person.getByTestId('invitation-banner')).toHaveCount(0);
    await expect(person.getByTestId('org-switcher-invitations').filter({ visible: true }).first()).toHaveText('1');
    expect((await session(person)).invitations.map((i: any) => i.slug)).toEqual([ORGS.a.slug]);

    // Another tab (a new browser session) shows it again; Accept there enters B at once.
    const other = await as('parent', { email, org: null });
    await other.goto('/');
    await expect(other.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.b.short);
    await expect(other.getByTestId('invitation-banner')).toContainText(`invited you to ${ORGS.a.name}`);
    await other.getByTestId('invitation-banner-accept').click();
    await expect(other.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.a.short);
    await expect(other.locator('html')).toHaveAttribute('data-palette', 'indigo');
    await expect(other.getByTestId('invitation-banner')).toHaveCount(0);
    await expect(other.getByTestId('org-switcher-invitations')).toHaveCount(0);

    const after = await session(other);
    expect(after.invitations).toEqual([]);
    expect(after.memberships.filter((m: any) => m.is_default).map((m: any) => m.slug)).toEqual([ORGS.a.slug]);
    expect((await other.request.get('/api/dashboard', { headers: { 'X-Organization': ORGS.a.slug } })).status()).toBe(200);

    // Accepted, the institute sees the person's own name, no longer the one it typed.
    const inA = await unwrap<any[]>(await priya.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'the person in A');
    expect(inA.map((p) => [p.full_name, p.status])).toEqual([[fullName, 'active']]);
    expect(inA[0].full_name).not.toBe(typedName);
  });

  test('Decline: the invitation is gone, and the institute’s admins see it withdrawn', async ({ as }) => {
    const { email, subject, person, typedName, fullName, priya } = await riversideMemberInvitedToTheInstitute(as, 'decline');
    await signInWithGoogle(person, subject, email);

    // Before: the institute's admins see the invitation, under the name they typed.
    const before = await unwrap<any[]>(await priya.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'before');
    expect(before.map((p) => [p.full_name, p.status])).toEqual([[typedName, 'invited']]);

    await person.goto('/spaces');
    const card = person.getByTestId(`invitation-${ORGS.a.slug}`);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Decline' }).click();
    await expect(visible(person, `Invitation to ${ORGS.a.name} declined.`)).toBeVisible();
    await expect(person.getByTestId(`invitation-${ORGS.a.slug}`)).toHaveCount(0);
    await expect(person.getByRole('region', { name: 'Invitations' })).toHaveCount(0);

    const after = await session(person);
    expect(after.invitations).toEqual([]);
    expect(after.memberships.map((m: any) => m.slug)).toEqual([ORGS.b.slug]);
    // Declined is not entered: the institute still refuses them.
    expect((await person.request.get('/api/dashboard', { headers: { 'X-Organization': ORGS.a.slug } })).status()).toBe(403);
    // And it is not offered again on the next arrival.
    const again = await as('parent', { email, org: null });
    await again.goto('/');
    await expect(again.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(ORGS.b.short);
    await expect(again.getByTestId('invitation-banner')).toHaveCount(0);

    // The institute's admins: no longer among its people, and the log says it was declined.
    const gone = await unwrap<any[]>(await priya.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'after');
    expect(gone).toEqual([]);
    const log = await unwrap<any[]>(await priya.request.get('/api/audit?limit=50'), 'the institute’s log');
    expect(log.some((e) => e.action === 'membership.declined')).toBe(true);
    // Masking: a declined invitation is never accepted, so the institute's log names them only by
    // the name it typed -- never their own (S6, R21).
    const line = log.find((e) => e.action === 'membership.declined' && JSON.stringify(e).includes(typedName));
    expect(line, 'the decline names them by the typed name').toBeTruthy();
    expect(JSON.stringify(log)).not.toContain(fullName);
    const declined = log.filter((e) => e.action === 'membership.declined');
    expect(declined.length).toBeGreaterThan(0);
    expect(JSON.stringify(declined)).not.toContain(fullName);
    // Answering it again: there is nothing left to answer.
    expect((await person.request.post(`/api/auth/invitations/${ORGS.a.slug}/accept`)).status()).toBe(404);
  });
});

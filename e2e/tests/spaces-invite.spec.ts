import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION, invitationText } from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { personalSpaceOf, unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 61 (S12, docs/spaces-plan.md): start a space, then invite people. After naming the space,
 * "Invite people" comes before the welcome tour: rows of email and role (Admin, Parent, and Tutor only
 * where Tutoring is allowed -- never in a newcomer's space), each the ordinary POST /api/users, the
 * person INVITED. A self-serve space sends no email, so each invitation is copied or shared by hand,
 * and the space's code is shown. Skip goes on to the tour; the same rows stay on People.
 *
 * Every test signs up its own newcomer, who starts their own space from the Spaces page, and
 * invites addresses made for that test alone: nothing here depends on another spec or on run order.
 */

const run = `${Date.now()}`;
let counter = 0;
/** A fresh address for this run: `<label>.<run>.<n>@example.com`. */
const freshEmail = (label: string) => `${label}.${run}.${++counter}@example.com`;

const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

const signup = async (page: Page, email: string, name: string) =>
  unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: name,
        birth_year: 1984,
        birth_month: 6,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${email}`,
  );

interface Started {
  page: Page;
  email: string;
  name: string;
  space: string;
  slug: string;
}

/**
 * A newcomer signs up -- landing in the space of their own sign-up makes (Phase 63, P13) -- starts
 * `space` from the Spaces page, and is left on "Invite people" in it: the path S11 hands to S12.
 */
async function startSpace(as: any, page: Page, label: string): Promise<Started> {
  const email = freshEmail(label);
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)} Starter`;
  const space = `The ${label} circle ${run.slice(-5)}`;
  await signup(page, email, name);
  const maker: Page = await as('admin', { email, org: null });
  await maker.goto('/');
  await expect(maker.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
  await expect(maker.getByTestId('org-switcher').filter({ visible: true }).first()).toContainText(`${name.split(' ')[0]}'s space`);
  await maker.goto('/spaces');
  await expect(maker.getByTestId('welcome-make')).toBeVisible({ timeout: 15_000 });
  await maker.getByTestId('welcome-space-name').fill(space);
  await maker.getByTestId('welcome-make-submit').click();
  await expect(maker.getByTestId('invite-step')).toBeVisible({ timeout: 15_000 });
  const me = await session(maker);
  const membership = me.memberships.find((m: any) => m.name === space);
  expect(membership, 'the new space is one of theirs').toBeTruthy();
  expect(membership.roles).toEqual(['admin']);
  return { page: maker, email, name, space, slug: membership.slug };
}

/** Fills invite row `index` (adding a row first when it is not there yet). */
async function fillRow(page: Page, index: number, row: { email: string; name?: string; role: 'Admin' | 'Parent' }) {
  if ((await page.getByTestId(`invite-row-${index}`).count()) === 0) await page.getByTestId('invite-add-row').click();
  await page.getByTestId(`invite-email-${index}`).fill(row.email);
  if (row.name) await page.getByTestId(`invite-name-${index}`).fill(row.name);
  await page.getByTestId(`invite-role-${index}`).click();
  await page.getByRole('option', { name: row.role, exact: true }).click();
}

/** The space's people, as its admin reads them. */
async function people(page: Page, slug: string): Promise<any[]> {
  return unwrap<any[]>(await page.request.get('/api/users', { headers: { 'X-Organization': slug } }), `people in ${slug}`);
}

test.describe('starting a space, then inviting people (S12)', () => {
  test('start a space and invite adults by email: copy, share, the code, then on to the tour @smoke', async ({ as, page }) => {
    const { page: maker, name, space, slug } = await startSpace(as, page, 'inviter');
    const origin = new URL(test.info().project.use.baseURL!).origin;

    // The step is the wizard's first screen, ahead of the tour, with the space's code card.
    await expect(maker.getByTestId('onboarding-wizard')).toBeVisible();
    await expect(maker.getByTestId('invite-step').getByTestId('space-code')).toBeVisible();
    await expect(maker.getByTestId('space-code-value')).toHaveText(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    // Nothing typed, nothing to send; Skip is offered until someone is invited.
    await expect(maker.getByTestId('invite-send')).toBeDisabled();
    await expect(maker.getByTestId('invite-skip')).toBeVisible();

    // A row is checked before it is sent.
    await maker.getByTestId('invite-email-0').fill('not-an-email');
    await maker.getByTestId('invite-send').click();
    await expect(maker.getByTestId('invite-problem-0')).toHaveText('Enter a valid email address.');
    expect((await people(maker, slug)).map((p) => p.email)).not.toContain('not-an-email');

    // Two adults: an admin with a name, a parent without one.
    const adminEmail = freshEmail('co-admin');
    const parentEmail = freshEmail('parent');
    await fillRow(maker, 0, { email: adminEmail, name: 'Cora Admin', role: 'Admin' });
    await fillRow(maker, 1, { email: parentEmail, role: 'Parent' });
    await maker.getByTestId('invite-send').click();
    await expect(maker.getByTestId(`invite-sent-${adminEmail}`)).toContainText('Admin');
    await expect(maker.getByTestId(`invite-sent-${parentEmail}`)).toContainText('Parent');
    // The rows are emptied for the next person; Continue takes Skip's place.
    await expect(maker.getByTestId('invite-email-0')).toHaveValue('');
    await expect(maker.getByTestId('invite-skip')).toHaveCount(0);
    await expect(maker.getByTestId('invite-continue')).toBeVisible();

    // Each row was the ordinary add-person request: invited, with the one role chosen.
    const listed = await people(maker, slug);
    expect(listed.find((p) => p.email === adminEmail)).toMatchObject({ status: 'invited', roles: ['admin'], full_name: 'Cora Admin' });
    expect(listed.find((p) => p.email === parentEmail)).toMatchObject({ status: 'invited', roles: ['parent'] });
    // A row without a name goes with one made from the address.
    expect(listed.find((p) => p.email === parentEmail).full_name).toMatch(/^Parent\b/);

    // Telling them: no email is sent, so the words are copied or shared by hand.
    // The link opens on the invitation, the person's Spaces page (UI audit JF12).
    // Phase 76 (JF37): the owner's wording -- what the space is for, how to accept, and where the invitation waits.
    const org = (
      await unwrap<any>(await maker.request.get('/api/auth/session', { headers: { 'X-Organization': slug } }), 'the new space')
    ).organization;
    const expected = invitationText({ inviter: name, space, address: `${origin}/spaces`, email: adminEmail, org });
    expect(expected).toBe(
      `${name} invited you to ${space} on Aimtrue, a space for practice and assessments. Open ${origin}/spaces and sign ` +
        `in with Google using ${adminEmail}: your invitation is waiting there.`,
    );
    await maker.evaluate(() => {
      const w = window as any;
      w.__copied = null;
      w.__shared = null;
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => {
          w.__copied = text;
        },
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { title?: string; text?: string }) => {
          w.__shared = data;
        },
      });
    });
    await maker.getByTestId(`invite-copy-${adminEmail}`).click();
    await expect.poll(() => maker.evaluate(() => (window as any).__copied)).toBe(expected);
    await expect(visible(maker, 'Invitation copied.')).toBeVisible();
    await maker.getByTestId(`invite-share-${parentEmail}`).click();
    await expect
      .poll(() => maker.evaluate(() => (window as any).__shared?.text))
      .toBe(invitationText({ inviter: name, space, address: `${origin}/spaces`, email: parentEmail, org }));

    // Continue goes on to the welcome, and the step does not come back. A new space has no Tutoring, so the
    // welcome offers no tour (the tour is Tutoring's, owner 2026-11-04; UI audit J06 step 20).
    await maker.getByTestId('invite-continue').click();
    await expect(maker.getByTestId('invite-step')).toHaveCount(0);
    await expect(maker.getByTestId('onboarding-wizard')).toBeVisible();
    await expect(maker.getByRole('button', { name: /Add a student/ })).toBeVisible();
    await expect(maker.getByRole('button', { name: /Take the tour/ })).toHaveCount(0);
  });

  test('an address pasted with spaces around it is trimmed and sent, as the app does', async ({ as, page }) => {
    const { page: maker, slug } = await startSpace(as, page, 'padded');
    const email = freshEmail('padded');
    // As copied from a contact card or an email client: spaces around it, capitals in it.
    await fillRow(maker, 0, { email: `  ${email.replace(/^p/, 'P')}  `, role: 'Parent' });
    await maker.getByTestId('invite-send').click();
    await expect(maker.getByTestId(`invite-sent-${email}`)).toBeVisible();
    await expect(maker.getByTestId('invite-problem-0')).toHaveCount(0);
    expect((await people(maker, slug)).find((p) => p.email === email)).toMatchObject({ status: 'invited', roles: ['parent'] });
  });

  test('the invited person signs in, accepts, and lands there with their role', async ({ as, page }) => {
    const { page: maker, slug, space } = await startSpace(as, page, 'host');
    const adminEmail = freshEmail('invited-admin');
    const parentEmail = freshEmail('invited-parent');
    await fillRow(maker, 0, { email: adminEmail, name: 'Ivy Invited', role: 'Admin' });
    await fillRow(maker, 1, { email: parentEmail, name: 'Paul Invited', role: 'Parent' });
    await maker.getByTestId('invite-send').click();
    await expect(maker.getByTestId(`invite-sent-${parentEmail}`)).toBeVisible();

    // A new address was made a person, invited: they sign in later and find it waiting, and are not
    // a newcomer -- no About you, no Welcome (S11), just the selector with the invitation.
    const ivy = await as('admin', { email: adminEmail, org: null });
    const before = await session(ivy);
    expect(before.memberships).toEqual([]);
    expect(before.invitations).toEqual([expect.objectContaining({ slug, name: space, roles: ['admin'] })]);
    await ivy.goto('/');
    await expect(ivy).toHaveURL(/\/spaces$/);
    await expect(ivy.getByRole('heading', { name: 'Choose a space' })).toBeVisible();
    // (The selector is the Spaces page without its frame (S5), so its own "Start a space" is there.)
    await expect(ivy.getByTestId('signup-submit')).toHaveCount(0);
    const card = ivy.getByTestId(`invitation-${slug}`);
    await expect(card).toContainText(space);
    await expect(card).toContainText('Invited as Admin');

    // Nothing is accepted for them (Phase 51): they accept by hand, and are taken in.
    await card.getByRole('button', { name: 'Accept' }).click();
    await expect(ivy).not.toHaveURL(/\/spaces/, { timeout: 15_000 });
    await expect(ivy.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible();
    const after = await session(ivy);
    expect(after.invitations).toEqual([]);
    expect(after.memberships).toEqual([expect.objectContaining({ slug, status: 'active', roles: ['admin'] })]);
    // In there, as an admin: the space's people are theirs to read.
    expect((await people(ivy, slug)).map((p) => p.email)).toContain(parentEmail);

    // The parent, by the same route: in with the parent's role, and nothing more.
    const paul = await as('admin', { email: parentEmail, org: null });
    expect((await session(paul)).invitations).toEqual([expect.objectContaining({ slug, roles: ['parent'] })]);
    await unwrap(await paul.request.post(`/api/auth/invitations/${slug}/accept`), 'paul accepts');
    expect((await session(paul)).memberships).toEqual([expect.objectContaining({ slug, status: 'active', roles: ['parent'] })]);

    // The host sees both as active now.
    const listed = await people(maker, slug);
    expect(listed.find((p) => p.email === adminEmail)).toMatchObject({ status: 'active', roles: ['admin'] });
    expect(listed.find((p) => p.email === parentEmail)).toMatchObject({ status: 'active', roles: ['parent'] });
  });

  test('inviting someone who exists elsewhere shows only the typed name, and no phone, until they accept', async ({ as, page }) => {
    // Somebody already on the platform, in a space of their own (the one sign-up made her, P13),
    // with a phone there.
    const otherEmail = freshEmail('elsewhere');
    const realName = `Rhea Realname ${run.slice(-4)}`;
    await signup(page, otherEmail, realName);
    const rhea = await as('admin', { email: otherEmail, org: null });
    const own = await personalSpaceOf(rhea);
    const inOwn = await as('admin', { email: otherEmail, org: own.slug });
    const rheaId = (await session(inOwn)).user.id;
    await unwrap(await inOwn.request.patch(`/api/users/${rheaId}`, { data: { phone: '(919) 555-0177' } }), 'her phone');
    // She has been on the platform a while: past the welcome wizard, so the banner is what she sees.
    await unwrap(await inOwn.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');

    // A newcomer starts a space and invites her by her address, typing a name of their own.
    const { page: maker, slug } = await startSpace(as, page, 'namer');
    const typed = `Auntie R ${run.slice(-4)}`;
    await fillRow(maker, 0, { email: otherEmail, name: typed, role: 'Parent' });
    await maker.getByTestId('invite-send').click();
    await expect(maker.getByTestId(`invite-sent-${otherEmail}`)).toBeVisible();

    // To the inviting space she is the typed name, with no phone -- never her own details.
    const invited = (await people(maker, slug)).find((p) => p.email === otherEmail);
    expect(invited).toMatchObject({ status: 'invited', full_name: typed, phone: null, roles: ['parent'] });
    const detail = await unwrap<any>(await maker.request.get(`/api/users/${invited.id}`, { headers: { 'X-Organization': slug } }), 'her row');
    expect(detail).toMatchObject({ full_name: typed, phone: null });
    expect(JSON.stringify(detail)).not.toContain(realName);
    expect(JSON.stringify(detail)).not.toContain('555-0177');
    await maker.getByTestId('invite-continue').click();
    await maker.goto('/users');
    await expect(visible(maker, typed).first()).toBeVisible();
    await expect(maker.getByText(realName)).toHaveCount(0);

    // Her own details elsewhere are untouched, and nothing is locked by the invitation.
    const mine = await unwrap<any>(await inOwn.request.get(`/api/users/${rheaId}`), 'her own row');
    expect(mine).toMatchObject({ full_name: realName, phone: '(919) 555-0177' });

    // In her own space, the banner offers it; accepting takes her in, as the parent she was invited as.
    await inOwn.goto('/');
    const banner = inOwn.getByTestId('invitation-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByTestId('invitation-banner-accept').click();
    await expect.poll(async () => (await session(inOwn)).invitations.length).toBe(0);
    const memberships = (await session(inOwn)).memberships;
    expect(memberships.find((m: any) => m.slug === slug)).toMatchObject({ status: 'active', roles: ['parent'] });

    // Accepted: the inviting space now reads her own name and phone.
    expect((await people(maker, slug)).find((p) => p.email === otherEmail)).toMatchObject({
      status: 'active',
      full_name: realName,
      phone: '(919) 555-0177',
    });
  });

  test('the answer to an invite row is the same whether or not the address had an account', async ({ as, page }) => {
    // Somebody already on the platform, active in a space of their own, past its welcome wizard.
    const otherEmail = freshEmail('known');
    await signup(page, otherEmail, `Kim Known ${run.slice(-4)}`);
    const kim = await as('admin', { email: otherEmail, org: null });
    const own = await unwrap<any>(await kim.request.post('/api/spaces', { data: { name: `Kim’s own ${run.slice(-5)}` } }), 'her own space');
    const inOwn = await as('admin', { email: otherEmail, org: own.slug });
    await unwrap(await inOwn.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    // Her account was last changed a while before the invitation below.
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const { page: maker, slug } = await startSpace(as, page, 'evener');
    const newEmail = freshEmail('new');
    const headers = { 'X-Organization': slug };
    const invite = async (email: string) => {
      const res = await maker.request.post('/api/users', {
        headers,
        data: { email, full_name: `Typed ${email.split('.')[0]}`, roles: ['parent'], status: 'invited' },
      });
      expect(res.status(), `inviting ${email}`).toBe(201);
      return (await res.json()).data;
    };
    const known = await invite(otherEmail);
    const fresh = await invite(newEmail);
    const read = async (id: string) => unwrap<any>(await maker.request.get(`/api/users/${id}`, { headers }), 'the row');
    const knownRead = await read(known.id);
    const freshRead = await read(fresh.id);

    for (const [a, b] of [
      [known, fresh],
      [knownRead, freshRead],
    ]) {
      expect(a.shared_fields_locked, 'the lock does not tell the two apart').toBe(b.shared_fields_locked);
      expect(a.status).toBe(b.status);
      for (const row of [a, b]) {
        if ('updated_at' in row) expect(row.updated_at, 'no account-level updated_at').toBe(row.created_at);
      }
    }

    // On People, each row's edit dialog shows the lock note in the same state.
    await maker.getByTestId('invite-skip').click();
    await unwrap(await maker.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' }, headers }), 'past the wizard');
    const lockShown: boolean[] = [];
    for (const row of [knownRead, freshRead]) {
      await maker.goto(`/users?search=${encodeURIComponent(row.email)}`);
      await maker.getByRole('button', { name: `Actions for ${row.full_name}` }).filter({ visible: true }).first().click();
      await maker.getByRole('menuitem', { name: 'Edit' }).click();
      const dialog = maker.getByRole('dialog');
      await expect(dialog.getByLabel('Full name')).toBeVisible();
      await expect(dialog.getByLabel('Full name')).toHaveValue(row.full_name);
      lockShown.push((await dialog.getByTestId('shared-fields-locked').count()) > 0);
      await maker.keyboard.press('Escape');
    }
    expect(lockShown[0], 'the lock note is the same for both').toBe(lockShown[1]);
  });

  test('someone who left, or declined, can be invited again', async ({ as, page }) => {
    const { page: maker, slug } = await startSpace(as, page, 'again');

    const reinvite = async (email: string) => {
      await fillRow(maker, 0, { email, role: 'Parent' });
      const answer = maker.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/users');
      await maker.getByTestId('invite-send').click();
      expect((await answer).status(), `inviting ${email}`).toBe(201);
      await expect(maker.getByTestId('invite-email-0')).toHaveValue('');
      await expect(maker.getByTestId(`invite-sent-${email}`)).toBeVisible();
      await expect(maker.getByTestId('invite-problem-0')).toHaveCount(0);
    };

    // One accepts, then leaves the space.
    const leaverEmail = freshEmail('leaver');
    await reinvite(leaverEmail);
    const leaver = await as('admin', { email: leaverEmail, org: null });
    await unwrap(await leaver.request.post(`/api/auth/invitations/${slug}/accept`), 'accepts');
    await unwrap(await leaver.request.post(`/api/spaces/${slug}/leave`), 'leaves');
    expect((await session(leaver)).memberships.map((m: any) => m.slug)).not.toContain(slug);

    // Another declines.
    const declinerEmail = freshEmail('decliner');
    await reinvite(declinerEmail);
    const decliner = await as('admin', { email: declinerEmail, org: null });
    await unwrap(await decliner.request.post(`/api/auth/invitations/${slug}/decline`), 'declines');
    expect((await session(decliner)).invitations).toEqual([]);

    // The maker invites both again: an invitation each, waiting to be accepted -- not "already here".
    await expect(maker.getByTestId('invite-step')).toBeVisible();
    await reinvite(leaverEmail);
    await reinvite(declinerEmail);
    for (const person of [leaver, decliner]) {
      const me = await session(person);
      expect(me.invitations).toEqual([expect.objectContaining({ slug, roles: ['parent'] })]);
      expect(me.memberships.map((m: any) => m.slug)).not.toContain(slug);
    }
    const listed = await people(maker, slug);
    for (const email of [leaverEmail, declinerEmail]) {
      expect(listed.find((p) => p.email === email)).toMatchObject({ status: 'invited', roles: ['parent'] });
    }
  });

  test('the tutor role is not offered in a newcomer’s space, on the step or on People', async ({ as, page }) => {
    const { page: maker, slug } = await startSpace(as, page, 'notutor');

    await maker.getByTestId('invite-role-0').click();
    await expect(maker.getByTestId('invite-role-option-admin')).toBeVisible();
    await expect(maker.getByTestId('invite-role-option-parent')).toBeVisible();
    await expect(maker.getByTestId('invite-role-option-tutor')).toHaveCount(0);
    await expect(maker.getByRole('option', { name: 'Tutor' })).toHaveCount(0);
    await maker.keyboard.press('Escape');

    // The request itself is refused too: the role is part of Tutoring, which the space does not have.
    const refused = await maker.request.post('/api/users', {
      headers: { 'X-Organization': slug },
      data: { email: freshEmail('would-be-tutor'), full_name: 'Would Be', roles: ['tutor'], status: 'invited' },
    });
    expect(refused.status()).toBe(422);
    expect((await refused.json()).error.details?.roles?.[0]).toMatch(/Tutoring/);

    // People -> Add has the same rows, and no Tutor either.
    await maker.getByTestId('invite-skip').click();
    // Skip goes on to the welcome wizard (checked in the skipping test); past it, to People.
    await expect(maker.getByTestId('onboarding-wizard')).toBeVisible();
    await unwrap(await maker.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' }, headers: { 'X-Organization': slug } }), 'past the wizard');
    await maker.goto('/users');
    // Phase 76 (JF21): the one Add chooser offers no tutor here, and neither does its person form.
    await maker.getByRole('button', { name: 'Add a person' }).click();
    await expect(maker.getByTestId('add-choices')).toBeVisible();
    await expect(maker.getByTestId('add-choice-tutor')).toHaveCount(0);
    await maker.getByTestId('add-choice-someone').click();
    const dialog = maker.getByRole('dialog', { name: 'Add a person' });
    await expect(dialog.getByRole('checkbox', { name: /Admin/ })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /Parent/ })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /Tutor/ })).toHaveCount(0);
  });

  test('skipping goes on to the welcome, invites nobody, and the step does not come back', async ({ as, page }) => {
    const { page: maker, slug, email } = await startSpace(as, page, 'skipper');

    // Something half-typed and skipped is not sent.
    await maker.getByTestId('invite-email-0').fill(freshEmail('never-sent'));
    await maker.getByTestId('invite-skip').click();
    await expect(maker.getByTestId('invite-step')).toHaveCount(0);
    await expect(maker.getByTestId('onboarding-wizard')).toBeVisible();
    // No Tutoring in a new space, so no tour (owner, 2026-11-04).
    await expect(maker.getByRole('button', { name: /Take the tour/ })).toHaveCount(0);
    // In the new space: its Assessment home behind the wizard.
    await expect(maker.getByTestId('assessment-home')).toBeAttached({ timeout: 15_000 });

    // Nobody was invited: the space holds its maker alone.
    expect((await people(maker, slug)).map((p) => p.email)).toEqual([email]);

    // The step was this tab's, once: a reload, or a new tab, opens no "Invite people".
    await maker.reload();
    await expect(maker.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
    await expect(maker.getByTestId('invite-step')).toHaveCount(0);
    const later = await as('admin', { email, org: slug });
    await later.goto('/');
    await expect(later.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
    await expect(later.getByTestId('invite-step')).toHaveCount(0);
  });
});

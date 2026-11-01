import type { Page } from '@playwright/test';
import { levelLabel, PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 61 (S10, docs/spaces-plan.md): a space made from now on starts with Assessment and Quest
 * allowed AND switched on -- a newcomer's (`POST /api/spaces`) and a console one made with the
 * defaults. A newcomer's space has no Tutoring and stays untrusted for Quest. Spaces made before
 * keep their switches: the seed's `assess` (Assessment alone) and `solo` (no Quest) are unchanged.
 *
 * Every test makes its own people and spaces (a stamp keeps them apart), and takes its own space
 * away again where it can, so the order of runs does not matter.
 */

const stamp = Date.now();

const signup = (page: Page, email: string, name: string, birthYear = 1984) =>
  page.request.post('/api/auth/signup', {
    data: {
      dev_email: email,
      dev_name: name,
      birth_year: birthYear,
      birth_month: 4,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
  });

/** The main menu as rendered (the sidebar on a desktop, the sheet's copy hidden). */
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).first();

/** The welcome wizard (Phase 26) meets a new space's admin first; this test is not about it. */
async function closeWizardIfOpen(page: Page) {
  const wizard = page.getByTestId('onboarding-wizard');
  // isVisible() does not wait; waitFor does, so a wizard still mounting is caught.
  const opened = await wizard
    .waitFor({ state: 'visible', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (opened) {
    await page.keyboard.press('Escape');
    await expect(wizard).toHaveCount(0);
  }
}

async function consoleRow(platform: Page, slug: string) {
  const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the console list');
  const row = orgs.find((o) => o.slug === slug);
  expect(row, `the console lists ${slug}`).toBeTruthy();
  return row;
}

test.describe('S10: a new space has Assessment and Quest on', () => {
  test('a newcomer’s new space shows the Assessment menu and Quest; its admin sets a level and the student plays', async ({
    page,
    as,
  }) => {
    const makerEmail = `quinn.questmaker.${stamp}@example.com`;
    const kidEmail = `kit.questmaker.${stamp}@example.com`;
    const spaceName = `Questmaker family ${stamp % 100000}`;
    await unwrap(await signup(page, makerEmail, 'Quinn Questmaker'), 'the maker signs up');

    // The newcomer starts a space from the Welcome page.
    const quinn = await as('admin', { email: makerEmail, org: null });
    await quinn.goto('/');
    await expect(quinn.getByTestId('welcome')).toBeVisible();
    await quinn.getByTestId('welcome-space-name').fill(spaceName);
    await quinn.getByTestId('welcome-make-submit').click();
    // S12's "Invite people" may open first; skipping goes on.
    const invite = quinn.getByTestId('invite-step');
    const inviteOpened = await invite
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (inviteOpened) {
      await quinn.getByTestId('invite-skip').click();
      await expect(invite).toHaveCount(0);
    }
    await closeWizardIfOpen(quinn);
    await expect(quinn.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });

    const session = await unwrap<any>(await quinn.request.get('/api/auth/session'), 'the maker’s session');
    const membership = session.memberships.find((m: any) => m.name === spaceName);
    expect(membership).toBeTruthy();
    const slug: string = membership.slug;
    const inSpace = await as('admin', { email: makerEmail, org: slug });
    // Past the welcome wizard for good (it is not this test's subject), so later pages need no wait.
    await unwrap(await inSpace.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');

    try {
      // The space's own switches: Assessment and Quest on, from the start.
      const settings = await unwrap<any>(await inSpace.request.get('/api/organization/settings'), 'settings');
      expect(settings).toMatchObject({ canvas_assessments: true, gamify_question_quest: true });
      const org = (await unwrap<any>(await inSpace.request.get('/api/auth/session'), 'in the space')).organization;
      expect(org).toMatchObject({
        feature_tutoring: false,
        feature_assessment: true,
        feature_quest: true,
        canvas_assessments: true,
        gamify_question_quest: true,
        created_via: 'self_serve',
        quest_trusted: false,
      });
      // Both sets' routes answer; Tutoring's still do not.
      expect((await inSpace.request.get('/api/canvas-assessments')).status()).toBe(200);
      expect((await inSpace.request.get('/api/quest/review')).status()).toBe(200);
      expect((await inSpace.request.get('/api/quest/games')).status()).toBe(200);
      expect((await inSpace.request.get('/api/sessions')).status()).toBe(403);

      // The console sees the same: no Tutoring, untrusted for Quest (Phase 51).
      const platform = await as('platformAdmin', { org: null });
      expect(await consoleRow(platform, slug)).toMatchObject({
        feature_tutoring: false,
        feature_assessment: true,
        feature_quest: true,
        canvas_assessments: true,
        gamify_question_quest: true,
        created_via: 'self_serve',
        quest_trusted: false,
      });

      // The menu: Assessment and Quest, nothing of Tutoring's.
      await inSpace.goto('/');
      const nav = mainNav(inSpace);
      await expect(nav.getByRole('link', { name: /^Assessment/ })).toBeVisible();
      await expect(nav.getByRole('link', { name: /^Quest\b/ })).toBeVisible();
      for (const name of ['Pairings', 'Sessions', 'Billing']) {
        await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0);
      }
      // The Space page offers both switches, on.
      await inSpace.goto('/organization');
      await expect(inSpace.getByTestId('canvas-assessments-setting')).toBeVisible();
      await expect(inSpace.getByTestId('gamification-setting')).toBeVisible();

      // A student who signs in: the maker is the parent (consent given, as a self-serve space needs).
      const me = (await unwrap<any[]>(await inSpace.request.get(`/api/users?search=${encodeURIComponent(makerEmail)}`), 'the maker'))[0];
      await unwrap(await inSpace.request.patch(`/api/users/${me.id}`, { data: { roles: ['admin', 'parent'] } }), 'parent too');
      const kid = await unwrap<any>(
        await inSpace.request.post('/api/users', {
          data: {
            full_name: 'Kit Questmaker',
            email: kidEmail,
            roles: ['student'],
            status: 'active',
            guardians: [{ guardian_user_id: me.id, relationship: 'father', is_primary: true }],
            parent_consent: true,
            // As the user form always sends for a student: Quest's level lives on this profile.
            student_profile: {},
          },
        }),
        'the student',
      );

      // The admin sets the student's Quest level on the Quest page.
      await inSpace.goto('/quest');
      await expect(inSpace.getByTestId('quest-students')).toBeVisible();
      await inSpace.getByTestId(`quest-level-${kid.id}`).click();
      await inSpace.getByRole('option', { name: levelLabel('BA3'), exact: true }).click();
      await expect(visible(inSpace, `Kit Questmaker starts at ${levelLabel('BA3')}.`)).toBeVisible();
      const students = await unwrap<any[]>(await inSpace.request.get('/api/quest/students'), 'quest students');
      expect(students.find((s) => s.user_id === kid.id)).toMatchObject({ level_id: 'BA3' });

      // The student plays: a question at that level, answered, a point.
      const kit = await as('admin', { email: kidEmail, org: slug });
      const before = await unwrap<any>(await kit.request.get('/api/quest/me'), 'the student’s quest');
      expect(before.level_id).toBe('BA3');
      expect(before.question).toBeTruthy();
      await kit.goto('/quest');
      await expect(kit.getByTestId('quest-play-card')).toBeVisible();
      await kit.goto('/quest/play');
      await expect(kit.getByTestId('quest-question')).toBeVisible({ timeout: 15_000 });
      // The welcome closes by itself within 5 seconds.
      await expect(kit.getByTestId('quest-welcome')).toHaveCount(0, { timeout: 8_000 });
      if (await kit.getByTestId('quest-number').isVisible()) {
        await kit.getByTestId('quest-number').fill('7');
      } else {
        await kit.getByTestId('quest-choice-A').click();
      }
      await kit.getByTestId('quest-submit').click();
      await expect(kit.getByTestId('quest-points')).toContainText(`${before.points + 1} point`);
      const after = await unwrap<any>(await kit.request.get('/api/quest/me'), 'after answering');
      expect(after.answered).toBe(before.answered + 1);
    } finally {
      // Away again: the space with everything in it, then both accounts (best effort).
      await inSpace.request.delete('/api/organization', { data: { confirm_name: spaceName } });
      const kitOut = await as('admin', { email: kidEmail, org: null });
      await kitOut.request.delete('/api/auth/account');
      await quinn.request.delete('/api/auth/account');
    }
  });

  test('a console space made with the defaults has Assessment and Quest allowed and on', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const name = `Defaults Academy ${stamp % 100000}`;
    const slug = `defaults-academy-${stamp % 100000}`;

    // The console's form: all three sets ticked unless a platform admin unticks one.
    await platform.goto('/platform');
    await platform.getByRole('button', { name: 'New space' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await expect(dialog.getByLabel('Address name')).toHaveValue(slug);
    await dialog.getByLabel('Short name').fill('Defaults');
    const sets = dialog.getByTestId('org-feature-sets');
    for (const set of ['Tutoring', 'Assessment', 'Quest']) {
      await expect(sets.getByRole('switch', { name: set, exact: true })).toHaveAttribute('aria-checked', 'true');
    }
    await dialog.getByRole('button', { name: 'Create space' }).click();
    await expect(visible(platform, `${name} created.`).first()).toBeVisible();

    const row = await consoleRow(platform, slug);
    expect(row).toMatchObject({
      feature_tutoring: true,
      feature_assessment: true,
      feature_quest: true,
      canvas_assessments: true,
      gamify_question_quest: true,
      created_via: 'console',
    });

    // An API create with nothing but the names is the same.
    const apiSlug = `defaults-api-${stamp % 100000}`;
    await unwrap(
      await platform.request.post('/api/platform/organizations', {
        data: { name: `Defaults API ${stamp % 100000}`, short_name: 'Defaults API', slug: apiSlug },
      }),
      'an API create',
    );
    expect(await consoleRow(platform, apiSlug)).toMatchObject({
      feature_assessment: true,
      feature_quest: true,
      canvas_assessments: true,
      gamify_question_quest: true,
    });

    // Its first admin finds both in the menu, with no switch to turn on first.
    const adminEmail = `dora.defaults.${stamp}@example.com`;
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${row.id}/admins`, {
        data: { email: adminEmail, full_name: 'Dora Defaults' },
      }),
      'adding its admin',
    );
    const invited = await as('admin', { email: adminEmail, org: null });
    await unwrap(await invited.request.post(`/api/auth/invitations/${slug}/accept`), 'accepting');
    const dora = await as('admin', { email: adminEmail, org: slug });
    const settings = await unwrap<any>(await dora.request.get('/api/organization/settings'), 'its settings');
    expect(settings).toMatchObject({ canvas_assessments: true, gamify_question_quest: true });
    expect((await dora.request.get('/api/canvas-assessments')).status()).toBe(200);
    expect((await dora.request.get('/api/quest/review')).status()).toBe(200);
    await unwrap(await dora.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    await dora.goto('/');
    await closeWizardIfOpen(dora);
    const nav = mainNav(dora);
    await expect(nav.getByRole('link', { name: /^Assessment/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Quest\b/ })).toBeVisible();
  });

  test('the seed has a console space made after the change, with Assessment and Quest on', async ({ as }) => {
    // The seed's own (docs/spaces-plan.md, Seed): no setup here, so a fresh `db:reset` shows S10's state.
    // A space another test made at run time does not count: the seed's has a fixed id of its own.
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the console list');
    const before = new Set([ORGS.a.slug, ORGS.b.slug, ORGS.c.slug, ORGS.d.slug]);
    const seeded = orgs.filter(
      (o) =>
        o.created_via === 'console' &&
        !before.has(o.slug) &&
        /^0f000000-/.test(o.id) &&
        o.feature_assessment === true &&
        o.feature_quest === true &&
        o.canvas_assessments === true &&
        o.gamify_question_quest === true,
    );
    expect(seeded, 'a seeded console space with Assessment and Quest on').toHaveLength(1);
  });

  test('an existing space is unchanged: its switches are what they were', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const assess = await consoleRow(platform, ORGS.c.slug);
    // Made before Phase 61: Assessment alone, Quest neither allowed nor on.
    expect(assess).toMatchObject({ feature_tutoring: false, feature_assessment: true, feature_quest: false, gamify_question_quest: false });
    const solo = await consoleRow(platform, ORGS.d.slug);
    expect(solo).toMatchObject({ feature_quest: false, canvas_assessments: false, gamify_question_quest: false });

    // Inside: Ines's space still has no Quest, and its menu says so.
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    const quest = await ines.request.get('/api/quest/me');
    expect(quest.status()).toBe(403);
    expect((await quest.json()).error.code).toBe('feature_unavailable');
    await ines.goto('/');
    await expect(ines.getByTestId('assessment-home')).toBeVisible();
    const nav = mainNav(ines);
    await expect(nav.getByRole('link', { name: /^Assessment/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Quest\b/ })).toHaveCount(0);
  });
});

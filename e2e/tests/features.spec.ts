import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';
import type { AsOptions } from '../support/fixtures.js';
import type { PersonKey } from '../support/people.js';
import type { Page } from '@playwright/test';

/**
 * Feature sets (Phase 50, docs/open-signup-plan.md): Tutoring, Assessment and Quest, which
 * platform admins allow per space. A set that is off is invisible there, admins included, and its
 * routes answer 403 feature_unavailable (R23). The seed's organization C (`assess`) is allowed
 * Assessment alone, as self-serve spaces were before Phase 61; a space made since has Assessment
 * and Quest on (S10, `spaces-defaults.spec.ts`), and existing ones keep their switches.
 */

test.describe.configure({ mode: 'serial' });

const TUTORING_READS = ['/api/sessions', '/api/assignments', '/api/schedules', '/api/locations', '/api/payments', '/api/comments', '/api/dashboard', '/api/home/tutor', '/api/progress/students'];

test.describe('feature sets (Phase 50) @smoke', () => {
  test('an Assessment-only space: no Tutoring or Quest anywhere, and an Assessment home', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    // The compatibility test runs @smoke on the LAST release's seed, which may predate this space.
    test.skip((await ines.request.get('/api/auth/session')).status() === 404, 'The seed under test has no Assessment-only space.');

    // The API: every Tutoring and Quest route is refused with the same code; Assessment answers.
    for (const path of [...TUTORING_READS, '/api/quest/me', '/api/quest/games']) {
      const response = await ines.request.get(path);
      expect(response.status(), path).toBe(403);
      expect((await response.json()).error.code, path).toBe('feature_unavailable');
    }
    expect((await ines.request.get('/api/canvas-assessments')).status()).toBe(200);

    // The menu: People, Assessment, Activity -- none of Tutoring's or Quest's.
    await ines.goto('/');
    await expect(ines.getByTestId('assessment-home')).toBeVisible();
    const nav = ines.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).first();
    await expect(nav.getByRole('link', { name: /Assessment/ })).toBeVisible();
    for (const name of ['Pairings', 'Lessons', 'Progress', 'Schedule', 'Billing', 'Comments', 'Quest']) {
      await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0);
    }
    // A link into Tutoring meets a calm page, not an error.
    await ines.goto('/sessions');
    await expect(ines.getByTestId('feature-unavailable')).toContainText('Not part of this space');

    // The Space page shows what it is allowed, and no 1099 payer or Quest card.
    await ines.goto('/organization');
    await expect(ines.getByTestId('org-feature-sets')).toHaveText('Assessment');
    await expect(ines.getByRole('form', { name: '1099 payer details' })).toHaveCount(0);
    await expect(ines.getByTestId('gamification-setting')).toHaveCount(0);
    await expect(ines.getByTestId('canvas-assessments-setting')).toBeVisible();
    // Phase 59 (S3): the sets are the space's, in the space's words.
    await expect(ines.getByText('This space may use', { exact: true })).toBeVisible();
    await expect(ines.getByTestId('canvas-assessments-setting')).toContainText('Assessment in this space');
    await expect(ines.getByText(/organization/i)).toHaveCount(0);
    const questOn = await ines.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } });
    expect(questOn.status()).toBe(403);
  });

  test('without Tutoring nobody becomes a tutor, but a student is added as before', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    test.skip((await ines.request.get('/api/auth/session')).status() === 404, 'The seed under test has no Assessment-only space.');
    const tutor = await ines.request.post('/api/users', {
      data: { full_name: 'Tess Tutor', email: 'tess.tutor.assess@example.com', roles: ['tutor'], status: 'active' },
    });
    expect(tutor.status()).toBe(422);
    expect((await tutor.json()).error.details.roles[0]).toContain('Tutoring');

    const me = await unwrap<any[]>(await ines.request.get('/api/users?search=Ines'), 'ines');
    const student = await unwrap<any>(
      await ines.request.post('/api/users', {
        data: {
          full_name: 'Rui Ferreira',
          email: null,
          roles: ['student'],
          status: 'active',
          guardians: [{ guardian_user_id: me[0].id, relationship: 'mother', is_primary: true }],
          // Phase 52: the seeded Assessment-only space is a self-serve one, so a parent's consent.
          parent_consent: true,
        },
      }),
      'a student',
    );
    expect(student.roles).toEqual(['student']);
    // The form offers no tutor role here.
    await ines.goto('/users');
    // Phase 76 (JF21): the chooser offers no tutor here either.
    await ines.getByRole('button', { name: 'Add a person' }).first().click();
    await expect(ines.getByTestId('add-choice-tutor')).toHaveCount(0);
    await ines.getByTestId('add-choice-someone').click();
    await expect(ines.getByRole('dialog', { name: 'Add a person' })).toBeVisible();
    await expect(ines.getByRole('checkbox', { name: /Tutor/ })).toHaveCount(0);
  });

  test('the console allows and disallows a set; the space follows at once, and it is logged', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'organizations');
    const riverside = orgs.find((o) => o.slug === ORGS.b.slug);
    expect(riverside).toMatchObject({ feature_tutoring: true, feature_assessment: true, feature_quest: true });
    const put = (data: Record<string, boolean>) => platform.request.put(`/api/platform/organizations/${riverside.id}/features`, { data });

    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const kwame = await as('orgBTutor', { org: ORGS.b.slug });
    const before = await unwrap<any[]>(await kwame.request.get('/api/users?limit=100'), 'kwame people');
    expect(before.some((u) => u.full_name === 'Lily Chen')).toBe(true);
    try {
      await unwrap(await put({ feature_tutoring: false, feature_assessment: true, feature_quest: true }), 'disallow tutoring');
      const refused = await rosa.request.get('/api/sessions');
      expect(refused.status()).toBe(403);
      // A pairing kept from before reaches nobody (R23): the tutor no longer sees "their" student.
      const after = await unwrap<any[]>(await kwame.request.get('/api/users?limit=100'), 'kwame people after');
      expect(after.some((u) => u.full_name === 'Lily Chen')).toBe(false);
      // Not a non-platform admin's to change.
      expect((await rosa.request.put(`/api/platform/organizations/${riverside.id}/features`, { data: { feature_tutoring: true, feature_assessment: true, feature_quest: true } })).status()).toBe(403);
    } finally {
      await unwrap(await put({ feature_tutoring: true, feature_assessment: true, feature_quest: true }), 'allow again');
    }
    // The console says what this space may use (Phase 59, S3).
    await platform.goto('/platform');
    await platform.getByRole('button', { name: `Edit ${ORGS.b.name}` }).click();
    const sets = platform.getByRole('dialog').getByTestId('org-feature-sets');
    await expect(sets).toContainText('This space may use');
    for (const name of ['Tutoring', 'Assessment', 'Quest']) {
      await expect(sets.getByRole('switch', { name, exact: true })).toBeVisible();
    }
    // Riverside has Quest allowed: its admins' card says so in the space's words.
    await rosa.goto('/organization');
    await expect(rosa.getByTestId('gamification-setting')).toContainText('Quest in this space');
    // Allowed again: everything kept is back.
    expect((await rosa.request.get('/api/sessions')).status()).toBe(200);
    const log = await unwrap<any[]>(await rosa.request.get('/api/audit?limit=20'), 'audit');
    const lines = log.filter((e) => e.action === 'organization.features_updated');
    expect(lines.map((e) => e.description)).toEqual(
      expect.arrayContaining([
        `Feature sets of ${ORGS.b.name}: disallowed Tutoring`,
        `Feature sets of ${ORGS.b.name}: allowed Tutoring`,
      ]),
    );
  });
});

test.describe('feature sets on rows from before Phase 50 @compat', () => {
  test('an organization made before feature sets is allowed all three, and its menu is unchanged', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'organizations');
    for (const slug of [ORGS.a.slug, ORGS.b.slug]) {
      expect(orgs.find((o) => o.slug === slug), slug).toMatchObject({ feature_tutoring: true, feature_assessment: true, feature_quest: true });
    }
    const admin = await as('admin');
    expect((await admin.request.get('/api/sessions')).status()).toBe(200);
  });
});

/**
 * Phase 59 (S3, docs/spaces-plan.md): the feature sets are the space's. No change of model, only of
 * words: platform admins allow each set per space ("This space may use: Tutoring, Assessment, Quest"),
 * and the space's own admins switch Assessment and Quest on and off ("Assessment in this space",
 * "Quest in this space"). Each test makes its own space and admin, so it runs in any order.
 */
test.describe('feature sets are the space’s (Phase 59, S3)', () => {
  type As = (who: PersonKey, options?: AsOptions) => Promise<Page>;

  async function makeSpace(as: As, label: string) {
    const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    const name = `${label} ${tag}`;
    const slug = `s3-${label.toLowerCase().replace(/[^a-z]+/g, '-')}-${tag}`.slice(0, 40).replace(/-+$/, '');
    const email = `s3.${tag}@example.com`;
    const platform = await as('platformAdmin', { org: null });
    const space = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: { name, short_name: label, slug },
      }),
      'make the space',
    );
    // Made by the console: every set allowed.
    expect(space).toMatchObject({ feature_tutoring: true, feature_assessment: true, feature_quest: true });
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${space.id}/admins`, {
        data: { email, full_name: `Sasha ${tag}` },
      }),
      'add its admin',
    );
    // Invited by the console, then accepted: an active admin of the new space.
    const admin = await as('admin', { email, org: slug });
    expect((await admin.request.post(`/api/auth/invitations/${slug}/accept`)).ok()).toBe(true);
    return { platform, admin, space, name, slug };
  }

  test('the console’s dialog says what this space may use, and its switches allow and disallow', async ({ as }) => {
    const { platform, admin, space, name } = await makeSpace(as, 'Sets Console');

    await platform.goto('/platform');
    await visible(platform, name).first().waitFor();
    await platform.getByRole('button', { name: `Edit ${name}` }).click();
    const dialog = platform.getByRole('dialog');
    const sets = dialog.getByTestId('org-feature-sets');
    await expect(sets.locator('legend')).toHaveText('This space may use');
    for (const set of ['Tutoring', 'Assessment', 'Quest']) {
      await expect(sets.getByRole('switch', { name: set, exact: true })).toHaveAttribute('aria-checked', 'true');
    }
    await expect(sets.getByText(/organization/i)).toHaveCount(0);

    // Disallow Quest and save: the space follows at once.
    await sets.getByRole('switch', { name: 'Quest', exact: true }).click();
    await expect(sets.getByRole('switch', { name: 'Quest', exact: true })).toHaveAttribute('aria-checked', 'false');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(visible(platform, `${name} saved.`)).toBeVisible();
    const after = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list')).find(
      (o) => o.id === space.id,
    );
    expect(after).toMatchObject({ feature_tutoring: true, feature_assessment: true, feature_quest: false });

    // The reopened dialog keeps it.
    await platform.getByRole('button', { name: `Edit ${name}` }).click();
    await expect(
      platform.getByRole('dialog').getByTestId('org-feature-sets').getByRole('switch', { name: 'Quest', exact: true }),
    ).toHaveAttribute('aria-checked', 'false');

    // Quest's routes answer the space's words, for its own admin too.
    for (const path of ['/api/quest/me', '/api/quest/games']) {
      const refused = await admin.request.get(path);
      expect(refused.status(), path).toBe(403);
      const error = (await refused.json()).error;
      expect(error.code, path).toBe('feature_unavailable');
      expect(error.message, path).toBe('Quest is not part of this space.');
    }
    expect((await admin.request.get('/api/sessions')).status()).toBe(200);

    // The space's log names the change, in a finished sentence.
    const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=20'), 'audit');
    expect(log.filter((e) => e.action === 'organization.features_updated').map((e) => e.description)).toContain(
      `Feature sets of ${name}: disallowed Quest`,
    );

    // The space's own admin cannot allow a set, nor switch on what is not allowed.
    expect(
      (
        await admin.request.put(`/api/platform/organizations/${space.id}/features`, {
          data: { feature_tutoring: true, feature_assessment: true, feature_quest: true },
        })
      ).status(),
    ).toBe(403);
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(403);
  });

  test('the Space page lists what this space may use, with a card per set its admins switch', async ({ as }) => {
    const { platform, admin, space } = await makeSpace(as, 'Sets Page');
    const put = async (data: Record<string, boolean>) =>
      unwrap(await platform.request.put(`/api/platform/organizations/${space.id}/features`, { data }), 'features');
    // A known start: both of its admins' switches on.
    await unwrap(
      await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: true, gamify_question_quest: true } }),
      'switches on',
    );
    // A new admin meets the welcome wizard (Phase 26); past it, the page is the subject here.
    await unwrap(await admin.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');

    await admin.goto('/organization');
    await expect(admin.getByText('This space may use', { exact: true })).toBeVisible();
    await expect(admin.getByTestId('org-feature-sets')).toHaveText('Tutoring, Assessment, Quest');
    const assessment = admin.getByTestId('canvas-assessments-setting');
    const quest = admin.getByTestId('gamification-setting');
    await expect(assessment).toContainText('Assessment in this space');
    await expect(quest).toContainText('Quest in this space');
    await expect(admin.getByText(/organization/i)).toHaveCount(0);

    // Its admins switch Assessment off and on, from its card; the routes follow.
    await assessment.getByRole('switch', { name: 'Assessment menu' }).click();
    await expect(visible(admin, 'The Assessment menu is off.')).toBeVisible();
    const off = await admin.request.get('/api/canvas-assessments');
    expect(off.status()).toBe(403);
    expect((await off.json()).error.message).toBe('Assessment is not part of this space.');
    await assessment.getByRole('switch', { name: 'Assessment menu' }).click();
    await expect(visible(admin, 'The Assessment menu is on.')).toBeVisible();
    expect((await admin.request.get('/api/canvas-assessments')).status()).toBe(200);

    // And Quest, from its card.
    await quest.getByRole('switch', { name: 'Question Quest' }).click();
    await expect(visible(admin, 'Question Quest is off.')).toBeVisible();
    expect((await admin.request.get('/api/quest/games')).status()).toBe(403);
    await quest.getByRole('switch', { name: 'Question Quest' }).click();
    await expect(visible(admin, 'Question Quest is on.')).toBeVisible();
    expect((await admin.request.get('/api/quest/games')).status()).toBe(200);

    // The console disallows Quest and Tutoring: the page lists Assessment alone, and Quest's card goes.
    await put({ feature_tutoring: false, feature_assessment: true, feature_quest: false });
    await admin.goto('/organization');
    await expect(admin.getByTestId('org-feature-sets')).toHaveText('Assessment');
    await expect(admin.getByTestId('gamification-setting')).toHaveCount(0);
    await expect(admin.getByTestId('canvas-assessments-setting')).toContainText('Assessment in this space');
    await admin.goto('/sessions');
    await expect(admin.getByTestId('feature-unavailable')).toContainText('Not part of this space');

    // Allowed again: its admins' Quest switch is as they left it (on), and the card is back.
    await put({ feature_tutoring: true, feature_assessment: true, feature_quest: true });
    await admin.goto('/organization');
    await expect(admin.getByTestId('org-feature-sets')).toHaveText('Tutoring, Assessment, Quest');
    await expect(admin.getByTestId('gamification-setting')).toContainText('Quest in this space');
    await expect(
      admin.getByTestId('gamification-setting').getByRole('switch', { name: 'Question Quest' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect((await admin.request.get('/api/sessions')).status()).toBe(200);
  });
});

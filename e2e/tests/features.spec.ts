import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Feature sets (Phase 50, docs/open-signup-plan.md): Tutoring, Assessment and Quest, which
 * platform admins allow per space. A set that is off is invisible there, admins included, and its
 * routes answer 403 feature_unavailable (R23). The seed's organization C (`assess`) is allowed
 * Assessment alone, as every self-serve space will be (Phase 52).
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
    for (const name of ['Pairings', 'Sessions', 'Progress', 'Schedule', 'Billing', 'Comments', 'Quest']) {
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
        },
      }),
      'a student',
    );
    expect(student.roles).toEqual(['student']);
    // The form offers no tutor role here.
    await ines.goto('/users');
    await ines.getByRole('button', { name: /Add user/ }).first().click();
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

import type { Page } from '@playwright/test';
import { ORGS, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { BA, NC17, NC26, topicsOf } from '../support/catalog.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 35: North Carolina's standards in both editions, and an organization
 * choosing which curricula it offers (docs/curricula-plan.md, Phase B).
 *
 * Seeded: A (the institute's shape) offers Beast Academy alone. B offers
 * nc-2017 (its default) and nc-2026, and has retired Beast Academy: Lily's
 * BA4 assessment and closed BA5 plan are history, and she has an NC
 * assessment, an active NC plan and one lesson scored against it.
 *
 * The NC catalog is reviewed apart from the code, so nothing here pins its
 * names or counts: they are read from apps/api/db/catalog/*.json. Changes to
 * an offering run in a throwaway organization made through the console, so
 * A's and B's own lists never move under another spec.
 */

/** A curriculum's levels in ladder order (by stage), as the API lists them. */
const levelIds = (curriculum: typeof BA) =>
  [...curriculum.levels].sort((a, b) => a.stage - b.stage).map((level) => level.id);
// The seed names these (db/generate-seed.mjs): the first topic of each NC file's first level.
const FIRST_NC17_TOPIC = NC17.levels[0]!.topics[0]!;
const FIRST_NC26_TOPIC = NC26.levels[0]!.topics[0]!;

test.describe('curricula', () => {
  test('B reads North Carolina first, then retired Beast Academy, with its flags', async ({ as }) => {
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });

    const curricula = await unwrap<any[]>(await rosa.request.get('/api/curricula'), 'B curricula');
    expect(curricula.map((row) => [row.id, row.is_default, row.retired])).toEqual([
      [NC17.id, true, false],
      [NC26.id, false, false],
      ['ba', false, true],
    ]);
    expect(curricula[0]).toMatchObject({ name: NC17.name, edition: NC17.edition });

    // The catalog in teaching order: the default, then the rest offered, retired last.
    const levels = await unwrap<any[]>(await rosa.request.get('/api/curriculum'), 'B catalog');
    expect(levels.map((level) => level.id)).toEqual([...levelIds(NC17), ...levelIds(NC26), ...levelIds(BA)]);
    expect(levels.filter((level) => level.retired).map((level) => level.id)).toEqual(levelIds(BA));

    // A standard is shown by its official code, under its domain, with its summary.
    const first = levels.flatMap((level) => level.topics).find((topic) => topic.id === FIRST_NC17_TOPIC.id);
    expect(first).toMatchObject({
      id: FIRST_NC17_TOPIC.id,
      code: FIRST_NC17_TOPIC.code ?? FIRST_NC17_TOPIC.id,
      unit: FIRST_NC17_TOPIC.unit,
      name: FIRST_NC17_TOPIC.name,
      description: FIRST_NC17_TOPIC.description,
      level_id: NC17.levels[0]!.id,
    });
    expect(levels.flatMap((level) => level.topics).length).toBe(
      topicsOf(NC17).length + topicsOf(NC26).length + topicsOf(BA).length,
    );

    // Any member reads the list -- a tutor's pickers need it -- and only an admin the choice.
    const kwame = await as('orgBTutor', { org: ORGS.b.slug });
    expect((await kwame.request.get('/api/curricula')).status()).toBe(200);
    expect((await kwame.request.get('/api/organization/curricula')).status()).toBe(403);

    // A, like the institute, offers Beast Academy alone, as its default.
    const parent = await as('parent');
    const mine = await unwrap<any[]>(await parent.request.get('/api/curricula'), 'A curricula');
    expect(mine.map((row) => [row.id, row.is_default, row.retired])).toEqual([['ba', true, false]]);
  });

  test('A refuses a North Carolina id on an assessment, a plan, a lesson and a draft', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const alexId = await idOf(admin, PEOPLE.tutor.email);
    const nc = FIRST_NC17_TOPIC.id;

    const refused = async (response: Awaited<ReturnType<Page['request']['post']>>, what: string) => {
      expect(response.status(), what).toBe(422);
      expect(JSON.stringify(await response.json()), what).toContain(`Not in the curriculum: ${nc}`);
    };

    await refused(
      await admin.request.post('/api/progress/assessments', {
        data: { student_user_id: sofiaId, assessed_on: '2026-10-01', ratings: [{ topic_id: nc, rating: 2 }] },
      }),
      'assessment',
    );
    await refused(
      await admin.request.post('/api/progress/plans', {
        data: {
          student_user_id: sofiaId,
          goal: 'Crossing curricula',
          starts_on: '2026-10-01',
          target_on: '2027-06-01',
          sessions_per_week: 1,
          session_minutes: 60,
          topic_ids: [nc],
        },
      }),
      'plan',
    );
    // A level too, not only a topic.
    const level = await admin.request.post('/api/progress/assessments', {
      data: {
        student_user_id: sofiaId,
        assessed_on: '2026-10-01',
        summary: 'Placed elsewhere.',
        recommended_level_id: NC17.levels[0]!.id,
      },
    });
    expect(level.status()).toBe(422);

    const lesson = {
      tutor_user_id: alexId,
      student_user_id: sofiaId,
      occurred_on: '2026-09-21',
      started_at: '16:00',
      ended_at: '17:00',
      mode: 'in_person',
      progress: { goal_rating: 3, topic_ratings: [{ topic_id: nc, rating: 3 }] },
    };
    for (const who of [admin, tutor]) {
      await refused(await who.request.post('/api/sessions', { data: lesson }), 'lesson');
      await refused(await who.request.post('/api/sessions/drafts', { data: lesson }), 'draft');
    }
  });

  test('B’s closed plan still names Beast Academy Level 5, though Beast Academy is retired', async ({ as }) => {
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const lilyId = await idOf(rosa, 'Lily Chen');
    const progress = await unwrap<any>(await rosa.request.get(`/api/progress/${lilyId}`), 'Lily');

    expect(progress.plan.target_level_id).toBe(NC17.levels[0]!.id);
    expect(progress.plan.topic_ids).toEqual([FIRST_NC17_TOPIC.id, FIRST_NC26_TOPIC.id]);
    const closed = progress.past_plans.find((plan: any) => plan.status === 'closed');
    expect(closed.target_level_id).toBe('BA5');
    // A lesson was scored against the NC plan.
    expect(progress.timeline.some((point: any) => point.topics_rated > 0)).toBe(true);
    const lessons = await unwrap<any[]>(
      await rosa.request.get(`/api/sessions?student_user_id=${lilyId}&limit=50`),
      'Lily’s lessons',
    );
    expect(
      lessons.some((lesson) => lesson.progress?.topic_ratings.some((r: any) => r.topic_id === FIRST_NC17_TOPIC.id)),
    ).toBe(true);

    // On the page, the old plan opens on the level it was written against --
    // a retired curriculum's level stays in the picker where it is the value.
    await rosa.goto(`/progress/${lilyId}`);
    await rosa.getByRole('button', { name: 'Edit this plan' }).click();
    const dialog = rosa.getByRole('dialog');
    await expect(dialog.locator('#target-level')).toContainText('Beast Academy Level 5');
    // Two curricula are offered, so the topics editor offers a switch between them.
    await expect(dialog.getByTestId('curriculum-switch')).toBeVisible();
    await expect(dialog.getByRole('radio', { name: NC26.name })).toBeVisible();
    // Beast Academy holds none of this plan's topics, so it is not offered there.
    await expect(dialog.getByRole('radio', { name: /Beast Academy/ })).toHaveCount(0);
  });

  test('the institute’s pickers show no curriculum switch', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    await admin.goto(`/progress/${sofiaId}`);
    await admin.getByRole('button', { name: 'Edit plan' }).first().click();
    const dialog = admin.getByRole('dialog');
    await expect(dialog.getByText('Topics to cover')).toBeVisible();
    await expect(dialog.getByTestId('curriculum-switch')).toHaveCount(0);
  });

  test('the choice is the admins’, and a bad one is refused whole', async ({ as }) => {
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const kwame = await as('orgBTutor', { org: ORGS.b.slug });
    const valid = { offered: [NC17.id, NC26.id], default_curriculum_id: NC17.id };

    expect((await kwame.request.put('/api/organization/curricula', { data: valid })).status()).toBe(403);

    for (const [what, data] of [
      ['an unknown curriculum', { offered: [NC17.id, 'not-a-curriculum'], default_curriculum_id: NC17.id }],
      ['an empty list', { offered: [], default_curriculum_id: NC17.id }],
      ['a default not offered', { offered: [NC17.id], default_curriculum_id: NC26.id }],
      ['an SSN for an id', { offered: ['123-45-6789'], default_curriculum_id: '123-45-6789' }],
    ] as const) {
      const response = await rosa.request.put('/api/organization/curricula', { data });
      expect(response.status(), what).toBe(422);
      expect(await response.text(), what).not.toContain('123-45-6789');
    }

    // Nothing moved.
    const after = await unwrap<any[]>(await rosa.request.get('/api/curricula'), 'B after');
    expect(after.map((row) => [row.id, row.is_default, row.retired])).toEqual([
      [NC17.id, true, false],
      [NC26.id, false, false],
      ['ba', false, true],
    ]);
  });

  test('a new organization chooses its curricula; what it drops is retired, not lost', async ({ as }) => {
    test.slow();
    const stamp = Date.now();
    const slug = `curricula-${stamp}`;
    const platform = await as('platformAdmin', { org: null });
    const created = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: { name: `Curricula Test ${stamp}`, short_name: 'Curricula', slug },
      }),
      'creating the organization',
    );
    const adminEmail = `curricula.admin.${stamp}@gmail.com`;
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${created.id}/admins`, {
        data: { email: adminEmail, full_name: 'Cora Curricula' },
      }),
      'adding its admin',
    );
    const cora = await as('admin', { email: adminEmail, org: null });
    expect((await cora.request.post(`/api/auth/invitations/${slug}/accept`)).ok()).toBe(true);
    const inOrg = { headers: { 'X-Organization': slug } };

    // It starts on Beast Academy, and may offer every platform curriculum.
    const start = await unwrap<any[]>(await cora.request.get('/api/organization/curricula', inOrg), 'offerings');
    // In the catalog's display order (each source file's `sort`).
    const bySort = [BA, NC17, NC26].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
    expect(start.map((row) => [row.id, row.offered, row.is_default, row.retired])).toEqual(
      bySort.map((curriculum) => [curriculum.id, curriculum.id === 'ba', curriculum.id === 'ba', false]),
    );
    expect(start.find((row) => row.id === NC17.id)).toMatchObject({
      level_count: NC17.levels.length,
      topic_count: topicsOf(NC17).length,
    });

    const put = (data: unknown) => cora.request.put('/api/organization/curricula', { ...inOrg, data });
    const log = async () =>
      (await unwrap<any[]>(await cora.request.get('/api/audit?action=curriculum.offering_updated', inOrg), 'log'))
        .map((event) => event.description);

    // Offer the 2026 edition beside Beast Academy, and make it the default.
    await unwrap(await put({ offered: ['ba', NC26.id], default_curriculum_id: NC26.id }), 'offering nc-2026');
    expect(await log()).toEqual([`Started offering ${NC26.name}; made ${NC26.name} the default curriculum`]);
    // The same choice again changes nothing, and writes no line.
    await unwrap(await put({ offered: [NC26.id, 'ba'], default_curriculum_id: NC26.id }), 'the same again');
    expect((await log()).length).toBe(1);

    // A tutor and a student, so a lesson can be scored against the 2026 edition.
    const parent = await unwrap<any>(
      await cora.request.post('/api/users', {
        ...inOrg,
        data: { email: `curricula.parent.${stamp}@gmail.com`, full_name: 'Pat Curricula', roles: ['parent'] },
      }),
      'a parent',
    );
    const student = await unwrap<any>(
      await cora.request.post('/api/users', {
        ...inOrg,
        data: {
          full_name: 'Sam Curricula',
          email: '',
          roles: ['student'],
          student_profile: { charge_rate_in_person_cents: 90_00 },
          guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a student',
    );
    const tutor = await unwrap<any>(
      await cora.request.post('/api/users', {
        ...inOrg,
        data: {
          email: `curricula.tutor.${stamp}@gmail.com`,
          full_name: 'Tia Curricula',
          roles: ['tutor'],
          tutor_profile: { default_rate_in_person_cents: 60_00 },
        },
      }),
      'a tutor',
    );
    await unwrap(
      await cora.request.post('/api/assignments', {
        ...inOrg,
        data: { tutor_user_id: tutor.id, student_user_id: student.id },
      }),
      'pairing them',
    );

    // A draft rates a 2026 standard; then the 2026 edition is retired.
    const draft = await unwrap<any>(
      await cora.request.post('/api/sessions/drafts', {
        ...inOrg,
        data: {
          tutor_user_id: tutor.id,
          student_user_id: student.id,
          occurred_on: '2026-10-01',
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          progress: { goal_rating: null, topic_ratings: [{ topic_id: FIRST_NC26_TOPIC.id, rating: 3 }] },
        },
      }),
      'a draft scored against nc-2026',
    );
    await unwrap(await put({ offered: ['ba'], default_curriculum_id: 'ba' }), 'retiring nc-2026');
    expect((await log())[0]).toBe(`Retired ${NC26.name}; made Beast Academy the default curriculum`);

    const list = await unwrap<any[]>(await cora.request.get('/api/curricula', inOrg), 'list after retiring');
    expect(list.map((row) => [row.id, row.retired])).toEqual([['ba', false], [NC26.id, true]]);

    // It still posts -- a retired curriculum stays writable -- and only once.
    const posted = await cora.request.post(`/api/sessions/drafts/${draft.id}/post`, inOrg);
    expect(posted.status(), await posted.text()).toBe(201);
    const session = (await posted.json()).data;
    expect(session.progress.topic_ratings).toEqual([{ topic_id: FIRST_NC26_TOPIC.id, rating: 3 }]);
    expect((await cora.request.post(`/api/sessions/drafts/${draft.id}/post`, inOrg)).status()).toBe(404);
    const lessons = await unwrap<any[]>(
      await cora.request.get(`/api/sessions?student_user_id=${student.id}`, inOrg),
      'lessons',
    );
    expect(lessons).toHaveLength(1);

    // A curriculum never offered stays refused.
    const never = await cora.request.post('/api/sessions/drafts', {
      ...inOrg,
      data: {
        tutor_user_id: tutor.id,
        student_user_id: student.id,
        occurred_on: '2026-10-02',
        started_at: '16:00',
        ended_at: '17:00',
        mode: 'in_person',
        progress: { goal_rating: null, topic_ratings: [{ topic_id: FIRST_NC17_TOPIC.id, rating: 3 }] },
      },
    });
    expect(never.status()).toBe(422);

    // The console never lists the sentence: it is the organization's own (R14).
    const console = JSON.stringify(await unwrap(await platform.request.get('/api/platform/audit'), 'console log'));
    expect(console).not.toContain('curriculum.offering_updated');

    // On the page: the card, one row each, saved with its own button.
    await cora.goto(`/organization?org=${slug}`);
    // Cora is new, so the welcome wizard opens first (it follows her record, not the cookie).
    await cora.getByTestId('onboarding-wizard').getByRole('button', { name: /done/ }).click();
    const card = cora.getByTestId('curricula-card');
    await expect(card.getByTestId(`curriculum-${NC26.id}`).getByText('Retired')).toBeVisible();
    await expect(card.getByRole('switch', { name: 'Offer Beast Academy' })).toBeDisabled();
    await card.getByRole('switch', { name: `Offer ${NC17.name}` }).click();
    await card.getByRole('button', { name: 'Save curricula' }).click();
    await expect(cora.getByText('Curricula saved.')).toBeVisible();
    expect((await log())[0]).toBe(`Started offering ${NC17.name}`);
  });
});

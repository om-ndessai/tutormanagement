import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Phase 16: students are assessed against the Beast Academy / AoPS ladder, a
 * plan is set towards a goal, and each lesson is scored against it.
 *
 * Seeded: Sofia (taught by Alex, daughter of Maria) and Ben (taught by Alex
 * and Sanjay) each have an assessment and an active plan; Sanjay has been
 * assessed but has no plan.
 */
test.describe('progress tracking', () => {
  test('the curriculum ladder is in the database, named by code', async ({ as }) => {
    const parent = await as('parent');
    const levels = await unwrap<any[]>(await parent.request.get('/api/curriculum'), 'curriculum');

    expect(levels.map((level) => level.id)).toEqual([
      'BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO',
    ]);
    const ba3 = levels.find((level) => level.id === 'BA3');
    // "Topic 10 from level 3" is one thing: the first chapter of guide book 3D.
    expect(ba3.topics.find((topic: any) => topic.id === 'BA3.10')).toMatchObject({
      unit: '3D',
      name: 'Fractions',
    });
  });

  test('a student’s progress reaches their family and tutors, and nobody else', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    const status = async (who: Parameters<typeof as>[0]) =>
      (await (await as(who)).request.get(`/api/progress/${sofiaId}`)).status();

    expect(await status('admin')).toBe(200);
    expect(await status('parentTutor')).toBe(200); // her mother
    expect(await status('tutor')).toBe(200); // her tutor
    expect(await status('student')).toBe(200); // herself
    // Another family's parent is told it does not exist.
    expect(await status('parent')).toBe(404);
  });

  test('only the office assesses or sets a plan', async ({ as }) => {
    const tutor = await as('tutor');
    const benId = await idOf(await as('admin'), 'Ben Whitfield');

    const response = await tutor.request.post('/api/progress/assessments', {
      data: { student_user_id: benId, assessed_on: '2026-09-20', summary: 'Trying my luck.' },
    });
    expect(response.status()).toBe(403);
  });

  test('a scored lesson moves the student along their plan', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    const before = await unwrap<any>(await tutor.request.get(`/api/progress/${sofiaId}`), 'before');
    expect(before.plan).not.toBeNull();
    const unmastered = before.topics.filter((topic: any) => !topic.mastered);
    expect(unmastered.length).toBeGreaterThan(0);

    const session = await unwrap<any>(
      await tutor.request.post('/api/sessions', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: sofiaId,
          occurred_on: before.today,
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          progress: {
            goal_rating: 5,
            topic_ratings: [{ topic_id: unmastered[0].topic_id, rating: 5 }],
          },
        },
      }),
      'recording a scored lesson',
    );
    expect(session.progress).toMatchObject({ goal_rating: 5 });

    const after = await unwrap<any>(await tutor.request.get(`/api/progress/${sofiaId}`), 'after');
    expect(after.summary.mastered_count).toBe(before.summary.mastered_count + 1);
    expect(after.timeline.at(-1)).toMatchObject({ session_id: session.id, goal_rating: 5 });

    // An unknown topic is refused rather than half-saved.
    const bad = await tutor.request.patch(`/api/sessions/${session.id}`, {
      data: { progress: { topic_ratings: [{ topic_id: 'BA9.99', rating: 3 }] } },
    });
    expect(bad.status()).toBe(422);

    await tutor.request.delete(`/api/sessions/${session.id}`);
  });

  test('the office sets a plan, and the family sees its goal on the dashboard', async ({ as }) => {
    const admin = await as('admin');
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);

    await admin.goto(`/progress/${sanjayId}`);
    await expect(visible(admin, 'Assessed, but no plan has been set yet.')).toBeVisible();

    await admin.getByRole('button', { name: 'Create plan' }).click();
    const dialog = admin.getByRole('dialog');
    // Topics the assessment rated 3 or below arrive pre-selected.
    await expect(dialog.getByText('in teaching order')).toBeVisible();
    await dialog.getByLabel('Goal', { exact: true }).fill('Circle geometry ready for AMC 10');
    await dialog.getByRole('button', { name: 'Create plan' }).click();
    await expect(dialog).toBeHidden();

    await expect(visible(admin, 'Circle geometry ready for AMC 10')).toBeVisible();
    await expect(visible(admin, 'Timeline towards the goal')).toBeVisible();

    // His mother follows it from her own dashboard.
    const mother = await as('parent');
    await mother.goto('/dashboard');
    await expect(visible(mother, 'Circle geometry ready for AMC 10')).toBeVisible();

    // Leave the seeded state as it was for the rest of the suite.
    const plan = await unwrap<any>(await admin.request.get(`/api/progress/${sanjayId}`), 'plan');
    await admin.request.delete(`/api/progress/plans/${plan.plan.id}`);
  });

  test('a tutor scores a lesson against the plan from the session form', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/sessions');
    await tutor.getByRole('button', { name: /record a session/i }).first().click();

    const dialog = tutor.getByRole('dialog');
    await dialog.getByRole('combobox').first().click();
    await tutor.getByRole('option', { name: /Sofia Okafor/ }).click();

    await expect(dialog.getByText('Progress towards the goal')).toBeVisible();
    await expect(dialog.getByRole('radiogroup', { name: 'Progress towards the goal' })).toBeVisible();
  });
});

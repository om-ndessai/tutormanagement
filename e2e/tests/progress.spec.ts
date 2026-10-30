import { ORGS, expect, test } from '../support/fixtures.js';
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
      // Phase 34: Beast Academy's ids are its codes, and the level comes from the row.
      code: 'BA3.10',
      level_id: 'BA3',
    });
    expect(ba3).toMatchObject({ code: 'BA3', curriculum_id: 'ba', retired: false });
    // Phase 35: a Beast Academy chapter has no description; its title says enough.
    expect(ba3.topics.every((topic: any) => topic.description === null)).toBe(true);
    // The ladder's order is the catalog's, not a number the client works out.
    expect(ba3).not.toHaveProperty('stage');
  });

  test('organization B still reads the Beast Academy ladder it has retired, after its own', async ({ as }) => {
    // Phase 35: B teaches North Carolina's standards now (curricula.spec.ts);
    // Beast Academy, retired there, is listed last and unchanged.
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });
    const levels = await unwrap<any[]>(await bAdmin.request.get('/api/curriculum'), 'curriculum');

    expect(levels.filter((level) => level.curriculum_id === 'ba').map((level) => level.id)).toEqual([
      'BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO',
    ]);
    expect(levels.slice(-8).every((level) => level.curriculum_id === 'ba' && level.retired)).toBe(true);
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
    // Found by id rather than taken as the last entry: other specs record
    // lessons for this student on the same day, and which one happens to sort
    // last is not what this test is about. (Pre-existing flake, not phase 22.)
    expect(after.timeline.find((entry: any) => entry.session_id === session.id)).toMatchObject({
      goal_rating: 5,
    });

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

  test('the goal on the student’s record and on their plan are one goal', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    const readBoth = async () => {
      const record = await unwrap<any>(await admin.request.get(`/api/users/${sofiaId}`), 'record');
      const progress = await unwrap<any>(await admin.request.get(`/api/progress/${sofiaId}`), 'plan');
      return { record, profileGoal: record.student_profile.academic_year_goal, planGoal: progress.plan.goal, planId: progress.plan.id };
    };

    const before = await readBoth();
    expect(before.profileGoal).toBe(before.planGoal);

    // Changing the plan's goal changes the record's.
    await unwrap(
      await admin.request.patch(`/api/progress/plans/${before.planId}`, {
        data: { goal: 'Prealgebra-ready by June, via the plan' },
      }),
      'editing the plan goal',
    );
    expect((await readBoth()).profileGoal).toBe('Prealgebra-ready by June, via the plan');

    // Changing the record's goal in the user dialog changes the plan's.
    await unwrap(
      await admin.request.patch(`/api/users/${sofiaId}`, {
        data: {
          student_profile: { ...before.record.student_profile, academic_year_goal: 'Prealgebra-ready by June, via the record' },
        },
      }),
      'editing the record goal',
    );
    expect((await readBoth()).planGoal).toBe('Prealgebra-ready by June, via the record');

    // Clearing it on the record cannot leave the plan without one: the
    // plan's goal is put back.
    await unwrap(
      await admin.request.patch(`/api/users/${sofiaId}`, {
        data: { student_profile: { ...before.record.student_profile, academic_year_goal: '' } },
      }),
      'clearing the record goal',
    );
    const cleared = await readBoth();
    expect(cleared.profileGoal).toBe(cleared.planGoal);

    // Restore the seeded goal for the rest of the suite.
    await admin.request.patch(`/api/progress/plans/${before.planId}`, { data: { goal: before.planGoal } });
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
  // Phase 58: the progress report, at the bottom of the student's page.
  test('the progress report: dates checked in the panel, the PDF opened in the viewer', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const progress = await unwrap<any>(await admin.request.get(`/api/progress/${sofiaId}`), 'progress');

    await admin.goto(`/progress/${sofiaId}`);
    const panel = admin.getByTestId('progress-report');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();

    // Defaults: the plan's start to today, on the organization's clock; no original assessment.
    const from = panel.getByTestId('progress-report-from');
    const to = panel.getByTestId('progress-report-to');
    const original = panel.getByTestId('progress-report-original');
    const generate = panel.getByTestId('progress-report-generate');
    await expect(from).toHaveValue(progress.plan.starts_on);
    await expect(to).toHaveValue(progress.today);
    await expect(original).not.toBeChecked();
    await expect(generate).toBeEnabled();

    // A reversed range is refused before it is sent.
    await from.fill('2026-09-30');
    await to.fill('2026-09-01');
    await expect(panel.getByText('The "To" date is before the "From" date.')).toBeVisible();
    await expect(generate).toBeDisabled();

    // More than two years is refused too.
    await from.fill('2023-01-01');
    await to.fill('2026-09-01');
    await expect(panel.getByText('A report covers at most two years.')).toBeVisible();
    await expect(generate).toBeDisabled();

    // A valid range, with the original assessment: the report opens in the portal's viewer.
    await from.fill(progress.plan.starts_on);
    await to.fill(progress.today);
    await expect(panel.getByTestId('progress-report-problem')).toHaveCount(0);
    await original.check();
    await generate.click();

    await expect(admin).toHaveURL(new RegExp(`/progress/${sofiaId}/report\\?.*original=1`));
    await expect(admin.getByRole('heading', { name: /Progress report/ })).toBeVisible();
    await expect(admin.getByTestId('pdf-viewer')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    expect(await admin.getByTestId('pdf-page').count()).toBeGreaterThanOrEqual(1);
    await expect(admin.getByTestId('progress-report-download')).toHaveAttribute(
      'href',
      new RegExp(`/api/progress/${sofiaId}/report\\.pdf\\?from=${progress.plan.starts_on}&to=${progress.today}&original=1`),
    );

    // Back to the student's progress.
    await admin.getByRole('link', { name: progress.student.full_name + "'s progress" }).click();
    await expect(admin).toHaveURL(new RegExp(`/progress/${sofiaId}$`));
  });

  test('a tutor makes a progress report for their own student', async ({ as }) => {
    const tutor = await as('tutor');
    const sofiaId = await idOf(await as('admin'), PEOPLE.student.email);

    await tutor.goto(`/progress/${sofiaId}`);
    const panel = tutor.getByTestId('progress-report');
    await panel.scrollIntoViewIfNeeded();
    await panel.getByTestId('progress-report-generate').click();

    await expect(tutor).toHaveURL(new RegExp(`/progress/${sofiaId}/report\\?`));
    await expect(tutor.getByTestId('pdf-viewer')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    expect(await tutor.getByTestId('pdf-page').count()).toBeGreaterThanOrEqual(1);
  });

  test('a refused report says so in the viewer', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    // A reversed range typed into the address: the Worker answers 422 (validation_failed), and the page says why.
    await admin.goto(`/progress/${sofiaId}/report?from=2026-09-30&to=2026-09-01`);
    await expect(admin.getByTestId('pdf-viewer')).toHaveAttribute('data-state', 'error', { timeout: 20_000 });
    await expect(admin.getByTestId('pdf-viewer-error')).toBeVisible();
    await expect(admin.getByTestId('pdf-page')).toHaveCount(0);

    // Another family's parent is told the student does not exist (404), never shown a report.
    const parent = await as('parent');
    await parent.goto(`/progress/${sofiaId}/report`);
    await expect(parent.getByTestId('pdf-viewer')).toHaveAttribute('data-state', 'error', { timeout: 20_000 });
    await expect(parent.getByTestId('pdf-page')).toHaveCount(0);
  });
});

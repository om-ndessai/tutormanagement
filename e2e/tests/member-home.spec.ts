import { test, expect } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 66 (docs/member-home-plan.md H1-H4, H9, H11, R29): one home for every member. GET /api/home
 * takes no person and holds the reader's own parts only -- the tutor's own pairings, the parent's own
 * children, the learner's own lessons -- with no money. The seed's lessons fall on fixed weekdays, so
 * nothing here depends on the day the suite runs beyond "a lesson to record exists in the last week"
 * (the seed's schedules run on past the last recorded lesson).
 */

const MONEY = /cents|amount|balance|charged|outstanding/i;

test.describe('the member home (Phase 66)', () => {
  test('each person gets their own hats and parts, never money @smoke', async ({ as }) => {
    const tutor = await unwrap<any>(await (await as('tutor')).request.get('/api/home'), 'tutor home');
    expect(tutor.hats).toEqual(['tutor']);
    expect(JSON.stringify(tutor)).not.toMatch(MONEY);
    expect(tutor.office).toBeNull();
    expect(tutor.parent).toBeNull();
    expect(['morning', 'afternoon', 'evening']).toContain(tutor.part_of_day);
    expect(tutor.first_name).toBe('Alex');
    expect(tutor.tutor.to_record_count).toBeGreaterThanOrEqual(tutor.tutor.to_record.length);

    // Only the tutor's own pairings appear.
    const tutorPage = await as('tutor');
    const pairings = await unwrap<any[]>(await tutorPage.request.get('/api/assignments'), 'pairings');
    const mine = new Set(pairings.filter((p) => p.tutor_name === 'Alex Chen').map((p) => p.student_user_id));
    for (const lesson of [...tutor.tutor.to_record, tutor.tutor.now.next].filter(Boolean)) {
      expect(mine.has(lesson.student_user_id)).toBe(true);
    }

    // An admin who tutors wears both hats; the office part is counts (and first names), no money.
    const admin = await unwrap<any>(await (await as('admin')).request.get('/api/home'), 'admin home');
    expect(admin.hats).toEqual(expect.arrayContaining(['tutor', 'office']));
    expect(typeof admin.office.to_record_count).toBe('number');
    expect(typeof admin.office.invitations).toBe('number');
    expect(JSON.stringify(admin)).not.toMatch(MONEY);

    // A parent's part is their own child only.
    const parent = await unwrap<any>(await (await as('parent')).request.get('/api/home'), 'parent home');
    expect(parent.hats).toEqual(['parent']);
    expect(parent.parent.children.map((c: any) => c.first_name)).toEqual(['Sanjay']);
    expect(JSON.stringify(parent)).not.toMatch(MONEY);

    // A student is a learner; their next lesson is their own.
    const student = await unwrap<any>(await (await as('student')).request.get('/api/home'), 'student home');
    expect(student.hats).toEqual(['learner']);
    if (student.learner.next_lesson) expect(student.learner.next_lesson.student_name).toBe('Sofia Okafor');

    // A parent who also tutors but teaches nobody lands as a parent, not on an empty tutor home.
    const maria = await unwrap<any>(await (await as('parentTutor')).request.get('/api/home'), 'parent+tutor home');
    expect(maria.hats).toEqual(['parent']);
    expect(maria.tutor).toBeNull();
  });

  test('the home answers where there is no Tutoring; the tutor home stays Tutoring’s', async ({ as }) => {
    const ines = await as('assessAdmin', { org: 'assess' });
    const home = await unwrap<any>(await ines.request.get('/api/home'), 'assess home');
    expect(home.tutor).toBeNull();
    // Phase 74 (JF6, owner 2026-11-05): where Tutoring is off, what the reader came for leads -- her child, then the
    // office of the space she runs -- and playing follows.
    expect(home.hats).toEqual(['parent', 'office', 'learner']);
    expect(home.focus).toBe('family');
    expect((await ines.request.get('/api/home/tutor')).status()).toBe(403);
  });

  test('a tutor records a lesson from the home, prefilled from the schedule @smoke', async ({ as }) => {
    const page = await as('tutor');
    await page.goto('/');
    await expect(page.getByTestId('member-home')).toBeVisible();
    await expect(page.getByTestId('home-greeting')).toContainText('Alex');
    await expect(page.getByTestId('next-up')).toBeVisible();
    await expect(page.getByTestId('home-section-tutor')).toBeVisible();

    const home = await unwrap<any>(await page.request.get('/api/home'), 'home');
    const lesson = home.tutor.to_record[0];
    test.skip(!lesson, 'nothing to record in the last week');
    await page.getByTestId(`home-record-${lesson.schedule_id}-${lesson.occurs_on}`).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('#date')).toHaveValue(lesson.occurs_on);
    await expect(dialog.locator('#pairing')).toContainText(lesson.student_name);
    await expect(dialog.getByText(/Starts?/).first()).toBeVisible();
  });

  test('a parent sees their child’s next lesson and no money; the dashboard keeps the figures', async ({ as }) => {
    const page = await as('parent');
    await page.goto('/');
    const home = await unwrap<any>(await page.request.get('/api/home'), 'home');
    const child = home.parent.children[0];
    await expect(page.getByTestId(`home-child-${child.student_user_id}`)).toBeVisible();
    await expect(page.getByTestId('home-section-parent')).toContainText('Sanjay');
    await expect(page.getByTestId('member-home')).not.toContainText('$');

    await page.getByRole('link', { name: 'Dashboard' }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('a parent who tutors nobody sees their child first, not an empty tutor section', async ({ as }) => {
    const page = await as('parentTutor');
    await page.goto('/');
    await expect(page.getByTestId('home-section-parent')).toBeVisible();
    await expect(page.getByTestId('home-section-tutor')).toHaveCount(0);
  });

  test('Later puts the Next up item off for the day', async ({ as }) => {
    const page = await as('admin');
    await page.goto('/');
    const card = page.getByTestId('next-up');
    await expect(card).toBeVisible();
    const before = await card.locator('[data-testid^="next-up-"]').first().getAttribute('data-testid');
    const later = page.getByTestId('next-up-later');
    test.skip((await later.count()) === 0, 'the Next up item cannot be put off');
    await later.click();
    await expect(card.locator('[data-testid^="next-up-"]').first()).not.toHaveAttribute('data-testid', before!);
  });
});

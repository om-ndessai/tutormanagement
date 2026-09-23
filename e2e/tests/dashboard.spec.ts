import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/** Phase 8: one route, a different dashboard per role. */
test.describe('dashboards', () => {
  // Since phase 15 the dashboard is two tabs: the teaching on one, the money
  // on the other. Each half is asserted where it now lives.
  test('an admin sees institute-wide counts and balances', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');

    await expect(admin.getByText('Students', { exact: true })).toBeVisible();
    await expect(admin.getByText('Recent activity')).toBeVisible();

    await admin.getByRole('tab', { name: /Finance/ }).click();
    await expect(admin.getByText('Owed to tutors')).toBeVisible();
    await expect(admin.getByText('Owed by families')).toBeVisible();
    await expect(admin.getByText('Tutors awaiting payment')).toBeVisible();
  });

  test('a tutor sees their own students and earnings, not the institute', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/');

    await expect(tutor.getByRole('heading', { name: 'Tutoring Sessions' })).toBeVisible();
    await expect(tutor.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();

    await tutor.goto('/?tab=finance');
    await expect(tutor.getByText('Owed to you')).toBeVisible();
    // Institute-wide figures belong to the admin dashboard only, on either tab.
    await expect(tutor.getByText('Owed by families')).toHaveCount(0);
  });

  test('a parent sees their children and what they owe', async ({ as }) => {
    const parent = await as('parent');
    await parent.goto('/');

    await expect(parent.getByText('Your children')).toBeVisible();
    await expect(parent.getByText('Outstanding')).toBeVisible();
    await expect(parent.getByText(PEOPLE.studentTutor.name).first()).toBeVisible();
  });

  test('a multi-role user can switch which dashboard they see', async ({ as }) => {
    // Sanjay tutors younger children and is taught himself.
    const page = await as('studentTutor');

    const asTutor = await unwrap<any>(
      await page.request.get('/api/dashboard?role=tutor'),
      'tutor dashboard',
    );
    expect(asTutor.data.kind).toBe('tutor');
    expect(asTutor.data.students.length).toBeGreaterThan(0);

    const asStudent = await unwrap<any>(
      await page.request.get('/api/dashboard?role=student'),
      'student dashboard',
    );
    expect(asStudent.data.kind).toBe('student');
    expect(asStudent.data.tutors.length).toBeGreaterThan(0);

    // The switcher is offered in the UI because he holds more than one role.
    await page.goto('/');
    await expect(page.getByLabel('Dashboard role')).toBeVisible();
  });

  test('an admin can view another user\'s dashboard, and others cannot', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);

    await admin.goto(`/dashboard?as=${alexId}`);
    await expect(admin.getByText(`Viewing as ${PEOPLE.tutor.name}`)).toBeVisible();
    await expect(admin.getByRole('heading', { name: 'Tutoring Sessions' })).toBeVisible();

    // A tutor asking for somebody else's dashboard is refused by the API.
    //
    // The id is looked up through the ADMIN's context on purpose: role scoping
    // means a tutor cannot see an admin at all, so resolving it as the tutor
    // would fail for the wrong reason and hide what this test is checking.
    const adminId = await idOf(admin, PEOPLE.admin.email);
    const tutor = await as('tutor');
    const refused = await tutor.request.get(`/api/dashboard?user_id=${adminId}`);
    expect(refused.status()).toBe(403);
  });
});

/**
 * The "view as" control is a searchable combobox rather than a plain select:
 * with a full roster a dropdown cannot be scrolled to the person you want.
 */
test.describe('viewing another dashboard', () => {
  test('an admin can search for a user and open their dashboard', async ({ as }) => {
    const page = await as('admin');
    await page.goto('/');

    await page.getByLabel('View dashboard as').click();
    await page.getByPlaceholder('Search by name or email').fill('lindqvist');

    // Searching hits the API, so the match need not be on the first page of
    // the directory -- which is the whole point of replacing the select.
    const match = page.locator('[cmdk-item]', { hasText: 'Johan Lindqvist' });
    await expect(match).toBeVisible();

    // Each row says what kind of user it is.
    await expect(match).toContainText('Tutor');

    await match.click();

    await expect(page.getByText('Viewing as Johan Lindqvist')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('as')).toBeTruthy();
  });

  test('searching by email works too, and clears back to your own', async ({ as }) => {
    const page = await as('admin');
    await page.goto('/');

    await page.getByLabel('View dashboard as').click();
    await page.getByPlaceholder('Search by name or email').fill(PEOPLE.student.email);
    await page.locator('[cmdk-item]', { hasText: PEOPLE.student.name }).click();

    await expect(page.getByText(`Viewing as ${PEOPLE.student.name}`)).toBeVisible();

    await page.getByRole('button', { name: 'Back to mine' }).click();
    await expect(page.getByText('Viewing as')).toHaveCount(0);
  });
});

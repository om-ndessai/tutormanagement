import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/** Phase 8: one route, a different dashboard per role. */
test.describe('dashboards', () => {
  test('an admin sees institute-wide counts and balances', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');

    await expect(admin.getByText('Students', { exact: true })).toBeVisible();
    await expect(admin.getByText('Owed to tutors')).toBeVisible();
    await expect(admin.getByText('Owed by families')).toBeVisible();
    await expect(admin.getByText('Tutors awaiting payment')).toBeVisible();
    await expect(admin.getByText('Recent activity')).toBeVisible();
  });

  test('a tutor sees their own students and earnings, not the institute', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/');

    await expect(tutor.getByText('Your students')).toBeVisible();
    await expect(tutor.getByText('Owed to you')).toBeVisible();
    // Institute-wide figures belong to the admin dashboard only.
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
    await expect(admin.getByText('Your students')).toBeVisible();

    // A tutor asking for somebody else's dashboard is refused by the API.
    const tutor = await as('tutor');
    const adminId = await idOf(tutor, PEOPLE.admin.email);
    const refused = await tutor.request.get(`/api/dashboard?user_id=${adminId}`);
    expect(refused.status()).toBe(403);
  });
});

import { PEOPLE, expect, test } from '../support/fixtures.js';

/**
 * "Launch portal as a different type of user and validate." -- docs/plan.md.
 *
 * Each role should see a portal shaped to what they do, and should NOT see
 * other families' money or other tutors' rates.
 */
test.describe('each kind of user sees their own portal', () => {
  test('an admin sees the whole institute', async ({ as }) => {
    const page = await as('admin');
    await page.goto('/users');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

    // People from unrelated families and an unassigned tutor: an admin sees
    // everyone, including those no scoped role would be shown.
    //
    // Asserted by name rather than by a row count, because other specs in this
    // suite add users to the same database and a count would be brittle.
    await expect(page.getByText('Johan Lindqvist')).toBeVisible();
    await expect(page.getByText('Grace Lee')).toBeVisible();
    await expect(page.getByText('Ben Whitfield')).toBeVisible();
    await expect(page.getByText('Sofia Okafor')).toBeVisible();

    // Admin-only navigation and actions are present.
    await expect(page.getByRole('link', { name: 'Billing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add user' })).toBeVisible();
  });

  test('a tutor sees only their own students and earnings', async ({ as }) => {
    const page = await as('tutor');
    await page.goto('/sessions');

    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByText('Lessons you have taught, and what you have earned.')).toBeVisible();

    // Alex teaches Sofia and Ben, and nobody else.
    await expect(page.getByText('Sofia Okafor').first()).toBeVisible();
    await expect(page.getByText('Ben Whitfield').first()).toBeVisible();

    // Sanjay is taught by Priya, not by Alex: that session must not appear.
    await expect(page.getByText('Priya Raghavan')).toHaveCount(0);
  });

  test('a parent sees their child, not other families', async ({ as }) => {
    const page = await as('parent');
    await page.goto('/users');

    // Anita sees herself, her son Sanjay, and Sanjay's tutor Priya.
    await expect(page.getByText('Anita Patel').first()).toBeVisible();
    await expect(page.getByText('Sanjay Patel').first()).toBeVisible();

    // Another family's children are not hers to see.
    await expect(page.getByText('Ben Whitfield')).toHaveCount(0);
    await expect(page.getByText('Sofia Okafor')).toHaveCount(0);
  });

  test('a student sees their own record', async ({ as }) => {
    const page = await as('student');
    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Sofia Okafor' })).toBeVisible();
    await expect(page.getByText('Culbreth Middle')).toBeVisible();

    // Her tutor is visible; unrelated tutors are not.
    await page.goto('/users');
    await expect(page.getByText('Alex Chen').first()).toBeVisible();
    await expect(page.getByText('Johan Lindqvist')).toHaveCount(0);
  });

  test('someone who is both a tutor and a student sees both sides', async ({ as }) => {
    const page = await as('studentTutor');
    await page.goto('/profile');

    // Sanjay tutors younger children AND is taught himself, so his profile
    // carries both role sections at once.
    await expect(page.getByRole('heading', { name: 'Sanjay Patel' })).toBeVisible();
    await expect(page.getByText('Tutor', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Student', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('AP Calculus BC').first()).toBeVisible();
  });

  test('only admins can reach the write actions', async ({ as }) => {
    const tutorPage = await as('tutor');
    await tutorPage.goto('/assignments');

    // A tutor can see their pairings but cannot create one.
    await expect(tutorPage.getByText('The students you are assigned to teach.')).toBeVisible();
    await expect(tutorPage.getByRole('button', { name: 'Assign a student' })).toHaveCount(0);

    // And the API refuses even if the button is bypassed.
    const response = await tutorPage.request.post('/api/users', {
      data: { email: 'sneaky@gmail.com', full_name: 'Sneaky', roles: ['tutor'] },
    });
    expect(response.status()).toBe(403);
  });
});

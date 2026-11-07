import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 79 (M6, docs/members-plan.md): what a member -- a person in a space with no role -- sees on the web. They play
 * Quest, so their menu leaves out the teaching pages (Dashboard, Lessons, Progress, Schedule, Comments, Assessment),
 * and so does the command palette; their roles read "Member"; a link to the Assessment page says, in one line, that
 * assessments there are for students.
 *
 * Every member here is made in the test, through the API -- never a seeded row.
 */

const run = `${Date.now()}`;
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).first();
const TEACHING = ['Dashboard', 'Lessons', 'Progress', 'Schedule', 'Comments', 'Assessment'];

test.describe('a member (Phase 79)', () => {
  test('where Tutoring is on: no teaching pages in the menu or the palette, "Member" for their roles, one line on Assessment', async ({
    as,
  }) => {
    const admin = await as('admin');
    const email = `members.ui.${run}@gmail.com`;
    const member = await unwrap<any>(
      await admin.request.post('/api/users', { data: { full_name: 'Mel Member', email, roles: [], status: 'active' } }),
      'adding a member',
    );
    try {
      // The office's menu has the teaching pages (the institute has Tutoring and Assessment on)...
      await admin.goto('/');
      await expect(admin.getByTestId('member-home')).toBeVisible();
      for (const name of ['Lessons', 'Assessment']) await expect(mainNav(admin).getByRole('link', { name, exact: true })).toBeVisible();

      // ...and the member's has none of them.
      const mel = await as('student', { fresh: true, email });
      await mel.goto('/');
      await expect(mel.getByTestId('member-home')).toBeVisible();
      await expect(mainNav(mel).getByRole('link', { name: 'Home', exact: true })).toBeVisible();
      for (const name of TEACHING) await expect(mainNav(mel).getByRole('link', { name, exact: true })).toHaveCount(0);

      // The palette takes its pages from the menu.
      await mel.getByRole('button', { name: 'Search and go anywhere' }).click();
      const palette = mel.getByRole('dialog', { name: 'Go anywhere' });
      await expect(palette.getByRole('option', { name: 'Home', exact: true })).toBeVisible();
      for (const name of TEACHING) await expect(palette.getByRole('option', { name, exact: true })).toHaveCount(0);
      await mel.keyboard.press('Escape');

      // Their roles, in the account menu: "Member", never an empty line.
      await mel.getByRole('button', { name: 'Account menu' }).click();
      await expect(mel.getByText('Member at CHMI')).toBeVisible();
      await mel.keyboard.press('Escape');

      // A link still opens the Assessment page, which says so in one line -- no student picker.
      await mel.goto('/assessments');
      await expect(mel.getByTestId('assessment-for-students')).toHaveText('Assessments here are for students.');
      await expect(mel.getByLabel('Student')).toHaveCount(0);
      // And the Dashboard, by a link, gives the server's words rather than a blank page.
      await mel.goto('/dashboard');
      await expect(mel.getByTestId('dashboard-error')).toContainText('member');

      // The office's view-as picker leaves members out: there is no dashboard of theirs to view.
      await admin.goto('/dashboard');
      await admin.getByRole('combobox', { name: 'View dashboard as' }).click();
      await admin.getByPlaceholder('Search by name or email…').fill('Mel Member');
      await expect(admin.getByRole('option', { name: /Mel Member/ })).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/users/${member.id}?hard=true`);
    }
  });

  test('where Quest is on: Home and Quest in the menu, and still no Assessment', async ({ as, page }) => {
    // A space started here: Quest and Assessment on, no Tutoring (Phase 61, S10).
    const makerEmail = `members.maker.${run}@example.com`;
    const memberEmail = `members.quest.${run}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: makerEmail,
          dev_name: 'Mae Maker',
          birth_year: 1984,
          birth_month: 6,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      'the maker signs up',
    );
    const outside = await as('admin', { email: makerEmail, org: null });
    const name = `Members circle ${run.slice(-5)}`;
    const made = await unwrap<any>(await outside.request.post('/api/spaces', { data: { name } }), 'start a space');
    const maker = await as('admin', { email: makerEmail, org: made.slug });
    try {
      // "Anyone, by email": the address alone, no role.
      await unwrap(
        await maker.request.post('/api/users', {
          data: { email: memberEmail, full_name: 'Quinn Quest', roles: [], status: 'invited' },
        }),
        'invite a member',
      );
      const arriving = await as('student', { email: memberEmail, org: null });
      await unwrap(await arriving.request.post(`/api/auth/invitations/${made.slug}/accept`), 'the member accepts');

      const quinn = await as('student', { email: memberEmail, org: made.slug });
      await quinn.goto('/');
      await expect(quinn.getByTestId('member-home')).toBeVisible({ timeout: 15_000 });
      await expect(mainNav(quinn).getByRole('link', { name: 'Home', exact: true })).toBeVisible();
      await expect(mainNav(quinn).getByRole('link', { name: 'Quest', exact: true })).toBeVisible();
      await expect(mainNav(quinn).getByRole('link', { name: 'Assessment', exact: true })).toHaveCount(0);
      // The maker, an admin, keeps it.
      await maker.goto('/');
      await expect(mainNav(maker).getByRole('link', { name: 'Assessment', exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await maker.request.delete('/api/organization', { data: { confirm_name: name } });
      await outside.request.delete('/api/auth/account');
    }
  });
});

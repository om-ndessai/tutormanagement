import { expect, test } from '../support/fixtures.js';
import { visible } from '../support/ui.js';

/**
 * Adding a student through the dialog, rather than through the API the way
 * admin-workflow.spec.ts does.
 *
 * The guardian picker sits at the very bottom of a long form, which is what
 * broke it once: its list of parents was positioned relative to the chosen
 * item, and with no item chosen it opened off the bottom of the window. The
 * control looked disabled, and a student could not be given a parent at all.
 */
test('an admin can give a new student a parent from the form', async ({ as }) => {
  const page = await as('admin');
  const stamp = Date.now();
  const name = `E2E Form Student ${stamp}`;

  await page.goto('/users');
  await page.getByRole('button', { name: 'Add user' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(`e2e.form.${stamp}@gmail.com`);
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByText('Student', { exact: true }).click();

  // The list must open where it can be clicked, and naming a parent must stick.
  const picker = dialog.getByLabel('Add a parent or guardian');
  await picker.click();
  const parent = page.getByRole('option').first();
  const parentName = (await parent.innerText()).split('\n')[0]!.trim();
  await parent.click();

  await expect(dialog.getByRole('button', { name: `Remove ${parentName}` })).toBeVisible();

  await dialog.getByRole('button', { name: 'Add user' }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel('Search users').fill(name);
  await expect(visible(page, name).first()).toBeVisible();
});

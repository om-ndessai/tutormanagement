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

/**
 * UI upgrades U3: a new student starts with the family. Once Student is ticked, the parents
 * section comes before the child's own details, and a parent who is not in the portal yet is
 * added from inside the same dialog.
 */
test('a new student starts with the family, and a new parent is added in place', async ({ as }) => {
  const page = await as('admin');
  const stamp = Date.now();
  const student = `E2E Family First ${stamp}`;
  const parent = `E2E New Parent ${stamp}`;

  await page.goto('/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add user' });
  await dialog.getByText('Student', { exact: true }).click();

  // The family comes before the student's name.
  const family = dialog.getByTestId('family-first');
  await expect(family).toBeVisible();
  const familyTop = (await family.boundingBox())!.y;
  const nameTop = (await dialog.getByLabel('Full name').boundingBox())!.y;
  expect(familyTop).toBeLessThan(nameTop);

  // A parent who is not in the portal yet.
  await family.getByRole('button', { name: 'New parent…' }).click();
  const parentDialog = page.getByRole('dialog', { name: 'New parent' });
  await parentDialog.getByRole('button', { name: 'Add parent' }).click();
  await expect(parentDialog.getByRole('alert').first()).toBeVisible();
  await parentDialog.getByLabel('Full name').fill(parent);
  await parentDialog.getByLabel('Email').fill(`e2e.newparent.${stamp}@gmail.com`);
  await parentDialog.getByRole('button', { name: 'Add parent' }).click();
  await expect(parentDialog).toBeHidden();
  await expect(family.getByRole('button', { name: `Remove ${parent}` })).toBeVisible();

  // Then the child, and one save.
  await dialog.getByLabel('Full name').fill(student);
  await dialog.getByRole('button', { name: 'Add user' }).click();
  await expect(dialog).toBeHidden();

  const created = await page.request.get(`/api/users?search=${encodeURIComponent(student)}`);
  const [row] = (await created.json()).data;
  const detail = (await (await page.request.get(`/api/users/${row.id}`)).json()).data;
  expect(detail.guardians.map((g: any) => g.full_name)).toEqual([parent]);
});

test('editing keeps the usual order', async ({ as }) => {
  const page = await as('admin');
  await page.goto('/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add user' });
  // A tutor gets no family-first section.
  await dialog.getByText('Tutor', { exact: true }).click();
  await expect(dialog.getByTestId('family-first')).toHaveCount(0);
});

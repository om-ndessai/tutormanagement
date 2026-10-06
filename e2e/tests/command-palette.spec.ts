import { expect, test } from '../support/fixtures.js';

/**
 * The command palette (⌘K / Ctrl+K): pages, people and actions by typing.
 *
 * What it must hold to: it offers only what the reader may reach -- the
 * Organization page is an admin's, and the people it finds are the ones the
 * API lets that reader list.
 */

const palette = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Go anywhere' });

test.describe('command palette', () => {
  test('the shortcut opens it, and a page is a few letters away', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');
    await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await admin.keyboard.press('ControlOrMeta+k');
    await expect(palette(admin)).toBeVisible();
    await palette(admin).getByRole('combobox').fill('money');
    await admin.keyboard.press('Enter');

    await expect(admin).toHaveURL(/\/billing/);
    await expect(palette(admin)).toBeHidden();
  });

  test('the header button opens it, and finds a person by name', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/sessions');
    await admin.getByRole('button', { name: 'Search and go anywhere' }).click();

    await palette(admin).getByRole('combobox').fill('Anita Pat');
    await palette(admin).getByRole('option', { name: /Anita Patel/ }).click();
    await expect(admin).toHaveURL(/\/users\?view=/);
  });

  test('switching the theme from it changes the theme', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');
    await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await admin.keyboard.press('ControlOrMeta+k');
    await palette(admin).getByRole('combobox').fill('dark theme');
    await admin.keyboard.press('Enter');
    await expect(admin.locator('html')).toHaveClass(/dark/);
  });

  test('a tutor is not offered the organization settings', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/');
    await expect(tutor.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await tutor.keyboard.press('ControlOrMeta+k');
    await expect(palette(tutor).getByRole('option', { name: 'Sessions', exact: true })).toBeVisible();
    await expect(palette(tutor).getByRole('option', { name: 'Organization', exact: true })).toHaveCount(0);
  });
});

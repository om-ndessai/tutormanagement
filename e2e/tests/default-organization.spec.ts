import type { Page } from '@playwright/test';

import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * A default organization: someone in several chooses where they land on
 * signing in.
 *
 * The rules worth holding: it decides where an ARRIVING tab lands (ahead of
 * the browser's last organization), never moves a tab that has chosen; there
 * is at most one; only an organization the person may enter now; and choosing
 * one is the person's own logged action.
 *
 * Alex Chen tutors in A and is a parent in B. The suite runs one test at a
 * time, and every test here leaves Alex with no default.
 */

const session = async (page: Page) =>
  unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

const defaults = async (page: Page) =>
  (await session(page)).memberships.filter((m: any) => m.is_default).map((m: any) => m.slug);

const clear = (page: Page) => page.request.put('/api/auth/default-organization', { data: { slug: null } });

test.describe('default organization', () => {
  test('starring one on the picker makes it where a new sign-in lands', async ({ as }) => {
    const alex = await as('tutor', { org: null });
    try {
      await alex.goto('/select-organization');
      await alex.getByRole('button', { name: `Land in ${ORGS.b.name} on sign-in` }).click();
      await expect(alex.getByTestId(`org-${ORGS.b.slug}`).getByText('Default')).toBeVisible();
      expect(await defaults(alex)).toEqual([ORGS.b.slug]);

      // A browser that was last in A: a fresh tab still lands in the default.
      const later = await as('tutor');
      await later.goto('/');
      await expect(later.getByTestId('org-switcher')).toContainText(ORGS.b.short);

      // A browser with no organization remembered at all lands there too,
      // rather than at the picker.
      const fresh = await as('tutor', { org: null });
      await fresh.goto('/');
      await expect(fresh).not.toHaveURL(/select-organization/);
      await expect(fresh.getByTestId('org-switcher')).toContainText(ORGS.b.short);

      // Once the tab has chosen, it stays where it was put.
      await later.getByTestId('org-switcher').click();
      await later.getByRole('menuitem', { name: new RegExp(ORGS.a.name) }).click();
      await expect(later.getByTestId('org-switcher')).toContainText(ORGS.a.short);
      await later.reload();
      await expect(later.getByTestId('org-switcher')).toContainText(ORGS.a.short);
    } finally {
      await clear(alex);
    }
  });

  test('the switcher sets and clears it, and there is only ever one', async ({ as }) => {
    const alex = await as('tutor');
    try {
      await alex.goto('/');
      await alex.getByTestId('org-switcher').click();
      await alex.getByRole('menuitem', { name: `Land in ${ORGS.a.short} on sign-in` }).click();
      await expect.poll(() => defaults(alex)).toEqual([ORGS.a.slug]);

      await alex.request.put('/api/auth/default-organization', { data: { slug: ORGS.b.slug } });
      expect(await defaults(alex)).toEqual([ORGS.b.slug]);

      await alex.request.put('/api/auth/default-organization', { data: { slug: ORGS.a.slug } });
      await alex.reload();
      await alex.getByTestId('org-switcher').click();
      await alex.getByRole('menuitem', { name: `Stop landing in ${ORGS.a.short} on sign-in` }).click();
      await expect.poll(() => defaults(alex)).toEqual([]);
    } finally {
      await clear(alex);
    }
  });

  test('only an organization they may enter, and the choice is logged there', async ({ as }) => {
    const alex = await as('tutor');
    const priya = await as('admin');
    const maria = await as('parentTutor');
    try {
      // Maria belongs to A only: B is reported missing, not forbidden.
      const refused = await maria.request.put('/api/auth/default-organization', {
        data: { slug: ORGS.b.slug },
      });
      expect(refused.status()).toBe(404);
      expect((await maria.request.put('/api/auth/default-organization', { data: { slug: 'no-such-org' } })).status()).toBe(404);

      const ok = await alex.request.put('/api/auth/default-organization', { data: { slug: ORGS.a.slug } });
      expect(ok.status()).toBe(200);
      const log = await unwrap<any[]>(await priya.request.get('/api/audit?limit=20'), 'A’s log');
      expect(log.map((event) => event.action)).toContain('membership.default_set');
    } finally {
      await clear(alex);
    }
  });

  test('someone in one organization is not offered it', async ({ as }) => {
    const maria = await as('parentTutor');
    await maria.goto('/');
    await expect(maria.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(maria.getByTestId('org-switcher')).toHaveCount(0);
    await expect(maria.getByText(/on sign-in/)).toHaveCount(0);
  });
});

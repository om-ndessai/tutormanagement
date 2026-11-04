import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 67 (docs/member-home-plan.md H5-H7): a newcomer keeps what the guest page promised. Their
 * personal space offers NC 2026 (its default) beside Beast Academy, so the Quest board says "Grade 4"
 * in Grade 4's hue; "Show your work" is for oneself there; and the guest home keeps its look.
 *
 * Makes its own newcomer (a stamp keeps runs apart) and deletes the account at the end.
 */

const stamp = Date.now();

const signup = (page: Page, email: string, name: string) =>
  page.request.post('/api/auth/signup', {
    data: {
      dev_email: email,
      dev_name: name,
      birth_year: 1986,
      birth_month: 6,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
  });

test.describe('Phase 67: the Quest board and a newcomer’s space', () => {
  test('a personal space offers NC 2026 and Beast Academy; Grade 4 leads in its hue; Show your work is for oneself', async ({
    page,
    as,
  }) => {
    const email = `nia.newcomer.${stamp}@example.com`;
    await unwrap(await signup(page, email, 'Nia Newcomer'), 'the newcomer signs up');
    const outside = await as('admin', { email, org: null });
    const session = await unwrap<any>(await outside.request.get('/api/auth/session'), 'session');
    const personal = session.memberships.find((m: any) => m.personal) ?? session.memberships[0];
    try {
      const nia = await as('admin', { email, org: personal.slug });
      const offered = await unwrap<any[]>(await nia.request.get('/api/organization/curricula'), 'curricula');
      const on = offered.filter((c) => c.offered).map((c) => c.id).sort();
      expect(on).toEqual(['ba', 'nc-2026']);
      expect(offered.find((c) => c.is_default)?.id).toBe('nc-2026');

      // The member tiles speak grades, and "Show your work" reaches a personal space.
      const tiles = (await unwrap<any>(await nia.request.get('/api/quest/tiles'), 'tiles')).tiles;
      const codes = tiles.map((t: any) => t.code);
      expect(codes).toContain('G4Q5');
      expect(codes).toContain('G4A5');

      // A guest's Grade 4, left on this device, leads the board.
      await nia.goto('/');
      await nia.evaluate(() => localStorage.setItem('aimtrue.guest', JSON.stringify({ grade: 'NC26.4' })));
      await nia.reload();
      const home = nia.getByTestId('play-home');
      await expect(home).toBeVisible({ timeout: 15_000 });
      await expect(home.getByTestId('play-grade-4')).toHaveAttribute('aria-checked', 'true');
      // Grade 4's hue on the chip and the card's band, with the level said in words beside it.
      await expect(home.getByTestId('play-grade-4')).toHaveClass(/bg-grade-4/);
      const card = home.getByTestId('play-tile-G4Q5');
      await expect(card).toContainText('Quick 5');
      await expect(card).toContainText('Grade 4');
      await expect(card.locator('.bg-grade-4')).toHaveCount(1);
      // Another grade: its own cards, its own hue.
      await home.getByTestId('play-grade-6').click();
      await expect(home.getByTestId('play-tile-G6Q5').locator('.bg-grade-6')).toHaveCount(1);
      await expect(home.getByTestId('play-tile-G4Q5')).toHaveCount(0);

      // Show your work: an assessment of the newcomer's own, five questions, opened to take.
      await home.getByTestId('play-grade-4').click();
      await expect(home.getByTestId('play-tile-G4A5')).toContainText('Show your work');
      await home.getByTestId('play-tile-G4A5').getByRole('button', { name: /^Start G4A5/ }).click();
      await expect(nia).toHaveURL(/\/assessments\/[0-9a-f-]+$/);
      const id = nia.url().split('/').pop()!;
      const made = await unwrap<any>(await nia.request.get(`/api/canvas-assessments/${id}`), 'the assessment');
      expect(made.student_user_id).toBe(session.user.id);
      expect(made.question_count).toBe(5);
      expect(made.can_continue).toBe(true);
    } finally {
      await outside.request.delete('/api/auth/account');
    }
  });

  test('outside a personal space, an assessment is still for a student one may follow', async ({ as }) => {
    const tutor = await as('tutor');
    const me = await unwrap<any>(await tutor.request.get('/api/auth/session'), 'session');
    const refused = await tutor.request.post('/api/canvas-assessments', { data: { student_user_id: me.user.id, level_id: 'NC26.4' } });
    expect(refused.status()).toBe(404);
  });
});

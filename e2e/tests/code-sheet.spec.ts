import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 72 (docs/journey-fixes-plan.md JF4, JF9): one "Have a code?" sheet. It names what a code found before
 * sending anything -- a space's name, then Ask to join; a game, its join choices -- and, signed out, keeps the code
 * (or a quest link a guest cannot play) on the device for the first home.
 *
 * Serial: the space's Quest switch and the platform's guest switch, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

async function signedOut(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }) }),
  );
}

test.describe('JF4: one Have a code? sheet', () => {
  test("a member's quick action names the space before asking, and a game link opens its join choices", async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      await sofia.goto('/');
      await sofia.getByTestId('quick-join_code').click();
      const sheet = sofia.getByTestId('code-sheet');
      await expect(sheet).toBeVisible();
      await sheet.getByTestId('code-sheet-code').fill('fmxy 2345');
      await sheet.getByTestId('code-sheet-go').click();
      // The space is named before anything is sent.
      await expect(sheet.getByTestId('code-sheet-space')).toHaveText('Ferreira Family Practice');
      await sheet.getByTestId('code-sheet-ask').click();
      await expect(sofia.getByText('Asked to join Ferreira Family Practice. Its admins will let you in.')).toBeVisible();
      await unwrap(await sofia.request.delete('/api/spaces/join-requests/assess'), 'withdrawn');

      // A shared game link (`/?code=`, the lobby's QR code) opens the sheet on it: the game's join choices.
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1 },
        }),
        'a game to join',
      );
      await sofia.goto(`/?code=${game.code}`);
      await expect(sofia.getByTestId('game-join-dialog')).toBeVisible();
    } finally {
      await sofia.request.delete('/api/spaces/join-requests/assess');
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('signed out, a code and a sent quest are kept on the device, and the first home offers them once', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const admin = await as('admin');
    const before = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console');
    await unwrap(await platform.request.put('/api/platform/guest', { data: { ...before.settings, enabled: true } }), 'guest play on');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    const visitor = await as('student');
    try {
      await signedOut(visitor);
      await visitor.goto('/');
      await expect(visitor.getByTestId('guest-home')).toBeVisible();
      await visitor.getByTestId('guest-have-code').click();
      const sheet = visitor.getByTestId('code-sheet');
      await sheet.getByTestId('code-sheet-code').fill('FMXY-2345');
      await sheet.getByTestId('code-sheet-go').click();
      await expect(sheet).toContainText('Kept on this device');
      await expect(sheet).toContainText('FMXY2345');
      await sheet.getByTestId('code-sheet-keep-playing').click();

      // The same visitor, signed in on this device: the home offers the code once, and Use it looks it up.
      await visitor.unroute('**/api/auth/session');
      await visitor.goto('/');
      const kept = visitor.getByTestId('home-kept');
      await expect(kept).toContainText('FMXY2345');
      await kept.getByTestId('home-kept-use').click();
      await expect(visitor.getByTestId('code-sheet-space')).toHaveText('Ferreira Family Practice');
      await visitor.keyboard.press('Escape');
      await visitor.goto('/');
      await expect(visitor.getByTestId('member-home')).toBeVisible();
      await expect(visitor.getByTestId('home-kept')).toHaveCount(0);

      // A friend's link to a quest guests cannot play is named on the guest page, then offered on the home.
      await signedOut(visitor);
      await visitor.goto('/play/G4T10');
      await expect(visitor.getByTestId('guest-sent')).toContainText('You were sent 10-minute challenge, Grade 4');
      await visitor.unroute('**/api/auth/session');
      await visitor.goto('/');
      await expect(visitor.getByTestId('home-kept')).toContainText('You were sent a quest: 10-minute challenge, Grade 4');
      await visitor.getByTestId('home-kept-later').click();
      await expect(visitor.getByTestId('home-kept')).toHaveCount(0);
    } finally {
      await unwrap(await platform.request.put('/api/platform/guest', { data: before.settings }), 'guest play back');
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });
});

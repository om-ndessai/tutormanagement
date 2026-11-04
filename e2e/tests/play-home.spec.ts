import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 62 (docs/stickiness-plan.md): P6, the members' Play home -- Continue, favorites, the tiles and
 * one code box, each a quest in one tap. A student's home in every space; every member's in a space
 * without Tutoring.
 *
 * Serial: the space's Quest switch, and Sofia's favorites, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

test.describe('P6: the Play home', () => {
  test('a student starts a tile in one tap, then Continue, a starred favorite, and a code', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      // Clean favorites, so the star is offered.
      for (const favorite of await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'favorites')) {
        await sofia.request.delete(`/api/quest/games/favorites/${favorite.id}`);
      }

      await sofia.goto('/');
      const home = sofia.getByTestId('play-home');
      await expect(home).toBeVisible();
      // Phase 67: the Quest board shows one grade at a time; Grade 4's cards hold G4Q5.
      await home.getByTestId('play-grade-4').click();
      await expect(home.getByTestId('play-grade-4')).toHaveAttribute('aria-checked', 'true');
      await expect(home.getByTestId('play-tile-G4Q5')).toContainText('Quick 5');
      await expect(home.getByTestId('play-tile-G4Q5')).toContainText('Grade 4');
      await home.getByRole('button', { name: /^Start G4Q5/ }).click();
      // One tap: the doors, then the first question.
      await expect(sofia).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);
      await expect(sofia.getByTestId('game-question')).toBeVisible({ timeout: 15_000 });
      await expect(sofia.getByTestId('game-question')).toContainText('of 5');

      // Home again: Continue starts the same quest.
      await sofia.goto('/');
      await expect(home.getByTestId('play-continue')).toHaveText(/Continue G4Q5/);

      // Back home, the last quest's grade leads the board.
      await expect(home.getByTestId('play-grade-4')).toHaveAttribute('aria-checked', 'true');

      // A star saves the tile as a favorite, which then starts in one tap. Beast Academy 3 is Grade 3's
      // advanced track, marked so.
      await home.getByTestId('play-grade-3').click();
      await expect(home.getByTestId('play-tile-BA3Q5')).toContainText('Beast Academy 3');
      await expect(home.getByTestId('play-tile-BA3Q5')).toContainText('Adv');
      await home.getByRole('button', { name: 'Add BA3Q5 to favorites' }).click();
      await expect(home.getByTestId('play-favorite-BA3Q5')).toBeVisible();
      await home.getByTestId('play-favorite-BA3Q5').click();
      await expect(sofia.getByTestId('game-question')).toBeVisible({ timeout: 15_000 });

      // The code box: a game's six characters open its join choices.
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1 },
        }),
        'a game to join',
      );
      await sofia.goto('/');
      await sofia.getByLabel('Have a code?').fill(game.code);
      await home.getByRole('button', { name: 'Go' }).click();
      await expect(sofia.getByTestId('game-join-dialog')).toBeVisible();
    } finally {
      for (const favorite of await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'favorites')) {
        await sofia.request.delete(`/api/quest/games/favorites/${favorite.id}`);
      }
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test("P13: this device's guest grade leads the home, and the tiles it played become favorites, once", async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    const clean = async () => {
      for (const favorite of await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'favorites')) {
        await sofia.request.delete(`/api/quest/games/favorites/${favorite.id}`);
      }
    };
    try {
      await clean();
      // What a guest left in this browser: Grade 5 chosen, BA3Q5 then G4T10 played.
      await sofia.goto('/');
      await sofia.evaluate(() => localStorage.setItem('aimtrue.guest', JSON.stringify({ grade: 'NC26.5', played: ['G4T10', 'BA3Q5'] })));
      await sofia.reload();
      const home = sofia.getByTestId('play-home');
      await expect(home.getByTestId('play-daily')).toContainText(/G5D/);
      // Phase 67: the guest's grade leads the board too.
      await expect(home.getByTestId('play-grade-5')).toHaveAttribute('aria-checked', 'true');
      await expect(home.getByTestId('play-favorite-G4T10')).toBeVisible();
      await expect(home.getByTestId('play-favorite-BA3Q5')).toBeVisible();
      const names = (await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'favorites')).map((f) => f.name).sort();
      expect(names).toEqual(['BA3Q5', 'G4T10']);

      // Carried once: a favorite removed afterwards does not come back.
      await expect
        .poll(() => sofia.evaluate(() => (JSON.parse(localStorage.getItem('aimtrue.guest') ?? '{}').carried ?? []).sort().join()))
        .toBe('BA3Q5,G4T10');
      await clean();
      await sofia.reload();
      await expect(home.getByTestId('play-daily')).toBeVisible();
      await expect(home.getByTestId('play-favorite-G4T10')).toHaveCount(0);
      expect(await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'favorites')).toHaveLength(0);
    } finally {
      await clean();
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test("a tutor's dashboard has no Play home, and with the console's switch off a student's neither", async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const platform = await as('platformAdmin', { org: null });
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    const play = await unwrap<any>(await platform.request.get('/api/platform/play'), 'play');
    const shape = ({ kind, level_id, mode, value, guest, members }: any) => ({ kind, level_id, mode, value, guest, members });
    try {
      await tutor.goto('/');
      await expect(tutor.getByTestId('member-home')).toBeVisible();
      await expect(tutor.getByTestId('play-home')).toHaveCount(0);

      await unwrap(
        await platform.request.put('/api/platform/play', { data: { settings: { ...play.settings, play_home: false }, tiles: play.tiles.map(shape) } }),
        'Play home off',
      );
      const sofia = await as('student');
      await sofia.goto('/');
      await expect(sofia.getByTestId('play-home')).toHaveCount(0);
    } finally {
      await platform.request.put('/api/platform/play', { data: { settings: play.settings, tiles: play.tiles.map(shape) } });
      await platform.request.post('/api/platform/play/reset-tiles');
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('P7: a multiplayer favorite opens its lobby in one tap, with the host playing, a QR code and Share', async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    let favoriteId = '';
    try {
      const favorite = await unwrap<any>(
        await admin.request.put('/api/quest/games/favorites', {
          data: { name: 'Table G5', config: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1, max_teams: 4 } },
        }),
        'a multiplayer favorite',
      );
      favoriteId = favorite.id;
      await admin.goto('/');
      await admin.getByTestId('play-favorite-Table G5').click();
      await expect(admin.getByTestId('game-lobby-code')).toBeVisible();
      await expect(admin.getByTestId('game-lobby-qr')).toBeVisible();
      await expect(admin.getByTestId('game-lobby-share')).toBeVisible();
      // The host is already a player: the start is theirs to press at once.
      const id = admin.url().split('/').pop()!;
      const game = await unwrap<any>(await admin.request.get(`/api/quest/games/${id}`), 'the game');
      expect(game.me.team_id).not.toBeNull();
      expect(game.teams.length).toBe(1);
      await expect(admin.getByTestId('game-start')).toBeEnabled();
    } finally {
      if (favoriteId) await admin.request.delete(`/api/quest/games/favorites/${favoriteId}`);
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });
});

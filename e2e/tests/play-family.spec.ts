import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 62 (docs/stickiness-plan.md): P8, family rosters and "Waiting for you". A multiplayer favorite
 * names its players; one tap makes the game with the host playing and invites them; each sees it under
 * "Waiting for you" and joins with no code to type. R27: a roster names only people the reader may name
 * -- every member of a self-serve space; in any other, everyone for an admin and their own family for
 * anyone else -- by first name.
 *
 * Serial: the space's Quest switch and the admin's favorite, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

test.describe('P8: family rosters', () => {
  test('R27: who a reader may put on a roster', async ({ as }) => {
    const admin = await as('admin');
    const parent = await as('parent');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const everyone = await unwrap<any[]>(await admin.request.get('/api/quest/games/members'), "the admin's list");
      expect(everyone.length).toBeGreaterThan(5);
      expect(Object.keys(everyone[0]).sort()).toEqual(['first_name', 'id']);
      // A parent in a space with Tutoring names their own family only: their child, not the tutors.
      const family = await unwrap<any[]>(await parent.request.get('/api/quest/games/members'), "the parent's list");
      expect(family.map((m) => m.first_name)).toEqual(['Sanjay']);
      expect(family.map((m) => m.first_name)).not.toContain('Alex');
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('one tap invites the roster; an invitee joins from Waiting for you with no code; others see nothing', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    const alex = await as('tutor');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    let favoriteId = '';
    let gameId = '';
    try {
      const members = await unwrap<any[]>(await admin.request.get('/api/quest/games/members'), 'members');
      const sofiaId = members.find((m) => m.first_name === 'Sofia').id;
      const favorite = await unwrap<any>(
        await admin.request.put('/api/quest/games/favorites', {
          data: {
            name: 'Family G5',
            config: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1, max_teams: 4 },
            roster: [sofiaId, 'not-a-member'],
          },
        }),
        'a roster favorite',
      );
      favoriteId = favorite.id;
      // Someone not in the space is dropped from the roster.
      expect(favorite.roster).toEqual([sofiaId]);

      // One tap on the compact row above the admin's dashboard: the lobby, the host playing.
      await admin.goto('/');
      await admin.getByTestId('play-favorite-Family G5').click();
      await expect(admin.getByTestId('game-lobby-code')).toBeVisible();
      gameId = admin.url().split('/').pop()!;
      // Phase 77 (JF15): the host's lobby says who was invited.
      await expect(admin.getByTestId('game-lobby-invited')).toHaveText('Invited: Sofia');

      // Sofia sees it waiting and joins in one tap (no code typed).
      await sofia.goto('/');
      const waiting = sofia.getByTestId('play-waiting');
      // Phase 73 (JF32): the game in words, not its code.
      await expect(waiting).toContainText('Priya started Grade 5 Quick 3');
      await waiting.getByRole('button', { name: 'Join' }).click();
      const dialog = sofia.getByTestId('game-join-dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /Join/ }).first().click();
      await expect(sofia).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);

      // Joined: no longer waiting. Alex was not invited: nothing waits for him.
      expect(await unwrap<any[]>(await sofia.request.get('/api/quest/games/waiting'), 'Sofia waiting')).toEqual([]);
      expect(await unwrap<any[]>(await alex.request.get('/api/quest/games/waiting'), 'Alex waiting')).toEqual([]);

      // The host starts whenever they like; the lobby says who of the invited is in.
      await admin.reload();
      await expect(admin.getByTestId('game-start')).toBeEnabled();
      await expect(admin.getByTestId('game-lobby-invited')).toHaveText('Invited: Sofia (joined)');
      // The invited list is the host's and the office's: Sofia, a player, reads none.
      await expect(sofia.getByTestId('game-lobby-code')).toBeVisible();
      await expect(sofia.getByTestId('game-lobby-invited')).toHaveCount(0);
    } finally {
      // Cancelled, so no lobby is left open for Continue in later specs (Phase 73).
      if (gameId) await admin.request.post(`/api/quest/games/${gameId}/end`);
      if (favoriteId) await admin.request.delete(`/api/quest/games/favorites/${favoriteId}`);
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('R27 crawl: every non-admin\'s roster list names only people they can already see, by first name', async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      for (const who of ['tutor', 'parent', 'student', 'studentTutor', 'parentTutor'] as const) {
        const page = await as(who);
        const members = await unwrap<any[]>(await page.request.get('/api/quest/games/members'), `${who}: members`);
        for (const member of members) expect(Object.keys(member).sort(), who).toEqual(['first_name', 'id']);
        const visible = new Set((await unwrap<any[]>(await page.request.get('/api/users?limit=100'), `${who}: people`)).map((u) => u.id));
        for (const member of members) expect(visible.has(member.id), `${who} sees ${member.first_name}`).toBe(true);
        // Nothing waits for anyone nobody invited; the tiles carry no person at all.
        expect(await unwrap<any[]>(await page.request.get('/api/quest/games/waiting'), `${who}: waiting`)).toEqual([]);
        const tiles = await unwrap<any>(await page.request.get('/api/quest/tiles'), `${who}: tiles`);
        for (const tile of tiles.tiles) {
          // Phase 64 (R28): `best` is present once the reader has finished that shape, and is their own score.
          expect(Object.keys(tile).filter((key) => key !== 'best').sort()).toEqual(
            ['available', 'beta', 'code', 'guest', 'kind', 'level_id', 'members', 'mode', 'value', 'words'].sort(),
          );
          if ('best' in tile) expect(typeof tile.best === 'number' || tile.best === null, `${who}: ${tile.code} best`).toBe(true);
        }
      }
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });
});

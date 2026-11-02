import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 64 (docs/stickiness-plan.md P17-P20): the habit layer.
 * - P17 a weekly streak and today's ring, from the day rollup a game's end writes;
 * - P18 badges, derived from rows kept anyway, on My progress;
 * - P19 the Daily set: five questions of a level, the same for everyone today, no keys until played,
 *   marked by the server, one play a day, a share grid that names nobody;
 * - P20 beat your best: a tile carries the reader's best score for its own shape.
 *
 * Serial: the space's Quest switch, changed and put back. Assumes a freshly reset database (one Daily
 * play a day per person and level).
 */
test.describe.configure({ mode: 'serial' });

async function questOn(page: import('@playwright/test').Page, on: boolean) {
  expect((await page.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

/** A single-player G4Q5 played through by API: one right answer (from the results' key after) is not
 *  possible before the end, so it answers the first question and skips the rest. */
async function playG4Q5(page: import('@playwright/test').Page): Promise<string> {
  const game = await unwrap<any>(
    await page.request.post('/api/quest/games', {
      data: { level_id: 'NC26.4', mode: 'count', question_count: 5, players: 'single', max_team_size: 1 },
    }),
    'a single-player G4Q5',
  );
  await page.waitForTimeout(5_500); // the countdown
  for (let i = 0; i < 5; i += 1) {
    const view = await unwrap<any>(await page.request.get(`/api/quest/games/${game.id}`), 'the game');
    if (view.status === 'finished' || !view.me?.question) break;
    const q = view.me.question;
    const data = i === 0 ? { question_id: q.id, answer: q.kind === 'choice' ? q.choices[0] : '1' } : { question_id: q.id, skip: true };
    await unwrap(await page.request.post(`/api/quest/games/${game.id}/answer`, { data }), 'an answer');
  }
  const done = await unwrap<any>(await page.request.get(`/api/quest/games/${game.id}`), 'the finished game');
  expect(done.status).toBe('finished');
  return game.id;
}

test.describe('P17-P18, P20: streak, badges and best', () => {
  test("a finished quest counts today, earns First quest, and is the tile's best", async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    await questOn(admin, true);
    try {
      await playG4Q5(sofia);

      const habit = await unwrap<any>(await sofia.request.get('/api/quest/me/habit'), 'my habit');
      expect(habit.played_today).toBe(true);
      expect(habit.days_this_week).toBeGreaterThanOrEqual(1);
      expect(habit.badges.find((b: any) => b.id === 'first_quest')?.earned).toBe(true);
      // Every badge is listed, earned or not, in the shared order.
      expect(habit.badges.length).toBe(8);

      // P20: G4Q5 carries Sofia's best, a number; a tile she never played has none.
      const tiles = (await unwrap<any>(await sofia.request.get('/api/quest/tiles'), 'tiles')).tiles;
      expect(typeof tiles.find((t: any) => t.code === 'G4Q5')?.best).toBe('number');
      expect(tiles.find((t: any) => t.code === 'G8T20')?.best ?? null).toBeNull();

      // My progress on the Play home.
      await sofia.goto('/');
      const card = sofia.getByTestId('my-progress');
      await expect(card).toBeVisible();
      await expect(card.getByTestId('my-progress-today')).toHaveAttribute('aria-label', 'Played today');
      await expect(card.getByTestId('badge-first_quest')).toBeVisible();
    } finally {
      await questOn(admin, false);
    }
  });

  test('the habit is the reader’s own: a person parameter changes nothing', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    await questOn(admin, true);
    try {
      const own = await unwrap<any>(await admin.request.get('/api/quest/me/habit'), 'own');
      const asked = await unwrap<any>(await admin.request.get(`/api/quest/me/habit?user_id=${encodeURIComponent('anyone')}`), 'asked');
      expect(asked).toEqual(own);
      // Sofia played today (the test before); the admin's own summary is not hers.
      expect((await unwrap<any>(await sofia.request.get('/api/quest/me/habit'), 'sofia')).played_today).toBe(true);
    } finally {
      await questOn(admin, false);
    }
  });
});

test.describe('P20: New best!', () => {
  test('a better score says New best!, an equal one does not', async ({ as }) => {
    const admin = await as('admin');
    const anita = await as('parent');
    await questOn(admin, true);
    try {
      // A G8 count game of a length unique to this run (so earlier runs' games are a different shape).
      // First: every answer wrong, a point off each.
      const count = 3 + (Math.floor(Date.now() / 1000) % 15);
      const play = async (wrong: boolean): Promise<any> => {
        const game = await unwrap<any>(
          await anita.request.post('/api/quest/games', {
            data: { level_id: 'NC26.8', mode: 'count', question_count: count, players: 'single', max_team_size: 1, wrong_points: wrong ? -1 : 0 },
          }),
          'a G8 game',
        );
        await anita.waitForTimeout(5_500);
        for (let i = 0; i < count; i += 1) {
          const view = await unwrap<any>(await anita.request.get(`/api/quest/games/${game.id}`), 'the game');
          if (view.status === 'finished' || !view.me?.question) break;
          const data = wrong ? { question_id: view.me.question.id, answer: 'not an answer' } : { question_id: view.me.question.id, skip: true };
          await unwrap(await anita.request.post(`/api/quest/games/${game.id}/answer`, { data }), 'an answer');
        }
        return unwrap<any>(await anita.request.get(`/api/quest/games/${game.id}/results`), 'the results');
      };
      const first = await play(true);
      expect(first.new_best).toBe(false); // nothing to beat yet
      const second = await play(false); // 0 beats a negative score
      expect(second.new_best).toBe(true);
      const third = await play(false); // 0 does not beat 0
      expect(third.new_best).toBe(false);

      await anita.goto(`/quest/games/${second.game.id}`);
      await expect(anita.getByTestId('game-new-best')).toBeVisible({ timeout: 15_000 });
      await anita.goto(`/quest/games/${third.game.id}`);
      await expect(anita.getByTestId('game-winner')).toBeVisible({ timeout: 15_000 });
      await expect(anita.getByTestId('game-new-best')).toHaveCount(0);
    } finally {
      await questOn(admin, false);
    }
  });
});

test.describe('P19: the Daily set', () => {
  test('the same five for everyone today, no keys before playing, one play a day', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    await questOn(admin, true);
    try {
      const mine = await unwrap<any>(await admin.request.get('/api/quest/daily/NC26.4'), "the admin's Daily");
      const theirs = await unwrap<any>(await tutor.request.get('/api/quest/daily/NC26.4'), "the tutor's Daily");
      expect(mine.questions.length).toBe(5);
      expect(mine.questions.map((q: any) => q.id)).toEqual(theirs.questions.map((q: any) => q.id));
      expect(mine.number).toBeGreaterThan(0);
      expect(mine.result).toBeNull();
      // R20: no key or solution before the play.
      for (const q of mine.questions) {
        expect(q.answer).toBeUndefined();
        expect(q.solution).toBeUndefined();
      }

      // A level outside the bank, and a malformed result, are refused.
      expect((await admin.request.get('/api/quest/daily/NOPE')).status()).toBe(404);
      expect(
        (await admin.request.post('/api/quest/daily/NC26.4/result', { data: { day: mine.day, answers: ['1'], seconds: 10 } })).status(),
      ).toBe(400);
      expect(
        (
          await admin.request.post('/api/quest/daily/NC26.4/result', {
            data: { day: '2020-01-01', answers: [null, null, null, null, null], seconds: 10 },
          })
        ).status(),
      ).toBe(409);

      // Played: the server marks it, and the keys arrive with the result.
      const played = await unwrap<any>(
        await admin.request.post('/api/quest/daily/NC26.4/result', {
          data: { day: mine.day, answers: [null, null, null, null, null], seconds: 42 },
        }),
        'the result',
      );
      expect(played.result).toMatchObject({ right: 0, of: 5, seconds: 42, marks: [false, false, false, false, false] });
      expect(typeof played.questions[0].answer).toBe('string');

      // One play a day.
      const again = await admin.request.post('/api/quest/daily/NC26.4/result', {
        data: { day: mine.day, answers: [null, null, null, null, null], seconds: 1 },
      });
      expect(again.status()).toBe(409);
      expect((await unwrap<any>(await admin.request.get('/api/quest/daily/NC26.4'), 'the Daily again')).result.seconds).toBe(42);

      // A Daily counts as a day played.
      expect((await unwrap<any>(await admin.request.get('/api/quest/me/habit'), 'habit')).played_today).toBe(true);
    } finally {
      await questOn(admin, false);
    }
  });

  test('played on the page: skip through, the result and its share grid', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    await questOn(admin, true);
    try {
      await sofia.goto('/quest/daily/NC26.5');
      await expect(sofia.getByTestId('daily-play')).toBeVisible();
      for (let i = 0; i < 5; i += 1) await sofia.getByTestId('daily-skip').click();
      const result = sofia.getByTestId('daily-result');
      await expect(result).toBeVisible();
      await expect(result).toContainText('0 of 5');
      await expect(sofia.getByTestId('daily-grid')).toHaveText('✗✗✗✗✗');
      // Coming back the same day shows the result, not the questions.
      await sofia.reload();
      await expect(sofia.getByTestId('daily-result')).toBeVisible();
    } finally {
      await questOn(admin, false);
    }
  });

  test('the console switch turns the Daily off for members', async ({ as }) => {
    const admin = await as('admin');
    const platform = await as('platformAdmin', { org: null });
    await questOn(admin, true);
    const before = await unwrap<any>(await platform.request.get('/api/platform/play'), 'play settings');
    try {
      const put = await platform.request.put('/api/platform/play', {
        data: { settings: { ...before.settings, daily: false }, tiles: before.tiles.map(({ code, ...tile }: any) => tile) },
      });
      expect(put.status()).toBe(200);
      expect((await admin.request.get('/api/quest/daily/NC26.6')).status()).toBe(403);
      expect((await unwrap<any>(await admin.request.get('/api/quest/tiles'), 'tiles')).daily).toBe(false);
    } finally {
      await platform.request.put('/api/platform/play', {
        data: { settings: { ...before.settings, daily: true }, tiles: before.tiles.map(({ code, ...tile }: any) => tile) },
      });
      if (before.is_default) await platform.request.post('/api/platform/play/reset-tiles');
      await questOn(admin, false);
    }
  });
});

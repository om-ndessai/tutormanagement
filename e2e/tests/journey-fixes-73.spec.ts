import type { Page } from '@playwright/test';
import { dailyLevelFor } from '@tmi/shared';
import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 73 (docs/journey-fixes-plan.md): coming back to play.
 * - JF13: Continue resumes the reader's open game -- running or in its lobby -- read from the server and said in words
 *   with where they are; with none open, "Play Grade 7 Quick 5 again". A New Quest game is continued too;
 * - JF14: the grade leading the board and the Daily is derived, a grade picked on the row is kept on the server, and
 *   "Which grade?" is asked once, only when nothing says;
 * - JF23: one Daily rule, on the board and in Next up, and one name, "Today's Daily";
 * - JF16: a game nobody answered in is not a result: "Nobody played", no confetti, no win, no badge;
 * - JF36: leaving returns to where the game was opened; ending asks first; the Daily has a close.
 *
 * Serial: the space's Quest switch, changed and put back. Each test makes its own learner (a student the office adds,
 * with no level and nothing played) so nobody's home is left changed.
 */
test.describe.configure({ mode: 'serial' });

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

/** A learner nobody knows the grade of yet: a student the office adds, with a parent. */
async function freshLearner(admin: Page, tag: string): Promise<{ email: string; ids: string[] }> {
  const stamp = `${tag}.${Date.now().toString(36)}`;
  const parent = await unwrap<any>(
    await admin.request.post('/api/users', { data: { full_name: 'Pat Comeback', email: `p73.parent.${stamp}@example.com`, roles: ['parent'] } }),
    'a parent',
  );
  const email = `p73.kid.${stamp}@example.com`;
  const kid = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: 'Kit Comeback',
        email,
        roles: ['student'],
        guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
      },
    }),
    'a student',
  );
  return { email, ids: [kid.id, parent.id] };
}

/** Every game the reader left open is ended, so no other spec meets it in Continue or Next up. */
async function endOpenGames(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const { open } = await unwrap<any>(await page.request.get('/api/quest/games/open'), 'the open game');
    if (!open) return;
    const ended = await page.request.post(`/api/quest/games/${open.game_id}/end`);
    if (!ended.ok()) await page.request.post(`/api/quest/games/${open.game_id}/leave`);
  }
}

/** A started game counts down before its first question; wait it out, by the server's clock. */
async function afterCountdown(game: { started_at: string; now: string }) {
  const wait = Date.parse(game.started_at) - Date.parse(game.now);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 200));
}

const single = (level_id: string, question_count: number) => ({
  level_id,
  mode: 'count',
  question_count,
  players: 'single',
  max_team_size: 1,
});

/** One answer on the game's screen: a choice, or a number. */
async function answerOnScreen(page: Page) {
  if (await page.getByTestId('game-number').isVisible()) await page.getByTestId('game-number').fill('1');
  else await page.getByTestId('game-choice-A').click();
  await page.getByTestId('game-submit').click();
}

const HOME = /^http:\/\/[^/]+\/$/;

test.describe('Phase 73: coming back to play', () => {
  test('JF13 + JF36: Continue resumes the open game in words, from the board and Next up; Exit returns where it was opened', async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'continue');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 7 } }), 'Grade 7');
      const game = await unwrap<any>(await kit.request.post('/api/quest/games', { data: single('NC26.7', 5) }), 'a Grade 7 Quick 5');
      await afterCountdown(game);

      // The server says where the reader is, in words -- without handing out a question.
      const read = await unwrap<any>(await kit.request.get('/api/quest/games/open'), 'Continue');
      expect(read).toMatchObject({ open: { game_id: game.id, status: 'running', question: 1, of: 5, points: 0 }, again: null });
      expect(read.open.label).toBe('Grade 7 Quick 5 · question 1 of 5 · 0 points');

      await kit.goto('/');
      const home = kit.getByTestId('play-home');
      await expect(home.getByTestId('play-continue')).toHaveText('Continue Grade 7 Quick 5 · question 1 of 5 · 0 points');
      await expect(kit.getByTestId('next-up-open_game')).toContainText('Grade 7 Quick 5 · question 1 of 5');
      await expect(kit.getByTestId('next-up-open_game')).toContainText('Pick up where you left off');

      // Next up opens that very game, at its first question.
      await kit.getByTestId('next-up').getByTestId('next-up-action').click();
      await expect(kit).toHaveURL(new RegExp(`/quest/games/${game.id}$`));
      await expect(kit.getByTestId('game-question')).toContainText('Question 1 of 5', { timeout: 15_000 });
      await kit.getByTestId('game-skip').click();
      await expect(kit.getByTestId('game-question')).toContainText('Question 2 of 5');

      // Exit goes back home -- where it was opened -- and Continue has moved on with the game.
      await kit.getByTestId('quest-exit').click();
      await expect(kit).toHaveURL(HOME);
      await expect(home.getByTestId('play-continue')).toHaveText(/Continue Grade 7 Quick 5 · question 2 of 5/);

      // Opened from the Quest page, Exit goes back there; the list says the game in words, its code after.
      await kit.goto('/quest');
      await expect(kit.getByTestId(`game-row-words-${game.code}`)).toHaveText('Grade 7 Quick 5');
      await kit.getByTestId(`game-row-${game.code}`).click();
      await expect(kit.getByTestId('game-question')).toBeVisible({ timeout: 15_000 });
      await kit.getByTestId('quest-exit').click();
      await expect(kit).toHaveURL(/\/quest$/);
    } finally {
      await endOpenGames(kit);
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });

  test('JF13: once the game ends, Continue offers it again by name; a New Quest game is continued too', async ({ as }) => {
    test.setTimeout(90_000);
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'again');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 7 } }), 'Grade 7');
      const first = await unwrap<any>(await kit.request.post('/api/quest/games', { data: single('NC26.7', 5) }), 'a game');
      await unwrap(await kit.request.post(`/api/quest/games/${first.id}/end`), 'ended');
      const read = await unwrap<any>(await kit.request.get('/api/quest/games/open'), 'Continue');
      expect(read.open).toBeNull();
      expect(read.again).toMatchObject({ label: 'Play Grade 7 Quick 5 again', request: { level_id: 'NC26.7', mode: 'count', question_count: 5 } });

      await kit.goto('/');
      const home = kit.getByTestId('play-home');
      await expect(home.getByTestId('play-continue')).toHaveText('Play Grade 7 Quick 5 again');
      // Next up: today's Daily first; put off, the replay under its own name.
      await expect(kit.getByTestId('next-up-daily')).toBeVisible();
      await kit.getByTestId('next-up-later').click();
      await expect(kit.getByTestId('next-up-continue_quest')).toContainText('Play Grade 7 Quick 5 again.');
      await kit.getByTestId('next-up').getByTestId('next-up-action').click();
      await expect(kit).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);
      expect(kit.url()).not.toContain(first.id);
      await expect(kit.getByTestId('game-question')).toContainText('of 5', { timeout: 15_000 });
      await endOpenGames(kit);

      // A game made in New Quest, from the board: Exit goes home, and Continue names it.
      await kit.goto('/');
      await home.getByRole('button', { name: 'New Quest' }).click();
      await expect(kit.getByTestId('game-wizard')).toBeVisible();
      await kit.getByTestId('game-tile-NC26.6').click();
      await kit.getByTestId('game-next').click();
      await kit.getByTestId('game-amount').fill('3');
      await kit.getByTestId('game-amount').blur();
      await kit.getByTestId('game-next').click();
      await kit.getByTestId('game-players-single').click();
      await kit.getByTestId('game-next').click();
      await kit.getByTestId('game-create').click();
      await expect(kit.getByTestId('game-question')).toContainText('of 3', { timeout: 15_000 });
      await kit.getByTestId('quest-exit').click();
      await expect(kit).toHaveURL(HOME);
      await expect(home.getByTestId('play-continue')).toHaveText(/Continue Grade 6 Quick 3 · question 1 of 3/);
    } finally {
      await endOpenGames(kit);
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });

  test('JF14: a grade picked on the row is kept on the server, across reloads and devices', async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const sofia = await as('student');
    try {
      await sofia.goto('/');
      const home = sofia.getByTestId('play-home');
      await home.getByTestId('play-grade-6').click();
      await expect(home.getByTestId('play-grade-6')).toHaveAttribute('aria-checked', 'true');
      await expect
        .poll(async () => {
          const tiles = await unwrap<any>(await sofia.request.get('/api/quest/tiles'), 'tiles');
          return { lead: tiles.lead, picked: tiles.picked_grade, ask: tiles.ask_grade };
        })
        .toEqual({ lead: { grade: 6, from: 'picked' }, picked: 6, ask: false });

      // Kept: a reload, and another browser, open on Grade 6, and today's Daily is Grade 6's.
      await sofia.reload();
      await expect(home.getByTestId('play-grade-6')).toHaveAttribute('aria-checked', 'true');
      await expect(home.getByTestId('play-daily')).toContainText("Today's Daily · Grade 6");
      const elsewhere = await as('student');
      await elsewhere.goto('/');
      await expect(elsewhere.getByTestId('play-home').getByTestId('play-grade-6')).toHaveAttribute('aria-checked', 'true');
    } finally {
      await sofia.request.put('/api/quest/grade', { data: { grade: null } });
      await questOn(admin, false);
    }
  });

  test('JF14: with nothing to go on, "Which grade?" is asked once; Not now waits for the session; the answer is kept', async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'ask');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      expect(await unwrap<any>(await kit.request.get('/api/quest/tiles'), 'tiles')).toMatchObject({ lead: null, ask_grade: true, picked_grade: null });
      await kit.goto('/');
      const ask = kit.getByTestId('play-ask-grade');
      await expect(ask).toContainText('Which grade?');
      for (const grade of [1, 8]) await expect(ask.getByTestId(`play-ask-grade-${grade}`)).toHaveText(`Grade ${grade}`);
      await expect(ask.getByTestId('play-ask-grade-0')).toHaveText('Not in school');

      // Not now: gone for this session, asked again in another.
      await ask.getByTestId('play-ask-grade-later').click();
      await expect(ask).toHaveCount(0);
      await kit.reload();
      await expect(kit.getByTestId('play-home')).toBeVisible();
      await expect(kit.getByTestId('play-ask-grade')).toHaveCount(0);

      const later = await as('student', { email: fresh.email });
      await later.goto('/');
      await later.getByTestId('play-ask-grade-7').click();
      await expect(later.getByTestId('play-ask-grade')).toHaveCount(0);
      await expect(later.getByTestId('play-grade-7')).toHaveAttribute('aria-checked', 'true');
      await expect
        .poll(async () => {
          const tiles = await unwrap<any>(await later.request.get('/api/quest/tiles'), 'tiles');
          return { lead: tiles.lead, ask: tiles.ask_grade, picked: tiles.picked_grade };
        })
        .toEqual({ lead: { grade: 7, from: 'picked' }, ask: false, picked: 7 });
      await later.reload();
      await expect(later.getByTestId('play-grade-7')).toHaveAttribute('aria-checked', 'true');
      await expect(later.getByTestId('play-ask-grade')).toHaveCount(0);

      // "Not in school" leads with the top of the row.
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 0 } }), 'not in school');
      expect(await unwrap<any>(await kit.request.get('/api/quest/tiles'), 'tiles')).toMatchObject({ lead: { grade: 8, from: 'picked' }, picked_grade: 0 });
    } finally {
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });

  test("JF23 + JF36: the Daily on the board and in Next up is one level, named Today's Daily, and closes back home", async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'daily');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 5 } }), 'Grade 5');
      const tiles = await unwrap<any>(await kit.request.get('/api/quest/tiles'), 'tiles');
      const level = dailyLevelFor(tiles.tiles, tiles.lead.grade);
      expect(level).toBe('NC26.5');

      await kit.goto('/');
      await expect(kit.getByTestId('play-daily')).toContainText("Today's Daily · Grade 5 · G5D");
      await expect(kit.getByTestId('next-up-daily')).toContainText("Today's Daily");
      await expect(kit.getByTestId('next-up-daily')).toContainText('Grade 5');
      await expect(kit.getByTestId('next-up').getByRole('link', { name: "Play today's Daily" })).toHaveAttribute('href', `/quest/daily/${level}`);
      // "Today's 5" is the guest page's free set alone.
      await expect(kit.getByText("Today's 5")).toHaveCount(0);

      // The Daily's page says the same, with a way out that says what leaving keeps.
      await kit.getByTestId('play-daily-play').click();
      await expect(kit).toHaveURL(new RegExp(`/quest/daily/${level!.replace('.', '\\.')}$`));
      await expect(kit.getByTestId('daily-play')).toContainText("Today's Daily · Grade 5");
      await expect(kit.getByTestId('daily-close-note')).toContainText('nothing is kept');
      await kit.getByTestId('daily-close').click();
      await expect(kit).toHaveURL(HOME);
      await expect(kit.getByTestId('member-home')).toBeVisible();
    } finally {
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });

  test('JF16 + JF36: ending asks first, and a game nobody answered in says "Nobody played" -- no confetti, no win, no badge', async ({ as }) => {
    test.setTimeout(90_000);
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'empty');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      // A lobby with its host in it, cancelled: asked first; kept; then cancelled.
      const lobby = await unwrap<any>(
        await kit.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1, host_plays: true },
        }),
        'a lobby',
      );
      await kit.goto(`/quest/games/${lobby.id}`);
      await expect(kit.getByTestId('game-lobby-code')).toBeVisible();
      await kit.getByTestId('game-cancel').click();
      await expect(kit.getByTestId('game-cancel-confirm')).toContainText('Cancel the game?');
      await kit.getByTestId('game-cancel-confirm-keep').click();
      await expect(kit.getByTestId('game-cancel-confirm')).toHaveCount(0);
      await expect(kit.getByTestId('game-lobby-code')).toBeVisible();
      await kit.getByTestId('game-cancel').click();
      await kit.getByTestId('game-cancel-confirm-yes').click();
      await expect(kit.getByTestId('game-winner')).toHaveText('Nobody played');
      await expect(kit.getByTestId('game-confetti')).toHaveCount(0);
      await expect(kit.getByTestId('game-encouragement')).not.toContainText('won');
      const cancelled = await unwrap<any>(await kit.request.get(`/api/quest/games/${lobby.id}`), 'the cancelled game');
      expect(cancelled.teams.every((team: any) => team.place === null)).toBe(true);

      // A single player's game ended at once: "End the game now" asks first too.
      const solo = await unwrap<any>(await kit.request.post('/api/quest/games', { data: single('NC26.5', 3) }), 'a solo game');
      await kit.goto(`/quest/games/${solo.id}`);
      await expect(kit.getByTestId('game-question')).toBeVisible({ timeout: 15_000 });
      await kit.getByTestId('game-end').click();
      await expect(kit.getByTestId('game-end-confirm')).toContainText('End the game now?');
      await kit.getByTestId('game-end-confirm-yes').click();
      await expect(kit.getByTestId('game-winner')).toHaveText('Nobody played');
      await expect(kit.getByTestId('game-confetti')).toHaveCount(0);

      // Nothing earned: neither game counts as a quest finished, nor as a family game.
      const habit = await unwrap<any>(await kit.request.get('/api/quest/me/habit'), 'the habit');
      expect(habit.badges.find((b: any) => b.id === 'first_quest')?.earned).toBe(false);
      expect(habit.badges.find((b: any) => b.id === 'first_family_game')?.earned).toBe(false);
    } finally {
      await endOpenGames(kit);
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });

  test('JF16 + JF36: a game played to the end goes back home from its results, and the home has moved', async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'played');
    const kit = await as('student', { email: fresh.email });
    // Past the welcome wizard, which a new person meets first.
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 5 } }), 'Grade 5');
      const game = await unwrap<any>(await kit.request.post('/api/quest/games', { data: single('NC26.5', 2) }), 'a short game');
      await afterCountdown(game);
      await kit.goto('/');
      await expect(kit.getByTestId('my-progress-today')).toHaveAttribute('aria-label', 'Not played yet today');
      await kit.getByTestId('play-continue').click();
      for (const n of [1, 2]) {
        await expect(kit.getByTestId('game-question')).toContainText(`Question ${n} of 2`, { timeout: 15_000 });
        await answerOnScreen(kit);
      }
      await expect(kit.getByTestId('game-winner')).toHaveText(/right, -?\d+ points?$/);
      await expect(kit.getByTestId('game-results-back')).toHaveText('Back home');
      await kit.getByTestId('game-results-back').click();
      await expect(kit).toHaveURL(HOME);
      // The day counts, and Continue offers the game again.
      await expect(kit.getByTestId('my-progress-today')).toHaveAttribute('aria-label', 'Played today');
      await expect(kit.getByTestId('play-continue')).toHaveText('Play Grade 5 Quick 2 again');
      // My progress says one thing: no streak yet, and no zero first.
      await expect(kit.getByTestId('my-progress-streak')).toHaveText('Start a streak');
      await expect(kit.getByTestId('my-progress-detail')).toHaveText('1 of 3 days this week. 2 to go.');
    } finally {
      await endOpenGames(kit);
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });
});

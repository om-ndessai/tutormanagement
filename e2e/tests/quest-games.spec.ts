import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import type { Page } from '@playwright/test';

/**
 * Quest Games (Phase 46, docs/quest-games-plan.md): anyone in the organization
 * starts a game on a level of the bank and anyone joins it with its code, on
 * their own or in a team with its own code. A teammate is always served the
 * next question no teammate has had; every team plays the same series.
 * R20: a game is read by its host, its players and the admins only.
 *
 * Quest (and "include questions not yet reviewed", since the seed has few
 * approved questions) is switched on in organization A for the duration.
 */

test.describe.configure({ mode: 'serial' });

const WRONG = 'not-an-answer';

async function withGames(admin: Page, run: () => Promise<void>) {
  const set = (on: boolean) =>
    admin.request.patch('/api/organization/settings', {
      data: { gamify_question_quest: on, canvas_assessments_unreviewed: on },
    });
  expect((await set(true)).status()).toBe(200);
  try {
    await run();
  } finally {
    await set(false);
  }
}

const create = (page: Page, data: Record<string, unknown>) => page.request.post('/api/quest/games', { data });
const view = async (page: Page, id: string) => unwrap<any>(await page.request.get(`/api/quest/games/${id}`), 'game');
const answer = (page: Page, id: string, data: Record<string, unknown>) =>
  page.request.post(`/api/quest/games/${id}/answer`, { data });

/** Phase 47: a started game counts down before its first question; wait it out, by the server's clock. */
async function afterCountdown(game: { started_at: string; now: string }) {
  const wait = Date.parse(game.started_at) - Date.parse(game.now);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 150));
}

test.describe('Quest Games (Phase 46)', () => {
  test('codes, teams, the shared queue, negative marking, places and R20', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofia = await as('student');
    const anita = await as('parent');
    const sanjay = await as('studentTutor');
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });

    // Behind Quest's switch.
    expect((await alex.request.get('/api/quest/games')).status()).toBe(403);

    await withGames(admin, async () => {
      // The form's rules: a count game needs its count.
      expect((await create(alex, { level_id: 'NC26.5', mode: 'count', negative_marking: false, max_team_size: 2 })).status()).toBe(422);
      expect((await create(alex, { level_id: 'NC26.5', mode: 'count', question_count: 99, negative_marking: false, max_team_size: 2 })).status()).toBe(422);

      // Anyone may host: here, a parent.
      const game = await unwrap<any>(
        await create(anita, { level_id: 'NC26.5', mode: 'count', question_count: 2, negative_marking: true, max_team_size: 2 }),
        'create',
      );
      expect(game.status).toBe('lobby');
      expect(game.code).toMatch(/^[A-Z2-9]{6}$/);

      // A code is found in its own organization only (R13), in any case.
      const found = await unwrap<any>(await alex.request.post('/api/quest/games/lookup', { data: { code: game.code.toLowerCase() } }), 'lookup');
      expect(found).toMatchObject({ game_id: game.id, joined: false, team: null });
      expect((await rosa.request.post('/api/quest/games/lookup', { data: { code: game.code } })).status()).toBe(403); // Quest is off there
      // Not a player yet: the game itself is not theirs to read (R20).
      expect((await alex.request.get(`/api/quest/games/${game.id}`)).status()).toBe(404);

      // Alex starts a team; Sofia joins it by its code; Sanjay plays on his own.
      const joined = await unwrap<any>(
        await alex.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'new_team', team_name: 'Pi Squad' } }),
        'new team',
      );
      const teamCode = joined.teams.find((t: any) => t.name === 'Pi Squad').code;
      expect(teamCode).toMatch(/^[A-Z2-9]{6}$/);
      const byTeamCode = await unwrap<any>(await sofia.request.post('/api/quest/games/lookup', { data: { code: teamCode } }), 'team lookup');
      expect(byTeamCode.team).toMatchObject({ name: 'Pi Squad', players: 1 });
      await unwrap(await sofia.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'team', team_code: teamCode } }), 'join team');
      await unwrap(await sanjay.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'solo');

      // The team is full; a second join is refused; another team's code is hidden from a rival.
      expect((await admin.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'team', team_code: teamCode } })).status()).toBe(409);
      expect((await sanjay.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } })).status()).toBe(409);
      const seenBySanjay = await view(sanjay, game.id);
      expect(seenBySanjay.teams.find((t: any) => t.name === 'Pi Squad').code).toBeNull();
      // First names only.
      expect(seenBySanjay.teams.flatMap((t: any) => t.players.map((p: any) => p.first_name)).sort()).toEqual(['Alex', 'Sanjay', 'Sofia']);

      // Only the host begins it.
      expect((await alex.request.post(`/api/quest/games/${game.id}/start`)).status()).toBe(403);
      const started = await unwrap<any>(await anita.request.post(`/api/quest/games/${game.id}/start`), 'start');
      expect(started).toMatchObject({ status: 'running', series_length: 2 });
      expect((await sofia.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } })).status()).toBe(409);
      // The countdown (Phase 47): nothing is served before the first question's moment.
      expect((await view(alex, game.id)).me).toMatchObject({ question: null, waiting: false });
      await afterCountdown(started);

      // The team's queue: teammates never hold the same question; the solo player starts the same series.
      const a = (await view(alex, game.id)).me.question;
      const s = (await view(sofia, game.id)).me.question;
      const j = (await view(sanjay, game.id)).me.question;
      expect(a.id).not.toBe(s.id);
      expect([a.number, s.number].sort()).toEqual([1, 2]);
      expect(j.number).toBe(1);
      expect(j.id).toBe(a.number === 1 ? a.id : s.id);
      // A reload keeps the question in hand; nothing reveals the key.
      expect((await view(alex, game.id)).me.question.id).toBe(a.id);
      expect(JSON.stringify(await view(alex, game.id))).not.toContain('"answer"');

      // A teammate cannot answer the other's question.
      expect((await answer(sofia, game.id, { question_id: a.id, answer: WRONG })).status()).toBe(409);

      // Pi Squad: one wrong (−1 with negative marking), one skipped. Sanjay: two skips (0).
      const afterWrong = await unwrap<any>(await answer(alex, game.id, { question_id: a.id, answer: WRONG }), 'wrong');
      expect(afterWrong.me.last).toEqual({ correct: false, skipped: false });
      expect(afterWrong.me.waiting).toBe(true);
      await unwrap(await answer(sofia, game.id, { question_id: s.id, skip: true }), 'skip');
      const mid = await view(sanjay, game.id);
      expect(mid.status).toBe('running');
      expect(mid.teams.find((t: any) => t.name === 'Pi Squad')).toMatchObject({ score: -1, wrong: 1, skipped: 1, answered: 2 });
      await unwrap(await answer(sanjay, game.id, { question_id: j.id, skip: true }), 'skip 1');
      const second = (await view(sanjay, game.id)).me.question;
      const done = await unwrap<any>(await answer(sanjay, game.id, { question_id: second.id, skip: true }), 'skip 2');

      // Every team done: the game ends. 0 beats −1.
      expect(done.status).toBe('finished');
      expect(done.teams.map((t: any) => [t.name, t.place, t.score])).toEqual([
        ['Sanjay', 1, 0],
        ['Pi Squad', 2, -1],
      ]);

      // The results reveal the right answers -- to the team's own players, the host and admins.
      const results = await unwrap<any>(await alex.request.get(`/api/quest/games/${game.id}/results`), 'results');
      expect(results.items).toHaveLength(2);
      expect(results.items.every((i: any) => typeof i.question.answer === 'string' && i.question.answer.length > 0)).toBe(true);
      expect(results.items.map((i: any) => i.answered_by).sort()).toEqual(['Alex', 'Sofia']);
      const sanjayTeam = done.teams.find((t: any) => t.name === 'Sanjay').id;
      expect((await alex.request.get(`/api/quest/games/${game.id}/results?team=${sanjayTeam}`)).status()).toBe(404);
      expect((await anita.request.get(`/api/quest/games/${game.id}/results?team=${sanjayTeam}`)).status()).toBe(200);
      expect((await admin.request.get(`/api/quest/games/${game.id}/results?team=${sanjayTeam}`)).status()).toBe(200);

      // R20: nobody else reads the game; the lists are each person's own (an admin's, every game).
      const parentTutor = await as('parentTutor');
      expect((await parentTutor.request.get(`/api/quest/games/${game.id}`)).status()).toBe(404);
      expect((await parentTutor.request.get(`/api/quest/games/${game.id}/results`)).status()).toBe(404);
      expect((await unwrap<any[]>(await parentTutor.request.get('/api/quest/games'), 'list')).some((g) => g.id === game.id)).toBe(false);
      expect((await unwrap<any[]>(await admin.request.get('/api/quest/games'), 'admin list')).some((g) => g.id === game.id)).toBe(true);
      const mine = (await unwrap<any[]>(await sofia.request.get('/api/quest/games'), 'sofia list')).find((g) => g.id === game.id);
      expect(mine).toMatchObject({ status: 'finished', place: 2, teams: 2 });

      // The log says who joined and began it, never an answer or a score.
      const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=50'), 'audit');
      const lines = log.filter((e) => e.entity_id === game.id).map((e) => e.action);
      expect(lines).toEqual(expect.arrayContaining(['quest.game_created', 'quest.game_joined', 'quest.game_started']));
    });
  });

  test('a timed game has a clock, and the host may end it; a lobby can be left', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    await withGames(admin, async () => {
      const game = await unwrap<any>(
        await create(admin, { level_id: 'NC26.4', mode: 'timed', duration_minutes: 2, negative_marking: false, max_team_size: 1 }),
        'timed',
      );
      // Everyone on their own: no teams to start.
      expect((await alex.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'new_team', team_name: 'X' } })).status()).toBe(409);
      await unwrap(await alex.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'solo');
      // Leaving the lobby takes Alex out of it.
      const left = await unwrap<any>(await alex.request.post(`/api/quest/games/${game.id}/leave`), 'leave');
      expect(left).toBeNull();
      expect((await admin.request.post(`/api/quest/games/${game.id}/start`)).status()).toBe(409); // nobody has joined
      await unwrap(await alex.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'rejoin');
      const started = await unwrap<any>(await admin.request.post(`/api/quest/games/${game.id}/start`), 'start');
      expect(Date.parse(started.ends_at) - Date.parse(started.started_at)).toBe(120_000);
      expect(started.series_length).toBeGreaterThan(2);
      await afterCountdown(started);
      expect((await view(alex, game.id)).me.question).not.toBeNull();
      expect((await alex.request.post(`/api/quest/games/${game.id}/end`)).status()).toBe(403);
      const ended = await unwrap<any>(await admin.request.post(`/api/quest/games/${game.id}/end`), 'end');
      expect(ended.status).toBe('finished');
      expect(ended.me.question).toBeNull();
    });
  });

  test('in the portal: the wizard, a favorite, two codes, the countdown, play as a team, the results', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofia = await as('student');
    await withGames(admin, async () => {
      // Priya starts a game from the Quest page: the wizard, step by step.
      await admin.goto('/quest');
      await admin.getByTestId('game-new').click();
      await expect(admin.getByTestId('game-wizard')).toBeVisible();
      await expect(admin.getByTestId('game-next')).toBeDisabled();
      await admin.getByTestId('game-tile-NC26.6').click();
      await admin.getByTestId('game-next').click();
      // Length: two questions, stepped down from ten with the counter and typed.
      await admin.getByTestId('game-amount-minus').click();
      await expect(admin.getByTestId('game-amount')).toHaveValue('9');
      await admin.getByTestId('game-amount').fill('2');
      await admin.getByTestId('game-amount').blur();
      await admin.getByTestId('game-next').click();
      // Scoring: right +2, wrong 0.
      await admin.getByTestId('game-right-plus').click();
      await expect(admin.getByTestId('game-right')).toHaveValue('+2');
      await admin.getByTestId('game-next').click();
      // Players: teams of two, at most three teams.
      await admin.getByTestId('game-players-multi').click();
      await admin.getByTestId('game-team-size-minus').click();
      await admin.getByTestId('game-team-size-minus').click();
      await expect(admin.getByTestId('game-team-size')).toHaveValue('2');
      await admin.getByTestId('game-max-teams').fill('3');
      await admin.getByTestId('game-max-teams').blur();
      await admin.getByTestId('game-next').click();
      // The review, saved as a favorite.
      await expect(admin.getByTestId('game-review-summary')).toContainText('2 questions');
      await expect(admin.getByTestId('game-review-summary')).toContainText('Right +2, wrong 0');
      await expect(admin.getByTestId('game-review-summary')).toContainText('Up to 3 teams of up to 2');
      await admin.getByTestId('game-fav-name').fill('Two-question duel');
      await admin.getByTestId('game-fav-save').click();
      await expect(admin.getByText('Saved “Two-question duel” to your favorites.')).toBeVisible();
      await expect(admin.getByTestId('game-create')).toHaveText('Generate game code');
      await admin.getByTestId('game-create').click();
      await expect(admin.getByTestId('game-page')).toBeVisible();
      const code = (await admin.getByTestId('game-lobby-code').textContent())!.trim();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);

      // Alex types the game's code and starts a team: no "on my own" in a game of teams.
      await alex.goto('/quest');
      await alex.getByTestId('game-code').fill(code);
      await alex.getByTestId('game-join').click();
      await expect(alex.getByTestId('game-join-solo')).toHaveCount(0);
      await alex.getByTestId('game-team-name').fill('Owls');
      await alex.getByTestId('game-join-new-team').click();
      const teamCode = (await alex.getByTestId('game-team-code-shown').textContent())!.trim();

      // Sofia types two codes: the game's, then the team's.
      await sofia.goto('/quest');
      await sofia.getByTestId('game-code').fill(code);
      await sofia.getByTestId('game-join').click();
      await sofia.getByTestId('game-team-code').fill(teamCode);
      await sofia.getByTestId('game-join-team').click();
      await expect(sofia.getByTestId('game-team-Owls')).toContainText('Alex, Sofia');

      // The status page: the host sees them arrive, and starts the Quest; every screen counts down.
      await expect(admin.getByTestId('game-team-Owls')).toBeVisible();
      await admin.getByTestId('game-start').click();
      await expect(admin.getByTestId('game-start')).toHaveCount(0);
      await expect(alex.getByTestId('game-countdown')).toBeVisible({ timeout: 4000 });

      // Then each holds a different question of the two.
      await expect(alex.getByTestId('game-question')).toBeVisible({ timeout: 10_000 });
      await expect(sofia.getByTestId('game-question')).toBeVisible({ timeout: 10_000 });
      await expect(alex.getByTestId('game-countdown')).toHaveCount(0);
      const one = await alex.getByTestId('game-question').textContent();
      const two = await sofia.getByTestId('game-question').textContent();
      expect(new Set([one!.match(/Question (\d)/)![1], two!.match(/Question (\d)/)![1]])).toEqual(new Set(['1', '2']));

      await alex.getByTestId('game-skip').click();
      await expect(alex.getByTestId('game-waiting')).toBeVisible();
      await sofia.getByTestId('game-skip').click();

      // Both done: the results, with the answers -- and the winners' confetti.
      await expect(sofia.getByTestId('game-winner')).toHaveText('Owls wins!');
      await expect(sofia.getByTestId('game-encouragement')).toContainText('Your team won');
      await expect(sofia.getByTestId('game-confetti')).toBeAttached();
      await expect(sofia.getByTestId('game-review-1')).toContainText('Answer:');
      await expect(admin.getByTestId('game-winner')).toHaveText('Owls wins!', { timeout: 10_000 });

      // The favorite comes back on the first step, and one tap fills every step.
      await admin.goto('/quest/games/new');
      await admin.getByTestId('game-fav-Two-question duel').click();
      await expect(admin.getByTestId('game-step-5')).toBeVisible();
      await expect(admin.getByTestId('game-review-summary')).toContainText('Up to 3 teams of up to 2');
      await admin.getByTestId('game-back').click();
      await admin.getByTestId('game-back').click();
      await admin.getByTestId('game-back').click();
      await admin.getByTestId('game-back').click();
      await admin.getByTestId('game-fav-delete-Two-question duel').click();
      await expect(admin.getByTestId('game-fav-Two-question duel')).toHaveCount(0);
    });
  });

  test('a single player starts at once, alone; Random draws upward', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    const alex = await as('tutor');
    await withGames(admin, async () => {
      await sofia.goto('/quest/games/new');
      await sofia.getByTestId('game-tile-random').click();
      await expect(sofia.getByTestId('game-next')).toBeDisabled();
      await sofia.getByTestId('game-random-start').click();
      await sofia.getByRole('option', { name: 'G5' }).click();
      await sofia.getByTestId('game-next').click();
      await sofia.getByTestId('game-amount').fill('3');
      await sofia.getByTestId('game-amount').blur();
      await sofia.getByTestId('game-next').click();
      await sofia.getByTestId('game-next').click();
      await sofia.getByTestId('game-players-single').click();
      await sofia.getByTestId('game-next').click();
      await expect(sofia.getByTestId('game-review-summary')).toContainText('G5 and up, at random');
      await expect(sofia.getByTestId('game-review-summary')).toContainText('Single player');
      await expect(sofia.getByTestId('game-create')).toHaveText('Start game');
      await sofia.getByTestId('game-create').click();

      // No lobby: the doors, then the first question.
      await expect(sofia.getByTestId('game-countdown')).toBeVisible();
      await expect(sofia.getByTestId('game-lobby-code')).toHaveCount(0);
      await expect(sofia.getByTestId('game-question')).toBeVisible({ timeout: 10_000 });
      await expect(sofia.getByTestId('game-question')).toContainText('of 3');
      // Back goes to Quest, never to the wizard of a made game.
      const gameId = sofia.url().split('/').pop()!;
      const game = await view(sofia, gameId);
      expect(game).toMatchObject({ players: 'single', level_scope: 'upward', max_teams: 1, max_team_size: 1, knockout: false });

      // Nobody else joins a single player's game.
      const found = await unwrap<any>(await alex.request.post('/api/quest/games/lookup', { data: { code: game.code } }), 'lookup');
      expect(found).toMatchObject({ players: 'single', open: false });
      expect((await alex.request.post(`/api/quest/games/${gameId}/join`, { data: { as: 'solo' } })).status()).toBe(409);

      for (let i = 0; i < 3; i += 1) await sofia.getByTestId('game-skip').click();
      await expect(sofia.getByTestId('game-winner')).toHaveText('0 right, 0 points');
      await expect(sofia.getByTestId('game-encouragement')).toContainText('Every question you try');
    });
  });
});

test.describe('Quest Games, round two (Phase 47)', () => {
  test('custom points, knockout, the most teams, late joining, and favorites (R20)', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofia = await as('student');
    const sanjay = await as('studentTutor');
    await withGames(admin, async () => {
      // The points' bounds.
      const base = { level_id: 'NC26.5', mode: 'count', question_count: 2, max_team_size: 1 };
      expect((await create(admin, { ...base, right_points: 0 })).status()).toBe(422);
      expect((await create(admin, { ...base, wrong_points: 1 })).status()).toBe(422);
      expect((await create(admin, { ...base, max_teams: 1 })).status()).toBe(422);

      // Knockout, everyone on their own, at most two: wrong is −3.
      const game = await unwrap<any>(
        await create(admin, { ...base, wrong_points: -3, knockout: true, max_teams: 2 }),
        'knockout game',
      );
      expect(game).toMatchObject({ right_points: 1, wrong_points: -3, negative_marking: true, knockout: true, max_teams: 2 });
      await unwrap(await alex.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'alex');
      await unwrap(await sofia.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'sofia');
      // The most teams: a third is refused.
      expect((await sanjay.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } })).status()).toBe(409);
      const started = await unwrap<any>(await admin.request.post(`/api/quest/games/${game.id}/start`), 'start');
      expect(Date.parse(started.started_at) - Date.parse(started.now)).toBeGreaterThan(3000);
      // During the countdown an answer is refused.
      expect((await answer(alex, game.id, { question_id: '00000000-0000-4000-8000-000000000000', skip: true })).status()).toBe(409);
      await afterCountdown(started);

      // Alex skips both: finished on 0. Sofia can still reach 2: no knockout yet.
      for (let i = 0; i < 2; i += 1) {
        const q = (await view(alex, game.id)).me.question;
        await unwrap(await answer(alex, game.id, { question_id: q.id, skip: true }), 'alex skip');
      }
      expect((await view(sofia, game.id)).status).toBe('running');
      // Sofia's wrong answer costs 3: at most −2 now, below Alex's 0 -- a knockout, with a question left.
      const q = (await view(sofia, game.id)).me.question;
      const ko = await unwrap<any>(await answer(sofia, game.id, { question_id: q.id, answer: WRONG }), 'sofia wrong');
      expect(ko).toMatchObject({ status: 'finished', end_reason: 'knockout' });
      expect(ko.teams.map((t: any) => [t.name, t.score, t.place])).toEqual([
        ['Alex', 0, 1],
        ['Sofia', -3, 2],
      ]);

      // Joining left open: a late player joins while it runs, and starts from the first question.
      const open = await unwrap<any>(await create(admin, { ...base, late_join: true }), 'open game');
      await unwrap(await alex.request.post(`/api/quest/games/${open.id}/join`, { data: { as: 'solo' } }), 'alex');
      const running = await unwrap<any>(await admin.request.post(`/api/quest/games/${open.id}/start`), 'start open');
      await afterCountdown(running);
      const late = await unwrap<any>(await sofia.request.post('/api/quest/games/lookup', { data: { code: open.code } }), 'late lookup');
      expect(late).toMatchObject({ status: 'running', open: true, late_join: true });
      await unwrap(await sofia.request.post(`/api/quest/games/${open.id}/join`, { data: { as: 'solo' } }), 'late join');
      expect((await view(sofia, open.id)).me.question.number).toBe(1);
      await unwrap(await admin.request.post(`/api/quest/games/${open.id}/end`), 'end');
      expect((await view(sofia, open.id)).end_reason).toBe('host');

      // Favorites: a person's own. Saving a name again (any case) replaces it.
      const config = { level_id: 'NC26.5', mode: 'timed', duration_minutes: 5, right_points: 2, wrong_points: -1, max_team_size: 3, max_teams: 4 };
      const saved = await alex.request.put('/api/quest/games/favorites', { data: { name: 'Friday race', config } });
      expect(saved.status()).toBe(201);
      const replaced = await alex.request.put('/api/quest/games/favorites', {
        data: { name: 'FRIDAY RACE', config: { ...config, duration_minutes: 10 } },
      });
      expect(replaced.status()).toBe(200);
      const mine = await unwrap<any[]>(await alex.request.get('/api/quest/games/favorites'), 'favorites');
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ name: 'FRIDAY RACE', config: { duration_minutes: 10, right_points: 2, players: 'multi' } });
      expect((await alex.request.put('/api/quest/games/favorites', { data: { name: ' ', config } })).status()).toBe(422);
      // R20: nobody else reads or deletes it.
      expect(await unwrap<any[]>(await sofia.request.get('/api/quest/games/favorites'), 'sofia favorites')).toEqual([]);
      expect((await sofia.request.delete(`/api/quest/games/favorites/${mine[0].id}`)).status()).toBe(404);
      expect((await admin.request.delete(`/api/quest/games/favorites/${mine[0].id}`)).status()).toBe(404);
      expect((await alex.request.delete(`/api/quest/games/favorites/${mine[0].id}`)).status()).toBe(200);

      // The log names the favorite, never its settings.
      const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=50'), 'audit');
      const lines = log.filter((e) => e.entity_id === mine[0].id);
      expect(lines.map((e) => e.action).sort()).toEqual(['quest.game_favorite_deleted', 'quest.game_favorite_saved', 'quest.game_favorite_saved']);
      expect(lines.every((e) => !/minute|point|−|-1/.test(e.description))).toBe(true);
    });
  });
});

test.describe('Quest Games, curated (Phase 48)', () => {
  /** A finished game's questions, from the reader's own results. */
  const seenIn = async (page: Page, id: string): Promise<string[]> =>
    (await unwrap<any>(await page.request.get(`/api/quest/games/${id}/results`), 'results')).items.map((i: any) => i.question.id as string);

  /** Skips every question the reader is served until the game ends. */
  async function skipThrough(page: Page, id: string) {
    for (let i = 0; i < 60; i += 1) {
      const now = await view(page, id);
      if (now.status === 'finished' || !now.me?.question) return;
      await unwrap(await answer(page, id, { question_id: now.me.question.id, skip: true }), 'skip');
    }
  }

  /** A single player's game: made, counted down and skipped through; its questions. */
  async function playAlone(page: Page, data: Record<string, unknown>) {
    const game = await unwrap<any>(await create(page, { mode: 'count', max_team_size: 1, players: 'single', ...data }), 'single');
    await afterCountdown(game);
    await skipThrough(page, game.id);
    return seenIn(page, game.id);
  }

  test("a series leaves out what its players have seen, and climbs a level when its own runs out", async ({ as }) => {
    const admin = await as('admin');
    const maria = await as('parentTutor');
    const sofia = await as('student');
    const platform = await as('platformAdmin', { org: null });
    // Approved questions only, so a level runs out: the seed approves 12 at G4 and none at G5.
    const set = (on: boolean) =>
      admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on, canvas_assessments_unreviewed: false } });
    expect((await set(true)).status()).toBe(200);
    try {
      // G5, the level above, gets three approved questions for the climb.
      const approvedAt = async (level: string) =>
        unwrap<any[]>(await platform.request.get(`/api/platform/questions?level_id=${level}&status=approved&limit=200`), 'approved');
      if ((await approvedAt('NC26.5')).length < 3) {
        const checked = await unwrap<any[]>(
          await platform.request.get('/api/platform/questions?level_id=NC26.5&status=checked&limit=20'),
          'checked',
        );
        let approved = (await approvedAt('NC26.5')).length;
        for (const q of checked) {
          if (approved >= 3) break;
          if ((await platform.request.post(`/api/platform/questions/${q.id}/approve`)).ok()) approved += 1;
        }
      }
      const g5 = new Set((await approvedAt('NC26.5')).map((q) => q.id));
      expect(g5.size).toBeGreaterThanOrEqual(3);
      const levels = await unwrap<any[]>(await maria.request.get('/api/quest/games/levels'), 'levels');
      const atG4 = levels.find((l) => l.level_id === 'NC26.4').available as number;
      expect(atG4).toBeGreaterThan(0);

      // Every G4 question, once: none from G5 while G4 has unseen ones.
      const first = await playAlone(maria, { level_id: 'NC26.4', question_count: atG4 });
      expect(new Set(first).size).toBe(atG4);
      expect(first.some((id) => g5.has(id))).toBe(false);

      // G4 again: Maria has seen all of it, so the series climbs to G5 -- and repeats nothing.
      const second = await playAlone(maria, { level_id: 'NC26.4', question_count: 3 });
      expect(second).toHaveLength(3);
      expect(second.every((id) => g5.has(id))).toBe(true);
      expect(second.some((id) => first.includes(id))).toBe(false);

      // The climb counts towards what a level can play: more than G4 holds is allowed.
      const big = await unwrap<any>(await create(admin, { level_id: 'NC26.4', mode: 'count', question_count: atG4 + 1, max_team_size: 1 }), 'big');
      await unwrap(await admin.request.post(`/api/quest/games/${big.id}/end`), 'end big');

      // Together, nobody repeats what either has seen: Sofia's series leaves out Maria's most recent.
      const game = await unwrap<any>(await create(maria, { level_id: 'NC26.4', mode: 'count', question_count: 2, max_team_size: 1 }), 'together');
      await unwrap(await maria.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'maria joins');
      await unwrap(await sofia.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), 'sofia joins');
      const started = await unwrap<any>(await maria.request.post(`/api/quest/games/${game.id}/start`), 'start');
      await afterCountdown(started);
      await skipThrough(maria, game.id);
      await skipThrough(sofia, game.id);
      const together = await seenIn(sofia, game.id);
      expect(together).toHaveLength(2);
      expect(together.some((id) => second.includes(id))).toBe(false);

      // And Sofia's next G4 game leaves out the two she has now seen.
      const sofiaNext = await playAlone(sofia, { level_id: 'NC26.4', question_count: 3 });
      expect(sofiaNext.some((id) => together.includes(id))).toBe(false);
    } finally {
      await set(false);
    }
  });
});

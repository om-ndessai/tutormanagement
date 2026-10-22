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
      expect((await view(alex, game.id)).me.question).not.toBeNull();
      expect((await alex.request.post(`/api/quest/games/${game.id}/end`)).status()).toBe(403);
      const ended = await unwrap<any>(await admin.request.post(`/api/quest/games/${game.id}/end`), 'end');
      expect(ended.status).toBe('finished');
      expect(ended.me.question).toBeNull();
    });
  });

  test('in the portal: host, join with codes, play as a team, the results', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofia = await as('student');
    await withGames(admin, async () => {
      // Priya starts a two-question game from the Quest page.
      await admin.goto('/quest');
      await admin.getByTestId('game-new').click();
      await admin.getByTestId('game-level').click();
      await admin.getByRole('option', { name: /^G6/ }).click();
      await admin.getByTestId('game-amount').fill('2');
      await admin.getByTestId('game-create').click();
      await expect(admin.getByTestId('game-page')).toBeVisible();
      const code = (await admin.getByTestId('game-lobby-code').textContent())!.trim();
      expect(code).toMatch(/^[A-Z2-9]{6}$/);

      // Alex types the code and starts a team.
      await alex.goto('/quest');
      await alex.getByTestId('game-code').fill(code);
      await alex.getByTestId('game-join').click();
      await alex.getByTestId('game-team-name').fill('Owls');
      await alex.getByTestId('game-join-new-team').click();
      const teamCode = (await alex.getByTestId('game-team-code-shown').textContent())!.trim();

      // Sofia types the TEAM's code, and joins the team straight away.
      await sofia.goto('/quest');
      await sofia.getByTestId('game-code').fill(teamCode);
      await sofia.getByTestId('game-join').click();
      await sofia.getByTestId('game-join-team-named').click();
      await expect(sofia.getByTestId('game-team-Owls')).toContainText('Alex, Sofia');

      // The host sees them arrive, and begins.
      await expect(admin.getByTestId('game-team-Owls')).toBeVisible();
      await admin.getByTestId('game-start').click();

      // Each holds a different question of the two.
      await expect(alex.getByTestId('game-question')).toBeVisible();
      await expect(sofia.getByTestId('game-question')).toBeVisible();
      const one = await alex.getByTestId('game-question').textContent();
      const two = await sofia.getByTestId('game-question').textContent();
      expect(new Set([one!.match(/Question (\d)/)![1], two!.match(/Question (\d)/)![1]])).toEqual(new Set(['1', '2']));

      await alex.getByTestId('game-skip').click();
      await expect(alex.getByTestId('game-waiting')).toBeVisible();
      await sofia.getByTestId('game-skip').click();

      // Both done: the results, with the answers.
      await expect(sofia.getByTestId('game-winner')).toHaveText('Owls wins!');
      await expect(sofia.getByTestId('game-review-1')).toContainText('Answer:');
      await expect(admin.getByTestId('game-winner')).toHaveText('Owls wins!', { timeout: 10_000 });
    });
  });
});

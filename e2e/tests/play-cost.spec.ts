import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { setCheckedQuestions } from '../support/checked-questions.js';

/**
 * Phase 62 (docs/stickiness-plan.md): P4, one tap must be affordable on the free plan.
 * - A single player's game is not polled: each answer's reply carries the game, and it is read only
 *   when the countdown ends (and, timed, when its time is up).
 * - Playable counts are the platform's, cached (`platform_settings` 'level_counts'); an approval
 *   marks its level for a recount, so a count follows the bank at once.
 *
 * Serial: one space's Quest and checked-questions switches, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

test.describe('P4: one tap is affordable', () => {
  test("a single player's game sends no request between answers", async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.4', mode: 'count', question_count: 5, players: 'single', max_team_size: 1 },
        }),
        'a single-player game',
      );
      const reads: string[] = [];
      admin.on('request', (request) => {
        if (request.method() === 'GET' && request.url().includes(`/api/quest/games/${game.id}`)) reads.push(request.url());
      });
      await admin.goto(`/quest/games/${game.id}`);
      await expect(admin.getByTestId('game-question')).toBeVisible({ timeout: 15_000 });
      const before = reads.length;
      // Several poll periods pass with the question on screen: no read.
      await admin.waitForTimeout(6_500);
      expect(reads.length).toBe(before);
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('a cached count follows an approval at once', async ({ as }) => {
    const admin = await as('admin');
    const platform = await as('platformAdmin', { org: null });
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    await setCheckedQuestions(platform, 'chmi', false);
    try {
      const count = async () =>
        (await unwrap<any[]>(await admin.request.get('/api/quest/games/levels'), 'levels')).find((l) => l.level_id === 'BA2')
          ?.available ?? 0;
      const before = await count();
      const [question] = await unwrap<any[]>(
        await platform.request.get('/api/platform/questions?level_id=BA2&status=checked&limit=1'),
        'a checked BA2 question',
      );
      await unwrap(await platform.request.post(`/api/platform/questions/${question.id}/approve`), 'approving it');
      expect(await count()).toBe(before + 1);
    } finally {
      await setCheckedQuestions(platform, 'chmi', true);
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

import { expect, test, PEOPLE } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 56 (docs/sharing-plan.md, R22): sharing Quest. A card is built on the
 * server from the reader's own result -- a game's result, or a question their
 * team got right as "Can you solve this?" -- and read by anyone at /s/<id>.
 * It names nobody but the maker's chosen first name, carries no free text and
 * no space's name, can be withdrawn, and a challenge is marked on the server.
 *
 * Serial: one game is played, then shared.
 */
test.describe.configure({ mode: 'serial' });

// The bank's keys, from the exported JSON (the local sample is generated from it).
const KEYS = new Map<string, string>(
  (
    JSON.parse(readFileSync(fileURLToPath(new URL('../../apps/api/db/questions/NC26.4.json', import.meta.url)), 'utf8')) as {
      questions: { id: string; answer: string }[];
    }
  ).questions.map((q) => [q.id, q.answer]),
);

/** Where the Worker answers directly (for the page's preview tags, which the SPA's dev server does not write). */
const WORKER = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:8787';

let gameId = '';
let rightQuestion = '';

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

test.describe('sharing Quest', () => {
  test('a single-player game, played to the end: one right, one wrong, one skipped', async ({ as }) => {
    const admin = await as('admin');
    await questOn(admin, true);
    const made = await unwrap<any>(
      await admin.request.post('/api/quest/games', {
        data: { level_id: 'NC26.4', mode: 'count', question_count: 3, players: 'single', max_team_size: 1 },
      }),
      'a single-player game',
    );
    gameId = made.id;
    let game = made;
    const wait = Date.parse(game.started_at) - Date.parse(game.now);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 200));

    const plan = ['right', 'wrong', 'skip'] as const;
    for (const step of plan) {
      game = await unwrap<any>(await admin.request.get(`/api/quest/games/${gameId}`), 'the game');
      const question = game.me.question;
      expect(question, 'a question is served').toBeTruthy();
      const key = KEYS.get(question.id);
      if (step === 'right') {
        expect(key, 'the served question is in the exported bank').toBeTruthy();
        rightQuestion = question.id;
      }
      const body =
        step === 'skip'
          ? { question_id: question.id, skip: true }
          : { question_id: question.id, answer: step === 'right' ? key : 'not-an-answer' };
      await unwrap(await admin.request.post(`/api/quest/games/${gameId}/answer`, { data: body }), `answer ${step}`);
    }
    game = await unwrap<any>(await admin.request.get(`/api/quest/games/${gameId}`), 'the finished game');
    expect(game.status).toBe('finished');
  });

  test('the result as a card: the reader’s own numbers, a first name only when chosen', async ({ as }) => {
    const admin = await as('admin');
    const anonymous = await unwrap<any>(
      await admin.request.post('/api/shares', { data: { kind: 'game_result', game_id: gameId } }),
      'sharing the result',
    );
    expect(anonymous.first_name).toBeNull();
    expect(anonymous.card).toMatchObject({ kind: 'game_result', correct: 1, wrong: 1, skipped: 1, total: 3, single: true });
    expect(anonymous.card.marks).toEqual(['right', 'wrong', 'skipped']);

    const named = await unwrap<any>(
      await admin.request.post('/api/shares', { data: { kind: 'game_result', game_id: gameId, show_first_name: true } }),
      'sharing with a first name',
    );
    expect(named.first_name).toBe(PEOPLE.admin.name.split(' ')[0]);

    // The public read: numbers and the chosen first name; no surname, no space's name, no ids.
    const visitor = await as('tutor', { org: null });
    const read = await unwrap<any>(await visitor.request.get(`/api/public/shares/${named.id}`), 'the public card');
    const text = JSON.stringify(read);
    expect(read.available).toBe(true);
    expect(text).not.toContain(PEOPLE.admin.name);
    expect(text).not.toContain('Chapel Hill');
    expect(text).not.toContain(gameId);

    // Somebody else's game is not theirs to share.
    const tutor = await as('tutor');
    expect((await tutor.request.post('/api/shares', { data: { kind: 'game_result', game_id: gameId } })).status()).toBe(404);
  });

  test('a right answer as "Can you solve this?": marked on the server, the key only after', async ({ as }) => {
    const admin = await as('admin');
    const share = await unwrap<any>(
      await admin.request.post('/api/shares', { data: { kind: 'challenge', game_id: gameId, question_id: rightQuestion } }),
      'sharing a challenge',
    );
    const visitor = await as('tutor', { org: null });
    const read = await unwrap<any>(await visitor.request.get(`/api/public/shares/${share.id}`), 'the challenge');
    expect(read.question.stem.length).toBeGreaterThan(0);
    expect(JSON.stringify(read)).not.toContain('"answer"');
    expect(JSON.stringify(read)).not.toContain('solution');

    const wrong = await unwrap<any>(
      await visitor.request.post(`/api/public/challenge/${share.id}/answer`, { data: { answer: 'not-an-answer' } }),
      'a wrong answer',
    );
    expect(wrong.correct).toBe(false);
    expect(wrong.solution.length).toBeGreaterThan(0);
    const right = await unwrap<any>(
      await visitor.request.post(`/api/public/challenge/${share.id}/answer`, { data: { answer: KEYS.get(rightQuestion)! } }),
      'the right answer',
    );
    expect(right.correct).toBe(true);

    // A question the team did not get right cannot be shared as one.
    const game = await unwrap<any>(await admin.request.get(`/api/quest/games/${gameId}/results`), 'results').catch(() => null);
    const missed = game?.items?.find((item: any) => !item.correct)?.question?.id;
    if (missed) {
      expect(
        (await admin.request.post('/api/shares', { data: { kind: 'challenge', game_id: gameId, question_id: missed } })).status(),
      ).toBe(404);
    }
  });

  test('the page anyone opens, its preview tags, and withdrawing', async ({ as }) => {
    const admin = await as('admin');
    const share = await unwrap<any>(
      await admin.request.post('/api/shares', { data: { kind: 'game_result', game_id: gameId } }),
      'sharing again',
    );

    const visitor = await as('tutor', { org: null });
    await visitor.goto(`/s/${share.id}`);
    await expect(visitor.getByTestId('share-headline')).toContainText('1/3');

    // What an unfurler reads: the Worker writes the tags into the page.
    const html = await (await visitor.request.get(`${WORKER}/s/${share.id}`)).text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain('1/3');
    expect(html).toContain('/og/game_result.png');
    expect(html).not.toContain(PEOPLE.admin.name);

    const mine = await unwrap<any[]>(await admin.request.get('/api/shares'), 'my shares');
    expect(mine.some((row) => row.id === share.id)).toBe(true);
    expect((await admin.request.delete(`/api/shares/${share.id}`)).status()).toBe(204);
    const gone = await unwrap<any>(await visitor.request.get(`/api/public/shares/${share.id}`), 'withdrawn');
    expect(gone).toMatchObject({ available: false, card: null });
    // Nobody else withdraws it (it is theirs): answered as missing.
    const tutor = await as('tutor');
    expect((await tutor.request.delete(`/api/shares/${share.id}`)).status()).toBe(404);
  });

  test('in the portal: Share on the results makes a link, its text, and its picture', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto(`/quest/games/${gameId}`);
    await admin.getByRole('button', { name: 'Share the result' }).click();
    await expect(admin.getByTestId('share-dialog')).toBeVisible();
    await admin.getByTestId('share-make').click();
    await expect(admin.getByTestId('share-text')).toContainText('1/3');
    await expect(admin.getByTestId('share-text')).toContainText('🟩🟥⬜');
    await expect(admin.getByTestId('share-image')).toBeVisible();
    await expect(admin.getByTestId('share-text')).not.toContainText(PEOPLE.admin.name);
    // R22: no space's name -- the platform's, not "CHMI".
    await expect(admin.getByTestId('share-text')).toContainText('Aimtrue Quest');
    await expect(admin.getByTestId('share-text')).not.toContainText('CHMI');
    // A right answer of the reader's own team offers "Challenge a friend".
    await expect(admin.getByTestId('share-challenge-1')).toHaveCount(1);
    await admin.getByTestId('share-withdraw').click();
    await expect(admin.getByTestId('share-dialog')).toHaveCount(0);
  });

  test('a child a space added has no Share, and the API refuses them', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    expect((await sofia.request.post('/api/shares', { data: { kind: 'game_result', game_id: gameId } })).status()).toBe(403);
    await questOn(admin, false);
  });
});

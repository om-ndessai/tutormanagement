import type { Page } from '@playwright/test';
import { dailyLevelFor, lessonDayWords, practiseBefore } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Phase 77 (docs/journey-fixes-plan.md, JF15 and JF20), the web's half: families at home.
 *
 * JF15 -- Tom's son Ben does not sign in, so "Play with Ben" is a game on Tom's own device: one tap, begun at once, no
 * lobby or code. The game screen takes turns -- "Ben's turn" (answered for Ben), then "Your turn", the child first on
 * each question -- says whose turn it is in words with a hand-over line, and shows both scores side by side by first
 * name; leaving and coming back ("Continue with Ben") resumes on whoever's turn it is; the results are each player's
 * own, with no "team" words. Anita's son Sanjay signs in, so hers stays the online invite, whose lobby says who was
 * invited.
 *
 * JF20 -- Omar, Noor's father, continues an assessment Ines started, after "Hand the device to Noor", and submits it; he
 * may not discard it, and is never offered its PDF. Start warns when Noor already has one in progress.
 *
 * Serial: the space's Quest switch, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

const TOM = 'tom.whitfield@gmail.com';

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

async function personByName(admin: Page, name: string): Promise<string> {
  const found = await unwrap<any[]>(await admin.request.get(`/api/users?search=${encodeURIComponent(name)}`), name);
  const person = found.find((p) => p.full_name === name);
  expect(person, name).toBeTruthy();
  return person.id;
}

/** Answers the question on screen for whoever's turn it is: a choice (A) or a number. */
async function answerOnScreen(page: Page) {
  const choice = page.getByTestId('game-choice-A');
  if (await choice.isVisible()) await choice.click();
  else await page.getByTestId('game-number').fill('7');
  await page.getByTestId('game-submit').click();
}

/** A stroke drawn with the mouse across the canvas, from and to fractions of its box. */
async function draw(page: Page, from: [number, number], to: [number, number]) {
  await page.getByTestId('assessment-canvas').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('assessment-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    await page.mouse.move(box.x + box.width * (from[0] + (to[0] - from[0]) * t), box.y + box.height * (from[1] + (to[1] - from[1]) * t));
  }
  await page.mouse.up();
}

test.describe('Phase 77 (JF15): playing with a child on one device', () => {
  test("Tom plays with Ben on his own device: turns on one screen, Continue with Ben, each player's own result", async ({ as }) => {
    const admin = await as('admin');
    const tom = await as('parent', { email: TOM });
    const ben = await personByName(admin, 'Ben Whitfield');
    await questOn(admin, true);
    let gameId = '';
    try {
      const home = await unwrap<any>(await tom.request.get('/api/home'), "Tom's home");
      const card = home.parent.children.find((c: any) => c.student_user_id === ben);
      expect(card).toMatchObject({ signs_in: false, open_game_id: null });
      // "Practise together before Saturday's lesson" when one is within the week, else "Play with Ben on this device".
      const practise = practiseBefore(card.next_lesson, home.day);
      const label = practise ? `Practise together before ${lessonDayWords(card.next_lesson.occurs_on, home.day)}` : 'Play with Ben on this device';

      await tom.goto('/');
      const play = tom.getByTestId(`home-child-play-${ben}`);
      await expect(play).toHaveText(label, { timeout: 15_000 });
      if (practise) await expect(tom.getByTestId(`home-child-on-device-${ben}`)).toHaveText('Ben plays beside you, on this device.');
      await play.click();

      // One tap: the game, begun at once -- no lobby, no code to share.
      await expect(tom).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);
      gameId = tom.url().split('/').pop()!;
      await expect(tom.getByTestId('game-seat-scores')).toBeVisible();
      await expect(tom.getByTestId('game-lobby-code')).toHaveCount(0);
      await expect(tom.getByTestId('game-start')).toHaveCount(0);
      // At Ben's grade (his school course says Grade 5), by the Daily's rule over Tom's tiles.
      expect(card.grade).toBe(5);
      const tiles = await unwrap<any>(await tom.request.get('/api/quest/tiles'), "Tom's tiles");
      const game = await unwrap<any>(await tom.request.get(`/api/quest/games/${gameId}`), 'the game');
      expect(game.level_id).toBe(dailyLevelFor(tiles.tiles, 5));
      expect(game.code).toBeTruthy();
      await expect(tom.getByTestId('game-page')).not.toContainText(game.code);

      // Ben first, in words, with the hand-over line; both scores side by side, by first name.
      const title = tom.getByTestId('game-turn-title');
      await expect(title).toHaveText("Ben's turn", { timeout: 15_000 });
      await expect(tom.getByTestId('game-hand-over')).toHaveText('Pass the device to Ben.');
      await expect(tom.getByTestId('game-seat-score-Ben')).toHaveText(/^Ben 0/);
      await expect(tom.getByTestId('game-seat-score-Tom')).toHaveText(/^Tom \(you\) 0/);
      await expect(tom.getByRole('radiogroup', { name: "Ben's answer" }).or(tom.getByRole('textbox', { name: "Ben's answer" }))).toBeVisible();
      await expect(tom.getByText('Question 1 of 5')).toBeVisible();
      await answerOnScreen(tom);

      // Then Tom, on the same question.
      await expect(title).toHaveText('Your turn');
      await expect(tom.getByTestId('game-hand-over')).toHaveText('Ben has answered: take the device back.');
      await expect(tom.getByText('Question 1 of 5')).toBeVisible();
      await answerOnScreen(tom);
      await expect(title).toHaveText("Ben's turn");
      await expect(tom.getByText('Question 2 of 5')).toBeVisible();

      // Leaving and coming back: "Continue with Ben" resumes on Ben's turn, on question 2.
      await tom.getByTestId('quest-exit').click();
      await expect(tom).toHaveURL(/\/$/);
      const resume = tom.getByTestId(`home-child-continue-${ben}`);
      await expect(resume).toHaveText('Continue with Ben', { timeout: 15_000 });
      await expect(tom.getByTestId(`home-child-play-${ben}`)).toHaveCount(0);
      await resume.click();
      await expect(tom).toHaveURL(new RegExp(`/quest/games/${gameId}$`));
      await expect(title).toHaveText("Ben's turn", { timeout: 15_000 });
      await expect(tom.getByText('Question 2 of 5')).toBeVisible();

      // The rest, skipped in turn: Ben, then Tom, on every question.
      for (let number = 2; number <= 5; number += 1) {
        await expect(title).toHaveText("Ben's turn");
        await expect(tom.getByText(`Question ${number} of 5`)).toBeVisible();
        await tom.getByTestId('game-skip').click();
        await expect(title).toHaveText('Your turn');
        await expect(tom.getByText(`Question ${number} of 5`)).toBeVisible();
        await tom.getByTestId('game-skip').click();
      }

      // Each player's own result, and no "team" words on one device.
      const winner = tom.getByTestId('game-winner');
      await expect(winner).toBeVisible({ timeout: 15_000 });
      const done = await unwrap<any>(await tom.request.get(`/api/quest/games/${gameId}`), 'the game, over');
      expect(done.status).toBe('finished');
      const byName = Object.fromEntries(done.teams.map((t: any) => [t.name, t]));
      await expect(tom.getByTestId('game-seated-result-Ben')).toHaveText(
        new RegExp(`^Ben: ${byName.Ben.correct} right, ${byName.Ben.score} points?`),
      );
      await expect(tom.getByTestId('game-seated-result-Tom')).toHaveText(
        new RegExp(`^You: ${byName.Tom.correct} right, ${byName.Tom.score} points?`),
      );
      await expect(tom.getByTestId('game-encouragement')).toHaveCount(0);
      await expect(tom.getByTestId('game-page')).not.toContainText(/\bteams?\b/i);
      await expect(tom.getByTestId('game-page')).toContainText('Ben and you, on this device');

      // Ben's questions, with their keys now the game is over: answered by Ben.
      await tom.getByTestId('game-review').getByRole('button', { name: 'Ben', exact: true }).click();
      await expect(tom.getByTestId('game-review')).toContainText("Ben’s questions");
      await expect(tom.getByTestId('game-review-1')).toContainText('Ben');
      await expect(tom.getByTestId('game-review-1')).toContainText('Answer:');

      // Home again: nothing open, and the day Ben played is his.
      await tom.getByTestId('game-results-back').click();
      await expect(tom.getByTestId(`home-child-play-${ben}`)).toBeVisible({ timeout: 15_000 });
      await expect(tom.getByTestId(`home-child-continue-${ben}`)).toHaveCount(0);
      await expect(tom.getByTestId(`home-child-played-${ben}`)).toContainText(/Played [1-7] days? this week/);
    } finally {
      if (gameId) await tom.request.post(`/api/quest/games/${gameId}/end`);
      await questOn(admin, false);
    }
  });

  test("Anita's son signs in: still the online invite, and her lobby says who was invited", async ({ as }) => {
    const admin = await as('admin');
    const anita = await as('parent');
    const sanjay = await idOf(admin, PEOPLE.studentTutor.email);
    await questOn(admin, true);
    let gameId = '';
    try {
      await anita.goto('/');
      const play = anita.getByTestId(`home-child-play-${sanjay}`);
      await expect(play).toBeVisible({ timeout: 15_000 });
      await expect(play).not.toContainText('on this device');
      await expect(anita.getByTestId(`home-child-on-device-${sanjay}`)).toHaveCount(0);
      await play.click();
      await expect(anita).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);
      gameId = anita.url().split('/').pop()!;
      // The lobby, with its code to share, and the one she invited.
      await expect(anita.getByTestId('game-lobby-code')).toBeVisible();
      await expect(anita.getByTestId('game-lobby-invited')).toHaveText('Invited: Sanjay');
      await expect(anita.getByTestId('game-turn')).toHaveCount(0);
    } finally {
      if (gameId) await anita.request.post(`/api/quest/games/${gameId}/end`);
      await questOn(admin, false);
    }
  });
});

test.describe('Phase 77 (JF20): a guardian continues the child’s assessment', () => {
  test('Omar continues the one Ines started, after handing the device to Noor, and submits it; he cannot discard it', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    const omar = await as('assessParent', { org: ORGS.c.slug });
    const noor = await personByName(ines, 'Noor Haddad');
    const started = await unwrap<any>(
      await ines.request.post('/api/canvas-assessments', { data: { student_user_id: noor, level_id: 'NC26.4' } }),
      'Ines starts it',
    );
    try {
      // Ines, its starter and an admin: Continue and Discard.
      await ines.goto('/assessments');
      await expect(ines.getByTestId(`assessment-continue-${started.id}`)).toBeVisible({ timeout: 15_000 });
      await expect(ines.getByTestId(`assessment-discard-${started.id}`)).toBeVisible();

      // Omar, Noor's father: Continue, never Discard.
      await omar.goto('/assessments');
      const row = omar.getByTestId(`assessment-${started.id}`);
      await expect(row).toContainText('In progress', { timeout: 15_000 });
      await expect(omar.getByTestId(`assessment-discard-${started.id}`)).toHaveCount(0);
      await omar.getByTestId(`assessment-continue-${started.id}`).click();

      // Handed to Noor before the questions.
      const handOver = omar.getByTestId('assessment-hand-over');
      await expect(handOver).toBeVisible();
      await expect(handOver.getByRole('heading')).toHaveText('Hand the device to Noor');
      await expect(handOver).toContainText('Noor answers on this device. Answers written on another device stay there.');
      await expect(omar.getByRole('heading', { name: /Question 1 of/ })).toHaveCount(0);
      await omar.getByTestId('assessment-ready').click();
      await expect(omar.getByRole('heading', { name: /Question 1 of/ })).toBeVisible();

      // Noor writes on the first page, and Omar's device submits it.
      await draw(omar, [0.2, 0.3], [0.5, 0.5]);
      await omar.getByTestId('assessment-submit').click();
      await omar.getByTestId('assessment-submit-confirm').click();
      await expect(omar).toHaveURL(/\/assessments$/);
      // It went to the space's admins (this space has no Tutoring): said, never linked.
      await expect(visible(omar, "Submitted. The space's admins get a PDF of Noor's answers.")).toBeVisible();
      await expect(row).toContainText('Submitted');
      await expect(row.getByRole('link', { name: 'Submitted PDF' })).toHaveCount(0);
      await expect(row.getByRole('link', { name: 'Continue' })).toHaveCount(0);
      expect((await omar.request.get(`/api/canvas-assessments/${started.id}/pdf`)).status()).toBe(404);
      // The office opens it.
      expect((await ines.request.get(`/api/canvas-assessments/${started.id}/pdf`)).status()).toBe(200);
    } finally {
      // Looked at: reviewed, so it waits for nobody (the office's open count stays as other specs expect).
      await ines.request.post(`/api/canvas-assessments/${started.id}/discard`, { data: {} });
      await ines.request.put(`/api/canvas-assessments/${started.id}/review`, { data: { notes: {}, comment: '', ink: [] } });
      await ines.request.post(`/api/canvas-assessments/${started.id}/review/finish`, { data: {} });
    }
  });

  test('Start warns when Noor already has one in progress: Continue it, or Start another', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    const omar = await as('assessParent', { org: ORGS.c.slug });
    const noor = await personByName(ines, 'Noor Haddad');
    const started = await unwrap<any>(
      await ines.request.post('/api/canvas-assessments', { data: { student_user_id: noor, level_id: 'NC26.4' } }),
      'Ines starts one',
    );
    const made: string[] = [started.id];
    try {
      const begin = async () => {
        await omar.goto('/assessments');
        await expect(omar.getByTestId(`assessment-${started.id}`)).toBeVisible({ timeout: 15_000 });
        await omar.getByLabel('Student').click();
        await omar.getByRole('option', { name: 'Noor Haddad' }).click();
        await omar.getByLabel('Level').click();
        await omar.getByRole('option', { name: /^Grade 3 ·/ }).click();
        await omar.getByTestId('assessment-begin').click();
      };

      // The warning names the one in progress, its grade and when it was started -- in the same words as its row,
      // even once time has passed since the list was drawn (Phase 78, the Phase 77 carry: one `now` for the screen).
      await omar.clock.install();
      await begin();
      await omar.getByTestId('assessment-in-progress-cancel').click();
      await omar.clock.fastForward(70_000);
      await omar.getByTestId('assessment-begin').click();
      const warning = omar.getByTestId('assessment-in-progress');
      await expect(warning).toBeVisible();
      await expect(omar.getByTestId('assessment-in-progress-words')).toHaveText(
        /^Noor already has a Grade 4 assessment in progress \(started (just now|\d+ minutes? ago)\)\.$/,
      );
      const said = (await omar.getByTestId('assessment-in-progress-words').textContent())!.match(/\(started (.+)\)\.$/)![1]!;
      expect(said).not.toBe('just now');
      await expect(omar.getByTestId(`assessment-${started.id}`)).toContainText(`started ${said}`);
      // Continue it: the one in progress, handed to Noor.
      await omar.getByTestId('assessment-continue-it').click();
      await expect(omar).toHaveURL(new RegExp(`/assessments/${started.id}$`));
      await expect(omar.getByTestId('assessment-hand-over')).toBeVisible();

      // Start another: a second one, as asked.
      await begin();
      await expect(warning).toBeVisible();
      await omar.getByTestId('assessment-start-another').click();
      await expect(omar).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/);
      const second = omar.url().split('/').at(-1)!;
      made.push(second);
      expect(second).not.toBe(started.id);
      const fresh = await unwrap<any>(await omar.request.get(`/api/canvas-assessments/${second}`), 'the second');
      expect(fresh).toMatchObject({ student_user_id: noor, level_id: 'NC26.3', status: 'in_progress', can_discard: true });

      // Omar started the second, so he may discard that one -- and only that one.
      await omar.goto('/assessments');
      await expect(omar.getByTestId(`assessment-discard-${second}`)).toBeVisible({ timeout: 15_000 });
      await expect(omar.getByTestId(`assessment-discard-${started.id}`)).toHaveCount(0);
    } finally {
      for (const id of made) await ines.request.post(`/api/canvas-assessments/${id}/discard`, { data: {} });
    }
  });
});

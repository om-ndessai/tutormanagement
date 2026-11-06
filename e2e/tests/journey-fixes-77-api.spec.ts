import type { Page } from '@playwright/test';
import { GAME_CODE_NOT_FOUND_MESSAGE, playTogetherRequest, playWithRequest } from '@tmi/shared';

import { expect, ORGS, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 77 (docs/journey-fixes-plan.md, JF15 and JF20), the server's half: families at home.
 *
 * JF15 -- "Play with <child>" for a child who does not sign in is a game on the parent's own device: the child is a
 * seat (`seat_user_ids`), a solo team of their own beside the parent's, begun at once with no lobby; nobody finds it by
 * its code or joins it; the parent's session answers for the seat (`as_user_id`), checked against the game's seats; the
 * child's answers are the child's (days played, a family game) and never count toward the two-right-answers rule. A
 * child who signs in keeps the online invite, whose lobby now says who was invited (the host and admins only).
 *
 * JF20 -- a guardian may continue a child's assessment that somebody else started, on their own device, and submit it;
 * only its starter or an admin discards it; the submitted PDF stays the tutors' and the admins' (R17).
 *
 * Personas: chmi's Tom Whitfield and his son Ben (no email; Dana is Ben's other guardian), Anita and her son Sanjay
 * (who signs in); the assess space's Ines (admin and mother), Omar (father) and Noor (no email).
 *
 * Serial: the space's Quest switch and Dana's membership are changed and put back. Run it on a freshly reset
 * database (`npm run db:reset`): the two-right-answers check needs a level nobody else's spec answers (NC26.2).
 */
test.describe.configure({ mode: 'serial' });

const TOM = 'tom.whitfield@gmail.com';
const DANA = 'dana.whitfield@gmail.com';
/** All checked in the seed's sample (no approved question), and played by no other spec. */
const LEVEL = 'NC26.2';

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

async function personByName(admin: Page, name: string): Promise<string> {
  const found = await unwrap<any[]>(await admin.request.get(`/api/users?search=${encodeURIComponent(name)}`), name);
  const person = found.find((p) => p.full_name === name);
  expect(person, name).toBeTruthy();
  return person.id;
}

/** A started game counts down before its first question; wait it out, by the server's clock. */
async function afterCountdown(game: { started_at: string; now: string }) {
  const wait = Date.parse(game.started_at) - Date.parse(game.now);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 150));
}

const seat = { level_id: LEVEL, mode: 'count', question_count: 2, players: 'multi', max_team_size: 1 } as const;

test.describe('Phase 77 (JF15): playing with a child on one device', () => {
  test('a seat is only your own child here, and only one who does not sign in', async ({ as }) => {
    const admin = await as('admin');
    const tom = await as('parent', { email: TOM });
    const anita = await as('parent');
    const alex = await as('tutor');
    const ben = await personByName(admin, 'Ben Whitfield');
    const sanjay = await idOf(admin, PEOPLE.studentTutor.email);
    const tomId = await idOf(admin, TOM);
    await questOn(admin, true);
    try {
      const before = (await unwrap<any[]>(await tom.request.get('/api/quest/games'), "Tom's games")).length;
      const refusedAs422 = async (page: Page, seats: string[], words: string) => {
        const response = await page.request.post('/api/quest/games', { data: { ...seat, seat_user_ids: seats } });
        expect(response.status(), `${seats} -> 422`).toBe(422);
        const error = (await response.json()).error;
        expect(error.code).toBe('validation_failed');
        expect(error.details.seat_user_ids).toEqual([words]);
      };
      // Somebody else's child, the host themselves, a child named twice, a tutor's pupil: never a seat.
      await refusedAs422(tom, [sanjay], 'Only your own child can play on your device.');
      await refusedAs422(tom, [tomId], 'Only your own child can play on your device.');
      await refusedAs422(tom, [ben, ben], 'Each child plays once.');
      await refusedAs422(alex, [ben], 'Only your own child can play on your device.');
      await refusedAs422(tom, ['not-a-person'], 'Only your own child can play on your device.');

      // Her own child, who signs in: invited online instead, in his name.
      const signsIn = await anita.request.post('/api/quest/games', { data: { ...seat, seat_user_ids: [sanjay] } });
      expect(signsIn.status()).toBe(409);
      expect((await signsIn.json()).error).toMatchObject({ code: 'seat_signs_in', message: 'Sanjay signs in: invite them instead.' });

      // Nothing was made.
      expect((await unwrap<any[]>(await tom.request.get('/api/quest/games'), "Tom's games")).length).toBe(before);
    } finally {
      await questOn(admin, false);
    }
  });

  test('a seated game: begun at once, found by nobody, answered for the child, credited to the child', async ({ as }) => {
    const admin = await as('admin');
    const tom = await as('parent', { email: TOM });
    const alex = await as('tutor');
    const anita = await as('parent');
    const platform = await as('platformAdmin', { org: null });
    const ben = await personByName(admin, 'Ben Whitfield');
    const sanjay = await idOf(admin, PEOPLE.studentTutor.email);
    const dana = await idOf(admin, DANA);
    await questOn(admin, true);
    let gameId = '';
    try {
      // The parent's card says how Ben plays and at which grade: no sign-in, Grade 5 (his school course), nothing open.
      const home0 = await unwrap<any>(await tom.request.get('/api/home'), "Tom's home");
      const card0 = home0.parent.children.find((c: any) => c.student_user_id === ben);
      expect(card0).toMatchObject({ signs_in: false, grade: 5, open_game_id: null });
      const daysBefore = card0.days_played_this_week as number;

      // The client's request for a child who does not sign in is a seated game (a shorter one here).
      const request = { ...playTogetherRequest(card0, LEVEL), question_count: 2 };
      expect(request.seat_user_ids).toEqual([ben]);
      const game = await unwrap<any>(await tom.request.post('/api/quest/games', { data: request }), 'a seated game');
      gameId = game.id;
      expect(game).toMatchObject({ status: 'running', players: 'multi', max_teams: 2, max_team_size: 1, late_join: false, is_host: true });
      expect(game.teams.map((t: any) => [t.name, t.solo])).toEqual([
        ['Tom', true],
        ['Ben', true],
      ]);
      const benTeam = game.teams.find((t: any) => t.name === 'Ben').id;
      expect(game.seats).toEqual([{ user_id: ben, first_name: 'Ben', team_id: benTeam, question: null, last: null, waiting: false }]);
      expect(game.invited).toEqual([]);

      // Its code finds nothing, for anyone -- the same honest words as no game at all -- and nobody joins it.
      for (const [page, who] of [[alex, 'Alex'], [tom, 'Tom'], [admin, 'the office']] as const) {
        const looked = await page.request.post('/api/quest/games/lookup', { data: { code: game.code } });
        expect(looked.status(), who).toBe(404);
        expect((await looked.json()).error.message, who).toBe(GAME_CODE_NOT_FOUND_MESSAGE);
      }
      expect((await alex.request.post(`/api/quest/games/${gameId}/join`, { data: { as: 'solo' } })).status()).toBe(404);
      expect((await alex.request.get(`/api/quest/games/${gameId}`)).status()).toBe(404);

      // One line in the log, naming the child, never the code nobody can use.
      const log = await unwrap<any[]>(await admin.request.get('/api/audit?limit=20'), 'the log');
      const line = log.find((row) => row.action === 'quest.game_created' && row.entity_id === gameId);
      // Phase 78 (JF32): the quest in words, never "Quest game" -- "Started a Grade 5 Quick 2 quest to play with Ben...".
      expect(line.description).toMatch(/^Started a .+ Quick 2 quest to play with Ben on this device$/);
      expect(line.description).not.toContain('Quest game');
      expect(line.description).not.toContain(game.code);
      expect(line.subject_user_id).toBe(ben);

      // Never an invitation: nothing waits for Ben's other guardian (made active for the check) or anyone else.
      expect((await admin.request.patch(`/api/users/${dana}`, { data: { status: 'active' } })).status()).toBe(200);
      try {
        const danaPage = await as('admin', { email: DANA });
        expect(await unwrap<any[]>(await danaPage.request.get('/api/quest/games/waiting'), "Dana's waiting")).toEqual([]);
        // Continue is the seating parent's own: Dana's card for Ben has nothing open.
        const danaHome = await unwrap<any>(await danaPage.request.get('/api/home'), "Dana's home");
        expect(danaHome.parent.children.find((c: any) => c.student_user_id === ben).open_game_id).toBeNull();
      } finally {
        expect((await admin.request.patch(`/api/users/${dana}`, { data: { status: 'invited' } })).status()).toBe(200);
      }
      for (const page of [tom, anita, alex]) expect(await unwrap<any[]>(await page.request.get('/api/quest/games/waiting'), 'waiting')).toEqual([]);

      // Every team plays the same series: Tom's question and Ben's are the same one, without its key (R20).
      await afterCountdown(game);
      const playing = await unwrap<any>(await tom.request.get(`/api/quest/games/${gameId}`), 'playing');
      expect(playing.me.question.number).toBe(1);
      expect(playing.seats[0].question).toMatchObject({ id: playing.me.question.id, number: 1 });
      expect(JSON.stringify(playing)).not.toContain('"answer"');
      // "Continue with Ben" is the seating parent's.
      const home1 = await unwrap<any>(await tom.request.get('/api/home'), "Tom's home, playing");
      expect(home1.parent.children.find((c: any) => c.student_user_id === ben).open_game_id).toBe(gameId);
      // The office reads the game, but never the seats' hands; the invited list is the host's and the office's.
      const office = await unwrap<any>(await admin.request.get(`/api/quest/games/${gameId}`), 'the office reading it');
      expect(office.seats).toBeUndefined();
      expect(office.invited).toEqual([]);
      // The games lists mark it as played on one device (its code finds nothing, so no list should offer it).
      const tomsRow = (await unwrap<any[]>(await tom.request.get('/api/quest/games'), "Tom's games")).find((g) => g.id === gameId);
      expect(tomsRow).toMatchObject({ seated: true, is_host: true });
      const officeRow = (await unwrap<any[]>(await admin.request.get('/api/quest/games'), "the office's games")).find(
        (g) => g.id === gameId,
      );
      expect(officeRow).toMatchObject({ seated: true, is_host: false });

      // Only the seating parent answers for Ben: not the office, and Tom not for a child he did not seat.
      const q1 = playing.me.question.id as string;
      const forBen = { question_id: q1, answer: 'x', as_user_id: ben };
      expect((await admin.request.post(`/api/quest/games/${gameId}/answer`, { data: forBen })).status()).toBe(409);
      expect((await tom.request.post(`/api/quest/games/${gameId}/answer`, { data: { ...forBen, as_user_id: sanjay } })).status()).toBe(409);
      expect((await alex.request.post(`/api/quest/games/${gameId}/answer`, { data: forBen })).status()).toBe(404);

      // The first question, right for both: Ben first (on the parent's device), then Tom.
      const bank = await unwrap<any[]>(
        await platform.request.get(`/api/platform/questions?level_id=${LEVEL}&status=checked&limit=200`),
        'the level, checked',
      );
      const key = (id: string) => bank.find((q) => q.id === id)?.answer as string;
      expect(key(q1), 'the first question is a checked one').toBeTruthy();
      const afterBen = await unwrap<any>(
        await tom.request.post(`/api/quest/games/${gameId}/answer`, { data: { question_id: q1, answer: key(q1), as_user_id: ben } }),
        'Ben answers',
      );
      expect(afterBen.seats[0].last).toEqual({ correct: true, skipped: false });
      expect(afterBen.seats[0].question.number).toBe(2);
      expect(afterBen.me.question.id).toBe(q1);
      const afterTom = await unwrap<any>(
        await tom.request.post(`/api/quest/games/${gameId}/answer`, { data: { question_id: q1, answer: key(q1) } }),
        'Tom answers',
      );
      // The second: Ben wrong, Tom skips -- and the game ends, every team done.
      const q2 = afterTom.me.question.id as string;
      await unwrap(
        await tom.request.post(`/api/quest/games/${gameId}/answer`, { data: { question_id: q2, answer: 'not-an-answer', as_user_id: ben } }),
        'Ben answers again',
      );
      const done = await unwrap<any>(
        await tom.request.post(`/api/quest/games/${gameId}/answer`, { data: { question_id: q2, skip: true } }),
        'Tom skips',
      );
      expect(done.status).toBe('finished');
      expect(Object.fromEntries(done.teams.map((t: any) => [t.name, [t.correct, t.wrong, t.skipped]]))).toEqual({
        Tom: [1, 0, 1],
        Ben: [1, 1, 0],
      });

      // The parent reads Ben's own results (his team), with the keys now the game is over.
      const results = await unwrap<any>(await tom.request.get(`/api/quest/games/${gameId}/results?team=${benTeam}`), "Ben's results");
      expect(results.team_id).toBe(benTeam);
      expect(results.items.map((item: any) => [item.answered_by, item.correct])).toEqual([
        ['Ben', true],
        ['Ben', false],
      ]);

      // Credit follows the answer: Ben played today (his days, counted on his parent's card); nothing open any more.
      const home2 = await unwrap<any>(await tom.request.get('/api/home'), "Tom's home, after");
      const card2 = home2.parent.children.find((c: any) => c.student_user_id === ben);
      expect(card2.days_played_this_week).toBe(Math.max(daysBefore, 1));
      expect(card2.open_game_id).toBeNull();
      expect(card2.grade).toBe(5);

      // A family game for the parent (and for the child, by the same rule), with no invitation anywhere.
      const habit = await unwrap<any>(await tom.request.get('/api/quest/me/habit'), "Tom's progress");
      expect(habit.badges.find((b: any) => b.id === 'first_family_game').earned).toBe(true);

      // Two people answered q1 right, but one of them was a seat: no approval by consensus -- it stays checked.
      const still = await unwrap<any[]>(
        await platform.request.get(`/api/platform/questions?level_id=${LEVEL}&status=checked&limit=200`),
        'the level, checked, after',
      );
      expect(still.some((q) => q.id === q1)).toBe(true);
    } finally {
      if (gameId) await tom.request.post(`/api/quest/games/${gameId}/end`);
      await questOn(admin, false);
    }
  });

  test("a child who signs in keeps the online invite, and the lobby says who was invited (the host's and the office's)", async ({ as }) => {
    const admin = await as('admin');
    const anita = await as('parent');
    const sanjayPage = await as('studentTutor');
    const sanjay = await idOf(admin, PEOPLE.studentTutor.email);
    await questOn(admin, true);
    let gameId = '';
    try {
      const home = await unwrap<any>(await anita.request.get('/api/home'), "Anita's home");
      const card = home.parent.children.find((c: any) => c.student_user_id === sanjay);
      expect(card.signs_in).toBe(true);
      expect(card.open_game_id).toBeNull();
      expect(card.grade === null || typeof card.grade === 'number').toBe(true);
      // The helper keeps today's invite for him, unchanged.
      const request = playTogetherRequest(card, 'NC26.5');
      expect(request).toEqual(playWithRequest('NC26.5', sanjay));

      const game = await unwrap<any>(await anita.request.post('/api/quest/games', { data: request }), 'Play with Sanjay');
      gameId = game.id;
      expect(game.status).toBe('lobby');
      expect(game.seats).toBeUndefined();
      expect(game.invited).toEqual([{ user_id: sanjay, first_name: 'Sanjay' }]);
      const office = await unwrap<any>(await admin.request.get(`/api/quest/games/${gameId}`), 'the office reading it');
      expect(office.invited).toEqual([{ user_id: sanjay, first_name: 'Sanjay' }]);
      const anitasRow = (await unwrap<any[]>(await anita.request.get('/api/quest/games'), "Anita's games")).find(
        (g) => g.id === gameId,
      );
      expect(anitasRow.seated).toBe(false);

      // He sees it waiting, joins with no code, and reads no invited list of his own.
      const waiting = await unwrap<any[]>(await sanjayPage.request.get('/api/quest/games/waiting'), "Sanjay's waiting");
      expect(waiting.map((w) => w.game_id)).toContain(gameId);
      const joined = await unwrap<any>(await sanjayPage.request.post(`/api/quest/games/${gameId}/join`, { data: { as: 'solo' } }), 'joining');
      expect(joined.invited).toBeUndefined();
      expect(joined.seats).toBeUndefined();
      // An online game is never "Continue with Sanjay" on his mother's card.
      const after = await unwrap<any>(await anita.request.get('/api/home'), "Anita's home, after");
      expect(after.parent.children.find((c: any) => c.student_user_id === sanjay).open_game_id).toBeNull();
    } finally {
      if (gameId) await anita.request.post(`/api/quest/games/${gameId}/end`);
      await questOn(admin, false);
    }
  });
});

test.describe('Phase 77 (JF20): a guardian continues the child’s assessment', () => {
  test('Ines starts Noor’s; Omar continues and submits it on his own device; the PDF stays the office’s', async ({ as }) => {
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    const omar = await as('assessParent', { org: ORGS.c.slug });
    const noor = await personByName(ines, 'Noor Haddad');
    const started = await unwrap<any>(
      await ines.request.post('/api/canvas-assessments', { data: { student_user_id: noor, level_id: 'NC26.4' } }),
      'Ines starts it',
    );
    try {
      // Its starter (an admin too) may do either.
      expect(started).toMatchObject({ status: 'in_progress', can_continue: true, can_discard: true });

      // Omar, Noor's father: he may take it on, not throw it away.
      const listed = (await unwrap<any[]>(await omar.request.get('/api/canvas-assessments'), "Omar's list")).find((row) => row.id === started.id);
      expect(listed).toMatchObject({ status: 'in_progress', can_continue: true, can_discard: false, can_review: false });
      const taking = await unwrap<any>(await omar.request.get(`/api/canvas-assessments/${started.id}`), 'Omar opens it');
      expect(taking.questions.length).toBe(started.question_count);
      for (const question of taking.questions) {
        expect(question).not.toHaveProperty('answer');
        expect(question).not.toHaveProperty('solution');
      }
      expect((await omar.request.post(`/api/canvas-assessments/${started.id}/discard`, { data: {} })).status()).toBe(404);

      // He submits it from his device: he gets the row back, never the answers.
      const submitted = await unwrap<any>(
        await omar.request.post(`/api/canvas-assessments/${started.id}/submit`, {
          data: { pages: [{ question_id: taking.questions[0].id, strokes: ['4 100 100 300 200 500 150'], choice: null }] },
        }),
        'Omar submits it',
      );
      expect(submitted).toMatchObject({ status: 'submitted', can_continue: false, can_discard: false, can_review: false, choices_correct: null });
      expect((await omar.request.get(`/api/canvas-assessments/${started.id}/pdf`)).status()).toBe(404);
      const after = await unwrap<any>(await omar.request.get(`/api/canvas-assessments/${started.id}`), 'Omar reads it after');
      expect(after.questions).toBeNull();
      // Once only: the 409 for one no longer in progress.
      expect((await omar.request.post(`/api/canvas-assessments/${started.id}/submit`, { data: { pages: [] } })).status()).toBe(409);

      // The office opens the PDF, and the log says who submitted it -- how much was done, never how well.
      expect((await ines.request.get(`/api/canvas-assessments/${started.id}/pdf`)).status()).toBe(200);
      const log = await unwrap<any[]>(await ines.request.get('/api/audit?limit=20'), 'the log');
      const line = log.find((row) => row.action === 'canvas_assessment.submitted' && row.entity_id === started.id);
      expect(line.actor_name).toBe(PEOPLE.assessParent.name);
      expect(line.description).toMatch(/^Submitted Noor Haddad's .+ assessment: 1 of \d+ questions written/);
    } finally {
      // Looked at: reviewed, so it waits for nobody (the office's open count stays as other specs expect).
      await ines.request.post(`/api/canvas-assessments/${started.id}/discard`, { data: {} });
      await ines.request.put(`/api/canvas-assessments/${started.id}/review`, { data: { notes: {}, comment: '', ink: [] } });
      await ines.request.post(`/api/canvas-assessments/${started.id}/review/finish`, { data: {} });
    }
  });
});

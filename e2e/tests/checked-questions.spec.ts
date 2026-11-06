import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { setCheckedQuestions } from '../support/checked-questions.js';

/**
 * Phase 62 (docs/stickiness-plan.md): P1, checked questions per space. Platform admins switch, per
 * space, whether its games, tiles and Assessments draw checked questions as well as approved ones (served
 * like any other since Phase 78: no Beta mark a player reads). On everywhere by default -- the soft launch. One rule (`checkedQuestionsOn`) feeds the counts
 * and the draws, and the space admins' old switch is no longer applied.
 *
 * Serial: one space's switch, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

test.describe('P1: checked questions, per space', () => {
  test('every space starts with checked questions on', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'spaces');
    expect(spaces.length).toBeGreaterThan(0);
    expect(spaces.every((space) => space.checked_questions === true)).toBe(true);
  });

  test('a platform admin turns them off for one space: its draws are approved only, and it is logged', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const admin = await as('orgBAdmin', { org: 'riverside' });
    expect((await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: true } })).status()).toBe(200);
    try {
      const on = await unwrap<any[]>(await admin.request.get('/api/canvas-assessments/levels'), 'levels, on');
      const grade7On = on.find((l) => l.level_id === 'NC26.7');
      expect(grade7On.available).toBeGreaterThan(0);

      await setCheckedQuestions(platform, 'riverside', false);
      const off = await unwrap<any[]>(await admin.request.get('/api/canvas-assessments/levels'), 'levels, off');
      expect(off.find((l) => l.level_id === 'NC26.7').unreviewed).toBe(0);

      // The Space page says so, in the shared words (Phase 78: CHECKED_QUESTIONS_COPY).
      await admin.goto('/organization');
      await expect(admin.getByTestId('checked-questions-note')).toContainText(
        'Not included: assessments and quests here draw approved questions only. The platform sets this.',
      );

      // The session the space's members read says so (older apps read the old field).
      const session = await unwrap<any>(await admin.request.get('/api/auth/session'), 'session');
      const org = session.organization ?? session.memberships?.find((m: any) => m.slug === 'riverside');
      if (session.organization) {
        expect(session.organization.checked_questions).toBe(false);
        expect(session.organization.canvas_assessments_unreviewed).toBe(false);
      } else {
        expect(org).toBeTruthy();
      }

      const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'console log');
      expect(
        audit.some((row) => row.action === 'organization.features_updated' && /approved questions only/.test(row.description)),
      ).toBe(true);
    } finally {
      await setCheckedQuestions(platform, 'riverside', true);
      await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: false } });
    }
  });

  test('the Space page says what checked questions mean, with no Beta mark', async ({ as }) => {
    const admin = await as('orgBAdmin', { org: 'riverside' });
    expect((await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: true } })).status()).toBe(200);
    try {
      await admin.goto('/organization');
      const card = admin.getByTestId('canvas-assessments-setting');
      await expect(admin.getByTestId('checked-questions-note')).toContainText(
        'They are served like any other, and the bank approves them as players answer them right',
      );
      // Phase 78 (owner, 2026-11-05): a space's admins read no Beta, on the card or its heading.
      await expect(card).not.toContainText('Beta');
      await expect(card.getByRole('heading', { name: 'Assessment in this space', exact: true })).toBeVisible();
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: false } });
    }
  });

  test("the console's space dialog holds the switch", async ({ as }) => {
    const page = await as('platformAdmin', { org: null });
    await page.goto('/platform');
    await page.getByRole('button', { name: 'Edit Riverside Tutoring' }).click();
    await expect(page.getByRole('switch', { name: 'Checked questions (Beta)' })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('P2: game answers count toward the two-right-answers rule', () => {
  test('two people answer one checked question correctly in a game: it is approved, by quest consensus', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofia = await as('student');
    const platform = await as('platformAdmin', { org: null });
    const quest = (on: boolean) => admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } });
    expect((await quest(true)).status()).toBe(200);
    try {
      // The space must be one the platform trusts for Quest (Phase 51), as the seeded institute is.
      const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'spaces');
      expect(spaces.find((space) => space.slug === 'chmi')?.quest_trusted).toBe(true);

      // Every team plays the same series: three on their own, one question.
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'BA3', mode: 'count', question_count: 1, negative_marking: false, max_team_size: 1, players: 'multi' },
        }),
        'a game',
      );
      for (const [page, who] of [[admin, 'admin'], [alex, 'Alex'], [sofia, 'Sofia']] as const) {
        await unwrap(await page.request.post(`/api/quest/games/${game.id}/join`, { data: { as: 'solo' } }), `${who} joins`);
      }
      const started = await unwrap<any>(await admin.request.post(`/api/quest/games/${game.id}/start`), 'start');
      const wait = Date.parse(started.started_at) - Date.parse(started.now);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait + 150));

      const served = (await unwrap<any>(await alex.request.get(`/api/quest/games/${game.id}`), 'Alex sees')).me.question;
      expect(served).toBeTruthy();
      const bank = await unwrap<any[]>(
        await platform.request.get('/api/platform/questions?level_id=BA3&status=checked&limit=200'),
        'checked BA3 questions',
      );
      const question = bank.find((q) => q.id === served.id);
      expect(question, 'the served question is checked').toBeTruthy();

      // P3: a checked question still travels with `beta` (older apps read it), but since Phase 78 (owner,
      // 2026-11-05) the screen serves it like any other: no Beta mark on the question, nor anywhere on it.
      expect(served.beta).toBe(true);
      await alex.goto(`/quest/games/${game.id}`);
      await expect(alex.getByTestId('game-question')).toBeVisible();
      await expect(alex.getByTestId('game-question-beta')).toHaveCount(0);
      await expect(alex.getByText('Beta', { exact: true })).toHaveCount(0);

      // Alex and the admin answer it correctly; Sofia skips it, and a skip is not a right answer.
      for (const page of [alex, admin]) {
        // A question is answered from the player's own hand: viewing the game serves it.
        const mine = (await unwrap<any>(await page.request.get(`/api/quest/games/${game.id}`), 'served')).me.question;
        expect(mine?.id).toBe(served.id);
        const reply = await page.request.post(`/api/quest/games/${game.id}/answer`, {
          data: { question_id: served.id, answer: question.answer },
        });
        expect(reply.status()).toBe(200);
      }
      await unwrap(await sofia.request.get(`/api/quest/games/${game.id}`), 'Sofia is served');
      await unwrap(
        await sofia.request.post(`/api/quest/games/${game.id}/answer`, { data: { question_id: served.id, skip: true } }),
        'Sofia skips',
      );

      // The game has ended (everyone answered its one question): the question is approved.
      await expect
        .poll(async () => {
          const approved = await unwrap<any[]>(
            await platform.request.get('/api/platform/questions?level_id=BA3&status=approved&limit=200'),
            'approved BA3',
          );
          return approved.find((q) => q.id === served.id)?.approved_via ?? null;
        })
        .toBe('quest_consensus');
    } finally {
      await quest(false);
    }
  });
});


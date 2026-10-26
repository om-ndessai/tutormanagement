import { test, expect } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Older clients (Phase 49's backward-compatibility test, docs/open-signup-plan.md).
 *
 * The phones keep the app build they were given until someone reinstalls it, so the API keeps
 * answering the request shapes older builds send. Each test here is one such shape, named for the
 * release that changed it. Tagged @compat: `npm run test:compat` runs them on the last release's
 * database, migrated by hand, as well as in the full suite.
 */

test.describe('older clients @compat', () => {
  test('Phase 54: a space from before has an organization of its own, and takes payments as before', async ({ as }) => {
    const admin = await as('admin');
    // The backfill gave every existing space a business with its own name and TIN.
    const settings = await unwrap<any>(await admin.request.get('/api/organization/settings'), 'settings');
    expect(settings.business?.name).toBe('Chapel Hill Math Institute');
    expect(settings.tin).toBe('47-2019388');
    // Exactly what a Phase 53 app sends: no payee.
    const balances = await unwrap<any>(await admin.request.get('/api/payments/balances'), 'balances');
    const family = balances.students.find((row: any) => row.guardians.length > 0);
    const payment = await unwrap<any>(
      await admin.request.post('/api/payments', {
        data: {
          direction: 'from_parent',
          party_user_id: family.guardians[0].user_id,
          student_user_id: family.student_user_id,
          amount_cents: 100,
          method: 'cash',
          paid_at: '2026-10-21T18:00:00.000Z',
        },
      }),
      'a payment without a payee',
    );
    expect(payment.payee_user_id).toBeNull();
    expect((await admin.request.delete(`/api/payments/${payment.id}`)).status()).toBe(204);
    const lessons = await unwrap<any[]>(await admin.request.get('/api/sessions?limit=5'), 'lessons');
    expect(lessons.every((s: any) => s.paid_directly === false)).toBe(true);
  });

  test('Phase 46: a game made without the Phase 47 fields is a Phase 46 game', async ({ as }) => {
    const admin = await as('admin');
    const set = (on: boolean) =>
      admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on, canvas_assessments_unreviewed: on } });
    expect((await set(true)).status()).toBe(200);
    try {
      // Exactly what the Phase 46 app sends: level, length, negative marking and team size.
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 2, negative_marking: true, max_team_size: 2 },
        }),
        'a Phase 46 game',
      );
      expect(game).toMatchObject({ status: 'lobby', negative_marking: true });
      expect(game.code).toMatch(/^[A-Z2-9]{6}$/);
      await unwrap(await admin.request.post(`/api/quest/games/${game.id}/end`), 'end');
    } finally {
      await set(false);
    }
  });

  test('Phase 42: an approval still reads as a known way of approving', async ({ as }) => {
    // The console's lists carry approved_via; older builds know 'console' and 'quest' and show
    // nothing for a value they do not know, so a new value is never a crash. This pins the shape.
    const platform = await as('platformAdmin', { org: null });
    const approved = await unwrap<any[]>(await platform.request.get('/api/platform/questions?status=approved&limit=5'), 'approved');
    for (const q of approved) expect(['console', 'quest', 'quest_consensus', null]).toContain(q.approved_via);
  });
});

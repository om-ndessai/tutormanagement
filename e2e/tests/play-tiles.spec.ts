import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 62 (docs/stickiness-plan.md): P5, tiles and their names. A tile is a quest in one tap, named
 * <level tag><Q|T|A><number> (G4T10, BA3Q5, G4A5). Platform admins keep the list and the Play settings
 * in the console; members see the tiles shown to members, in the curricula their space offers, at
 * levels with enough questions to play.
 *
 * Serial: one platform-wide list, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

test.describe('P5: tiles', () => {

  test("a member's tiles: their space's curricula, quests only, deep enough levels", async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const { play_home, tiles } = await unwrap<any>(await admin.request.get('/api/quest/tiles'), 'tiles');
      expect(play_home).toBe(true);
      const codes = tiles.map((tile: any) => tile.code);
      expect(codes).toContain('G4Q5');
      expect(codes).toContain('BA3Q5');
      // The institute's space offers Beast Academy and NC 2026, not Math Kangaroo; no assessment tiles yet.
      expect(codes.some((code: string) => code.startsWith('MK'))).toBe(false);
      expect(codes.some((code: string) => /A\d+$/.test(code))).toBe(false);
      const g4t10 = tiles.find((tile: any) => tile.code === 'G4T10');
      expect(g4t10).toMatchObject({ words: 'Grade 4 · 10 minutes', mode: 'timed', value: 10 });
      expect(g4t10.available).toBeGreaterThanOrEqual(50);
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('the console keeps the list: refuses a repeat or an impossible tile, logs a change, puts the defaults back', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const admin = await as('admin');
    const start = await unwrap<any>(await platform.request.get('/api/platform/play'), 'the Play settings');
    expect(start.is_default).toBe(true);
    const shape = ({ kind, level_id, mode, value, guest, members }: any) => ({ kind, level_id, mode, value, guest, members });
    const tiles = start.tiles.map(shape);

    const twice = await platform.request.put('/api/platform/play', { data: { settings: start.settings, tiles: [...tiles, tiles[0]] } });
    expect(twice.status()).toBe(422);
    const tooLong = await platform.request.put('/api/platform/play', {
      data: { settings: start.settings, tiles: [{ kind: 'quest', level_id: 'NC26.4', mode: 'timed', value: 45, guest: 'open', members: true }] },
    });
    expect(tooLong.status()).toBe(422);

    // Add G4Q15, raise the depth past every level, and the member's list empties.
    const saved = await unwrap<any>(
      await platform.request.put('/api/platform/play', {
        data: {
          settings: { ...start.settings, min_depth: 1000 },
          tiles: [...tiles, { kind: 'quest', level_id: 'NC26.4', mode: 'count', value: 15, guest: 'locked', members: true }],
        },
      }),
      'saving',
    );
    expect(saved.is_default).toBe(false);
    expect(saved.tiles.at(-1).code).toBe('G4Q15');
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const empty = await unwrap<any>(await admin.request.get('/api/quest/tiles'), 'tiles');
      expect(empty.tiles).toEqual([]);
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
    const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'console log');
    expect(audit.find((row) => row.action === 'platform.play_updated')?.description).toBe(
      "Play settings: members' tiles need 1000 questions; added G4Q15.",
    );

    // Back to the defaults: the list, then the depth.
    const reset = await unwrap<any>(await platform.request.post('/api/platform/play/reset-tiles'), 'default tiles');
    expect(reset.is_default).toBe(true);
    await unwrap(await platform.request.put('/api/platform/play', { data: { settings: start.settings, tiles: reset.tiles.map(shape) } }), 'depth back');
    await unwrap(await platform.request.post('/api/platform/play/reset-tiles'), 'default tiles again');
  });

  test('only a platform admin keeps the list', async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.get('/api/platform/play')).status()).toBe(403);
  });

  test('the console page adds a tile and saves', async ({ as }) => {
    const page = await as('platformAdmin', { org: null });
    await page.goto('/platform/settings');
    const section = page.getByTestId('play-settings');
    await expect(section.getByTestId('tile-G4T10')).toBeVisible();
    await section.getByLabel('How many').fill('7');
    await section.getByRole('button', { name: 'Add G4Q7' }).click();
    await expect(section.getByTestId('tile-G4Q7')).toBeVisible();
    await section.getByRole('button', { name: 'Save Play settings' }).click();
    await expect(page.getByText('Play settings saved.')).toBeVisible();
    await section.getByRole('button', { name: 'Default tiles' }).click();
    await expect(section.getByTestId('tile-G4Q7')).toHaveCount(0);
  });
});

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 69 (docs/member-home-plan.md H12, R30): stickiness, measured.
 * - Visit recording is the console's switch, refused while the published privacy notice does not cover it.
 * - The figures are totals: computed by the rollup (daily, or Recompute), groups under 5 left out.
 * - Only platform admins read them; a space's admin is refused.
 */
test.describe('Phase 69: the Stickiness page', () => {
  test('visit recording follows the published privacy notice; the figures are totals, for platform admins only', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });

    const visits = await unwrap<any>(await platform.request.get('/api/platform/visits'), 'visit settings');
    expect(visits.settings.record).toBe(false);
    expect(visits.needs_privacy_version).toBe('2026-11-04');
    // The published notice (2026-11-04) says visits are kept, so the switch may be turned on -- and off.
    expect(visits.may_record).toBe(true);
    const on = await unwrap<any>(await platform.request.put('/api/platform/visits', { data: { record: true } }), 'switch on');
    expect(on.settings.record).toBe(true);
    // A request inside a space is now a visit: it shows up as one person active this week.
    const member = await as('admin');
    expect((await member.request.get('/api/home')).status()).toBe(200);
    // The visit is written just after the response, so the figures are polled.
    await expect
      .poll(async () => {
        const figures = await unwrap<any>(await platform.request.post('/api/platform/stickiness/refresh'), 'with a visit');
        return figures.recording && figures.weekly_active >= 1;
      }, { timeout: 10_000 })
      .toBe(true);
    expect((await platform.request.put('/api/platform/visits', { data: { record: false } })).status()).toBe(200);

    const report = await unwrap<any>(await platform.request.post('/api/platform/stickiness/refresh'), 'the figures');
    expect(report.recording).toBe(false);
    expect(report.weekly).toHaveLength(13);
    expect(report.retention[0]).toMatchObject({ hat: 'all', space_kind: 'all', arrival: 'all' });
    // Totals only: no person, no space, anywhere in the figures.
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/user_id|organization_id|@/);
    // Every share under the minimum is withheld.
    for (const row of report.retention) {
      for (const week of Object.values<any>(row.weeks)) if (week.base < 5) expect(week.share).toBeNull();
    }
    expect((await unwrap<any>(await platform.request.get('/api/platform/stickiness'), 'stored')).computed_at).toBe(report.computed_at);

    // A space's admin is not a platform admin.
    const admin = await as('admin');
    expect((await admin.request.get('/api/platform/stickiness')).status()).toBe(403);
    expect((await admin.request.put('/api/platform/visits', { data: { record: false } })).status()).toBe(403);

    // The page: the switch waits for the notice, the tiles and the retention table.
    await platform.goto('/platform/stickiness');
    const page = platform.getByTestId('stickiness-page');
    await expect(page).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('stickiness-visits')).toContainText('Record visits: off');
    await expect(page.getByTestId('stickiness-visits-toggle')).toBeEnabled();
    await expect(page.getByTestId('stickiness-wau')).toBeVisible();
    await expect(page.getByTestId('stickiness-row-all-all-all')).toContainText('Everyone');
    await page.getByTestId('stickiness-refresh').click();
    await expect(platform.getByText('Figures recomputed.')).toBeVisible();
  });
});

import type { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { setCheckedQuestions } from '../support/checked-questions.js';

/**
 * Phase 63 (docs/stickiness-plan.md): guest play. P9 the reserved pool, P10 the guest Play home and
 * play on the device, P12 the sign-up offer, P14 /play/<code>, P15 anonymous counts, P16 the console.
 * Locally sign-in is off, so a "signed-out visitor" is a browser whose session read answers 401 --
 * the real config and the public pool route do the rest.
 *
 * Serial: the platform's guest switch and Grade 4's pool, set and put back.
 */
test.describe.configure({ mode: 'serial' });

const DEFAULTS = {
  enabled: false,
  assessment_enabled: false,
  assessment_questions: 5,
  nudge_after: 1,
  nudge_cooldown_hours: 24,
  nudge_right: 'Nice! That one is right.',
  nudge_wrong: 'Good try. Keep going!',
  home_bar: 'Save your scores and unlock every quest.',
};

/** Guest play off, then every level's pool emptied: switching guest play on fills each open level's. */
async function guestPlayOff(platform: { request: APIRequestContext }) {
  await unwrap(await platform.request.put('/api/platform/guest', { data: DEFAULTS }), 'guest play off');
  const now = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console');
  for (const pool of now.pools.filter((p: any) => p.size > 0)) {
    await unwrap(
      await platform.request.put(`/api/platform/guest/pools/${pool.level_id}`, { data: { level_id: pool.level_id, question_ids: [] } }),
      `clearing ${pool.level_id}`,
    );
  }
}

async function signedOut(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }) }),
  );
}

test.describe('guest play', () => {
  test('P16/P9: the console turns guest play on and sets a level\'s free questions; members never meet them', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const admin = await as('admin');
    // A clean start (a run that stopped early may have left guest play on).
    await guestPlayOff(platform);
    // Off: the public pool answers as a route that is not there.
    expect((await platform.request.get('/api/public/guest/0/NC26.4')).status()).toBe(404);

    const console0 = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console');
    expect(console0.settings.enabled).toBe(false);
    expect(console0.address_allows).toBe(true);
    expect(console0.pools.every((p: any) => p.size === 0)).toBe(true);
    // Switching it on is all it takes: every level with a tile open to guests gets the suggestion
    // (Grade 4, Grade 5, Beast Academy 3...), a level whose tiles are all locked (Pre-Algebra) none.
    const on = await unwrap<any>(await platform.request.put('/api/platform/guest', { data: { ...DEFAULTS, enabled: true } }), 'guest play on');
    const sizeOf = (level: string) => on.pools.find((p: any) => p.level_id === level).size;
    expect(sizeOf('NC26.4')).toBe(10);
    expect(sizeOf('NC26.5')).toBe(10);
    expect(sizeOf('BA3')).toBeGreaterThanOrEqual(5);
    expect(sizeOf('PRE')).toBe(0);
    // Grade 4's pool is measured from empty below.
    await unwrap(await platform.request.put('/api/platform/guest/pools/NC26.4', { data: { level_id: 'NC26.4', question_ids: [] } }), 'clearing Grade 4');

    // Members of a space drawing approved questions only: Grade 4's count before the pool.
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    await setCheckedQuestions(platform, 'chmi', false);
    const approvedAtG4 = async () =>
      (await unwrap<any[]>(await admin.request.get('/api/quest/games/levels'), 'levels')).find((l) => l.level_id === 'NC26.4').available;
    let ids: string[] = [];
    try {
      const before = await approvedAtG4();
      // Grade 4's pool from the suggestion: approved first, easy first.
      const pool = await unwrap<any>(await platform.request.get('/api/platform/guest/pools/NC26.4'), 'pool');
      expect(pool.suggestion.length).toBe(10);
      ids = pool.suggestion.map((q: any) => q.id);
      const approvedInPool = pool.suggestion.filter((q: any) => q.status === 'approved').length;
      expect(approvedInPool).toBe(Math.min(10, before));
      const saved = await unwrap<any>(await platform.request.put('/api/platform/guest/pools/NC26.4', { data: { level_id: 'NC26.4', question_ids: ids } }), 'saving');
      expect(saved.current.map((q: any) => q.id)).toEqual(ids);
      // Members never meet them: the approved-only count drops by the approved questions in the pool.
      expect(await approvedAtG4()).toBe(before - approvedInPool);
    } finally {
      await setCheckedQuestions(platform, 'chmi', true);
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }

    // R26: the config tells a visitor the tiles and settings; the pool carries only questions.
    const config = await unwrap<any>(await platform.request.get('/api/auth/config'), 'config');
    expect(config.guest.tiles.find((t: any) => t.code === 'G4Q5')).toMatchObject({ locked: false, words: 'Grade 4 · 5 questions' });
    expect(config.guest.tiles.find((t: any) => t.code === 'G4T10').locked).toBe(true);
    expect(config.guest.tiles.find((t: any) => t.code === 'G5Q5').locked).toBe(false); // filled when switched on
    const served = await unwrap<any>(await platform.request.get(`/api/public/guest/${config.guest.version}/NC26.4`), 'the pool');
    expect(served.questions.map((q: any) => q.id)).toEqual(ids);
    for (const q of served.questions) {
      expect(Object.keys(q).sort()).toEqual(['answer', 'beta', 'choices', 'difficulty', 'id', 'kind', 'solution', 'stem']);
    }
  });

  test('P10/P12: a visitor plays G4Q5 on the device, the offer pauses after question 1, and the results show', async ({ as }) => {
    const page = await as('student', { org: null });
    await signedOut(page);
    await page.goto('/');
    const home = page.getByTestId('guest-home');
    await expect(home).toBeVisible();
    await expect(page.getByTestId('guest-home-bar')).toHaveText('Save your scores and unlock every quest.');
    await expect(page.getByTestId('guest-band-signup')).toHaveText('Sign up free');

    // A locked tile offers an account.
    await home.getByTestId('guest-locked-G4T10').click();
    await expect(page.getByTestId('guest-nudge')).toContainText('10-minute challenge is free with an account');
    await page.getByTestId('guest-nudge-close').click();

    await home.getByTestId('guest-tile-G4Q5').click();
    await expect(page).toHaveURL(/\/play\/G4Q5$/);
    const question = page.getByTestId('guest-question');
    await expect(question).toBeVisible();
    await page.getByTestId('guest-skip').click();
    // After the first answer: the offer, which can be closed.
    await expect(page.getByTestId('guest-nudge')).toBeVisible();
    await expect(page.getByTestId('guest-nudge-signup')).toHaveText('Sign up free');
    await page.getByTestId('guest-nudge-close').click();
    for (let i = 0; i < 4; i += 1) await page.getByTestId('guest-skip').click();
    await expect(page.getByTestId('guest-results')).toBeVisible();
    await expect(page.getByTestId('guest-score')).toHaveText('0 of 5 right');

    // Play again: the other five, unseen first; the offer does not return the same day.
    await page.getByTestId('guest-again').click();
    for (let i = 0; i < 5; i += 1) await page.getByTestId('guest-skip').click();
    await expect(page.getByTestId('guest-nudge')).toHaveCount(0);
    await expect(page.getByTestId('guest-used-up')).toBeVisible();
  });

  test('P14/P15: /play/<code> opens a tile for a visitor; counts take a batch and refuse more', async ({ as }) => {
    const page = await as('student', { org: null });
    await signedOut(page);
    await page.goto('/play/G4Q5');
    await expect(page.getByTestId('guest-question')).toBeVisible();
    await page.goto('/play/NOTATILE');
    await expect(page.getByTestId('guest-home')).toBeVisible();

    const ok = await page.request.post('/api/public/events', { data: { events: [{ name: 'home_viewed', client: 'web' }] } });
    expect(ok.status()).toBe(204);
    const tooMany = await page.request.post('/api/public/events', {
      data: { events: Array.from({ length: 21 }, () => ({ name: 'home_viewed' })) },
    });
    expect(tooMany.status()).toBe(422);
    const unknown = await page.request.post('/api/public/events', { data: { events: [{ name: 'who_is_this', tile: 'x@y' }] } });
    expect(unknown.status()).toBe(422);
  });

  test('Quest board: grades 1-8, curricula never named, and Today\'s 5 played on the device', async ({ as }) => {
    const page = await as('student', { org: null });
    await signedOut(page);
    await page.goto('/');
    const home = page.getByTestId('guest-home');
    await expect(home).toBeVisible();
    await expect(home.getByRole('radio')).toHaveCount(8);
    await expect(home.getByRole('radio', { name: 'Grade 4' })).toHaveAttribute('aria-checked', 'true');

    // Grade 2: its own quest, then the advanced track's, named by grade alone.
    await home.getByRole('radio', { name: 'Grade 2' }).click();
    await expect(home.getByTestId('guest-tile-G2Q5')).toContainText('Quick 5');
    await expect(home.getByTestId('guest-tile-BA2Q5')).toContainText('Adv G2 · 5 questions');
    for (const grade of ['Grade 2', 'Grade 6', 'Grade 4']) {
      await home.getByRole('radio', { name: grade }).click();
      const text = await home.innerText();
      for (const name of ['Beast', 'AoPS', 'Prealgebra', 'Kangaroo', 'NC ', 'North Carolina', 'G4Q5', 'BA2']) expect(text).not.toContain(name);
    }
    await expect(page.getByTestId('guest-contact')).toHaveAttribute('href', 'mailto:om.ndessai@gmail.com');

    // Today's 5: five questions, untimed, then the card shows how it went.
    await expect(page.getByTestId('guest-today')).toContainText("Today's 5 · Grade 4");
    await page.getByTestId('guest-today-play').click();
    await expect(page).toHaveURL(/\/play\/today\/NC26\.4$/);
    await expect(page.getByTestId('guest-quest-name')).toHaveText("Today's 5 · Grade 4");
    await expect(page.getByTestId('guest-progress')).toHaveText('1 of 5');
    await page.getByTestId('guest-skip').click();
    if (await page.getByTestId('guest-nudge').isVisible()) await page.getByTestId('guest-nudge-close').click();
    for (let i = 0; i < 4; i += 1) await page.getByTestId('guest-skip').click();
    await expect(page.getByTestId('guest-score')).toHaveText('0 of 5 right');
    await expect(page.getByTestId('guest-results-name')).toHaveText("Today's 5 · Grade 4");
    await page.goto('/');
    await expect(page.getByTestId('guest-today')).toContainText('You hit 0 of 5 today.');
    await expect(page.getByTestId('guest-today-play')).toHaveText(/Play again/);
  });

  test('P11: a visitor takes G4A5 on the device: one page each, marked there, the work beside the key', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await unwrap(await platform.request.put('/api/platform/guest', { data: { ...DEFAULTS, enabled: true, assessment_enabled: true } }), 'guest assessment on');
    const page = await as('student', { org: null });
    await signedOut(page);
    let posted = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && !request.url().includes('/api/public/events')) posted += 1;
    });
    await page.goto('/play/G4A5');
    await expect(page.getByTestId('guest-assessment-page')).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      // A choice question is answered by choosing; a number question by typing it.
      if (await page.getByTestId('guest-assessment-choice-0').count()) await page.getByTestId('guest-assessment-choice-0').click();
      else await page.getByLabel('Your final answer').fill('7');
      await page.getByTestId('guest-assessment-next').click();
    }
    if (await page.getByTestId('guest-assessment-choice-0').count()) await page.getByTestId('guest-assessment-choice-0').click();
    else await page.getByLabel('Your final answer').fill('7');
    await page.getByTestId('guest-assessment-finish').click();
    await expect(page.getByTestId('guest-assessment-results')).toBeVisible();
    await expect(page.getByTestId('guest-assessment-score')).toContainText('of 5 right');
    // Nothing was sent but counts: no PDF, no row.
    expect(posted).toBe(0);
    await page.getByTestId('guest-assessment-keep').click();
    await expect(page.getByTestId('guest-nudge')).toContainText('A PDF of your work');
  });

  test('P13: signing up is a sheet over the page, then a splash -- no Welcome screen', async ({ as }) => {
    const page = await as('student', { org: null });
    await signedOut(page);
    await page.goto('/play/G4Q5');
    await page.getByTestId('guest-skip').click();
    await page.getByTestId('guest-nudge-signup').click();
    const sheet = page.getByTestId('signup-sheet');
    await expect(sheet).toBeVisible();
    const email = `guest-${Date.now().toString(36)}@example.com`;
    await sheet.getByTestId('signup-dev-email').fill(email);
    await sheet.getByTestId('signup-dev-name').fill('Gale Guest');
    await sheet.getByTestId('signup-dev-continue').click();
    await sheet.getByTestId('signup-month').click();
    await page.getByRole('option', { name: 'March' }).click();
    await sheet.getByTestId('signup-year').click();
    await page.getByRole('option', { name: '1990' }).click();
    await sheet.getByTestId('signup-accept').check();
    // Signed up, the session reads as signed in again (locally, the developer person).
    await page.unroute('**/api/auth/session');
    await sheet.getByTestId('signup-submit').click();
    await expect(page.getByTestId('signup-splash')).toBeVisible();
    // The account exists, with a personal space of its own.
    const platform = await as('platformAdmin', { org: null });
    const spaces = await unwrap<any[]>(await platform.request.get('/api/platform/organizations?personal=1'), 'with personal spaces');
    expect(spaces.some((space) => space.personal && space.name === "Gale's space")).toBe(true);
    // Hidden from the console's list by default.
    const listed = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the list');
    expect(listed.some((space) => space.personal)).toBe(false);
  });

  test('afterwards: guest play off and no level has free questions again', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await guestPlayOff(platform);
    const config = await unwrap<any>(await platform.request.get('/api/auth/config'), 'config');
    expect(config.guest).toBeUndefined();
  });
});

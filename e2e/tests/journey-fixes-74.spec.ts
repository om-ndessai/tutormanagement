import type { Page } from '@playwright/test';
import { PRACTISE_BEFORE_DAYS, PRIVACY_VERSION, TERMS_VERSION, practiseBefore } from '@tmi/shared';
import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 74 (docs/journey-fixes-plan.md): the first home.
 * - JF6: where Tutoring is off, the reader's hat leads -- a parent's child first, then the office of a space they help
 *   run (only what waits; one line when nothing does; open assessments counted), then the board. A learner who has
 *   not played gets three doors in the band and "Start a streak", never "0 of 3";
 * - JF23: when Next up offers the Daily (or Continue), the board's twin is quiet, and the New quest quick action is not
 *   shown beside the board's own;
 * - JF31: a parent's and a student's menu has no Users, Pairings or Billing (a link still opens them); where Tutoring is
 *   off, a student's record leaves out its lessons, places and comments;
 * - JF24: the Dashboard opens on the hat the home leads with, says "Viewing as", and remembers a choice per space;
 * - JF25: the tour is offered once per PERSON -- never again on a new browser -- and its offer sits in the home's flow;
 * - JF17: a lesson line names where it is; Practise before opens a week ahead, strictly under seven days.
 *
 * Serial: the space's Quest switch, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

const NOOR = '0d100000-0000-4000-8000-000000000003';

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

/** A learner nobody knows yet: a student the office adds, with a parent, past the wizard. */
async function freshLearner(admin: Page, tag: string): Promise<{ email: string; ids: string[] }> {
  const stamp = `${tag}.${Date.now().toString(36)}`;
  const parent = await unwrap<any>(
    await admin.request.post('/api/users', { data: { full_name: 'Pat Firsthome', email: `p74.parent.${stamp}@example.com`, roles: ['parent'] } }),
    'a parent',
  );
  const email = `p74.kid.${stamp}@example.com`;
  const kid = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: 'Kit Firsthome',
        email,
        roles: ['student'],
        guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
      },
    }),
    'a student',
  );
  return { email, ids: [kid.id, parent.id] };
}

/** A parent the office has just added, who has never signed in. */
async function newParent(admin: Page, label: string) {
  const email = `p74.tour.${label}.${Date.now()}@gmail.com`;
  const user = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: { full_name: `Tour ${label}`, email, roles: ['parent'], status: 'active', phone: '(919) 555-0174' },
    }),
    'adding a parent',
  );
  return { id: user.id as string, email };
}

/** Every game the reader left open is ended, so no other spec meets it. */
async function endOpenGames(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const { open } = await unwrap<any>(await page.request.get('/api/quest/games/open'), 'the open game');
    if (!open) return;
    const ended = await page.request.post(`/api/quest/games/${open.game_id}/end`);
    if (!ended.ok()) await page.request.post(`/api/quest/games/${open.game_id}/leave`);
  }
}

const plusDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The order of the home's hat sections, as rendered. */
async function sectionOrder(page: Page): Promise<string[]> {
  return page
    .getByTestId('member-home')
    .locator('[data-testid^="home-section-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace('home-section-', '')));
}

test.describe('Phase 74: the first home', () => {
  test('JF6 + JF31: Ines in her own space leads with her child, then the office (one line when nothing waits, open assessments counted), then the board', async ({
    as,
  }) => {
    test.setTimeout(150_000);
    const ines = await as('assessAdmin', { org: 'assess' });
    const home = await unwrap<any>(await ines.request.get('/api/home'), 'the home');
    expect(home.hats).toEqual(['parent', 'office', 'learner']);
    expect(home.focus).toBe('family');

    // The office's open assessments are counted on a memo of a minute: wait for whatever an earlier spec left.
    await expect
      .poll(async () => (await unwrap<any>(await ines.request.get('/api/home'), 'the home')).office.assessments_open, { timeout: 80_000, intervals: [3_000] })
      .toBe(0);

    await ines.goto('/');
    await expect(ines.getByTestId('member-home')).toBeVisible();
    const now = await unwrap<any>(await ines.request.get('/api/home'), 'the home');
    const waiting = now.office.join_requests + now.office.invitations + (now.office.assessments_open ?? 0);
    if (waiting === 0) {
      // Child, office, board -- in that order.
      expect(await sectionOrder(ines)).toEqual(['parent', 'office', 'learner']);
      await expect(ines.getByTestId('home-office-nothing')).toHaveText('Nothing needs you right now.');
    }
    // Never a zero row ("0 invitations not yet accepted").
    await expect(ines.getByTestId('home-section-office')).not.toContainText(/\b0 (invitation|asking|assessment)/);
    // Where Tutoring is off, the band says nothing about lessons.
    await expect(ines.getByTestId('home-strip')).not.toContainText(/lesson/i);

    // The child's card leads to the child, though a parent's menu would not.
    const open = ines.getByTestId(`home-child-open-${NOOR}`);
    await expect(open).toHaveAttribute('href', `/users?view=${NOOR}`);
    await open.click();
    const record = ines.getByRole('dialog');
    await expect(record.getByRole('heading', { name: /Noor/ })).toBeVisible();
    // Tutoring's fields and sections stay out of a space without it (R23).
    await expect(record).not.toContainText('Virtual sessions');
    await expect(record).not.toContainText('Longest session');
    await expect(record.getByRole('heading', { name: 'Locations' })).toHaveCount(0);
    await expect(record.getByRole('heading', { name: 'Comments' })).toHaveCount(0);
    await ines.keyboard.press('Escape');

    // An assessment submitted for Noor is counted in the office, linking to Assessments.
    const started = await unwrap<any>(
      await ines.request.post('/api/canvas-assessments', { data: { student_user_id: NOOR, level_id: 'NC26.4' } }),
      'starting an assessment',
    );
    try {
      await unwrap(await ines.request.post(`/api/canvas-assessments/${started.id}/submit`, { data: { pages: [] } }), 'submitting');
      await expect
        .poll(async () => (await unwrap<any>(await ines.request.get('/api/home'), 'the home')).office.assessments_open, { timeout: 80_000, intervals: [3_000] })
        .toBe(1);
      await ines.goto('/');
      const row = ines.getByTestId('home-office-assessments');
      await expect(row).toContainText('1');
      await expect(row).toContainText('assessment submitted, to look at');
      await expect(row).toHaveAttribute('href', '/assessments');
      await expect(ines.getByTestId('home-office-nothing')).toHaveCount(0);
    } finally {
      // Looked at: reviewed, so it waits for nobody.
      await ines.request.put(`/api/canvas-assessments/${started.id}/review`, { data: { notes: {}, comment: '', ink: [] } });
      await ines.request.post(`/api/canvas-assessments/${started.id}/review/finish`, { data: {} });
    }
  });

  test('JF6 + JF16 + JF23: an adult who has not played gets three doors and "Start a streak"; the board quiets its twins', async ({ page, as }) => {
    const email = `p74.newcomer.${Date.now()}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: 'Nell Newcomer',
          birth_year: 1984,
          birth_month: 6,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      'the newcomer signs up',
    );
    const outside = await as('admin', { email, org: null });
    try {
      const session = await unwrap<any>(await outside.request.get('/api/auth/session'), 'session');
      const personal = session.memberships.find((m: any) => m.personal) ?? session.memberships[0];
      const nell = await as('admin', { email, org: personal.slug });
      expect((await unwrap<any>(await nell.request.get('/api/quest/me/habit'), 'habit')).played_before).toBe(false);

      await nell.goto('/');
      const band = nell.getByTestId('home-band');
      await expect(band.getByTestId('home-doors')).toBeVisible();
      await expect(band.getByTestId('home-door-play')).toHaveText('Play');
      await expect(band.getByTestId('home-door-code')).toHaveText('Join with a code');
      await expect(band.getByTestId('home-door-start')).toHaveAttribute('href', '/spaces#start');
      await expect(nell.getByTestId('home-strip')).toContainText('Start a streak');
      // Never a zero first.
      await expect(nell.getByTestId('member-home')).not.toContainText(/\b0 of 3\b/);

      // Join with a code opens the one code sheet.
      await band.getByTestId('home-door-code').click();
      await expect(nell.getByTestId('code-sheet')).toBeVisible();
      await nell.keyboard.press('Escape');
      await expect(nell.getByTestId('code-sheet')).toHaveCount(0);

      // The board carries its own New Quest: no New quest quick action beside it; the band's door is the one way to
      // the code sheet, so no quick "Have a code?" either.
      await expect(nell.getByTestId('play-home')).toBeVisible();
      await expect(nell.getByTestId('quick-new_quest')).toHaveCount(0);
      await expect(nell.getByTestId('quick-join_code')).toHaveCount(0);

      // Next up offers the Daily, so the board's Daily is the quiet twin: no amber, full-width button.
      const tiles = await unwrap<any>(await nell.request.get('/api/quest/tiles'), 'tiles');
      if (tiles.daily) {
        await expect(nell.getByTestId('next-up-daily')).toBeVisible();
        await expect(nell.getByTestId('play-daily')).toHaveAttribute('data-quiet', 'true');
        await expect(nell.getByTestId('play-daily-play')).not.toHaveClass(/bg-warning/);
      }

      // A game left open: Next up continues it, and the board's Continue is quiet.
      const level = tiles.tiles.find((t: any) => t.kind === 'quest')?.level_id ?? 'NC26.4';
      const game = await unwrap<any>(
        await nell.request.post('/api/quest/games', { data: { level_id: level, mode: 'count', question_count: 3, players: 'single', max_team_size: 1 } }),
        'a game',
      );
      try {
        await nell.goto('/');
        await expect(nell.getByTestId('next-up-open_game')).toBeVisible({ timeout: 15_000 });
        await expect(nell.getByTestId('play-continue')).toHaveAttribute('data-quiet', 'true');
      } finally {
        await nell.request.post(`/api/quest/games/${game.id}/end`);
        await endOpenGames(nell);
      }
    } finally {
      await outside.request.delete('/api/auth/account');
    }
  });

  test("JF31: a parent's and a student's menu has no Users, Pairings or Billing; a link still opens Users", async ({ as }) => {
    for (const who of ['parent', 'student'] as const) {
      const page = await as(who);
      await page.goto('/');
      const menu = page.getByRole('navigation', { name: 'Main' });
      await expect(menu.getByRole('link', { name: 'Home' })).toBeVisible();
      for (const name of ['Users', 'Pairings', 'Billing']) await expect(menu.getByRole('link', { name, exact: true })).toHaveCount(0);
      await page.goto('/users');
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    }
    // Admins and tutors keep them.
    const tutor = await as('tutor');
    await tutor.goto('/');
    const menu = tutor.getByRole('navigation', { name: 'Main' });
    for (const name of ['Users', 'Pairings', 'Billing']) await expect(menu.getByRole('link', { name, exact: true })).toBeVisible();
  });

  test('JF24: Maria’s Dashboard opens on Parent, says "Viewing as", and remembers a choice for the space', async ({ as }) => {
    const maria = await as('parentTutor');
    await maria.goto('/');
    await expect(maria.getByTestId('home-section-parent')).toBeVisible();
    const menu = maria.getByRole('navigation', { name: 'Main' });

    await menu.getByRole('link', { name: 'Dashboard' }).click();
    const viewing = maria.getByTestId('dashboard-viewing-as');
    await expect(viewing).toContainText('Viewing as');
    await expect(maria.getByLabel('Dashboard role')).toHaveText('Parent');
    await expect(maria.getByText('Your children')).toBeVisible();
    await expect(maria.getByTestId('member-home')).toHaveCount(0);

    // Tutor, chosen: kept for this space on this device.
    await maria.getByLabel('Dashboard role').click();
    await maria.getByRole('option', { name: 'Tutor' }).click();
    await expect(maria).toHaveURL(/role=tutor/);
    await menu.getByRole('link', { name: 'Home' }).click();
    await expect(maria.getByTestId('member-home')).toBeVisible();
    await menu.getByRole('link', { name: 'Dashboard' }).click();
    await expect(maria.getByLabel('Dashboard role')).toHaveText('Tutor');
    await maria.goto('/dashboard');
    await expect(maria.getByLabel('Dashboard role')).toHaveText('Tutor');
  });

  test('JF25: the tour is offered once per person -- closing it does not bring an offer back, and a new browser offers nothing', async ({ as }) => {
    const admin = await as('admin');
    const parent = await newParent(admin, 'once');
    try {
      const first = await as('parent', { fresh: true, email: parent.email });
      await first.goto('/');
      const wizard = first.getByTestId('onboarding-wizard');
      await expect(wizard).toBeVisible();
      await expect(wizard).toContainText('A quick tour');
      await expect(wizard).not.toContainText('portal');
      await wizard.getByRole('button', { name: 'Skip for now' }).click();
      await expect(wizard).toHaveCount(0);
      // Not offered again straight after (it used to come back at once).
      await expect(first.getByTestId('member-home')).toBeVisible();
      await expect(first.getByTestId('home-tour-offer')).toHaveCount(0);
      await expect(first.getByRole('dialog')).toHaveCount(0);

      // Another browser, the same person: neither the wizard nor an offer.
      const second = await as('parent', { fresh: true, email: parent.email });
      await second.goto('/');
      await expect(second.getByTestId('member-home')).toBeVisible();
      await expect(second.getByTestId('onboarding-wizard')).toHaveCount(0);
      await expect(second.getByTestId('home-tour-offer')).toHaveCount(0);
      await expect(second.getByRole('dialog')).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });

  test('JF25: someone who has been through it, opening a space for the first time, is offered it on the home, in its flow, once', async ({ as }) => {
    const admin = await as('admin');
    const parent = await newParent(admin, 'inline');
    try {
      const first = await as('parent', { fresh: true, email: parent.email });
      // Been through it (elsewhere, say) before ever opening this space.
      await unwrap(await first.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
      await first.goto('/');
      const offer = first.getByTestId('member-home').getByTestId('home-tour-offer');
      await expect(offer).toBeVisible();
      await expect(offer).toContainText('Welcome to CHMI');
      await expect(offer.getByRole('button', { name: 'Take the tour' })).toBeVisible();
      // A card in the page, not a layer over it.
      await expect(first.getByRole('dialog')).toHaveCount(0);
      expect(await offer.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed');

      await offer.getByRole('button', { name: 'No thanks' }).click();
      await expect(offer).toHaveCount(0);
      await first.reload();
      await expect(first.getByTestId('member-home')).toBeVisible();
      await expect(first.getByTestId('home-tour-offer')).toHaveCount(0);

      const second = await as('parent', { fresh: true, email: parent.email });
      await second.goto('/');
      await expect(second.getByTestId('member-home')).toBeVisible();
      await expect(second.getByTestId('home-tour-offer')).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });

  test('JF17: lesson lines say where -- Sofia’s next lesson, and her mother’s card', async ({ as }) => {
    const sofia = await as('student');
    const home = await unwrap<any>(await sofia.request.get('/api/home'), 'the home');
    expect(home.learner.next_lesson.place).toEqual({ name: 'Institute, room 2', kind: 'physical' });
    // A name only: never an address or a link (R16, R29).
    expect(Object.keys(home.learner.next_lesson.place).sort()).toEqual(['kind', 'name']);
    await sofia.goto('/');
    await expect(sofia.getByTestId('member-home')).toContainText('with Alex · Institute, room 2');

    const maria = await as('parentTutor');
    await maria.goto('/');
    const sofiaId = await idOf(maria, PEOPLE.student.email);
    await expect(maria.getByTestId(`home-child-place-${sofiaId}`)).toContainText('Institute, room 2');
  });

  test('JF17: Practise before shows for a lesson 5 days away, not for one exactly 7 days away; the lesson line opens practice', async ({ as }) => {
    // The window, as the shared rule has it.
    const today = '2026-11-05';
    expect(PRACTISE_BEFORE_DAYS).toBe(7);
    expect(practiseBefore({ occurs_on: plusDays(today, 5), starts_in: 5 * 1440 }, today)).toBe(true);
    expect(practiseBefore({ occurs_on: plusDays(today, 6), starts_in: 6 * 1440 }, today)).toBe(true);
    expect(practiseBefore({ occurs_on: plusDays(today, 7), starts_in: 7 * 1440 }, today)).toBe(false);

    const admin = await as('admin');
    await questOn(admin, true);
    const fresh = await freshLearner(admin, 'practise');
    const kit = await as('student', { email: fresh.email });
    await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
    try {
      await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 5 } }), 'Grade 5');
      // A lesson `days` ahead, put into the home as the server would send it (the seed's lessons fall on fixed weekdays).
      let days = 5;
      await kit.route('**/api/home', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        const occurs = plusDays(body.data.day, days);
        body.data.learner.next_lesson = {
          schedule_id: '70000000-0000-4000-8000-0000000000aa',
          occurs_on: occurs,
          start_time: '16:00',
          end_time: '17:00',
          mode: 'in_person',
          student_user_id: fresh.ids[0],
          student_name: 'Kit Firsthome',
          tutor_user_id: '00000000-0000-4000-8000-000000000003',
          tutor_name: 'Alex Chen',
          starts_in: days * 1440,
          place: { name: 'Institute, room 2', kind: 'physical' },
        };
        await route.fulfill({ response, json: body });
      });

      await kit.goto('/');
      const practise = kit.getByTestId('next-up-practise_before');
      await expect(practise).toBeVisible({ timeout: 15_000 });
      await expect(practise).toContainText('with Alex · Institute, room 2');

      days = 7;
      await kit.reload();
      await expect(kit.getByTestId('next-up')).toBeVisible({ timeout: 15_000 });
      await expect(kit.getByTestId('member-home')).toContainText('with Alex · Institute, room 2');
      await expect(kit.getByTestId('next-up-practise_before')).toHaveCount(0);

      // The lesson line opens practice for it (Quest is on): from the learner's card, or from Next up's lesson.
      const line = kit.getByTestId('home-learner-practise');
      if (await line.count()) await line.click();
      else await kit.getByTestId('next-up-practise').click();
      await expect(kit).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/, { timeout: 15_000 });
    } finally {
      await endOpenGames(kit);
      for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}`);
      await questOn(admin, false);
    }
  });
});

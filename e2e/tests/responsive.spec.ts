import type { Locator, Page } from '@playwright/test';
import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * No page may scroll sideways on a phone.
 *
 * This is asserted rather than eyeballed because the failure is easy to
 * reintroduce and hard to notice: one control with a fixed width in a row that
 * cannot wrap pushes the whole document wider, and every card on the page then
 * runs off the right edge.
 */
const PAGES = ['/', '/dashboard', '/dashboard?tab=finance', '/users', '/assignments', '/sessions', '/sessions?tab=finance', '/schedule', '/locations', '/billing', '/comments', '/activity', '/profile'];

// iPhone-class width, and a narrow Android for good measure.
const WIDTHS = [390, 360];

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ as }) => {
        const page = await as('admin');
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);

        // Wait for data, so the assertion covers rendered rows rather than
        // an empty shell.
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth - doc.clientWidth;
        });

        expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
      });
    }
  });
}

// Choosing an organization, and the platform console, are outside any one
// organization: the picker for someone in two, the console for its admin.
const OUTSIDE: { who: 'admin' | 'platformAdmin'; path: string }[] = [
  { who: 'admin', path: '/spaces' },
  { who: 'platformAdmin', path: '/platform' },
  { who: 'platformAdmin', path: '/platform/admins' },
  { who: 'platformAdmin', path: '/platform/people' },
  { who: 'platformAdmin', path: '/platform/activity' },
  // Phase 36: the question bank, with the repository's questions and their maths.
  { who: 'platformAdmin', path: '/platform/questions' },
  { who: 'platformAdmin', path: '/platform/questions/NC26.M1.ANFR.1' },
  { who: 'platformAdmin', path: '/platform/questions/review' },
  { who: 'platformAdmin', path: '/platform/ai' },
];
for (const width of WIDTHS) {
  for (const { who, path } of [...OUTSIDE, { who: 'admin' as const, path: '/organization' }]) {
    test(`${path} does not scroll sideways at ${width}px`, async ({ as }) => {
      const page = await as(who, path === '/organization' ? {} : { org: null });
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
    });
  }
}

// Phase 35: an organization offering several curricula -- the Organization
// page's Curricula card with three rows, and the plan dialog's pickers with a
// curriculum switch and a standard's description under its name.
for (const width of WIDTHS) {
  test(`several curricula do not scroll sideways at ${width}px`, async ({ as }) => {
    const page = await as('orgBAdmin', { org: 'riverside' });
    await page.setViewportSize({ width, height: 844 });
    const overflow = () =>
      page.evaluate(() => {
        const doc = document.documentElement;
        const dialog = document.querySelector('[role="dialog"]');
        return Math.max(doc.scrollWidth - doc.clientWidth, dialog ? dialog.scrollWidth - dialog.clientWidth : 0);
      });

    await page.goto('/organization');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('curricula-card')).toBeVisible();
    expect(await overflow(), `/organization at ${width}px`).toBeLessThanOrEqual(0);

    const users = await (await page.request.get('/api/users?search=Lily')).json();
    await page.goto(`/progress/${users.data[0].id}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Edit plan' }).first().click();
    await expect(page.getByRole('dialog').getByTestId('curriculum-switch')).toBeVisible();
    expect(await overflow(), `the plan dialog at ${width}px`).toBeLessThanOrEqual(0);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Edit assessment' }).first().click();
    await expect(page.getByRole('dialog').getByText('Topic ratings')).toBeVisible();
    expect(await overflow(), `the assessment dialog at ${width}px`).toBeLessThanOrEqual(0);
  });
}

// The dashboard's sessions carousel scrolls sideways inside itself; the page
// around it must not, for a tutor as much as for an admin.
for (const width of WIDTHS) {
  test(`a tutor's dashboard does not scroll sideways at ${width}px`, async ({ as }) => {
    const page = await as('tutor');
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  });
}

test('the users directory switches to cards on a phone', async ({ as }) => {
  const page = await as('admin');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/users');
  await page.waitForLoadState('networkidle');

  // The table is hidden below md; the same people appear as cards, with the
  // actions menu reachable rather than scrolled off to the right.
  await expect(page.locator('table')).toBeHidden();
  await expect(page.getByRole('button', { name: /Actions for/ }).first()).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('table')).toBeVisible();
});

/*
 * Phase 78 (docs/journey-fixes-plan.md, JF28's rest; docs/userjourney/recommendations.md "Phone-width layouts break
 * on a dozen screens"): the screens the journeys found broken on a phone, at 390px and 360px -- the finished game's
 * results, a parent's Dashboard, the guest page signed out, /quest, the Daily, the New Quest wizard, Assessments,
 * Add a person -> A family, Invite, and the requests to join on People -- each with no sideways scroll, and the
 * element checks the audit asked for: the Activity filters never overlap, names and emails are never cut, the
 * countdown stays inside the screen, and a chosen Grade 8 is scrolled into view.
 *
 * Serial: the institute's Quest switch and the platform's guest switch, changed and put back.
 */
type Box = { left: number; top: number; right: number; bottom: number };

/** How far the page, or an open dialog, scrolls sideways. */
async function sideways(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const dialog = document.querySelector('[role="dialog"]');
    return Math.max(doc.scrollWidth - doc.clientWidth, dialog ? dialog.scrollWidth - dialog.clientWidth : 0);
  });
}

/**
 * Every box inside `root` that holds text of its own and is narrower than that text: a name or an email cut with an
 * ellipsis, or spilling out, at this width. Scrollers (a carousel) and screen-reader-only text are not boxes a reader sees cut.
 */
async function cutText(root: Locator): Promise<string[]> {
  return root.evaluate((element) =>
    [element, ...Array.from(element.querySelectorAll('*'))]
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.clientWidth > 2)
      .filter((el) => Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''))
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.display !== 'inline' && style.overflowX !== 'auto' && style.overflowX !== 'scroll' && el.scrollWidth > el.clientWidth + 1;
      })
      .map((el) => (el.textContent ?? '').trim().slice(0, 60)),
  );
}

/** Whether a box lies inside the viewport's width. */
async function insideWidth(page: Page, target: Locator): Promise<{ box: Box; width: number }> {
  const box = await target.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
  return { box, width: await page.evaluate(() => window.innerWidth) };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

async function questOn(admin: Page, on: boolean) {
  expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

/** A learner with a parent, made for this spec and removed after it, so no other spec meets their games. */
async function freshLearner(admin: Page, width: number): Promise<{ email: string; ids: string[] }> {
  const stamp = `${width}.${Date.now().toString(36)}`;
  const parent = await unwrap<any>(
    await admin.request.post('/api/users', { data: { full_name: 'Pat Narrow', email: `p78.parent.${stamp}@example.com`, roles: ['parent'] } }),
    'a parent',
  );
  const email = `p78.kid.${stamp}@example.com`;
  const kid = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: { full_name: 'Kit Narrow', email, roles: ['student'], guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }] },
    }),
    'a student',
  );
  return { email, ids: [kid.id, parent.id] };
}

async function signedOut(page: Page) {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } }) }),
  );
}

test.describe('Phase 78: the screens a phone reader met', () => {
  test.describe.configure({ mode: 'serial' });

  for (const width of WIDTHS) {
    test(`a learner's Quest pages, a game's countdown and its results at ${width}px`, async ({ as }) => {
      test.setTimeout(90_000);
      const admin = await as('admin');
      await questOn(admin, true);
      const fresh = await freshLearner(admin, width);
      const kit = await as('student', { email: fresh.email });
      await kit.setViewportSize({ width, height: 844 });
      await unwrap(await kit.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
      const games: string[] = [];
      try {
        // The board, led by Grade 8: its chip is scrolled into view, not left past the edge.
        await unwrap(await kit.request.put('/api/quest/grade', { data: { grade: 8 } }), 'Grade 8');
        await kit.goto('/');
        await expect(kit.getByTestId('play-home')).toBeVisible();
        const chip = kit.getByTestId('play-grade-8');
        await expect(chip).toHaveAttribute('aria-checked', 'true');
        await expect
          .poll(async () => {
            const { box, width: w } = await insideWidth(kit, chip);
            return box.left >= 0 && box.right <= w;
          }, { message: `the chosen Grade 8 chip in view at ${width}px` })
          .toBe(true);
        expect(await sideways(kit), `the Quest board at ${width}px`).toBeLessThanOrEqual(0);

        for (const path of ['/quest', '/quest/daily/NC26.8', '/quest/games/new']) {
          await kit.goto(path);
          await kit.waitForLoadState('networkidle');
          expect(await sideways(kit), `${path} at ${width}px`).toBeLessThanOrEqual(0);
        }

        // A lobby the learner hosts, started on the page: "Get ready" and every number stay inside the screen.
        const lobby = await unwrap<any>(
          await kit.request.post('/api/quest/games', {
            data: { level_id: 'NC26.8', mode: 'count', question_count: 2, players: 'multi', max_team_size: 1, host_plays: true },
          }),
          'a lobby',
        );
        games.push(lobby.id);
        await kit.goto(`/quest/games/${lobby.id}`);
        await expect(kit.getByTestId('game-start')).toBeEnabled();
        expect(await sideways(kit), `the lobby at ${width}px`).toBeLessThanOrEqual(0);
        await kit.getByTestId('game-start').click();
        const count = kit.getByTestId('game-countdown-number');
        await expect(count).toBeVisible();
        // Each number pops in from a faded scale(2.2) and settles at its own size within a quarter of a second, so the
        // box measured is the settled one: its layout width about the same centre (a scale keeps the centre).
        const box = await count.evaluate((el: HTMLElement) => {
          const rect = el.getBoundingClientRect();
          const centre = rect.left + rect.width / 2;
          return { left: centre - el.offsetWidth / 2, right: centre + el.offsetWidth / 2 };
        });
        const w = await kit.evaluate(() => window.innerWidth);
        expect(box.left, `the countdown's left edge at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(box.right, `the countdown's right edge at ${width}px`).toBeLessThanOrEqual(w);

        // Played to the end (each question skipped), then its results.
        await kit.waitForTimeout(5_500);
        for (let i = 0; i < 2; i += 1) {
          const view = await unwrap<any>(await kit.request.get(`/api/quest/games/${lobby.id}`), 'the game');
          if (view.status === 'finished' || !view.me?.question) break;
          await unwrap(await kit.request.post(`/api/quest/games/${lobby.id}/answer`, { data: { question_id: view.me.question.id, skip: true } }), 'a skip');
        }
        await kit.goto(`/quest/games/${lobby.id}`);
        await expect(kit.getByTestId('game-winner')).toBeVisible({ timeout: 15_000 });
        await kit.waitForLoadState('networkidle');
        expect(await sideways(kit), `the game's results at ${width}px`).toBeLessThanOrEqual(0);
        expect(await cutText(kit.locator('body')), `nothing cut on the results at ${width}px`).toEqual([]);
      } finally {
        for (const id of games) await kit.request.post(`/api/quest/games/${id}/end`);
        for (const id of fresh.ids) await admin.request.delete(`/api/users/${id}?hard=true`);
        await questOn(admin, false);
      }
    });

    test(`the guest page, signed out, at ${width}px`, async ({ as }) => {
      const platform = await as('platformAdmin', { org: null });
      const before = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console');
      await unwrap(await platform.request.put('/api/platform/guest', { data: { ...before.settings, enabled: true } }), 'guest play on');
      const visitor = await as('student');
      try {
        await signedOut(visitor);
        await visitor.setViewportSize({ width, height: 844 });
        await visitor.goto('/');
        await expect(visitor.getByTestId('guest-home')).toBeVisible();
        await visitor.waitForLoadState('networkidle');
        expect(await sideways(visitor), `the guest page at ${width}px`).toBeLessThanOrEqual(0);

        // Grade 8 chosen, then the page opened again: its chip is in view.
        await visitor.getByTestId('guest-grade-8').click();
        await visitor.reload();
        const chip = visitor.getByTestId('guest-grade-8');
        await expect(chip).toHaveAttribute('aria-checked', 'true');
        await expect
          .poll(async () => {
            const { box, width: w } = await insideWidth(visitor, chip);
            return box.left >= 0 && box.right <= w;
          }, { message: `the guest's Grade 8 chip in view at ${width}px` })
          .toBe(true);
      } finally {
        await unwrap(await platform.request.put('/api/platform/guest', { data: before.settings }), 'guest play back');
        // Switching guest play on filled every empty pool, and a pool is reserved from members' draws even while
        // guest play is off: empty again the ones that were empty, or a later file's game finds the level short.
        const wasEmpty = new Set(before.pools.filter((p: any) => p.size === 0).map((p: any) => p.level_id));
        const now = await unwrap<any>(await platform.request.get('/api/platform/guest'), 'guest console after');
        for (const pool of now.pools.filter((p: any) => p.size > 0 && wasEmpty.has(p.level_id))) {
          await unwrap(
            await platform.request.put(`/api/platform/guest/pools/${pool.level_id}`, { data: { level_id: pool.level_id, question_ids: [] } }),
            `clearing ${pool.level_id}`,
          );
        }
      }
    });

    test(`a parent's Dashboard, and the Activity filters, at ${width}px`, async ({ as }) => {
      const parent = await as('parent');
      await parent.setViewportSize({ width, height: 844 });
      await parent.goto('/dashboard');
      await parent.waitForLoadState('networkidle');
      expect(await sideways(parent), `a parent's /dashboard at ${width}px`).toBeLessThanOrEqual(0);

      const admin = await as('admin');
      await admin.setViewportSize({ width, height: 844 });
      await admin.goto('/activity');
      await admin.waitForLoadState('networkidle');
      const boxes: Box[] = [];
      for (const id of ['#who', '#what', '#from', '#to']) {
        const { box, width: w } = await insideWidth(admin, admin.locator(id));
        expect(box.right, `${id} inside the screen at ${width}px`).toBeLessThanOrEqual(w);
        boxes.push(box);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(overlaps(boxes[i]!, boxes[j]!), `Activity filters ${i} and ${j} overlap at ${width}px`).toBe(false);
        }
      }
    });

    test(`Assessments, Add a person -> A family, Invite and the requests to join at ${width}px`, async ({ as }) => {
      const ines = await as('assessAdmin', { org: ORGS.c.slug });
      await ines.setViewportSize({ width, height: 844 });
      await ines.goto('/assessments');
      await ines.waitForLoadState('networkidle');
      expect(await sideways(ines), `/assessments at ${width}px`).toBeLessThanOrEqual(0);

      // A request to join, with a note: the name, the address and the note are never cut.
      const sofia = await as('student');
      await unwrap(
        await sofia.request.post('/api/spaces/join-requests', { data: { code: 'FMXY2345', role: 'parent', note: 'I would like to help my sister practise.' } }),
        'asking to join',
      );
      // Long enough to be cut beside two buttons, short enough for the search's LIKE (D1 caps a pattern at 50 bytes).
      const email = `p78.invited.${width}.${Date.now().toString(36)}@example.com`;
      try {
        await ines.goto('/users');
        await ines.waitForLoadState('networkidle');
        const requests = ines.getByTestId('join-requests');
        await expect(requests).toContainText('Sofia Okafor');
        expect(await sideways(ines), `the requests to join at ${width}px`).toBeLessThanOrEqual(0);
        expect(await cutText(requests), `nothing cut in the requests at ${width}px`).toEqual([]);

        // Add a person -> A family.
        await ines.getByTestId('users-add').click();
        await ines.getByTestId('add-choice-family').click();
        await expect(ines.getByTestId('add-person')).toBeVisible();
        expect(await sideways(ines), `Add a person -> A family at ${width}px`).toBeLessThanOrEqual(0);
        await ines.keyboard.press('Escape');
        await expect(ines.getByTestId('add-person')).toHaveCount(0);

        // Invite, with a long address: the invited row keeps it whole, and its buttons on the screen.
        await ines.getByTestId('users-add').click();
        await ines.getByTestId('add-choice-invite').click();
        const step = ines.getByTestId('invite-step');
        await step.getByTestId('invite-email-0').fill(email);
        expect(await sideways(ines), `Invite at ${width}px`).toBeLessThanOrEqual(0);
        await step.getByTestId('invite-send').click();
        const sent = step.getByTestId(`invite-sent-${email}`);
        await expect(sent).toBeVisible();
        expect(await sideways(ines), `the invited row at ${width}px`).toBeLessThanOrEqual(0);
        expect(await cutText(sent), `nothing cut in the invited row at ${width}px`).toEqual([]);
      } finally {
        await sofia.request.delete('/api/spaces/join-requests/assess');
        const rows = await unwrap<any[]>(await ines.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'the invited');
        if (rows[0]?.id) await ines.request.delete(`/api/users/${rows[0].id}?hard=true`);
      }
    });
  }
});

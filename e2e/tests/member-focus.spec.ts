import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 68 (docs/member-home-plan.md H4, H10): focus and families.
 * - "Make this my home": a person pins what leads their home (only a choice they have), or goes back to
 *   automatic; the pinned hat's section comes first.
 * - Arrival: a newcomer who came from the guest Assessment gets an assessment-led home.
 * - A parent's child card: this week's days played and today's Daily (counts only, R29), and "Play with
 *   <child>", a game with the child invited.
 *
 * Serial: the space's Quest switch, changed and put back.
 */
test.describe.configure({ mode: 'serial' });

async function questOn(page: Page, on: boolean) {
  expect((await page.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } })).status()).toBe(200);
}

test.describe('Phase 68: focus and families', () => {
  test('a pin leads the home; a choice one does not have is refused; Automatic undoes it', async ({ as }) => {
    const parentTutor = await as('parentTutor');
    const before = await unwrap<any>(await parentTutor.request.get('/api/home'), 'the home');
    expect(before.pin).toBeNull();
    expect(before.focus_options).toContain('family');
    expect(before.focus_options).not.toContain('office');

    // A focus this person does not have here is refused, and nothing is stored.
    const refused = await parentTutor.request.put('/api/home/pin', { data: { focus: 'office' } });
    expect(refused.status()).toBe(422);
    expect((await parentTutor.request.put('/api/home/pin', { data: { focus: 'nonsense' } })).status()).toBe(422);

    try {
      // Pinned "My children": the family section comes first, whatever today holds.
      await parentTutor.goto('/');
      const home = parentTutor.getByTestId('member-home');
      await expect(home).toBeVisible({ timeout: 15_000 });
      await home.getByTestId('home-pin-family').click();
      await expect(home.getByTestId('home-pin-family')).toHaveAttribute('aria-checked', 'true');
      const pinned = await unwrap<any>(await parentTutor.request.get('/api/home'), 'the pinned home');
      expect(pinned.pin).toBe('family');
      expect(pinned.focus).toBe('family');
      const first = home.locator('[data-testid^="home-section-"]').first();
      await expect(first).toHaveAttribute('data-testid', 'home-section-parent');

      // Automatic again.
      await home.getByTestId('home-pin-auto').click();
      await expect(home.getByTestId('home-pin-auto')).toHaveAttribute('aria-checked', 'true');
      expect((await unwrap<any>(await parentTutor.request.get('/api/home'), 'the home')).pin).toBeNull();
    } finally {
      await parentTutor.request.put('/api/home/pin', { data: { focus: null } });
    }
  });

  test('a newcomer from the guest Assessment lands on an assessment-led home', async ({ page, as }) => {
    const email = `ada.arrival.${Date.now()}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: 'Ada Arrival',
          birth_year: 1985,
          birth_month: 3,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          arrived_via: 'guest_assessment',
        },
      }),
      'the newcomer signs up',
    );
    const outside = await as('admin', { email, org: null });
    try {
      const session = await unwrap<any>(await outside.request.get('/api/auth/session'), 'session');
      const personal = session.memberships.find((m: any) => m.personal) ?? session.memberships[0];
      const ada = await as('admin', { email, org: personal.slug });
      const home = await unwrap<any>(await ada.request.get('/api/home'), 'the home');
      expect(home.focus).toBe('assessment');
      expect(home.pin).toBeNull();

      // Assessments come before the Quest board.
      await ada.goto('/');
      const learner = ada.getByTestId('home-section-learner');
      await expect(learner.getByTestId('assessment-home')).toBeVisible({ timeout: 15_000 });
      await expect(learner.getByTestId('play-home')).toBeVisible();
      const order = await learner.evaluate((el) => {
        const a = el.querySelector('[data-testid="assessment-home"]');
        const p = el.querySelector('[data-testid="play-home"]');
        return a && p ? Boolean(a.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
      });
      expect(order).toBe(true);

      // An unknown arrival word is refused at sign-up (the schema's enum).
      const bad = await page.request.post('/api/auth/signup', {
        data: {
          dev_email: `x.${email}`,
          birth_year: 1985,
          birth_month: 3,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          arrived_via: 'facebook_ad',
        },
      });
      expect(bad.status()).toBe(422);
    } finally {
      await outside.request.delete('/api/auth/account');
    }
  });

  test("a parent sees a child's days played and plays with them; Quest off, neither", async ({ as }) => {
    const admin = await as('admin');
    const parent = await as('parent');
    await questOn(admin, true);
    let gameId: string | null = null;
    try {
      const home = await unwrap<any>(await parent.request.get('/api/home'), 'the home');
      const child = home.parent.children[0];
      expect(typeof child.days_played_this_week).toBe('number');
      expect(typeof child.daily_done_today).toBe('boolean');
      // Counts only: no score, no answer, no badge (R29).
      expect(Object.keys(child)).not.toContain('score');

      await parent.goto('/');
      const card = parent.getByTestId(`home-child-${child.student_user_id}`);
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.getByTestId(`home-child-played-${child.student_user_id}`)).toContainText(/this week/);
      await card.getByTestId(`home-child-play-${child.student_user_id}`).click();
      await expect(parent).toHaveURL(/\/quest\/games\/[0-9a-f-]+$/);
      gameId = parent.url().split('/').pop()!;

      // The child is invited: the game waits for them, with no code to type.
      const childEmail = (await unwrap<any>(await admin.request.get(`/api/users/${child.student_user_id}`), 'the child')).email;
      if (childEmail) {
        const kid = await as('student', { email: childEmail });
        const waiting = await unwrap<any[]>(await kid.request.get('/api/quest/games/waiting'), 'waiting');
        expect(waiting.map((w) => w.game_id)).toContain(gameId);
      }

      // Quest off: no counts and no Play with.
      await questOn(admin, false);
      const off = await unwrap<any>(await parent.request.get('/api/home'), 'the home');
      expect(off.parent.children[0].days_played_this_week).toBeNull();
      await parent.goto('/');
      await expect(parent.getByTestId(`home-child-${child.student_user_id}`)).toBeVisible({ timeout: 15_000 });
      await expect(parent.getByTestId(`home-child-play-${child.student_user_id}`)).toHaveCount(0);
    } finally {
      await questOn(admin, true);
      if (gameId) await parent.request.post(`/api/quest/games/${gameId}/end`);
      await questOn(admin, false);
    }
  });

  test('with every set off, nothing offers a set: no quest in Next up, a line instead of an empty section, a child card that says why', async ({
    as,
  }) => {
    const platform = await as('platformAdmin', { org: null });
    const admin = await as('admin');
    const session = await unwrap<any>(await admin.request.get('/api/auth/session'), 'session');
    const spaceId = session.organization.id;
    const sets = (data: Record<string, boolean>) =>
      platform.request.put(`/api/platform/organizations/${spaceId}/features`, { data });
    try {
      expect((await sets({ feature_tutoring: false, feature_assessment: false, feature_quest: false })).status()).toBe(200);

      const student = await as('student');
      const home = await unwrap<any>(await student.request.get('/api/home'), 'the home');
      expect(home.focus_options).toEqual([]);
      await student.goto('/');
      await expect(student.getByTestId('next-up')).toBeVisible({ timeout: 15_000 });
      await expect(student.getByTestId('next-up-focus_default')).toHaveCount(0);
      await expect(student.getByTestId('home-learner-empty')).toBeVisible();
      await expect(student.getByTestId('home-section-learner')).toContainText('Your learning');

      const parent = await as('parent');
      await parent.goto('/');
      await expect(parent.locator('[data-testid^="home-child-off-"]').first()).toContainText('Lessons and quests are off in this space.');

      // Assessment alone: the child card leads to it.
      expect((await sets({ feature_tutoring: false, feature_assessment: true, feature_quest: false })).status()).toBe(200);
      // Taking a set away clears its admins' switch; allowing it again leaves it off until they switch it on.
      expect((await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: true } })).status()).toBe(200);
      await parent.goto('/');
      await expect(parent.locator('[data-testid^="home-child-assessments-"]').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      expect((await sets({ feature_tutoring: true, feature_assessment: true, feature_quest: true })).status()).toBe(200);
      expect((await admin.request.patch('/api/organization/settings', { data: { canvas_assessments: true } })).status()).toBe(200);
    }
  });
});

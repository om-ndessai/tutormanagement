import { test, expect } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import type { Page } from '@playwright/test';
import { questStreak, questWelcome } from '@tmi/shared';

/**
 * Question Quest (Phase 42, docs/gamification-plan.md): a signed-in student
 * answers the bank's unapproved questions one at a time, with no going back;
 * their tutor approves each question for the whole platform, or flags it;
 * points for the attempt and for correctness. Behind an organization flag.
 *
 * Organization A's flag is turned on for the duration and off again. Counts
 * are compared before and after, so a database that has run this before still
 * passes; Sofia's level is set to BA3 here.
 */

test.describe.configure({ mode: 'serial' });

const BA3_TOPICS = Array.from({ length: 12 }, (_, i) => `BA3.${String(i + 1).padStart(2, '0')}`);

/** The bank's key for a question, from the platform console (never shown to the student). */
async function keyOf(platform: Page, questionId: string): Promise<{ answer: string; status: string; approved_via: string | null; checks: any }> {
  for (const topic of BA3_TOPICS) {
    const list = await unwrap<any[]>(await platform.request.get(`/api/platform/questions?topic_id=${topic}&limit=200`), topic);
    const found = list.find((q) => q.id === questionId);
    if (found) return found;
  }
  throw new Error(`question ${questionId} not found in BA3`);
}

async function withQuest(admin: Page, run: () => Promise<void>) {
  const set = (on: boolean) => admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } });
  expect((await set(true)).status()).toBe(200);
  try {
    await run();
  } finally {
    await set(false);
  }
}

test.describe('Question Quest (Phase 42)', () => {
  test('off by default; who may play, review and set levels', async ({ as }) => {
    const admin = await as('admin');
    const student = await as('student');
    const parent = await as('parent');
    expect((await student.request.get('/api/quest/me')).status()).toBe(403);

    await withQuest(admin, async () => {
      // A parent neither plays nor reviews; a student does not review.
      expect((await parent.request.get('/api/quest/me')).status()).toBe(403);
      expect((await parent.request.get('/api/quest/review')).status()).toBe(403);
      expect((await parent.request.get('/api/quest/students')).status()).toBe(403);
      expect((await student.request.get('/api/quest/review')).status()).toBe(403);

      // A tutor manages only their own students; one who is not theirs is missing.
      const tutor = await as('tutor');
      const mine = await unwrap<any[]>(await tutor.request.get('/api/quest/students'), 'tutor students');
      const all = await unwrap<any[]>(await admin.request.get('/api/quest/students'), 'admin students');
      expect(mine.length).toBeLessThan(all.length);
      const notMine = all.find((s) => !mine.some((m) => m.user_id === s.user_id))!;
      const refused = await tutor.request.put(`/api/quest/students/${notMine.user_id}/level`, { data: { level_id: 'BA3' } });
      expect(refused.status()).toBe(404);
      const bad = await tutor.request.put(`/api/quest/students/${mine[0].user_id}/level`, { data: { level_id: 'BA9' } });
      expect(bad.status()).toBe(422);
    });
  });

  test('a student answers, no going back; the tutor approves or flags; points for both', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const student = await as('student');
    const platform = await as('platformAdmin', { org: null });

    await withQuest(admin, async () => {
      const students = await unwrap<any[]>(await tutor.request.get('/api/quest/students'), 'students');
      const sofia = students.find((s) => s.full_name === 'Sofia Okafor');
      await unwrap(await tutor.request.put(`/api/quest/students/${sofia.user_id}/level`, { data: { level_id: 'BA3' } }), 'level');

      const before = await unwrap<any>(await student.request.get('/api/quest/me'), 'me');
      const tutorBefore = (await unwrap<any>(await tutor.request.get('/api/quest/review'), 'queue')).points;
      expect(before.level_id).toBe('BA3');
      const first = before.question;
      expect(first).toBeTruthy();
      expect(first).not.toHaveProperty('answer');

      // Right, then wrong, then a third to flag.
      const key = await keyOf(platform, first.id);
      const afterFirst = await unwrap<any>(
        await student.request.post('/api/quest/answers', { data: { question_id: first.id, answer: key.answer } }),
        'answering right',
      );
      expect(afterFirst.points).toBe(before.points + 1);
      // No going back: the same question again is refused.
      expect((await student.request.post('/api/quest/answers', { data: { question_id: first.id, answer: key.answer } })).status()).toBe(409);
      const second = afterFirst.question;
      const afterSecond = await unwrap<any>(
        await student.request.post('/api/quest/answers', { data: { question_id: second.id, answer: 'not this' } }),
        'answering wrong',
      );
      const third = afterSecond.question;
      await unwrap(await student.request.post('/api/quest/answers', { data: { question_id: third.id, answer: 'not this' } }), 'third');

      // The tutor's queue, oldest first: the right answer, with the key and the solution.
      let queue = await unwrap<any>(await tutor.request.get('/api/quest/review'), 'queue');
      // Earlier runs may have left answers waiting: work through to ours.
      while (queue.item && queue.item.question.id !== first.id) {
        queue = await unwrap<any>(await tutor.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'flag', note: 'clearing an earlier run' } }), 'clearing');
      }
      expect(queue.item.correct).toBe(true);
      expect(queue.item.question.answer).toBe(key.answer);
      expect((await tutor.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'flag' } })).status()).toBe(422);
      const pointsBefore = queue.points;
      queue = await unwrap<any>(await tutor.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'approve' } }), 'approving');
      // One point to the tutor per review, whatever the outcome (owner, 2026-10-20).
      expect(queue.points).toBe(pointsBefore + 1);
      expect(queue.item.question.id).toBe(second.id);
      expect(queue.item.correct).toBe(false);
      queue = await unwrap<any>(await tutor.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'approve' } }), 'approving the second');
      expect(queue.item.question.id).toBe(third.id);
      await unwrap(await tutor.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'flag', note: 'Two options are right.' } }), 'flagging');

      // The bank: approved through Quest by the tutor; the flag carries its reason to the console.
      const approved = await keyOf(platform, first.id);
      expect(approved.status).toBe('approved');
      expect(approved.approved_via).toBe('quest');
      const flagged = await keyOf(platform, third.id);
      expect(flagged.status).toBe('flagged');
      expect(flagged.checks.quest_flag.note).toBe('Two options are right.');

      // Points: the student 3 attempts + 1 correct; the tutor 3 reviews (beyond any clearing).
      const after = await unwrap<any>(await student.request.get('/api/quest/me'), 'me after');
      expect(after.points).toBe(before.points + 4);
      expect(after.answered).toBe(before.answered + 3);
      const tutorAfter = (await unwrap<any>(await tutor.request.get('/api/quest/review'), 'queue after')).points;
      expect(tutorAfter - tutorBefore).toBeGreaterThanOrEqual(3);

      // A level with nothing to serve, at the end of its family, is finished. Every bank level has questions
      // since 2026-10-22, so Mathematical and Statistical Modeling (in no family) is emptied for the test by
      // marking its standards "needs a figure", which Quest skips -- and restored after.
      const coverage = await unwrap<{ level_id: string; topics: { topic_id: string }[] }[]>(
        await platform.request.get('/api/platform/questions/coverage'),
        'coverage',
      );
      const msm = coverage.find((l) => l.level_id === 'NC26.MSM')!.topics.map((t) => t.topic_id);
      const mark = (needs_figure: boolean) =>
        Promise.all(msm.map((id) => platform.request.patch(`/api/platform/questions/topics/${id}`, { data: { needs_figure } })));
      try {
        for (const response of await mark(true)) expect(response.status()).toBe(200);
        await unwrap(await tutor.request.put(`/api/quest/students/${sofia.user_id}/level`, { data: { level_id: 'NC26.MSM' } }), 'MSM');
        const done = await unwrap<any>(await student.request.get('/api/quest/me'), 'me at MSM');
        expect(done.finished).toBe(true);
        expect(done.question).toBeNull();
      } finally {
        await mark(false);
      }
      await unwrap(await tutor.request.put(`/api/quest/students/${sofia.user_id}/level`, { data: { level_id: 'BA3' } }), 'back to BA3');
    });
  });

  test('full screen: the student lands in Quest and answers; the tutor lands in review and approves', async ({ as }) => {
    const admin = await as('admin');
    await withQuest(admin, async () => {
      const tutor = await as('tutor', { questLanding: true });
      const students = await unwrap<any[]>(await tutor.request.get('/api/quest/students'), 'students');
      const sofia = students.find((s) => s.full_name === 'Sofia Okafor');
      await unwrap(await tutor.request.put(`/api/quest/students/${sofia.user_id}/level`, { data: { level_id: 'BA3' } }), 'level');

      // The student signs in and lands in Quest, outside the portal's frame.
      const student = await as('student', { questLanding: true });
      await student.goto('/');
      await expect(student.getByTestId('quest-play')).toBeVisible();
      await expect(student.getByRole('navigation')).toHaveCount(0);
      await expect(student.getByTestId('quest-question')).toBeVisible();
      // The welcome (owner, 2026-10-21): personal, with the numbers, and gone by itself after 5 seconds.
      await expect(student.getByTestId('quest-welcome')).toBeVisible();
      await expect(student.getByTestId('quest-welcome-title')).toContainText('Sofia');
      await expect(student.getByTestId('quest-welcome')).toHaveCount(0, { timeout: 7_000 });
      const points = Number((await student.getByTestId('quest-points').innerText()).match(/\d+/)![0]);
      if (await student.getByTestId('quest-number').isVisible()) {
        await student.getByTestId('quest-number').fill('7');
      } else {
        await student.getByTestId('quest-choice-A').click();
      }
      await student.getByTestId('quest-submit').click();
      await expect(student.getByTestId('quest-points')).toContainText(`${points + 1} point`);
      await expect(student.getByTestId('quest-points-burst')).toContainText('+1');
      // Leaving stays left: Exit goes to the portal's Quest page, and home does not bounce back.
      await student.getByTestId('quest-exit').click();
      await expect(student.getByTestId('quest-play-card')).toBeVisible();
      await student.goto('/');
      await expect(student.getByTestId('quest-play')).toHaveCount(0);

      // The tutor signs in with answers waiting and lands in review.
      await tutor.goto('/');
      await expect(tutor.getByTestId('quest-review')).toBeVisible();
      await expect(tutor.getByTestId('quest-review-item')).toBeVisible();
      await tutor.getByTestId('quest-approve').click();
      await expect(tutor.getByText('Approved. The question is in the bank.')).toBeVisible();

      // The organization's switch, and the menu item it brings.
      await admin.goto('/organization');
      await expect(admin.getByRole('switch', { name: 'Question Quest' })).toHaveAttribute('aria-checked', 'true');
      await expect(admin.getByRole('link', { name: 'Quest' }).first()).toBeVisible();
    });
  });

  test('two right answers approve a question; a third student waits; a flag takes it back (2026-10-24)', async ({ as }) => {
    const admin = await as('admin');
    const platform = await as('platformAdmin', { org: null });
    await withQuest(admin, async () => {
      const students = await unwrap<any[]>(await admin.request.get('/api/quest/students'), 'students');
      const sofiaRow = students.find((s) => s.full_name === 'Sofia Okafor')!;
      const sanjayRow = students.find((s) => s.full_name === 'Sanjay Patel')!;
      const people = await unwrap<any[]>(await admin.request.get('/api/users?role=student&limit=100'), 'students with addresses');
      const third = people.find((u) => u.email && /\d@gmail\.com$/.test(u.email) && students.some((s) => s.user_id === u.id))!;
      const level = 'BA2';
      for (const id of [sofiaRow.user_id, sanjayRow.user_id, third.id]) {
        await unwrap(await admin.request.put(`/api/quest/students/${id}/level`, { data: { level_id: level } }), 'level');
      }
      const keys = new Map(
        (await unwrap<any[]>(await platform.request.get(`/api/platform/questions?level_id=${level}&limit=200`), 'keys')).map((q) => [q.id, q]),
      );
      const sofia = await as('student');
      const sanjay = await as('studentTutor');
      const thirdPage = await as('student', { email: third.email });

      // The same question waits with two students at once, so both are served it.
      const q1 = (await unwrap<any>(await sofia.request.get('/api/quest/me'), 'sofia')).question;
      expect((await unwrap<any>(await sanjay.request.get('/api/quest/me'), 'sanjay')).question.id).toBe(q1.id);
      await unwrap(await sofia.request.post('/api/quest/answers', { data: { question_id: q1.id, answer: keys.get(q1.id).answer } }), 'sofia right');
      expect(keys.get(q1.id).status).toBe('checked');
      await unwrap(await sanjay.request.post('/api/quest/answers', { data: { question_id: q1.id, answer: keys.get(q1.id).answer } }), 'sanjay right');
      const approved = (await unwrap<any[]>(await platform.request.get(`/api/platform/questions?level_id=${level}&status=approved&limit=200`), 'approved')).find(
        (q) => q.id === q1.id,
      );
      expect(approved).toMatchObject({ status: 'approved', approved_via: 'quest_consensus' });

      // Two wrong answers: the question stays checked, and a third student is not served it.
      const q2 = (await unwrap<any>(await sofia.request.get('/api/quest/me'), 'sofia next')).question;
      expect((await unwrap<any>(await sanjay.request.get('/api/quest/me'), 'sanjay next')).question.id).toBe(q2.id);
      await unwrap(await sofia.request.post('/api/quest/answers', { data: { question_id: q2.id, answer: 'not this' } }), 'sofia wrong');
      await unwrap(await sanjay.request.post('/api/quest/answers', { data: { question_id: q2.id, answer: 'not this' } }), 'sanjay wrong');
      const servedThird = (await unwrap<any>(await thirdPage.request.get('/api/quest/me'), 'third')).question;
      expect(servedThird.id).not.toBe(q2.id);
      expect(servedThird.id).not.toBe(q1.id);

      // A tutor's flag outranks the count: the approved question goes back to the console, flagged.
      let flagged = false;
      for (let i = 0; i < 40 && !flagged; i += 1) {
        const queue = await unwrap<any>(await admin.request.get('/api/quest/review'), 'queue');
        if (!queue.item) break;
        const decision = queue.item.question.id === q1.id ? { decision: 'flag', note: 'Checking the two-answer rule.' } : { decision: 'approve' };
        await unwrap(await admin.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: decision }), 'review');
        flagged = queue.item.question.id === q1.id;
      }
      expect(flagged).toBe(true);
      const after = (await unwrap<any[]>(await platform.request.get(`/api/platform/questions?level_id=${level}&status=flagged&limit=200`), 'flagged')).find(
        (q) => q.id === q1.id,
      );
      expect(after).toMatchObject({ status: 'flagged', approved_via: null });
    });
  });

  test('the welcome’s streak and words', () => {
    // Today and the two days before: a 3-day streak, safe today.
    expect(questStreak(['2026-10-21', '2026-10-20', '2026-10-19', '2026-10-10'], '2026-10-21')).toEqual({ current: 3, atRisk: false, best: 3 });
    // Up to yesterday: still a streak, at risk until they answer today.
    expect(questStreak(['2026-10-20', '2026-10-19'], '2026-10-21')).toEqual({ current: 2, atRisk: true, best: 2 });
    // A gap: no streak now; the best run is kept.
    expect(questStreak(['2026-10-15', '2026-10-14', '2026-10-13', '2026-10-01'], '2026-10-21')).toEqual({ current: 0, atRisk: false, best: 3 });
    expect(questStreak([], '2026-10-21')).toEqual({ current: 0, atRisk: false, best: 0 });

    const base = { first_name: 'Sofia', level_id: 'BA3', points: 9, answered: 7, confirmed: 2, answered_today: 0, streak_days: 2, streak_at_risk: true, best_streak: 2, left_in_level: 150 };
    expect(questWelcome(base, 'BA3')).toEqual({ title: '2 days in a row, Sofia!', line: 'Answer one today to keep your 2-day streak going.' });
    expect(questWelcome({ ...base, answered: 0, streak_days: 0, streak_at_risk: false }, 'BA3').title).toBe('Welcome to Question Quest, Sofia!');
    expect(questWelcome({ ...base, streak_days: 0, streak_at_risk: false, best_streak: 1, left_in_level: 12 }, 'BA3').line).toBe('Only 12 questions left in BA3. Finish it and move up!');
  });
});

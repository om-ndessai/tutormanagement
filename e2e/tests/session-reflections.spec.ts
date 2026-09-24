import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 25: the student's own view of a lesson -- four 1-5 answers and notes
 * on the homework -- after the tutor has recorded it.
 *
 * The rules worth holding: the student, a parent or the lesson's tutor may
 * type it, and it reaches the lesson's audience and nobody else; once the
 * student has entered it themselves, no adult may overwrite or withdraw it;
 * the office reads but does not enter; and the student's old Phase 23
 * assessment gives way to it.
 *
 * Each test records its own lesson for Alex and Sofia, dated today on the
 * institute's clock, so the dashboard prompt (the last 21 days) finds it
 * whatever day the suite runs.
 */

/** Today, YYYY-MM-DD, on the institute's clock. */
function instituteToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

async function recordLesson(admin: Page, student: 'student' | 'ben' = 'student') {
  const tutor = await idOf(admin, PEOPLE.tutor.email);
  const studentId =
    student === 'ben' ? await idOf(admin, 'Ben Whitfield') : await idOf(admin, PEOPLE.student.email);

  return unwrap<any>(
    await admin.request.post('/api/sessions', {
      data: {
        tutor_user_id: tutor,
        student_user_id: studentId,
        occurred_on: instituteToday(),
        started_at: '07:00',
        ended_at: '08:00',
        mode: 'in_person',
      },
    }),
    'recording a lesson',
  );
}

const reflect = (page: Page, sessionId: string, data: Record<string, unknown>) =>
  page.request.put(`/api/sessions/${sessionId}/reflection`, { data });

const withdraw = (page: Page, sessionId: string) =>
  page.request.delete(`/api/sessions/${sessionId}/reflection`);

test.describe('the student’s reflection on a lesson', () => {
  test('the student reflects, and the lesson’s audience reads it', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const sofia = await as('student');
      const saved = await unwrap<any>(
        await reflect(sofia, lesson.id, {
          learned_new: 4,
          difficulty: 3,
          understanding: 4,
          pace: 5,
          homework_notes: 'Question 3 was confusing.',
        }),
        'reflecting',
      );
      expect(saved.reflection).toMatchObject({
        entered_as: 'student',
        entered_by_name: PEOPLE.student.name,
        pace: 5,
        homework_notes: 'Question 3 was confusing.',
      });

      // Her tutor, her mother and the office read the same answers.
      for (const who of ['tutor', 'parentTutor', 'admin'] as const) {
        const seen = await unwrap<any>(
          await (await as(who)).request.get(`/api/sessions/${lesson.id}`),
          `reading as ${who}`,
        );
        expect(seen.reflection).toMatchObject({ entered_as: 'student', pace: 5 });
      }

      // Another family's parent can neither read it nor find the lesson.
      const anita = await as('parent');
      expect((await anita.request.get(`/api/sessions/${lesson.id}`)).status()).toBe(404);
      expect((await reflect(anita, lesson.id, { pace: 3 })).status()).toBe(404);
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('an adult may enter it for the student, but the student’s own words are theirs', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const maria = await as('parentTutor');
      const alex = await as('tutor');
      const sofia = await as('student');

      // Her mother sits with her; then her tutor corrects what was typed.
      const byParent = await unwrap<any>(await reflect(maria, lesson.id, { learned_new: 3 }), 'parent');
      expect(byParent.reflection).toMatchObject({ entered_as: 'parent', entered_by_name: PEOPLE.parentTutor.name });
      const byTutor = await unwrap<any>(await reflect(alex, lesson.id, { learned_new: 4 }), 'tutor');
      expect(byTutor.reflection.entered_as).toBe('tutor');

      // Sofia makes it her own. From then on no adult may change it.
      const byStudent = await unwrap<any>(await reflect(sofia, lesson.id, { learned_new: 5 }), 'student');
      expect(byStudent.reflection.entered_as).toBe('student');
      expect((await reflect(maria, lesson.id, { learned_new: 1 })).status()).toBe(403);
      expect((await withdraw(maria, lesson.id)).status()).toBe(403);
      expect((await reflect(alex, lesson.id, { learned_new: 1 })).status()).toBe(403);
      expect((await withdraw(alex, lesson.id)).status()).toBe(403);

      // She may withdraw it herself.
      expect((await withdraw(sofia, lesson.id)).status()).toBe(204);
      expect((await withdraw(sofia, lesson.id)).status()).toBe(404);
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('the tutor enters one for a student who cannot sign in', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');

    // Seeded: Alex entered Ben's reflection on 12 Sept; Ben has no login.
    const seeded = await unwrap<any>(
      await alex.request.get('/api/sessions/50000000-0000-4000-8000-000000000003'),
      'Ben’s seeded lesson',
    );
    expect(seeded.reflection).toMatchObject({ entered_as: 'tutor', entered_by_name: PEOPLE.tutor.name });

    const lesson = await recordLesson(admin, 'ben');
    try {
      const saved = await unwrap<any>(
        await reflect(alex, lesson.id, { difficulty: 4, pace: 2, homework_notes: 'Wants more practice.' }),
        'entering for Ben',
      );
      expect(saved.reflection.entered_as).toBe('tutor');
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('the office reads but does not enter, and a student no longer assesses', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      // Priya is an admin with no tie to Sofia's lesson.
      expect((await reflect(admin, lesson.id, { pace: 3 })).status()).toBe(403);

      const sofia = await as('student');
      expect(
        (await sofia.request.put(`/api/sessions/${lesson.id}/assessment`, { data: { rating: 4 } })).status(),
      ).toBe(403);

      // The assessment she gave on 8 Sept, before reflections, still shows.
      const earlier = await unwrap<any>(
        await sofia.request.get('/api/sessions/50000000-0000-4000-8000-000000000001'),
        'her earlier lesson',
      );
      expect(earlier.assessments.map((row: any) => row.author_role)).toContain('student');
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('answers are 1 to 5, something is said, and no SSN gets in', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const sofia = await as('student');
      for (const data of [{ pace: 6 }, { difficulty: 0 }, {}, { homework_notes: 'my ssn is 123-45-6789' }]) {
        expect((await reflect(sofia, lesson.id, data)).status(), JSON.stringify(data)).toBe(422);
      }
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('the dashboards ask for it, and the tutor sees what came back', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const sofia = await as('student');
      const maria = await as('parentTutor');
      const alex = await as('tutor');

      const prompts = async (page: Page, role: string) =>
        ((await unwrap<any>(await page.request.get(`/api/dashboard?role=${role}`), role)).data
          .awaiting_reflection as any[]).map((row) => row.session_id);

      // Waiting on the student's dashboard and on her mother's.
      expect(await prompts(sofia, 'student')).toContain(lesson.id);
      expect(await prompts(maria, 'parent')).toContain(lesson.id);

      await unwrap(await reflect(sofia, lesson.id, { learned_new: 4, pace: 5 }), 'reflecting');

      // Answered: no longer asked for.
      expect(await prompts(sofia, 'student')).not.toContain(lesson.id);
      expect(await prompts(maria, 'parent')).not.toContain(lesson.id);

      // Alex's Tutoring tab has it; Maria's tutor view -- her own teaching --
      // does not, though she is Sofia's mother.
      const digests = async (page: Page) =>
        (await unwrap<any>(await page.request.get('/api/dashboard?role=tutor'), 'tutor')).data
          .recent_reflections as any[];
      const mine = (await digests(alex)).find((row) => row.session_id === lesson.id);
      expect(mine.reflection).toMatchObject({ pace: 5, entered_as: 'student' });
      expect((await digests(maria)).map((row) => row.session_id)).not.toContain(lesson.id);
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('the student reflects from the lesson’s card, and the tutor’s dashboard flags it', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const sofia = await as('student');
      await sofia.goto(`/sessions?focus=${lesson.id}`);
      await sofia.getByRole('button', { name: 'Reflect on this session' }).click();

      const dialog = sofia.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'How did this lesson go for you?' })).toBeVisible();
      const answer = (question: string, value: number) =>
        dialog.getByRole('radiogroup', { name: question }).getByRole('radio', { name: new RegExp(`^${value} `) }).click();
      await answer('Did you learn anything new?', 4);
      await answer('How difficult was the topic?', 3);
      await answer('Has your understanding of the topic improved?', 4);
      await answer('How was the pace?', 5);
      await dialog.getByLabel('Homework notes').fill('Page two took ages.');
      await dialog.getByRole('button', { name: 'Save reflection' }).click();
      await expect(dialog).toHaveCount(0);

      // The card shows it, and she no longer has an Assess button.
      await expect(sofia.getByText('Student reflected')).toBeVisible();
      await expect(sofia.getByRole('button', { name: 'Assess this session' })).toHaveCount(0);
      await sofia.getByRole('button', { name: /^(Session notes|Reflection)$/ }).click();
      await expect(sofia.getByText('Page two took ages.')).toBeVisible();

      // Her tutor's Tutoring tab flags the pace.
      const alex = await as('tutor');
      await alex.goto('/');
      const section = alex.getByRole('region', { name: 'Student Reflections' });
      const row = section.getByRole('listitem').filter({ hasText: 'Page two took ages.' });
      await expect(row).toContainText(PEOPLE.student.name);
      await expect(row).toContainText('Too fast');
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });

  test('a parent reflects with their child from the dashboard prompt', async ({ as }) => {
    const admin = await as('admin');
    const lesson = await recordLesson(admin);

    try {
      const maria = await as('parentTutor');
      await maria.goto('/?role=parent');
      // Named by date and time, so another lesson of hers today cannot be taken for it.
      await maria
        .getByRole('button', { name: `Reflect with Sofia on the ${lesson.occurred_on} 7:00 AM lesson` })
        .click();

      const dialog = maria.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Sofia’s reflection' })).toBeVisible();
      await expect(dialog).toContainText('You are entering this for Sofia');
      await dialog
        .getByRole('radiogroup', { name: 'Did Sofia learn anything new?' })
        .getByRole('radio', { name: /^3 / })
        .click();
      await dialog.getByRole('button', { name: 'Save reflection' }).click();
      await expect(dialog).toHaveCount(0);

      const saved = await unwrap<any>(await maria.request.get(`/api/sessions/${lesson.id}`), 'reading');
      expect(saved.reflection).toMatchObject({ entered_as: 'parent', learned_new: 3 });
    } finally {
      await admin.request.delete(`/api/sessions/${lesson.id}`);
    }
  });
});

import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 23: a lesson's notes in parts -- what was planned, the look back at
 * last time and its homework, what was covered, what was set -- and an
 * assessment of it from anybody it concerns.
 *
 * The rules worth holding: the write-up and the assessments reach exactly the
 * lesson's audience; a draft keeps both to its author until it is posted; an
 * assessment is always the reader's own, in the capacity the API decides; and
 * none of it carries money or an SSN.
 *
 * Seeded: Alex teaches Sofia, whose mother is Maria. Anita is Sanjay's mother
 * and has nothing to do with Sofia's lessons.
 */

const WRITE_UP = {
  planned: 'Number lines for comparing fractions.',
  previous_review: 'Word problems from last week had stuck.',
  homework_review: 'All five problems done; one slip on the last.',
  homework_status: 'done',
  homework_assigned: 'Number line worksheet, both sides.',
};

/** A lesson of Alex's with Sofia, looked up through the admin's context. */
async function lessonBody(admin: Page) {
  return {
    tutor_user_id: await idOf(admin, PEOPLE.tutor.email),
    student_user_id: await idOf(admin, PEOPLE.student.email),
    occurred_on: '2026-09-22',
    started_at: '16:00',
    ended_at: '17:00',
    mode: 'in_person',
  };
}

test.describe('session write-ups and assessments', () => {
  test('a write-up reaches everyone the lesson concerns, and nobody else', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const session = await unwrap<any>(
      await tutor.request.post('/api/sessions', {
        data: {
          ...(await lessonBody(admin)),
          notes: 'Covered comparing fractions on a number line.',
          write_up: WRITE_UP,
          assessment: { rating: 4, body: 'Good focus today.' },
        },
      }),
      'recording with a write-up',
    );

    expect(session.write_up).toEqual(WRITE_UP);
    expect(session.assessments).toHaveLength(1);
    expect(session.assessments[0]).toMatchObject({ author_role: 'tutor', rating: 4 });

    // Her mother, Sofia herself and the office read the same write-up.
    for (const who of ['parentTutor', 'student', 'admin'] as const) {
      const page = await as(who);
      const seen = await unwrap<any>(
        await page.request.get(`/api/sessions/${session.id}`),
        `reading as ${who}`,
      );
      expect(seen.write_up).toEqual(WRITE_UP);
      expect(seen.assessments.map((row: any) => row.author_role)).toEqual(['tutor']);
    }

    // Another family's parent is told it does not exist.
    const outsider = await as('parent');
    expect((await outsider.request.get(`/api/sessions/${session.id}`)).status()).toBe(404);

    await admin.request.delete(`/api/sessions/${session.id}`);
  });

  test('everyone the lesson concerns may assess it, once each, as themselves', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const session = await unwrap<any>(
      await tutor.request.post('/api/sessions', {
        data: { ...(await lessonBody(admin)), assessment: { rating: 4 } },
      }),
      'recording a lesson',
    );

    // The capacity comes from the relationship, never from the request.
    const expected = { parentTutor: 'parent', admin: 'admin' } as const;
    for (const [who, role] of Object.entries(expected)) {
      const page = await as(who as keyof typeof expected);
      const after = await unwrap<any>(
        await page.request.put(`/api/sessions/${session.id}/assessment`, {
          data: { rating: 5, body: `As the ${role}.`, author_role: 'tutor' },
        }),
        `assessing as ${who}`,
      );
      const theirs = after.assessments.find((row: any) => row.body === `As the ${role}.`);
      expect(theirs.author_role).toBe(role);
    }

    // The student reflects on a lesson rather than assessing it (Phase 25).
    const sofia = await as('student');
    expect(
      (await sofia.request.put(`/api/sessions/${session.id}/assessment`, { data: { rating: 5 } })).status(),
    ).toBe(403);

    // Revising keeps one each.
    const maria = await as('parentTutor');
    const revised = await unwrap<any>(
      await maria.request.put(`/api/sessions/${session.id}/assessment`, { data: { rating: 3 } }),
      'revising',
    );
    expect(revised.assessments.map((row: any) => row.author_role)).toEqual(['tutor', 'parent', 'admin']);
    expect(revised.assessments.find((row: any) => row.author_role === 'parent').rating).toBe(3);

    // Somebody the lesson does not concern cannot assess it, or learn it exists.
    const outsider = await as('parent');
    expect(
      (await outsider.request.put(`/api/sessions/${session.id}/assessment`, { data: { rating: 1 } }))
        .status(),
    ).toBe(404);

    // Nothing to say is not an assessment.
    expect(
      (await maria.request.put(`/api/sessions/${session.id}/assessment`, { data: {} })).status(),
    ).toBe(422);

    // Withdrawing removes only your own; the tutor's stays.
    expect((await maria.request.delete(`/api/sessions/${session.id}/assessment`)).status()).toBe(204);
    expect((await maria.request.delete(`/api/sessions/${session.id}/assessment`)).status()).toBe(404);
    const left = await unwrap<any>(await tutor.request.get(`/api/sessions/${session.id}`), 'reading');
    expect(left.assessments.map((row: any) => row.author_role)).toEqual(['tutor', 'admin']);

    await admin.request.delete(`/api/sessions/${session.id}`);
  });

  test('a draft keeps its write-up and assessment to its author until posted', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const draft = await unwrap<any>(
      await tutor.request.post('/api/sessions/drafts', {
        data: {
          ...(await lessonBody(admin)),
          write_up: { planned: 'Decimals, if there is time.' },
          assessment: { rating: 2, body: 'Tired today.' },
        },
      }),
      'saving a draft',
    );
    expect(draft.write_up.planned).toBe('Decimals, if there is time.');
    expect(draft.assessment).toEqual({ rating: 2, body: 'Tired today.' });

    // Nobody else sees any of it -- not her mother, not the office.
    for (const who of ['parentTutor', 'admin'] as const) {
      const page = await as(who);
      const drafts = await unwrap<any[]>(await page.request.get('/api/sessions/drafts'), 'drafts');
      expect(drafts.map((row) => row.id)).not.toContain(draft.id);
    }

    const session = await unwrap<any>(
      await tutor.request.post(`/api/sessions/drafts/${draft.id}/post`),
      'posting',
    );

    // Posted, both reach the family, and the assessment is the tutor's.
    const maria = await as('parentTutor');
    const seen = await unwrap<any>(await maria.request.get(`/api/sessions/${session.id}`), 'reading');
    expect(seen.write_up.planned).toBe('Decimals, if there is time.');
    expect(seen.assessments).toEqual([
      expect.objectContaining({ author_role: 'tutor', rating: 2, body: 'Tired today.' }),
    ]);

    await admin.request.delete(`/api/sessions/${session.id}`);
  });

  test('no SSN gets in, and an edit that leaves the notes out keeps them', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const session = await unwrap<any>(
      await tutor.request.post('/api/sessions', {
        data: { ...(await lessonBody(admin)), notes: 'Keep these notes.' },
      }),
      'recording a lesson',
    );

    const ssn = '123-45-6789';
    expect(
      (await tutor.request.patch(`/api/sessions/${session.id}`, {
        data: { write_up: { homework_assigned: `SSN ${ssn}` } },
      })).status(),
    ).toBe(422);
    expect(
      (await tutor.request.put(`/api/sessions/${session.id}/assessment`, {
        data: { body: `His is ${ssn}` },
      })).status(),
    ).toBe(422);

    // Revising only an assessment through the lesson's own edit route must
    // not erase its notes: an omitted field is left alone.
    const after = await unwrap<any>(
      await tutor.request.patch(`/api/sessions/${session.id}`, { data: { assessment: { rating: 5 } } }),
      'assessing through an edit',
    );
    expect(after.notes).toBe('Keep these notes.');
    expect(after.assessments[0].rating).toBe(5);

    await admin.request.delete(`/api/sessions/${session.id}`);
  });

  test('the form writes a lesson up in parts, and its card reads them back', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const marker = `UI write-up ${Date.now()}`;

    await tutor.goto('/sessions');
    await tutor.getByRole('button', { name: /Record a session/i }).click();

    const dialog = tutor.getByRole('dialog');
    await dialog.getByRole('combobox').first().click();
    await tutor.getByRole('option', { name: /Sofia/ }).click();

    await dialog.getByLabel('What was planned', { exact: true }).fill('Fractions on a number line.');
    await dialog.getByLabel('Previous session review', { exact: true }).fill('Word problems stuck.');
    await dialog.getByLabel('Homework review', { exact: true }).fill('Done, neatly.');
    await dialog
      .getByRole('radiogroup', { name: 'How the homework went' })
      .getByRole('radio', { name: 'Done', exact: true })
      .click();
    await dialog.getByLabel('Session notes', { exact: true }).fill(marker);
    await dialog.getByLabel('Homework set', { exact: true }).fill('Worksheet 4b.');
    await dialog
      .getByRole('radiogroup', { name: 'How did the lesson go?' })
      .getByRole('radio', { name: /^4/ })
      .click();
    await dialog.getByRole('button', { name: 'Record session' }).click();
    await expect(dialog).toHaveCount(0);

    const recent = await unwrap<any[]>(
      await tutor.request.get(`/api/sessions?student_user_id=${sofiaId}&limit=20`),
      'finding the lesson',
    );
    const session = recent.find((row) => row.notes === marker);
    expect(session.write_up).toMatchObject({
      planned: 'Fractions on a number line.',
      homework_status: 'done',
      homework_assigned: 'Worksheet 4b.',
    });
    expect(session.assessments).toEqual([expect.objectContaining({ author_role: 'tutor', rating: 4 })]);

    // The card reads it back, on the Tutoring tab, with no money on it.
    await tutor.goto(`/sessions?focus=${session.id}`);
    await tutor.getByRole('button', { name: 'Session notes' }).click();
    const card = tutor.getByRole('listitem').filter({ hasText: marker });
    await expect(card).toContainText('Fractions on a number line.');
    await expect(card).toContainText('Worksheet 4b.');
    await expect(card).toContainText('Homework: done');
    await expect(card).not.toContainText('$');

    // Her mother adds hers from the same card.
    const maria = await as('parentTutor');
    await maria.goto(`/sessions?focus=${session.id}`);
    await maria.getByRole('button', { name: 'Assess this session' }).click();
    const assess = maria.getByRole('dialog');
    await assess
      .getByRole('radiogroup', { name: 'How do you feel this lesson went?' })
      .getByRole('radio', { name: /^5/ })
      .click();
    await assess.getByLabel('In a few words').fill('Loved the number line.');
    await assess.getByRole('button', { name: 'Save assessment' }).click();
    await expect(assess).toHaveCount(0);

    await maria.getByRole('button', { name: 'Session notes' }).click();
    const theirs = maria.getByRole('listitem').filter({ hasText: marker });
    await expect(theirs).toContainText('Loved the number line.');
    await expect(theirs).toContainText('Parent');
    await expect(maria.getByRole('button', { name: 'Edit your assessment' })).toBeVisible();

    await admin.request.delete(`/api/sessions/${session.id}`);
  });
});

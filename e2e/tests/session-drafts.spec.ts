import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 22: a tutor can save a rough write-up and come back to it.
 *
 * The rules worth holding: a draft is billed for nothing, counted nowhere,
 * and readable by nobody but its author until it is posted.
 */
test.describe('session drafts', () => {
  test('a draft touches no money and no totals', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const studentId = await idOf(admin, PEOPLE.student.email);

    const before = await unwrap<any>(
      await admin.request.get('/api/payments/balances'),
      'balances before',
    );
    // The list's totals sit beside `data` in the envelope, so read it raw.
    const beforeSessions = await (await admin.request.get('/api/sessions?limit=1')).json();

    const draft = await unwrap<any>(
      await tutor.request.post('/api/sessions/drafts', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: studentId,
          occurred_on: '2026-09-21',
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          notes: 'Rough notes, not finished.',
        },
      }),
      'saving a draft',
    );

    const after = await unwrap<any>(
      await admin.request.get('/api/payments/balances'),
      'balances after',
    );
    const afterSessions = await (await admin.request.get('/api/sessions?limit=1')).json();

    // Not a penny, not a count, anywhere.
    expect(after.totals).toEqual(before.totals);
    expect(afterSessions.totals.session_count).toBe(beforeSessions.totals.session_count);
    expect(after.tutors.find((t: any) => t.user_id === tutorId).earned_cents).toBe(
      before.tutors.find((t: any) => t.user_id === tutorId).earned_cents,
    );

    await tutor.request.delete(`/api/sessions/drafts/${draft.id}`);
  });

  test('belongs to its author alone, admins included', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const studentId = await idOf(admin, PEOPLE.student.email);

    const draft = await unwrap<any>(
      await tutor.request.post('/api/sessions/drafts', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: studentId,
          occurred_on: '2026-09-21',
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          notes: 'Half a thought.',
        },
      }),
      'saving a draft',
    );

    // The author sees it.
    const mine = await unwrap<any[]>(
      await tutor.request.get('/api/sessions/drafts'),
      'listing my drafts',
    );
    expect(mine.map((d) => d.id)).toContain(draft.id);

    // Nobody else does -- not an admin, not the student's parent.
    for (const who of ['admin', 'parentTutor'] as const) {
      const page = await as(who);
      const theirs = await unwrap<any[]>(
        await page.request.get('/api/sessions/drafts'),
        `listing drafts as ${who}`,
      );
      expect(theirs.map((d) => d.id)).not.toContain(draft.id);
    }

    // And nobody else can post or discard it. Reported as missing, since that
    // somebody has an unfinished write-up is itself theirs to know.
    expect((await admin.request.post(`/api/sessions/drafts/${draft.id}/post`)).status()).toBe(404);
    expect((await admin.request.delete(`/api/sessions/drafts/${draft.id}`)).status()).toBe(404);

    await tutor.request.delete(`/api/sessions/drafts/${draft.id}`);
  });

  test('posting turns one write-up into exactly one lesson, priced then', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const studentId = await idOf(admin, PEOPLE.student.email);

    const draft = await unwrap<any>(
      await tutor.request.post('/api/sessions/drafts', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: studentId,
          occurred_on: '2026-09-21',
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          notes: 'Draft copy.',
        },
      }),
      'saving a draft',
    );

    // Edited, then posted.
    await unwrap(
      await tutor.request.patch(`/api/sessions/drafts/${draft.id}`, {
        data: {
          tutor_user_id: tutorId,
          student_user_id: studentId,
          occurred_on: '2026-09-21',
          started_at: '16:00',
          ended_at: '17:00',
          mode: 'in_person',
          notes: 'Final copy.',
        },
      }),
      'editing the draft',
    );

    const session = await unwrap<any>(
      await tutor.request.post(`/api/sessions/drafts/${draft.id}/post`),
      'posting the draft',
    );

    expect(session.notes).toBe('Final copy.');
    // Priced at posting, not at drafting: a draft carries no money at all.
    expect(session.tutor_amount_cents).toBeGreaterThan(0);

    // The draft is gone -- one write-up must not become two records.
    const left = await unwrap<any[]>(
      await tutor.request.get('/api/sessions/drafts'),
      'listing drafts after posting',
    );
    expect(left.map((d) => d.id)).not.toContain(draft.id);

    // And now the family can see the lesson.
    const parent = await as('parentTutor');
    const theirs = await unwrap<any[]>(
      await parent.request.get('/api/sessions?limit=50'),
      'reading as the parent',
    );
    expect(theirs.map((s: any) => s.id)).toContain(session.id);

    await admin.request.delete(`/api/sessions/${session.id}?hard=true`);
  });

  test('the dialog offers Save draft, and the page offers it back', async ({ as }) => {
    const tutor = await as('tutor');

    // Start from a known state: this asserts the panel appears and then goes,
    // which anything left over from an earlier run would quietly satisfy.
    const existing = await unwrap<any[]>(
      await tutor.request.get('/api/sessions/drafts'),
      'clearing drafts',
    );
    for (const draft of existing) {
      await tutor.request.delete(`/api/sessions/drafts/${draft.id}`);
    }

    await tutor.goto('/sessions');
    await tutor.getByRole('button', { name: /Record a session/i }).click();

    const dialog = tutor.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Save draft' })).toBeVisible();

    await dialog.getByRole('combobox').first().click();
    await tutor.getByRole('option').first().click();
    await dialog.getByLabel(/notes/i).first().fill('Saved from the form.');
    await dialog.getByRole('button', { name: 'Save draft' }).click();

    const panel = tutor.getByRole('heading', { name: /Your drafts/ });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Only you can see/);

    // Picking it back up says what it is, and keeps what was written.
    await tutor.getByRole('button', { name: 'Edit' }).first().click();
    await expect(dialog.getByRole('heading', { name: 'Finish this draft' })).toBeVisible();
    await expect(dialog.getByLabel(/notes/i).first()).toHaveValue('Saved from the form.');

    await dialog.getByRole('button', { name: 'Post session' }).click();
    await expect(tutor.getByText('Your drafts')).toHaveCount(0);
  });
});

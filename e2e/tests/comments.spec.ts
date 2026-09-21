import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 12: comments on a person, a lesson, a pairing or a recurring slot.
 *
 * The rules worth a test are the ones a refactor could quietly break: who can
 * read a comment, that nobody can edit one, and that only its author may
 * withdraw it -- not even an admin.
 */
test.describe('comments', () => {
  test('a comment on a lesson reaches everyone that lesson concerns', async ({ as }) => {
    const tutor = await as('tutor');
    const sofiaId = await idOf(tutor, PEOPLE.student.email);

    const sessions = await unwrap<any[]>(
      await tutor.request.get(`/api/sessions?student_user_id=${sofiaId}&limit=1`),
      'listing sessions',
    );
    const sessionId = sessions[0].id;
    const body = `Covered ratios again — ${Date.now()}`;

    await unwrap(
      await tutor.request.post('/api/comments', {
        data: { target_type: 'session', target_id: sessionId, body },
      }),
      'posting a comment on a session',
    );

    // Her mother, who is also a tutor, reads it because it is her daughter's
    // lesson -- not because she teaches.
    const parent = await as('parentTutor');
    const asParent = await unwrap<{ comments: any[] }>(
      await parent.request.get(`/api/comments?target_type=session&target_id=${sessionId}`),
      'reading as the parent',
    );
    expect(asParent.comments.map((c) => c.body)).toContain(body);
    // Reading it is not the same as being allowed to remove it.
    expect(asParent.comments.find((c) => c.body === body)?.can_delete).toBe(false);

    // A tutor with no part in that lesson is not told it exists.
    const outsider = await as('studentTutor');
    const refused = await outsider.request.get(
      `/api/comments?target_type=session&target_id=${sessionId}`,
    );
    expect(refused.status()).toBe(404);
  });

  test('a comment about a person stays with the people it names', async ({ as }) => {
    // Looked up as an admin: a tutor's own user list is already scoped to the
    // people they may see, which is the very thing under test here.
    const admin = await as('admin');
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    const body = `Asked about exam dates — ${Date.now()}`;

    // Alex does not teach Sanjay, so he cannot open that record even with the
    // id in hand.
    const tutor = await as('tutor');
    const refused = await tutor.request.post('/api/comments', {
      data: { target_type: 'user', target_id: sanjayId, body },
    });
    expect(refused.status()).toBe(404);

    // Priya does teach him, and writes it.
    const created = await unwrap<{ id: string }>(
      await admin.request.post('/api/comments', {
        data: { target_type: 'user', target_id: sanjayId, body },
      }),
      'commenting on a person',
    );

    // Sanjay reads what was written about him, and so does his mother.
    for (const who of ['studentTutor', 'parent'] as const) {
      const page = await as(who);
      const thread = await unwrap<{ comments: any[] }>(
        await page.request.get(`/api/comments?target_type=user&target_id=${sanjayId}`),
        `reading as ${who}`,
      );
      expect(thread.comments.map((c) => c.body)).toContain(body);
    }

    // Nobody can edit a comment: there is no route that would.
    const edit = await admin.request.fetch(`/api/comments/${created.id}`, {
      method: 'PATCH',
      data: { body: 'rewritten' },
    });
    expect(edit.status()).toBe(404);

    // The student it is about cannot remove it; its author can.
    const subject = await as('studentTutor');
    expect((await subject.request.delete(`/api/comments/${created.id}`)).status()).toBe(403);
    expect((await admin.request.delete(`/api/comments/${created.id}`)).status()).toBe(204);

    const after = await unwrap<{ comments: any[] }>(
      await admin.request.get(`/api/comments?target_type=user&target_id=${sanjayId}`),
      'reading after withdrawal',
    );
    expect(after.comments.map((c) => c.body)).not.toContain(body);
  });

  test('the global feed shows each person only what their threads would', async ({ as }) => {
    const admin = await as('admin');
    const everything = await unwrap<any[]>(
      await admin.request.get('/api/comments/feed?limit=50'),
      'reading the feed as an admin',
    );
    expect(everything.length).toBeGreaterThan(0);
    // Newest first, which is the whole point of the view.
    const dates = everything.map((entry) => entry.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
    // Every entry names what it hangs off, so the row can link to it.
    for (const entry of everything) {
      expect(entry.target_label).toBeTruthy();
      expect(entry.target_id).toBeTruthy();
    }

    // A parent's feed is their own family's, and a strict subset of the
    // admin's -- the feed is a different view of the same comments, not a
    // wider one.
    const parent = await as('parent');
    const theirs = await unwrap<any[]>(
      await parent.request.get('/api/comments/feed?limit=50'),
      'reading the feed as a parent',
    );
    expect(theirs.length).toBeLessThan(everything.length);
    const adminIds = new Set(everything.map((entry) => entry.id));
    for (const entry of theirs) expect(adminIds.has(entry.id)).toBe(true);

    // Each of those is one they could have opened directly.
    for (const entry of theirs) {
      const thread = await parent.request.get(
        `/api/comments?target_type=${entry.target_type}&target_id=${entry.target_id}`,
      );
      expect(thread.status()).toBe(200);
    }
  });

  test('a comment in the feed links to the person and to the lesson', async ({ as }) => {
    const admin = await as('admin');

    await admin.goto('/comments');
    await expect(admin.getByRole('heading', { name: 'Comments' })).toBeVisible();

    // The author's name leads to their record.
    await admin.getByRole('link', { name: PEOPLE.tutor.name }).first().click();
    await expect(admin).toHaveURL(/\/users\?view=/);
    await expect(admin.getByRole('dialog').getByRole('heading', { name: PEOPLE.tutor.name }))
      .toBeVisible();

    // A comment on a lesson leads to that lesson, alone.
    await admin.goto('/comments');
    await admin.getByRole('link', { name: /session with/ }).first().click();
    await expect(admin).toHaveURL(/\/sessions\?focus=/);
    await expect(admin.getByText('Showing one session, linked from a comment.')).toBeVisible();

    await admin.getByRole('button', { name: 'Show all' }).click();
    await expect(admin.getByText('Showing one session, linked from a comment.')).toBeHidden();
  });

  test('a tutor can leave a comment on a student and see it in the UI', async ({ as }) => {
    const tutor = await as('tutor');
    const body = `Ready for the accelerated set — ${Date.now()}`;
    const sofiaId = await idOf(tutor, PEOPLE.student.email);

    await tutor.goto('/users');
    await tutor.getByPlaceholder(/Search/i).first().fill(PEOPLE.student.name);
    await tutor.getByRole('button', { name: PEOPLE.student.name, exact: true }).first().click();

    const record = tutor.getByRole('dialog');
    await expect(record.getByRole('heading', { name: 'Comments' })).toBeVisible();

    await record.getByLabel('Write a comment').fill(body);
    await record.getByRole('button', { name: 'Post' }).click();
    await expect(record.getByText(body)).toBeVisible();

    // An admin sees it on the same record.
    const admin = await as('admin');
    const thread = await unwrap<{ comments: any[] }>(
      await admin.request.get(`/api/comments?target_type=user&target_id=${sofiaId}`),
      'reading as an admin',
    );
    expect(thread.comments.map((c) => c.body)).toContain(body);

    // Tidy up after ourselves: the author is the only one who can.
    const mine = thread.comments.find((c) => c.body === body);
    expect((await tutor.request.delete(`/api/comments/${mine.id}`)).status()).toBe(204);
  });
});

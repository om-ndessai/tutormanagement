import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Autosave on the record-session form (2026-10).
 *
 * The rules worth holding: what a tutor types is kept as their own draft every
 * few seconds, the log gains nothing for it, and recording the lesson consumes
 * that draft -- one write-up never becomes a session AND a draft.
 */

/** The tutor's own drafts, cleared so a leftover cannot satisfy a check. */
async function clearDrafts(tutor: Page) {
  const drafts = await unwrap<any[]>(await tutor.request.get('/api/sessions/drafts'), 'drafts');
  for (const draft of drafts) await tutor.request.delete(`/api/sessions/drafts/${draft.id}`);
}

async function draftActions(admin: Page, draftId: string) {
  const events = await unwrap<any[]>(
    await admin.request.get('/api/audit?limit=200'),
    'the log',
  );
  return events.filter((event) => event.entity_id === draftId).map((event) => event.action);
}

async function openRecordForm(tutor: Page) {
  await tutor.goto('/sessions');
  await tutor.getByRole('button', { name: /Record a session/i }).click();
  const dialog = tutor.getByRole('dialog');
  await dialog.getByRole('combobox').first().click();
  await tutor.getByRole('option').first().click();
  return dialog;
}

test.describe('autosaving a write-up', () => {
  test('keeps the notes as a draft while typing, quietly, and recording consumes it', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    await clearDrafts(tutor);

    const dialog = await openRecordForm(tutor);
    const marker = `Autosaved notes ${Date.now()}`;
    await dialog.getByLabel('Session notes', { exact: true }).fill(marker);
    await expect(dialog.getByTestId('autosave-status')).toContainText('Draft autosaved', { timeout: 10_000 });

    let drafts = await unwrap<any[]>(await tutor.request.get('/api/sessions/drafts'), 'drafts');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].notes).toBe(marker);
    const draftId = drafts[0].id;

    // Typing on updates the same draft, still without a word in the log.
    await dialog.getByLabel('Session notes', { exact: true }).fill(`${marker} and more`);
    await expect
      .poll(async () => {
        const list = await unwrap<any[]>(await tutor.request.get('/api/sessions/drafts'), 'drafts');
        return list.map((draft) => draft.notes);
      }, { timeout: 10_000 })
      .toEqual([`${marker} and more`]);
    expect(await draftActions(admin, draftId)).toEqual([]);

    await dialog.getByRole('button', { name: 'Record session' }).click();
    await expect(dialog).toBeHidden();

    drafts = await unwrap<any[]>(await tutor.request.get('/api/sessions/drafts'), 'drafts');
    expect(drafts).toHaveLength(0);
    // Consumed silently: the lesson's own line is the record of it.
    expect(await draftActions(admin, draftId)).toEqual([]);
    const sessions = await unwrap<any[]>(
      await tutor.request.get(`/api/sessions?limit=20&sort=created_at&direction=desc`),
      'sessions',
    );
    expect(sessions.filter((session) => session.notes === `${marker} and more`)).toHaveLength(1);
  });

  test('closing the form keeps what was written as a draft', async ({ as }) => {
    const tutor = await as('tutor');
    await clearDrafts(tutor);

    const dialog = await openRecordForm(tutor);
    const marker = `Left mid-lesson ${Date.now()}`;
    await dialog.getByLabel('Session notes', { exact: true }).fill(marker);
    // Closed at once, before the next tick: the closing save keeps it.
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(tutor.getByText(/kept as a draft/)).toBeVisible();
    const drafts = await unwrap<any[]>(await tutor.request.get('/api/sessions/drafts'), 'drafts');
    expect(drafts.map((draft) => draft.notes)).toEqual([marker]);
    await clearDrafts(tutor);
  });

  test('an autosave writes no log line; pressing Save draft does', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const body = {
      tutor_user_id: await idOf(admin, PEOPLE.tutor.email),
      student_user_id: await idOf(admin, PEOPLE.student.email),
      occurred_on: '2026-09-21',
      started_at: '16:00',
      ended_at: '17:00',
      mode: 'in_person',
      notes: 'Typing…',
    };

    const draft = await unwrap<any>(
      await tutor.request.post('/api/sessions/drafts?autosave=true', { data: body }),
      'autosave',
    );
    await tutor.request.patch(`/api/sessions/drafts/${draft.id}?autosave=true`, { data: body });
    expect(await draftActions(admin, draft.id)).toEqual([]);

    await tutor.request.patch(`/api/sessions/drafts/${draft.id}`, { data: body });
    expect(await draftActions(admin, draft.id)).toEqual(['session.drafted']);

    await tutor.request.delete(`/api/sessions/drafts/${draft.id}`);
  });

  test('recording can only consume the recorder’s own draft', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const body = {
      tutor_user_id: await idOf(admin, PEOPLE.tutor.email),
      student_user_id: await idOf(admin, PEOPLE.student.email),
      occurred_on: '2026-09-21',
      started_at: '16:00',
      ended_at: '17:00',
      mode: 'in_person',
    };
    const theirs = await unwrap<any>(
      await admin.request.post('/api/sessions/drafts?autosave=true', { data: body }),
      'admin draft',
    );

    const response = await tutor.request.post('/api/sessions', {
      data: { ...body, from_draft_id: theirs.id },
    });
    expect(response.status()).toBe(404);
    // Refused before anything was written: the admin's draft is untouched.
    const adminDrafts = await unwrap<any[]>(await admin.request.get('/api/sessions/drafts'), 'drafts');
    expect(adminDrafts.map((draft) => draft.id)).toContain(theirs.id);

    await admin.request.delete(`/api/sessions/drafts/${theirs.id}`);
  });
});

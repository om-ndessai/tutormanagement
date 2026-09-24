import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 24: one lesson of a standing schedule called off, and put back.
 *
 * The rules worth holding: the tutor, a parent or the office may cancel, a
 * student may not, and nobody the schedule does not concern can find it; a
 * parent only from today on, and restores only their own; a recorded lesson
 * outranks a cancellation; progress stops counting a cancelled lesson as
 * missed; and the note reaches only the schedule's own audience.
 *
 * Each test makes its own Wednesday 3pm slot for Alex and Sofia (her real
 * lessons are Tuesdays) and takes its dates from the API, so nothing here
 * depends on what day the suite runs.
 */

async function makeSlot(admin: Page, extra: Record<string, unknown> = {}) {
  return unwrap<any>(
    await admin.request.post('/api/schedules', {
      data: {
        tutor_user_id: await idOf(admin, PEOPLE.tutor.email),
        student_user_id: await idOf(admin, PEOPLE.student.email),
        day_of_week: 3,
        start_time: '15:00',
        duration_minutes: 60,
        mode: 'in_person',
        starts_on: '2026-09-02',
        location: 'Room 3',
        notes: 'Phase 24 test slot',
        ...extra,
      },
    }),
    'creating a test slot',
  );
}

/** The slot's coming dates, as the API dates them, with any cancellation. */
async function comingDates(page: Page, scheduleId: string, limit = 4): Promise<any[]> {
  return unwrap<any[]>(
    await page.request.get(`/api/schedules/upcoming?schedule_id=${scheduleId}&limit=${limit}`),
    'reading the dates',
  );
}

const cancel = (page: Page, scheduleId: string, data: Record<string, unknown>) =>
  page.request.post(`/api/schedules/${scheduleId}/cancellations`, { data });

const restore = (page: Page, scheduleId: string, date: string) =>
  page.request.delete(`/api/schedules/${scheduleId}/cancellations/${date}`);

test.describe('cancelling one lesson of a schedule', () => {
  test('a parent cancels a date with a note, and puts it back', async ({ as }) => {
    const admin = await as('admin');
    const maria = await as('parentTutor');
    const slot = await makeSlot(admin);

    try {
      const [first, second] = await comingDates(maria, slot.id);

      const created = await unwrap<any>(
        await cancel(maria, slot.id, { occurs_on: first.occurs_on, note: 'Half-term trip.' }),
        'cancelling',
      );
      expect(created).toMatchObject({ cancelled_as: 'parent', note: 'Half-term trip.', can_restore: true });

      // Flagged in place, and only that week.
      const [flagged, following] = await comingDates(maria, slot.id);
      expect(flagged.occurs_on).toBe(first.occurs_on);
      expect(flagged.cancellation).toMatchObject({ cancelled_as: 'parent', note: 'Half-term trip.' });
      expect(following.occurs_on).toBe(second.occurs_on);
      expect(following.cancellation).toBeNull();

      // The calendar file leaves it out, at the series' own start time.
      const exdate = `EXDATE:${first.occurs_on.replace(/-/g, '')}T150000`;
      const ics = await (await maria.request.get(`/api/schedules/${slot.id}/calendar.ics`)).text();
      expect(ics).toContain(exdate);
      expect(ics).not.toContain('Half-term trip.');

      expect((await restore(maria, slot.id, first.occurs_on)).status()).toBe(204);
      const [back] = await comingDates(maria, slot.id);
      expect(back.cancellation).toBeNull();
      const after = await (await maria.request.get(`/api/schedules/${slot.id}/calendar.ics`)).text();
      expect(after).not.toContain(exdate);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('a student cannot cancel, and nobody else can find the schedule', async ({ as }) => {
    const admin = await as('admin');
    const slot = await makeSlot(admin);

    try {
      const [first] = await comingDates(admin, slot.id);

      // Sofia can see her own slot but may not call off its lessons.
      expect((await cancel(await as('student'), slot.id, { occurs_on: first.occurs_on })).status()).toBe(403);

      // Another family's parent, and a tutor who does not teach her: missing.
      for (const who of ['parent', 'studentTutor'] as const) {
        const page = await as(who);
        expect((await cancel(page, slot.id, { occurs_on: first.occurs_on })).status()).toBe(404);
        expect((await restore(page, slot.id, first.occurs_on)).status()).toBe(404);
      }
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('only a date the series falls on, and a parent only from today on', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const maria = await as('parentTutor');
    const slot = await makeSlot(admin, { ends_on: '2027-06-30' });

    try {
      const [first] = await comingDates(maria, slot.id);
      const thursday = new Date(`${first.occurs_on}T12:00:00Z`);
      thursday.setUTCDate(thursday.getUTCDate() + 1);

      const refused = async (page: Page, data: Record<string, unknown>) => {
        const response = await cancel(page, slot.id, data);
        expect(response.status(), JSON.stringify(data)).toBe(422);
        return (await response.json()).error.details;
      };

      expect(await refused(maria, { occurs_on: thursday.toISOString().slice(0, 10) })).toHaveProperty('occurs_on');
      expect(await refused(maria, { occurs_on: '2026-08-26' })).toHaveProperty('occurs_on'); // before it starts
      expect(await refused(maria, { occurs_on: '2027-07-07' })).toHaveProperty('occurs_on'); // after it ends
      expect(await refused(maria, { occurs_on: '2026-02-31' })).toHaveProperty('occurs_on');
      expect(await refused(maria, { occurs_on: first.occurs_on, note: 'His is 123-45-6789' })).toHaveProperty('note');

      // A past date: not for a parent, but the tutor may mark it.
      expect(await refused(maria, { occurs_on: '2026-09-09' })).toHaveProperty('occurs_on');
      expect((await cancel(alex, slot.id, { occurs_on: '2026-09-09' })).status()).toBe(201);
      expect((await cancel(alex, slot.id, { occurs_on: '2026-09-09' })).status()).toBe(409);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('the tutor restores anybody’s, a parent only their own', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const maria = await as('parentTutor');
    const slot = await makeSlot(admin);

    try {
      const [first, second] = await comingDates(maria, slot.id);

      // The tutor is off sick: the parent cannot put that lesson back.
      await unwrap(await cancel(alex, slot.id, { occurs_on: first.occurs_on, note: 'Unwell.' }), 'tutor cancels');
      const [seen] = await comingDates(maria, slot.id);
      expect(seen.cancellation.can_restore).toBe(false);
      expect((await restore(maria, slot.id, first.occurs_on)).status()).toBe(403);

      // The family's own cancellation, the tutor can.
      await unwrap(await cancel(maria, slot.id, { occurs_on: second.occurs_on }), 'parent cancels');
      expect((await restore(alex, slot.id, second.occurs_on)).status()).toBe(204);
      expect((await restore(alex, slot.id, second.occurs_on)).status()).toBe(404);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('a lesson recorded on a cancelled date outranks the cancellation', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const slot = await makeSlot(admin);

    try {
      const [first] = await comingDates(alex, slot.id);
      await unwrap(await cancel(alex, slot.id, { occurs_on: first.occurs_on }), 'cancelling');

      const listed = async () =>
        (await unwrap<any[]>(
          await alex.request.get(`/api/schedules/cancellations?schedule_id=${slot.id}`),
          'listing',
        )).map((row) => row.occurs_on);
      expect(await listed()).toContain(first.occurs_on);

      // It went ahead after all: the lesson is recorded, and wins.
      const session = await unwrap<any>(
        await alex.request.post('/api/sessions', {
          data: {
            tutor_user_id: slot.tutor_user_id,
            student_user_id: slot.student_user_id,
            occurred_on: first.occurs_on,
            started_at: '15:00',
            ended_at: '16:00',
            mode: 'in_person',
          },
        }),
        'recording the lesson',
      );
      expect(await listed()).not.toContain(first.occurs_on);

      // Deleting the lesson brings the cancellation back.
      await admin.request.delete(`/api/sessions/${session.id}`);
      expect(await listed()).toContain(first.occurs_on);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('a cancelled lesson is not counted as a missed one', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const slot = await makeSlot(admin);

    try {
      const summary = async () =>
        (await unwrap<any>(await alex.request.get(`/api/progress/${sofiaId}`), 'progress')).summary;

      const before = await summary();
      // A past Wednesday inside her plan (it began 2026-09-01), with no lesson.
      await unwrap(await cancel(alex, slot.id, { occurs_on: '2026-09-16', note: 'Room closed.' }), 'cancelling');
      const after = await summary();

      expect(after.sessions_cancelled_to_date).toBe(before.sessions_cancelled_to_date + 1);
      expect(after.sessions_planned_to_date).toBe(before.sessions_planned_to_date - 1);

      const progress = await unwrap<any>(await alex.request.get(`/api/progress/${sofiaId}`), 'progress');
      expect(progress.cancellations).toContainEqual(
        expect.objectContaining({ occurs_on: '2026-09-16', note: 'Room closed.', cancelled_as: 'tutor' }),
      );
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('progress shows a cancellation to every reader, its note only to the schedule’s', async ({ as }) => {
    // Seeded: Alex cancelled Ben's Saturday lesson on 2026-09-19, "Tutor
    // unwell." Sanjay also teaches Ben, so he reads Ben's progress -- but not
    // Alex's schedule with him.
    const admin = await as('admin');
    const benId = await idOf(admin, 'Ben Whitfield');

    const read = async (who: 'studentTutor' | 'tutor') =>
      unwrap<any>(await (await as(who)).request.get(`/api/progress/${benId}`), `Ben as ${who}`);

    const sanjay = await read('studentTutor');
    const alex = await read('tutor');

    const bySanjay = sanjay.cancellations.find((row: any) => row.occurs_on === '2026-09-19');
    expect(bySanjay).toMatchObject({ cancelled_as: 'tutor', note: null, cancelled_by_name: null });
    const byAlex = alex.cancellations.find((row: any) => row.occurs_on === '2026-09-19');
    expect(byAlex).toMatchObject({ note: 'Tutor unwell.', cancelled_by_name: PEOPLE.tutor.name });

    // The counts are the same for both: only the details are the schedule's.
    expect(sanjay.summary).toEqual(alex.summary);
  });

  test('moving the slot clears the cancellations it no longer falls on', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const slot = await makeSlot(admin);

    try {
      const [first] = await comingDates(alex, slot.id);
      await unwrap(await cancel(alex, slot.id, { occurs_on: first.occurs_on }), 'future');
      await unwrap(await cancel(alex, slot.id, { occurs_on: '2026-09-09' }), 'past');

      // Wednesdays to Thursdays: the coming Wednesday is gone; the past one
      // stays, as the record of what happened.
      await unwrap(await alex.request.patch(`/api/schedules/${slot.id}`, { data: { day_of_week: 4 } }), 'moving');
      const left = await unwrap<any[]>(
        await admin.request.get(`/api/schedules/cancellations?schedule_id=${slot.id}`),
        'listing',
      );
      expect(left.map((row) => row.occurs_on)).toEqual(['2026-09-09']);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('an edit that leaves fields out keeps them', async ({ as }) => {
    const admin = await as('admin');
    const slot = await makeSlot(admin, { ends_on: '2027-06-30' });

    try {
      const after = await unwrap<any>(
        await admin.request.patch(`/api/schedules/${slot.id}`, { data: { is_active: true } }),
        'a one-field edit',
      );
      expect(after).toMatchObject({
        ends_on: '2027-06-30',
        location: 'Room 3',
        notes: 'Phase 24 test slot',
      });
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('the Schedule page cancels a date with a note, and restores it', async ({ as }) => {
    const admin = await as('admin');
    const maria = await as('parentTutor');
    const slot = await makeSlot(admin);

    try {
      const [first] = await comingDates(maria, slot.id);

      // A link to one slot opens its dates by itself.
      await maria.goto(`/schedule?focus=${slot.id}`);
      await maria.getByRole('button', { name: /^Cancel the lesson on/ }).first().click();

      const dialog = maria.getByRole('dialog');
      await dialog.getByLabel('Note').fill('Grandparents visiting.');
      await dialog.getByRole('button', { name: 'Cancel lesson' }).click();
      await expect(dialog).toHaveCount(0);

      const row = maria.locator('li[data-cancelled="true"]');
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Cancelled');
      await expect(row).toContainText('Grandparents visiting.');
      await expect(row).toContainText(PEOPLE.parentTutor.name);

      await row.getByRole('button', { name: /^Restore the lesson on/ }).click();
      await maria.getByRole('alertdialog').getByRole('button', { name: 'Restore lesson' }).click();
      await expect(row).toHaveCount(0);

      const [back] = await comingDates(maria, slot.id);
      expect(back.occurs_on).toBe(first.occurs_on);
      expect(back.cancellation).toBeNull();
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });

  test('the dashboard shows a cancelled lesson, and “next” skips it', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const alexId = await idOf(admin, PEOPLE.tutor.email);

    const [next] = await unwrap<any[]>(
      await alex.request.get(`/api/schedules/upcoming?tutor_user_id=${alexId}&limit=1`),
      'Alex’s next lesson',
    );
    await unwrap(
      await cancel(alex, next.schedule_id, { occurs_on: next.occurs_on, note: 'Test: called off.' }),
      'cancelling his next lesson',
    );

    try {
      await alex.goto('/');
      const sessions = alex.getByRole('region', { name: 'Tutoring Sessions' });
      const cancelled = sessions.getByRole('link', { name: /^Cancelled session:/ }).first();
      await expect(cancelled).toBeVisible();
      await expect(cancelled).toContainText('Test: called off.');
      await expect(cancelled).toHaveAttribute('href', `/schedule?focus=${next.schedule_id}&on=${next.occurs_on}`);

      // The highlighted card is the next lesson actually happening: it comes
      // after the cancelled one in the strip, not in its place.
      await expect(sessions.getByRole('link', { name: /^Next session:/ })).toBeVisible();
      await expect(
        sessions.locator('a[aria-label^="Cancelled session:"] ~ a[data-anchor="next"]'),
      ).toHaveCount(1);
    } finally {
      await restore(alex, next.schedule_id, next.occurs_on);
    }
  });

  test('the sessions page lists cancellations, with Restore only where allowed', async ({ as }) => {
    const admin = await as('admin');
    const alex = await as('tutor');
    const maria = await as('parentTutor');
    const slot = await makeSlot(admin);

    try {
      const [first, second] = await comingDates(maria, slot.id);
      await unwrap(await cancel(alex, slot.id, { occurs_on: first.occurs_on, note: 'Tutor away.' }), 'tutor');
      await unwrap(await cancel(maria, slot.id, { occurs_on: second.occurs_on, note: 'Family away.' }), 'parent');

      await maria.goto('/sessions');
      const panel = maria.locator('div').filter({ has: maria.getByRole('heading', { name: /Cancelled lessons/ }) }).last();
      await expect(panel).toBeVisible();

      const byTutor = panel.getByRole('listitem').filter({ hasText: 'Tutor away.' });
      const byFamily = panel.getByRole('listitem').filter({ hasText: 'Family away.' });
      await expect(byTutor).toBeVisible();
      await expect(byFamily).toBeVisible();
      await expect(byTutor.getByRole('button', { name: /^Restore/ })).toHaveCount(0);
      await expect(byFamily.getByRole('button', { name: /^Restore/ })).toBeVisible();

      // Not on the Finance tab: teaching lives on Tutoring.
      await maria.goto('/sessions?tab=finance');
      await expect(maria.getByRole('heading', { name: /Cancelled lessons/ })).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
    }
  });
});

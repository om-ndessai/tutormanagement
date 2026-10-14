import { PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';

/**
 * Phase 33: preferred tutoring locations. A person's own places, a pairing's allowed set, and a
 * schedule's chosen ones -- at least one, at most one of each kind -- plus the reminder sheet.
 */

/** HH:MM on the organization's clock (the institute's), `minutes` from now. */
function clockIn(minutes: number): { date: string; time: string; weekday: number } {
  const at = new Date(Date.now() + minutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour}:${parts.minute}`, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

test.describe('tutoring locations', () => {
  test('a schedule needs a location, and never two of one kind', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const [pairing] = await unwrap<any[]>(
      await admin.request.get(`/api/assignments?tutor_user_id=${tutorId}&student_user_id=${sofiaId}`),
      'the pairing',
    );
    const physical = pairing.locations.filter((l: any) => l.kind === 'physical').map((l: any) => l.id);
    const virtual = pairing.locations.find((l: any) => l.kind === 'virtual').id;
    expect(physical.length).toBeGreaterThanOrEqual(2);

    const slot = (location_ids: string[]) => ({
      data: {
        tutor_user_id: tutorId,
        student_user_id: sofiaId,
        day_of_week: 3,
        start_time: '15:00',
        duration_minutes: 60,
        starts_on: '2026-10-21',
        location_ids,
      },
    });
    expect((await admin.request.post('/api/schedules', slot([]))).status()).toBe(422);
    const twoPhysical = await admin.request.post('/api/schedules', slot(physical.slice(0, 2)));
    expect(twoPhysical.status()).toBe(422);
    expect(JSON.stringify(await twoPhysical.json())).toContain('only one in person');

    const created = await unwrap<any>(await admin.request.post('/api/schedules', slot([physical[0], virtual])), 'one of each');
    expect(created.locations.map((l: any) => l.kind).sort()).toEqual(['physical', 'virtual']);

    // In use: it cannot be deleted, nor taken away from the pairing.
    expect((await admin.request.delete(`/api/locations/${virtual}`)).status()).toBe(409);
    const narrowed = await admin.request.put(`/api/assignments/${pairing.id}/locations`, {
      data: { location_ids: physical },
    });
    expect(narrowed.status()).toBe(422);

    // Online only is allowed.
    const online = await unwrap<any>(
      await admin.request.patch(`/api/schedules/${created.id}`, { data: { location_ids: [virtual] } }),
      'online only',
    );
    expect(online.locations.map((l: any) => l.kind)).toEqual(['virtual']);
    expect((await admin.request.delete(`/api/schedules/${created.id}`)).status()).toBe(204);
  });

  test('a pairing only takes its own two people’s locations, set by the office', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    const [pairing] = await unwrap<any[]>(
      await admin.request.get(`/api/assignments?tutor_user_id=${tutorId}&student_user_id=${sofiaId}`),
      'the pairing',
    );
    const [sanjays] = await unwrap<any[]>(await admin.request.get(`/api/locations?user_id=${sanjayId}`), 'Sanjay\'s locations');
    const keep = pairing.locations.map((l: any) => l.id);

    const outsider = await admin.request.put(`/api/assignments/${pairing.id}/locations`, {
      data: { location_ids: [...keep, sanjays.id] },
    });
    expect(outsider.status()).toBe(422);
    expect((await tutor.request.put(`/api/assignments/${pairing.id}/locations`, { data: { location_ids: keep } })).status()).toBe(403);
  });

  test('a parent manages their child’s locations, and nobody else’s', async ({ as }) => {
    const admin = await as('admin');
    const maria = await as('parentTutor');
    const anita = await as('parent');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);

    const added = await unwrap<any>(
      await maria.request.post('/api/locations', {
        data: { owner_user_id: sofiaId, name: 'Grandma’s', kind: 'physical', address: '1 Oak St', reminder_minutes: 30 },
      }),
      'Maria adding one for Sofia',
    );
    expect(added.owner_user_id).toBe(sofiaId);

    // Anita is not Sofia's parent: Sofia's list reads empty, the location reads as missing.
    expect(await unwrap<any[]>(await anita.request.get(`/api/locations?user_id=${sofiaId}`), 'Anita reading')).toEqual([]);
    expect((await anita.request.patch(`/api/locations/${added.id}`, { data: { name: 'x' } })).status()).toBe(404);
    expect((await anita.request.post('/api/locations', {
      data: { owner_user_id: sofiaId, name: 'x', kind: 'virtual' },
    })).status()).toBe(404);
    // Her own child's are hers to manage.
    expect((await anita.request.get(`/api/locations?user_id=${sanjayId}`)).status()).toBe(200);

    expect((await maria.request.delete(`/api/locations/${added.id}`)).status()).toBe(204);
  });

  test('an admin adds a location on a person’s record and a schedule uses it', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    // The record: add one for Sofia.
    await admin.goto(`/users?view=${sofiaId}`);
    await admin.getByRole('heading', { name: 'Locations' }).waitFor();
    await admin.getByRole('button', { name: 'Add a location' }).click();
    await admin.getByLabel('Name', { exact: true }).fill('Community centre');
    await admin.getByLabel(/^Address/).fill('2 Elm St');
    await admin.getByRole('button', { name: 'Add location' }).click();
    await expect(visible(admin, 'Community centre').first()).toBeVisible();

    const mine = await unwrap<any[]>(await admin.request.get(`/api/locations?user_id=${sofiaId}`), 'Sofia\'s');
    const centre = mine.find((l) => l.name === 'Community centre');
    const [pairing] = await unwrap<any[]>(
      await admin.request.get(`/api/assignments?tutor_user_id=${tutorId}&student_user_id=${sofiaId}`),
      'the pairing',
    );
    await unwrap(
      await admin.request.put(`/api/assignments/${pairing.id}/locations`, {
        data: { location_ids: [...pairing.locations.map((l: any) => l.id), centre.id] },
      }),
      'allowing it',
    );

    const slot = await unwrap<any>(
      await admin.request.post('/api/schedules', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: sofiaId,
          day_of_week: 5,
          start_time: '14:00',
          duration_minutes: 60,
          starts_on: '2026-10-23',
          location_ids: [centre.id],
        },
      }),
      'scheduling there',
    );
    await admin.goto('/schedule');
    await expect(visible(admin, /Community centre/).first()).toBeVisible();

    await admin.request.delete(`/api/schedules/${slot.id}`);
    await admin.request.put(`/api/assignments/${pairing.id}/locations`, {
      data: { location_ids: pairing.locations.map((l: any) => l.id) },
    });
    expect((await admin.request.delete(`/api/locations/${centre.id}`)).status()).toBe(204);
  });

  test('a lesson about to start rises as a reminder sheet, once', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const soon = clockIn(20);
    test.skip(soon.date !== clockIn(0).date, 'Too close to midnight to schedule a lesson today.');

    // A pupil of their own: a lesson already recorded today for a seeded pair would (rightly) keep
    // today's date out of the upcoming list, and the seed records lessons up to today.
    const stamp = Date.now();
    const parent = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { email: `reminder.parent.${stamp}@example.com`, full_name: `Reminder Parent ${stamp}`, roles: ['parent'] },
      }),
      'a parent',
    );
    const student = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: `Reminder Student ${stamp}`,
          roles: ['student'],
          student_profile: { virtual_available: true },
          guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a student',
    );
    const reminding = await unwrap<any>(
      await admin.request.post('/api/locations', {
        data: { owner_user_id: tutorId, name: 'Reminder room', kind: 'virtual', address: 'https://meet.example.com/soon', reminder_minutes: 45 },
      }),
      'a location that reminds',
    );
    const pairing = await unwrap<any>(
      await admin.request.post('/api/assignments', {
        data: { tutor_user_id: tutorId, student_user_id: student.id, is_active: true },
      }),
      'the pairing',
    );
    await unwrap(
      await admin.request.put(`/api/assignments/${pairing.id}/locations`, { data: { location_ids: [reminding.id] } }),
      'allowing it',
    );
    const slot = await unwrap<any>(
      await admin.request.post('/api/schedules', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: student.id,
          day_of_week: soon.weekday,
          start_time: soon.time,
          duration_minutes: 60,
          starts_on: soon.date,
          ends_on: soon.date,
          location_ids: [reminding.id],
        },
      }),
      'a lesson in 20 minutes',
    );

    try {
      await tutor.goto('/');
      const sheet = tutor.getByTestId('lesson-reminder');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('Your lesson starts in');
      await expect(sheet).toContainText('Reminder room');
      await sheet.getByRole('button', { name: 'Dismiss reminder' }).click();
      await expect(sheet).toHaveCount(0);
      await tutor.reload();
      await expect(tutor.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(tutor.getByTestId('lesson-reminder')).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/schedules/${slot.id}`);
      await admin.request.put(`/api/assignments/${pairing.id}/locations`, { data: { location_ids: [] } });
      await admin.request.delete(`/api/locations/${reminding.id}`);
      await admin.request.patch(`/api/assignments/${pairing.id}`, { data: { is_active: false } });
      await admin.request.delete(`/api/users/${student.id}`);
      await admin.request.delete(`/api/users/${parent.id}`);
    }
  });
});

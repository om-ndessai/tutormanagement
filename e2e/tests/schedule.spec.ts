import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/** Phase 9: standing weekly lessons, downloadable as a calendar invite. */
test.describe('recurring schedules', () => {
  test('a parent sees only their own child\'s slot, and can download it', async ({ as }) => {
    // Maria is Sofia's mother and a tutor; she must not see other families.
    const parent = await as('parentTutor');
    await parent.goto('/schedule');

    await expect(parent.getByText(PEOPLE.student.name).first()).toBeVisible();
    await expect(parent.getByText('Ben Whitfield')).toHaveCount(0);

    const ics = await parent.request.get('/api/schedules/calendar.ics');
    expect(ics.status()).toBe(200);
    expect(ics.headers()['content-type']).toContain('text/calendar');
    expect(ics.headers()['content-disposition']).toContain('attachment');

    const body = await ics.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    // Weekly recurrence with an explicit weekday is the whole point.
    expect(body).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=[A-Z]{2}/);
    expect(body).toContain(PEOPLE.student.name);
    // Another family's lesson must not be in the file.
    expect(body).not.toContain('Ben Whitfield');
  });

  test('a tutor can schedule a recurring session for an assigned student', async ({ as }) => {
    const tutor = await as('tutor');

    const students = await unwrap<any[]>(
      await tutor.request.get('/api/assignments'),
      'listing assignments',
    );
    const target = students[0]!;

    const created = await unwrap<any>(
      await tutor.request.post('/api/schedules', {
        data: {
          tutor_user_id: target.tutor_user_id,
          student_user_id: target.student_user_id,
          day_of_week: 3,
          start_time: '15:30',
          duration_minutes: 45,
          mode: 'virtual',
          starts_on: '2026-10-07',
          ends_on: '2026-12-16',
          location: 'https://meet.example.com/e2e',
        },
      }),
      'creating a schedule',
    );

    expect(created.day_of_week).toBe(3);
    expect(created.duration_minutes).toBe(45);

    // The generated event starts on the first matching weekday, not merely on
    // the requested start date.
    const ics = await (await tutor.request.get(`/api/schedules/${created.id}/calendar.ics`)).text();
    expect(ics).toContain('BYDAY=WE');
    expect(ics).toContain('UNTIL=20261216');
    expect(ics).toContain('LOCATION:https://meet.example.com/e2e');

    await tutor.request.delete(`/api/schedules/${created.id}`);
  });

  test('a tutor cannot schedule for a student who is not theirs', async ({ as }) => {
    const tutor = await as('tutor');
    const other = await as('studentTutor');

    const mine = await unwrap<any[]>(
      await tutor.request.get('/api/assignments'),
      'listing assignments',
    );

    // Sanjay trying to schedule one of Alex's students.
    const refused = await other.request.post('/api/schedules', {
      data: {
        tutor_user_id: mine[0]!.tutor_user_id,
        student_user_id: mine[0]!.student_user_id,
        day_of_week: 1,
        start_time: '09:00',
        duration_minutes: 60,
        mode: 'in_person',
        starts_on: '2026-10-05',
      },
    });

    expect(refused.status()).toBe(403);
  });
});

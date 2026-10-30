import { ORGS, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { pdfPageText, pdfStrings } from '../support/pdf.js';

/**
 * Phase 58: the progress report, GET /api/progress/:studentId/report.pdf
 * (docs/progress-report-plan.md). The progress page's audience exactly; the
 * lessons are the reader's own sessions list; no money anywhere.
 *
 * Signed-out (401) is not asserted here: the local suite runs with sign-in off.
 * The route sits under the guarded router, as every /api/progress route does.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A lesson's heading in the report: "Tue, Sep 15, 2026". */
function lessonHeading(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${MONTHS[month! - 1]} ${day}, ${year}`;
}

const RANGE = 'from=2026-01-01&to=2026-12-31';

test.describe('the progress report', () => {
  test('reaches exactly the progress page’s audience, as a PDF', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    for (const who of ['admin', 'tutor', 'parentTutor', 'student'] as const) {
      const response = await (await as(who)).request.get(`/api/progress/${sofiaId}/report.pdf?original=1`);
      expect(response.status(), who).toBe(200);
      expect(response.headers()['content-type']).toBe('application/pdf');
      expect(response.headers()['content-disposition']).toMatch(/^inline; filename="progress-sofia-okafor-\d{4}-\d{2}-\d{2}\.pdf"$/);
      expect(response.headers()['cache-control']).toBe('private, no-store');
      const bytes = await response.body();
      expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
      // No money: no amount, and nothing named in cents.
      const text = pdfPageText(bytes);
      expect(text).toContain('Progress report');
      expect(text).not.toContain('$');
      expect(text.toLowerCase()).not.toContain('cents');
      const strings = pdfStrings(bytes);
      expect(strings).toContain('Sofia Okafor');
      expect(strings).toContain('Original assessment');
    }

    // Another family's parent: the student does not exist.
    expect((await (await as('parent')).request.get(`/api/progress/${sofiaId}/report.pdf`)).status()).toBe(404);
    // Nor in another organization.
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });
    expect((await bAdmin.request.get(`/api/progress/${sofiaId}/report.pdf`)).status()).toBe(404);
  });

  test('a reversed or too long range is refused', async ({ as }) => {
    const admin = await as('admin');
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    for (const query of ['from=2026-10-01&to=2026-09-01', 'from=2024-01-01&to=2026-09-01', 'to=2026-08-01']) {
      const response = await admin.request.get(`/api/progress/${sofiaId}/report.pdf?${query}`);
      expect(response.status(), query).toBe(422);
      expect((await response.json()).error.code).toBe('validation_failed');
    }
    expect((await admin.request.get(`/api/progress/${sofiaId}/report.pdf?from=not-a-date`)).status()).toBe(422);
  });

  test('a tutor’s report lists only their own lessons, as their sessions page does', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    // Ben is taught by Alex and by Sanjay.
    const benId = await idOf(admin, 'Ben Whitfield');

    const datesOf = async (page: typeof admin) =>
      (await unwrap<any[]>(await page.request.get(`/api/sessions?student_user_id=${benId}&${RANGE}&limit=200`), 'sessions'))
        .map((session) => ({ heading: lessonHeading(session.occurred_on), tutor: session.tutor_name as string }));

    const all = await datesOf(admin);
    const own = await datesOf(tutor);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((row) => row.tutor === PEOPLE.tutor.name)).toBe(true);
    const others = all.filter((row) => row.tutor !== PEOPLE.tutor.name);
    expect(others.length).toBeGreaterThan(0);

    const tutorStrings = pdfStrings(await (await tutor.request.get(`/api/progress/${benId}/report.pdf?${RANGE}`)).body());
    const adminStrings = pdfStrings(await (await admin.request.get(`/api/progress/${benId}/report.pdf?${RANGE}`)).body());

    for (const row of own) expect(tutorStrings).toContain(row.heading);
    for (const row of all) expect(adminStrings).toContain(row.heading);
    // Sanjay's lessons are on the admin's report and nowhere in Alex's.
    expect(tutorStrings.some((text) => text.includes('Sanjay Patel  ·'))).toBe(false);
    expect(adminStrings.some((text) => text.includes('Sanjay Patel  ·'))).toBe(true);
    // "Sessions held" counts what is listed.
    expect(tutorStrings).toContain(`${own.length} in this range, newest first`);
    expect(adminStrings).toContain(`${all.length} in this range, newest first`);
  });

  test('a student without a plan still gets the lessons', async ({ as }) => {
    const admin = await as('admin');
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    const response = await admin.request.get(`/api/progress/${sanjayId}/report.pdf`);
    expect(response.status()).toBe(200);
    const strings = pdfStrings(await response.body());
    expect(strings).toContain('No learning plan yet');
    expect(strings).not.toContain('Timeline towards the goal');
    expect(strings).toContain('Sessions');
  });

  test('a lesson names the place of the schedule it fell on, and the calendar marks the schedules', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const stamp = Date.now();
    const parent = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { email: `place.parent.${stamp}@example.com`, full_name: `Place Parent ${stamp}`, roles: ['parent'] },
      }),
      'a parent',
    );
    const student = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: `Place Student ${stamp}`,
          roles: ['student'],
          student_profile: { charge_rate_in_person_cents: 6000 },
          guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a student',
    );
    const room = async (name: string) =>
      unwrap<any>(
        await admin.request.post('/api/locations', {
          data: { owner_user_id: tutorId, name, kind: 'physical', address: '1 Main St, Durham NC' },
        }),
        name,
      );
    const tuesdays = await room(`Library ${stamp}`);
    const thursdays = await room(`Studio ${stamp}`);
    const pairing = await unwrap<any>(
      await admin.request.post('/api/assignments', { data: { tutor_user_id: tutorId, student_user_id: student.id, is_active: true } }),
      'the pairing',
    );
    await unwrap(
      await admin.request.put(`/api/assignments/${pairing.id}/locations`, { data: { location_ids: [tuesdays.id, thursdays.id] } }),
      'allowing both',
    );
    // 2026-09-01 is a Tuesday.
    const series = async (day_of_week: number, location: string) =>
      unwrap<any>(
        await admin.request.post('/api/schedules', {
          data: {
            tutor_user_id: tutorId,
            student_user_id: student.id,
            day_of_week,
            start_time: '16:00',
            duration_minutes: 60,
            starts_on: '2026-09-01',
            ends_on: '2026-09-30',
            location_ids: [location],
          },
        }),
        'a series',
      );
    const schedules = [await series(2, tuesdays.id), await series(4, thursdays.id)];
    const lesson = async (occurred_on: string) =>
      unwrap<any>(
        await admin.request.post('/api/sessions', {
          data: { tutor_user_id: tutorId, student_user_id: student.id, occurred_on, started_at: '16:00', ended_at: '17:00', mode: 'in_person' },
        }),
        occurred_on,
      );
    const lessons = [await lesson('2026-09-08'), await lesson('2026-09-10')];
    // Tuesday the 15th is called off.
    await unwrap(
      await admin.request.post(`/api/schedules/${schedules[0].id}/cancellations`, { data: { occurs_on: '2026-09-15' } }),
      'a cancellation',
    );

    try {
      const strings = pdfStrings(await (await admin.request.get(`/api/progress/${student.id}/report.pdf?${RANGE}`)).body());
      expect(strings.filter((text) => text.endsWith(`${PEOPLE.tutor.name}  ·  In person, Library ${stamp}`))).toHaveLength(1);
      expect(strings.filter((text) => text.endsWith(`${PEOPLE.tutor.name}  ·  In person, Studio ${stamp}`))).toHaveLength(1);
      // September's nine scheduled dates (Tuesdays 1-29, Thursdays 3-24): two held, one cancelled, six left.
      expect(strings).toContain('Calendar');
      expect(strings).toContain('September 2026');
      expect(strings).toContain('2 held  ·  1 cancelled  ·  6 scheduled, not recorded');
    } finally {
      await admin.request.delete(`/api/schedules/${schedules[0].id}/cancellations/2026-09-15`);
      for (const row of lessons) await admin.request.delete(`/api/sessions/${row.id}`);
      for (const row of schedules) await admin.request.delete(`/api/schedules/${row.id}`);
      await admin.request.put(`/api/assignments/${pairing.id}/locations`, { data: { location_ids: [] } });
      for (const row of [tuesdays, thursdays]) await admin.request.delete(`/api/locations/${row.id}`);
      await admin.request.patch(`/api/assignments/${pairing.id}`, { data: { is_active: false } });
      await admin.request.delete(`/api/users/${student.id}`);
      await admin.request.delete(`/api/users/${parent.id}`);
    }
  });
});

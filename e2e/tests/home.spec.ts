import { test, expect } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * The tutor's Home (Phase 43, docs/tutor-home-plan.md): GET /api/home/tutor,
 * the "Now" card's lessons and the next lesson's brief. Only the reader's own
 * pairings, never money (R19). The seed's lessons fall on fixed weekdays, so
 * nothing here depends on the day the suite runs.
 */

test.describe('the tutor’s Home (Phase 43)', () => {
  test('a tutor gets their own next lesson and its brief, with no money', async ({ as }) => {
    const tutor = await as('tutor');
    const home = await unwrap<any>(await tutor.request.get('/api/home/tutor'), 'home');
    expect(['morning', 'afternoon', 'evening']).toContain(home.part_of_day);
    expect(home.next).toBeTruthy();
    expect(home.brief).toBeTruthy();
    expect(JSON.stringify(home)).not.toMatch(/cents|amount/);

    // Every lesson named is one of the tutor's own pairings.
    const pairings = await unwrap<any[]>(await tutor.request.get('/api/assignments'), 'pairings');
    const mine = new Set(pairings.filter((p) => p.tutor_name === 'Alex Chen').map((p) => p.student_user_id));
    for (const lesson of [home.next, ...home.unrecorded]) expect(mine.has(lesson.student_user_id)).toBe(true);

    // The place is the schedule's for the lesson's mode.
    if (home.next.place) expect(home.next.place.kind).toBe(home.next.mode === 'virtual' ? 'virtual' : 'physical');
    expect(home.next.lessons_together).toBeGreaterThanOrEqual(0);
  });

  test('an admin who tutors gets their own lessons, not everyone’s; the brief carries every readable assessment', async ({ as }) => {
    const admin = await as('admin');
    const home = await unwrap<any>(await admin.request.get('/api/home/tutor'), 'admin home');
    const schedules = await unwrap<any[]>(await admin.request.get('/api/schedules'), 'schedules');
    const own = new Set(schedules.filter((s) => s.tutor_name === 'Priya Raghavan').map((s) => s.id));
    for (const lesson of [home.next, ...home.unrecorded].filter(Boolean)) expect(own.has(lesson.schedule_id)).toBe(true);
    if (home.brief?.last_lesson) {
      for (const assessment of home.brief.assessments) expect(['tutor', 'student', 'parent', 'admin']).toContain(assessment.author_role);
    }
  });

  test('someone who teaches nobody gets an empty Home', async ({ as }) => {
    for (const who of ['parent', 'student'] as const) {
      const page = await as(who);
      const home = await unwrap<any>(await page.request.get('/api/home/tutor'), who);
      expect(home.next).toBeNull();
      expect(home.brief).toBeNull();
      expect(home.unrecorded).toEqual([]);
    }
  });
});

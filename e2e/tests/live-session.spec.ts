import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 7: the tutor starts a timer rather than typing times in afterwards.
 * Both endpoints snap to the nearest quarter hour as they are pressed.
 */
test.describe('a tutor can run a live session', () => {
  test.afterEach(async ({ as }) => {
    // Leave no timer running for the next spec.
    const tutor = await as('tutor');
    await tutor.request.delete('/api/sessions/active');
  });

  test('start, annotate and stop writes a priced session', async ({ as }) => {
    const tutor = await as('tutor');
    const sofiaId = await idOf(tutor, PEOPLE.student.email);

    const started = await tutor.request.post('/api/sessions/active', {
      data: { student_user_id: sofiaId, mode: 'in_person' },
    });
    const active = await unwrap<any>(started, 'starting a session');

    expect(active.student_name).toBe(PEOPLE.student.name);
    // The recorded start is snapped to a quarter hour, not the raw instant.
    expect(active.rounded_start).toMatch(/^\d{2}:(00|15|30|45)$/);

    // The bar follows the tutor around the app.
    await tutor.goto('/users');
    await expect(tutor.getByRole('status')).toContainText(PEOPLE.student.name);

    await tutor.request.patch('/api/sessions/active', {
      data: { notes: 'Ratios, with a worked example.' },
    });

    const stopped = await tutor.request.post('/api/sessions/active/stop', { data: {} });
    const session = await unwrap<any>(stopped, 'stopping the session');

    // Endpoint rounding makes the duration a multiple of 15 by construction,
    // and a lesson too short to register is floored rather than lost.
    expect(session.duration_minutes % 15).toBe(0);
    expect(session.duration_minutes).toBeGreaterThanOrEqual(15);
    expect(session.amount_cents).toBeGreaterThan(0);
    // Notes written during the lesson survive the stop.
    expect(session.notes).toBe('Ratios, with a worked example.');

    // The timer is cleared once recorded.
    const after = await unwrap<any>(
      await tutor.request.get('/api/sessions/active'),
      'reading the active session',
    );
    expect(after.mine).toBeNull();
  });

  test('a second timer is refused, and an unassigned student is rejected', async ({ as }) => {
    const tutor = await as('tutor');
    const sofiaId = await idOf(tutor, PEOPLE.student.email);

    await tutor.request.post('/api/sessions/active', {
      data: { student_user_id: sofiaId, mode: 'virtual' },
    });

    // You cannot teach two lessons at once.
    const second = await tutor.request.post('/api/sessions/active', {
      data: { student_user_id: sofiaId, mode: 'virtual' },
    });
    expect(second.status()).toBe(409);

    // Sanjay is taught by Priya, not by Alex.
    const other = await as('studentTutor');
    const notMine = await other.request.post('/api/sessions/active', {
      data: { student_user_id: sofiaId, mode: 'in_person' },
    });
    expect(notMine.status()).toBe(422);
    expect(await notMine.text()).toContain('not currently assigned');
  });
});

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Phase 21: the Tutoring tab is four sections, most important first --
 * Analytics, Tutoring Sessions (a carousel of the last lessons and the next
 * ones the schedules produce), Progress (five students with a small chart),
 * and Recent Activity (the last five events).
 */
test.describe('the Tutoring tab’s sections', () => {
  test('an admin sees the four sections in order, tight and aligned', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');

    const panel = admin.getByRole('tabpanel');
    await expect(panel.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    const headings = await panel.getByRole('heading', { level: 2 }).allTextContents();
    expect(headings).toEqual(['Analytics', 'Tutoring Sessions', 'Progress', 'Recent Activity']);

    // No card for the number of admins, and no hint line to push one card taller.
    const analytics = admin.getByRole('region', { name: 'Analytics' });
    await expect(analytics.getByText('Sessions running')).toBeVisible();
    await expect(analytics.getByText('Admins', { exact: true })).toHaveCount(0);
    await expect(admin.getByText('None in progress')).toHaveCount(0);

    const cards = analytics.locator('.rounded-xl');
    const heights = await cards.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
    );
    expect(new Set(heights).size, `card heights ${heights.join(', ')}`).toBe(1);
  });

  test('the carousel leads with the next lesson and pulls in five more', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');

    const sessions = admin.getByRole('region', { name: 'Tutoring Sessions' });
    await expect(sessions.getByRole('link', { name: /^Next session:/ })).toBeVisible();
    await expect(sessions.getByRole('link', { name: /^Past session:/ })).toHaveCount(5);

    const upcoming = sessions.getByRole('link', { name: /^Upcoming session:/ });
    await expect(upcoming).toHaveCount(4);
    await sessions.getByRole('button', { name: 'Later sessions' }).click();
    await expect(upcoming).toHaveCount(9);
  });

  test('progress shows at most five students, each charted, and links to the rest', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/');

    const cards = admin.getByTestId('progress-spotlight-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    await expect(cards.first().locator('svg[role="img"]')).toBeVisible();

    await admin.getByRole('region', { name: 'Progress' }).getByRole('link', { name: /All Progress/ }).click();
    await expect(admin).toHaveURL(/\/progress$/);
  });

  test('recent activity is the last five events, newest first', async ({ as }) => {
    const admin = await as('admin');
    const dashboard = await unwrap<any>(await admin.request.get('/api/dashboard?role=admin'), 'dashboard');
    const events = dashboard.data.recent_activity as { created_at: string }[];

    expect(events.length).toBeLessThanOrEqual(5);
    // A payment's line names its amount, so it stays off the Tutoring tab.
    expect(events.some((event: any) => event.action.startsWith('payment.'))).toBe(false);
    const times = events.map((event) => event.created_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  test('the Tutoring tab shows no money, for an admin or a tutor', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);
    // Make sure a payment line exists to be left out.
    const payment = await unwrap<any>(
      await admin.request.post('/api/payments', {
        data: { direction: 'to_tutor', party_user_id: alexId, amount_cents: 1234, method: 'zelle', paid_at: '2026-09-20' },
      }),
      'recording a payment',
    );

    try {
      for (const who of ['admin', 'tutor'] as const) {
        const page = await as(who);
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
        await page.waitForLoadState('networkidle');
        const text = await page.getByRole('tabpanel').innerText();
        expect(text, `${who}'s Tutoring tab`).not.toMatch(/\$\s?\d/);
      }
    } finally {
      await admin.request.delete(`/api/payments/${payment.id}`);
    }
  });

  test('a tutor’s carousel and progress are their own teaching only', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);

    const upcoming = await unwrap<any[]>(
      await tutor.request.get(`/api/schedules/upcoming?tutor_user_id=${alexId}&limit=10`),
      'upcoming',
    );
    expect(upcoming.length).toBeGreaterThan(0);
    expect(upcoming.every((row) => row.tutor_user_id === alexId)).toBe(true);

    const dashboard = await unwrap<any>(await tutor.request.get('/api/dashboard?role=tutor'), 'dashboard');
    const taught = new Set((dashboard.data.students as { user_id: string }[]).map((s) => s.user_id));
    for (const card of dashboard.data.progress_spotlight) {
      expect(taught.has(card.student.user_id)).toBe(true);
    }

    await tutor.goto('/');
    const sessions = tutor.getByRole('region', { name: 'Tutoring Sessions' });
    await expect(sessions.getByRole('link', { name: /^Next session:/ })).toBeVisible();
    await expect(sessions.getByText('Sanjay Patel')).toHaveCount(0);
  });
});

test.describe('upcoming lessons', () => {
  test('are in order, never past, page without repeats, and drop a recorded one', async ({ as }) => {
    const admin = await as('admin');
    const alexId = await idOf(admin, PEOPLE.tutor.email);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

    const page1 = await (await admin.request.get(`/api/schedules/upcoming?limit=5`)).json();
    const page2 = await (await admin.request.get(`/api/schedules/upcoming?limit=5&offset=5`)).json();
    const rows = [...page1.data, ...page2.data];
    const keys = rows.map((row: any) => `${row.occurs_on} ${row.start_time.padStart(5, '0')}`);

    expect(page1.meta.has_more).toBe(true);
    expect(keys).toEqual([...keys].sort());
    expect(rows.every((row: any) => row.occurs_on >= today)).toBe(true);
    const ids = rows.map((row: any) => `${row.schedule_id}@${row.occurs_on}`);
    expect(new Set(ids).size).toBe(ids.length);

    // Record Alex's next lesson ahead of time: it leaves the upcoming list.
    const mine = await unwrap<any[]>(
      await admin.request.get(`/api/schedules/upcoming?tutor_user_id=${alexId}`),
      'Alex upcoming',
    );
    const next = mine[0];
    const recorded = await unwrap<any>(
      await admin.request.post('/api/sessions', {
        data: {
          tutor_user_id: alexId,
          student_user_id: next.student_user_id,
          occurred_on: next.occurs_on,
          started_at: next.start_time,
          ended_at: next.end_time,
          mode: next.mode,
        },
      }),
      'recording the next lesson',
    );

    try {
      const after = await unwrap<any[]>(
        await admin.request.get(`/api/schedules/upcoming?tutor_user_id=${alexId}`),
        'Alex upcoming after recording',
      );
      expect(after.some((row) => row.schedule_id === next.schedule_id && row.occurs_on === next.occurs_on)).toBe(false);
    } finally {
      await admin.request.delete(`/api/sessions/${recorded.id}`);
    }
  });
});

test.describe('the progress page’s filters', () => {
  test('narrow to one tutor’s students, and to one student', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/progress');
    await expect(visible(admin, PEOPLE.studentTutor.name).first()).toBeVisible();

    // Alex teaches Sofia and Ben; Sanjay is Priya's.
    await admin.getByRole('combobox', { name: 'Tutor' }).click();
    await admin.getByRole('option', { name: `${PEOPLE.tutor.name}’s students` }).click();
    await expect(admin).toHaveURL(/tutor=/);
    await expect(visible(admin, PEOPLE.student.name).first()).toBeVisible();
    await expect(visible(admin, 'Ben Whitfield').first()).toBeVisible();
    await expect(visible(admin, PEOPLE.studentTutor.name)).toHaveCount(0);

    await admin.getByRole('combobox', { name: 'Student' }).click();
    await admin.getByRole('option', { name: 'Ben Whitfield' }).click();
    await expect(admin).toHaveURL(/student=/);
    await expect(visible(admin, PEOPLE.student.name)).toHaveCount(0);

    // The filters survive a reload.
    await admin.reload();
    await expect(visible(admin, 'Ben Whitfield').first()).toBeVisible();
    await expect(visible(admin, PEOPLE.student.name)).toHaveCount(0);
  });
});

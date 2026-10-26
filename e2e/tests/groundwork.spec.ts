import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { RATE_LIMITS, limitHit } from '@tmi/shared';

/**
 * Groundwork for open sign-in (Phase 51, docs/open-signup-plan.md): what was safe only while the
 * platform made every organization -- an invitation that revealed whose an address was, approvals
 * from anyone's Quest reaching every organization, unlimited tries -- and the public terms.
 */

test.describe.configure({ mode: 'serial' });

test.describe('groundwork for open sign-in (Phase 51)', () => {
  test('an invitation shows the inviting space only what it typed, and locks nothing @smoke', async ({ as }) => {
    // Riverside adds a brand-new parent: their own record, in their own words.
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const email = `pat.example.${Date.now()}@example.com`;
    const pat = await unwrap<any>(
      await rosa.request.post('/api/users', {
        data: { full_name: 'Pat Example', email, phone: '(919) 555-0400', roles: ['parent'], status: 'active' },
      }),
      'Riverside adds Pat',
    );

    // The institute adds the same address under another name: it sees what it typed, and no phone.
    const admin = await as('admin');
    const invited = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: { full_name: 'Patricia (typed here)', email, phone: '(919) 555-0499', roles: ['parent'], status: 'active' },
      }),
      'the institute invites Pat',
    );
    expect(invited).toMatchObject({ id: pat.id, full_name: 'Patricia (typed here)', phone: null, status: 'invited' });
    const read = await unwrap<any>(await admin.request.get(`/api/users/${pat.id}`), 'the institute reads Pat');
    expect(read).toMatchObject({ full_name: 'Patricia (typed here)', phone: null, shared_fields_locked: true });
    const listed = await unwrap<any[]>(await admin.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'listed');
    expect(listed.map((u) => u.full_name)).toEqual(['Patricia (typed here)']);

    // Riverside still sees Pat's own record, and the invitation locks nothing there.
    const atRiverside = await unwrap<any>(await rosa.request.get(`/api/users/${pat.id}`), 'Riverside reads Pat');
    expect(atRiverside).toMatchObject({ full_name: 'Pat Example', phone: '(919) 555-0400', shared_fields_locked: false });
    await unwrap(await rosa.request.patch(`/api/users/${pat.id}`, { data: { phone: '(919) 555-0401' } }), 'Riverside edits Pat');

    // Once Pat accepts, the institute sees Pat's own record -- and now both are locked.
    const patPage = await as('parent', { email, org: null });
    await unwrap(await patPage.request.post(`/api/auth/invitations/${ORGS.a.slug}/accept`), 'Pat accepts');
    const after = await unwrap<any>(await admin.request.get(`/api/users/${pat.id}`), 'after accepting');
    expect(after).toMatchObject({ full_name: 'Pat Example', phone: '(919) 555-0401', shared_fields_locked: true });
    expect((await unwrap<any>(await rosa.request.get(`/api/users/${pat.id}`), 'Riverside after')).shared_fields_locked).toBe(true);
  });

  test('an untrusted space’s Quest approval is a suggestion for the console', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'organizations');
    const riverside = orgs.find((o) => o.slug === ORGS.b.slug);
    expect(riverside.quest_trusted).toBe(true);
    const features = { feature_tutoring: true, feature_assessment: true, feature_quest: true };
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const setQuest = (on: boolean) => rosa.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } });
    await unwrap(await platform.request.put(`/api/platform/organizations/${riverside.id}/features`, { data: { ...features, quest_trusted: false } }), 'untrust');
    expect((await setQuest(true)).status()).toBe(200);
    try {
      // Sanjay studies at Riverside too; Priya tutors him there.
      const priya = await as('admin', { org: ORGS.b.slug });
      const students = await unwrap<any[]>(await priya.request.get('/api/quest/students'), 'students');
      const sanjayRow = students.find((s) => s.full_name === 'Sanjay Patel')!;
      await unwrap(await priya.request.put(`/api/quest/students/${sanjayRow.user_id}/level`, { data: { level_id: 'NC26.4' } }), 'level');
      const sanjay = await as('studentTutor', { org: ORGS.b.slug });
      const q = (await unwrap<any>(await sanjay.request.get('/api/quest/me'), 'me')).question;
      await unwrap(await sanjay.request.post('/api/quest/answers', { data: { question_id: q.id, answer: 'not this' } }), 'answer');

      // "Question is right" here leaves it checked and suggests it in the console.
      let done = false;
      for (let i = 0; i < 20 && !done; i += 1) {
        const queue = await unwrap<any>(await priya.request.get('/api/quest/review'), 'queue');
        if (!queue.item) break;
        await unwrap(await priya.request.post(`/api/quest/review/${queue.item.attempt_id}`, { data: { decision: 'approve' } }), 'approve');
        done = queue.item.question.id === q.id;
      }
      expect(done).toBe(true);
      const suggested = await unwrap<any[]>(await platform.request.get('/api/platform/questions?status=checked&suggested=true&limit=200'), 'suggested');
      const found = suggested.find((s) => s.id === q.id);
      expect(found).toMatchObject({ status: 'checked', suggestions: 1 });
      const log = await unwrap<any[]>(await rosa.request.get('/api/audit?limit=10'), 'audit');
      expect(log.some((e) => e.action === 'quest.question_approved' && e.description.startsWith('Suggested approving'))).toBe(true);

      // The console approves it.
      await unwrap(await platform.request.post(`/api/platform/questions/${q.id}/approve`), 'console approves');
    } finally {
      await setQuest(false);
      await unwrap(await platform.request.put(`/api/platform/organizations/${riverside.id}/features`, { data: { ...features, quest_trusted: true } }), 'trust again');
    }
  });

  test('the terms and the privacy notice are public, and linked from the portal', async ({ page, as }) => {
    for (const kind of ['terms', 'privacy'] as const) {
      await page.goto(`/${kind}`);
      await expect(page.getByTestId(`legal-${kind}`)).toBeVisible();
    }
    await expect(page.getByTestId('legal-privacy')).toContainText('Nobody under 13 may create an account');
    const admin = await as('admin');
    await admin.goto('/profile');
    await expect(admin.getByTestId('profile-legal').getByRole('link', { name: 'Privacy notice' })).toBeVisible();
  });

  test('the request limits: a fixed window, refused past its limit, open again after', () => {
    const { limit, windowMs } = RATE_LIMITS.space_write;
    let window = null as ReturnType<typeof limitHit>['window'] | null;
    for (let i = 0; i < limit; i += 1) {
      const hit = limitHit(window, 1_000 + i, limit, windowMs);
      expect(hit.ok).toBe(true);
      window = hit.window;
    }
    const refused = limitHit(window, 2_000, limit, windowMs);
    expect(refused).toMatchObject({ ok: false });
    expect(refused.retryAfterMs).toBe(1_000 + windowMs - 2_000);
    expect(limitHit(refused.window, 1_000 + windowMs, limit, windowMs).ok).toBe(true);
  });
});

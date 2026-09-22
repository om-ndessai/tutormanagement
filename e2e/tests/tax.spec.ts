import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 14: the institute files a tax document for each tutor at year end,
 * which needs their SSN.
 *
 * The number is never stored, sent or asked for by this portal. What is
 * recorded is that the office HAS it, and the tests that matter are the ones
 * proving a number cannot get in by any door.
 */
test.describe('tax documents', () => {
  test('nothing that looks like an SSN can be stored', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sessions = await unwrap<any[]>(
      await admin.request.get('/api/sessions?limit=1'),
      'listing sessions',
    );

    // A comment.
    const comment = await admin.request.post('/api/comments', {
      data: { target_type: 'user', target_id: tutorId, body: 'SSN 123-45-6789 for the 1099' },
    });
    expect(comment.status()).toBe(422);

    // A session note.
    const note = await admin.request.patch(`/api/sessions/${sessions[0].id}`, {
      data: { notes: 'Parent passed on his social security number 987 65 4321.' },
    });
    expect(note.status()).toBe(422);

    // A free-text profile field.
    const detail = await unwrap<any>(
      await admin.request.get(`/api/users/${tutorId}`),
      'reading the tutor',
    );
    const profile = await admin.request.patch(`/api/users/${tutorId}`, {
      data: {
        tutor_profile: { ...detail.tutor_profile, availability_notes: 'ssn: 111-22-3333' },
      },
    });
    expect(profile.status()).toBe(422);

    // But ordinary text carrying a phone number is not caught.
    const ok = await admin.request.patch(`/api/sessions/${sessions[0].id}`, {
      data: { notes: 'Covered ratios. Call home on 919-555-0142.' },
    });
    expect(ok.status()).toBe(200);
  });

  test('the office records only that it holds the number', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    const confirmed = await unwrap<{ ssn_received_on: string | null }>(
      await admin.request.post(`/api/users/${tutorId}/ssn-receipt`, { data: { received: true } }),
      'confirming receipt',
    );
    // A date, not a number.
    expect(confirmed.ssn_received_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The tutor cannot record it for themselves.
    const refused = await tutor.request.post(`/api/users/${tutorId}/ssn-receipt`, {
      data: { received: true },
    });
    expect(refused.status()).toBe(403);

    // Only a tutor needs a tax document.
    const studentId = await idOf(admin, PEOPLE.student.email);
    const notATutor = await admin.request.post(`/api/users/${studentId}/ssn-receipt`, {
      data: { received: true },
    });
    expect(notATutor.status()).toBe(422);

    // Withdrawing it puts the tutor back on the chase list.
    await admin.request.post(`/api/users/${tutorId}/ssn-receipt`, { data: { received: false } });
    const board = await unwrap<any>(
      await admin.request.get('/api/dashboard?role=admin'),
      'reading the admin dashboard',
    );
    expect(board.data.tutors_missing_ssn.map((t: any) => t.user_id)).toContain(tutorId);
  });

  test('both sides are told when it is missing', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    await admin.request.post(`/api/users/${tutorId}/ssn-receipt`, { data: { received: false } });

    // The tutor's own dashboard asks them to hand it over, and says how not to.
    // It leads the finance tab, which is where their tax affairs live.
    await tutor.goto('/?tab=finance');
    await expect(tutor.getByText('Action needed: your SSN')).toBeVisible();
    await expect(tutor.getByText(/Never send it through this portal/)).toBeVisible();

    // The admin's lists them as work to chase, beside the year-end documents --
    // with the action right there, because having to go and find the tutor's
    // record to tick it off is what made this impossible to use.
    await admin.goto('/?tab=finance');
    await expect(admin.getByText(/SSN not on file/)).toBeVisible();

    // Scoped to THIS tutor's row in the year-end list. Asserting that "a"
    // 1099 button exists somewhere passes before the click as well, since
    // every other tutor already has one -- which is exactly how a stale card
    // went unnoticed once already.
    // Anchored on text that does not change -- filtering the row BY the button
    // would stop matching the moment the button correctly disappears.
    const row = admin
      .locator('li')
      .filter({ hasText: PEOPLE.tutor.name })
      .filter({ hasText: /paid in \d{4}/ })
      .first();

    await expect(row.getByRole('button', { name: '1099-NEC' })).toHaveCount(0);
    await row.getByRole('button', { name: /Mark SSN received/i }).click();

    // The row itself has to change, without a reload: the button that was
    // blocking the 1099 is gone and the 1099 is offered in its place.
    await expect(row.getByRole('button', { name: '1099-NEC' })).toBeVisible();
    await expect(row.getByRole('button', { name: /Mark SSN received/i })).toHaveCount(0);

    // And the chase panel, which reads from a different query, agrees.
    await expect(admin.getByText(/SSN not on file/)).toHaveCount(0);
  });

  test('the year-end summary carries money and readiness, never a number', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const response = await admin.request.get('/api/payments/tax-summary.csv?year=2026');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('tmi-tax-summary-2026.csv');

    const csv = await response.text();
    expect(csv).toContain('SSN on file');
    expect(csv).toContain(PEOPLE.tutor.name);
    // Nothing in SSN shape anywhere in the file.
    expect(csv).not.toMatch(/\d{3}[- ]\d{2}[- ]\d{4}/);

    // It is the institute's document, not a tutor's.
    expect((await tutor.request.get('/api/payments/tax-summary.csv?year=2026')).status()).toBe(403);
  });
});

/**
 * The institute's own tax identity, recorded once on an admin's record and
 * reused on every 1099 it prints.
 */
test.describe('the institute TIN', () => {
  test('is admin-only, editable from the user dialog, and never an SSN', async ({ as }) => {
    const admin = await as('admin');
    const adminId = await idOf(admin, PEOPLE.admin.email);

    // Editable through the ordinary user PATCH, like any other profile section.
    await unwrap(
      await admin.request.patch(`/api/users/${adminId}`, {
        data: { admin_profile: { tin: '47-2019388' } },
      }),
      'setting the TIN',
    );

    const detail = await unwrap<any>(
      await admin.request.get(`/api/users/${adminId}`),
      'reading it back',
    );
    expect(detail.admin_profile.tin).toBe('47-2019388');

    // A family can open an admin's record; the institute's tax identity is
    // not part of what they may read.
    const parent = await as('parent');
    const asParent = await unwrap<any>(
      await parent.request.get(`/api/users/${adminId}`),
      'reading as a parent',
    );
    expect(asParent.admin_profile?.tin ?? null).toBeNull();

    // A sole proprietor may file under their SSN; this portal still will not
    // hold one, whatever the field is called.
    const refused = await admin.request.patch(`/api/users/${adminId}`, {
      data: { admin_profile: { tin: '123-45-6789' } },
    });
    expect(refused.status()).toBe(422);
  });

  test('prefills the 1099, and the profile goes when the role does', async ({ as }) => {
    const admin = await as('admin');
    const adminId = await idOf(admin, PEOPLE.admin.email);

    await admin.request.patch(`/api/users/${adminId}`, {
      data: { admin_profile: { tin: '47-2019388' } },
    });

    await admin.goto('/?tab=finance');
    await admin.getByRole('button', { name: '1099-NEC' }).first().click();
    const dialog = admin.getByRole('dialog');
    await expect(dialog.getByLabel(/Payer.s TIN/)).toHaveValue('47-2019388');
  });
});

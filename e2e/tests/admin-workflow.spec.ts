import type { Page } from '@playwright/test';

import { PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';

/**
 * The end-to-end path the plan describes, in order:
 *
 *   parent -> student -> assign to a tutor -> tutor records a session ->
 *   admin records the family's payment -> balances settle.
 *
 * Runs as a single test because each step depends on the last; splitting it
 * would need the steps to share state through the database anyway.
 */
test('a family can be onboarded, taught, billed and settled', async ({ as }) => {
  const admin = await as('admin');
  const stamp = Date.now();
  const parentEmail = `e2e.parent.${stamp}@gmail.com`;
  const studentEmail = `e2e.student.${stamp}@gmail.com`;

  await test.step('the parent must exist before the student', async () => {
    // "A parent must be created before a student can be created."
    const orphan = await admin.request.post('/api/users', {
      data: { email: `e2e.orphan.${stamp}@gmail.com`, full_name: 'No Parent', roles: ['student'] },
    });

    expect(orphan.status()).toBe(422);
    expect(await orphan.text()).toContain('at least one parent');
  });

  let parentId = '';
  let studentId = '';

  await test.step('create the parent, then the student linked to them', async () => {
    const parent = await admin.request.post('/api/users', {
      data: {
        email: parentEmail,
        full_name: `E2E Parent ${stamp}`,
        roles: ['parent'],
        payment_handles: [{ method: 'zelle', handle: parentEmail }],
      },
    });
    expect(parent.status()).toBe(201);
    parentId = (await unwrap<{ id: string }>(parent, 'creating the parent')).id;

    const student = await admin.request.post('/api/users', {
      data: {
        email: studentEmail,
        full_name: `E2E Student ${stamp}`,
        roles: ['student'],
        student_profile: {
          school: 'E2E Middle',
          current_math_course: 'Grade 6',
          academic_year_goal: 'Pass the end-of-year test',
          virtual_available: true,
        },
        guardians: [{ guardian_user_id: parentId, relationship: 'mother', is_primary: true }],
      },
    });
    expect(student.status()).toBe(201);
    studentId = (await unwrap<{ id: string }>(student, 'creating the student')).id;
  });

  await test.step('the admin assigns the student to a tutor', async () => {
    const assignment = await admin.request.post('/api/assignments', {
      data: {
        tutor_user_id: await idOf(admin, PEOPLE.tutor.email),
        student_user_id: studentId,
        // A negotiated rate for this family, overriding Alex's usual $75.
        rate_in_person_cents: 8000,
        is_active: true,
      },
    });
    expect(assignment.status()).toBe(201);
  });

  await test.step('the tutor records a session, and it is priced server-side', async () => {
    const tutor = await as('tutor');

    const session = await tutor.request.post('/api/sessions', {
      data: {
        tutor_user_id: await idOf(tutor, PEOPLE.tutor.email),
        student_user_id: studentId,
        occurred_on: '2026-09-18',
        // 1 hr 52 min, which must round to 1 hr 45 at the negotiated rate.
        started_at: '16:00',
        ended_at: '17:52',
        mode: 'in_person',
        notes: 'Covered ratios. Homework set.',
      },
    });

    expect(session.status()).toBe(201);
    const body = await unwrap<any>(session, 'recording the session');

    expect(body.duration_minutes).toBe(105);
    expect(body.rate_cents).toBe(8000);
    // 105 minutes at $80/hr = $140.00
    expect(body.amount_cents).toBe(14000);
  });

  await test.step('the family owes exactly that amount', async () => {
    const balance = await studentBalance(admin, studentId);
    expect(balance.charged_cents).toBe(14000);
    expect(balance.paid_cents).toBe(0);
    expect(balance.balance_cents).toBe(14000);
  });

  await test.step('the admin records the payment and the balance clears', async () => {
    const payment = await admin.request.post('/api/payments', {
      data: {
        direction: 'from_parent',
        party_user_id: parentId,
        student_user_id: studentId,
        amount_cents: 14000,
        method: 'zelle',
        paid_at: new Date().toISOString(),
      },
    });
    expect(payment.status()).toBe(201);

    const balance = await studentBalance(admin, studentId);
    expect(balance.paid_cents).toBe(14000);
    expect(balance.balance_cents).toBe(0);
  });

  await test.step('every step of that is in the audit log', async () => {
    const response = await admin.request.get('/api/audit?limit=100', {
    });
    const events = await unwrap<{ action: string }[]>(response, 'reading the audit log');
    const actions = events.map((event) => event.action);

    expect(actions).toContain('user.created');
    expect(actions).toContain('assignment.created');
    expect(actions).toContain('session.recorded');
    expect(actions).toContain('payment.recorded');
  });
});


async function studentBalance(page: Page, studentId: string) {
  const response = await page.request.get('/api/payments/balances', {
  });
  const balances = await unwrap<{ students: any[] }>(response, 'reading balances');
  return balances.students.find((s) => s.student_user_id === studentId);
}

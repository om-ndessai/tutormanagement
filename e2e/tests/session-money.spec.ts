import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Phase 17: a lesson's money is said from the reader's side of it.
 *
 *   admin   the family's charge, the tutor's pay, and the institute's cut
 *   tutor   their pay, never the price
 *   family  the price, never the tutor's pay
 *
 * Per row: Sanjay tutors younger children and is taught himself, so one list
 * of his holds both kinds, each labelled.
 */
test.describe('session money, per reader', () => {
  test('each row says whose money it is, and carries only that side', async ({ as }) => {
    const read = async (who: Parameters<typeof as>[0]) =>
      unwrap<any>(await (await as(who)).request.get('/api/sessions?limit=200'), `${who} sessions`);

    const admin = await read('admin');
    expect(admin.every((s: any) => s.money_view === 'admin')).toBe(true);
    expect(admin.every((s: any) => s.tutor_amount_cents !== null && s.charge_amount_cents !== null)).toBe(true);

    const tutor = await read('tutor');
    expect(tutor.length).toBeGreaterThan(0);
    for (const s of tutor) {
      expect(s.money_view).toBe('tutor');
      expect(s.charge_amount_cents).toBeNull();
      expect(s.charge_rate_cents).toBeNull();
    }

    const parent = await read('parent');
    expect(parent.length).toBeGreaterThan(0);
    for (const s of parent) {
      expect(s.money_view).toBe('family');
      expect(s.tutor_amount_cents).toBeNull();
      expect(s.tutor_rate_cents).toBeNull();
    }

    const both = await read('studentTutor');
    const views = new Set(both.map((s: any) => s.money_view));
    expect(views).toEqual(new Set(['tutor', 'family']));
  });

  test('totals are per side, so someone on both sides sees both', async ({ as }) => {
    const sanjay = await as('studentTutor');
    const body = await (await sanjay.request.get('/api/sessions?limit=200')).json();

    const sum = (view: string, field: string) =>
      body.data.filter((s: any) => s.money_view === view).reduce((n: number, s: any) => n + s[field], 0);

    expect(body.totals.total_tutor_amount_cents).toBe(sum('tutor', 'tutor_amount_cents'));
    expect(body.totals.total_charge_amount_cents).toBe(sum('family', 'charge_amount_cents'));

    const tutorOnly = await (await (await as('tutor')).request.get('/api/sessions')).json();
    expect(tutorOnly.totals.total_charge_amount_cents).toBeNull();
    expect(tutorOnly.totals.total_tutor_amount_cents).toBeGreaterThan(0);
  });

  test('the screens label the amount from the reader’s side', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/sessions?tab=finance');
    await expect(visible(tutor, 'Your pay').first()).toBeVisible();
    await expect(tutor.getByText(/Institute cut|· Institute/)).toHaveCount(0);

    const parent = await as('parent');
    await parent.goto('/sessions?tab=finance');
    await expect(visible(parent, 'You pay').first()).toBeVisible();
    await expect(parent.getByText('Your pay')).toHaveCount(0);

    const admin = await as('admin');
    await admin.goto('/sessions?tab=finance');
    await expect(visible(admin, 'Institute cut')).toBeVisible();
    await expect(visible(admin, /Tutor \$[\d,.]+ · Institute/).first()).toBeVisible();
  });

  /**
   * Phase 19: a tutor keeps the sessions page open during a lesson to read the
   * notes, with the student beside them. Its Tutoring tab is the default and
   * shows no money to anyone -- not in the totals, not on a lesson, not in the
   * form that records one.
   */
  test('the sessions page opens on a Tutoring tab with no money on it', async ({ as }) => {
    for (const who of ['tutor', 'parent', 'admin'] as const) {
      const page = await as(who);
      await page.goto('/sessions');

      await expect(page.getByRole('tab', { name: 'Tutoring' })).toHaveAttribute('aria-selected', 'true');
      await expect(visible(page, 'Time taught')).toBeVisible();
      // Wait for the lessons themselves, so the check below is not of a skeleton.
      await expect(page.getByRole('button', { name: /^Comments? / }).first()).toBeVisible();

      const text = await page.locator('body').innerText();
      expect(text, `${who}'s Tutoring tab`).not.toMatch(/\$\s?\d/);
      for (const label of ['Your pay', 'You pay', 'Charged', 'Earned', 'Institute cut']) {
        expect(text, `${who}'s Tutoring tab`).not.toContain(label);
      }
      await expect(page.getByRole('link', { name: 'CSV' })).toHaveCount(0);

      // The same list, money and all, is one click away.
      await page.getByRole('tab', { name: 'Finance' }).click();
      await expect(page).toHaveURL(/tab=finance/);
      await expect(visible(page, /\$\s?\d/).first()).toBeVisible();
      await expect(page.getByRole('link', { name: 'CSV' })).toBeVisible();
    }
  });

  test('recording a lesson from the Tutoring tab previews its length, not the pay', async ({ as }) => {
    const tutor = await as('tutor');
    await tutor.goto('/sessions');
    await tutor.getByRole('button', { name: /record a session/i }).first().click();

    const dialog = tutor.getByRole('dialog');
    await dialog.getByRole('combobox').first().click();
    await tutor.getByRole('option', { name: /Sofia Okafor/ }).click();
    await dialog.getByRole('button', { name: '1 hr', exact: true }).click();

    await expect(dialog.getByText('1 hr', { exact: true }).last()).toBeVisible();
    await expect(dialog.getByText('Your pay')).toHaveCount(0);
    expect(await dialog.innerText()).not.toMatch(/\$\s?\d/);
  });

  test('recording a lesson puts no price in the tutor’s activity log', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    const session = await unwrap<any>(
      await tutor.request.post('/api/sessions', {
        data: {
          tutor_user_id: tutorId,
          student_user_id: sofiaId,
          occurred_on: '2026-09-18',
          started_at: '15:00',
          ended_at: '16:00',
          mode: 'in_person',
        },
      }),
      'recording',
    );

    const events = await unwrap<any[]>(await tutor.request.get('/api/audit?limit=5'), 'activity');
    const line = events.find((event) => event.entity_id === session.id);
    expect(line.description).not.toMatch(/USD|\$/);

    await tutor.request.delete(`/api/sessions/${session.id}`);
  });

  test('pay rates reach only the tutor and the office; prices only the family', async ({ as }) => {
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    // Pairings: Maria reads who teaches Sofia, not what Alex is paid for it.
    const maria = await as('parentTutor');
    const pairings = await unwrap<any[]>(await maria.request.get('/api/assignments'), 'pairings');
    const sofias = pairings.filter((row) => row.student_user_id === sofiaId);
    expect(sofias.length).toBeGreaterThan(0);
    for (const row of sofias) {
      expect(row.effective_rate_in_person_cents).toBeNull();
      expect(row.rate_in_person_cents).toBeNull();
    }
    const alexPairings = await unwrap<any[]>(
      await (await as('tutor')).request.get('/api/assignments'),
      'alex pairings',
    );
    expect(alexPairings.some((row) => row.effective_rate_in_person_cents !== null)).toBe(true);

    // Records: the tutor's default rates are hidden from a parent...
    const alex = await unwrap<any>(await maria.request.get(`/api/users/${tutorId}`), 'alex');
    expect(alex.tutor_profile.default_rate_in_person_cents).toBeNull();
    // ...and the child's price is shown to her, because she pays it.
    const sofia = await unwrap<any>(await maria.request.get(`/api/users/${sofiaId}`), 'sofia');
    expect(sofia.student_profile.charge_rate_in_person_cents).not.toBeNull();
    // A tutor still never sees the price.
    const asTutor = await unwrap<any>(
      await (await as('tutor')).request.get(`/api/users/${sofiaId}`),
      'sofia as tutor',
    );
    expect(asTutor.student_profile.charge_rate_in_person_cents).toBeNull();
  });

  test('a spreadsheet carries only the reader’s own side', async ({ as }) => {
    const header = async (who: Parameters<typeof as>[0]) =>
      (await (await (await as(who)).request.get('/api/sessions/export.csv')).text())
        .replace(/^﻿/, '')
        .split(/\r?\n/)[0]!;

    const tutor = await header('tutor');
    expect(tutor).toContain('Your pay (USD)');
    expect(tutor).not.toContain('Charged');

    const parent = await header('parent');
    expect(parent).toContain('Charged to you (USD)');
    expect(parent).not.toMatch(/pay/i);

    const admin = await header('admin');
    expect(admin).toContain('Charged (USD)');
    expect(admin).toContain('Tutor pay (USD)');
    expect(admin).toContain('Institute cut (USD)');
  });
});

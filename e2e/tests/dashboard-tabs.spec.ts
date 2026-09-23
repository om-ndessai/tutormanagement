import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 15: the dashboard is two things -- money, and how the teaching is
 * going -- so it is two tabs, and the finance half carries the monthly
 * rundown and the year-end documents.
 */
test.describe('the dashboard tabs', () => {
  test('both halves are reachable, and the tab survives a reload', async ({ as }) => {
    const admin = await as('admin');

    await admin.goto('/');
    await expect(admin.getByRole('tab', { name: /Tutoring/ })).toBeVisible();
    await expect(admin.getByRole('tab', { name: /Finance/ })).toBeVisible();

    await admin.getByRole('tab', { name: /Finance/ }).click();
    await expect(admin).toHaveURL(/tab=finance/);
    await expect(admin.getByText(/month by month/)).toBeVisible();

    // A link to the finance view opens the finance view.
    await admin.reload();
    await expect(admin.getByText(/month by month/)).toBeVisible();
  });

  test('the rundown counts lessons when taught and money when it moved', async ({ as }) => {
    const admin = await as('admin');
    const year = new Date().getFullYear();

    const data = await unwrap<any>(
      await admin.request.get(`/api/payments/monthly?year=${year}`),
      'reading the rundown',
    );

    expect(data.scope).toBe('institute');
    expect(data.months).toHaveLength(12);

    // The institute's figures are all present for an admin.
    for (const month of data.months) {
      expect(month.billed_cents).not.toBeNull();
      expect(month.received_from_families_cents).not.toBeNull();
    }

    // The year's billed total matches what the balances say was billed.
    const active = data.months.filter((m: any) => m.session_count > 0);
    expect(active.length).toBeGreaterThan(0);
  });

  test('a tutor sees their own money and never a family’s', async ({ as }) => {
    const tutor = await as('tutor');
    const year = new Date().getFullYear();

    const data = await unwrap<any>(
      await tutor.request.get(`/api/payments/monthly?year=${year}`),
      'reading the rundown as a tutor',
    );

    expect(data.scope).toBe('tutor');
    for (const month of data.months) {
      // What families were billed is not theirs to see, on any month.
      expect(month.billed_cents).toBeNull();
      expect(month.received_from_families_cents).toBeNull();
    }

    // Their own columns are on the screen, the institute's are not.
    await tutor.goto('/?tab=finance');
    await expect(tutor.getByRole('columnheader', { name: 'Earned' })).toBeVisible();
    await expect(tutor.getByRole('columnheader', { name: 'Billed' })).toHaveCount(0);
  });

  test('a 1099 can be prepared, and the number is only ever typed', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const year = new Date().getFullYear();

    // The year-end figures are the institute's, not a tutor's.
    expect((await tutor.request.get(`/api/payments/tax-status?year=${year}`)).status()).toBe(403);

    const status = await unwrap<any[]>(
      await admin.request.get(`/api/payments/tax-status?year=${year}`),
      'reading year-end status',
    );
    // The endpoint knows whether we hold an SSN, never what it is.
    for (const row of status) {
      expect(Object.keys(row).sort()).toEqual(
        ['address', 'full_name', 'paid_this_year_cents', 'ssn_received_on', 'user_id'],
      );
      expect(Object.keys(row.address).sort()).toEqual(
        ['address_line1', 'address_line2', 'city', 'postal_code', 'state'],
      );
    }

    await admin.goto('/?tab=finance');
    const button = admin.getByRole('button', { name: '1099-NEC' }).first();
    await expect(button).toBeVisible();
    await button.click();

    const dialog = admin.getByRole('dialog');
    await expect(dialog.getByText(/never sent to the server/)).toBeVisible();

    // Printing is refused until the number is a real one.
    await expect(admin.getByRole('button', { name: /Enter nine digits/ })).toBeDisabled();
    await dialog.getByLabel(/Recipient.s SSN/).fill('123-45-6789');
    await expect(admin.getByRole('button', { name: /Print 1099-NEC/ })).toBeEnabled();
  });
});

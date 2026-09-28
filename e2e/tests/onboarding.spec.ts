import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 26: the welcome wizard and feature tour.
 *
 * The rules worth holding: it opens by itself once per person (the database
 * remembers), a browser that has not seen it only offers it to somebody who
 * has (a cookie remembers the device), closing it counts as having been
 * through it, an admin's guided setup uses the portal's own forms and leaves
 * real records, and everybody else can only confirm their details or send
 * the office a note -- never edit them.
 *
 * Every other spec's browser carries the tour cookie and every seeded person
 * has been through the wizard (support/fixtures.ts, the seed), so none of
 * them meets it. These tests use `fresh` browsers, and people made here.
 */

const wizard = (page: Page) => page.getByTestId('onboarding-wizard');

/** A parent the office has just added, who has never signed in. */
async function newParent(admin: Page, label: string) {
  const email = `onboarding.${label}.${Date.now()}@gmail.com`;
  const user = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: { full_name: `Onboarding ${label}`, email, roles: ['parent'], status: 'active', phone: '(919) 555-0177' },
    }),
    'adding a parent',
  );
  return { id: user.id as string, email };
}

async function session(page: Page) {
  return unwrap<any>(await page.request.get('/api/auth/session'), 'session');
}

test.describe('the welcome wizard', () => {
  test('a new person is welcomed, toured, and can tell the office what is wrong', async ({ as }) => {
    const admin = await as('admin');
    const parent = await newParent(admin, 'tour');

    try {
      const page = await as('parent', { fresh: true, email: parent.email });
      await page.goto('/');

      // It opens by itself, the first time.
      await expect(wizard(page)).toBeVisible();
      await expect(wizard(page).getByRole('heading', { name: /^Welcome to / })).toBeVisible();
      // A parent is offered the tour, not the office's setup.
      await expect(wizard(page).getByRole('button', { name: 'Add a student' })).toHaveCount(0);

      await wizard(page).getByRole('button', { name: 'Take the tour' }).click();
      const tour = page.getByTestId('tour');
      await expect(tour).toBeVisible();
      await expect(tour.getByRole('heading', { name: 'Your children' })).toBeVisible();
      await expect(page.locator('[data-tour-active]')).toHaveAttribute('data-tour', 'dash-children');

      // Through to the end; menu items are lit where they are.
      await tour.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('[data-tour-active]')).toHaveAttribute('data-tour', /^(dash-|nav-)/);
      while (await tour.getByRole('button', { name: 'Next' }).count()) {
        await tour.getByRole('button', { name: 'Next' }).click();
      }
      await tour.getByRole('button', { name: 'Finish' }).click();

      // Then their own details, which they cannot edit -- only tell the office.
      await expect(wizard(page).getByRole('heading', { name: 'Confirm your details' })).toBeVisible();
      await expect(wizard(page)).toContainText(parent.email);
      await wizard(page).getByRole('button', { name: 'Something needs changing' }).click();
      await wizard(page).getByLabel('What needs changing?').fill('My phone number has changed.');
      await wizard(page).getByRole('button', { name: 'Send to the office' }).click();
      await wizard(page).getByRole('button', { name: 'Go to my dashboard' }).click();
      await expect(wizard(page)).toHaveCount(0);

      // The office has the note, on the parent's own record.
      const thread = await unwrap<any>(
        await admin.request.get(`/api/comments?target_type=user&target_id=${parent.id}`),
        'the note',
      );
      expect(thread.comments.map((comment: any) => comment.body)).toContain('My phone number has changed.');

      // It does not open again, and the person has been through it.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(wizard(page)).toHaveCount(0);
      expect((await session(page)).onboarding.tour_finished_at).not.toBeNull();
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });

  test('closing it counts as having been through it; confirming is recorded', async ({ as }) => {
    const admin = await as('admin');
    const parent = await newParent(admin, 'skip');

    try {
      const page = await as('parent', { fresh: true, email: parent.email });
      await page.goto('/');
      await wizard(page).getByRole('button', { name: 'Confirm my details' }).click();
      await wizard(page).getByRole('button', { name: 'Yes, that’s all right' }).click();
      await wizard(page).getByRole('button', { name: 'Go to my dashboard' }).click();

      const state = (await session(page)).onboarding;
      expect(state.tour_finished_at).not.toBeNull();
      expect(state.details_confirmed_at).not.toBeNull();

      // Skipped, not completed: the tour was never taken.
      const log = await unwrap<any[]>(
        await admin.request.get(`/api/audit?user_id=${parent.id}&limit=20`),
        'their log',
      );
      expect(log.map((event) => event.description)).toContain('Skipped the portal tour');
      expect(log.map((event) => event.description)).toContain('Confirmed their details are correct');

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(wizard(page)).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });

  test('on a new browser, somebody who has been through it is only offered the tour', async ({ as }) => {
    const alex = await as('tutor', { fresh: true });
    await alex.goto('/');

    const offer = alex.getByRole('dialog', { name: 'New here on this device?' });
    await expect(offer).toBeVisible();
    await expect(wizard(alex)).toHaveCount(0);

    await offer.getByRole('button', { name: 'No thanks' }).click();
    await alex.reload();
    await expect(alex.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(alex.getByRole('dialog', { name: 'New here on this device?' })).toHaveCount(0);
  });

  test('Getting started brings it back; a non-admin gets the tour, not the setup', async ({ as }) => {
    const anita = await as('parent');
    await anita.goto('/');
    await expect(wizard(anita)).toHaveCount(0);

    await anita.getByRole('button', { name: 'Getting started' }).click();
    await expect(wizard(anita)).toBeVisible();
    await expect(wizard(anita).getByRole('button', { name: 'Take the tour' })).toBeVisible();
    await expect(wizard(anita).getByRole('button', { name: 'Add a student' })).toHaveCount(0);
    await expect(wizard(anita).getByRole('button', { name: 'Add a tutor' })).toHaveCount(0);
  });

  test('an admin adds a student: family first, then assessment, plan and a tutor', async ({ as }) => {
    const admin = await as('admin');
    const stamp = Date.now();
    const parentName = `Wizard Family ${stamp}`;
    const studentName = `Wizard Student ${stamp}`;
    let parentId = '';
    let studentId = '';

    try {
      await admin.goto('/');
      await admin.getByRole('button', { name: 'Getting started' }).click();
      await wizard(admin).getByRole('button', { name: 'Add a student' }).click();

      // The family, through the portal's own user form.
      await wizard(admin).getByRole('button', { name: 'Create a family account' }).click();
      const family = admin.getByRole('dialog', { name: 'New family account' });
      await family.locator('#full_name').fill(parentName);
      await family.locator('#email').fill(`wizard.family.${stamp}@gmail.com`);
      await family.getByRole('button', { name: 'Add user' }).click();
      await expect(family).toHaveCount(0);

      // The student, linked to them in the same request.
      await wizard(admin).getByRole('button', { name: 'Add the student' }).click();
      const student = admin.getByRole('dialog', { name: 'New student' });
      await student.locator('#full_name').fill(studentName);
      await student.getByRole('button', { name: 'Add user' }).click();
      await expect(student).toHaveCount(0);

      await wizard(admin).getByRole('button', { name: 'Record the assessment' }).click();
      // An assessment needs a write-up or a rated topic; the dialog holds that line.
      await admin.locator('#summary').fill('Solid on whole numbers; fractions need work.');
      await admin.getByRole('button', { name: 'Record assessment' }).click();

      await wizard(admin).getByRole('button', { name: 'Set the learning plan' }).click();
      await admin.locator('#goal').fill('Confident with fractions by June.');
      await admin.getByRole('button', { name: 'Create plan' }).click();

      await wizard(admin).getByRole('button', { name: 'Pair with a tutor' }).click();
      const pairing = admin.getByRole('dialog').last();
      await pairing.getByRole('combobox').first().click();
      await admin.getByRole('option', { name: PEOPLE.tutor.name }).click();
      await pairing.getByRole('button', { name: 'Assign', exact: true }).click();

      await expect(wizard(admin).getByRole('heading', { name: `${studentName} is set up` })).toBeVisible();

      // Real records, all of them.
      parentId = await idOf(admin, parentName);
      studentId = await idOf(admin, studentName);
      const record = await unwrap<any>(await admin.request.get(`/api/users/${studentId}`), 'the student');
      expect(record.guardians.map((link: any) => link.user_id)).toEqual([parentId]);
      const progress = await unwrap<any>(await admin.request.get(`/api/progress/${studentId}`), 'progress');
      expect(progress.assessments).toHaveLength(1);
      expect(progress.plan.goal).toBe('Confident with fractions by June.');
      const pairings = await unwrap<any[]>(
        await admin.request.get(`/api/assignments?student_user_id=${studentId}`),
        'pairings',
      );
      expect(pairings.map((row) => row.tutor_name)).toEqual([PEOPLE.tutor.name]);
    } finally {
      if (studentId) await admin.request.delete(`/api/users/${studentId}?hard=true`);
      if (parentId) await admin.request.delete(`/api/users/${parentId}?hard=true`);
    }
  });

  test('an admin adds a tutor: details, then financials, then availability', async ({ as }) => {
    const admin = await as('admin');
    const stamp = Date.now();
    const name = `Wizard Tutor ${stamp}`;
    let tutorId = '';

    try {
      await admin.goto('/');
      await admin.getByRole('button', { name: 'Getting started' }).click();
      await wizard(admin).getByRole('button', { name: 'Add a tutor' }).click();

      await wizard(admin).getByRole('button', { name: 'Add the tutor' }).click();
      const create = admin.getByRole('dialog', { name: 'New tutor' });
      await create.locator('#full_name').fill(name);
      await create.locator('#email').fill(`wizard.tutor.${stamp}@gmail.com`);
      // Only this step's fields: no pay rate on screen yet.
      await expect(create.locator('#t_rate_ip')).toHaveCount(0);
      await create.getByRole('button', { name: 'Add user' }).click();
      await expect(create).toHaveCount(0);

      await wizard(admin).getByRole('button', { name: 'Set up financials' }).click();
      const money = admin.getByRole('dialog', { name: `${name}: financials` });
      await money.locator('#t_rate_ip').fill('70');
      await money.locator('#t_topup').fill('100');
      await money.locator('#t_ssn').check();
      await money.locator('#t_addr1').fill('12 Maple Street');
      await money.getByLabel('Zelle').fill('wizard.tutor@zelle.example');
      await money.getByRole('button', { name: 'Save changes' }).click();
      await expect(money).toHaveCount(0);

      await wizard(admin).getByRole('button', { name: 'Set availability' }).click();
      const hours = admin.getByRole('dialog', { name: `${name}: availability` });
      await hours.locator('#t_virtual').check();
      await hours.getByRole('button', { name: 'Save changes' }).click();
      await expect(hours).toHaveCount(0);

      await wizard(admin).getByRole('button', { name: 'Skip', exact: true }).click();
      await expect(wizard(admin).getByRole('heading', { name: `${name} is set up` })).toBeVisible();

      // Each step saved its part, and no step cleared another's.
      tutorId = await idOf(admin, name);
      const record = await unwrap<any>(await admin.request.get(`/api/users/${tutorId}`), 'the tutor');
      expect(record.roles).toEqual(['tutor']);
      expect(record.tutor_profile).toMatchObject({
        default_rate_in_person_cents: 7000,
        topup_amount_cents: 10000,
        address_line1: '12 Maple Street',
        virtual_available: true,
      });
      expect(record.tutor_profile.ssn_received_on).not.toBeNull();
      expect(record.payment_handles).toEqual([
        expect.objectContaining({ method: 'zelle', handle: 'wizard.tutor@zelle.example' }),
      ]);
    } finally {
      if (tutorId) await admin.request.delete(`/api/users/${tutorId}?hard=true`);
    }
  });

  test('on a phone, the wizard fits and a menu step points at the menu button', async ({ as }) => {
    const admin = await as('admin');
    const parent = await newParent(admin, 'phone');

    try {
      const page = await as('parent', { fresh: true, email: parent.email });
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto('/');

      await expect(wizard(page)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);

      await wizard(page).getByRole('button', { name: 'Take the tour' }).click();
      const tour = page.getByTestId('tour');
      // Past the dashboard's own sections to the first menu item.
      const lit = page.locator('[data-tour-active]');
      for (let current = await lit.getAttribute('data-tour'); current?.startsWith('dash-'); ) {
        await tour.getByRole('button', { name: 'Next' }).click();
        await expect(lit).not.toHaveAttribute('data-tour', current);
        current = await lit.getAttribute('data-tour');
      }
      await expect(page.locator('[data-tour-active]')).toHaveAttribute('data-tour', 'nav-toggle');
      await expect(tour).toContainText('You will find it in the menu.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });
});

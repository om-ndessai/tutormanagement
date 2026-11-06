import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';

/**
 * Phase 26: the welcome wizard and feature tour.
 *
 * The rules worth holding: it opens by itself once per person (the database
 * remembers) and, since Phase 74 (JF25), a new browser does not offer it
 * again; closing it counts as having been through it, an admin's guided setup
 * uses the portal's own forms and leaves real records, and everybody else can
 * only confirm their details or send the office a note -- never edit them.
 *
 * Every seeded person has been through the wizard (the seed), so no other spec
 * meets it. These tests use people made here.
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
      await expect(page.locator('[data-tour-active]')).toHaveAttribute('data-tour', 'home-section-parent');

      // Through to the end; menu items are lit where they are. A parent's menu has no Billing, nor its stop (JF31).
      const lit: string[] = [];
      await tour.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('[data-tour-active]')).toHaveAttribute('data-tour', /^(home-|nav-)/);
      while (await tour.getByRole('button', { name: 'Next' }).count()) {
        lit.push((await page.locator('[data-tour-active]').getAttribute('data-tour')) ?? '');
        await tour.getByRole('button', { name: 'Next' }).click();
      }
      lit.push((await page.locator('[data-tour-active]').getAttribute('data-tour')) ?? '');
      expect(lit).not.toContain('nav-billing');
      await tour.getByRole('button', { name: 'Finish' }).click();

      // Then their own details, which they cannot edit -- only tell the office.
      await expect(wizard(page).getByRole('heading', { name: 'Confirm your details' })).toBeVisible();
      await expect(wizard(page)).toContainText(parent.email);
      await wizard(page).getByRole('button', { name: 'Something needs changing' }).click();
      await wizard(page).getByLabel('What needs changing?').fill('My phone number has changed.');
      await wizard(page).getByRole('button', { name: 'Send to the office' }).click();
      await wizard(page).getByRole('button', { name: 'Done' }).click();
      await expect(wizard(page)).toHaveCount(0);

      // The office has the note, on the parent's own record.
      const thread = await unwrap<any>(
        await admin.request.get(`/api/comments?target_type=user&target_id=${parent.id}`),
        'the note',
      );
      expect(thread.comments.map((comment: any) => comment.body)).toContain('My phone number has changed.');

      // Closed, no offer of it comes back at once (JF25).
      await expect(page.getByTestId('home-tour-offer')).toHaveCount(0);

      // It does not open again, and the person has been through it.
      await page.reload();
      await expect(page.getByTestId('member-home')).toBeVisible();
      await expect(wizard(page)).toHaveCount(0);
      await expect(page.getByTestId('home-tour-offer')).toHaveCount(0);
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
      await wizard(page).getByRole('button', { name: 'Done' }).click();

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
      await expect(page.getByTestId('member-home')).toBeVisible();
      await expect(wizard(page)).toHaveCount(0);
    } finally {
      await admin.request.delete(`/api/users/${parent.id}?hard=true`);
    }
  });

  test('on a new browser, somebody who has been through it is not offered it again', async ({ as }) => {
    // Phase 74 (JF25): once per PERSON -- the server's record decides, not the browser.
    const alex = await as('tutor', { fresh: true });
    await alex.goto('/');

    await expect(alex.getByTestId('member-home')).toBeVisible();
    await expect(wizard(alex)).toHaveCount(0);
    await expect(alex.getByTestId('home-tour-offer')).toHaveCount(0);
    await expect(alex.getByRole('dialog')).toHaveCount(0);
    // Getting started still brings it back on demand.
    await expect(alex.getByRole('button', { name: 'Getting started' })).toBeVisible();
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

  test('an admin adds a student: family first, then the next steps -- a tutor, a weekly lesson, an assessment', async ({ as }) => {
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

      // The family, through the portal's own user form -- the office's usual case leads (Phase 76, JF21).
      await wizard(admin).getByRole('button', { name: 'Create a family account' }).click();
      const family = admin.getByRole('dialog', { name: 'New family account' });
      await family.locator('#full_name').fill(parentName);
      await family.locator('#email').fill(`wizard.family.${stamp}@gmail.com`);
      await family.getByRole('button', { name: 'Add a person' }).click();
      await expect(family).toHaveCount(0);

      // The student, linked to them in the same request.
      await wizard(admin).getByRole('button', { name: 'Add the student' }).click();
      const student = admin.getByRole('dialog', { name: 'New student' });
      await student.locator('#full_name').fill(studentName);
      await student.getByRole('button', { name: 'Add a person' }).click();
      await expect(student).toHaveCount(0);

      // Then what next (nextStepsAfterAdd), each the portal's own dialog, preset.
      await expect(wizard(admin).getByRole('heading', { name: `${studentName} is added` })).toBeVisible();
      await wizard(admin).getByRole('button', { name: 'Record an assessment' }).click();
      // An assessment needs a write-up or a rated topic; the dialog holds that line.
      await admin.locator('#summary').fill('Solid on whole numbers; fractions need work.');
      await admin.getByRole('button', { name: 'Record assessment' }).click();

      await wizard(admin).getByRole('button', { name: 'Pair Wizard with a tutor' }).click();
      const pairing = admin.getByRole('dialog', { name: 'Pair a tutor with a student' });
      await expect(pairing.locator('#student')).toContainText(studentName);
      await pairing.locator('#tutor').click();
      await admin.getByRole('option', { name: PEOPLE.tutor.name }).click();
      await pairing.getByTestId('pairing-locations').getByRole('checkbox').first().check();
      await pairing.getByRole('button', { name: 'Assign', exact: true }).click();
      await expect(pairing).toHaveCount(0);

      await wizard(admin).getByRole('button', { name: 'Set a weekly lesson' }).click();
      const lesson = admin.getByRole('dialog', { name: 'Set a weekly lesson' });
      await expect(lesson.locator('#who')).toContainText(studentName);
      await lesson.getByRole('button', { name: 'Schedule', exact: true }).click();
      await expect(lesson).toHaveCount(0);

      // Real records, all of them.
      parentId = await idOf(admin, parentName);
      studentId = await idOf(admin, studentName);
      const record = await unwrap<any>(await admin.request.get(`/api/users/${studentId}`), 'the student');
      expect(record.guardians.map((link: any) => link.user_id)).toEqual([parentId]);
      const progress = await unwrap<any>(await admin.request.get(`/api/progress/${studentId}`), 'progress');
      expect(progress.assessments).toHaveLength(1);
      const pairings = await unwrap<any[]>(
        await admin.request.get(`/api/assignments?student_user_id=${studentId}`),
        'pairings',
      );
      expect(pairings.map((row) => row.tutor_name)).toEqual([PEOPLE.tutor.name]);
      const schedules = await unwrap<any[]>(await admin.request.get(`/api/schedules?student_user_id=${studentId}`), 'schedules');
      expect(schedules.map((row) => row.tutor_name)).toEqual([PEOPLE.tutor.name]);
    } finally {
      if (studentId) {
        for (const row of await unwrap<any[]>(await admin.request.get(`/api/schedules?student_user_id=${studentId}`), 'schedules')) {
          await admin.request.delete(`/api/schedules/${row.id}`);
        }
        await admin.request.delete(`/api/users/${studentId}?hard=true`);
      }
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
      await create.getByRole('button', { name: 'Add a person' }).click();
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
      // Past the home's own blocks to the first menu item.
      const lit = page.locator('[data-tour-active]');
      for (let current = await lit.getAttribute('data-tour'); current?.startsWith('home-'); ) {
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

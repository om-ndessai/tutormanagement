import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';
import {
  AUDIT_ACTION_LABELS,
  NOTIFICATION_KIND_LABELS,
  PLATFORM_BRAND,
  PRIVACY_SECTIONS,
  PRIVACY_SECTIONS_NEXT,
  PRIVACY_VERSION,
  TERMS_SECTIONS,
  TERMS_SECTIONS_NEXT,
  TERMS_VERSION,
  USER_ROLE_DESCRIPTIONS,
} from '@tmi/shared';

import { expect, ORGS, PEOPLE, test } from '../support/fixtures.js';
import type { PersonKey } from '../support/people.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 59, S1 (docs/spaces-plan.md): "Organization" leaves every screen.
 *
 * Every page, as each kind of reader, is read whole -- the rendered text, the text of the layout
 * that is hidden at this width (an absence assertion stays on the full DOM), and the placeholder,
 * title and aria-label of every element -- and must say neither "organization" nor "institute" as a
 * generic word. Proper names stay: the seeded "Chapel Hill Math Institute", the "Mathematics
 * Institute of the Triangle", and the seed's lesson places ("Institute, room 2").
 *
 * The terms and privacy text are crawled too: version 2026-10-31, the reworded one (decision 1),
 * approved by the owner on 2026-11-01, is the published text.
 *
 * Reading changes nothing, so the crawls use the seeded cast. The tests that write -- the tours, a
 * new space's log -- make their own people and their own space.
 */

const WORD = /organi[sz]ation/i;
/** "institute" as a word, outside the proper names and the seed's places. */
const INSTITUTE = /\binstitute(?<!chapel hill math institute)(?<!mathematics institute)(?!, room)/i;

const SOFIA = '00000000-0000-4000-8000-000000000008';
const SANJAY = '00000000-0000-4000-8000-000000000006';

/** Every line of a text that says either word. */
function offending(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && (WORD.test(line) || INSTITUTE.test(line)));
}

/**
 * Everything a reader (or a screen reader) can be shown on the page: the title, the body's text
 * nodes (both layouts, sr-only text and open dialogs included; scripts and styles not), and the
 * attributes that carry words.
 */
async function wordsOnPage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [document.title];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, noscript, template')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
    for (const element of document.querySelectorAll('[placeholder], [title], [aria-label], [aria-description], [alt]')) {
      for (const name of ['placeholder', 'title', 'aria-label', 'aria-description', 'alt']) {
        const value = element.getAttribute(name);
        if (value) parts.push(value);
      }
    }
    return parts.join('\n');
  });
}

/** The page as it settles: its data loaded, then read. */
async function problemsOn(page: Page): Promise<string[]> {
  await page.waitForLoadState('networkidle');
  // A query that resolved after networkidle (a debounce, a second request) gets its moment too.
  await page.waitForTimeout(250);
  return offending(await wordsOnPage(page));
}

/** Visits each path in turn and gathers what it says, keyed by path, so one report names every page. */
async function crawl(page: Page, paths: string[]): Promise<Record<string, string[]>> {
  const found: Record<string, string[]> = {};
  for (const path of paths) {
    await page.goto(path);
    const problems = await problemsOn(page);
    if (problems.length) found[path] = problems;
  }
  return found;
}

/** Every page inside a space. Somebody who may not open one is sent elsewhere, which is read too. */
const SPACE_PAGES = [
  '/',
  '/?tab=finance',
  '/dashboard',
  '/profile',
  '/users',
  '/assignments',
  '/sessions',
  '/sessions?tab=finance',
  '/progress',
  '/schedule',
  '/locations',
  '/billing',
  '/comments',
  '/assessments',
  '/quest',
  '/activity',
  '/organization',
  '/spaces',
  '/no-such-page',
];

const ROLES: { who: PersonKey; org: string; extra: string[] }[] = [
  {
    who: 'admin',
    org: ORGS.a.slug,
    extra: [
      `/progress/${SOFIA}`,
      `/progress/${SOFIA}/report`,
      '/quest/games/new',
      `/users?view=${SOFIA}`,
    ],
  },
  { who: 'tutor', org: ORGS.a.slug, extra: [`/progress/${SOFIA}`] },
  { who: 'parentTutor', org: ORGS.a.slug, extra: [] },
  { who: 'parent', org: ORGS.a.slug, extra: [`/progress/${SANJAY}`, `/progress/${SANJAY}/report`] },
  { who: 'student', org: ORGS.a.slug, extra: [] },
  { who: 'studentTutor', org: ORGS.a.slug, extra: [] },
  // Priya in Riverside, where she tutors only.
  { who: 'admin', org: ORGS.b.slug, extra: [] },
  { who: 'orgBAdmin', org: ORGS.b.slug, extra: [] },
  { who: 'orgBTutor', org: ORGS.b.slug, extra: [] },
  // An Assessment-only space, and a space paid directly.
  { who: 'assessAdmin', org: ORGS.c.slug, extra: [] },
  { who: 'assessParent', org: ORGS.c.slug, extra: [] },
  { who: 'soloAdmin', org: ORGS.d.slug, extra: [] },
  { who: 'soloTutor', org: ORGS.d.slug, extra: [] },
  { who: 'soloParent', org: ORGS.d.slug, extra: [] },
];

test.describe('S1: "Organization" leaves every screen (Phase 59)', () => {
  test.describe('every page inside a space, as each role', () => {
    for (const { who, org, extra } of ROLES) {
      test(`${PEOPLE[who].name} in ${org} reads neither word`, async ({ as }) => {
        test.setTimeout(180_000);
        const page = await as(who, { org });
        expect(await crawl(page, [...SPACE_PAGES, ...extra])).toEqual({});
      });
    }
  });

  test('outside a space: the selector, the console, the terms draft and the sign-in pages', async ({ as }) => {
    test.setTimeout(180_000);
    // Priya is in two spaces: with no space chosen she meets the selector.
    const priya = await as('admin', { org: null });
    expect(await crawl(priya, ['/spaces', '/select-organization'])).toEqual({});

    const platform = await as('platformAdmin', { org: null });
    expect(
      await crawl(platform, [
        '/platform',
        '/platform/organizations',
        '/platform/admins',
        '/platform/people',
        '/platform/activity',
        '/platform/questions',
        '/platform/questions/review',
        '/platform/questions/NC26.M1.ANFR.1',
        '/platform/ai',
        '/spaces',
      ]),
    ).toEqual({});

    // The terms and privacy text, readable signed out (and an old ?draft=1 link to them).
    const anyone = await as('parent', { org: null });
    expect(
      await crawl(anyone, ['/terms', '/privacy', '/terms?draft=1', '/privacy?draft=1', '/login', '/signup']),
    ).toEqual({});
  });

  test("the console's space dialogs: a new space, and editing one", async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/platform');
    await platform.getByRole('button', { name: 'New space' }).click();
    const create = platform.getByRole('dialog');
    await expect(create).toBeVisible();
    expect(await problemsOn(platform)).toEqual([]);
    // Both payment models, with the payer details showing.
    const who = create.getByRole('radiogroup', { name: 'Who families pay' });
    await who.getByRole('radio', { name: /The space/ }).check();
    expect(await problemsOn(platform)).toEqual([]);
    await platform.keyboard.press('Escape');
    await expect(create).toBeHidden();

    for (const name of [ORGS.a.name, ORGS.d.name]) {
      await platform.getByRole('button', { name: `Edit ${name}` }).click();
      const edit = platform.getByRole('dialog');
      await expect(edit).toBeVisible();
      expect(await problemsOn(platform), `editing ${name}`).toEqual([]);
      await platform.keyboard.press('Escape');
      await expect(edit).toBeHidden();
    }
  });

  test("an admin's dialogs and menus: adding a person, the account menu, the command palette", async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/users');
    await admin.getByRole('button', { name: 'Add user' }).click();
    const dialog = admin.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The role hints: "Runs the space", never "Owns the institute".
    await expect(dialog).toContainText(USER_ROLE_DESCRIPTIONS.admin);
    expect(await problemsOn(admin)).toEqual([]);
    await admin.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await admin.goto('/');
    await admin.getByRole('button', { name: 'Account menu' }).click();
    await expect(admin.getByRole('menu')).toBeVisible();
    expect(await problemsOn(admin)).toEqual([]);
    await admin.keyboard.press('Escape');

    await admin.keyboard.press('ControlOrMeta+k');
    const palette = admin.getByRole('dialog', { name: 'Go anywhere' });
    await expect(palette).toBeVisible();
    expect(await problemsOn(admin)).toEqual([]);
    // The Space page is found by the word people now read.
    await palette.getByRole('combobox').fill('space');
    expect(await problemsOn(admin)).toEqual([]);
    await admin.keyboard.press('Escape');
  });

  test('the welcome wizard and the tour, as a new admin, tutor, parent and student', async ({ as }) => {
    test.setTimeout(240_000);
    const admin = await as('admin');
    const stamp = Date.now();
    const made: string[] = [];
    const add = async (data: Record<string, unknown>) => {
      const person = await unwrap<any>(await admin.request.post('/api/users', { data }), `adding ${data.full_name}`);
      made.push(person.id);
      return person;
    };

    try {
      const people = {
        admin: await add({ full_name: 'Wendy Words', email: `words.admin.${stamp}@gmail.com`, roles: ['admin'], status: 'active' }),
        tutor: await add({
          full_name: 'Toby Words',
          email: `words.tutor.${stamp}@gmail.com`,
          roles: ['tutor'],
          status: 'active',
          tutor_profile: { default_rate_in_person_cents: 60_00 },
        }),
        parent: await add({
          full_name: 'Pam Words',
          email: `words.parent.${stamp}@gmail.com`,
          roles: ['parent'],
          status: 'active',
          phone: '(919) 555-0178',
        }),
      };
      const student = await add({
        full_name: 'Sid Words',
        email: `words.student.${stamp}@gmail.com`,
        roles: ['student'],
        status: 'active',
        guardians: [{ guardian_user_id: people.parent.id, relationship: 'mother', is_primary: true }],
      });

      for (const [label, person] of Object.entries({ ...people, student })) {
        const page = await as('parent', { fresh: true, email: person.email });
        await page.goto('/');
        const wizard = page.getByTestId('onboarding-wizard');
        // It opens by itself the first time.
        await expect(wizard, label).toBeVisible();
        expect(await problemsOn(page), `${label}: the wizard`).toEqual([]);

        await wizard.getByRole('button', { name: 'Take the tour' }).click();
        const tour = page.getByTestId('tour');
        await expect(tour, label).toBeVisible();
        const steps: string[] = [];
        for (let step = 1; step < 40; step++) {
          const text = await tour.innerText();
          steps.push(text);
          expect(offending(text), `${label}: tour step ${step}`).toEqual([]);
          const next = tour.getByRole('button', { name: 'Next' });
          if (!(await next.count())) break;
          await next.click();
          await expect.poll(() => tour.innerText(), { message: `${label}: step ${step + 1}` }).not.toBe(text);
        }
        if (label === 'admin') {
          // An admin's first step is the space at a glance, not the institute.
          expect(steps[0]).toContain('Your space at a glance');
        }
        await tour.getByRole('button', { name: 'Finish' }).click();
        // What follows the tour (the setup, or confirming one's details) says neither word either.
        expect(await problemsOn(page), `${label}: after the tour`).toEqual([]);
        await page.context().close();
      }
    } finally {
      for (const id of made.reverse()) await admin.request.delete(`/api/users/${id}?hard=true`);
    }
  });

  test("a newcomer's Welcome, before any space", async ({ as, page }) => {
    const email = `words.newcomer.${Date.now()}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: {
          dev_email: email,
          dev_name: 'Nell Words',
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          birth_month: 4,
          birth_year: 1984,
        },
      }),
      'signing up',
    );
    const nell = await as('parent', { email, org: null });
    await nell.goto('/');
    await expect(nell.getByTestId('welcome')).toBeVisible();
    expect(await problemsOn(nell)).toEqual([]);
    expect(await crawl(nell, ['/spaces'])).toEqual({});
  });

  test('a new space: its pages, and every line its log gains, say space', async ({ as }) => {
    test.setTimeout(120_000);
    const platform = await as('platformAdmin', { org: null });
    const stamp = Date.now();
    const slug = `words-${stamp}`;
    const space = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: {
          name: `Words Club ${stamp}`,
          short_name: 'Words',
          slug,
          payment_model: 'space',
          payer_name: 'Words Club LLC',
          tin: '77-1234567',
          payer_city: 'Durham',
        },
      }),
      'making the space',
    );

    try {
      // The platform's own actions on it: its admin, a logo-free settings change, the payment model
      // both ways, archive and restore.
      const adminEmail = `words.space.admin.${stamp}@gmail.com`;
      await unwrap(
        await platform.request.post(`/api/platform/organizations/${space.id}/admins`, {
          data: { email: adminEmail, full_name: 'Ada Words' },
        }),
        'adding its admin',
      );
      await unwrap(
        await platform.request.patch(`/api/platform/organizations/${space.id}`, { data: { tagline: 'Words, words, words' } }),
        'updating it',
      );
      for (const model of ['direct', 'space']) {
        await unwrap(
          await platform.request.put(`/api/platform/organizations/${space.id}/payment-model`, { data: { model } }),
          `paid by ${model}`,
        );
      }
      await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/archive`), 'archiving');
      await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/restore`), 'restoring');

      const lines = (await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the console log')).filter(
        (row) => row.organization_id === space.id,
      );
      expect(lines.map((row) => row.action)).toEqual(
        expect.arrayContaining(['organization.created', 'organization.admin_added', 'organization.archived', 'organization.restored']),
      );
      for (const row of lines) {
        expect(offending(row.description), `${row.action}: ${row.description}`).toEqual([]);
        expect(offending(AUDIT_ACTION_LABELS[row.action as keyof typeof AUDIT_ACTION_LABELS] ?? ''), row.action).toEqual([]);
      }
      expect(lines.find((row) => row.action === 'organization.created')!.description).toMatch(/\bspace\b/);
      expect(lines.find((row) => row.action === 'organization.archived')!.description).toMatch(/\bspace\b/);

      // The console's Activity page shows them.
      expect(await crawl(platform, ['/platform/activity', '/platform'])).toEqual({});

      // Its admin accepts, and reads the space's own pages -- the Space page with its payer details,
      // its log, and the wizard that opens by itself the first time.
      const ada = await as('admin', { email: adminEmail, org: null });
      await unwrap(await ada.request.post(`/api/auth/invitations/${slug}/accept`), 'accepting');
      const inSpace = await as('admin', { email: adminEmail, org: slug });
      expect(await crawl(inSpace, ['/', '/organization', '/activity', '/users', '/spaces'])).toEqual({});
    } finally {
      await platform.request.post(`/api/platform/organizations/${space.id}/archive`);
    }
  });

  test('the API says space: organization_required, a taken email, a non-member', async ({ as }) => {
    const admin = await as('admin');

    // No such space named.
    const nowhere = await admin.request.get('/api/users', { headers: { 'X-Organization': 'no-such-space-anywhere' } });
    expect(nowhere.status()).toBe(403);
    const refused = (await nowhere.json()).error;
    expect(refused.code).toBe('organization_required');
    expect(refused.message).toMatch(/\bspace\b/i);
    expect(offending(refused.message)).toEqual([]);

    // A space she is not in answers the same.
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const outside = await rosa.request.get('/api/users', { headers: { 'X-Organization': ORGS.a.slug } });
    expect(outside.status()).toBe(403);
    const outsideError = (await outside.json()).error;
    expect(outsideError.code).toBe('organization_required');
    expect(offending(outsideError.message)).toEqual([]);

    // Somebody in this space already has that address.
    const taken = await admin.request.post('/api/users', {
      data: { full_name: 'Alex Again', email: PEOPLE.tutor.email, roles: ['tutor'], status: 'active' },
    });
    expect(taken.ok()).toBe(false);
    const takenError = (await taken.json()).error;
    expect(takenError.message).toBe('Someone in this space already has that email address.');
  });

  test('the guard is green: no screen string says "organization" (scripts/check-ui-words.mjs)', () => {
    const repo = fileURLToPath(new URL('../../', import.meta.url));
    // It throws on a non-zero exit, with the offending lines in its output.
    const output = execFileSync(process.execPath, ['scripts/check-ui-words.mjs'], { cwd: repo, encoding: 'utf8' });
    expect(output).toContain('no screen says');
  });

  test("the shared words: audit labels, notification labels, role hints, the brand blurb, the next terms", () => {
    for (const [action, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(offending(label), action).toEqual([]);
    }
    expect(AUDIT_ACTION_LABELS['organization.created']).toBe('Space created');
    expect(AUDIT_ACTION_LABELS['organization.business_set']).toBe('Space collects payments');
    expect(AUDIT_ACTION_LABELS['organization.business_cleared']).toBe('Families pay tutors directly');

    for (const [kind, label] of Object.entries(NOTIFICATION_KIND_LABELS)) {
      expect(offending(label), kind).toEqual([]);
    }
    for (const [role, hint] of Object.entries(USER_ROLE_DESCRIPTIONS)) {
      expect(offending(hint), role).toEqual([]);
    }
    expect(USER_ROLE_DESCRIPTIONS.admin).toBe('Runs the space. Only admins can add people.');

    for (const text of [PLATFORM_BRAND.name, PLATFORM_BRAND.tagline, PLATFORM_BRAND.blurb]) {
      expect(offending(text ?? '')).toEqual([]);
    }
    expect(PLATFORM_BRAND.blurb).toContain('tutors, families and schools');

    for (const section of [...TERMS_SECTIONS, ...PRIVACY_SECTIONS, ...TERMS_SECTIONS_NEXT, ...PRIVACY_SECTIONS_NEXT]) {
      expect(offending([section.heading, ...section.paragraphs].join('\n')), section.heading).toEqual([]);
    }
  });
});

import type { Page } from '@playwright/test';
import { ORGS, expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import type { PersonKey } from '../support/people.js';

/**
 * R13 -- nothing crosses organizations (docs/data-exposure.md).
 *
 * The seed's two organizations share four people on purpose: Priya administers
 * A and only tutors in B, Alex tutors in A and is a parent in B, Anita is a
 * parent in both, and Priya teaches Sanjay in both. Those are the shapes a
 * leak would take -- a query keyed on a person rather than on the
 * organization -- so they are what this crawls.
 *
 * Each organization's universe is the set of ids its admin can reach. Ids in
 * BOTH (the shared people) are allowed everywhere; an id in only one must
 * never be returned inside the other, to anybody, by any endpoint -- admins
 * and "view as" included, which the R1-R12 crawl does not cover.
 */

/** Every id-like string anywhere in a response. */
function idsIn(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) idsIn(item, into);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) idsIn(item, into);
  }
  return into;
}

async function body(page: Page, path: string): Promise<unknown> {
  const response = await page.request.get(path);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const READS = [
  '/api/users?limit=100&include_deleted=true',
  '/api/sessions?limit=200',
  '/api/sessions/drafts',
  '/api/sessions/active',
  '/api/assignments?include_inactive=true',
  '/api/payments?limit=200',
  '/api/payments/balances',
  '/api/payments/monthly?year=2026',
  '/api/audit?limit=200',
  '/api/audit/actions',
  '/api/schedules?include_inactive=true',
  '/api/schedules/upcoming?limit=20',
  '/api/schedules/cancellations?limit=100',
  '/api/comments/feed?limit=100',
  '/api/comments/counts?target_type=user',
  '/api/comments/counts?target_type=session',
  '/api/progress',
  // Phase 32: the organization's notification log (admins; refused to others).
  '/api/organization/notifications',
];

/** Everything an organization's admin can reach in it: its universe of ids. */
async function universe(admin: Page): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const path of READS) idsIn(await body(admin, path), ids);
  for (const role of ['admin', 'tutor', 'parent', 'student']) {
    idsIn(await body(admin, `/api/dashboard?role=${role}`), ids);
  }
  return ids;
}

/** Crawls everything `page` can read and reports any id from the other organization. */
async function crawl(page: Page, forbidden: Set<string>, words: string[]): Promise<string[]> {
  const problems: string[] = [];
  const seen = (path: string, value: unknown) => {
    for (const id of idsIn(value)) if (forbidden.has(id)) problems.push(`${path}: ${id}`);
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    for (const word of words) if (text.includes(word)) problems.push(`${path}: "${word}"`);
  };

  for (const path of READS) seen(path, await body(page, path));

  const session = (await body(page, '/api/auth/session')) as any;
  for (const role of session.data.user.roles as string[]) {
    seen(`dashboard ${role}`, await body(page, `/api/dashboard?role=${role}`));
  }

  // Every person they can list, opened.
  const people = ((await body(page, '/api/users?limit=100')) as any).data as { id: string }[];
  for (const person of people) seen(`/api/users/${person.id}`, await body(page, `/api/users/${person.id}`));

  // The files, which are built from the same queries.
  seen('sessions csv', await body(page, '/api/sessions/export.csv'));
  seen('payments csv', await body(page, '/api/payments/export.csv'));
  seen('calendar', await body(page, '/api/schedules/calendar.ics'));
  if (session.data.user.roles.includes('admin')) {
    seen('tax summary', await body(page, '/api/payments/tax-summary.csv?year=2026'));
    // "View as" anybody they can list reaches no further.
    for (const person of people.slice(0, 12)) {
      seen(`view as ${person.id}`, await body(page, `/api/dashboard?user_id=${person.id}`));
    }
  }
  return problems;
}

test.describe('R13: nothing crosses organizations', () => {
  test('organization A, read by every kind of member, shows nothing of B', async ({ as }) => {
    test.slow();
    const aAdmin = await as('admin');
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });

    const a = await universe(aAdmin);
    const b = await universe(bAdmin);
    const onlyB = new Set([...b].filter((id) => !a.has(id)));
    expect(onlyB.size, 'organization B has rows of its own').toBeGreaterThan(5);

    // The names only B has, and B's own notes.
    const words = ['Rosa Delgado', 'Kwame Mensah', 'Lily Chen', 'Arjun Patel', 'Riverside'];

    const personas: PersonKey[] = ['admin', 'tutor', 'parentTutor', 'parent', 'student', 'studentTutor'];
    for (const who of personas) {
      const page = who === 'admin' ? aAdmin : await as(who);
      expect(await crawl(page, onlyB, words), `${who} in A`).toEqual([]);
    }
  });

  test('B, read by the people it shares with A, shows nothing of A', async ({ as }) => {
    test.slow();
    const aAdmin = await as('admin');
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });

    const a = await universe(aAdmin);
    const b = await universe(bAdmin);
    const onlyA = new Set([...a].filter((id) => !b.has(id)));

    // Priya is A's admin and only a tutor here; Anita a parent in both; Alex a
    // tutor in A and a parent here; Sanjay a student in both.
    const words = ['Chapel Hill Math Institute', 'Sofia Okafor', 'Maria Okafor', 'Ben Whitfield'];
    for (const who of ['admin', 'parent', 'tutor', 'studentTutor'] as PersonKey[]) {
      const page = await as(who, { org: ORGS.b.slug });
      expect(await crawl(page, onlyA, words), `${who} in B`).toEqual([]);
    }
    expect(await crawl(bAdmin, onlyA, words), 'B admin').toEqual([]);
  });

  test('an id from the other organization is missing, by id and on write', async ({ as }) => {
    const aAdmin = await as('admin');
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });

    const bSession = ((await body(bAdmin, '/api/sessions?limit=1')) as any).data[0];
    const bPayment = ((await body(bAdmin, '/api/payments?limit=1')) as any).data[0];
    const bAssignment = ((await body(bAdmin, '/api/assignments')) as any).data[0];
    const bSchedule = ((await body(bAdmin, '/api/schedules')) as any).data[0];
    const bPeople = ((await body(bAdmin, '/api/users?limit=100')) as any).data as any[];
    const kwame = bPeople.find((person) => person.full_name === 'Kwame Mensah');
    const lily = bPeople.find((person) => person.full_name === 'Lily Chen');

    // Read by id inside A: not found, never forbidden.
    for (const path of [
      `/api/sessions/${bSession.id}`,
      `/api/payments/${bPayment.id}`,
      `/api/assignments/${bAssignment.id}`,
      `/api/schedules/${bSchedule.id}/calendar.ics`,
      `/api/users/${kwame.id}`,
      `/api/progress/${lily.id}`,
      `/api/comments?target_type=session&target_id=${bSession.id}`,
    ]) {
      expect((await aAdmin.request.get(path)).status(), path).toBe(404);
    }

    // Writes that name B's rows or people answer as missing too.
    expect((await aAdmin.request.patch(`/api/sessions/${bSession.id}`, { data: { notes: 'x' } })).status()).toBe(404);
    expect((await aAdmin.request.delete(`/api/payments/${bPayment.id}`)).status()).toBe(404);
    expect((await aAdmin.request.patch(`/api/users/${kwame.id}`, { data: { phone: '919' } })).status()).toBe(404);
    expect(
      (await aAdmin.request.post('/api/comments', {
        data: { target_type: 'session', target_id: bSession.id, body: 'Crossing over.' },
      })).status(),
    ).toBe(404);
    const pairing = await aAdmin.request.post('/api/assignments', {
      data: { tutor_user_id: kwame.id, student_user_id: lily.id },
    });
    expect(pairing.status()).toBe(422);
    expect(JSON.stringify(await pairing.json())).toContain('no longer exists');

    // And B's own row is untouched by any of it.
    const still = await unwrap<any>(await bAdmin.request.get(`/api/sessions/${bSession.id}`), 'B reading its lesson');
    expect(still.notes).toBe(bSession.notes);
  });

  test('an organization not named, or not one of mine, is refused', async ({ as }) => {
    const bAdmin = await as('orgBAdmin', { org: ORGS.b.slug });
    // Rosa belongs to B alone: naming A gets her nowhere.
    const into = await bAdmin.request.get('/api/users', { headers: { 'X-Organization': ORGS.a.slug } });
    expect(into.status()).toBe(403);
    expect((await into.json()).error.code).toBe('organization_required');

    const nowhere = await as('orgBAdmin', { org: null });
    expect((await nowhere.request.get('/api/sessions')).status()).toBe(403);
  });
});

test.describe('R14: the platform console reaches organizations, not their data', () => {
  test('only a platform admin may use it, and it shows no lessons or money', async ({ as }) => {
    const orgAdmin = await as('admin');
    expect((await orgAdmin.request.get('/api/platform/organizations')).status()).toBe(403);

    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'listing');
    expect(orgs.map((org) => org.slug)).toEqual(expect.arrayContaining([ORGS.a.slug, ORGS.b.slug]));

    // A member of neither: every organization route refuses them.
    for (const path of ['/api/users', '/api/sessions', '/api/payments', '/api/dashboard']) {
      expect((await platform.request.get(path, { headers: { 'X-Organization': ORGS.a.slug } })).status(), path).toBe(403);
    }

    // Nothing the console answers carries a lesson, a price or a student.
    const everything = JSON.stringify([
      orgs,
      await body(platform, `/api/platform/organizations/${orgs[0].id}/admins`),
      await body(platform, '/api/platform/admins'),
      await body(platform, '/api/platform/audit'),
    ]);
    for (const word of ['_cents', 'Sofia Okafor', 'Lily Chen', 'session_id']) {
      expect(everything).not.toContain(word);
    }
  });
});

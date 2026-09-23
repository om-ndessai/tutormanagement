import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE, type PersonKey } from '../support/people.js';

/**
 * Phase 18: what a non-admin may see, checked by crawling rather than by
 * example.
 *
 * Every earlier leak -- a tutor reading the family's price in their own log,
 * a parent reading a tutor's pay on a pairing -- slipped through because each
 * test looked at the one screen it was about. This spec signs in as every
 * kind of non-admin, calls every read endpoint, and walks EVERY object in
 * every response against the rules below, whatever endpoint it came from. A
 * new route that forgets its scoping fails here without anyone having written
 * a test for it.
 *
 * The rules (docs/data-exposure.md):
 *   R1 tutor pay     appears only on rows the reader taught
 *   R2 family price  appears only on the reader's own or their children's
 *                    lessons, and never on ones they taught
 *   R3 labels        money_view agrees with R1/R2
 *   R4 prices        a student's price per hour only to their own family
 *   R5 pay rates     a tutor's default and pairing rates only to that tutor
 *   R6 private       advance level, payment handles, SSN receipt and last
 *                    sign-in only on the reader's own record
 *   R7 people        every person id in a response is someone the reader
 *                    may see (who ACTED -- an audit actor, a comment author,
 *                    an assessor -- is named, and exempt)
 *   R8 log           no amount of money in any audit line
 *   R9 by id         a lesson or payment that is not in the reader's list is
 *                    "not found" when fetched by id
 */

const PERSONAS: PersonKey[] = ['tutor', 'parentTutor', 'parent', 'student', 'studentTutor'];

/** Keys naming who did something, rather than whom a record is about. */
const ACTOR_KEYS = new Set([
  'actor_user_id',
  'author_user_id',
  'assessor_user_id',
  'recorded_by_user_id',
  'created_by_user_id',
]);

interface Reader {
  id: string;
  family: Set<string>;
  visible: Set<string>;
}

async function get(page: Page, path: string): Promise<unknown> {
  const response = await page.request.get(path);
  expect(response.status(), `${path} should be readable`).toBe(200);
  return (await response.json()).data;
}

/** Every object in a JSON value, however deeply nested, with a breadcrumb. */
function* objects(value: unknown, path: string): Generator<[Record<string, any>, string]> {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* objects(item, `${path}[${index}]`);
  } else if (value && typeof value === 'object') {
    yield [value as Record<string, any>, path];
    for (const [key, item] of Object.entries(value)) yield* objects(item, `${path}.${key}`);
  }
}

function check(reader: Reader, source: string, value: unknown, problems: string[]) {
  const fail = (where: string, rule: string) => problems.push(`${rule} at ${source}${where}`);

  for (const [row, where] of objects(value, '')) {
    const taught = row.tutor_user_id === reader.id;
    const ownFamily = reader.family.has(row.student_user_id) && !taught;

    // R1, R2, R3: a lesson's two sides of money.
    if ('tutor_amount_cents' in row && 'student_user_id' in row) {
      if (row.tutor_amount_cents != null && !taught) fail(where, 'R1 tutor pay on a lesson not taught');
      if (row.tutor_rate_cents != null && !taught) fail(where, 'R1 tutor rate on a lesson not taught');
      if (row.charge_amount_cents != null && !ownFamily) fail(where, 'R2 family price seen by a non-family reader');
      if (row.charge_rate_cents != null && !ownFamily) fail(where, 'R2 family rate seen by a non-family reader');
      if ('money_view' in row) {
        const expected = taught ? 'tutor' : ownFamily ? 'family' : 'none';
        if (row.money_view !== expected) fail(where, `R3 money_view ${row.money_view}, expected ${expected}`);
      }
    }

    // R4: a student's price, on their profile.
    if (row.student_profile && row.id) {
      const prices = [row.student_profile.charge_rate_in_person_cents, row.student_profile.charge_rate_virtual_cents];
      if (prices.some((p) => p != null) && !reader.family.has(row.id)) fail(where, 'R4 student price outside the family');
    }

    // R5 + R6: a tutor's pay and private arrangements.
    if (row.tutor_profile && row.id && row.id !== reader.id) {
      const tp = row.tutor_profile;
      if (tp.default_rate_in_person_cents != null || tp.default_rate_virtual_cents != null) fail(where, 'R5 tutor default rate');
      if (tp.topup_amount_cents != null) fail(where, 'R6 tutor advance level');
      if (tp.ssn_received_on != null) fail(where, 'R6 SSN receipt');
      if ([tp.address_line1, tp.address_line2, tp.city, tp.state, tp.postal_code].some((v) => v != null)) {
        fail(where, 'R6 tutor mailing address');
      }
    }
    if ('effective_rate_in_person_cents' in row && row.tutor_user_id !== reader.id) {
      if (row.effective_rate_in_person_cents != null || row.effective_rate_virtual_cents != null) {
        fail(where, 'R5 pairing pay rate');
      }
    }
    if (Array.isArray(row.payment_handles) && row.id !== reader.id && row.payment_handles.length > 0) {
      fail(where, 'R6 payment handles');
    }
    if ('last_login_at' in row && 'email' in row && row.id !== reader.id && row.last_login_at != null) {
      fail(where, 'R6 last sign-in');
    }

    // R7: nobody the reader may not see.
    for (const [key, id] of Object.entries(row)) {
      if (typeof id !== 'string' || ACTOR_KEYS.has(key)) continue;
      if ((key === 'user_id' || key.endsWith('_user_id')) && !reader.visible.has(id)) {
        fail(`${where}.${key}`, `R7 unknown person ${id}`);
      }
    }

    // R8: no money in the log.
    if (typeof row.action === 'string' && typeof row.description === 'string') {
      if (/\d+\.\d{2}\s*USD|\$\d/.test(row.description)) fail(where, 'R8 amount in an audit line');
    }
  }
}

test.describe('what each non-admin can see', () => {
  for (const who of PERSONAS) {
    test(`${who}: every read endpoint obeys the visibility rules`, async ({ as }) => {
      const admin = await as('admin');
      const page = await as(who);

      const id = await idOf(admin, PEOPLE[who].email);
      const me = await unwrap<any>(await page.request.get(`/api/users/${id}`), 'own record');
      const people = (await get(page, '/api/users?limit=100')) as { id: string }[];

      const reader: Reader = {
        id,
        family: new Set([id, ...me.dependents.map((d: any) => d.user_id)]),
        visible: new Set(people.map((person) => person.id)),
      };
      expect(reader.visible.has(id)).toBe(true);

      const problems: string[] = [];
      const read = async (path: string) => check(reader, path, await get(page, path), problems);

      await read('/api/sessions?limit=200');
      await read('/api/assignments?include_inactive=true');
      await read('/api/payments?limit=200');
      await read('/api/payments/balances');
      await read('/api/payments/monthly?year=2026');
      await read('/api/audit?limit=200');
      await read('/api/schedules');
      await read('/api/schedules/upcoming?limit=10');
      await read('/api/comments/feed');
      await read('/api/progress');
      await read('/api/sessions/active');

      for (const role of me.roles) await read(`/api/dashboard?role=${role}`);
      for (const person of people) await read(`/api/users/${person.id}`);

      const followed = (await get(page, '/api/progress')) as { student_user_id: string }[];
      for (const row of followed) await read(`/api/progress/${row.student_user_id}`);

      // R9: every lesson and payment the admin can see, fetched by id, is
      // either one this reader lists or "not found".
      const mine = new Set(((await get(page, '/api/sessions?limit=200')) as any[]).map((s) => s.id));
      const all = (await get(admin, '/api/sessions?limit=200')) as any[];
      for (const session of all) {
        const response = await page.request.get(`/api/sessions/${session.id}`);
        if (mine.has(session.id)) {
          expect(response.status()).toBe(200);
          check(reader, `/api/sessions/${session.id}`, (await response.json()).data, problems);
        } else {
          expect(response.status(), `R9 lesson ${session.id} should be hidden from ${who}`).toBe(404);
        }
      }

      // Phase 21: every upcoming lesson comes from a schedule this reader can
      // list, and carries no money -- it is shown on the Tutoring tab.
      const mySchedules = new Set(((await get(page, '/api/schedules')) as any[]).map((s) => s.id));
      for (const next of (await get(page, '/api/schedules/upcoming?limit=10')) as any[]) {
        if (!mySchedules.has(next.schedule_id)) problems.push(`upcoming lesson from hidden schedule ${next.schedule_id}`);
        if (Object.keys(next).some((key) => key.endsWith('_cents'))) problems.push('upcoming lesson carries money');
      }

      const myPayments = new Set(((await get(page, '/api/payments?limit=200')) as any[]).map((p) => p.id));
      const allPayments = (await get(admin, '/api/payments?limit=200')) as any[];
      for (const payment of allPayments) {
        const status = (await page.request.get(`/api/payments/${payment.id}`)).status();
        expect(status, `R9 payment ${payment.id} for ${who}`).toBe(myPayments.has(payment.id) ? 200 : 404);
      }

      expect(problems, problems.slice(0, 20).join('\n')).toEqual([]);
    });
  }

  test('a non-admin cannot widen their view through the query string', async ({ as }) => {
    const parent = await as('parent');
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    // Deleted people, another person's dashboard, another person's rundown.
    const deleted = (await get(parent, '/api/users?include_deleted=true&limit=100')) as any[];
    expect(deleted.every((person) => person.deleted_at === null)).toBe(true);
    expect((await parent.request.get(`/api/dashboard?user_id=${tutorId}`)).status()).toBe(403);
    expect((await parent.request.get(`/api/payments/monthly?year=2026&user_id=${tutorId}`)).status()).toBe(403);

    // A comment the reader cannot read is missing, not forbidden. Seeded:
    // Anita's note about her son Sanjay, whom Alex does not teach.
    const alex = await as('tutor');
    expect((await alex.request.delete('/api/comments/c0000000-0000-4000-8000-000000000003')).status()).toBe(404);

    // The audit filter offers only actions in the reader's own events.
    const actions = (await get(parent, '/api/audit/actions')) as string[];
    const own = ((await get(parent, '/api/audit?limit=200')) as any[]).map((event) => event.action);
    expect(actions.every((action) => own.includes(action))).toBe(true);
  });

  test('a dashboard shows only its own role’s data', async ({ as }) => {
    // Maria tutors and is Sofia's mother. Her tutor view is her teaching;
    // her parent view is Sofia.
    const maria = await as('parentTutor');
    const admin = await as('admin');
    const mariaId = await idOf(admin, PEOPLE.parentTutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    const tutorView = ((await get(maria, '/api/dashboard?role=tutor')) as any).data;
    expect(tutorView.recent_sessions.every((s: any) => s.tutor_user_id === mariaId)).toBe(true);
    expect(tutorView.recent_payments.every((p: any) => p.party_user_id === mariaId)).toBe(true);
    expect(tutorView.progress_spotlight.every((p: any) => p.student.user_id !== sofiaId)).toBe(true);
    // Her carousel asks for her teaching, so Sofia's lessons with Alex are not in it.
    const upcoming = (await get(maria, `/api/schedules/upcoming?tutor_user_id=${mariaId}&limit=10`)) as any[];
    expect(upcoming.every((row) => row.tutor_user_id === mariaId)).toBe(true);

    const parentView = ((await get(maria, '/api/dashboard?role=parent')) as any).data;
    expect(parentView.recent_sessions.every((s: any) => s.student_user_id === sofiaId)).toBe(true);
    expect(parentView.recent_payments.every((p: any) => p.direction === 'from_parent')).toBe(true);

    // An admin viewing her dashboard gets her rundown, not the institute's.
    const rundown = (await get(admin, `/api/payments/monthly?year=2026&user_id=${mariaId}`)) as any;
    expect(rundown.scope).toBe('tutor');
  });
});

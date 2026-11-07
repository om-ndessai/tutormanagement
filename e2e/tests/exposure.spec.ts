import type { Page } from '@playwright/test';

import { expect, test, type AsOptions } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { PEOPLE, type PersonKey } from '../support/people.js';
import { pdfPageText } from '../support/pdf.js';

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
 *   R10 drafts       an unposted write-up -- its notes, parts and assessment --
 *                    reaches only its author, whoever else it names
 *   R11 cancellations a cancelled lesson comes from a schedule the reader can
 *                    list; through progress (read more widely) its date may
 *                    reach any reader, but its note and canceller only the
 *                    schedule's own audience
 *   R12 reflections  a student's reflection, the tutor dashboard's digest of
 *                    them and a parent's or student's prompt for one are all
 *                    about lessons the reader lists, and a prompt has no money
 *   R33 Continue     the open game is one the reader plays in, with their own
 *                    team's progress; the lead grade and the grade picked are
 *                    the reader's own (Phase 73)
 *   R34 owed, prices a missing price is said by WHICH mode, never an amount;
 *                    the lessons owed are the reader's own teaching, name the
 *                    place by name and kind only, carry no money, and a row's
 *                    draft is the reader's own (Phase 75)
 *   R35 at home      a child's card says only whether they sign in and their
 *                    grade, and Continue is a game the reader seated them in;
 *                    a game's seats and invited list are its host's; a
 *                    guardian continues an assessment in progress, never
 *                    discards somebody else's, never reads its keys (Phase 77)
 */

const PERSONAS: PersonKey[] = ['tutor', 'parentTutor', 'parent', 'student', 'studentTutor'];

/** Keys naming who did something, rather than whom a record is about. */
const ACTOR_KEYS = new Set([
  'actor_user_id',
  'author_user_id',
  'assessor_user_id',
  'recorded_by_user_id',
  'created_by_user_id',
  'cancelled_by_user_id',
  'entered_by_user_id',
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

    // R34: which price is missing, never an amount.
    if ('price_missing' in row) {
      const flags = row.price_missing;
      if (!Array.isArray(flags) || flags.some((mode: unknown) => mode !== 'in_person' && mode !== 'virtual')) {
        fail(where, 'R34 price_missing carries something other than a mode');
      }
    }

    // R8: no money in the log.
    if (typeof row.action === 'string' && typeof row.description === 'string') {
      if (/\d+\.\d{2}\s*USD|\$\d/.test(row.description)) fail(where, 'R8 amount in an audit line');
    }
  }
}

type As = (who: PersonKey, options?: AsOptions) => Promise<Page>;

/**
 * The crawl itself, as the person with this address (a seeded persona, or someone a test made): every read
 * endpoint, every object in every answer, against the rules above.
 */
async function crawl(as: As, email: string): Promise<void> {
  // Several hundred requests in a row -- every lesson and payment fetched by
  // id -- and each now also re-checks the organization: against a remote
  // database that outlasts the default timeout without anything being wrong.
  test.slow();
  const admin = await as('admin');
  // The key only names a default address; `email` is who acts.
  const page = await as('student', { email });

  const id = await idOf(admin, email);
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

  // R10: somebody else's draft about a lesson this reader can see. The
  // office drafting Alex's lesson with Sofia names Alex, Sofia and (as
  // her mother) Maria's family -- and none of them may read it.
  const alexId = await idOf(admin, PEOPLE.tutor.email);
  const sofiaId = await idOf(admin, PEOPLE.student.email);
  const othersDraft = await unwrap<any>(
    await admin.request.post('/api/sessions/drafts', {
      data: {
        tutor_user_id: alexId,
        student_user_id: sofiaId,
        occurred_on: '2026-09-22',
        started_at: '16:00',
        ended_at: '17:00',
        mode: 'in_person',
        notes: 'Not ready to be read.',
        write_up: { planned: 'Not ready either.' },
        assessment: { rating: 1, body: 'Private until posted.' },
      },
    }),
    'the office saving a draft',
  );

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
  // Phase 35: the organization's curricula, which every member reads.
  await read('/api/curricula');
  await read('/api/sessions/active');

  // R33 (Phase 73): Continue and the lead grade. Where Quest is off here, both answer 403 like every /quest route.
  const openRead = await page.request.get('/api/quest/games/open');
  const tilesRead = await page.request.get('/api/quest/tiles');
  for (const [path, response] of [['/api/quest/games/open', openRead], ['/api/quest/tiles', tilesRead]] as const) {
    if (response.status() === 403) {
      if ((await response.json()).error?.code !== 'feature_unavailable') problems.push(`R33: ${path} refused without feature_unavailable`);
    } else if (response.status() !== 200) {
      problems.push(`R33: ${path} answered ${response.status()}`);
    }
  }
  if (openRead.status() === 200) {
    const continued = (await openRead.json()).data;
    check(reader, '/api/quest/games/open', continued, problems);
    if (continued.open) {
      const game = await page.request.get(`/api/quest/games/${continued.open.game_id}`);
      const view = game.status() === 200 ? (await game.json()).data : null;
      if (!view || view.me.team_id === null) {
        problems.push('R33: Continue named a game the reader does not play in');
      }
      // R35 (Phase 77): a seated game's hands and a roster's invited list are the host's (and the office's) alone.
      if (view && !view.is_host && view.seats !== undefined) problems.push('R35: the seats of a game the reader does not host');
      if (view && !view.is_host && view.invited !== undefined) problems.push('R35: the invited list of a game the reader does not host');
    }
  }
  if (tilesRead.status() === 200) {
    const tiles = (await tilesRead.json()).data;
    for (const key of ['lead', 'ask_grade', 'picked_grade']) if (!(key in tiles)) problems.push(`R33: /api/quest/tiles without ${key}`);
  }

  // R29 (Phase 66): the member home takes no person -- `?user_id` changes nothing -- and carries no money.
  await read('/api/home');
  const home = await get(page, '/api/home');
  if (JSON.stringify(home).match(/cents|amount|balance/i)) problems.push('R29: money on the member home');
  const asked = await get(page, `/api/home?user_id=${alexId}`);
  if (JSON.stringify(asked) !== JSON.stringify(home)) problems.push('R29: ?user_id changed the member home');
  // R35 (Phase 77): a child's card says whether they sign in and at which grade they play, and "Continue with <child>"
  // is a game the READER hosts and seated that child in -- never another guardian's.
  for (const child of ((home as any).parent?.children ?? []) as any[]) {
    if (!reader.family.has(child.student_user_id)) problems.push(`R35: a child card for ${child.student_user_id}`);
    if ('signs_in' in child && typeof child.signs_in !== 'boolean') problems.push('R35: signs_in is not a yes or no');
    if (child.grade != null && !(Number.isInteger(child.grade) && child.grade >= 0 && child.grade <= 8)) {
      problems.push(`R35: a grade of ${child.grade}`);
    }
    if (child.open_game_id) {
      const seated = await page.request.get(`/api/quest/games/${child.open_game_id}`);
      const game = seated.status() === 200 ? (await seated.json()).data : null;
      if (!game?.is_host || !(game.seats ?? []).some((s: any) => s.user_id === child.student_user_id)) {
        problems.push('R35: Continue with a child names a game the reader did not seat them in');
      }
    }
  }

  // R17 (Phase 38): a submitted Assessment reaches the student's audience as a row, but its
  // PDF -- which carries the answers -- only the student's current tutors and the admins.
  const started = await unwrap<any>(
    await admin.request.post('/api/canvas-assessments', { data: { student_user_id: sofiaId, level_id: 'NC26.4' } }),
    'the office starting an assessment',
  );
  await unwrap<any>(
    await admin.request.post(`/api/canvas-assessments/${started.id}/submit`, { data: { pages: [] } }),
    'the office submitting it',
  );
  const assessments = (await get(page, '/api/canvas-assessments')) as any[];
  check(reader, '/api/canvas-assessments', assessments, problems);
  const tutorsSofia = (await get(page, `/api/assignments?student_user_id=${sofiaId}`) as any[]).some(
    (pairing) => pairing.tutor_user_id === id && pairing.is_active,
  );
  const pdf = await page.request.get(`/api/canvas-assessments/${started.id}/pdf`);
  if (pdf.status() !== (tutorsSofia ? 200 : 404)) problems.push(`R17: the PDF answered ${pdf.status()}`);
  const theirs = assessments.find((row) => row.id === started.id);
  if (theirs && theirs.can_review !== tutorsSofia) problems.push(`R17: can_review ${theirs.can_review}`);
  if (theirs && theirs.started_by_name && !tutorsSofia) problems.push('R17: named who started it');
  // Phase 40: writing a review is the tutors' and the office's; a reviewed PDF does not exist until saved.
  const review = await page.request.get(`/api/canvas-assessments/${started.id}/review`);
  if (review.status() !== (tutorsSofia ? 200 : 404)) problems.push(`R17: the review answered ${review.status()}`);
  const notYet = await page.request.get(`/api/canvas-assessments/${started.id}/pdf?kind=reviewed`);
  if (notYet.status() !== 404) problems.push(`R17: an unreviewed assessment's review answered ${notYet.status()}`);
  // R35 (Phase 77, JF20): one in progress is continued by its starter or a guardian of the student -- who is served
  // its questions, never their keys -- and discarded only by its starter or an admin.
  const inProgress = await unwrap<any>(
    await admin.request.post('/api/canvas-assessments', { data: { student_user_id: sofiaId, level_id: 'NC26.4' } }),
    'the office starting another',
  );
  const guardsSofia = reader.family.has(sofiaId) && id !== sofiaId;
  const open = ((await get(page, '/api/canvas-assessments')) as any[]).find((row) => row.id === inProgress.id);
  if (open && open.can_continue !== guardsSofia) problems.push(`R35: can_continue ${open.can_continue} on the office's assessment`);
  if (open && open.can_discard !== false) problems.push("R35: may discard somebody else's assessment");
  const opened = await page.request.get(`/api/canvas-assessments/${inProgress.id}`);
  if (opened.status() === 200) {
    const detail = (await opened.json()).data;
    if ((detail.questions !== null) !== guardsSofia) problems.push(`R35: questions served to ${email}: ${detail.questions !== null}`);
    if (/"(answer|solution)"/.test(JSON.stringify(detail.questions ?? []))) problems.push('R35: a question with its key');
  } else if (open) {
    problems.push(`R35: a listed assessment answered ${opened.status()}`);
  }
  const discard = await page.request.post(`/api/canvas-assessments/${inProgress.id}/discard`, { data: {} });
  if (discard.status() !== 404) problems.push(`R35: somebody else's discard answered ${discard.status()}`);
  await admin.request.post(`/api/canvas-assessments/${inProgress.id}/discard`, { data: {} });

  // R16 (Phase 33): a person's own list of locations is read only by them and their parents
  // (and the office). Anybody else's reads as empty.
  for (const person of people) {
    const own = (await get(page, `/api/locations?user_id=${person.id}`)) as any[];
    if (own.length > 0 && !reader.family.has(person.id)) {
      problems.push(`R16: read the locations of ${person.id}`);
    }
  }
  // The whole organization's list is the admins' page alone.
  if (((await get(page, '/api/locations')) as any[]).length > 0) problems.push('R16: read every location');

  const drafts = (await get(page, '/api/sessions/drafts')) as any[];
  check(reader, '/api/sessions/drafts', drafts, problems);

  // R34 (Phase 75): the lessons owed are the reader's own teaching (a non-admin's), with the place by name and
  // kind only, no money, and only the reader's own draft -- the office drafting the first of them changes nothing.
  const owedRead = async () => (await get(page, '/api/sessions/to-record')) as any[];
  const owed = await owedRead();
  check(reader, '/api/sessions/to-record', owed, problems);
  const myDraftIds = new Set(drafts.map((draft) => draft.id));
  for (const row of owed) {
    if (row.tutor_user_id !== id) problems.push(`R34 a lesson owed by another tutor ${row.schedule_id}`);
    if (row.place && Object.keys(row.place).sort().join() !== 'kind,name') problems.push('R34 a place with more than its name');
    if (Object.keys(row).some((key) => key.endsWith('_cents'))) problems.push('R34 a lesson owed carries money');
    if (row.draft && !myDraftIds.has(row.draft.id)) problems.push(`R34 somebody else's draft on ${row.schedule_id}`);
  }
  if (owed[0]) {
    const first = owed[0];
    const officeDraft = await unwrap<any>(
      await admin.request.post('/api/sessions/drafts?autosave=true', {
        data: {
          tutor_user_id: first.tutor_user_id,
          student_user_id: first.student_user_id,
          occurred_on: first.occurs_on,
          started_at: first.start_time,
          ended_at: first.end_time,
          mode: first.mode,
        },
      }),
      'the office drafting a lesson owed',
    );
    const again = (await owedRead()).find((row) => row.schedule_id === first.schedule_id && row.occurs_on === first.occurs_on);
    if (again?.draft?.id === officeDraft.id) problems.push('R34 the office’s draft on the reader’s lesson owed');
    await admin.request.delete(`/api/sessions/drafts/${officeDraft.id}`);
  }
  for (const draft of drafts) {
    if (draft.author_user_id !== id) problems.push(`R10 somebody else's draft ${draft.id}`);
  }
  if (drafts.some((draft) => draft.id === othersDraft.id)) problems.push('R10 the office’s draft');

  for (const role of me.roles) await read(`/api/dashboard?role=${role}`);
  for (const person of people) await read(`/api/users/${person.id}`);

  const followed = (await get(page, '/api/progress')) as { student_user_id: string }[];
  for (const row of followed) await read(`/api/progress/${row.student_user_id}`);

  // Phase 58: the progress report is a PDF, not JSON, so it is not walked
  // by `check`. It reaches exactly the students this reader follows, and
  // carries no money; which lessons it lists is progress-report.spec.ts.
  const followedIds = new Set(followed.map((row) => row.student_user_id));
  for (const row of followed) {
    const report = await page.request.get(`/api/progress/${row.student_user_id}/report.pdf`);
    if (report.status() !== 200) problems.push(`report on ${row.student_user_id} answered ${report.status()}`);
    else if (/\$|cents/i.test(pdfPageText(await report.body()))) problems.push(`report on ${row.student_user_id} carries money`);
  }
  for (const row of (await get(admin, '/api/progress')) as { student_user_id: string }[]) {
    if (followedIds.has(row.student_user_id)) continue;
    const report = await page.request.get(`/api/progress/${row.student_user_id}/report.pdf`);
    if (report.status() !== 404) problems.push(`report on unfollowed ${row.student_user_id} answered ${report.status()}`);
  }

  // R9: every lesson and payment the admin can see, fetched by id, is
  // either one this reader lists or "not found".
  const mine = new Set(((await get(page, '/api/sessions?limit=200')) as any[]).map((s) => s.id));

  // R12: reflections, on every dashboard this reader has, are about their
  // own lessons, and a prompt for one names a lesson and nothing else.
  for (const role of me.roles) {
    const dashboard = ((await get(page, `/api/dashboard?role=${role}`)) as any).data;
    for (const digest of dashboard.recent_reflections ?? []) {
      if (!mine.has(digest.session_id)) problems.push(`R12 reflection on hidden lesson ${digest.session_id}`);
    }
    for (const prompt of dashboard.awaiting_reflection ?? []) {
      if (!mine.has(prompt.session_id)) problems.push(`R12 prompt for hidden lesson ${prompt.session_id}`);
      if (Object.keys(prompt).some((key) => key.endsWith('_cents'))) problems.push('R12 prompt carries money');
    }
  }
  const all = (await get(admin, '/api/sessions?limit=200')) as any[];
  for (const session of all) {
    const response = await page.request.get(`/api/sessions/${session.id}`);
    if (mine.has(session.id)) {
      expect(response.status()).toBe(200);
      check(reader, `/api/sessions/${session.id}`, (await response.json()).data, problems);
    } else {
      expect(response.status(), `R9 lesson ${session.id} should be hidden from ${email}`).toBe(404);
    }
  }

  // Phase 21: every upcoming lesson comes from a schedule this reader can
  // list, and carries no money -- it is shown on the Tutoring tab.
  const mySchedules = new Set(((await get(page, '/api/schedules')) as any[]).map((s) => s.id));

  // R11: every cancellation listed comes from a schedule this reader can
  // list, and carries no money. Each schedule's own dates are crawled too.
  const cancellations = (await get(page, '/api/schedules/cancellations')) as any[];
  check(reader, '/api/schedules/cancellations', cancellations, problems);
  for (const row of cancellations) {
    if (!mySchedules.has(row.schedule_id)) problems.push(`R11 cancellation from hidden schedule ${row.schedule_id}`);
    if (Object.keys(row).some((key) => key.endsWith('_cents'))) problems.push('R11 cancellation carries money');
  }
  for (const scheduleId of mySchedules) {
    await read(`/api/schedules/upcoming?schedule_id=${scheduleId}&limit=10`);
  }

  // R11 through progress: the details of a cancellation only for a
  // schedule the reader can list (Sanjay reading Ben's is the seeded case).
  for (const row of followed) {
    const progress = (await get(page, `/api/progress/${row.student_user_id}`)) as any;
    for (const cancelled of progress.cancellations) {
      const detailed = cancelled.note !== null || cancelled.cancelled_by_name !== null;
      if (detailed && !mySchedules.has(cancelled.schedule_id)) {
        problems.push(`R11 cancellation note from hidden schedule ${cancelled.schedule_id}`);
      }
    }
  }
  for (const next of (await get(page, '/api/schedules/upcoming?limit=10')) as any[]) {
    if (!mySchedules.has(next.schedule_id)) problems.push(`upcoming lesson from hidden schedule ${next.schedule_id}`);
    if (Object.keys(next).some((key) => key.endsWith('_cents'))) problems.push('upcoming lesson carries money');
  }

  const myPayments = new Set(((await get(page, '/api/payments?limit=200')) as any[]).map((p) => p.id));
  const allPayments = (await get(admin, '/api/payments?limit=200')) as any[];
  for (const payment of allPayments) {
    const status = (await page.request.get(`/api/payments/${payment.id}`)).status();
    expect(status, `R9 payment ${payment.id} for ${email}`).toBe(myPayments.has(payment.id) ? 200 : 404);
  }

  await admin.request.delete(`/api/sessions/drafts/${othersDraft.id}`);

  expect(problems, problems.slice(0, 20).join('\n')).toEqual([]);
}

test.describe('what each non-admin can see', () => {
  for (const who of PERSONAS) {
    test(`${who}: every read endpoint obeys the visibility rules`, { tag: '@smoke' }, async ({ as }) => {
      await crawl(as, PEOPLE[who].email);
    });
  }

  // Phase 79 (M9, R36): a member -- in the space with no role -- made here through the API, so the crawl needs no
  // seeded row (test:compat runs @smoke on the last release's seed). Removed afterwards, so no later spec meets them.
  test('member: every read endpoint obeys the visibility rules', { tag: '@smoke' }, async ({ as }) => {
    const admin = await as('admin');
    const email = `exposure.member.${Date.now().toString(36)}@example.com`;
    const member = await unwrap<any>(
      await admin.request.post('/api/users', { data: { full_name: 'Mel Member', email, roles: [], status: 'active' } }),
      'the office adding a member',
    );
    expect(member.roles).toEqual([]);
    try {
      await crawl(as, email);
    } finally {
      await admin.request.delete(`/api/users/${member.id}?hard=true`);
    }
  });

  test('R33: Continue and the grade picked are the reader’s own', async ({ as }) => {
    const admin = await as('admin');
    const sofia = await as('student');
    const sanjay = await as('studentTutor');
    const setQuest = (on: boolean) => admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: on } });
    expect((await setQuest(true)).status()).toBe(200);
    let gameId = '';
    try {
      // Sofia's game is hers: Continue names it for her, with her progress, and never for Sanjay.
      const game = await unwrap<any>(
        await sofia.request.post('/api/quest/games', {
          data: { level_id: 'NC26.6', mode: 'count', question_count: 4, players: 'single', max_team_size: 1 },
        }),
        'Sofia starts a game',
      );
      gameId = game.id;
      const hers = await unwrap<any>(await sofia.request.get('/api/quest/games/open'), 'her Continue');
      expect(hers.open).toMatchObject({ game_id: gameId, status: 'running', of: 4 });
      expect(hers.open.label).toMatch(/^Grade 6 Quick 4/);
      const his = await unwrap<any>(await sanjay.request.get('/api/quest/games/open'), 'his Continue');
      expect(his.open?.game_id ?? null).not.toBe(gameId);
      // A person parameter changes nothing.
      const sofiaId = (await unwrap<any>(await sofia.request.get('/api/auth/session'), 'session')).user.id;
      expect(await unwrap<any>(await sanjay.request.get(`/api/quest/games/open?user_id=${sofiaId}`), 'asked')).toEqual(his);

      // Each one's pick is their own: Sanjay's does not move Sofia's.
      await unwrap(await sofia.request.put('/api/quest/grade', { data: { grade: 6 } }), 'Sofia picks 6');
      await unwrap(await sanjay.request.put('/api/quest/grade', { data: { grade: 3 } }), 'Sanjay picks 3');
      const sofiaTiles = await unwrap<any>(await sofia.request.get('/api/quest/tiles'), 'her tiles');
      const sanjayTiles = await unwrap<any>(await sanjay.request.get(`/api/quest/tiles?user_id=${sofiaId}`), 'his tiles');
      expect(sofiaTiles).toMatchObject({ picked_grade: 6, lead: { grade: 6, from: 'picked' }, ask_grade: false });
      expect(sanjayTiles).toMatchObject({ picked_grade: 3, lead: { grade: 3, from: 'picked' }, ask_grade: false });
      // Out of range is refused.
      expect((await sofia.request.put('/api/quest/grade', { data: { grade: 9 } })).status()).toBe(422);
    } finally {
      if (gameId) await sofia.request.post(`/api/quest/games/${gameId}/end`);
      await sofia.request.put('/api/quest/grade', { data: { grade: null } });
      await sanjay.request.put('/api/quest/grade', { data: { grade: null } });
      await setQuest(false);
    }
  });

  test('a non-admin cannot widen their view through the query string', async ({ as }) => {
    const parent = await as('parent');
    const admin = await as('admin');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);

    // Deleted people, another person's dashboard, another person's rundown.
    const deleted = (await get(parent, '/api/users?include_deleted=true&limit=100')) as any[];
    expect(deleted.every((person) => person.deleted_at === null)).toBe(true);
    expect((await parent.request.get(`/api/dashboard?user_id=${tutorId}`)).status()).toBe(403);
    expect((await parent.request.get(`/api/payments/monthly?year=2026&user_id=${tutorId}`)).status()).toBe(403);
    // Phase 32: who was emailed about what is the office's to read.
    expect((await parent.request.get('/api/organization/notifications')).status()).toBe(403);
    // Phase 35: the choice of curricula is the admins'.
    expect((await parent.request.get('/api/organization/curricula')).status()).toBe(403);
    expect(
      (await parent.request.put('/api/organization/curricula', { data: { offered: ['ba'], default_curriculum_id: 'ba' } }))
        .status(),
    ).toBe(403);

    // A comment the reader cannot read is missing, not forbidden. Seeded:
    // Anita's note about her son Sanjay, whom Alex does not teach.
    const alex = await as('tutor');
    expect((await alex.request.delete('/api/comments/c0000000-0000-4000-8000-000000000003')).status()).toBe(404);

    // Somebody else's schedule, and a lesson cancelled on it: missing, whether
    // cancelling or restoring. Seeded: Anita cancelled Sanjay's lesson on
    // 2026-10-29, on Priya's schedule, which Alex has nothing to do with.
    const theirs = '70000000-0000-4000-8000-000000000003';
    expect((await alex.request.delete(`/api/schedules/${theirs}/cancellations/2026-10-29`)).status()).toBe(404);
    expect(
      (await alex.request.post(`/api/schedules/${theirs}/cancellations`, { data: { occurs_on: '2026-11-05' } }))
        .status(),
    ).toBe(404);

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

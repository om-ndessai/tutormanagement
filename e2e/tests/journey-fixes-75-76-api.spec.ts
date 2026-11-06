import type { APIResponse, Page } from '@playwright/test';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  USER_STATUS_DESCRIPTIONS,
  addChoices,
  invitationText,
  nextStepsAfterAdd,
  nextUpCandidates,
  nextUpKey,
  quickActionsFor,
  spaceWhat,
} from '@tmi/shared';
import { expect, test } from '../support/fixtures.js';
import { scheduleLocationIds, unwrap } from '../support/api.js';

/**
 * Phases 75 and 76 (docs/journey-fixes-plan.md), the contract both clients build on, through the API.
 * - JF18: Start checks the price by the rule the stop uses, and every pricing refusal is in its reader's words
 *   (the MESSAGE, which an older app shows alone); a refused stop keeps its note; a pairing, a schedule and the
 *   student's record say WHICH price is missing (`price_missing`), never an amount (R34).
 * - JF30: `GET /api/sessions/to-record` -- the lessons still owed, a tutor's own or every tutor's for an admin, each
 *   with the reader's own draft (R10); the home's "to record" carries the same draft (JF19); a running lesson leads
 *   Next up (`lesson_running`).
 * - JF21, JF37 (Phase 76): an adult's own address is "That's you"; naming oneself as the guardian makes one the
 *   parent in the same request; the chooser, the next steps, the status words and the invitation's wording.
 *
 * Everyone here is made fresh, so no seeded pairing, lesson or role changes.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const days = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

interface Family {
  studentId: string;
  parentId: string;
}

/** A parent and their child, priced as given (nothing given: no price at all). */
async function family(admin: Page, tag: string, prices: { in_person?: number | null; virtual?: number | null } = {}): Promise<Family> {
  const parent = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: { full_name: 'Hana Haddad', email: `p75.parent.${tag}.${run}@example.com`, roles: ['parent'] },
    }),
    'a parent',
  );
  const student = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: 'Yusuf Haddad',
        roles: ['student'],
        student_profile: {
          virtual_available: true,
          charge_rate_in_person_cents: prices.in_person ?? null,
          charge_rate_virtual_cents: prices.virtual ?? null,
        },
        guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
      },
    }),
    'a student',
  );
  return { studentId: student.id, parentId: parent.id };
}

/** A tutor of the office's, paid in person only unless told otherwise, paired with the student. */
async function tutorFor(admin: Page, tag: string, studentId: string, rates: { in_person?: number | null; virtual?: number | null } = {}) {
  const email = `p75.tutor.${tag}.${run}@example.com`;
  const tutor = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: 'Tara Fresh',
        email,
        roles: ['tutor'],
        status: 'active',
        tutor_profile: {
          virtual_available: true,
          default_rate_in_person_cents: rates.in_person === undefined ? 6000 : rates.in_person,
          default_rate_virtual_cents: rates.virtual === undefined ? 5000 : rates.virtual,
        },
      },
    }),
    'a tutor',
  );
  await unwrap(await admin.request.post('/api/assignments', { data: { tutor_user_id: tutor.id, student_user_id: studentId } }), 'pairing them');
  return { id: tutor.id as string, email };
}

const setPrices = (admin: Page, studentId: string, prices: { in_person?: number | null; virtual?: number | null }) =>
  admin.request.patch(`/api/users/${studentId}`, {
    data: {
      student_profile: {
        virtual_available: true,
        charge_rate_in_person_cents: prices.in_person ?? null,
        charge_rate_virtual_cents: prices.virtual ?? null,
      },
    },
  });

async function refusal(response: APIResponse) {
  expect(response.status()).toBe(422);
  const { error } = (await response.json()) as { error: { code: string; message: string; details: Record<string, string[]> } };
  expect(error.code).toBe('validation_failed');
  // The reader's words are the message itself, and the field detail says the same (older apps show the message).
  expect(error.details.mode).toEqual([error.message]);
  return error.message as string;
}

test.describe('Phase 75: the tutor’s record (API)', () => {
  test('JF18: Start refuses a lesson that could not be priced, in the reader’s words', async ({ as }) => {
    const admin = await as('admin');
    const { studentId } = await family(admin, 'start');
    const tutor = await tutorFor(admin, 'start', studentId, { virtual: null });
    const tara = await as('tutor', { email: tutor.email });

    // "No price set" can be told from "not yours to see": the tutor's view blanks the prices, not the flag.
    const pairing = (await unwrap<any[]>(await tara.request.get(`/api/assignments?student_user_id=${studentId}`), 'her pairing'))[0];
    expect(pairing.price_missing).toEqual(['in_person', 'virtual']);
    const record = await unwrap<any>(await tara.request.get(`/api/users/${studentId}`), 'his record');
    expect(record.student_profile).toMatchObject({
      charge_rate_in_person_cents: null,
      charge_rate_virtual_cents: null,
      price_missing: ['in_person', 'virtual'],
    });

    // Start, in person and virtual: refused before anything runs, naming whom to ask.
    expect(await refusal(await tara.request.post('/api/sessions/active', { data: { student_user_id: studentId, mode: 'in_person' } }))).toBe(
      "Ask the office to set Yusuf's price.",
    );
    // A virtual lesson is refused for her missing virtual rate first: the rule the stop uses, in its order.
    expect(await refusal(await tara.request.post('/api/sessions/active', { data: { student_user_id: studentId, mode: 'virtual' } }))).toBe(
      'Ask the office to set your virtual pay rate.',
    );
    expect((await unwrap<any>(await tara.request.get('/api/sessions/active'), 'nothing running')).mine).toBeNull();

    // Typed in afterwards, the same words; the office is told what is missing.
    const lesson = { tutor_user_id: tutor.id, student_user_id: studentId, occurred_on: '2026-11-02', started_at: '16:00', ended_at: '17:00' };
    expect(await refusal(await tara.request.post('/api/sessions', { data: { ...lesson, mode: 'in_person' } }))).toBe(
      "Ask the office to set Yusuf's price.",
    );
    expect(await refusal(await admin.request.post('/api/sessions', { data: { ...lesson, mode: 'in_person' } }))).toBe(
      "Yusuf Haddad's in-person price is not set.",
    );
    expect(await refusal(await admin.request.post('/api/sessions', { data: { ...lesson, mode: 'virtual' } }))).toBe(
      "Tara Fresh's virtual pay rate is not set.",
    );

    // An in-person price only: the flag names the virtual one, on the pairing, the schedule and the record.
    expect((await setPrices(admin, studentId, { in_person: 9500 })).status()).toBe(200);
    await unwrap(
      await admin.request.post('/api/schedules', {
        data: {
          tutor_user_id: tutor.id,
          student_user_id: studentId,
          day_of_week: 2,
          start_time: '16:00',
          duration_minutes: 60,
          mode: 'in_person',
          starts_on: '2026-11-03',
          location_ids: await scheduleLocationIds(admin, tutor.id, studentId),
        },
      }),
      'a weekly lesson',
    );
    const schedule = (await unwrap<any[]>(await tara.request.get(`/api/schedules?student_user_id=${studentId}`), 'her schedule'))[0];
    expect(schedule.price_missing).toEqual(['virtual']);
    expect((await unwrap<any[]>(await tara.request.get(`/api/assignments?student_user_id=${studentId}`), 'again'))[0].price_missing).toEqual([
      'virtual',
    ]);
    expect((await unwrap<any>(await tara.request.get(`/api/users/${studentId}`), 'again')).student_profile.price_missing).toEqual(['virtual']);

    // Priced in person, it starts; switching the running lesson to virtual is refused in the same words as Start.
    await unwrap(await tara.request.post('/api/sessions/active', { data: { student_user_id: studentId, mode: 'in_person' } }), 'starts');
    expect(await refusal(await tara.request.patch('/api/sessions/active', { data: { mode: 'virtual' } }))).toBe(
      'Ask the office to set your virtual pay rate.',
    );
    expect((await unwrap<any>(await tara.request.get('/api/sessions/active'), 'still in person')).mine.mode).toBe('in_person');
    expect((await tara.request.delete('/api/sessions/active')).status()).toBe(204);
  });

  test('JF18: a refused stop keeps the typed note; once priced, the stop records it', async ({ as }) => {
    const admin = await as('admin');
    const { studentId } = await family(admin, 'stop', { in_person: 9000 });
    const tutor = await tutorFor(admin, 'stop', studentId);
    const tara = await as('tutor', { email: tutor.email });
    try {
      await unwrap(await tara.request.post('/api/sessions/active', { data: { student_user_id: studentId, mode: 'in_person' } }), 'starts');
      // The office clears the price mid-lesson: the stop cannot be priced...
      expect((await setPrices(admin, studentId, {})).status()).toBe(200);
      expect(await refusal(await tara.request.post('/api/sessions/active/stop', { data: { notes: 'Fractions on a number line.' } }))).toBe(
        "Ask the office to set Yusuf's price.",
      );
      // ...and the lesson keeps running with the note on it.
      const running = (await unwrap<any>(await tara.request.get('/api/sessions/active'), 'still running')).mine;
      expect(running).toMatchObject({ student_user_id: studentId, notes: 'Fractions on a number line.' });

      expect((await setPrices(admin, studentId, { in_person: 9000 })).status()).toBe(200);
      const session = await unwrap<any>(await tara.request.post('/api/sessions/active/stop', { data: {} }), 'stops');
      expect(session.notes).toBe('Fractions on a number line.');
      expect(session.charge_amount_cents).toBeNull();
      expect(session.tutor_amount_cents).toBeGreaterThan(0);
    } finally {
      await tara.request.delete('/api/sessions/active');
    }
  });

  test('a space paid directly asks no student price, and flags none', async ({ as }) => {
    // Space D (Phase 54): the pairing's rate is the price, so nothing is "missing" on the student.
    const hannah = await as('soloAdmin', { org: 'solo' });
    const pairings = await unwrap<any[]>(await hannah.request.get('/api/assignments'), 'D’s pairings');
    expect(pairings.length).toBeGreaterThan(0);
    for (const pairing of pairings) expect(pairing.price_missing).toEqual([]);
    for (const schedule of await unwrap<any[]>(await hannah.request.get('/api/schedules'), 'D’s schedules')) {
      expect(schedule.price_missing).toEqual([]);
    }
  });

  test('JF30, JF19: the lessons owed -- a tutor’s own, every tutor’s for the office -- each with the reader’s own draft', async ({
    as,
  }) => {
    const admin = await as('admin');
    const { studentId } = await family(admin, 'owed', { in_person: 9000 });
    const tutor = await tutorFor(admin, 'owed', studentId);
    const tara = await as('tutor', { email: tutor.email });
    const alex = await as('tutor');

    // Two weekly lessons that ended this week and were never recorded: two and four days ago, at 10:00.
    const today = (await unwrap<any>(await tara.request.get('/api/home'), 'her home')).day as string;
    const locations = await scheduleLocationIds(admin, tutor.id, studentId);
    const scheduleOn = async (day: string) =>
      unwrap<any>(
        await admin.request.post('/api/schedules', {
          data: {
            tutor_user_id: tutor.id,
            student_user_id: studentId,
            day_of_week: weekday(day),
            start_time: '10:00',
            duration_minutes: 60,
            mode: 'in_person',
            starts_on: days(today, -13),
            location_ids: locations,
          },
        }),
        `a lesson on ${day}`,
      );
    const recent = await scheduleOn(days(today, -2));
    const older = await scheduleOn(days(today, -4));

    const owedTo = async (page: Page) =>
      (await unwrap<any[]>(await page.request.get('/api/sessions/to-record'), 'lessons owed')).filter((row) => row.student_user_id === studentId);

    // Hers: full rows, newest first, the place by name and kind only, no money, no draft yet.
    const mine = await owedTo(tara);
    expect(mine.map((row) => [row.schedule_id, row.occurs_on])).toEqual([
      [recent.id, days(today, -2)],
      [older.id, days(today, -4)],
    ]);
    expect(mine[0]).toMatchObject({
      start_time: '10:00',
      end_time: '11:00',
      mode: 'in_person',
      tutor_user_id: tutor.id,
      tutor_name: 'Tara Fresh',
      student_user_id: studentId,
      student_name: 'Yusuf Haddad',
      draft: null,
    });
    expect(Object.keys(mine[0].place).sort()).toEqual(['kind', 'name']);
    expect(JSON.stringify(mine)).not.toMatch(/cents|amount|address|url/i);
    // The office sees every tutor's; another tutor sees none of hers.
    expect((await owedTo(admin)).map((row) => row.schedule_id)).toEqual([recent.id, older.id]);
    expect(await owedTo(alex)).toEqual([]);
    for (const row of await unwrap<any[]>(await alex.request.get('/api/sessions/to-record'), 'Alex’s')) {
      expect(row.tutor_name).toBe('Alex Chen');
    }

    // Her draft of the recent one is hers alone: on her row and her home, never on the office's row.
    const lesson = {
      tutor_user_id: tutor.id,
      student_user_id: studentId,
      occurred_on: days(today, -2),
      started_at: '10:00',
      ended_at: '11:00',
      mode: 'in_person',
    };
    const hers = await unwrap<any>(await tara.request.post('/api/sessions/drafts?autosave=true', { data: { ...lesson, notes: 'Half written.' } }), 'her draft');
    expect((await owedTo(tara))[0].draft).toEqual({ id: hers.id, updated_at: hers.updated_at });
    expect((await owedTo(tara))[1].draft).toBeNull();
    expect((await owedTo(admin))[0].draft).toBeNull();
    const theirs = await unwrap<any>(await admin.request.post('/api/sessions/drafts?autosave=true', { data: lesson }), 'the office’s draft');
    expect((await owedTo(admin))[0].draft?.id).toBe(theirs.id);
    expect((await owedTo(tara))[0].draft?.id).toBe(hers.id);
    await admin.request.delete(`/api/sessions/drafts/${theirs.id}`);

    const home = await unwrap<any>(await tara.request.get('/api/home'), 'her home');
    const homeRow = home.tutor.to_record.find((row: any) => row.schedule_id === recent.id);
    expect(homeRow.draft).toEqual({ id: hers.id, updated_at: hers.updated_at });
    expect(home.tutor.to_record.find((row: any) => row.schedule_id === older.id).draft).toBeNull();
    expect(home.tutor.to_record_count).toBe(2);
    for (const row of home.tutor.now.unrecorded) expect('draft' in row).toBe(true);

    // Cancelled, the older one is not owed; restored, it is again.
    await unwrap(await tara.request.post(`/api/schedules/${older.id}/cancellations`, { data: { occurs_on: days(today, -4) } }), 'cancelled');
    expect((await owedTo(tara)).map((row) => row.schedule_id)).toEqual([recent.id]);
    expect((await tara.request.delete(`/api/schedules/${older.id}/cancellations/${days(today, -4)}`)).status()).toBe(204);
    expect(await owedTo(tara)).toHaveLength(2);

    // Posting her draft records the lesson: it is owed no longer, here or on the home.
    await unwrap(await tara.request.post(`/api/sessions/drafts/${hers.id}/post`), 'posted');
    expect((await owedTo(tara)).map((row) => row.schedule_id)).toEqual([older.id]);
    expect((await unwrap<any>(await tara.request.get('/api/home'), 'home after')).tutor.to_record_count).toBe(1);

    // Nobody without lessons to give is owed any: a parent here gets an empty list; a space without Tutoring, 403.
    expect(await unwrap<any[]>(await (await as('parent')).request.get('/api/sessions/to-record'), 'a parent')).toEqual([]);
    const ines = await as('assessAdmin', { org: 'assess' });
    expect((await ines.request.get('/api/sessions/to-record')).status()).toBe(403);
  });

  test('JF30: a running lesson leads Next up', async ({ as }) => {
    const home = await unwrap<any>(await (await as('tutor')).request.get('/api/home'), 'Alex’s home');
    const running = { student_name: 'Sofia Okafor', started_at: '2026-11-05T21:02:00.000Z', mode: 'in_person' as const };
    const first = nextUpCandidates(home, { running })[0]!;
    expect(first).toEqual({ kind: 'lesson_running', hat: 'tutor', running });
    expect(nextUpKey(first)).toBe('lesson_running:2026-11-05T21:02:00.000Z');
    // Without one (an older client sends nothing), nothing changes.
    expect(nextUpCandidates(home).some((item) => item.kind === 'lesson_running')).toBe(false);
    expect(nextUpCandidates(home, { running: null }).some((item) => item.kind === 'lesson_running')).toBe(false);
  });
});

test.describe('Phase 76: adding people one way (API)', () => {
  test('JF21: in a personal space, "That’s you" for one’s own address, and naming oneself makes one the parent', async ({ page, as }) => {
    const email = `p76.adult.${run}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, birth_month: 3, birth_year: 1984, dev_email: email, dev_name: 'Dana Selfadd' },
      }),
      'signs up',
    );
    const outside = await as('admin', { email, org: null });
    const session = await unwrap<any>(await outside.request.get('/api/auth/session'), 'her session');
    const personal = session.memberships.find((m: any) => m.personal);
    expect(personal).toBeTruthy();
    const dana = await as('admin', { email, org: personal.slug });
    const me = await unwrap<any>(await dana.request.get('/api/auth/session'), 'in her space');
    expect(me.user.roles).not.toContain('parent');

    // Her own address, as the parent: not "someone in this space" -- her. Somebody else's stays the old words.
    const own = await dana.request.post('/api/users', { data: { full_name: 'Dana Selfadd', email, roles: ['parent'] } });
    expect(own.status()).toBe(409);
    expect((await own.json()).error).toMatchObject({ code: 'conflict', message: "That's you: add your child, and you'll be their parent." });
    const OWN_CASE = email.toUpperCase();
    expect((await (await dana.request.post('/api/users', { data: { full_name: 'Dana', email: OWN_CASE, roles: ['parent'] } })).json()).error.message).toMatch(
      /^That's you/,
    );

    // "My child": one request names her the guardian, and she is the parent from then on.
    const child = await unwrap<any>(
      await dana.request.post('/api/users', {
        data: {
          full_name: 'Rio Selfadd',
          roles: ['student'],
          parent_consent: true,
          student_profile: { virtual_available: false },
          guardians: [{ guardian_user_id: me.user.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'her child',
    );
    expect(child.guardians.map((g: any) => g.user_id)).toEqual([me.user.id]);
    const after = await unwrap<any>(await dana.request.get('/api/auth/session'), 'after');
    expect(after.user.roles).toEqual(expect.arrayContaining(['admin', 'parent']));
    const log = await unwrap<any[]>(await dana.request.get('/api/audit?limit=20'), 'her log');
    const roleLines = log.filter((e) => e.action === 'user.roles_changed');
    expect(roleLines).toHaveLength(1);
    expect(roleLines[0].description).toBe("Changed Dana Selfadd's roles to admin and parent");

    // A second child: she is already the parent, so no second role line.
    await unwrap(
      await dana.request.post('/api/users', {
        data: {
          full_name: 'Sol Selfadd',
          roles: ['student'],
          parent_consent: true,
          student_profile: { virtual_available: false },
          guardians: [{ guardian_user_id: me.user.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a second child',
    );
    expect((await unwrap<any[]>(await dana.request.get('/api/audit?limit=20'), 'log')).filter((e) => e.action === 'user.roles_changed')).toHaveLength(1);

    // Her home has a door to add a child (a personal space has no office hat).
    const home = await unwrap<any>(await dana.request.get('/api/home'), 'her home');
    expect(home.personal).toBe(true);
    expect(
      quickActionsFor(home.hats, {
        tutoring: false,
        quest: true,
        assessment: true,
        mayBringPeople: home.may_bring_people,
        personal: home.personal,
        board: true,
        doors: true,
      }),
    ).toContain('add_person');
  });

  test('JF21, JF37: the chooser, the next steps, the status words and the invitation are one set of words', () => {
    expect(addChoices({ tutoring: true, personal: false, mayAdd: true }).map((c) => c.label)).toEqual([
      'A family (parent and child)',
      'A tutor',
      'Someone else',
      'Invite by email',
    ]);
    expect(addChoices({ tutoring: false, personal: true, mayAdd: true }).map((c) => c.label)).toEqual(['My child', 'Someone else', 'Invite by email']);
    expect(addChoices({ tutoring: true, personal: false, mayAdd: false })).toEqual([]);

    const yusuf = { full_name: 'Yusuf Haddad', roles: ['student'] as const };
    expect(nextStepsAfterAdd(yusuf, { tutoring: true, assessment: true, paysTutors: true }).map((s) => s.label)).toEqual([
      'Pair Yusuf with a tutor',
      'Set a weekly lesson',
      'Record an assessment',
    ]);
    expect(nextStepsAfterAdd(yusuf, { tutoring: false, assessment: true, paysTutors: false }).map((s) => s.id)).toEqual(['assessment']);
    // A Tutoring space without Assessment still offers its progress assessment.
    expect(nextStepsAfterAdd(yusuf, { tutoring: true, assessment: false, paysTutors: true }).map((s) => s.id)).toEqual([
      'pair_tutor',
      'weekly_lesson',
      'assessment',
    ]);
    const tara = { full_name: 'Tara Fresh', roles: ['tutor'] as const };
    expect(nextStepsAfterAdd(tara, { tutoring: true, assessment: false, paysTutors: true }).map((s) => s.label)).toEqual([
      'Pair Tara with a student',
      'Finish tax setup',
    ]);
    expect(nextStepsAfterAdd(tara, { tutoring: true, assessment: false, paysTutors: false }).map((s) => s.id)).toEqual(['pair_student']);

    expect(USER_STATUS_DESCRIPTIONS).toEqual({
      active: 'In the space now.',
      invited: 'They join when they sign in -- someone who already has an account always accepts by hand.',
      suspended: 'Kept on the books, but cannot open the space.',
    });

    const sets = (on: { tutoring?: boolean; assessment?: boolean; quest?: boolean }) => ({
      feature_tutoring: Boolean(on.tutoring),
      feature_assessment: Boolean(on.assessment),
      feature_quest: Boolean(on.quest),
      canvas_assessments: Boolean(on.assessment),
      gamify_question_quest: Boolean(on.quest),
    });
    expect(spaceWhat(sets({ assessment: true, quest: true }))).toBe('practice and assessments');
    expect(spaceWhat(sets({ tutoring: true, assessment: true, quest: true }))).toBe('practice, assessments and lessons');
    expect(spaceWhat(sets({}))).toBeNull();
    const words = { inviter: 'Ines', space: 'Ferreira Family Practice', address: 'https://example.test/spaces', email: 'ana@example.com' };
    expect(invitationText({ ...words, org: sets({ assessment: true, quest: true }) })).toBe(
      'Ines invited you to Ferreira Family Practice on Aimtrue, a space for practice and assessments. ' +
        'Open https://example.test/spaces and sign in with Google using ana@example.com: your invitation is waiting there.',
    );
    // An older caller, with no sets: the same, without what the space is for.
    expect(invitationText(words)).toBe(
      'Ines invited you to Ferreira Family Practice on Aimtrue. ' +
        'Open https://example.test/spaces and sign in with Google using ana@example.com: your invitation is waiting there.',
    );
  });
});

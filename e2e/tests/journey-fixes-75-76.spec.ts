import type { Page } from '@playwright/test';
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  USER_STATUS_DESCRIPTIONS,
  addChoices,
  invitationText,
  zonedClockParts,
} from '@tmi/shared';
import { expect, test } from '../support/fixtures.js';
import { scheduleLocationIds, unwrap } from '../support/api.js';
import { PEOPLE } from '../support/people.js';
import { visible } from '../support/ui.js';

/**
 * Phases 75 and 76 (docs/journey-fixes-plan.md) on the web, through the UI.
 * - JF18: Start refuses an unpriced lesson in place, in the tutor's words; "No price set" on the student, the pairing
 *   and the schedule; a refused stop keeps its note.
 * - JF19: a saved draft is reached from every door -- Next up, the home's To record, the Sessions page's To record --
 *   and is continued, never doubled.
 * - JF27: the pairing form never copies the tutor's default; an override equal to the default reads as the default.
 * - JF30: one way to record and start: a known lesson opens "Record a lesson" ("It ran as planned"); the quick action
 *   opens the lessons owed with "Another lesson" (a blank form, no date); To record leads the Sessions page; every
 *   Start opens in place, prefilled; a running lesson leads Next up with Stop.
 * - JF21, JF37 (Phase 76): one Add chooser; the family flow and its next steps; "My child" in a personal space;
 *   invitations copied and shared; what each status means; the student's tutor and lessons on their record.
 *
 * Everyone here is made fresh, so no seeded pairing, lesson or role changes.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
let serial = 0;
const tag = () => `${run}${(serial++).toString(36)}`;
const days = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Each test's tutor is removed after it (as the API spec does), so no later spec meets a tutor with no SSN on file --
// tax.spec.ts asserts the office's chase panel is empty once its own tutor's is recorded.
const tutorsMade: string[] = [];
test.afterEach(async ({ as }) => {
  if (tutorsMade.length === 0) return;
  const admin = await as('admin');
  for (const id of tutorsMade.splice(0)) await admin.request.delete(`/api/users/${id}`);
});

/** The space's clock now: its day and minutes. */
async function orgNow(page: Page): Promise<{ day: string; minutes: number }> {
  const session = await unwrap<any>(await page.request.get('/api/auth/session'), 'the session');
  const parts = zonedClockParts(new Date().toISOString(), session.organization.time_zone);
  return { day: parts.day, minutes: parts.minutesOfDay };
}

interface Cast {
  studentId: string;
  studentName: string;
  parentId: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  pairingId: string;
  tara: Page;
}

/** A parent and their child (priced as given; nothing given, no price), a fresh tutor, and the pairing. */
async function cast(
  admin: Page,
  as: (who: any, options?: any) => Promise<Page>,
  prices: { in_person?: number | null; virtual?: number | null } = {},
): Promise<Cast> {
  const t = tag();
  const parent = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: { full_name: `Hana Q${t}`, email: `jf7576.parent.${t}@example.com`, roles: ['parent'] },
    }),
    'a parent',
  );
  const studentName = `Yusuf Q${t}`;
  const student = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: studentName,
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
  const tutorName = `Tara T${t}`;
  const tutorEmail = `jf7576.tutor.${t}@example.com`;
  const tutor = await unwrap<any>(
    await admin.request.post('/api/users', {
      data: {
        full_name: tutorName,
        email: tutorEmail,
        roles: ['tutor'],
        status: 'active',
        tutor_profile: { virtual_available: true, default_rate_in_person_cents: 6000, default_rate_virtual_cents: 5000 },
      },
    }),
    'a tutor',
  );
  tutorsMade.push(tutor.id);
  const pairing = await unwrap<any>(
    await admin.request.post('/api/assignments', { data: { tutor_user_id: tutor.id, student_user_id: student.id } }),
    'pairing them',
  );
  const tara = await as('tutor', { email: tutorEmail });
  // A new person meets the welcome wizard once (Phase 26): past it, as everyone seeded is.
  await unwrap(await tara.request.post('/api/onboarding/tour', { data: { outcome: 'skipped' } }), 'past the wizard');
  return {
    studentId: student.id,
    studentName,
    parentId: parent.id,
    tutorId: tutor.id,
    tutorName,
    tutorEmail,
    pairingId: pairing.id,
    tara,
  };
}

/** A weekly lesson of the pair on `day`'s weekday at `start`, from two weeks before. */
async function weekly(admin: Page, c: Cast, day: string, start: string, duration = 60) {
  return unwrap<any>(
    await admin.request.post('/api/schedules', {
      data: {
        tutor_user_id: c.tutorId,
        student_user_id: c.studentId,
        day_of_week: weekday(day),
        start_time: start,
        duration_minutes: duration,
        mode: 'in_person',
        starts_on: days(day, -14),
        location_ids: await scheduleLocationIds(admin, c.tutorId, c.studentId),
      },
    }),
    'a weekly lesson',
  );
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

const drafts = async (page: Page) => unwrap<any[]>(await page.request.get('/api/sessions/drafts'), 'drafts');

test.describe('Phase 75: the tutor’s record (web)', () => {
  test('JF18: an unpriced student’s Start is refused in place, in the tutor’s words; “No price set” everywhere', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as);
    const { day } = await orgNow(admin);
    const schedule = await weekly(admin, c, days(day, 3), '16:00');
    const tara = c.tara;

    // Start, from the Sessions page: refused in the dialog itself, said once, nothing running.
    await tara.goto('/sessions');
    await tara.getByTestId('start-lesson-button').click();
    const start = tara.getByTestId('start-lesson');
    await start.locator('#live-student').click();
    await tara.getByRole('option', { name: c.studentName }).click();
    await start.getByTestId('start-lesson-submit').click();
    await expect(start.getByTestId('start-lesson-problem')).toHaveText("Ask the office to set Yusuf's price.");
    await expect(start.getByText("Ask the office to set Yusuf's price.")).toHaveCount(1);
    await expect(start).toBeVisible();
    expect((await unwrap<any>(await tara.request.get('/api/sessions/active'), 'nothing running')).mine).toBeNull();
    await tara.keyboard.press('Escape');

    // "No price set" on the pairing, the schedule and the student -- to the tutor, who never reads a price.
    await tara.goto('/assignments');
    await expect(tara.getByTestId(`no-price-${c.pairingId}`).filter({ visible: true })).toHaveText('No price set');
    await tara.goto('/schedule');
    await expect(tara.getByTestId(`no-price-${schedule.id}`)).toHaveText('No price set');
    await tara.goto(`/users?view=${c.studentId}`);
    const record = tara.getByRole('dialog');
    await expect(record.getByTestId('user-no-price')).toHaveText('No price set');
    // Phase 76: their record says who teaches them and when.
    await expect(record.getByTestId('user-detail-tutors')).toHaveText(c.tutorName);
    await expect(record.getByTestId('user-detail-lessons')).toContainText(`with ${c.tutorName}`);
    expect(await record.innerText()).not.toMatch(/\$\s?\d/);

    // One price set: only the other is missing, said per mode.
    expect((await setPrices(admin, c.studentId, { in_person: 9500 })).status()).toBe(200);
    await tara.reload();
    await expect(tara.getByRole('dialog').getByTestId('user-no-price')).toHaveCount(1);
    await expect(tara.getByRole('dialog').getByText('Virtual price')).toBeVisible();
    await tara.goto('/schedule');
    await expect(tara.getByTestId(`no-price-${schedule.id}`)).toHaveCount(0);
  });

  test('JF18, JF30: a running lesson leads Next up with Stop; a refused stop keeps its note after Keep going', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as, { in_person: 9000 });
    const tara = c.tara;
    try {
      await unwrap(await tara.request.post('/api/sessions/active', { data: { student_user_id: c.studentId, mode: 'in_person' } }), 'starts');
      await tara.goto('/');
      const card = tara.getByTestId('next-up');
      await expect(card.getByTestId('next-up-lesson_running')).toContainText('Your lesson with Yusuf is running.');

      // The office clears the price mid-lesson: the stop is refused in the dialog, every line of it, once.
      expect((await setPrices(admin, c.studentId, {})).status()).toBe(200);
      await card.getByTestId('next-up-action').click();
      const stop = tara.getByTestId('stop-lesson');
      await stop.locator('#live-notes').fill('Fractions on a number line.');
      await stop.getByTestId('stop-submit').click();
      await expect(stop.getByTestId('stop-problem')).toHaveText("Ask the office to set Yusuf's price.");

      // Keep going keeps the note on the running lesson; the next Stop -- from the bar this time -- reads it back.
      await stop.getByTestId('stop-keep-going').click();
      await expect(stop).toHaveCount(0);
      await expect
        .poll(async () => (await unwrap<any>(await tara.request.get('/api/sessions/active'), 'running')).mine?.notes)
        .toBe('Fractions on a number line.');
      await tara.reload();
      await tara.getByTestId('live-stop').click();
      await expect(tara.getByTestId('stop-lesson').locator('#live-notes')).toHaveValue('Fractions on a number line.');

      // Priced again, it records -- the length, never the money -- and offers the write-up.
      expect((await setPrices(admin, c.studentId, { in_person: 9000 })).status()).toBe(200);
      await tara.getByTestId('stop-submit').click();
      const done = tara.getByTestId('stop-recorded');
      await expect(done).toContainText('Lesson recorded.');
      expect(await done.innerText()).not.toMatch(/\$\s?\d/);
      await done.getByTestId('stop-write-up').click();
      const form = tara.getByRole('dialog', { name: 'Edit lesson' });
      await expect(form.getByLabel('Lesson notes', { exact: true })).toHaveValue('Fractions on a number line.');
      await form.getByRole('button', { name: 'Cancel' }).click();
      await expect(tara.getByTestId('next-up-lesson_running')).toHaveCount(0);
    } finally {
      await tara.request.delete('/api/sessions/active');
    }
  });

  test('JF30: Start from Next up opens the Start dialog prefilled; the lesson then leads Next up', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as, { in_person: 9000 });
    const { day, minutes } = await orgNow(admin);
    // Under way now: from the last quarter hour, for an hour.
    const begin = Math.floor(minutes / 15) * 15;
    test.skip(begin + 60 > 23 * 60 + 59, 'too close to midnight for a lesson under way today');
    await weekly(admin, c, day, clock(begin));
    const tara = c.tara;
    try {
      await tara.goto('/');
      const card = tara.getByTestId('next-up');
      await expect(card.getByTestId('next-up-lesson_now')).toBeVisible();
      await card.getByTestId('next-up-action').click();
      const start = tara.getByTestId('start-lesson');
      await expect(start.locator('#live-student')).toContainText(c.studentName);
      await expect(start.locator('#live-mode')).toContainText('In person');
      await start.getByTestId('start-lesson-submit').click();
      await expect(start).toHaveCount(0);
      await expect(card.getByTestId('next-up-lesson_running')).toBeVisible();
      await expect(card.getByTestId('next-up-action')).toHaveText(/Stop/);

      // With it running, Start says why another cannot start.
      await tara.goto('/sessions');
      await tara.getByTestId('start-lesson-button').click();
      await expect(tara.getByTestId('start-lesson-running')).toContainText(`Your lesson with ${c.studentName} is still running.`);
    } finally {
      await tara.request.delete('/api/sessions/active');
    }
  });

  test('JF19: a saved draft is reached from Next up, the home’s To record and Sessions’ To record -- never a second', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as, { in_person: 9000 });
    const { day, minutes } = await orgNow(admin);
    // Yesterday, ending less than a day ago: both Next up's "just finished" and To record.
    const begin = Math.min(Math.ceil(Math.max(0, minutes - 45) / 15) * 15, 22 * 60 + 45);
    const yesterday = days(day, -1);
    const schedule = await weekly(admin, c, yesterday, clock(begin));
    const key = `${schedule.id}-${yesterday}`;
    const tara = c.tara;

    await tara.goto('/');
    const card = tara.getByTestId('next-up');
    await expect(card.getByTestId('next-up-lesson_unrecorded')).toBeVisible();
    await card.getByTestId('next-up-action').click();
    await tara.getByTestId('record-lesson').getByTestId('record-lesson-write-up').click();
    const form = tara.getByRole('dialog', { name: 'Record a lesson' });
    await expect(form.locator('#date')).toHaveValue(yesterday);
    await form.getByLabel('Lesson notes', { exact: true }).fill('Half written.');
    await expect(form.getByTestId('autosave-status')).toContainText('Draft autosaved', { timeout: 10_000 });
    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect(visible(tara, /kept as a draft/)).toBeVisible();
    const first = await drafts(tara);
    expect(first).toHaveLength(1);

    // Next up now continues it, "Draft saved ... · Continue".
    await tara.reload();
    await expect(card.getByTestId('next-up-draft')).toHaveText(/^Draft saved .+ · Continue$/);
    await card.getByTestId('next-up-draft').click();
    const again = tara.getByRole('dialog', { name: 'Finish this draft' });
    await expect(again.getByLabel('Lesson notes', { exact: true })).toHaveValue('Half written.');
    await again.getByLabel('Lesson notes', { exact: true }).fill('Half written, then more.');
    await expect(again.getByTestId('autosave-status')).toContainText('Draft autosaved', { timeout: 10_000 });
    await again.getByRole('button', { name: 'Cancel' }).click();
    expect((await drafts(tara)).map((d) => d.id)).toEqual([first[0].id]);

    // The home's To record row does too.
    await tara.reload();
    await tara.getByTestId(`home-draft-${key}`).click();
    await expect(tara.getByRole('dialog', { name: 'Finish this draft' }).getByLabel('Lesson notes', { exact: true })).toHaveValue(
      'Half written, then more.',
    );
    await tara.keyboard.press('Escape');
    await expect(tara.getByRole('dialog', { name: 'Finish this draft' })).toHaveCount(0);
    expect((await drafts(tara)).map((d) => d.id)).toEqual([first[0].id]);

    // And the Sessions page's To record, which records it.
    await tara.goto('/sessions');
    await tara.getByTestId(`sessions-to-record-draft-${key}`).click();
    const last = tara.getByRole('dialog', { name: 'Finish this draft' });
    await expect(last.getByLabel('Lesson notes', { exact: true })).toHaveValue('Half written, then more.');
    await last.getByRole('button', { name: 'Record lesson' }).click();
    await expect(last).toHaveCount(0);
    expect(await drafts(tara)).toEqual([]);
    const sessions = await unwrap<any[]>(await tara.request.get(`/api/sessions?student_user_id=${c.studentId}`), 'her lessons');
    expect(sessions.map((s) => [s.occurred_on, s.notes])).toEqual([[yesterday, 'Half written, then more.']]);
    // Owed no longer, anywhere.
    await expect(tara.getByTestId(`sessions-to-record-${key}`)).toHaveCount(0);
    await tara.goto('/');
    await expect(tara.getByTestId(`home-to-record-${key}`)).toHaveCount(0);
  });

  test('JF30: Next up’s known lesson -> “Record a lesson” -> “It ran as planned” records it as scheduled', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as, { in_person: 9000 });
    const { day, minutes } = await orgNow(admin);
    const begin = Math.min(Math.ceil(Math.max(0, minutes - 45) / 15) * 15, 22 * 60 + 45);
    const yesterday = days(day, -1);
    await weekly(admin, c, yesterday, clock(begin));
    const tara = c.tara;

    await tara.goto('/');
    await tara.getByTestId('next-up').getByTestId('next-up-action').click();
    const dialog = tara.getByTestId('record-lesson');
    await expect(dialog.getByRole('heading', { name: 'Record a lesson' })).toBeVisible();
    await expect(dialog.getByTestId('record-lesson-summary')).toContainText(c.studentName);
    await dialog.getByTestId('record-lesson-as-planned').click();
    const done = tara.getByTestId('record-lesson-done');
    await expect(done).toContainText('Lesson recorded.');
    expect(await done.innerText()).not.toMatch(/\$\s?\d/);
    await done.getByTestId('record-lesson-close').click();

    const sessions = await unwrap<any[]>(await tara.request.get(`/api/sessions?student_user_id=${c.studentId}`), 'her lessons');
    expect(sessions.map((s) => [s.occurred_on, s.started_at, s.ended_at])).toEqual([[yesterday, clock(begin), clock(begin + 60)]]);
    expect(await drafts(tara)).toEqual([]);
  });

  test('JF30: the quick action opens the lessons owed; “Another lesson” is a blank form, with no date', async ({ as }) => {
    const admin = await as('admin');
    const c = await cast(admin, as, { in_person: 9000 });
    const { day } = await orgNow(admin);
    const owed = await weekly(admin, c, days(day, -3), '10:00');
    const tara = c.tara;

    await tara.goto('/');
    await tara.getByTestId('quick-record_lesson').click();
    const list = tara.getByTestId('lessons-owed');
    await expect(list.getByTestId(`owed-record-${owed.id}-${days(day, -3)}`)).toBeVisible();
    await list.getByTestId('owed-another').click();

    const form = tara.getByRole('dialog', { name: 'Record a lesson' });
    await expect(form.locator('#date')).toHaveValue('');
    await expect(form.locator('#start')).toHaveValue('');
    await expect(form.locator('#end')).toHaveValue('');
    // Nothing is dated today by itself: the date is asked for.
    await form.getByRole('button', { name: 'Record lesson' }).click();
    await expect(form.getByText('Choose the date of the lesson.')).toBeVisible();
    expect(await unwrap<any[]>(await tara.request.get(`/api/sessions?student_user_id=${c.studentId}`), 'none')).toEqual([]);
    await form.getByRole('button', { name: 'Cancel' }).click();

    // To record leads the Sessions page, above the tabs, each row with Record; its button opens the same list.
    await tara.goto('/sessions');
    const panel = tara.getByTestId('sessions-to-record');
    await expect(panel.getByTestId(`sessions-to-record-record-${owed.id}-${days(day, -3)}`)).toBeVisible();
    const panelTop = (await panel.boundingBox())!.y;
    const listTop = (await tara.getByText(/No lessons recorded/).filter({ visible: true }).first().boundingBox())!.y;
    expect(panelTop).toBeLessThan(listTop);
    await tara.getByTestId('sessions-record').click();
    await expect(tara.getByTestId('lessons-owed')).toBeVisible();
    await tara.keyboard.press('Escape');

    // A row's Record is "Record a lesson" for it.
    await panel.getByTestId(`sessions-to-record-record-${owed.id}-${days(day, -3)}`).click();
    await expect(tara.getByTestId('record-lesson').getByTestId('record-lesson-as-planned')).toBeVisible();
  });

  test('JF27: the pairing form leaves the override empty; a pairing at the default is not “custom”', async ({ as }) => {
    const admin = await as('admin');
    const t = tag();
    const tutor = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: `Tess P${t}`,
          email: `jf27.tutor.${t}@example.com`,
          roles: ['tutor'],
          status: 'active',
          tutor_profile: { virtual_available: true, default_rate_in_person_cents: 6000, default_rate_virtual_cents: 5000 },
        },
      }),
      'a tutor',
    );
    tutorsMade.push(tutor.id);
    const parent = await unwrap<any>(
      await admin.request.post('/api/users', { data: { full_name: `Pia P${t}`, email: `jf27.parent.${t}@example.com`, roles: ['parent'] } }),
      'a parent',
    );
    const studentName = `Omar P${t}`;
    const student = await unwrap<any>(
      await admin.request.post('/api/users', {
        data: {
          full_name: studentName,
          roles: ['student'],
          student_profile: { virtual_available: true, charge_rate_in_person_cents: 9000 },
          guardians: [{ guardian_user_id: parent.id, relationship: 'mother', is_primary: true }],
        },
      }),
      'a student',
    );

    await admin.goto('/assignments');
    await admin.getByRole('button', { name: 'Assign a student' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.locator('#tutor').click();
    await admin.getByRole('option', { name: `Tess P${t}` }).click();
    await dialog.locator('#student').click();
    await admin.getByRole('option', { name: studentName }).click();
    await expect(dialog.getByText('Tutor pay, in person')).toBeVisible();
    await expect(dialog.locator('#rate_ip')).toHaveValue('');
    await expect(dialog.locator('#rate_ip')).toHaveAttribute('placeholder', "Tess's default, $60.00");
    await expect(dialog.locator('#rate_v')).toHaveAttribute('placeholder', "Tess's default, $50.00");
    await dialog.getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const pairing = (await unwrap<any[]>(await admin.request.get(`/api/assignments?student_user_id=${student.id}`), 'the pairing'))[0];
    expect(pairing).toMatchObject({ rate_in_person_cents: null, rate_virtual_cents: null, effective_rate_in_person_cents: 6000 });

    // An override that equals the tutor's default today reads as the default; a different one as custom.
    const row = () => admin.getByRole('row').filter({ hasText: studentName });
    await unwrap(await admin.request.patch(`/api/assignments/${pairing.id}`, { data: { rate_in_person_cents: 6000 } }), 'at the default');
    await admin.reload();
    await expect(row().locator('[data-rate]').first()).toHaveAttribute('data-rate', 'default');
    await expect(row().getByText('custom')).toHaveCount(0);
    await unwrap(await admin.request.patch(`/api/assignments/${pairing.id}`, { data: { rate_in_person_cents: 7000 } }), 'its own');
    await admin.reload();
    await expect(row().locator('[data-rate]').first()).toHaveAttribute('data-rate', 'custom');
    await expect(row().getByText('custom')).toBeVisible();
  });
});

test.describe('Phase 76: adding people one way (web)', () => {
  const FOUR = addChoices({ tutoring: true, personal: false, mayAdd: true }).map((choice) => choice.label);

  test('JF21: one Add chooser, from the home and the Users header, with its four choices; the statuses explained', async ({ as }) => {
    const admin = await as('admin');
    expect(FOUR).toEqual(['A family (parent and child)', 'A tutor', 'Someone else', 'Invite by email']);
    await admin.goto('/');
    await admin.getByTestId('quick-add_person').click();
    const chooser = admin.getByTestId('add-person');
    await expect(chooser.getByTestId('add-choices').getByRole('button')).toHaveText(FOUR.map((label) => new RegExp(`^${label.replace(/[()]/g, '\\$&')}`)));
    await admin.keyboard.press('Escape');

    await admin.goto('/users');
    await admin.getByTestId('users-add').click();
    await expect(admin.getByTestId('add-choices').getByRole('button')).toHaveCount(4);
    // "Someone else" is the person form, which says what each status means.
    await admin.getByTestId('add-choice-someone').click();
    const form = admin.getByRole('dialog', { name: 'Add a person' });
    const statuses = form.getByTestId('user-status-descriptions');
    for (const words of Object.values(USER_STATUS_DESCRIPTIONS)) await expect(statuses).toContainText(words);
  });

  test('JF21: “A family” -> the family flow -> next steps: Pair with a tutor, then Set a weekly lesson, each preset', async ({ as }) => {
    const admin = await as('admin');
    const t = tag();
    const parentName = `Family R${t}`;
    const studentName = `Yusuf R${t}`;
    let parentId = '';
    let studentId = '';
    try {
      await admin.goto('/users');
      await admin.getByTestId('users-add').click();
      await admin.getByTestId('add-choice-family').click();
      const flow = admin.getByTestId('add-person');
      // The office's usual case leads.
      await expect(flow.getByRole('button').filter({ hasText: /Create a family account|This is my child/ }).first()).toHaveText(/Create a family account/);
      await flow.getByTestId('onboarding-new-family').click();
      const family = admin.getByRole('dialog', { name: 'New family account' });
      await family.locator('#full_name').fill(parentName);
      await family.locator('#email').fill(`jf21.family.${t}@example.com`);
      await family.getByRole('button', { name: 'Add a person' }).click();
      await expect(family).toHaveCount(0);

      await flow.getByTestId('onboarding-add-student').click();
      const student = admin.getByRole('dialog', { name: 'New student' });
      await student.locator('#full_name').fill(studentName);
      await student.getByRole('button', { name: 'Add a person' }).click();
      await expect(student).toHaveCount(0);

      // The next steps, not a toast.
      await expect(flow.getByRole('heading', { name: `${studentName} is added` })).toBeVisible();
      await expect(visible(admin, `${studentName} added.`)).toHaveCount(0);
      await expect(flow.getByTestId('next-step-pair_tutor')).toHaveText('Pair Yusuf with a tutor');
      await flow.getByTestId('next-step-pair_tutor').click();
      const pairing = admin.getByRole('dialog', { name: 'Pair a tutor with a student' });
      await expect(pairing.locator('#student')).toContainText(studentName);
      await pairing.locator('#tutor').click();
      await admin.getByRole('option', { name: PEOPLE.tutor.name }).click();
      // Where they meet: the tutor's own room.
      await pairing.getByTestId('pairing-locations').getByRole('checkbox').first().check();
      await pairing.getByRole('button', { name: 'Assign', exact: true }).click();
      await expect(pairing).toHaveCount(0);

      await flow.getByTestId('next-step-weekly_lesson').click();
      const lesson = admin.getByRole('dialog', { name: 'Set a weekly lesson' });
      await expect(lesson.locator('#who')).toContainText(studentName);
      await lesson.getByRole('button', { name: 'Schedule', exact: true }).click();
      await expect(lesson).toHaveCount(0);

      parentId = (await unwrap<any[]>(await admin.request.get(`/api/users?search=${encodeURIComponent(parentName)}`), 'parent'))[0].id;
      studentId = (await unwrap<any[]>(await admin.request.get(`/api/users?search=${encodeURIComponent(studentName)}`), 'student'))[0].id;
      const record = await unwrap<any>(await admin.request.get(`/api/users/${studentId}`), 'the student');
      expect(record.guardians.map((g: any) => g.user_id)).toEqual([parentId]);
      const pairings = await unwrap<any[]>(await admin.request.get(`/api/assignments?student_user_id=${studentId}`), 'pairings');
      expect(pairings.map((p) => p.tutor_name)).toEqual([PEOPLE.tutor.name]);
      const schedules = await unwrap<any[]>(await admin.request.get(`/api/schedules?student_user_id=${studentId}`), 'schedules');
      expect(schedules.map((s) => s.tutor_name)).toEqual([PEOPLE.tutor.name]);
    } finally {
      for (const schedule of studentId
        ? await unwrap<any[]>(await admin.request.get(`/api/schedules?student_user_id=${studentId}`), 'schedules')
        : []) {
        await admin.request.delete(`/api/schedules/${schedule.id}`);
      }
      if (studentId) await admin.request.delete(`/api/users/${studentId}?hard=true`);
      if (parentId) await admin.request.delete(`/api/users/${parentId}?hard=true`);
    }
  });

  test('JF21: in a personal space, “My child” adds the child with the adult as their parent', async ({ page, as }) => {
    const t = tag();
    const email = `jf21.adult.${t}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, birth_month: 3, birth_year: 1984, dev_email: email, dev_name: 'Dana Mine' },
      }),
      'signs up',
    );
    const outside = await as('admin', { email, org: null });
    const personal = (await unwrap<any>(await outside.request.get('/api/auth/session'), 'her session')).memberships.find((m: any) => m.personal);
    const dana = await as('admin', { email, org: personal.slug });
    const me = (await unwrap<any>(await dana.request.get('/api/auth/session'), 'in her space')).user;

    await dana.goto('/');
    await expect(dana.getByTestId('quick-add_person')).toHaveText(/Add my child/);
    await dana.getByTestId('quick-add_person').click();
    const chooser = dana.getByTestId('add-person');
    await expect(chooser.getByTestId('add-choice-family')).toContainText('My child');
    await expect(chooser.getByTestId('add-choice-tutor')).toHaveCount(0);
    await chooser.getByTestId('add-choice-family').click();
    await chooser.getByTestId('onboarding-add-student').click();
    const child = dana.getByRole('dialog', { name: 'Your child', exact: true });
    // She is named the guardian already, by name.
    await expect(child.getByRole('button', { name: 'Remove Dana Mine' })).toBeVisible();
    await child.locator('#full_name').fill(`Rio Mine${t}`);
    // Consent stays an explicit box.
    await child.getByRole('button', { name: 'Add a person' }).click();
    await expect(child.getByTestId('user-parent-consent')).toContainText('Confirm you are their parent or guardian');
    await child.getByTestId('user-parent-consent').getByRole('checkbox').check();
    await child.getByRole('button', { name: 'Add a person' }).click();
    await expect(child).toHaveCount(0);
    await expect(chooser.getByRole('heading', { name: `Rio Mine${t} is added` })).toBeVisible();

    const kids = await unwrap<any[]>(await dana.request.get(`/api/users?search=${encodeURIComponent(`Rio Mine${t}`)}`), 'her child');
    const record = await unwrap<any>(await dana.request.get(`/api/users/${kids[0].id}`), 'the record');
    expect(record.guardians.map((g: any) => g.user_id)).toEqual([me.id]);
    expect((await unwrap<any>(await dana.request.get('/api/auth/session'), 'after')).user.roles).toEqual(expect.arrayContaining(['admin', 'parent']));
  });

  test('JF37: Invite by email from the chooser; an invited row’s Copy invitation and Share, each confirmed', async ({ as }) => {
    test.setTimeout(90_000);
    const ines = await as('assessAdmin', { org: 'assess' });
    const session = await unwrap<any>(await ines.request.get('/api/auth/session'), 'her session');
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const email = `jf37.invited.${tag()}@example.com`;
    const expected = invitationText({
      inviter: session.user.full_name,
      space: session.organization.name,
      address: `${origin}/spaces`,
      email,
      org: session.organization,
    });
    expect(expected).toContain(', a space for ');

    await ines.goto('/users');
    await ines.evaluate(() => {
      const w = window as any;
      w.__copied = null;
      w.__shared = null;
      Object.defineProperty(navigator.clipboard, 'writeText', {
        configurable: true,
        value: async (text: string) => {
          w.__copied = text;
        },
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (data: { text?: string }) => {
          w.__shared = data;
        },
      });
    });
    let invitedId = '';
    try {
      await ines.getByTestId('users-add').click();
      await ines.getByTestId('add-choice-invite').click();
      const step = ines.getByTestId('invite-step');
      await step.getByTestId('invite-email-0').fill(email);
      await step.getByTestId('invite-send').click();
      await expect(step.getByTestId(`invite-sent-${email}`)).toBeVisible();
      await step.getByTestId(`invite-copy-${email}`).click();
      await expect.poll(() => ines.evaluate(() => (window as any).__copied)).toBe(expected);
      await step.getByTestId('invite-continue').click();
      await expect(ines.getByTestId('add-person')).toHaveCount(0);

      // On the People page, the invited row tells them again.
      await ines.evaluate(() => ((window as any).__copied = null));
      await ines.getByLabel('Search people').fill(email);
      // The list is searched after a pause: the one row, then its menu.
      await expect(ines.getByText('Showing 1–1 of 1')).toBeVisible();
      await ines.getByRole('button', { name: /^Actions for / }).filter({ visible: true }).first().click();
      await ines.getByRole('menuitem', { name: 'Copy invitation' }).click();
      await expect.poll(() => ines.evaluate(() => (window as any).__copied)).toBe(expected);
      await expect(visible(ines, 'Invitation copied.').first()).toBeVisible();
      await ines.getByRole('button', { name: /^Actions for / }).filter({ visible: true }).first().click();
      await ines.getByRole('menuitem', { name: 'Share' }).click();
      await expect.poll(() => ines.evaluate(() => (window as any).__shared?.text)).toBe(expected);
      await expect(visible(ines, 'Invitation shared.').first()).toBeVisible();
    } finally {
      const rows = await unwrap<any[]>(await ines.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'the invited');
      invitedId = rows[0]?.id ?? '';
      if (invitedId) await ines.request.delete(`/api/users/${invitedId}?hard=true`);
    }
  });
});

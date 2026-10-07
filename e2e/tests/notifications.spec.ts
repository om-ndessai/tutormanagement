import type { Page } from '@playwright/test';

import { expect, ORGS, PEOPLE, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';

/**
 * Phase 32: email notifications.
 *
 * The rules worth holding (docs/data-exposure.md, R15): nothing is sent while
 * the organization's flag is off; each action reaches exactly the people it
 * concerns -- a student and their parents, the tutor, the admins -- once each,
 * never the person who did it, and never anybody from another organization;
 * only the organization's admins switch it and read its log; and the log holds
 * names and outcomes, never an address or a message.
 *
 * Local and the demo have no sender configured, so every attempt is logged
 * `skipped`: the log is what would have been sent, and that is what this
 * checks. Organization A has notifications on in the seed; tests that turn it
 * off turn it back on.
 */

type Entry = {
  id: string;
  kind: string;
  recipient_user_id: string;
  recipient_name: string;
  subject_user_id: string | null;
  status: string;
};

const readLog = async (admin: Page) =>
  unwrap<Entry[]>(await admin.request.get('/api/organization/notifications'), 'the log');

/** Runs the action, then the entries it added (they are written after the response). */
async function newEntries(admin: Page, action: () => Promise<unknown>, expectAny = true) {
  const before = new Set((await readLog(admin)).map((entry) => entry.id));
  await action();
  if (!expectAny) {
    // Give the after-response work its chance, then check nothing came of it.
    await admin.waitForTimeout(1500);
    return (await readLog(admin)).filter((entry) => !before.has(entry.id));
  }
  let added: Entry[] = [];
  await expect
    .poll(async () => {
      added = (await readLog(admin)).filter((entry) => !before.has(entry.id));
      return added.length;
    })
    .toBeGreaterThan(0);
  return added;
}

const names = (entries: Entry[]) => entries.map((entry) => entry.recipient_name).sort();

async function setFlag(admin: Page, on: boolean) {
  await unwrap(
    await admin.request.patch('/api/organization/settings', { data: { email_notifications: on } }),
    'switching notifications',
  );
}

/** A lesson between Alex and Sofia, recorded by Alex. */
async function recordAlexWithSofia(tutor: Page, tutorId: string, sofiaId: string) {
  return unwrap<any>(
    await tutor.request.post('/api/sessions', {
      data: {
        tutor_user_id: tutorId,
        student_user_id: sofiaId,
        occurred_on: '2026-10-05',
        started_at: '16:00',
        ended_at: '17:00',
        mode: 'in_person',
      },
    }),
    'recording a lesson',
  );
}

test.describe('email notifications', () => {
  test('a recorded lesson reaches the student and her parent, once each, and not the tutor', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    let session: any;
    const sent = await newEntries(admin, async () => {
      session = await recordAlexWithSofia(tutor, tutorId, sofiaId);
    });

    // Sofia has her own address; Maria is her mother, and also a tutor, and
    // still gets one email. Alex recorded it, so he gets none.
    expect(sent.every((entry) => entry.kind === 'session_recorded')).toBe(true);
    expect(names(sent)).toEqual([PEOPLE.parentTutor.name, PEOPLE.student.name].sort());
    expect(sent.every((entry) => entry.subject_user_id === sofiaId)).toBe(true);

    await admin.request.delete(`/api/sessions/${session.id}`);
  });

  test('nothing is sent while the flag is off', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    await setFlag(admin, false);
    try {
      let session: any;
      const sent = await newEntries(
        admin,
        async () => {
          session = await recordAlexWithSofia(tutor, tutorId, sofiaId);
        },
        false,
      );
      expect(sent).toEqual([]);
      await admin.request.delete(`/api/sessions/${session.id}`);
    } finally {
      await setFlag(admin, true);
    }
  });

  test('adding a family reaches the new people and the other admins', async ({ as }) => {
    const admin = await as('admin');
    const stamp = Date.now();
    const parentEmail = `notify.parent.${stamp}@gmail.com`;

    let parentId = '';
    const parentSent = await newEntries(admin, async () => {
      const parent = await unwrap<any>(
        await admin.request.post('/api/users', {
          data: { full_name: `Notify Parent ${stamp}`, email: parentEmail, roles: ['parent'], status: 'active' },
        }),
        'adding a parent',
      );
      parentId = parent.id;
    });

    const admins = await unwrap<any[]>(await admin.request.get('/api/users?role=admin&limit=100'), 'admins');
    // Active admins only: one still at "invited" has not joined, and is not told.
    const otherAdmins = admins
      .filter((person) => person.email !== PEOPLE.admin.email && person.status === 'active')
      .map((person) => person.full_name);

    expect(parentSent.every((entry) => entry.kind === 'user_added')).toBe(true);
    expect(names(parentSent)).toEqual([`Notify Parent ${stamp}`, ...otherAdmins].sort());
    // Priya added them: she is not told what she just did.
    expect(names(parentSent)).not.toContain(PEOPLE.admin.name);

    // A student with no address: their parent hears of it instead.
    const studentSent = await newEntries(admin, async () => {
      await unwrap(
        await admin.request.post('/api/users', {
          data: {
            full_name: `Notify Student ${stamp}`,
            roles: ['student'],
            status: 'active',
            guardians: [{ guardian_user_id: parentId, relationship: 'mother', is_primary: true }],
          },
        }),
        'adding a student',
      );
    });
    expect(names(studentSent)).toEqual([`Notify Parent ${stamp}`, ...otherAdmins].sort());
  });

  test('a plan, an assessment and a schedule reach the family and the tutors', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const tutorId = await idOf(admin, PEOPLE.tutor.email);
    const sofiaId = await idOf(admin, PEOPLE.student.email);

    // An assessment goes to the student, her parent and every tutor she is
    // paired with -- Alex among them. Priya wrote it, so not to her.
    let assessmentId = '';
    const assessed = await newEntries(admin, async () => {
      const created = await unwrap<any>(
        await admin.request.post('/api/progress/assessments', {
          data: { student_user_id: sofiaId, assessed_on: '2026-10-05', summary: 'Notification check.' },
        }),
        'an assessment',
      );
      assessmentId = created.id;
    });
    expect(assessed.every((entry) => entry.kind === 'assessment_added')).toBe(true);
    expect(names(assessed)).toEqual(expect.arrayContaining([PEOPLE.student.name, PEOPLE.parentTutor.name, PEOPLE.tutor.name]));
    expect(names(assessed)).not.toContain(PEOPLE.admin.name);
    await admin.request.delete(`/api/progress/assessments/${assessmentId}`);

    // A schedule Alex sets up: Sofia and Maria, not Alex.
    let scheduleId = '';
    const scheduled = await newEntries(admin, async () => {
      const created = await unwrap<any>(
        await tutor.request.post('/api/schedules', {
          data: {
            tutor_user_id: tutorId,
            student_user_id: sofiaId,
            day_of_week: 6,
            start_time: '09:00',
            duration_minutes: 60,
            mode: 'virtual',
            starts_on: '2026-10-10',
          },
        }),
        'a schedule',
      );
      scheduleId = created.id;
    });
    expect(scheduled.every((entry) => entry.kind === 'schedule_added')).toBe(true);
    expect(names(scheduled)).toEqual([PEOPLE.parentTutor.name, PEOPLE.student.name].sort());
    await tutor.request.delete(`/api/schedules/${scheduleId}`);
  });

  test('only admins switch it and read the log, which holds no addresses', async ({ as }) => {
    const tutor = await as('tutor');
    const admin = await as('admin');

    expect((await tutor.request.patch('/api/organization/settings', { data: { email_notifications: false } })).status()).toBe(403);
    expect((await tutor.request.get('/api/organization/notifications')).status()).toBe(403);

    const log = await readLog(admin);
    for (const entry of log) {
      expect(JSON.stringify(entry)).not.toMatch(/@/);
    }

    // The switch is on the Organization page, with the recent emails beside it.
    await admin.goto('/organization');
    const card = admin.getByTestId('email-notifications');
    await expect(card.getByRole('switch', { name: 'Email notifications' })).toHaveAttribute('aria-checked', 'true');
    await card.getByRole('switch', { name: 'Email notifications' }).click();
    await expect(card.getByRole('switch', { name: 'Email notifications' })).toHaveAttribute('aria-checked', 'false');
    await card.getByRole('switch', { name: 'Email notifications' }).click();
    await expect(card.getByRole('switch', { name: 'Email notifications' })).toHaveAttribute('aria-checked', 'true');
  });

  test('nothing crosses into another organization, and its own flag is its own', async ({ as }) => {
    // B has notifications off: A's activity, which notified plenty above,
    // wrote nothing in B's log -- and B's admin reads only B's.
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const settings = await unwrap<any>(await rosa.request.get('/api/organization/settings'), 'B settings');
    expect(settings.email_notifications).toBe(false);
    expect(await readLog(rosa)).toEqual([]);

    const admin = await as('admin');
    expect((await readLog(admin)).length).toBeGreaterThan(0);
  });

  test('a link naming an organization opens in it', async ({ as }) => {
    // Anita belongs to both; the browser was last in A.
    const anita = await as('parent');
    await anita.goto(`/sessions?org=${ORGS.b.slug}`);
    await expect(anita.getByTestId('org-switcher')).toContainText(ORGS.b.short);
    await expect(anita).toHaveURL(/\/sessions$/);
  });
});

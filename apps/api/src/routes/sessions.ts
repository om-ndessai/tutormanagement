import { Hono } from 'hono';
import { z } from 'zod';
import {
  computeAmountCents,
  elapsedMinutes,
  formatClockTime,
  formatDuration,
  resolveRateCents as resolveRate,
  startSessionSchema,
  stopSessionSchema,
  updateActiveSessionSchema,
  type ActiveSession,
  listSessionsQuerySchema,
  marginCents,
  SESSION_MODE_LABELS,
  resolveChargeRateCents,
  resolveRateCents,
  roundToQuarterHour,
  sessionInputSchema,
  sessionUpdateSchema,
  type ApiList,
  type ApiOk,
  type SessionMode,
  type SessionProgressPayload,
  type SessionTotals,
  type TutoringSession,
  type User,
  sessionDraftInputSchema,
  sessionProgressInputSchema,
  type SessionDraft,
  HOMEWORK_STATUS_LABELS,
  SESSION_ASSESSOR_LABELS,
  sessionAssessmentInputSchema,
  type SessionAssessmentPayload,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { buildCsv, csvMoney, csvResponse, datedFilename } from '../lib/csv.js';
import { ApiError } from '../lib/errors.js';
import { autoStopExpired, recordRunningSession } from '../lib/live-sessions.js';
import { priceSession } from '../lib/pricing.js';
import {
  familyStudentIds,
  isAdmin,
  scopeSessionMoney,
  sessionAssessorRole,
} from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import { getStudentChargeRates } from '../repositories/users.js';
import {
  clearActive,
  getActiveRow,
  listActiveRows,
  startActive,
  toActiveSession,
  updateActive,
} from '../repositories/active-sessions.js';
import { findUnknownCurriculumIds, saveSessionProgress } from '../repositories/progress.js';
import {
  createDraft,
  deleteDraft,
  getDraft,
  listMyDrafts,
  updateDraft,
} from '../repositories/session-drafts.js';
import { deleteAssessment, saveAssessment, saveWriteUp } from '../repositories/session-notes.js';
import {
  createSession,
  deleteSession,
  getSession,
  getVisibleSession,
  listSessions,
  updateSessionRow,
  type StoredSession,
} from '../repositories/sessions.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid session id.' }) });

/**
 * A tutor writes up their own lessons; an admin may write up anybody's. The
 * pairing has to exist either way, so a draft cannot name a student who is
 * not being taught by that tutor.
 */
async function assertMayWriteFor(
  db: D1Database,
  viewer: User,
  tutorUserId: string,
  studentUserId: string,
) {
  if (!isAdmin(viewer) && viewer.id !== tutorUserId) {
    throw new ApiError(403, 'forbidden', 'You can only write up your own sessions.');
  }

  if (!(await getActiveAssignmentFor(db, tutorUserId, studentUserId))) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['That student is not currently assigned to this tutor.'],
    });
  }
}

/**
 * A draft belongs to whoever is writing it and to nobody else -- not the
 * tutor it names, not an admin. Reported as missing rather than forbidden:
 * that somebody has an unfinished write-up is itself theirs to know.
 */
async function assertMyDraft(db: D1Database, viewer: User, id: string) {
  const draft = await getDraft(db, id);
  if (!draft || draft.author_user_id !== viewer.id) {
    throw ApiError.notFound('That draft does not exist.');
  }
  return draft;
}

/** A lesson can only be scored against topics that exist in the curriculum. */
async function assertProgressTopics(db: D1Database, progress: SessionProgressPayload | undefined) {
  if (!progress) return;

  const unknown = await findUnknownCurriculumIds(
    db,
    'curriculum_topics',
    progress.topic_ratings.map((row) => row.topic_id),
  );

  if (unknown.length > 0) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      'progress.topic_ratings': [`Not in the curriculum: ${unknown.join(', ')}.`],
    });
  }
}

/**
 * Records, revises or (with null) withdraws the viewer's OWN assessment of a
 * lesson. There is no way to write or remove anybody else's.
 *
 * The capacity they write in is decided here from how they relate to the
 * lesson, never taken from the client. Somebody the lesson does not concern
 * is told it does not exist, as for every other read of it.
 *
 * The log line says that an assessment was given, never what it said or how
 * it scored: the log is read by admins and by the subject, and an assessment
 * is addressed to the lesson's own audience.
 */
async function applyOwnAssessment(
  db: D1Database,
  viewer: User,
  session: StoredSession,
  input: SessionAssessmentPayload | null,
) {
  const role = sessionAssessorRole(session, viewer, await familyStudentIds(db, viewer));
  if (!role) throw ApiError.notFound('That session does not exist.');

  const lesson = `the ${session.occurred_on} session with ${session.student_name}`;
  const audit = {
    subject: { id: session.student_user_id, full_name: session.student_name },
    entity_type: 'session',
    entity_id: session.id,
  };

  if (input === null) {
    if (!(await deleteAssessment(db, session.id, viewer.id))) {
      throw ApiError.notFound('You have not assessed that session.');
    }
    await recordAudit(db, viewer, {
      action: 'session.assessment_withdrawn',
      description: `Withdrew their assessment of ${lesson}`,
      ...audit,
    });
    return;
  }

  const { revised } = await saveAssessment(db, session.id, viewer.id, role, input);
  await recordAudit(db, viewer, {
    action: 'session.assessed',
    description: `${revised ? 'Revised their' : 'Gave an'} assessment of ${lesson}, as ${
      role === 'admin' ? 'the office' : `the ${SESSION_ASSESSOR_LABELS[role].toLowerCase()}`
    }`,
    ...audit,
  });
}

/** One stored session, as this viewer may see it. */
async function scopeFor(db: D1Database, viewer: User, session: StoredSession): Promise<TutoringSession> {
  return scopeSessionMoney(session, viewer, await familyStudentIds(db, viewer));
}

/** A list response that also carries the totals for the same filter. */
interface SessionListBody extends ApiList<TutoringSession> {
  totals: SessionTotals;
}


export const sessionsRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listSessionsQuerySchema), async (c) => {
    const params = c.req.valid('query');
    const { sessions, totals } = await listSessions(c.env.DB, c.get('user'), params);

    const body: SessionListBody = {
      data: sessions,
      meta: { total: totals.session_count, limit: params.limit, offset: params.offset },
      totals,
    };
    return c.json(body);
  })

  /**
   * "After each session, the tutor will record that session was held."
   *
   * Duration and amount are derived here, never accepted from the client.
   */
  .post('/', zValidator('json', sessionInputSchema), async (c) => {
    const input = c.req.valid('json');
    const viewer = c.get('user');

    // A tutor records their own lessons; an admin can record on anyone's behalf.
    if (!isAdmin(viewer) && viewer.id !== input.tutor_user_id) {
      throw new ApiError(403, 'forbidden', 'You can only record your own sessions.');
    }

    const priced = await priceSession(
      c.env.DB,
      input.tutor_user_id,
      input.student_user_id,
      input.mode,
      input.started_at,
      input.ended_at,
    );

    await assertProgressTopics(c.env.DB, input.progress);

    let session = await createSession(c.env.DB, {
      tutor_user_id: input.tutor_user_id,
      student_user_id: input.student_user_id,
      occurred_on: input.occurred_on,
      started_at: input.started_at,
      ended_at: input.ended_at,
      duration_minutes: priced.durationMinutes,
      mode: input.mode,
      tutor_rate_cents: priced.tutorRateCents,
      tutor_amount_cents: priced.tutorAmountCents,
      charge_rate_cents: priced.chargeRateCents,
      charge_amount_cents: priced.chargeAmountCents,
      notes: input.notes,
      // A person is asserting what happened, so the end is observed, not imposed.
      auto_stopped: false,
      recorded_by_user_id: viewer.id,
    });

    if (input.progress) {
      await saveSessionProgress(c.env.DB, session.id, session.student_user_id, input.progress);
    }
    if (input.write_up) await saveWriteUp(c.env.DB, session.id, input.write_up);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.recorded',
      description:
        `Recorded a ${formatDuration(session.duration_minutes)} ` +
        `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
        // No amount: the tutor who recorded it reads this line, and the
        // figure here was the family's price. The session itself carries
        // each side's money, scoped to whoever opens it.
        `${session.student_name} on ${session.occurred_on}`,
      subject: { id: session.student_user_id, full_name: session.student_name },
      entity_type: 'session',
      entity_id: session.id,
    });

    // After the lesson is on the record, so the log reads in the order it happened.
    if (input.assessment) await applyOwnAssessment(c.env.DB, viewer, session, input.assessment);

    session = (await getSession(c.env.DB, session.id)) ?? session;

    const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, session) };
    return c.json(body, 201);
  })

  // -------------------------------------------------------------------------
  // Drafts
  // -------------------------------------------------------------------------
  // A write-up in progress. Registered above /:id so "drafts" is not read as
  // a session id, and scoped to its author throughout: a draft is nobody
  // else's business until it is posted, admins included.

  /** The viewer's own unposted write-ups, newest first. */
  .get('/drafts', async (c) => {
    const body: ApiOk<SessionDraft[]> = {
      data: await listMyDrafts(c.env.DB, c.get('user').id),
    };
    return c.json(body);
  })

  .post('/drafts', zValidator('json', sessionDraftInputSchema), async (c) => {
    const input = c.req.valid('json');
    const viewer = c.get('user');

    await assertMayWriteFor(c.env.DB, viewer, input.tutor_user_id, input.student_user_id);
    await assertProgressTopics(c.env.DB, input.progress);

    const draft = await createDraft(c.env.DB, viewer.id, input);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.drafted',
      // Says a draft exists, never what is in it: the notes are the part that
      // is not ready to be read.
      description: `Saved a draft session with ${draft.student_name} on ${draft.occurred_on}`,
      subject: { id: draft.student_user_id, full_name: draft.student_name },
      entity_type: 'session_draft',
      entity_id: draft.id,
    });

    const body: ApiOk<SessionDraft> = { data: draft };
    return c.json(body, 201);
  })

  .patch(
    '/drafts/:id',
    zValidator('param', idParamSchema),
    zValidator('json', sessionDraftInputSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const viewer = c.get('user');

      await assertMyDraft(c.env.DB, viewer, id);
      await assertMayWriteFor(c.env.DB, viewer, input.tutor_user_id, input.student_user_id);
      await assertProgressTopics(c.env.DB, input.progress);

      const draft = await updateDraft(c.env.DB, id, input);
      if (!draft) throw ApiError.notFound('That draft does not exist.');

      const body: ApiOk<SessionDraft> = { data: draft };
      return c.json(body);
    },
  )

  .delete('/drafts/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const draft = await assertMyDraft(c.env.DB, viewer, id);
    await deleteDraft(c.env.DB, id);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.draft_discarded',
      description: `Discarded a draft session with ${draft.student_name} on ${draft.occurred_on}`,
      subject: { id: draft.student_user_id, full_name: draft.student_name },
      entity_type: 'session_draft',
      entity_id: draft.id,
    });

    return c.body(null, 204);
  })

  /**
   * Posts a draft: the moment it becomes a lesson everybody concerned can see.
   *
   * Priced here rather than when it was drafted, at whatever rates apply now,
   * so a draft left sitting over a rate change cannot post at yesterday's
   * price. The draft is removed in the same breath -- one write-up must not
   * become two records.
   */
  .post('/drafts/:id/post', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const draft = await assertMyDraft(c.env.DB, viewer, id);
    await assertMayWriteFor(c.env.DB, viewer, draft.tutor_user_id, draft.student_user_id);

    const priced = await priceSession(
      c.env.DB,
      draft.tutor_user_id,
      draft.student_user_id,
      draft.mode,
      draft.started_at,
      draft.ended_at,
    );

    let session = await createSession(c.env.DB, {
      tutor_user_id: draft.tutor_user_id,
      student_user_id: draft.student_user_id,
      occurred_on: draft.occurred_on,
      started_at: draft.started_at,
      ended_at: draft.ended_at,
      duration_minutes: priced.durationMinutes,
      mode: draft.mode,
      tutor_rate_cents: priced.tutorRateCents,
      tutor_amount_cents: priced.tutorAmountCents,
      charge_rate_cents: priced.chargeRateCents,
      charge_amount_cents: priced.chargeAmountCents,
      notes: draft.notes,
      // A person is asserting what happened, so the end is observed.
      auto_stopped: false,
      recorded_by_user_id: viewer.id,
    });

    if (draft.progress) {
      const progress = sessionProgressInputSchema.parse(draft.progress);
      await assertProgressTopics(c.env.DB, progress);
      await saveSessionProgress(c.env.DB, session.id, session.student_user_id, progress);
    }
    // The write-up and the author's assessment were private with the draft;
    // posting is what shows them to everybody the lesson concerns.
    if (draft.write_up) await saveWriteUp(c.env.DB, session.id, draft.write_up);

    await deleteDraft(c.env.DB, id);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.recorded',
      description:
        `Posted a drafted ${formatDuration(session.duration_minutes)} ` +
        `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
        `${session.student_name} on ${session.occurred_on}`,
      subject: { id: session.student_user_id, full_name: session.student_name },
      entity_type: 'session',
      entity_id: session.id,
    });

    if (draft.assessment) await applyOwnAssessment(c.env.DB, viewer, session, draft.assessment);

    session = (await getSession(c.env.DB, session.id)) ?? session;

    const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, session) };
    return c.json(body, 201);
  })

  /**
   * The session log as a spreadsheet. Same filters and same scoping as the
   * list, so a tutor exports their own lessons and an admin exports all of
   * them -- the export can never widen what somebody may see.
   */
  .get('/export.csv', zValidator('query', listSessionsQuerySchema), async (c) => {
    const params = c.req.valid('query');
    // Export the whole filtered set, not just the page the UI happens to show.
    const { sessions, totals } = await listSessions(c.env.DB, c.get('user'), {
      ...params,
      limit: 5000,
      offset: 0,
    });

    // Columns follow what the reader may see, so a tutor's spreadsheet has no
    // empty "Charged" column hinting that one exists, and a family's none
    // for the tutor's pay. An admin gets both sides and the institute's cut.
    const admin = isAdmin(c.get('user'));
    const payColumns = admin || totals.total_tutor_amount_cents !== null;
    const chargeColumns = admin || totals.total_charge_amount_cents !== null;

    const headers = [
      'Date',
      'Student',
      'Tutor',
      'Start',
      'End',
      'Minutes',
      'Mode',
      ...(chargeColumns ? [admin ? 'Charge rate (USD/hr)' : 'Rate charged (USD/hr)', admin ? 'Charged (USD)' : 'Charged to you (USD)'] : []),
      ...(payColumns ? [admin ? 'Tutor rate (USD/hr)' : 'Your rate (USD/hr)', admin ? 'Tutor pay (USD)' : 'Your pay (USD)'] : []),
      ...(admin ? ['Institute cut (USD)'] : []),
      'Planned',
      'Previous session review',
      'Homework status',
      'Homework review',
      'Notes',
      'Homework set',
      'Assessments',
    ];

    const body = buildCsv(
      headers,
      sessions.map((session) => [
        session.occurred_on,
        session.student_name,
        session.tutor_name,
        formatClockTime(session.started_at),
        formatClockTime(session.ended_at),
        session.duration_minutes,
        SESSION_MODE_LABELS[session.mode],
        ...(chargeColumns
          ? [csvMoney(session.charge_rate_cents), csvMoney(session.charge_amount_cents)]
          : []),
        ...(payColumns
          ? [csvMoney(session.tutor_rate_cents), csvMoney(session.tutor_amount_cents)]
          : []),
        ...(admin ? [csvMoney(marginCents(session))] : []),
        session.write_up?.planned ?? '',
        session.write_up?.previous_review ?? '',
        session.write_up?.homework_status
          ? HOMEWORK_STATUS_LABELS[session.write_up.homework_status]
          : '',
        session.write_up?.homework_review ?? '',
        session.notes ?? '',
        session.write_up?.homework_assigned ?? '',
        // "Tutor (Alex Chen) 4/5; Parent (Maria Okafor): Loved it." -- who said what, in one cell.
        session.assessments
          .map(
            (row) =>
              `${SESSION_ASSESSOR_LABELS[row.author_role]} (${row.author_name})` +
              (row.rating ? ` ${row.rating}/5` : '') +
              (row.body ? `: ${row.body}` : ''),
          )
          .join('; '),
      ]),
    );

    return csvResponse(datedFilename('tmi-sessions'), body);
  })

  // ---------------------------------------------------------------------
  // Live sessions (Phase 7)
  // ---------------------------------------------------------------------
  // Declared before '/:id' so that "active" is matched as a literal segment
  // rather than parsed as a session id.

  /** The viewer's running lesson, plus every one of them for an admin. */
  .get('/active', async (c) => {
    const viewer = c.get('user');

    // Anyone looking at the live sessions also settles up the ones that have
    // outlived their limit, so a forgotten timer does not have to wait for the
    // next scheduled sweep while somebody has the portal open.
    await autoStopExpired(c.env.DB);

    const mine = await getActiveRow(c.env.DB, viewer.id);
    const others = isAdmin(viewer) ? await listActiveRows(c.env.DB) : [];

    const withRate = async (row: NonNullable<typeof mine>) => {
      const assignment = await getActiveAssignmentFor(
        c.env.DB,
        row.tutor_user_id,
        row.student_user_id,
      );

      const tutorRate = assignment
        ? resolveRate(
            row.mode,
            {
              in_person: assignment.rate_in_person_cents,
              virtual: assignment.rate_virtual_cents,
            },
            {
              in_person: assignment.effective_rate_in_person_cents,
              virtual: assignment.effective_rate_virtual_cents,
            },
          )
        : null;

      const studentRates = await getStudentChargeRates(c.env.DB, row.student_user_id);
      const chargeRate = studentRates ? resolveChargeRateCents(row.mode, studentRates) : null;

      return toActiveSession(row, tutorRate, chargeRate, viewer);
    };

    const body: ApiOk<{ mine: ActiveSession | null; all: ActiveSession[] }> = {
      data: {
        mine: mine ? await withRate(mine) : null,
        all: await Promise.all(others.map(withRate)),
      },
    };
    return c.json(body);
  })

  /** "When the session is to start, the tutor could click the start session
   *  button and select student." */
  .post('/active', zValidator('json', startSessionSchema), async (c) => {
    const viewer = c.get('user');
    const { student_user_id, mode } = c.req.valid('json');

    // Yesterday's forgotten lesson must not block today's: close anything past
    // its limit before deciding whether this tutor is already teaching.
    await autoStopExpired(c.env.DB);

    // The primary key would reject this anyway; catching it here says why.
    if (await getActiveRow(c.env.DB, viewer.id)) {
      throw new ApiError(
        409,
        'conflict',
        'You already have a session running. Stop it before starting another.',
      );
    }

    const assignment = await getActiveAssignmentFor(c.env.DB, viewer.id, student_user_id);

    if (!assignment) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        student_user_id: ['That student is not currently assigned to you.'],
      });
    }

    await startActive(c.env.DB, viewer.id, student_user_id, mode);

    const row = await getActiveRow(c.env.DB, viewer.id);
    const body: ApiOk<ActiveSession> = { data: toActiveSession(row!, null, null, viewer) };
    return c.json(body, 201);
  })

  /** Notes and mode can be adjusted while the lesson is still running. */
  .patch('/active', zValidator('json', updateActiveSessionSchema), async (c) => {
    const viewer = c.get('user');

    if (!(await getActiveRow(c.env.DB, viewer.id))) {
      throw ApiError.notFound('You have no session running.');
    }

    await updateActive(c.env.DB, viewer.id, c.req.valid('json'));

    const row = await getActiveRow(c.env.DB, viewer.id);
    const body: ApiOk<ActiveSession> = { data: toActiveSession(row!, null, null, viewer) };
    return c.json(body);
  })

  /**
   * Ends the lesson and writes the billing record.
   *
   * Deliberately does NOT sweep first: if this tutor's lesson has outrun its
   * limit, recording it here keeps the notes they just typed, where the sweep
   * would have closed it underneath them.
   */
  .post('/active/stop', zValidator('json', stopSessionSchema), async (c) => {
    const viewer = c.get('user');
    const row = await getActiveRow(c.env.DB, viewer.id);

    if (!row) throw ApiError.notFound('You have no session running.');

    const session = await recordRunningSession(c.env.DB, row, {
      actor: viewer,
      notes: c.req.valid('json').notes ?? row.notes,
    });

    const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, session) };
    return c.json(body, 201);
  })

  /** Abandons a running lesson without recording anything. */
  .delete('/active', async (c) => {
    if (!(await clearActive(c.env.DB, c.get('user').id))) {
      throw ApiError.notFound('You have no session running.');
    }
    return c.body(null, 204);
  })

  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const viewer = c.get('user');

    // Scoped to the ROW. This used to ask whether the viewer could see any
    // lesson of the same student, which let a tutor who had ever taught that
    // student open another tutor's lesson with them -- and read its price.
    const session = await getVisibleSession(c.env.DB, viewer, c.req.valid('param').id);
    if (!session) throw ApiError.notFound('That session does not exist.');

    const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, session) };
    return c.json(body);
  })

  /** Corrections re-derive the duration and amount from the new times. */
  .patch(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', sessionUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const viewer = c.get('user');

      // A lesson the viewer cannot see does not exist, as far as they know.
      const existing = await getVisibleSession(c.env.DB, viewer, id);
      if (!existing) throw ApiError.notFound('That session does not exist.');

      if (!isAdmin(viewer) && viewer.id !== existing.tutor_user_id) {
        throw new ApiError(403, 'forbidden', 'You can only edit your own sessions.');
      }

      await assertProgressTopics(c.env.DB, input.progress);

      const startedAt = input.started_at ?? existing.started_at;
      const endedAt = input.ended_at ?? existing.ended_at;
      const mode = input.mode ?? existing.mode;

      // Correcting the clock times is a person vouching for them, which is
      // exactly what the auto_stopped flag was asking for, so it clears.
      // Editing only the notes leaves it standing.
      const endConfirmed = startedAt !== existing.started_at || endedAt !== existing.ended_at;

      const timesChanged =
        startedAt !== existing.started_at || endedAt !== existing.ended_at || mode !== existing.mode;

      let derived: Partial<{
        duration_minutes: number;
        tutor_rate_cents: number;
        tutor_amount_cents: number;
        charge_rate_cents: number;
        charge_amount_cents: number;
        auto_stopped: boolean;
      }> = {};

      if (timesChanged) {
        const priced = await priceSession(
          c.env.DB,
          existing.tutor_user_id,
          existing.student_user_id,
          mode,
          startedAt,
          endedAt,
        );

        // Correcting the times re-derives both amounts, but the rates stay
        // frozen at what applied when the lesson was recorded -- unless the
        // mode changed, which is what decides WHICH rate applies.
        const tutorRate = mode === existing.mode ? existing.tutor_rate_cents : priced.tutorRateCents;
        const chargeRate =
          mode === existing.mode ? existing.charge_rate_cents : priced.chargeRateCents;

        derived = {
          duration_minutes: priced.durationMinutes,
          ...(endConfirmed && existing.auto_stopped ? { auto_stopped: false } : {}),
          tutor_rate_cents: tutorRate,
          charge_rate_cents: chargeRate,
          tutor_amount_cents: computeAmountCents(priced.durationMinutes, tutorRate),
          charge_amount_cents: computeAmountCents(priced.durationMinutes, chargeRate),
        };
      }

      if (input.progress) {
        await saveSessionProgress(c.env.DB, id, existing.student_user_id, input.progress);
      }
      if (input.write_up) await saveWriteUp(c.env.DB, id, input.write_up);

      let updated = await updateSessionRow(c.env.DB, id, {
        ...(input.occurred_on !== undefined ? { occurred_on: input.occurred_on } : {}),
        ...(input.started_at !== undefined ? { started_at: input.started_at } : {}),
        ...(input.ended_at !== undefined ? { ended_at: input.ended_at } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...derived,
      });

      if (!updated) throw ApiError.notFound('That session does not exist.');

      // An edit that only revises the editor's own assessment is logged as
      // that, not also as a change to the lesson.
      if (Object.keys(input).some((key) => key !== 'assessment')) {
        await recordAudit(c.env.DB, viewer, {
          action: 'session.updated',
          description: `Updated the ${updated.occurred_on} session with ${updated.student_name}`,
          subject: { id: updated.student_user_id, full_name: updated.student_name },
          entity_type: 'session',
          entity_id: updated.id,
        });
      }

      if (input.assessment !== undefined) {
        const had = existing.assessments.some((row) => row.author_user_id === viewer.id);
        // Clearing an assessment that was never given is nothing to do, not an error.
        if (input.assessment !== null || had) {
          await applyOwnAssessment(c.env.DB, viewer, updated, input.assessment);
        }
        updated = (await getSession(c.env.DB, id)) ?? updated;
      }

      const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, updated) };
      return c.json(body);
    },
  )

  // -------------------------------------------------------------------------
  // Assessments (Phase 23)
  // -------------------------------------------------------------------------
  // Anybody the lesson concerns -- its tutor, the student, their parents, the
  // office -- may say how it went, once each. Only ever the reader's own: the
  // routes take no author, so there is nothing to point at somebody else's.

  /** Gives or revises the reader's assessment. Returns the lesson with it. */
  .put(
    '/:id/assessment',
    zValidator('param', idParamSchema),
    zValidator('json', sessionAssessmentInputSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const viewer = c.get('user');

      const session = await getVisibleSession(c.env.DB, viewer, id);
      if (!session) throw ApiError.notFound('That session does not exist.');

      await applyOwnAssessment(c.env.DB, viewer, session, c.req.valid('json'));

      const updated = (await getSession(c.env.DB, id)) ?? session;
      const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, updated) };
      return c.json(body);
    },
  )

  /** Withdraws the reader's assessment. Nobody else's can be removed. */
  .delete('/:id/assessment', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const session = await getVisibleSession(c.env.DB, viewer, id);
    if (!session) throw ApiError.notFound('That session does not exist.');

    await applyOwnAssessment(c.env.DB, viewer, session, null);
    return c.body(null, 204);
  })

  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const existing = await getVisibleSession(c.env.DB, viewer, id);
    if (!existing) throw ApiError.notFound('That session does not exist.');

    if (!isAdmin(viewer) && viewer.id !== existing.tutor_user_id) {
      throw new ApiError(403, 'forbidden', 'You can only delete your own sessions.');
    }

    await deleteSession(c.env.DB, id);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.deleted',
      description: `Deleted the ${existing.occurred_on} session with ${existing.student_name}`,
      subject: { id: existing.student_user_id, full_name: existing.student_name },
      entity_type: 'session',
      entity_id: id,
    });

    return c.body(null, 204);
  });

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
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { buildCsv, csvMoney, csvResponse, datedFilename } from '../lib/csv.js';
import { ApiError } from '../lib/errors.js';
import { autoStopExpired, recordRunningSession } from '../lib/live-sessions.js';
import { priceSession } from '../lib/pricing.js';
import { familyStudentIds, isAdmin, scopeSessionMoney } from '../lib/scope.js';
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
  createSession,
  deleteSession,
  getSession,
  getVisibleSession,
  listSessions,
  updateSessionRow,
  type StoredSession,
} from '../repositories/sessions.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid session id.' }) });

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
      session = (await getSession(c.env.DB, session.id)) ?? session;
    }

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
      'Notes',
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
        session.notes ?? '',
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

      const updated = await updateSessionRow(c.env.DB, id, {
        ...(input.occurred_on !== undefined ? { occurred_on: input.occurred_on } : {}),
        ...(input.started_at !== undefined ? { started_at: input.started_at } : {}),
        ...(input.ended_at !== undefined ? { ended_at: input.ended_at } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...derived,
      });

      if (!updated) throw ApiError.notFound('That session does not exist.');

      await recordAudit(c.env.DB, viewer, {
        action: 'session.updated',
        description: `Updated the ${updated.occurred_on} session with ${updated.student_name}`,
        subject: { id: updated.student_user_id, full_name: updated.student_name },
        entity_type: 'session',
        entity_id: updated.id,
      });

      const body: ApiOk<TutoringSession> = { data: await scopeFor(c.env.DB, viewer, updated) };
      return c.json(body);
    },
  )

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

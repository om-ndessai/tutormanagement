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
  type SessionTotals,
  type TutoringSession,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { buildCsv, csvMoney, csvResponse, datedFilename } from '../lib/csv.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin, scopeSessionMoney, teachingScopeSql } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import { getStudentChargeRates } from '../repositories/users.js';
import {
  clearActive,
  getActiveRow,
  listActiveRows,
  resolveTimes,
  startActive,
  toActiveSession,
  updateActive,
} from '../repositories/active-sessions.js';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSessionRow,
} from '../repositories/sessions.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid session id.' }) });

/** A list response that also carries the totals for the same filter. */
interface SessionListBody extends ApiList<TutoringSession> {
  totals: SessionTotals;
}

/**
 * Prices a session from the pairing that authorises it.
 *
 * Both halves matter: a tutor can only bill for a student who was actually
 * assigned to them, and the rate comes from the assignment (or the tutor's
 * default) rather than from anything the client sent.
 */
async function priceSession(
  db: D1Database,
  tutorUserId: string,
  studentUserId: string,
  mode: SessionMode,
  startedAt: string,
  endedAt: string,
) {
  const assignment = await getActiveAssignmentFor(db, tutorUserId, studentUserId);

  if (!assignment) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['That student is not currently assigned to this tutor.'],
    });
  }

  const label = mode === 'virtual' ? 'virtual' : 'in-person';

  // What the tutor is paid: the pairing's override, else the tutor's default.
  const tutorRateCents = resolveRateCents(
    mode,
    { in_person: assignment.rate_in_person_cents, virtual: assignment.rate_virtual_cents },
    {
      in_person: assignment.effective_rate_in_person_cents,
      virtual: assignment.effective_rate_virtual_cents,
    },
  );

  if (tutorRateCents == null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      mode: [
        `No ${label} rate is set for this tutor. ` +
          'Set a default rate on their profile, or a rate on the assignment.',
      ],
    });
  }

  // What the family is charged. Priced on the student, so it does not depend
  // on who teaches them.
  const studentRates = await getStudentChargeRates(db, studentUserId);
  const chargeRateCents = studentRates && resolveChargeRateCents(mode, studentRates);

  if (chargeRateCents == null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      mode: [
        `No ${label} price is set for this student. ` +
          "Set it on the student's profile before recording the session.",
      ],
    });
  }

  const elapsed = elapsedMinutes(startedAt, endedAt);
  if (elapsed === null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      ended_at: ['The end time must be after the start time.'],
    });
  }

  const durationMinutes = roundToQuarterHour(elapsed);

  return {
    durationMinutes,
    tutorRateCents,
    chargeRateCents,
    tutorAmountCents: computeAmountCents(durationMinutes, tutorRateCents),
    chargeAmountCents: computeAmountCents(durationMinutes, chargeRateCents),
  };
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

    const session = await createSession(c.env.DB, {
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
      recorded_by_user_id: viewer.id,
    });

    await recordAudit(c.env.DB, viewer, {
      action: 'session.recorded',
      description:
        `Recorded a ${formatDuration(session.duration_minutes)} ` +
        `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
        `${session.student_name} on ${session.occurred_on} ` +
        `(${((session.charge_amount_cents ?? 0) / 100).toFixed(2)} USD)`,
      subject: { id: session.student_user_id, full_name: session.student_name },
      entity_type: 'session',
      entity_id: session.id,
    });

    const body: ApiOk<TutoringSession> = { data: scopeSessionMoney(session, viewer) };
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
    const { sessions } = await listSessions(c.env.DB, c.get('user'), {
      ...params,
      limit: 5000,
      offset: 0,
    });

    const body = buildCsv(
      [
        'Date',
        'Student',
        'Tutor',
        'Start',
        'End',
        'Minutes',
        'Mode',
        'Charge rate (USD/hr)',
        'Charged (USD)',
        'Tutor rate (USD/hr)',
        'Tutor pay (USD)',
        'Margin (USD)',
        'Notes',
      ],
      sessions.map((session) => [
        session.occurred_on,
        session.student_name,
        session.tutor_name,
        formatClockTime(session.started_at),
        formatClockTime(session.ended_at),
        session.duration_minutes,
        SESSION_MODE_LABELS[session.mode],
        csvMoney(session.charge_rate_cents),
        csvMoney(session.charge_amount_cents),
        csvMoney(session.tutor_rate_cents),
        csvMoney(session.tutor_amount_cents),
        csvMoney(marginCents(session)),
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
   * Both endpoints are snapped to the nearest quarter hour as they were
   * pressed, so the duration is a multiple of 15 without rounding it again.
   */
  .post('/active/stop', zValidator('json', stopSessionSchema), async (c) => {
    const viewer = c.get('user');
    const row = await getActiveRow(c.env.DB, viewer.id);

    if (!row) throw ApiError.notFound('You have no session running.');

    const times = resolveTimes(row.started_at);
    const notes = c.req.valid('json').notes ?? row.notes;

    const priced = await priceSession(
      c.env.DB,
      row.tutor_user_id,
      row.student_user_id,
      row.mode,
      times.started_at,
      times.ended_at,
    );

    const session = await createSession(c.env.DB, {
      tutor_user_id: row.tutor_user_id,
      student_user_id: row.student_user_id,
      occurred_on: times.occurred_on,
      started_at: times.started_at,
      ended_at: times.ended_at,
      // Trust the endpoint rounding over re-rounding the elapsed time: the two
      // agree except at the boundaries, and the plan specifies the endpoints.
      duration_minutes: times.duration_minutes,
      mode: row.mode,
      tutor_rate_cents: priced.tutorRateCents,
      tutor_amount_cents: computeAmountCents(times.duration_minutes, priced.tutorRateCents),
      charge_rate_cents: priced.chargeRateCents,
      charge_amount_cents: computeAmountCents(times.duration_minutes, priced.chargeRateCents),
      notes,
      recorded_by_user_id: viewer.id,
    });

    await clearActive(c.env.DB, viewer.id);

    await recordAudit(c.env.DB, viewer, {
      action: 'session.recorded',
      description:
        `Recorded a ${formatDuration(session.duration_minutes)} ` +
        `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
        `${session.student_name} on ${session.occurred_on} ` +
        `(${((session.charge_amount_cents ?? 0) / 100).toFixed(2)} USD)`,
      subject: { id: session.student_user_id, full_name: session.student_name },
      entity_type: 'session',
      entity_id: session.id,
    });

    const body: ApiOk<TutoringSession> = { data: scopeSessionMoney(session, viewer) };
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
    const session = await getSession(c.env.DB, c.req.valid('param').id);
    if (!session) throw ApiError.notFound('That session does not exist.');

    const viewer = c.get('user');
    const scope = teachingScopeSql(viewer, 's');

    if (scope) {
      const allowed =
        session.tutor_user_id === viewer.id ||
        (
          await listSessions(c.env.DB, viewer, {
            student_user_id: session.student_user_id,
            limit: 1,
            offset: 0,
          })
        ).totals.session_count > 0;

      if (!allowed) throw ApiError.notFound('That session does not exist.');
    }

    const body: ApiOk<TutoringSession> = { data: scopeSessionMoney(session, viewer) };
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

      const existing = await getSession(c.env.DB, id);
      if (!existing) throw ApiError.notFound('That session does not exist.');

      if (!isAdmin(viewer) && viewer.id !== existing.tutor_user_id) {
        throw new ApiError(403, 'forbidden', 'You can only edit your own sessions.');
      }

      const startedAt = input.started_at ?? existing.started_at;
      const endedAt = input.ended_at ?? existing.ended_at;
      const mode = input.mode ?? existing.mode;

      const timesChanged =
        startedAt !== existing.started_at || endedAt !== existing.ended_at || mode !== existing.mode;

      let derived: Partial<{
        duration_minutes: number;
        tutor_rate_cents: number;
        tutor_amount_cents: number;
        charge_rate_cents: number;
        charge_amount_cents: number;
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
          tutor_rate_cents: tutorRate,
          charge_rate_cents: chargeRate,
          tutor_amount_cents: computeAmountCents(priced.durationMinutes, tutorRate),
          charge_amount_cents: computeAmountCents(priced.durationMinutes, chargeRate),
        };
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

      const body: ApiOk<TutoringSession> = { data: scopeSessionMoney(updated, viewer) };
      return c.json(body);
    },
  )

  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const existing = await getSession(c.env.DB, id);
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

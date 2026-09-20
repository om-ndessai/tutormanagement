import { Hono } from 'hono';
import { z } from 'zod';
import {
  computeAmountCents,
  elapsedMinutes,
  formatDuration,
  listSessionsQuerySchema,
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
import { ApiError } from '../lib/errors.js';
import { isAdmin, teachingScopeSql } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
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

  const rateCents = resolveRateCents(
    mode,
    { in_person: assignment.rate_in_person_cents, virtual: assignment.rate_virtual_cents },
    {
      in_person: assignment.effective_rate_in_person_cents,
      virtual: assignment.effective_rate_virtual_cents,
    },
  );

  if (rateCents == null) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      mode: [
        `No ${mode === 'virtual' ? 'virtual' : 'in-person'} rate is set for this tutor. ` +
          'Set a default rate on their profile, or a rate on the assignment.',
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
    rateCents,
    amountCents: computeAmountCents(durationMinutes, rateCents),
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
      rate_cents: priced.rateCents,
      amount_cents: priced.amountCents,
      notes: input.notes,
      recorded_by_user_id: viewer.id,
    });

    await recordAudit(c.env.DB, viewer, {
      action: 'session.recorded',
      description:
        `Recorded a ${formatDuration(session.duration_minutes)} ` +
        `${session.mode === 'virtual' ? 'virtual' : 'in-person'} session with ` +
        `${session.student_name} on ${session.occurred_on} ` +
        `(${(session.amount_cents / 100).toFixed(2)} USD)`,
      subject: { id: session.student_user_id, full_name: session.student_name },
      entity_type: 'session',
      entity_id: session.id,
    });

    const body: ApiOk<TutoringSession> = { data: session };
    return c.json(body, 201);
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

    const body: ApiOk<TutoringSession> = { data: session };
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

      let derived: Partial<{ duration_minutes: number; amount_cents: number; rate_cents: number }> =
        {};

      if (timesChanged) {
        const priced = await priceSession(
          c.env.DB,
          existing.tutor_user_id,
          existing.student_user_id,
          mode,
          startedAt,
          endedAt,
        );
        derived = {
          duration_minutes: priced.durationMinutes,
          amount_cents: priced.amountCents,
          // Changing between in-person and virtual changes which rate applies.
          rate_cents: mode === existing.mode ? existing.rate_cents : priced.rateCents,
        };

        if (mode === existing.mode) {
          derived.amount_cents = computeAmountCents(priced.durationMinutes, existing.rate_cents);
        }
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

      const body: ApiOk<TutoringSession> = { data: updated };
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

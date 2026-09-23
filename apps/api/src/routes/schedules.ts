import { Hono } from 'hono';
import { z } from 'zod';
import {
  describeSchedule,
  listSchedulesQuerySchema,
  scheduleInputSchema,
  scheduleUpdateSchema,
  type ApiOk,
  type ScheduledSession,
  type User,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { buildCalendar, calendarFilename } from '../lib/ics.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
} from '../repositories/schedules.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid schedule id.' }) });

/** Serves an .ics as a download rather than something the browser renders. */
function calendarResponse(schedules: ScheduledSession[]) {
  return new Response(buildCalendar(schedules), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${calendarFilename(schedules)}"`,
      // A calendar file is a point-in-time export; caching it would hand back
      // a stale schedule after an edit.
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Re-runs the scoped list for this pairing rather than trusting the id, so a
 * schedule the viewer could not list is reported as missing -- by the
 * calendar download and by an edit alike. A 403 would confirm it exists.
 */
async function canSeeSchedule(
  db: D1Database,
  viewer: User,
  schedule: { id: string; student_user_id: string },
): Promise<boolean> {
  const visible = await listSchedules(db, viewer, {
    include_inactive: true,
    student_user_id: schedule.student_user_id,
  });
  return visible.some((candidate) => candidate.id === schedule.id);
}

export const schedulesRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listSchedulesQuerySchema), async (c) => {
    const schedules = await listSchedules(c.env.DB, c.get('user'), c.req.valid('query'));

    const body: ApiOk<ScheduledSession[]> = { data: schedules };
    return c.json(body);
  })

  /**
   * "All applicable users (parents, tutors, admins, students) should be able
   * to download the calendar invite." Everything the viewer can see, in one
   * file -- scoped by the same rule as the list.
   */
  .get('/calendar.ics', zValidator('query', listSchedulesQuerySchema), async (c) => {
    const schedules = await listSchedules(c.env.DB, c.get('user'), c.req.valid('query'));
    return calendarResponse(schedules);
  })

  .get('/:id/calendar.ics', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const schedule = await getSchedule(c.env.DB, id);

    if (!schedule) throw ApiError.notFound('That schedule does not exist.');

    if (!(await canSeeSchedule(c.env.DB, c.get('user'), schedule))) {
      throw ApiError.notFound('That schedule does not exist.');
    }

    return calendarResponse([schedule]);
  })

  /** "A tutor should be able to schedule a recurring tutoring session for his/her students." */
  .post('/', zValidator('json', scheduleInputSchema), async (c) => {
    const input = c.req.valid('json');
    const viewer = c.get('user');

    if (!isAdmin(viewer) && viewer.id !== input.tutor_user_id) {
      throw new ApiError(403, 'forbidden', 'You can only schedule your own sessions.');
    }

    // The same rule as recording a session: only for a student given to you.
    const assignment = await getActiveAssignmentFor(
      c.env.DB,
      input.tutor_user_id,
      input.student_user_id,
    );

    if (!assignment) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        student_user_id: ['That student is not currently assigned to this tutor.'],
      });
    }

    const schedule = await createSchedule(c.env.DB, input);

    await recordAudit(c.env.DB, viewer, {
      action: 'schedule.created',
      description: `Scheduled ${schedule.student_name}: ${describeSchedule(schedule)}`,
      subject: { id: schedule.student_user_id, full_name: schedule.student_name },
      entity_type: 'schedule',
      entity_id: schedule.id,
    });

    const body: ApiOk<ScheduledSession> = { data: schedule };
    return c.json(body, 201);
  })

  .patch(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', scheduleUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const viewer = c.get('user');

      const existing = await getSchedule(c.env.DB, id);
      if (!existing || !(await canSeeSchedule(c.env.DB, viewer, existing))) {
        throw ApiError.notFound('That schedule does not exist.');
      }

      if (!isAdmin(viewer) && viewer.id !== existing.tutor_user_id) {
        throw new ApiError(403, 'forbidden', 'You can only change your own schedules.');
      }

      const updated = await updateSchedule(c.env.DB, id, c.req.valid('json'));
      if (!updated) throw ApiError.notFound('That schedule does not exist.');

      await recordAudit(c.env.DB, viewer, {
        action: 'schedule.updated',
        description: `Updated ${updated.student_name}'s schedule: ${describeSchedule(updated)}`,
        subject: { id: updated.student_user_id, full_name: updated.student_name },
        entity_type: 'schedule',
        entity_id: id,
      });

      const body: ApiOk<ScheduledSession> = { data: updated };
      return c.json(body);
    },
  )

  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    const existing = await getSchedule(c.env.DB, id);
    if (!existing || !(await canSeeSchedule(c.env.DB, viewer, existing))) {
      throw ApiError.notFound('That schedule does not exist.');
    }

    if (!isAdmin(viewer) && viewer.id !== existing.tutor_user_id) {
      throw new ApiError(403, 'forbidden', 'You can only remove your own schedules.');
    }

    await deleteSchedule(c.env.DB, id);

    await recordAudit(c.env.DB, viewer, {
      action: 'schedule.removed',
      description: `Removed ${existing.student_name}'s ${describeSchedule(existing)} slot`,
      subject: { id: existing.student_user_id, full_name: existing.student_name },
      entity_type: 'schedule',
      entity_id: id,
    });

    return c.body(null, 204);
  });

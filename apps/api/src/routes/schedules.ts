import { Hono } from 'hono';
import { z } from 'zod';
import {
  SCHEDULE_CANCELLER_LABELS,
  cancellationKey,
  describeSchedule,
  expandUpcoming,
  isOccurrenceOf,
  listScheduleCancellationsQuerySchema,
  listSchedulesQuerySchema,
  mayCancelOn,
  mayRestoreCancellation,
  scheduleCancellationInputSchema,
  upcomingSessionsQuerySchema,
  upcomingTakenKey,
  zonedClockParts,
  scheduleInputSchema,
  scheduleUpdateSchema,
  type ApiOk,
  type ScheduleCancellation,
  type ScheduledSession,
  type UpcomingCancellation,
  type UpcomingSessionsResponse,
  type User,
  type VisibleSchedule,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { buildCalendar, calendarFilename } from '../lib/ics.js';
import { familyStudentIds, isAdmin, scheduleCancellerRole } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { getActiveAssignmentFor } from '../repositories/assignments.js';
import { listSessions } from '../repositories/sessions.js';
import {
  deleteCancellation,
  getCancellation,
  hasLessonOn,
  insertCancellation,
  listCancellationsForSchedules,
  listCancelledDates,
  listScheduleCancellations,
  type StoredCancellation,
} from '../repositories/schedule-cancellations.js';
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
} from '../repositories/schedules.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid schedule id.' }) });

const occurrenceParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid schedule id.' }),
  occurs_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-09-20.'),
});

/** Today's date on the institute's clock -- the one lessons are dated by. */
function instituteToday(): string {
  return zonedClockParts(new Date().toISOString()).day;
}

/** Each cancellation, with whether THIS reader may put the lesson back. */
function withRestoreRights(
  rows: StoredCancellation[],
  viewer: User,
  family: ReadonlySet<string>,
  today: string,
): ScheduleCancellation[] {
  return rows.map((row) => ({
    ...row,
    can_restore: mayRestoreCancellation(
      scheduleCancellerRole(row, viewer, family),
      isAdmin(viewer),
      viewer.id,
      row,
      today,
    ),
  }));
}

/**
 * Serves an .ics as a download rather than something the browser renders,
 * leaving out every lesson that has been called off.
 */
async function calendarResponse(db: D1Database, schedules: ScheduledSession[]) {
  const cancelled = new Map<string, string[]>();
  for (const row of await listCancellationsForSchedules(db, schedules.map((s) => s.id))) {
    cancelled.set(row.schedule_id, [...(cancelled.get(row.schedule_id) ?? []), row.occurs_on]);
  }

  return new Response(buildCalendar(schedules, cancelled), {
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

  /**
   * The schedules the reader may list, each saying what capacity they could
   * cancel its lessons in -- null for a student -- so the page offers exactly
   * what the cancel route would allow.
   */
  .get('/', zValidator('query', listSchedulesQuerySchema), async (c) => {
    const viewer = c.get('user');
    const schedules = await listSchedules(c.env.DB, viewer, c.req.valid('query'));
    const family = await familyStudentIds(c.env.DB, viewer);

    const body: ApiOk<VisibleSchedule[]> = {
      data: schedules.map((schedule) => ({
        ...schedule,
        cancel_as: scheduleCancellerRole(schedule, viewer, family),
      })),
    };
    return c.json(body);
  })

  /**
   * The next lessons the viewer's schedules produce, dated (Phase 21), for the
   * dashboard's sessions carousel. Scoped by the same rule as the list, and
   * narrowed to one tutor's teaching when a tutor dashboard asks -- an admin
   * viewing a tutor's dashboard passes that tutor, and sees what they would.
   *
   * A lesson already recorded for that pair on that day is left out, so a
   * finished lesson moves from "upcoming" to "past" rather than showing twice.
   * A cancelled one (Phase 24) stays in, flagged, with whether this reader may
   * restore it -- every future cancellation of the listed schedules is read,
   * so one on a later page is flagged too.
   */
  .get('/upcoming', zValidator('query', upcomingSessionsQuerySchema), async (c) => {
    const { offset, limit, tutor_user_id, schedule_id } = c.req.valid('query');
    const viewer = c.get('user');
    const now = new Date().toISOString();
    const today = zonedClockParts(now).day;

    const listed = await listSchedules(c.env.DB, viewer, {
      include_inactive: false,
      tutor_user_id,
    });
    // Narrowed after scoping, so an id the reader cannot list yields nothing.
    const schedules = schedule_id ? listed.filter((s) => s.id === schedule_id) : listed;
    const recorded = await listSessions(c.env.DB, viewer, {
      from: today,
      tutor_user_id,
      limit: 200,
      offset: 0,
    } as never);
    const taken = new Set(
      recorded.sessions.map((s) => upcomingTakenKey(s.tutor_user_id, s.student_user_id, s.occurred_on)),
    );

    const family = await familyStudentIds(c.env.DB, viewer);
    const cancelled = new Map<string, UpcomingCancellation>(
      withRestoreRights(
        await listCancellationsForSchedules(c.env.DB, schedules.map((s) => s.id), { from: today }),
        viewer,
        family,
        today,
      ).map((row) => [
        cancellationKey(row.schedule_id, row.occurs_on),
        {
          note: row.note,
          cancelled_by_user_id: row.cancelled_by_user_id,
          cancelled_by_name: row.cancelled_by_name,
          cancelled_as: row.cancelled_as,
          created_at: row.created_at,
          can_restore: row.can_restore,
        },
      ]),
    );

    const { items, has_more } = expandUpcoming(schedules, now, { offset, limit, taken, cancelled });

    const body: UpcomingSessionsResponse = { data: items, meta: { offset, limit, has_more } };
    return c.json(body);
  })

  /**
   * "All applicable users (parents, tutors, admins, students) should be able
   * to download the calendar invite." Everything the viewer can see, in one
   * file -- scoped by the same rule as the list.
   */
  .get('/calendar.ics', zValidator('query', listSchedulesQuerySchema), async (c) => {
    const schedules = await listSchedules(c.env.DB, c.get('user'), c.req.valid('query'));
    return calendarResponse(c.env.DB, schedules);
  })

  /**
   * Called-off lessons the reader may list (Phase 24), soonest first: those of
   * schedules they can see, and no others. For the sessions page's panel and
   * the Schedule page's earlier dates.
   */
  .get('/cancellations', zValidator('query', listScheduleCancellationsQuerySchema), async (c) => {
    const viewer = c.get('user');
    const rows = await listScheduleCancellations(c.env.DB, viewer, c.req.valid('query'));
    const family = await familyStudentIds(c.env.DB, viewer);

    const body: ApiOk<ScheduleCancellation[]> = {
      data: withRestoreRights(rows, viewer, family, instituteToday()),
    };
    return c.json(body);
  })

  .get('/:id/calendar.ics', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const schedule = await getSchedule(c.env.DB, id);

    if (!schedule) throw ApiError.notFound('That schedule does not exist.');

    if (!(await canSeeSchedule(c.env.DB, c.get('user'), schedule))) {
      throw ApiError.notFound('That schedule does not exist.');
    }

    return calendarResponse(c.env.DB, [schedule]);
  })

  // -------------------------------------------------------------------------
  // Cancelling one lesson of a series (Phase 24)
  // -------------------------------------------------------------------------
  // A fact about one date, never an edit to the schedule: every other week is
  // untouched. Who may, and in what capacity, is decided here from how the
  // reader relates to the schedule -- never sent.

  /**
   * Calls off one lesson. The tutor, a parent of the student, or the office;
   * a parent only for today or later. Refused for a date the series does not
   * fall on, or one a lesson was already recorded for.
   */
  .post(
    '/:id/cancellations',
    zValidator('param', idParamSchema),
    zValidator('json', scheduleCancellationInputSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { occurs_on, note } = c.req.valid('json');
      const viewer = c.get('user');

      const schedule = await getSchedule(c.env.DB, id);
      if (!schedule || !(await canSeeSchedule(c.env.DB, viewer, schedule))) {
        throw ApiError.notFound('That schedule does not exist.');
      }

      const family = await familyStudentIds(c.env.DB, viewer);
      const role = scheduleCancellerRole(schedule, viewer, family);
      if (!role) {
        throw new ApiError(403, 'forbidden', 'Only the tutor, a parent or the office can cancel a lesson.');
      }

      const today = instituteToday();
      const invalid = (message: string) =>
        ApiError.validation('Please correct the highlighted fields.', { occurs_on: [message] });

      if (!schedule.is_active) {
        throw invalid('This schedule is paused, so it has no lessons to cancel.');
      }
      if (!isOccurrenceOf(schedule, occurs_on)) {
        throw invalid(
          `There is no lesson that day: this schedule runs ${describeSchedule(schedule)}, ` +
            `from ${schedule.starts_on}${schedule.ends_on ? ` to ${schedule.ends_on}` : ''}.`,
        );
      }
      if (!mayCancelOn(role, isAdmin(viewer), occurs_on, today)) {
        throw invalid('That lesson has passed. Only the tutor or the office can mark it cancelled.');
      }
      if (await hasLessonOn(c.env.DB, schedule.tutor_user_id, schedule.student_user_id, occurs_on)) {
        throw invalid('A lesson was already recorded on that date.');
      }

      const inserted = await insertCancellation(c.env.DB, {
        schedule_id: id,
        occurs_on,
        note,
        cancelled_by_user_id: viewer.id,
        cancelled_as: role,
      });
      if (!inserted) throw new ApiError(409, 'conflict', 'That lesson is already cancelled.');

      await recordAudit(c.env.DB, viewer, {
        action: 'schedule.occurrence_cancelled',
        // The date and the people, never the note: the log is read by admins
        // and the student, and the note is addressed to the schedule's audience.
        description:
          `Cancelled the ${occurs_on} lesson for ${schedule.student_name} with ` +
          `${schedule.tutor_name}, as ${SCHEDULE_CANCELLER_LABELS[role]}`,
        subject: { id: schedule.student_user_id, full_name: schedule.student_name },
        entity_type: 'schedule',
        entity_id: id,
      });

      const created = await getCancellation(c.env.DB, id, occurs_on);
      const body: ApiOk<ScheduleCancellation> = {
        data: withRestoreRights([created!], viewer, family, today)[0]!,
      };
      return c.json(body, 201);
    },
  )

  /**
   * Restores a cancelled lesson: the date is back in the series. The tutor,
   * the office, or whoever cancelled it -- a parent only while it is ahead.
   */
  .delete(
    '/:id/cancellations/:occurs_on',
    zValidator('param', occurrenceParamSchema),
    async (c) => {
      const { id, occurs_on } = c.req.valid('param');
      const viewer = c.get('user');

      const schedule = await getSchedule(c.env.DB, id);
      if (!schedule || !(await canSeeSchedule(c.env.DB, viewer, schedule))) {
        throw ApiError.notFound('That schedule does not exist.');
      }

      const cancellation = await getCancellation(c.env.DB, id, occurs_on);
      if (!cancellation) throw ApiError.notFound('That lesson is not cancelled.');

      const family = await familyStudentIds(c.env.DB, viewer);
      const role = scheduleCancellerRole(schedule, viewer, family);
      const today = instituteToday();

      if (!mayRestoreCancellation(role, isAdmin(viewer), viewer.id, cancellation, today)) {
        throw new ApiError(
          403,
          'forbidden',
          role === 'parent' && cancellation.cancelled_by_user_id === viewer.id
            ? 'That lesson has passed, so only the tutor or the office can restore it.'
            : 'Only the tutor, the office or whoever cancelled it can restore this lesson.',
        );
      }

      await deleteCancellation(c.env.DB, id, occurs_on);

      await recordAudit(c.env.DB, viewer, {
        action: 'schedule.occurrence_restored',
        description:
          `Restored the ${occurs_on} lesson for ${schedule.student_name} with ${schedule.tutor_name}`,
        subject: { id: schedule.student_user_id, full_name: schedule.student_name },
        entity_type: 'schedule',
        entity_id: id,
      });

      return c.body(null, 204);
    },
  )

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

      const input = c.req.valid('json');
      const next = { ...existing, ...input };

      // Checked against whichever date is not changing, since a PATCH may send
      // only one of them -- the database would refuse it with a 500 instead.
      if (next.ends_on && next.ends_on < next.starts_on) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          ends_on: ['The end date cannot be before the start date.'],
        });
      }

      // A move to another weekday, or new dates, can leave cancelled lessons on
      // days the series no longer falls on. The future ones are cleared with
      // the edit; past ones stay, as the record of what happened.
      let orphaned: string[] = [];
      if ('day_of_week' in input || 'starts_on' in input || 'ends_on' in input) {
        orphaned = (await listCancelledDates(c.env.DB, id, instituteToday())).filter(
          (date) => !isOccurrenceOf(next, date),
        );
      }

      const updated = await updateSchedule(c.env.DB, id, input, { clearCancellations: orphaned });
      if (!updated) throw ApiError.notFound('That schedule does not exist.');

      await recordAudit(c.env.DB, viewer, {
        action: 'schedule.updated',
        description:
          `Updated ${updated.student_name}'s schedule: ${describeSchedule(updated)}` +
          (orphaned.length > 0
            ? `; cleared ${orphaned.length} cancelled ${orphaned.length === 1 ? 'date' : 'dates'} it no longer falls on`
            : ''),
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

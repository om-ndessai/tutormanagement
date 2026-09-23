import { Hono } from 'hono';
import { z } from 'zod';
import {
  assignmentInputSchema,
  assignmentUpdateSchema,
  listAssignmentsQuerySchema,
  type ApiOk,
  type Assignment,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin, scopeAssignmentRates } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
  deleteAssignment,
  getAssignment,
  listAssignments,
  updateAssignment,
  upsertAssignment,
} from '../repositories/assignments.js';
import { getLiveUserById } from '../repositories/users.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid assignment id.' }) });

/**
 * An assignment is only meaningful between someone who teaches and someone who
 * is taught, so the roles are checked rather than assumed. Catching it here
 * gives a field-level message instead of a foreign-key error.
 */
async function assertRoles(db: D1Database, tutorId: string, studentId: string) {
  const [tutor, student] = await Promise.all([
    getLiveUserById(db, tutorId),
    getLiveUserById(db, studentId),
  ]);

  const details: Record<string, string[]> = {};

  if (!tutor) details.tutor_user_id = ['That tutor no longer exists.'];
  else if (!tutor.roles.includes('tutor')) {
    details.tutor_user_id = [`${tutor.full_name} does not have the Tutor role.`];
  }

  if (!student) details.student_user_id = ['That student no longer exists.'];
  else if (!student.roles.includes('student')) {
    details.student_user_id = [`${student.full_name} does not have the Student role.`];
  }

  if (Object.keys(details).length > 0) {
    throw ApiError.validation('Please correct the highlighted fields.', details);
  }
}

export const assignmentsRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listAssignmentsQuerySchema), async (c) => {
    const viewer = c.get('user');
    const assignments = await listAssignments(c.env.DB, viewer, c.req.valid('query'));

    // The rates are the tutor's pay: theirs and the office's to see.
    const body: ApiOk<Assignment[]> = {
      data: assignments.map((row) => scopeAssignmentRates(row, viewer)),
    };
    return c.json(body);
  })

  /** Admin only: "And admin can assign student to tutors." */
  .post('/', requireAdmin, zValidator('json', assignmentInputSchema), async (c) => {
    const input = c.req.valid('json');

    if (input.tutor_user_id === input.student_user_id) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        student_user_id: ['Somebody cannot be assigned to themselves.'],
      });
    }

    await assertRoles(c.env.DB, input.tutor_user_id, input.student_user_id);

    const assignment = await upsertAssignment(c.env.DB, input);

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'assignment.created',
      description: `Assigned ${assignment.student_name} to ${assignment.tutor_name}`,
      subject: { id: assignment.student_user_id, full_name: assignment.student_name },
      entity_type: 'assignment',
      entity_id: assignment.id,
    });

    const body: ApiOk<Assignment> = { data: assignment };
    return c.json(body, 201);
  })

  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const assignment = await getAssignment(c.env.DB, c.req.valid('param').id);
    if (!assignment) throw ApiError.notFound('That assignment does not exist.');

    // Re-run the list scope for this one row rather than trusting the id.
    const viewer = c.get('user');
    if (!isAdmin(viewer)) {
      const visible = await listAssignments(c.env.DB, viewer, {
        include_inactive: true,
        tutor_user_id: assignment.tutor_user_id,
        student_user_id: assignment.student_user_id,
      });
      if (visible.length === 0) throw ApiError.notFound('That assignment does not exist.');
    }

    const body: ApiOk<Assignment> = { data: scopeAssignmentRates(assignment, viewer) };
    return c.json(body);
  })

  .patch(
    '/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', assignmentUpdateSchema),
    async (c) => {
      const updated = await updateAssignment(c.env.DB, c.req.valid('param').id, c.req.valid('json'));
      if (!updated) throw ApiError.notFound('That assignment does not exist.');

      await recordAudit(c.env.DB, c.get('user'), {
        action: 'assignment.updated',
        description: `Updated the assignment of ${updated.student_name} to ${updated.tutor_name}`,
        subject: { id: updated.student_user_id, full_name: updated.student_name },
        entity_type: 'assignment',
        entity_id: updated.id,
      });

      const body: ApiOk<Assignment> = { data: updated };
      return c.json(body);
    },
  )

  /**
   * Removes the pairing outright. Sessions already taught are NOT deleted: they
   * do not reference this row, precisely so billing history survives.
   */
  .delete('/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    // Read it before it goes, so the log can name both people.
    const doomed = await getAssignment(c.env.DB, id);

    if (!(await deleteAssignment(c.env.DB, id))) {
      throw ApiError.notFound('That assignment does not exist.');
    }

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'assignment.removed',
      description: doomed
        ? `Removed ${doomed.student_name} from ${doomed.tutor_name}`
        : 'Removed an assignment',
      ...(doomed
        ? { subject: { id: doomed.student_user_id, full_name: doomed.student_name } }
        : {}),
      entity_type: 'assignment',
      entity_id: id,
    });

    return c.body(null, 204);
  });


import { Hono } from 'hono';
import { z } from 'zod';
import {
  assessmentInputSchema,
  assessmentUpdateSchema,
  planInputSchema,
  planUpdateSchema,
  PLAN_STATUS_LABELS,
  type ApiOk,
  type Assessment,
  type CurriculumLevel,
  type LearningPlan,
  type ProgressOverview,
  type StudentProgress,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { getLiveUserById } from '../repositories/users.js';
import {
  buildStudentProgress,
  canViewStudentProgress,
  createAssessment,
  createPlan,
  deleteAssessment,
  deletePlan,
  findUnknownCurriculumIds,
  getActivePlanId,
  getAssessment,
  getPlan,
  listCurriculum,
  listProgressOverview,
  updateAssessment,
  updatePlan,
} from '../repositories/progress.js';

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid id.' }) });
const studentParamSchema = z.object({ studentId: z.uuid({ message: 'Not a valid student id.' }) });

/**
 * The curriculum is reference data every signed-in person may read: a parent
 * reading their child's plan needs to know what "BA3.10" is.
 */
export const curriculumRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const body: ApiOk<CurriculumLevel[]> = { data: await listCurriculum(c.env.DB) };
  return c.json(body);
});

/** The person being assessed must be a live student. */
async function requireStudent(db: D1Database, studentId: string) {
  const student = await getLiveUserById(db, studentId);

  if (!student || !student.roles.includes('student')) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['Choose a student.'],
    });
  }

  return student;
}

/** Level and topic ids must name catalog rows; says which ones do not. */
async function assertCatalogIds(
  db: D1Database,
  fields: { field: string; table: 'curriculum_levels' | 'curriculum_topics'; ids: string[] }[],
) {
  const details: Record<string, string[]> = {};

  for (const { field, table, ids } of fields) {
    const unknown = await findUnknownCurriculumIds(db, table, ids);
    if (unknown.length > 0) {
      details[field] = [`Not in the curriculum: ${unknown.join(', ')}.`];
    }
  }

  if (Object.keys(details).length > 0) {
    throw ApiError.validation('Please correct the highlighted fields.', details);
  }
}

/**
 * Assessments and plans are recorded by the office -- "the owner assesses the
 * student" -- so every write here is admin only. Tutors score progress
 * through the lessons they record; see the sessions routes.
 */
export const progressRoutes = new Hono<AppEnv>()

  /** Every student the viewer may follow, with where each one stands. */
  .get('/', async (c) => {
    const body: ApiOk<ProgressOverview[]> = {
      data: await listProgressOverview(c.env.DB, c.get('user')),
    };
    return c.json(body);
  })

  // --- assessments ---------------------------------------------------------
  // Declared before '/:studentId' so the literal segment wins.

  .post('/assessments', requireAdmin, zValidator('json', assessmentInputSchema), async (c) => {
    const input = c.req.valid('json');
    const student = await requireStudent(c.env.DB, input.student_user_id);

    await assertCatalogIds(c.env.DB, [
      {
        field: 'recommended_level_id',
        table: 'curriculum_levels',
        ids: input.recommended_level_id ? [input.recommended_level_id] : [],
      },
      { field: 'ratings', table: 'curriculum_topics', ids: input.ratings.map((r) => r.topic_id) },
    ]);

    const viewer = c.get('user');
    const assessment = await createAssessment(c.env.DB, input, viewer.id);

    await recordAudit(c.env.DB, viewer, {
      action: 'assessment.recorded',
      description:
        `Recorded an assessment of ${student.full_name} dated ${assessment.assessed_on}` +
        (assessment.ratings.length > 0 ? `, rating ${assessment.ratings.length} topics` : ''),
      subject: student,
      entity_type: 'assessment',
      entity_id: assessment.id,
    });

    const body: ApiOk<Assessment> = { data: assessment };
    return c.json(body, 201);
  })

  .patch(
    '/assessments/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', assessmentUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      if (!(await getAssessment(c.env.DB, id))) {
        throw ApiError.notFound('That assessment does not exist.');
      }

      await assertCatalogIds(c.env.DB, [
        {
          field: 'recommended_level_id',
          table: 'curriculum_levels',
          ids: input.recommended_level_id ? [input.recommended_level_id] : [],
        },
        {
          field: 'ratings',
          table: 'curriculum_topics',
          ids: (input.ratings ?? []).map((r) => r.topic_id),
        },
      ]);

      const updated = await updateAssessment(c.env.DB, id, input);
      if (!updated) throw ApiError.notFound('That assessment does not exist.');

      await recordAudit(c.env.DB, c.get('user'), {
        action: 'assessment.updated',
        description: `Updated the ${updated.assessed_on} assessment of ${updated.student_name}`,
        subject: { id: updated.student_user_id, full_name: updated.student_name },
        entity_type: 'assessment',
        entity_id: updated.id,
      });

      const body: ApiOk<Assessment> = { data: updated };
      return c.json(body);
    },
  )

  .delete('/assessments/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const doomed = await getAssessment(c.env.DB, id);

    if (!doomed || !(await deleteAssessment(c.env.DB, id))) {
      throw ApiError.notFound('That assessment does not exist.');
    }

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'assessment.deleted',
      description: `Deleted the ${doomed.assessed_on} assessment of ${doomed.student_name}`,
      subject: { id: doomed.student_user_id, full_name: doomed.student_name },
      entity_type: 'assessment',
      entity_id: id,
    });

    return c.body(null, 204);
  })

  // --- plans ---------------------------------------------------------------

  .post('/plans', requireAdmin, zValidator('json', planInputSchema), async (c) => {
    const input = c.req.valid('json');
    const student = await requireStudent(c.env.DB, input.student_user_id);

    // One active plan per student, which is what makes "the plan" a lesson is
    // scored against unambiguous. The index would refuse it; this says why.
    if (await getActivePlanId(c.env.DB, student.id)) {
      throw ApiError.conflict(
        `${student.full_name} already has an active plan. Mark it achieved or closed first.`,
      );
    }

    if (input.assessment_id) {
      const assessment = await getAssessment(c.env.DB, input.assessment_id);
      if (!assessment || assessment.student_user_id !== student.id) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          assessment_id: ['That assessment is not one of this student’s.'],
        });
      }
    }

    await assertCatalogIds(c.env.DB, [
      {
        field: 'target_level_id',
        table: 'curriculum_levels',
        ids: input.target_level_id ? [input.target_level_id] : [],
      },
      { field: 'topic_ids', table: 'curriculum_topics', ids: input.topic_ids },
    ]);

    const viewer = c.get('user');
    const plan = await createPlan(c.env.DB, input, viewer.id);

    await recordAudit(c.env.DB, viewer, {
      action: 'plan.created',
      description:
        `Set a learning plan for ${student.full_name}: "${plan.goal}" by ${plan.target_on}` +
        ` (${plan.topic_ids.length} topics)`,
      subject: student,
      entity_type: 'learning_plan',
      entity_id: plan.id,
    });

    const body: ApiOk<LearningPlan> = { data: plan };
    return c.json(body, 201);
  })

  .patch(
    '/plans/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', planUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      const existing = await getPlan(c.env.DB, id);
      if (!existing) throw ApiError.notFound('That plan does not exist.');

      // The two dates can arrive separately; the order is checked on the pair
      // as it will be stored.
      const startsOn = input.starts_on ?? existing.starts_on;
      const targetOn = input.target_on ?? existing.target_on;
      if (targetOn <= startsOn) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          target_on: ['The goal date must be after tutoring starts.'],
        });
      }

      if (input.status === 'active' && existing.status !== 'active') {
        const active = await getActivePlanId(c.env.DB, existing.student_user_id);
        if (active && active !== id) {
          throw ApiError.conflict('This student already has another active plan.');
        }
      }

      if (input.assessment_id) {
        const assessment = await getAssessment(c.env.DB, input.assessment_id);
        if (!assessment || assessment.student_user_id !== existing.student_user_id) {
          throw ApiError.validation('Please correct the highlighted fields.', {
            assessment_id: ['That assessment is not one of this student’s.'],
          });
        }
      }

      await assertCatalogIds(c.env.DB, [
        {
          field: 'target_level_id',
          table: 'curriculum_levels',
          ids: input.target_level_id ? [input.target_level_id] : [],
        },
        { field: 'topic_ids', table: 'curriculum_topics', ids: input.topic_ids ?? [] },
      ]);

      const updated = await updatePlan(c.env.DB, id, input);
      if (!updated) throw ApiError.notFound('That plan does not exist.');

      const student = await getLiveUserById(c.env.DB, updated.student_user_id);
      const name = student?.full_name ?? 'a student';

      await recordAudit(c.env.DB, c.get('user'), {
        action: 'plan.updated',
        description:
          input.status && input.status !== existing.status
            ? `Marked ${name}'s learning plan "${updated.goal}" as ${PLAN_STATUS_LABELS[input.status].toLowerCase()}`
            : `Updated ${name}'s learning plan "${updated.goal}"`,
        subject: student ? { id: student.id, full_name: student.full_name } : null,
        entity_type: 'learning_plan',
        entity_id: updated.id,
      });

      const body: ApiOk<LearningPlan> = { data: updated };
      return c.json(body);
    },
  )

  .delete('/plans/:id', requireAdmin, zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const doomed = await getPlan(c.env.DB, id);

    if (!doomed || !(await deletePlan(c.env.DB, id))) {
      throw ApiError.notFound('That plan does not exist.');
    }

    const student = await getLiveUserById(c.env.DB, doomed.student_user_id);

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'plan.deleted',
      description: `Deleted ${student?.full_name ?? 'a student'}'s learning plan "${doomed.goal}"`,
      subject: student ? { id: student.id, full_name: student.full_name } : null,
      entity_type: 'learning_plan',
      entity_id: id,
    });

    return c.body(null, 204);
  })

  // --- one student ---------------------------------------------------------

  /**
   * Assessment, plan and progress for one student. A student the viewer may
   * not follow is reported as missing rather than forbidden, like everywhere
   * else, so the id itself gives nothing away.
   */
  .get('/:studentId', zValidator('param', studentParamSchema), async (c) => {
    const { studentId } = c.req.valid('param');

    if (!(await canViewStudentProgress(c.env.DB, c.get('user'), studentId))) {
      throw ApiError.notFound('That student does not exist.');
    }

    const progress = await buildStudentProgress(c.env.DB, studentId);
    if (!progress) throw ApiError.notFound('That student does not exist.');

    const body: ApiOk<StudentProgress> = { data: progress };
    return c.json(body);
  });

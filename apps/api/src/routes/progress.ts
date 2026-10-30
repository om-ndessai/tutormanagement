import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  assessmentInputSchema,
  assessmentUpdateSchema,
  planInputSchema,
  planUpdateSchema,
  ORG_PALETTE_HEX,
  PLAN_STATUS_LABELS,
  progressReportQuerySchema,
  progressReportRangeProblem,
  zonedClockParts,
  type ApiOk,
  type Assessment,
  type Curriculum,
  type CurriculumLevel,
  type LearningPlan,
  type ProgressOverview,
  type StudentProgress,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import type { OrgId } from '../lib/org.js';
import { recordAudit } from '../lib/audit.js';
import { mailerFor, notify } from '../lib/email.js';
import { ApiError } from '../lib/errors.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { getLiveUserById } from '../repositories/users.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import { getLogo } from '../repositories/organizations.js';
import { catalogLabels, listReportSessions } from '../repositories/progress-report.js';
import { buildProgressReportPdf, calendarMarks } from '../lib/progress-report-pdf.js';
import { pngToPdfImage, type PdfImage } from '../lib/pdf.js';
import {
  buildStudentProgress,
  progressReader,
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
 * The curriculum is reference data every member may read: a parent reading
 * their child's plan needs to know what "BA3.10" is. Only the curricula this
 * organization offers. Never cache it over HTTP without `Vary: X-Organization`:
 * the URL is the same for every organization.
 */
export const curriculumRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const body: ApiOk<CurriculumLevel[]> = { data: await listCurriculum(c.env.DB, c.get('org').id) };
  return c.json(body);
});

/**
 * Phase 35: the curricula on this organization's list, offered and retired,
 * the default first. Any member: the pickers offer a switch between the ones
 * still offered. Choosing them is the admins', at /api/organization/curricula.
 */
export const curriculaRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const body: ApiOk<Curriculum[]> = { data: await listOrganizationCurricula(c.env.DB, c.get('org').id) };
  return c.json(body);
});

/** A file name's part: "Sofia Okafor" -> "sofia-okafor". */
function fileSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
}

/** YYYY-MM-DD, `days` before another. */
function daysBefore(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Logos as PDF images, per isolate, by the logo's hash: splitting a PNG's
 * alpha into a soft mask is the one costly step of a report, so it is done
 * once per logo rather than on every press. Small, and keyed by content, so
 * a new upload is a new entry.
 */
const logoCache = new Map<string, PdfImage | null>();

async function reportLogo(c: Context<AppEnv>): Promise<PdfImage | null> {
  const org = c.get('org');
  let key: string;
  let bytes: () => Promise<ArrayBuffer | null>;
  const uploaded = await getLogo(c.env.DB, org.slug, 'mark');
  if (uploaded) {
    // A WebP cannot go into a PDF without decoding it: the name stands in.
    if (uploaded.content_type !== 'image/png') return null;
    key = uploaded.sha256;
    bytes = async () => uploaded.bytes;
  } else if (org.builtin_logo === 'institute') {
    key = 'builtin:institute';
    bytes = async () => {
      const response = await c.env.ASSETS.fetch(new URL('/logo-mark.png', c.req.url));
      return response.ok ? response.arrayBuffer() : null;
    };
  } else {
    return null;
  }

  if (logoCache.has(key)) return logoCache.get(key)!;
  const raw = await bytes();
  const image = raw ? await pngToPdfImage(raw) : null;
  if (logoCache.size >= 32) logoCache.clear();
  logoCache.set(key, image);
  return image;
}

/** The person being assessed must be a live student. */
async function requireStudent(db: D1Database, org: OrgId, studentId: string) {
  const student = await getLiveUserById(db, org, studentId);

  if (!student || !student.roles.includes('student')) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      student_user_id: ['Choose a student.'],
    });
  }

  return student;
}

/**
 * Level and topic ids must name rows of a curriculum this organization
 * offers (retired or not); says which ones do not.
 */
async function assertCatalogIds(
  db: D1Database,
  org: OrgId,
  fields: { field: string; kind: 'level' | 'topic'; ids: string[] }[],
) {
  const details: Record<string, string[]> = {};

  for (const { field, kind, ids } of fields) {
    const unknown = await findUnknownCurriculumIds(db, org, kind, ids);
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
      data: await listProgressOverview(c.env.DB, c.get('org'), c.get('user')),
    };
    return c.json(body);
  })

  // --- assessments ---------------------------------------------------------
  // Declared before '/:studentId' so the literal segment wins.

  .post('/assessments', requireAdmin, zValidator('json', assessmentInputSchema), async (c) => {
    const input = c.req.valid('json');
    const student = await requireStudent(c.env.DB, c.get('org').id, input.student_user_id);

    await assertCatalogIds(c.env.DB, c.get('org').id, [
      {
        field: 'recommended_level_id',
        kind: 'level',
        ids: input.recommended_level_id ? [input.recommended_level_id] : [],
      },
      { field: 'ratings', kind: 'topic', ids: input.ratings.map((r) => r.topic_id) },
    ]);

    const viewer = c.get('user');
    const assessment = await createAssessment(c.env.DB, c.get('org').id, input, viewer.id);

    await recordAudit(c.env.DB, viewer, c.get('org').id, {
      action: 'assessment.recorded',
      description:
        `Recorded an assessment of ${student.full_name} dated ${assessment.assessed_on}` +
        (assessment.ratings.length > 0 ? `, rating ${assessment.ratings.length} topics` : ''),
      subject: student,
      entity_type: 'assessment',
      entity_id: assessment.id,
    });

    // Phase 32: that an assessment exists -- never its ratings or notes.
    notify(mailerFor(c), c.get('org'), {
      kind: 'assessment_added',
      actorId: viewer.id,
      studentId: student.id,
      studentName: student.full_name,
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

      if (!(await getAssessment(c.env.DB, c.get('org').id, id))) {
        throw ApiError.notFound('That assessment does not exist.');
      }

      await assertCatalogIds(c.env.DB, c.get('org').id, [
        {
          field: 'recommended_level_id',
          kind: 'level',
          ids: input.recommended_level_id ? [input.recommended_level_id] : [],
        },
        {
          field: 'ratings',
          kind: 'topic',
          ids: (input.ratings ?? []).map((r) => r.topic_id),
        },
      ]);

      const updated = await updateAssessment(c.env.DB, c.get('org').id, id, input);
      if (!updated) throw ApiError.notFound('That assessment does not exist.');

      await recordAudit(c.env.DB, c.get('user'), c.get('org').id, {
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
    const doomed = await getAssessment(c.env.DB, c.get('org').id, id);

    if (!doomed || !(await deleteAssessment(c.env.DB, c.get('org').id, id))) {
      throw ApiError.notFound('That assessment does not exist.');
    }

    await recordAudit(c.env.DB, c.get('user'), c.get('org').id, {
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
    const student = await requireStudent(c.env.DB, c.get('org').id, input.student_user_id);

    // What the request names is checked before the student's state: an id
    // outside this organization's curricula is refused as invalid, whether or
    // not a plan is already running.
    await assertCatalogIds(c.env.DB, c.get('org').id, [
      {
        field: 'target_level_id',
        kind: 'level',
        ids: input.target_level_id ? [input.target_level_id] : [],
      },
      { field: 'topic_ids', kind: 'topic', ids: input.topic_ids },
    ]);

    // One active plan per student, which is what makes "the plan" a lesson is
    // scored against unambiguous. The index would refuse it; this says why.
    if (await getActivePlanId(c.env.DB, c.get('org').id, student.id)) {
      throw ApiError.conflict(
        `${student.full_name} already has an active plan. Mark it achieved or closed first.`,
      );
    }

    if (input.assessment_id) {
      const assessment = await getAssessment(c.env.DB, c.get('org').id, input.assessment_id);
      if (!assessment || assessment.student_user_id !== student.id) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          assessment_id: ['That assessment is not one of this student’s.'],
        });
      }
    }

    const viewer = c.get('user');
    const plan = await createPlan(c.env.DB, c.get('org').id, input, viewer.id);

    await recordAudit(c.env.DB, viewer, c.get('org').id, {
      action: 'plan.created',
      description:
        `Set a learning plan for ${student.full_name}: "${plan.goal}" by ${plan.target_on}` +
        ` (${plan.topic_ids.length} topics)`,
      subject: student,
      entity_type: 'learning_plan',
      entity_id: plan.id,
    });

    // Phase 32: that a plan exists -- the goal itself stays in the portal.
    notify(mailerFor(c), c.get('org'), {
      kind: 'plan_added',
      actorId: viewer.id,
      studentId: student.id,
      studentName: student.full_name,
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

      const existing = await getPlan(c.env.DB, c.get('org').id, id);
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
        const active = await getActivePlanId(c.env.DB, c.get('org').id, existing.student_user_id);
        if (active && active !== id) {
          throw ApiError.conflict('This student already has another active plan.');
        }
      }

      if (input.assessment_id) {
        const assessment = await getAssessment(c.env.DB, c.get('org').id, input.assessment_id);
        if (!assessment || assessment.student_user_id !== existing.student_user_id) {
          throw ApiError.validation('Please correct the highlighted fields.', {
            assessment_id: ['That assessment is not one of this student’s.'],
          });
        }
      }

      await assertCatalogIds(c.env.DB, c.get('org').id, [
        {
          field: 'target_level_id',
          kind: 'level',
          ids: input.target_level_id ? [input.target_level_id] : [],
        },
        { field: 'topic_ids', kind: 'topic', ids: input.topic_ids ?? [] },
      ]);

      const updated = await updatePlan(c.env.DB, c.get('org').id, id, input);
      if (!updated) throw ApiError.notFound('That plan does not exist.');

      const student = await getLiveUserById(c.env.DB, c.get('org').id, updated.student_user_id);
      const name = student?.full_name ?? 'a student';

      await recordAudit(c.env.DB, c.get('user'), c.get('org').id, {
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
    const doomed = await getPlan(c.env.DB, c.get('org').id, id);

    if (!doomed || !(await deletePlan(c.env.DB, c.get('org').id, id))) {
      throw ApiError.notFound('That plan does not exist.');
    }

    const student = await getLiveUserById(c.env.DB, c.get('org').id, doomed.student_user_id);

    await recordAudit(c.env.DB, c.get('user'), c.get('org').id, {
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
   * Phase 58: the progress report, a PDF built on request and never stored
   * (docs/progress-report-plan.md). Exactly the progress page's audience; the
   * lessons it lists are the ones this reader's sessions page lists. No money,
   * and no audit line: like an export, it changes nothing.
   */
  .get(
    '/:studentId/report.pdf',
    zValidator('param', studentParamSchema),
    zValidator('query', progressReportQuerySchema),
    async (c) => {
      const { studentId } = c.req.valid('param');
      const query = c.req.valid('query');
      const org = c.get('org');
      const viewer = c.get('user');

      if (!(await canViewStudentProgress(c.env.DB, org.id, viewer, studentId))) {
        throw ApiError.notFound('That student does not exist.');
      }

      const progress = await buildStudentProgress(
        c.env.DB,
        studentId,
        await progressReader(c.env.DB, org, viewer),
      );
      if (!progress) throw ApiError.notFound('That student does not exist.');

      // From defaults to the plan's start (else 90 days back), To to today on the organization's clock.
      const today = zonedClockParts(new Date().toISOString(), org.time_zone).day;
      const to = query.to ?? today;
      const from = query.from ?? progress.plan?.starts_on ?? daysBefore(to, 90);
      const problem = progressReportRangeProblem(from, to);
      if (problem) throw ApiError.validation('Please correct the highlighted fields.', { to: [problem] });

      const plan = progress.plan;
      // The original assessment: the plan's own baseline, else the student's first.
      const original = query.original
        ? ((plan?.assessment_id && progress.assessments.find((a) => a.id === plan.assessment_id)) ||
            progress.assessments.at(-1) ||
            null)
        : undefined;

      const [lessons, labels, logo] = await Promise.all([
        listReportSessions(c.env.DB, org.id, viewer, studentId, from, to),
        catalogLabels(
          c.env.DB,
          org.id,
          [plan?.target_level_id, original?.recommended_level_id].filter((id): id is string => Boolean(id)),
          [...progress.topics.map((t) => t.topic_id), ...(original?.ratings.map((r) => r.topic_id) ?? [])],
        ),
        reportLogo(c),
      ]);

      const pdf = await buildProgressReportPdf({
        organizationName: org.name,
        paletteHex: ORG_PALETTE_HEX[org.palette],
        logo,
        progress,
        from,
        to,
        generatedOn: today,
        sessions: lessons.sessions,
        sessionCount: lessons.count,
        totalMinutes: lessons.total_minutes,
        labels,
        original,
        calendar: calendarMarks(
          lessons.scheduled_days.map((row) => row.occurs_on),
          lessons.cancelled_days,
          lessons.held_days,
          from,
          to,
        ),
      });

      const name = `progress-${fileSlug(progress.student.full_name)}-${to}.pdf`;
      return new Response(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${name}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    },
  )

  /**
   * Assessment, plan and progress for one student. A student the viewer may
   * not follow is reported as missing rather than forbidden, like everywhere
   * else, so the id itself gives nothing away.
   */
  .get('/:studentId', zValidator('param', studentParamSchema), async (c) => {
    const { studentId } = c.req.valid('param');

    if (!(await canViewStudentProgress(c.env.DB, c.get('org').id, c.get('user'), studentId))) {
      throw ApiError.notFound('That student does not exist.');
    }

    const progress = await buildStudentProgress(
      c.env.DB,
      studentId,
      await progressReader(c.env.DB, c.get('org'), c.get('user')),
    );
    if (!progress) throw ApiError.notFound('That student does not exist.');

    const body: ApiOk<StudentProgress> = { data: progress };
    return c.json(body);
  });

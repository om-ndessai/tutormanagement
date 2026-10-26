import { Hono } from 'hono';
import {
  CANVAS_LIMITS,
  bankLevelOffered,
  REVIEW_LIMITS,
  REVIEW_PAGE,
  checkAnswer,
  containsSsn,
  levelLabel,
  parseStroke,
  saveCanvasReviewSchema,
  type CanvasReview,
  startCanvasAssessmentSchema,
  submitCanvasAssessmentSchema,
  type ApiOk,
  type CanvasAssessment,
  type CanvasAssessmentDetail,
  type CanvasAssessmentLevel,
  type CanvasStroke,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { buildAssessmentPdf } from '../lib/canvas-assessment-pdf.js';
import { ApiError } from '../lib/errors.js';
import type { OrgId } from '../lib/org.js';
import { isAdmin } from '../lib/scope.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import { zValidator } from '../lib/validate.js';
import {
  countDrawableQuestions,
  discardCanvasAssessment,
  drawQuestionIds,
  finishReview,
  getCanvasAssessmentFile,
  getReview,
  getReviewedPdf,
  getVisibleCanvasAssessment,
  insertCanvasAssessment,
  listCanvasAssessments,
  reopenReview,
  saveReviewDraft,
  submitCanvasAssessment,
} from '../repositories/canvas-assessments.js';
import type { OrgContext } from '../lib/org.js';
import { canViewStudentProgress } from '../repositories/progress.js';
import { getQuestions } from '../repositories/questions.js';
import { getLiveUserById } from '../repositories/users.js';

// Phase 38: the Assessment menu (beta), docs/canvas-assessment-plan.md. A
// student answers approved bank questions by hand; on submitting, the Worker
// writes a PDF for the tutor. Who reads what is R17 in docs/data-exposure.md.

const encoder = new TextEncoder();

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateJson<T>(bytes: Uint8Array): Promise<T> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return JSON.parse(await new Response(stream).text()) as T;
}

/** The body as JSON, refusing one too large before it is parsed: handwriting and ink are large. */
async function readLargeJson(c: { req: { header(name: string): string | undefined; text(): Promise<string> } }): Promise<unknown> {
  const declared = Number(c.req.header('content-length') ?? '0');
  if (declared > CANVAS_LIMITS.bodyBytes) {
    throw new ApiError(413, 'bad_request', 'That is more writing than one assessment can hold.');
  }
  const raw = await c.req.text();
  if (raw.length > CANVAS_LIMITS.bodyBytes) {
    throw new ApiError(413, 'bad_request', 'That is more writing than one assessment can hold.');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw ApiError.badRequest('The request body is not valid JSON.');
  }
}

/**
 * The question pages as submitted: each question, its handwriting and choice,
 * from the stored strokes -- what both PDFs are drawn from.
 */
async function submittedPages(db: D1Database, org: OrgContext, assessmentId: string, questionIds: string[]) {
  const file = await getCanvasAssessmentFile(db, org.id, assessmentId, 'strokes');
  const stored = file
    ? await inflateJson<{ pages: { question_id: string; strokes: string[]; choice?: number | null }[] }>(file.bytes)
    : { pages: [] };
  const byQuestion = new Map(stored.pages.map((page) => [page.question_id, page]));
  const questions = await getQuestions(db, questionIds);
  return questions.map((question) => {
    const page = byQuestion.get(question.id);
    const strokes = (page?.strokes ?? []).map((text) => parseStroke(text)).filter((s): s is CanvasStroke => s !== null);
    const index = question.kind === 'choice' ? (page?.choice ?? null) : null;
    const choice = index !== null && index < question.choices.length ? index : null;
    return {
      question,
      strokes,
      choice,
      correct: choice === null ? null : checkAnswer(question, question.choices[choice]!),
    };
  });
}

/** Refuses a review that would carry an SSN, as every free-text field does. */
function refuseSsnInReview(notes: Record<string, string>, comment: string): void {
  if (containsSsn(comment) || Object.values(notes).some((note) => containsSsn(note))) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      notes: ['That looks like a Social Security number, which is never stored.'],
    });
  }
}

/** "Sofia Reyes" -> "sofia-reyes", for a file name. */
function fileSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
}

/** The curricula this organization offers now (retired ones are left out of new assessments). */
async function offeredCurricula(db: D1Database, org: OrgId): Promise<Set<string>> {
  return new Set((await listOrganizationCurricula(db, org)).filter((c) => !c.retired).map((c) => c.id));
}

export const canvasAssessmentRoutes = new Hono<AppEnv>()

  .get('/levels', async (c) => {
    const org = c.get('org');
    const offered = await offeredCurricula(c.env.DB, org.id);
    const body: ApiOk<CanvasAssessmentLevel[]> = {
      data: await countDrawableQuestions(c.env.DB, org.canvas_assessments_unreviewed, offered),
    };
    return c.json(body);
  })

  .get('/', async (c) => {
    const body: ApiOk<CanvasAssessment[]> = {
      data: await listCanvasAssessments(c.env.DB, c.get('org').id, c.get('user')),
    };
    return c.json(body);
  })

  .post('/', zValidator('json', startCanvasAssessmentSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const input = c.req.valid('json');

    // The same people who may follow the student's progress: the student,
    // their guardians, their current tutors and the admins. Anybody else is
    // told the student is missing, not forbidden.
    if (!(await canViewStudentProgress(c.env.DB, org.id, user, input.student_user_id))) {
      throw ApiError.notFound('That student was not found.');
    }
    if (!bankLevelOffered(input.level_id, await offeredCurricula(c.env.DB, org.id))) {
      throw ApiError.validation('That level is not offered here.', {
        level_id: ['A level needs its curriculum on the organization’s curriculum list.'],
      });
    }
    const drawn = await drawQuestionIds(
      c.env.DB,
      input.level_id,
      org.canvas_assessment_questions,
      org.canvas_assessments_unreviewed,
    );
    if (drawn.ids.length === 0) {
      throw ApiError.conflict(`There are no approved questions for ${levelLabel(input.level_id)} yet.`);
    }
    const id = await insertCanvasAssessment(c.env.DB, org.id, {
      studentId: input.student_user_id,
      startedBy: user.id,
      levelId: input.level_id,
      questionIds: drawn.ids,
      unreviewed: drawn.unreviewed,
    });

    const student = await getLiveUserById(c.env.DB, org.id, input.student_user_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'canvas_assessment.started',
      description: `Started a ${levelLabel(input.level_id)} assessment for ${student?.full_name ?? 'a student'}`,
      subject: student,
      entity_type: 'canvas_assessment',
      entity_id: id,
    });

    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, id);
    if (!found) throw ApiError.notFound('Assessment not found.');
    const body: ApiOk<CanvasAssessment> = { data: found.shown };
    return c.json(body, 201);
  })

  .get('/:id', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found) throw ApiError.notFound('Assessment not found.');

    // The questions go to the person taking it, while they take it -- and
    // never with an answer or a solution.
    let questions: CanvasAssessmentDetail['questions'] = null;
    if (found.shown.can_continue) {
      const full = await getQuestions(c.env.DB, found.stored.question_ids);
      questions = full.map((q) => ({ id: q.id, kind: q.kind, skill: q.skill, stem: q.stem, choices: q.choices }));
    }
    const body: ApiOk<CanvasAssessmentDetail> = { data: { ...found.shown, questions } };
    return c.json(body);
  })

  .post('/:id/submit', async (c) => {
    const org = c.get('org');
    const user = c.get('user');

    // The body's size first: handwriting is large, and this is the cheap check.
    const declared = Number(c.req.header('content-length') ?? '0');
    if (declared > CANVAS_LIMITS.bodyBytes) {
      throw new ApiError(413, 'bad_request', 'That is more writing than one assessment can hold.');
    }
    const raw = await c.req.text();
    if (raw.length > CANVAS_LIMITS.bodyBytes) {
      throw new ApiError(413, 'bad_request', 'That is more writing than one assessment can hold.');
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw ApiError.badRequest('The request body is not valid JSON.');
    }
    const parsed = submitCanvasAssessmentSchema.safeParse(json);
    if (!parsed.success) {
      throw ApiError.validation('Please correct the highlighted fields.', { pages: ['The pages could not be read.'] });
    }

    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found || found.stored.started_by_user_id !== user.id) throw ApiError.notFound('Assessment not found.');
    if (found.stored.status !== 'in_progress') throw ApiError.conflict('This assessment has already been submitted or discarded.');

    // Every page must be one of its own questions; a missing page is blank.
    const asked = new Set(found.stored.question_ids);
    const byQuestion = new Map<string, CanvasStroke[]>();
    const chosen = new Map<string, number | null>();
    for (const page of parsed.data.pages) {
      if (!asked.has(page.question_id)) {
        throw ApiError.validation('Please correct the highlighted fields.', { pages: ['A page names a question this assessment did not ask.'] });
      }
      let numbers = 0;
      const strokes: CanvasStroke[] = [];
      for (const text of page.strokes) {
        const stroke = parseStroke(text);
        if (!stroke) {
          throw ApiError.validation('Please correct the highlighted fields.', { pages: ['A stroke could not be read.'] });
        }
        numbers += stroke.points.length + 1;
        strokes.push(stroke);
      }
      if (numbers > CANVAS_LIMITS.numbersPerPage) {
        throw new ApiError(413, 'bad_request', 'One page holds more writing than an assessment can keep.');
      }
      byQuestion.set(page.question_id, strokes);
      chosen.set(page.question_id, page.choice);
    }

    const questions = await getQuestions(c.env.DB, found.stored.question_ids);
    const pages = questions.map((question) => {
      // A choice only means something on a multiple-choice question, and only one it has.
      const index = question.kind === 'choice' ? (chosen.get(question.id) ?? null) : null;
      const choice = index !== null && index < question.choices.length ? index : null;
      return {
        question,
        strokes: byQuestion.get(question.id) ?? [],
        choice,
        // Marked by code, never by a model: the selected choice against the key.
        correct: choice === null ? null : checkAnswer(question, question.choices[choice]!),
      };
    });
    const written = pages.filter((page) => page.strokes.length > 0).length;
    const choicePages = pages.filter((page) => page.question.kind === 'choice');
    const counts = {
      written,
      choiceQuestions: choicePages.length,
      choicesAnswered: choicePages.filter((page) => page.choice !== null).length,
      choicesCorrect: choicePages.filter((page) => page.correct === true).length,
    };
    const submittedAt = new Date().toISOString();

    const pdf = await buildAssessmentPdf({
      organizationName: org.name,
      timeZone: org.time_zone,
      studentName: found.stored.student_name,
      startedByName: found.stored.started_by_name,
      levelId: found.stored.level_id,
      startedAt: found.stored.started_at,
      submittedAt,
      pages,
    });
    // The handwriting itself, as submitted: Phase 39 redraws it for the model,
    // without names, and the move to R2 carries it with the PDF.
    const strokes = await deflate(
      encoder.encode(JSON.stringify({ pages: parsed.data.pages, width: CANVAS_LIMITS.width, height: CANVAS_LIMITS.height })),
    );

    const changed = await submitCanvasAssessment(c.env.DB, org.id, found.stored.id, counts, [
      { kind: 'answers', contentType: 'application/pdf', bytes: pdf },
      { kind: 'strokes', contentType: 'application/json+deflate', bytes: strokes },
    ]);
    if (!changed) throw ApiError.conflict('This assessment has already been submitted or discarded.');

    const student = await getLiveUserById(c.env.DB, org.id, found.stored.student_user_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'canvas_assessment.submitted',
      // How much was done, never how well: the log is read more widely than the PDF.
      description: `Submitted ${found.stored.student_name}'s ${levelLabel(found.stored.level_id)} assessment: ${written} of ${pages.length} questions written, ${counts.choicesAnswered} of ${counts.choiceQuestions} choices made`,
      subject: student,
      entity_type: 'canvas_assessment',
      entity_id: found.stored.id,
    });

    const after = await getVisibleCanvasAssessment(c.env.DB, org.id, user, found.stored.id);
    if (!after) throw ApiError.notFound('Assessment not found.');
    const body: ApiOk<CanvasAssessment> = { data: after.shown };
    return c.json(body);
  })

  .post('/:id/discard', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found || (found.stored.started_by_user_id !== user.id && !isAdmin(user))) {
      throw ApiError.notFound('Assessment not found.');
    }
    if (!(await discardCanvasAssessment(c.env.DB, org.id, found.stored.id))) {
      throw ApiError.conflict('Only an assessment in progress can be discarded.');
    }
    const student = await getLiveUserById(c.env.DB, org.id, found.stored.student_user_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'canvas_assessment.discarded',
      description: `Discarded ${found.stored.student_name}'s ${levelLabel(found.stored.level_id)} assessment`,
      subject: student,
      entity_type: 'canvas_assessment',
      entity_id: found.stored.id,
    });
    const after = await getVisibleCanvasAssessment(c.env.DB, org.id, user, found.stored.id);
    if (!after) throw ApiError.notFound('Assessment not found.');
    const body: ApiOk<CanvasAssessment> = { data: after.shown };
    return c.json(body);
  })

  // -------------------------------------------------------------------------
  // Phase 40: the tutor's review. Written by the student's current tutors and
  // the admins only; anyone else is told the assessment is missing.
  // -------------------------------------------------------------------------

  .get('/:id/review', async (c) => {
    const org = c.get('org');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, c.get('user'), c.req.param('id'));
    if (!found || !found.shown.can_review) throw ApiError.notFound('Assessment not found.');
    const stored = await getReview(c.env.DB, org.id, found.stored.id);
    const questions = await getQuestions(c.env.DB, found.stored.question_ids);
    const body: ApiOk<CanvasReview> = {
      data: {
        status: stored?.status ?? 'none',
        notes: stored?.notes ?? {},
        comment: stored?.comment ?? '',
        ink: stored?.ink ? await inflateJson<CanvasReview['ink']>(stored.ink) : [],
        reviewer_name: stored?.reviewer_name ?? null,
        updated_at: stored?.updated_at ?? null,
        finished_at: stored?.finished_at ?? null,
        // The cover is page 1 of the submitted PDF; the first question is page 2.
        questions: questions.map((q, index) => ({ id: q.id, kind: q.kind, skill: q.skill, stem: q.stem, pdf_page: index + 2 })),
      },
    };
    return c.json(body);
  })

  .put('/:id/review', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const parsed = saveCanvasReviewSchema.safeParse(await readLargeJson(c));
    if (!parsed.success) {
      throw ApiError.validation('Please correct the highlighted fields.', { review: ['The review could not be read.'] });
    }
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found || !found.shown.can_review) throw ApiError.notFound('Assessment not found.');

    const asked = new Set(found.stored.question_ids);
    const { notes, comment, ink } = parsed.data;
    if (Object.keys(notes).some((id) => !asked.has(id)) || ink.some((page) => !asked.has(page.question_id))) {
      throw ApiError.validation('Please correct the highlighted fields.', { review: ['A note or a page names a question this assessment did not ask.'] });
    }
    refuseSsnInReview(notes, comment);
    for (const page of ink) {
      let numbers = 0;
      for (const text of page.strokes) {
        const stroke = parseStroke(text, REVIEW_PAGE);
        if (!stroke) throw ApiError.validation('Please correct the highlighted fields.', { review: ['A mark could not be read.'] });
        numbers += stroke.points.length + 1;
      }
      if (numbers > REVIEW_LIMITS.numbersPerPage) {
        throw new ApiError(413, 'bad_request', 'One page holds more marking than a review can keep.');
      }
    }
    // Empty notes are dropped, so a cleared note is not kept as "".
    const kept = Object.fromEntries(Object.entries(notes).filter(([, note]) => note.trim() !== ''));
    const saved = await saveReviewDraft(c.env.DB, org.id, found.stored.id, user.id, {
      notes: kept,
      comment,
      ink: await deflate(encoder.encode(JSON.stringify(ink.filter((page) => page.strokes.length > 0)))),
    });
    if (!saved) throw ApiError.conflict('This review has been saved as reviewed. Reopen it to change it.');
    return c.json({ data: { saved: true } });
  })

  .post('/:id/review/finish', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found || !found.shown.can_review) throw ApiError.notFound('Assessment not found.');
    const review = await getReview(c.env.DB, org.id, found.stored.id);
    if (!review) throw ApiError.conflict('Mark the assessment up first: there is no review to save yet.');
    if (review.status === 'final') throw ApiError.conflict('This review has already been saved as reviewed.');

    const ink = review.ink ? await inflateJson<CanvasReview['ink']>(review.ink) : [];
    const pages = await submittedPages(c.env.DB, org, found.stored.id, found.stored.question_ids);
    const pdf = await buildAssessmentPdf({
      organizationName: org.name,
      timeZone: org.time_zone,
      studentName: found.stored.student_name,
      startedByName: found.stored.started_by_name,
      levelId: found.stored.level_id,
      startedAt: found.stored.started_at,
      submittedAt: found.stored.submitted_at ?? found.stored.started_at,
      pages,
      review: {
        reviewerName: user.full_name,
        reviewedAt: new Date().toISOString(),
        comment: review.comment,
        notes: review.notes,
        ink: Object.fromEntries(
          ink.map((page) => [
            page.question_id,
            page.strokes.map((text) => parseStroke(text, REVIEW_PAGE)).filter((s): s is CanvasStroke => s !== null),
          ]),
        ),
      },
    });
    if (!(await finishReview(c.env.DB, org.id, found.stored.id, user.id, pdf))) {
      throw ApiError.conflict('This review has already been saved as reviewed.');
    }
    const student = await getLiveUserById(c.env.DB, org.id, found.stored.student_user_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'canvas_assessment.reviewed',
      description: `Reviewed ${found.stored.student_name}'s ${levelLabel(found.stored.level_id)} assessment`,
      subject: student,
      entity_type: 'canvas_assessment',
      entity_id: found.stored.id,
    });
    const after = await getVisibleCanvasAssessment(c.env.DB, org.id, user, found.stored.id);
    if (!after) throw ApiError.notFound('Assessment not found.');
    const body: ApiOk<CanvasAssessment> = { data: after.shown };
    return c.json(body);
  })

  .post('/:id/review/reopen', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, user, c.req.param('id'));
    if (!found || !found.shown.can_review) throw ApiError.notFound('Assessment not found.');
    if (!(await reopenReview(c.env.DB, org.id, found.stored.id))) {
      throw ApiError.conflict('Only a review saved as reviewed can be reopened.');
    }
    const student = await getLiveUserById(c.env.DB, org.id, found.stored.student_user_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'canvas_assessment.review_reopened',
      description: `Reopened the review of ${found.stored.student_name}'s ${levelLabel(found.stored.level_id)} assessment`,
      subject: student,
      entity_type: 'canvas_assessment',
      entity_id: found.stored.id,
    });
    const after = await getVisibleCanvasAssessment(c.env.DB, org.id, user, found.stored.id);
    if (!after) throw ApiError.notFound('Assessment not found.');
    const body: ApiOk<CanvasAssessment> = { data: after.shown };
    return c.json(body);
  })

  /**
   * The PDFs, as plain links (`?org=`). The submitted one carries the answers
   * and worked solutions, so only the student's current tutors and the admins
   * open it. The reviewed one (`?kind=reviewed`, Phase 40) is the student's
   * whole audience's once it exists. For anybody else they do not exist (R17).
   */
  .get('/:id/pdf', async (c) => {
    const org = c.get('org');
    const found = await getVisibleCanvasAssessment(c.env.DB, org.id, c.get('user'), c.req.param('id'));
    const reviewed = c.req.query('kind') === 'reviewed';
    if (!found || (!reviewed && !found.shown.can_review)) throw ApiError.notFound('Assessment not found.');
    const bytes = reviewed
      ? await getReviewedPdf(c.env.DB, org.id, found.stored.id)
      : (await getCanvasAssessmentFile(c.env.DB, org.id, found.stored.id, 'answers'))?.bytes;
    if (!bytes) throw ApiError.notFound('Assessment not found.');

    const name = `assessment-${reviewed ? 'review-' : ''}${fileSlug(found.stored.student_name)}-${found.stored.level_id.toLowerCase().replace('.', '-')}.pdf`;
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });

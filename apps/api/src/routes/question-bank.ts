import { Hono } from 'hono';
import { z } from 'zod';
import {
  checkAnswer,
  checkProblems,
  lintQuestion,
  questionCheckRequestSchema,
  questionDraftBatchSchema,
  questionDraftRequestSchema,
  questionListQuerySchema,
  questionTopicUpdateSchema,
  questionUpdateSchema,
  questionVerdictBatchSchema,
  type ApiOk,
  type Question,
  type QuestionChecks,
  type QuestionContent,
  type QuestionCoverageLevel,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { runAi } from '../lib/ai/run.js';
import {
  CHECK_TOOL,
  DRAFT_TOOL,
  checkPrompt,
  checkSystemPrompt,
  draftPrompt,
  draftSystemPrompt,
  fakeCheck,
  fakeDraft,
  shuffled,
  type CheckItem,
} from '../lib/ai/question-bank.js';
import { zValidator } from '../lib/validate.js';
import {
  countQuestions,
  coverage,
  getBankStandard,
  getQuestion,
  getQuestions,
  insertQuestions,
  listQuestions,
  liveStems,
  setChecks,
  setNeedsFigure,
  setStatus,
  updateQuestion,
  type NewQuestion,
} from '../repositories/questions.js';

// The question bank (Phase 36), in the platform console: platform admins only
// (mounted behind requirePlatformAdmin). A question reaches `approved` only from
// `checked` -- every code check and the blind solve passed -- and only by a
// person. The log names what was done, never a question's text (AG7).

const idParam = z.object({ id: z.uuid({ message: 'Not a valid question id.' }) });
const topicParam = z.object({ topicId: z.string().min(1).max(64) });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function contentOf(question: Question): QuestionContent {
  return {
    kind: question.kind,
    stem: question.stem,
    choices: question.choices,
    answer: question.answer,
    compute: question.compute,
    solution: question.solution,
  };
}

export const questionBankRoutes = new Hono<AppEnv>()
  .get('/coverage', async (c) => {
    return c.json<ApiOk<QuestionCoverageLevel[]>>({ data: await coverage(c.env.DB) });
  })

  .get('/', zValidator('query', questionListQuerySchema), async (c) => {
    return c.json<ApiOk<Question[]>>({ data: await listQuestions(c.env.DB, c.req.valid('query')) });
  })

  /** Has a model write questions for one standard, and runs the code checks on them. */
  .post('/draft', zValidator('json', questionDraftRequestSchema), async (c) => {
    const { topic_id, count } = c.req.valid('json');
    const person = c.get('person');
    const standard = await getBankStandard(c.env.DB, topic_id);
    if (!standard) throw ApiError.notFound('That standard is not in the question bank.');

    const existing = await liveStems(c.env.DB, topic_id);
    const offset = await countQuestions(c.env.DB, topic_id);
    const { output, runId } = await runAi(c.env, {
      task: 'question_bank.draft',
      system: draftSystemPrompt(),
      prompt: draftPrompt(standard, count, existing),
      tool: { ...DRAFT_TOOL, schema: questionDraftBatchSchema },
      actor: person,
      fake: () => fakeDraft(standard, count, offset),
    });

    // Each against what is already there AND the batch's earlier ones.
    const stems = [...existing];
    const rows: NewQuestion[] = output.questions.map((draft) => {
      const content: QuestionContent = {
        kind: draft.kind,
        stem: draft.stem.trim(),
        choices: draft.kind === 'choice' ? draft.choices.map((choice) => choice.trim()) : draft.choices,
        answer: draft.answer.trim(),
        compute: draft.compute.trim() || null,
        solution: draft.solution.trim(),
      };
      const lint = lintQuestion(content, stems);
      stems.push(content.stem);
      return {
        ...content,
        topic_id,
        difficulty: draft.difficulty,
        skill: draft.skill.trim() || null,
        status: lint.length > 0 ? 'flagged' : 'draft',
        checks: { lint, solve: null },
        draft_run_id: runId,
      };
    });
    const ids = await insertQuestions(c.env.DB, rows);

    const flagged = rows.filter((row) => row.status === 'flagged').length;
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question_bank.drafted',
      description: `${person.full_name} had ${plural(rows.length, 'question')} written for ${standard.code}${
        flagged ? `; ${flagged} failed the code checks` : ''
      }.`,
      entity_type: 'curriculum_topic',
      entity_id: topic_id,
    });
    return c.json<ApiOk<{ questions: Question[]; note: string }>>(
      { data: { questions: await getQuestions(c.env.DB, ids), note: output.note.trim() } },
      201,
    );
  })

  /**
   * The blind solve: a second model works each question without its answer,
   * and judges it. With the code checks re-run, that decides checked or flagged.
   */
  .post('/check', zValidator('json', questionCheckRequestSchema), async (c) => {
    const person = c.get('person');
    const ids = [...new Set(c.req.valid('json').ids)];
    const questions = await getQuestions(c.env.DB, ids);
    if (questions.length !== ids.length) throw ApiError.notFound('Some of those questions do not exist.');
    const topicId = questions[0]!.topic_id;
    if (questions.some((q) => q.topic_id !== topicId)) {
      throw ApiError.badRequest('Check questions one standard at a time.');
    }
    if (questions.some((q) => q.status === 'approved' || q.status === 'retired')) {
      throw ApiError.conflict('Approved and retired questions are not re-checked. Edit or restore one first.');
    }
    const standard = await getBankStandard(c.env.DB, topicId);
    if (!standard) throw ApiError.notFound('That standard is not in the question bank.');

    const items: CheckItem[] = questions.map((q, index) => ({
      ref: `Q${index + 1}`,
      stem: q.stem,
      choices: shuffled(q.choices),
    }));
    const { output, runId } = await runAi(c.env, {
      task: 'question_bank.check',
      system: checkSystemPrompt(),
      prompt: checkPrompt(standard, items),
      tool: { ...CHECK_TOOL, schema: questionVerdictBatchSchema },
      actor: person,
      fake: () => fakeCheck(items),
    });

    const at = new Date().toISOString();
    let passed = 0;
    for (const [index, question] of questions.entries()) {
      const verdict = output.results.find((result) => result.ref === items[index]!.ref);
      const lint = lintQuestion(contentOf(question), await liveStems(c.env.DB, topicId, question.id));
      const checks: QuestionChecks = verdict
        ? {
            lint,
            solve: {
              answer: verdict.final_answer,
              agreed: checkAnswer(question, verdict.final_answer),
              single_answer: verdict.single_answer,
              aligned: verdict.aligned,
              grade_appropriate: verdict.grade_appropriate,
              error_free: verdict.error_free,
              issues: verdict.issues.trim(),
              work: verdict.work.trim(),
              run_id: runId,
              at,
            },
          }
        : { lint: [...lint, 'The solver gave no verdict on it.'], solve: null };
      const status = checkProblems(checks).length === 0 ? 'checked' : 'flagged';
      if (status === 'checked') passed += 1;
      // A question edited while the solver worked keeps its edit; the verdict was on the old text.
      await setChecks(c.env.DB, question.id, question.updated_at, status, checks);
    }

    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question_bank.checked',
      description: `${person.full_name} had ${plural(questions.length, 'question')} on ${standard.code} solved blind: ${passed} passed, ${
        questions.length - passed
      } flagged.`,
      entity_type: 'curriculum_topic',
      entity_id: topicId,
    });
    return c.json<ApiOk<Question[]>>({ data: await getQuestions(c.env.DB, ids) });
  })

  /** A person's edit. The blind solve no longer applies: it must be checked again. */
  .patch('/:id', zValidator('param', idParam), zValidator('json', questionUpdateSchema), async (c) => {
    const person = c.get('person');
    const question = await getQuestion(c.env.DB, c.req.valid('param').id);
    if (!question) throw ApiError.notFound('No such question.');
    if (question.status === 'retired') throw ApiError.conflict('Restore the question before editing it.');

    const input = c.req.valid('json');
    const merged = { ...contentOf(question), difficulty: question.difficulty, ...input };
    const content: QuestionContent = {
      ...merged,
      choices: merged.kind === 'numeric' ? [] : merged.choices,
      compute: merged.compute?.trim() || null,
    };
    const lint = lintQuestion(content, await liveStems(c.env.DB, question.topic_id, question.id));
    await updateQuestion(c.env.DB, question.id, {
      ...content,
      difficulty: merged.difficulty,
      status: lint.length > 0 ? 'flagged' : 'draft',
      checks: { lint, solve: null },
    });
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question.updated',
      description: `${person.full_name} edited a question on ${question.topic_code}.`,
      entity_type: 'question',
      entity_id: question.id,
    });
    return c.json<ApiOk<Question>>({ data: (await getQuestion(c.env.DB, question.id))! });
  })

  .post('/:id/approve', zValidator('param', idParam), async (c) => {
    const person = c.get('person');
    const question = await getQuestion(c.env.DB, c.req.valid('param').id);
    if (!question) throw ApiError.notFound('No such question.');
    if (question.status !== 'checked') {
      throw ApiError.conflict('Only a checked question can be approved: every check must pass first.');
    }
    // The bank may have changed since it was checked (another approved near-copy).
    const lint = lintQuestion(contentOf(question), await liveStems(c.env.DB, question.topic_id, question.id));
    if (lint.length > 0) throw ApiError.conflict(lint.join(' '));

    await setStatus(c.env.DB, question.id, 'approved', person.id);
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question.approved',
      description: `${person.full_name} approved a question on ${question.topic_code}.`,
      entity_type: 'question',
      entity_id: question.id,
    });
    return c.json<ApiOk<Question>>({ data: (await getQuestion(c.env.DB, question.id))! });
  })

  .post('/:id/retire', zValidator('param', idParam), async (c) => {
    const person = c.get('person');
    const question = await getQuestion(c.env.DB, c.req.valid('param').id);
    if (!question) throw ApiError.notFound('No such question.');
    if (question.status === 'retired') return c.json<ApiOk<Question>>({ data: question });

    await setStatus(c.env.DB, question.id, 'retired', null);
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question.retired',
      description: `${person.full_name} retired a question on ${question.topic_code}.`,
      entity_type: 'question',
      entity_id: question.id,
    });
    return c.json<ApiOk<Question>>({ data: (await getQuestion(c.env.DB, question.id))! });
  })

  /** Back to "not checked": whatever was true when it was retired is checked afresh. */
  .post('/:id/restore', zValidator('param', idParam), async (c) => {
    const person = c.get('person');
    const question = await getQuestion(c.env.DB, c.req.valid('param').id);
    if (!question) throw ApiError.notFound('No such question.');
    if (question.status !== 'retired') throw ApiError.conflict('Only a retired question can be restored.');

    const lint = lintQuestion(contentOf(question), await liveStems(c.env.DB, question.topic_id, question.id));
    await updateQuestion(c.env.DB, question.id, {
      ...contentOf(question),
      difficulty: question.difficulty,
      status: lint.length > 0 ? 'flagged' : 'draft',
      checks: { lint, solve: null },
    });
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'question.restored',
      description: `${person.full_name} restored a question on ${question.topic_code}.`,
      entity_type: 'question',
      entity_id: question.id,
    });
    return c.json<ApiOk<Question>>({ data: (await getQuestion(c.env.DB, question.id))! });
  })

  .patch(
    '/topics/:topicId',
    zValidator('param', topicParam),
    zValidator('json', questionTopicUpdateSchema),
    async (c) => {
      const person = c.get('person');
      const { topicId } = c.req.valid('param');
      const standard = await getBankStandard(c.env.DB, topicId);
      if (!standard) throw ApiError.notFound('That standard is not in the question bank.');
      const { needs_figure } = c.req.valid('json');
      await setNeedsFigure(c.env.DB, topicId, needs_figure);
      await recordAudit(c.env.DB, person, 'platform', {
        action: 'question_bank.topic_updated',
        description: `${person.full_name} marked ${standard.code} as ${
          needs_figure ? 'needing a figure' : 'askable in text'
        }.`,
        entity_type: 'curriculum_topic',
        entity_id: topicId,
      });
      return c.json<ApiOk<{ topic_id: string; needs_figure: boolean }>>({
        data: { topic_id: topicId, needs_figure },
      });
    },
  );

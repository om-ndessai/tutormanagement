import { Hono } from 'hono';
import { z, type ZodType } from 'zod';
import {
  AI_TASKS,
  HANDWRITING_CORPUS_SOURCES,
  HANDWRITING_LIMITS,
  HANDWRITING_SAMPLE_CATEGORY_LABELS,
  formatStroke,
  lineSize,
  parseStroke,
  readHandwritingSchema,
  readingMatches,
  saveHandwritingSampleSchema,
  syntheticSamples,
  type ApiOk,
  type CanvasStroke,
  type HandwritingCorpus,
  type HandwritingReadResult,
  type HandwritingReading,
  type HandwritingSample,
  type HandwritingSampleList,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { readLine } from '../lib/ai/handwriting.js';
import { effectiveProvider } from '../lib/ai/run.js';
import { zValidator } from '../lib/validate.js';
import { corpusSamples, deleteSample, getSample, insertSample, listSamples, summarizeSamples } from '../repositories/handwriting.js';

// The Handwriting lab (Phase 54: AI-13 stage 0), in the platform console:
// platform admins only (mounted behind requirePlatformAdmin), so every line read
// here is an adult's. Reading a line writes an `ai_runs` row (runAi) and no audit
// line, as a Quest answer writes none; saving or deleting a sample is logged, by
// its kind, never by what was written (AG7).

const idParam = z.object({ id: z.uuid({ message: 'Not a valid sample id.' }) });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
const corpusQuery = z.object({ source: z.enum(HANDWRITING_CORPUS_SOURCES).default('samples') });

/** The body as JSON, refusing one too large before it is parsed: ink is large. */
async function readBody(c: { req: { header(name: string): string | undefined; text(): Promise<string> } }): Promise<unknown> {
  const tooLarge = () => new ApiError(413, 'bad_request', 'That is more writing than one request can carry. Send fewer lines.');
  if (Number(c.req.header('content-length') ?? '0') > HANDWRITING_LIMITS.bodyBytes) throw tooLarge();
  const raw = await c.req.text();
  if (raw.length > HANDWRITING_LIMITS.bodyBytes) throw tooLarge();
  try {
    return JSON.parse(raw);
  } catch {
    throw ApiError.badRequest('The request body is not valid JSON.');
  }
}

/** Zod, with the same error envelope as zValidator. */
function parse<T extends ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (details[key] ??= []).push(issue.message);
  }
  throw ApiError.validation('Please correct the highlighted fields.', details);
}

/** A line's strokes, read and checked: on the page, and no more of them than a line may hold. */
function lineStrokes(texts: readonly string[], field: string): CanvasStroke[] {
  const strokes: CanvasStroke[] = [];
  for (const text of texts) {
    const stroke = parseStroke(text);
    if (!stroke) {
      throw ApiError.validation('A stroke is not in the canvas format.', {
        [field]: ['A stroke is not in the canvas format, or runs off the page.'],
      });
    }
    strokes.push(stroke);
  }
  if (lineSize(strokes) > HANDWRITING_LIMITS.numbersPerLine) {
    throw ApiError.validation('That line has more ink than one line may hold.', {
      [field]: ['That line has more ink than one line may hold.'],
    });
  }
  return strokes;
}

export const handwritingRoutes = new Hono<AppEnv>()
  // Reads up to four lines, each its own blind call. A line that fails says why, on its own;
  // the others still come back.
  .post('/read', async (c) => {
    const person = c.get('person');
    const input = parse(readHandwritingSchema, await readBody(c));
    const lines = input.lines.map((line, index) => ({ ...line, strokes: lineStrokes(line.strokes, `lines.${index}.strokes`) }));
    const task = AI_TASKS['handwriting.read_line'];

    const readings = await Promise.all(
      lines.map(async (line): Promise<HandwritingReading> => {
        const started = Date.now();
        try {
          const reading = await readLine(c.env, { strokes: line.strokes, actor: person });
          return {
            key: line.key,
            status: reading.status,
            latex: reading.latex,
            is_math: reading.is_math,
            confidence: reading.confidence,
            matched: line.truth === undefined ? null : readingMatches(reading.latex, line.truth),
            ms: Date.now() - started,
            image: input.include_image ? reading.image : null,
            error: null,
          };
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          return {
            key: line.key,
            status: 'failed',
            latex: null,
            is_math: false,
            confidence: null,
            matched: line.truth === undefined ? null : false,
            ms: Date.now() - started,
            image: null,
            error: { code: error.code, message: error.message },
          };
        }
      }),
    );

    return c.json<ApiOk<HandwritingReadResult>>({
      data: {
        readings,
        provider: c.env.AI_ENABLED === 'false' ? 'fake' : effectiveProvider(c.env, task),
        model: task.model,
      },
    });
  })

  .get('/samples', zValidator('query', listQuery), async (c) => {
    const [samples, summary] = await Promise.all([listSamples(c.env.DB, c.req.valid('query').limit), summarizeSamples(c.env.DB)]);
    return c.json<ApiOk<HandwritingSampleList>>({ data: { samples, summary } });
  })

  .post('/samples', async (c) => {
    const person = c.get('person');
    const input = parse(saveHandwritingSampleSchema, await readBody(c));
    const strokes = lineStrokes(input.strokes, 'strokes');
    const matched = input.reading_status === 'read' && readingMatches(input.reading, input.truth);
    const sample = await insertSample(c.env.DB, {
      // Stored as the canvas sends them, rounded once more by the shared writer.
      strokes: strokes.map(formatStroke),
      truth: input.truth,
      category: input.category,
      reading: input.reading_status === 'read' ? input.reading : null,
      readingStatus: input.reading_status,
      readingModel: input.reading_model,
      matched,
      writtenBy: person.id,
    });
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'handwriting.sample_saved',
      description: `${person.full_name} saved a handwriting sample (${HANDWRITING_SAMPLE_CATEGORY_LABELS[input.category].toLowerCase()}), ${
        matched ? 'which the reader read right' : input.reading_status === 'read' ? 'which the reader misread' : 'which was not read'
      }.`,
      entity_type: 'handwriting_sample',
      entity_id: sample.id,
    });
    return c.json<ApiOk<HandwritingSample>>({ data: sample }, 201);
  })

  .delete('/samples/:id', zValidator('param', idParam), async (c) => {
    const person = c.get('person');
    const { id } = c.req.valid('param');
    const sample = await getSample(c.env.DB, id);
    if (!sample || !(await deleteSample(c.env.DB, id))) throw ApiError.notFound('No such sample.');
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'handwriting.sample_deleted',
      description: `${person.full_name} deleted a handwriting sample (${HANDWRITING_SAMPLE_CATEGORY_LABELS[sample.category].toLowerCase()}).`,
      entity_type: 'handwriting_sample',
      entity_id: id,
    });
    return c.json<ApiOk<{ id: string }>>({ data: { id } });
  })

  // The corpus as a file, for `npm run handwriting:eval`: the lab's samples, or the synthetic
  // set (shared `syntheticSamples`, no hand at all). A plain link: the cookie goes along.
  .get('/corpus', zValidator('query', corpusQuery), async (c) => {
    const { source } = c.req.valid('query');
    const samples =
      source === 'samples'
        ? await corpusSamples(c.env.DB)
        : syntheticSamples().map((sample) => ({ ...sample, strokes: sample.strokes.map(formatStroke) }));
    const exportedAt = new Date().toISOString();
    const corpus: HandwritingCorpus = { version: 1, source, exported_at: exportedAt, samples };
    return c.body(JSON.stringify(corpus), 200, {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="handwriting-${source}-${exportedAt.slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    });
  });

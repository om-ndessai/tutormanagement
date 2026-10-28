import {
  HANDWRITING_SAMPLE_CATEGORIES,
  type HandwritingSample,
  type HandwritingSampleCategory,
  type HandwritingSampleSummary,
} from '@tmi/shared';

// The Handwriting lab's corpus (Phase 54). Platform data, like the question
// bank: no organization owns it, and only platform admins reach it (the routes
// sit behind requirePlatformAdmin). Every line in it is an adult's.

interface SampleRow {
  id: string;
  stroke_count: number;
  truth: string;
  category: HandwritingSampleCategory;
  reading: string | null;
  reading_status: 'read' | 'unreadable' | null;
  reading_model: string | null;
  matched: number;
  written_by_name: string | null;
  created_at: string;
}

const SAMPLE_COLUMNS = `s.id, s.stroke_count, s.truth, s.category, s.reading, s.reading_status,
  s.reading_model, s.matched, u.full_name AS written_by_name, s.created_at`;

function toSample(row: SampleRow): HandwritingSample {
  return { ...row, matched: row.matched === 1 };
}

export interface NewSample {
  strokes: string[];
  truth: string;
  category: HandwritingSampleCategory;
  reading: string | null;
  readingStatus: 'read' | 'unreadable' | null;
  readingModel: string | null;
  matched: boolean;
  writtenBy: string;
}

export async function insertSample(db: D1Database, input: NewSample): Promise<HandwritingSample> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO handwriting_samples
         (id, strokes, stroke_count, truth, category, reading, reading_status, reading_model, matched, written_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.strokes.join('\n'),
      input.strokes.length,
      input.truth,
      input.category,
      input.reading,
      input.readingStatus,
      input.readingModel,
      input.matched ? 1 : 0,
      input.writtenBy,
    )
    .run();
  return (await getSample(db, id))!;
}

export async function getSample(db: D1Database, id: string): Promise<HandwritingSample | null> {
  const row = await db
    .prepare(
      `SELECT ${SAMPLE_COLUMNS} FROM handwriting_samples s
       LEFT JOIN users u ON u.id = s.written_by_user_id WHERE s.id = ?`,
    )
    .bind(id)
    .first<SampleRow>();
  return row ? toSample(row) : null;
}

/** The newest samples, without their strokes (a list never needs the ink). */
export async function listSamples(db: D1Database, limit: number): Promise<HandwritingSample[]> {
  const { results } = await db
    .prepare(
      `SELECT ${SAMPLE_COLUMNS} FROM handwriting_samples s
       LEFT JOIN users u ON u.id = s.written_by_user_id
       ORDER BY s.created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<SampleRow>();
  return results.map(toSample);
}

/** How many samples there are, and how many the reader read right when they were saved, by kind. */
export async function summarizeSamples(db: D1Database): Promise<HandwritingSampleSummary> {
  const { results } = await db
    .prepare('SELECT category, COUNT(*) AS total, SUM(matched) AS matched FROM handwriting_samples GROUP BY category')
    .all<{ category: HandwritingSampleCategory; total: number; matched: number | null }>();
  const byCategory = HANDWRITING_SAMPLE_CATEGORIES.map((category) => {
    const row = results.find((r) => r.category === category);
    return { category, total: row?.total ?? 0, matched: row?.matched ?? 0 };
  }).filter((entry) => entry.total > 0);
  return {
    total: byCategory.reduce((sum, entry) => sum + entry.total, 0),
    matched: byCategory.reduce((sum, entry) => sum + entry.matched, 0),
    by_category: byCategory,
  };
}

export async function deleteSample(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM handwriting_samples WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Every sample with its ink, oldest first: the corpus the evaluation reads. */
export async function corpusSamples(db: D1Database): Promise<
  { id: string; category: HandwritingSampleCategory; truth: string; strokes: string[]; reading: string | null; reading_model: string | null }[]
> {
  const { results } = await db
    .prepare(
      `SELECT id, category, truth, strokes, reading, reading_model FROM handwriting_samples ORDER BY created_at, id`,
    )
    .all<{ id: string; category: HandwritingSampleCategory; truth: string; strokes: string; reading: string | null; reading_model: string | null }>();
  return results.map((row) => ({ ...row, strokes: row.strokes.split('\n') }));
}

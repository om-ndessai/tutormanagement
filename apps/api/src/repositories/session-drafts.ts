import {
  sessionAssessmentInputSchema,
  sessionProgressInputSchema,
  sessionWriteUpInputSchema,
  isWriteUpEmpty,
} from '@tmi/shared';
import type {
  Rating,
  SessionAssessmentContent,
  SessionDraft,
  SessionDraftPayload,
  SessionProgress,
  SessionWriteUp,
} from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const SELECT_DRAFT = `
  SELECT d.id, d.tutor_user_id, t.full_name AS tutor_name,
         d.student_user_id, s.full_name AS student_name,
         d.author_user_id, d.occurred_on, d.started_at, d.ended_at, d.mode,
         d.notes, d.progress_json, d.write_up_json, d.assessment_json,
         d.created_at, d.updated_at
  FROM session_drafts d
  JOIN users t ON t.id = d.tutor_user_id
  JOIN users s ON s.id = d.student_user_id
`;

interface DraftRow {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  student_user_id: string;
  student_name: string;
  author_user_id: string;
  occurred_on: string;
  started_at: string;
  ended_at: string;
  mode: SessionDraft['mode'];
  notes: string | null;
  progress_json: string | null;
  write_up_json: string | null;
  assessment_json: string | null;
  created_at: string;
  updated_at: string;
}

/** Stored working state, read back through the schema that let it in. */
function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toWriteUp(text: string | null): SessionWriteUp | null {
  const parsed = sessionWriteUpInputSchema.safeParse(parseJson(text));
  return parsed.success && !isWriteUpEmpty(parsed.data) ? parsed.data : null;
}

function toAssessment(text: string | null): SessionAssessmentContent | null {
  const parsed = sessionAssessmentInputSchema.safeParse(parseJson(text));
  // Held to 1-5 by the schema; the narrowing restates that for the compiler.
  return parsed.success
    ? { rating: parsed.data.rating as Rating | null, body: parsed.data.body }
    : null;
}

function toDraft(row: DraftRow): SessionDraft {
  let progress: SessionProgress | null = null;

  // Working state the form wrote, parsed on the way out rather than trusted:
  // a draft whose JSON went bad should still open, minus the ratings, instead
  // of taking the page down or handing the form something it cannot render.
  if (row.progress_json) {
    const parsed = sessionProgressInputSchema.safeParse(parseJson(row.progress_json));

    // The schema has already held each rating to 1-5; the narrowing to Rating
    // is that guarantee restated for the type system, at the one boundary
    // where stored text becomes a value.
    progress = parsed.success
      ? {
          goal_rating: (parsed.data.goal_rating as Rating | null) ?? null,
          topic_ratings: parsed.data.topic_ratings.map((row) => ({
            topic_id: row.topic_id,
            rating: row.rating as Rating,
          })),
        }
      : null;
  }

  const { progress_json: _progress, write_up_json, assessment_json, ...rest } = row;
  return {
    ...rest,
    progress,
    write_up: toWriteUp(write_up_json),
    assessment: toAssessment(assessment_json),
  };
}

/** The JSON a draft keeps for its write-up and assessment, or NULL for none. */
function workingState(input: SessionDraftPayload) {
  return {
    write_up:
      input.write_up && !isWriteUpEmpty(input.write_up) ? JSON.stringify(input.write_up) : null,
    assessment: input.assessment ? JSON.stringify(input.assessment) : null,
  };
}

/**
 * The viewer's own drafts, newest first.
 *
 * Scoped to the author rather than to the tutor: a draft is the private
 * working copy of whoever is writing it, and an admin writing one up on a
 * tutor's behalf should not see the tutor's half-finished notes, nor the
 * tutor theirs.
 */
export async function listMyDrafts(db: D1Database, authorUserId: string): Promise<SessionDraft[]> {
  const result = await db
    .prepare(`${SELECT_DRAFT} WHERE d.author_user_id = ? ORDER BY d.updated_at DESC`)
    .bind(authorUserId)
    .all<DraftRow>();

  return (result.results ?? []).map(toDraft);
}

export async function getDraft(db: D1Database, id: string): Promise<SessionDraft | null> {
  const row = await db.prepare(`${SELECT_DRAFT} WHERE d.id = ?`).bind(id).first<DraftRow>();
  return row ? toDraft(row) : null;
}

export async function createDraft(
  db: D1Database,
  authorUserId: string,
  input: SessionDraftPayload,
): Promise<SessionDraft> {
  const id = crypto.randomUUID();
  const state = workingState(input);

  await db
    .prepare(
      `INSERT INTO session_drafts
         (id, tutor_user_id, student_user_id, author_user_id, occurred_on,
          started_at, ended_at, mode, notes, progress_json, write_up_json,
          assessment_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.tutor_user_id,
      input.student_user_id,
      authorUserId,
      input.occurred_on,
      input.started_at,
      input.ended_at,
      input.mode,
      input.notes,
      input.progress ? JSON.stringify(input.progress) : null,
      state.write_up,
      state.assessment,
    )
    .run();

  const created = await getDraft(db, id);
  if (!created) throw new Error('Insert into session_drafts returned no row.');
  return created;
}

/** Replaces a draft wholesale: it is one form, saved again. */
export async function updateDraft(
  db: D1Database,
  id: string,
  input: SessionDraftPayload,
): Promise<SessionDraft | null> {
  const state = workingState(input);

  const result = await db
    .prepare(
      `UPDATE session_drafts
       SET tutor_user_id = ?, student_user_id = ?, occurred_on = ?, started_at = ?,
           ended_at = ?, mode = ?, notes = ?, progress_json = ?, write_up_json = ?,
           assessment_json = ?, updated_at = ${NOW}
       WHERE id = ?`,
    )
    .bind(
      input.tutor_user_id,
      input.student_user_id,
      input.occurred_on,
      input.started_at,
      input.ended_at,
      input.mode,
      input.notes,
      input.progress ? JSON.stringify(input.progress) : null,
      state.write_up,
      state.assessment,
      id,
    )
    .run();

  if (!result.meta.changes) return null;
  return getDraft(db, id);
}

export async function deleteDraft(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM session_drafts WHERE id = ?').bind(id).run();
  return Boolean(result.meta.changes);
}

/** How many drafts the viewer has waiting, for the badge on the sessions page. */
export async function countMyDrafts(db: D1Database, authorUserId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS total FROM session_drafts WHERE author_user_id = ?')
    .bind(authorUserId)
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

import {
  GUEST_POOL_DEFAULT,
  GUEST_POOL_MIN,
  suggestGuestPool,
  type GuestPoolCandidate,
  type GuestQuestion,
  type QuestionKind,
} from '@tmi/shared';

import { markLevelsDirty } from './level-counts.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Phase 63 (P9, docs/stickiness-plan.md): the guest pool -- a few questions per level reserved for
 * signed-out play (`guest_questions`), never served to members. Platform reference data: no
 * organization. A pool changes only by a platform admin's hand in the console, which bumps the pool
 * version (`platform_settings` 'guest_version') so devices fetch it afresh.
 */

interface PoolRow {
  id: string;
  kind: QuestionKind;
  stem: string;
  choices: string;
  answer: string;
  solution: string;
  difficulty: number;
  status: string;
}

/** A level's pool as guests play it: only questions still approved or checked, in their order. */
export async function guestPool(db: D1Database, levelId: string): Promise<GuestQuestion[]> {
  const result = await db
    .prepare(
      `SELECT q.id, q.kind, q.stem, q.choices, q.answer, q.solution, q.difficulty, q.status
       FROM guest_questions g JOIN questions q ON q.id = g.question_id
       WHERE g.level_id = ? AND q.status IN ('approved', 'checked')
       ORDER BY g.position`,
    )
    .bind(levelId)
    .all<PoolRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    stem: row.stem,
    choices: JSON.parse(row.choices) as string[],
    answer: row.answer,
    solution: row.solution,
    difficulty: row.difficulty,
    beta: row.status === 'checked',
  }));
}

/** How many guest questions each level holds (for the console and to subtract from members' counts). */
export async function guestPoolSizes(db: D1Database): Promise<Map<string, number>> {
  const result = await db
    .prepare('SELECT level_id, COUNT(*) AS n FROM guest_questions GROUP BY level_id')
    .all<{ level_id: string; n: number }>();
  return new Map((result.results ?? []).map((row) => [row.level_id, row.n]));
}

/**
 * The console's suggestion for a level (P9): drawable questions of the level -- approved, then
 * checked; never a topic that needs a figure -- spread across topics, about 40/40/20 easy, medium and
 * hard. Reads one window of the level per difficulty, not the whole level.
 */
export async function suggestPoolFor(db: D1Database, levelId: string, size: number) {
  return (await suggestPoolsFor(db, [levelId], size)).get(levelId) ?? [];
}

/** The suggestion for several levels, in ONE batch (one query against the free plan's 50 a request). */
async function suggestPoolsFor(db: D1Database, levelIds: readonly string[], size: number) {
  const window = db.prepare(
    `SELECT q.id, q.topic_id, q.difficulty, q.status FROM questions q
     WHERE q.topic_id >= ? AND q.topic_id < ? AND q.status IN ('approved', 'checked') AND q.difficulty = ?
       AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
     ORDER BY q.status = 'approved' DESC, q.topic_id
     LIMIT ?`,
  );
  const results = await db.batch<{ id: string; topic_id: string; difficulty: number; status: string }>(
    levelIds.flatMap((levelId) => [1, 2, 3].map((difficulty) => window.bind(`${levelId}.`, `${levelId}/`, difficulty, size * 6))),
  );
  return new Map(
    levelIds.map((levelId, index) => [
      levelId,
      suggestGuestPool(results.slice(index * 3, index * 3 + 3).flatMap((r) => r.results ?? []), size),
    ]),
  );
}

/** Replaces a level's pool with these question ids, in order, and bumps the pool version. */
export async function setGuestPool(db: D1Database, levelId: string, questionIds: readonly string[]): Promise<void> {
  await setGuestPools(db, [[levelId, questionIds]]);
}

/** Replaces several levels' pools in one batch, bumps the version once, marks the levels for recount. */
async function setGuestPools(db: D1Database, pools: ReadonlyArray<readonly [string, readonly string[]]>): Promise<void> {
  const insert = db.prepare(
    // The question must belong to the level and be drawable; anything else is skipped.
    `INSERT INTO guest_questions (question_id, level_id, position)
     SELECT q.id, ?1, ?2 FROM questions q
     WHERE q.id = ?3 AND q.topic_id >= ?1 || '.' AND q.topic_id < ?1 || '/' AND q.status IN ('approved', 'checked')`,
  );
  await db.batch([
    ...pools.flatMap(([levelId, ids]) => [
      db.prepare('DELETE FROM guest_questions WHERE level_id = ?').bind(levelId),
      ...ids.map((id, index) => insert.bind(levelId, index, id)),
    ]),
    bumpVersion(db),
  ]);
  // Members' counts leave the pool out: the levels are recounted at their next read.
  await markLevelsDirty(db, pools.map(([levelId]) => `${levelId}.x`));
}

/**
 * Gives every one of these levels whose pool is EMPTY the console's suggestion (owner, 2026-11-02:
 * guest play works as soon as it is switched on, without confirming each level first; the console
 * still swaps or clears them). A level with fewer drawable questions than GUEST_POOL_MIN is left
 * empty. Three queries however many levels. Returns the levels filled.
 */
export async function fillEmptyGuestPools(db: D1Database, levelIds: readonly string[]): Promise<string[]> {
  const sizes = await guestPoolSizes(db);
  const empty = [...new Set(levelIds)].filter((levelId) => (sizes.get(levelId) ?? 0) === 0);
  if (empty.length === 0) return [];
  const suggestions = await suggestPoolsFor(db, empty, GUEST_POOL_DEFAULT);
  const pools = empty.flatMap((levelId) => {
    const ids = (suggestions.get(levelId) ?? []).map((q) => q.id);
    return ids.length >= GUEST_POOL_MIN ? [[levelId, ids] as const] : [];
  });
  if (pools.length === 0) return [];
  await setGuestPools(db, pools);
  return pools.map(([levelId]) => levelId);
}

/** Every console edit of the guest data moves the version, so devices fetch it afresh. */
export function bumpVersion(db: D1Database): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO platform_settings (key, value) VALUES ('guest_version', json_quote(?))
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
    )
    .bind(Date.now().toString(36));
}

export async function guestVersion(db: D1Database): Promise<string> {
  const row = await db
    .prepare("SELECT json_extract(value, '$') AS v FROM platform_settings WHERE key = 'guest_version'")
    .first<{ v: string }>();
  return row?.v ?? '0';
}

/**
 * The guest questions of some levels (one read of guest_questions_level_idx, ~10 rows a level), so a
 * member draw can leave them out without probing the table once per question it scans (P9: reserved).
 */
export async function guestIdsFor(db: D1Database, levelIds: readonly string[]): Promise<string> {
  if (levelIds.length === 0) return '[]';
  const result = await db
    .prepare('SELECT question_id FROM guest_questions WHERE level_id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(levelIds))
    .all<{ question_id: string }>();
  return JSON.stringify((result.results ?? []).map((row) => row.question_id));
}

/** The console's rows for some questions, in the order given. */
export async function poolCandidates(db: D1Database, ids: readonly string[]): Promise<GuestPoolCandidate[]> {
  if (ids.length === 0) return [];
  const result = await db
    .prepare('SELECT id, topic_id, difficulty, status, stem FROM questions WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids))
    .all<GuestPoolCandidate>();
  const byId = new Map((result.results ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/** A level's pool ids, in order. */
export async function poolIds(db: D1Database, levelId: string): Promise<string[]> {
  const result = await db
    .prepare('SELECT question_id FROM guest_questions WHERE level_id = ? ORDER BY position')
    .bind(levelId)
    .all<{ question_id: string }>();
  return (result.results ?? []).map((row) => row.question_id);
}


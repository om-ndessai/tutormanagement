import {
  CANVAS_ASSESSMENT_LEVEL_IDS,
  QUESTION_BANK_LEVEL_IDS,
  QUESTION_BANK_LEVEL_LABELS,
  bankLevelOffered,
  type CanvasAssessmentLevel,
  type CanvasAssessmentLevelId,
} from '@tmi/shared';

import { countDrawableQuestions } from './canvas-assessments.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Phase 62 (P4): how many questions each bank level can draw, kept for the whole platform in
 * `platform_settings` ('level_counts') instead of counted on every game start and every levels read.
 * Counting with checked questions included reads one index row per question in every offered
 * curriculum -- about 30,000 rows a call -- which the free plan's 5M reads a day cannot afford on
 * each one-tap start. The counts are the platform's (the bank is), so one set serves every space:
 * each reader filters it by its own curricula and by `checkedQuestionsOn`.
 *
 * Refreshed once a day by the cron, and on demand when missing or older than STALE_MS; each
 * isolate keeps what it read for MEMO_MS. A count may trail the bank by a day: a game that asks
 * for more than its level now holds is refused by the object's own draw (409), as before.
 */
const STALE_MS = 26 * 3_600_000;
const MEMO_MS = 60_000;

interface LevelCount {
  level_id: CanvasAssessmentLevelId;
  approved: number;
  checked: number;
}

interface StoredCounts {
  at: string;
  levels: LevelCount[];
}

let memo: { value: StoredCounts; read: number } | null = null;

/** For tests: forget what this isolate read. */
export function forgetLevelCounts(): void {
  memo = null;
}

/** Counts every level afresh (one indexed range read per run of levels) and stores the result. */
export async function refreshLevelCounts(db: D1Database): Promise<StoredCounts> {
  const every = new Set<string>(['nc-2026', 'nc-2017', 'ba', 'mk']);
  const counted = await countDrawableQuestions(db, true, every);
  const value: StoredCounts = {
    at: new Date().toISOString(),
    levels: counted.map((level) => ({
      level_id: level.level_id,
      approved: level.available - level.unreviewed,
      checked: level.unreviewed,
    })),
  };
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value) VALUES ('level_counts', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(value))
    .run();
  memo = { value, read: Date.now() };
  return value;
}

async function storedCounts(db: D1Database): Promise<StoredCounts> {
  const now = Date.now();
  if (memo && now - memo.read < MEMO_MS) return memo.value;
  const rows = await db
    .prepare("SELECT key, value FROM platform_settings WHERE key IN ('level_counts', 'level_counts_dirty')")
    .all<{ key: string; value: string }>();
  const byKey = new Map((rows.results ?? []).map((row) => [row.key, row.value]));
  let value: StoredCounts | null = null;
  try {
    const parsed = JSON.parse(byKey.get('level_counts') ?? 'null') as StoredCounts | null;
    if (parsed && Array.isArray(parsed.levels) && now - Date.parse(parsed.at) < STALE_MS) value = parsed;
  } catch {
    value = null;
  }
  if (!value) return refreshLevelCounts(db);
  let dirty: string[] = [];
  try {
    dirty = (JSON.parse(byKey.get('level_counts_dirty') ?? '[]') as unknown[]).filter(
      (id): id is string => typeof id === 'string',
    );
  } catch {
    dirty = [];
  }
  if (dirty.length > 0) value = await recountLevels(db, value, dirty);
  memo = { value, read: now };
  return value;
}

/** Recounts only the named levels (one indexed range read each), stores the result, and clears the marks. */
async function recountLevels(db: D1Database, stored: StoredCounts, levelIds: readonly string[]): Promise<StoredCounts> {
  const wanted = CANVAS_ASSESSMENT_LEVEL_IDS.filter((id) => levelIds.includes(id));
  const count = db.prepare(
    `SELECT q.status, COUNT(*) AS n FROM questions q
     WHERE q.topic_id >= ? AND q.topic_id < ? AND q.status IN ('approved', 'checked')
       AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
       AND NOT EXISTS (SELECT 1 FROM guest_questions g WHERE g.question_id = q.id)
     GROUP BY q.status`,
  );
  const results = await db.batch<{ status: string; n: number }>(wanted.map((id) => count.bind(`${id}.`, `${id}/`)));
  const fresh = new Map<string, LevelCount>();
  wanted.forEach((level_id, index) => {
    const rows = results[index]?.results ?? [];
    fresh.set(level_id, {
      level_id,
      approved: rows.find((row) => row.status === 'approved')?.n ?? 0,
      checked: rows.find((row) => row.status === 'checked')?.n ?? 0,
    });
  });
  const value: StoredCounts = {
    at: stored.at,
    levels: [
      ...stored.levels.map((level) => fresh.get(level.level_id) ?? level),
      ...[...fresh.values()].filter((level) => !stored.levels.some((s) => s.level_id === level.level_id)),
    ],
  };
  await db.batch([
    db
      .prepare(`UPDATE platform_settings SET value = ?, updated_at = ${NOW} WHERE key = 'level_counts'`)
      .bind(JSON.stringify(value)),
    db.prepare("DELETE FROM platform_settings WHERE key = 'level_counts_dirty'"),
  ]);
  return value;
}

/** The bank level a topic belongs to ('NC26.4.ANR.1' -> 'NC26.4'), or null. */
export function levelOfTopic(topicId: string): string | null {
  return QUESTION_BANK_LEVEL_IDS.find((id) => topicId.startsWith(`${id}.`)) ?? null;
}

/**
 * After questions change status (approved, retired, flagged, checked): marks their levels for a
 * recount at the next read. Cheap -- one row written -- so a review session of a hundred approvals
 * costs one small recount, not a hundred.
 */
export async function markLevelsDirty(db: D1Database, topicIds: readonly string[]): Promise<void> {
  const levels = [...new Set(topicIds.map(levelOfTopic).filter((id): id is string => id !== null))];
  if (levels.length === 0) return;
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value) VALUES ('level_counts_dirty', ?1)
       ON CONFLICT (key) DO UPDATE SET
         value = (SELECT json_group_array(v) FROM (
                    SELECT value AS v FROM json_each(platform_settings.value)
                    UNION SELECT value FROM json_each(?1))),
         updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(levels))
    .run();
  memo = null;
}

/** As above, from question ids (reads their topics). */
export async function markQuestionLevelsDirty(db: D1Database, questionIds: readonly string[]): Promise<void> {
  if (questionIds.length === 0) return;
  const rows = await db
    .prepare('SELECT topic_id FROM questions WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(questionIds))
    .all<{ topic_id: string }>();
  await markLevelsDirty(db, (rows.results ?? []).map((row) => row.topic_id));
}

/**
 * The levels a space offers (`offered`, its live curricula) with how many questions each can draw:
 * approved ones, and checked ones too while `includeChecked`. The shape `countDrawableQuestions`
 * answers, so callers need not change.
 */
export async function cachedDrawableCounts(
  db: D1Database,
  includeChecked: boolean,
  offered: ReadonlySet<string>,
): Promise<CanvasAssessmentLevel[]> {
  const stored = await storedCounts(db);
  const byLevel = new Map(stored.levels.map((level) => [level.level_id, level]));
  return CANVAS_ASSESSMENT_LEVEL_IDS.filter((id) => bankLevelOffered(id, offered)).map((level_id) => {
    const count = byLevel.get(level_id);
    const approved = count?.approved ?? 0;
    const checked = includeChecked ? (count?.checked ?? 0) : 0;
    return {
      level_id,
      label: QUESTION_BANK_LEVEL_LABELS[level_id],
      available: approved + checked,
      unreviewed: checked,
    };
  });
}

/** For the cron: refreshes the counts once they are a day old (one row read each time, else a recount). */
export async function refreshLevelCountsIfDue(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare("SELECT updated_at FROM platform_settings WHERE key = 'level_counts'")
    .first<{ updated_at: string }>();
  if (row && Date.now() - Date.parse(row.updated_at) < 24 * 3_600_000) return false;
  await refreshLevelCounts(db);
  return true;
}


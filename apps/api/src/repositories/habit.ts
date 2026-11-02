import {
  DAILY_SET_SIZE,
  dailySeed,
  type DailyQuestion,
  type HabitFacts,
  type QuestionKind,
} from '@tmi/shared';

/** A Daily question as the server holds it: always with its key, which the route strips until played. */
export type DailyQuestionWithKey = DailyQuestion & { answer: string; solution: string };

import type { OrgId } from '../lib/org.js';
import { guestIdsFor } from './guest.js';

/**
 * Phase 64 (P17-P20, docs/stickiness-plan.md): the habit layer's reads, all derived from rows kept
 * anyway -- the day rollup, finished games, invitations and the Daily results. Nothing here is a
 * running total.
 */

/** The days a person played here in the last 120 days (Quest answers, game answers or reviews). */
export async function habitDays(db: D1Database, org: OrgId, userId: string, today: string): Promise<string[]> {
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 120 * 86_400_000).toISOString().slice(0, 10);
  const result = await db
    .prepare(
      `SELECT day FROM activity_days
       WHERE organization_id = ? AND user_id = ? AND day >= ? AND (answers + game_answers + reviews) > 0
       ORDER BY day`,
    )
    .bind(org, userId, since)
    .all<{ day: string }>();
  return (result.results ?? []).map((row) => row.day);
}

/** The counts badges come from. */
export async function habitFacts(db: D1Database, org: OrgId, userId: string): Promise<Omit<HabitFacts, 'best_weeks'>> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM quest_game_players p JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
           WHERE p.organization_id = ?1 AND p.user_id = ?2 AND g.status = 'finished') AS quests_finished,
         (SELECT COUNT(*) FROM quest_game_invites i WHERE i.organization_id = ?1 AND i.user_id = ?2)
         + (SELECT COUNT(DISTINCT i.game_id) FROM quest_game_invites i JOIN quest_games g ON g.organization_id = i.organization_id AND g.id = i.game_id
             WHERE i.organization_id = ?1 AND g.host_user_id = ?2) AS family_games,
         (SELECT COUNT(DISTINCT day) FROM daily_results d WHERE d.organization_id = ?1 AND d.user_id = ?2) AS dailies`,
    )
    .bind(org, userId)
    .first<{ quests_finished: number; family_games: number; dailies: number }>();
  return { quests_finished: row?.quests_finished ?? 0, family_games: row?.family_games ?? 0, dailies: row?.dailies ?? 0 };
}

/**
 * The Daily set (P19): DAILY_SET_SIZE questions of a level, the same for everyone on the platform that
 * day -- approved ones first, then checked (where the space serves checked questions; a space that does
 * not gets the approved-only Daily), never a guest question, never a topic needing a figure -- ordered by
 * a seed of the day. It reads the level once per isolate per day and variant (memoised).
 */
const dailyMemo = new Map<string, DailyQuestionWithKey[]>();

export async function dailyQuestions(db: D1Database, day: string, levelId: string, includeChecked: boolean): Promise<DailyQuestionWithKey[]> {
  const key = `${day}|${levelId}|${includeChecked ? 'c' : 'a'}`;
  const cached = dailyMemo.get(key);
  if (cached) return cached;
  const reserved = await guestIdsFor(db, [levelId]);
  const seed = (dailySeed(day, levelId) % 999_983) + 1;
  const result = await db
    .prepare(
      // org-scope: the platform bank's questions, the same Daily for every space.
      `SELECT q.id, q.kind, q.stem, q.choices, q.answer, q.solution, q.status FROM questions q
       WHERE q.topic_id >= ? AND q.topic_id < ? AND q.status IN ('approved', ?)
         AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
         AND q.id NOT IN (SELECT value FROM json_each(?))
       ORDER BY q.status = 'approved' DESC, (q.rowid * ?) % 1000003
       LIMIT ?`,
    )
    .bind(`${levelId}.`, `${levelId}/`, includeChecked ? 'checked' : 'approved', reserved, seed, DAILY_SET_SIZE)
    .all<{ id: string; kind: QuestionKind; stem: string; choices: string; answer: string; solution: string; status: string }>();
  const questions = (result.results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as DailyQuestionWithKey['kind'],
    stem: row.stem,
    choices: JSON.parse(row.choices) as string[],
    answer: row.answer,
    solution: row.solution,
    beta: row.status === 'checked',
  }));
  if (dailyMemo.size > 200) dailyMemo.clear();
  dailyMemo.set(key, questions);
  return questions;
}

export async function dailyResult(
  db: D1Database,
  org: OrgId,
  userId: string,
  day: string,
  levelId: string,
): Promise<{ right: number; of: number; seconds: number; marks: boolean[] } | null> {
  const row = await db
    .prepare(
      `SELECT right_count, question_count, seconds, marks FROM daily_results
       WHERE organization_id = ? AND user_id = ? AND day = ? AND level_id = ?`,
    )
    .bind(org, userId, day, levelId)
    .first<{ right_count: number; question_count: number; seconds: number; marks: string }>();
  return row ? { right: row.right_count, of: row.question_count, seconds: row.seconds, marks: JSON.parse(row.marks) as boolean[] } : null;
}

/** Records a Daily result once (a second play the same day is refused by the key), with its day of play. */
export async function saveDailyResult(
  db: D1Database,
  org: OrgId,
  input: { userId: string; day: string; levelId: string; marks: boolean[]; seconds: number },
): Promise<boolean> {
  const right = input.marks.filter(Boolean).length;
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO daily_results (organization_id, user_id, day, level_id, right_count, question_count, seconds, marks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (organization_id, user_id, day, level_id) DO NOTHING`,
      )
      .bind(org, input.userId, input.day, input.levelId, right, input.marks.length, input.seconds, JSON.stringify(input.marks)),
    db
      .prepare(
        `INSERT INTO activity_days (organization_id, user_id, day, game_answers) VALUES (?, ?, ?, ?)
         ON CONFLICT (organization_id, user_id, day) DO UPDATE SET game_answers = game_answers + excluded.game_answers`,
      )
      .bind(org, input.userId, input.day, input.marks.length),
  ]);
  return (results[0]?.meta.changes ?? 0) > 0;
}

/**
 * Beat your best (P20): a person's best score for each single-player shape they have played here --
 * level, mode and length -- from finished games. A tile shows its own.
 */
export async function bestScores(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<{ level_id: string; mode: string; question_count: number | null; duration_seconds: number | null; best: number }[]> {
  const result = await db
    .prepare(
      `SELECT g.level_id, g.mode, g.question_count, g.duration_seconds, MAX(t.score) AS best
       FROM quest_game_players p
       JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
       JOIN quest_game_teams t ON t.organization_id = p.organization_id AND t.id = p.team_id
       WHERE p.organization_id = ? AND p.user_id = ? AND g.players = 'single' AND g.status = 'finished'
       GROUP BY g.level_id, g.mode, g.question_count, g.duration_seconds`,
    )
    .bind(org, userId)
    .all<{ level_id: string; mode: string; question_count: number | null; duration_seconds: number | null; best: number }>();
  return result.results ?? [];
}


/**
 * P20's "New best!": whether the reader's score in this finished single-player game beat every earlier
 * finished game of theirs of the same shape. False for a first play (nothing to beat) and for any other
 * kind of game. One read.
 */
export async function isNewBest(db: D1Database, org: OrgId, userId: string, gameId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT t.score FROM quest_game_players p
            JOIN quest_game_teams t ON t.organization_id = p.organization_id AND t.id = p.team_id
           WHERE p.organization_id = g.organization_id AND p.game_id = g.id AND p.user_id = ?3) AS mine,
         (SELECT MAX(t2.score) FROM quest_game_players p2
            JOIN quest_games g2 ON g2.organization_id = p2.organization_id AND g2.id = p2.game_id
            JOIN quest_game_teams t2 ON t2.organization_id = p2.organization_id AND t2.id = p2.team_id
           WHERE p2.organization_id = g.organization_id AND p2.user_id = ?3 AND g2.id <> g.id AND g2.ended_at < g.ended_at
             AND g2.players = 'single' AND g2.status = 'finished' AND g2.level_id = g.level_id AND g2.mode = g.mode
             AND g2.question_count IS g.question_count AND g2.duration_seconds IS g.duration_seconds) AS before
       FROM quest_games g
       WHERE g.organization_id = ?1 AND g.id = ?2 AND g.players = 'single' AND g.status = 'finished'`,
    )
    .bind(org, gameId, userId)
    .first<{ mine: number | null; before: number | null }>();
  return row !== null && row.mine !== null && row.before !== null && row.mine > row.before;
}

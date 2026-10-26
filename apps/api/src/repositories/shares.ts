import {
  SHARE_ID_LENGTH,
  SHARE_TTL_DAYS,
  shareLevelLabel,
  type PublicShare,
  type Share,
  type ShareCard,
  type ShareKind,
  type ShareMark,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Phase 56 (docs/sharing-plan.md, R22): shares, and the reads that build their
 * cards. A card is made from the reader's OWN result -- their team's game,
 * their level, a question they answered right -- read here, never sent by the
 * client. Nothing in a card names anybody but the maker's chosen first name.
 */

interface ShareRow {
  id: string;
  kind: ShareKind;
  card: string;
  first_name: string | null;
  question_id: string | null;
  created_at: string;
  expires_at: string;
  withdrawn_at: string | null;
}

function toShare(row: ShareRow): Share {
  return {
    id: row.id,
    kind: row.kind,
    card: JSON.parse(row.card) as ShareCard,
    first_name: row.first_name,
    created_at: row.created_at,
    expires_at: row.expires_at,
    withdrawn_at: row.withdrawn_at,
  };
}

/** A link id: SHARE_ID_LENGTH characters of a URL-safe alphabet, from the system's random source. */
export function newShareId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_ID_LENGTH));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

// --- the cards, from the reader's own results ---------------------------------

interface TeamAnswer {
  index: number;
  question_id: string;
  correct: boolean;
  skipped: boolean;
}

/** The reader's team in a finished game of this organization, or null. */
async function myFinishedTeam(db: D1Database, org: OrgId, userId: string, gameId: string) {
  return db
    .prepare(
      `SELECT g.level_id, g.mode, g.question_count, g.knockout, g.players,
              t.place, t.score, t.correct, t.wrong, t.skipped, t.answers,
              (SELECT COUNT(*) FROM quest_game_teams x WHERE x.game_id = g.id) AS teams
       FROM quest_game_players p
       JOIN quest_games g ON g.id = p.game_id AND g.organization_id = p.organization_id
       JOIN quest_game_teams t ON t.id = p.team_id
       WHERE p.organization_id = ? AND p.user_id = ? AND p.game_id = ? AND g.status = 'finished'`,
    )
    .bind(org, userId, gameId)
    .first<{
      level_id: string;
      mode: 'count' | 'timed';
      question_count: number | null;
      knockout: number;
      players: 'single' | 'multi';
      place: number | null;
      score: number | null;
      correct: number | null;
      wrong: number | null;
      skipped: number | null;
      answers: string | null;
      teams: number;
    }>();
}

function answersOf(json: string | null): TeamAnswer[] {
  try {
    return ((JSON.parse(json ?? '[]') as TeamAnswer[]) ?? []).slice().sort((a, b) => a.index - b.index);
  } catch {
    return [];
  }
}

export async function gameResultCard(db: D1Database, org: OrgId, userId: string, gameId: string): Promise<ShareCard | null> {
  const team = await myFinishedTeam(db, org, userId, gameId);
  if (!team) return null;
  const answers = answersOf(team.answers);
  const marks: ShareMark[] = answers.map((a) => (a.skipped ? 'skipped' : a.correct ? 'right' : 'wrong'));
  return {
    kind: 'game_result',
    level_id: team.level_id,
    level_label: shareLevelLabel(team.level_id),
    mode: team.mode,
    knockout: team.knockout === 1,
    single: team.players === 'single',
    place: team.players === 'single' ? null : team.place,
    teams: Number(team.teams),
    correct: team.correct ?? 0,
    wrong: team.wrong ?? 0,
    skipped: team.skipped ?? 0,
    total: team.mode === 'count' ? (team.question_count ?? answers.length) : answers.length,
    score: team.score ?? 0,
    marks,
  };
}

/** A question the reader's team answered right in that game, if it is approved for everyone. */
export async function challengeCard(
  db: D1Database,
  org: OrgId,
  userId: string,
  gameId: string,
  questionId: string,
): Promise<ShareCard | null> {
  const team = await myFinishedTeam(db, org, userId, gameId);
  if (!team) return null;
  const right = answersOf(team.answers).some((a) => a.question_id === questionId && a.correct && !a.skipped);
  if (!right) return null;
  const approved = await db
    .prepare(
      // org-scope: the bank is the platform's; only the level of a question the reader's team answered
      // right in their own game is read, and only an approved question reaches the public.
      `SELECT q.id, l.id AS level_id FROM questions q
       JOIN curriculum_topics t ON t.id = q.topic_id
       JOIN curriculum_levels l ON l.id = t.level_id
       WHERE q.id = ? AND q.status = 'approved'`,
    )
    .bind(questionId)
    .first<{ id: string; level_id: string }>();
  if (!approved) return null;
  return { kind: 'challenge', level_id: approved.level_id, level_label: shareLevelLabel(approved.level_id), question_id: approved.id };
}

/**
 * A level the reader has finished in Question Quest: they answered there and
 * have since moved on from it (Quest moves a student on when a level is used up).
 */
export async function levelFinishedCard(db: D1Database, org: OrgId, userId: string, levelId: string): Promise<ShareCard | null> {
  const row = await db
    .prepare(
      `SELECT (SELECT quest_level_id FROM student_profiles WHERE organization_id = ?1 AND user_id = ?2) AS current,
              COUNT(*) AS answered, COALESCE(SUM(correct), 0) AS correct
       FROM quest_attempts WHERE organization_id = ?1 AND student_user_id = ?2 AND level_id = ?3`,
    )
    .bind(org, userId, levelId)
    .first<{ current: string | null; answered: number; correct: number }>();
  if (!row || Number(row.answered) === 0 || row.current === levelId) return null;
  return {
    kind: 'level_finished',
    level_id: levelId,
    level_label: shareLevelLabel(levelId),
    answered: Number(row.answered),
    correct: Number(row.correct),
  };
}

// --- shares ---------------------------------------------------------------------

export async function createShare(
  db: D1Database,
  org: OrgId,
  userId: string,
  card: ShareCard,
  firstName: string | null,
): Promise<Share> {
  const id = newShareId();
  await db
    .prepare(
      `INSERT INTO shares (id, organization_id, user_id, kind, card, first_name, question_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${SHARE_TTL_DAYS} days'))`,
    )
    .bind(id, org, userId, card.kind, JSON.stringify(card), firstName, card.kind === 'challenge' ? card.question_id : null)
    .run();
  const row = await db
    .prepare('SELECT * FROM shares WHERE organization_id = ? AND id = ?')
    .bind(org, id)
    .first<ShareRow>();
  if (!row) throw new Error('Insert into shares returned no row.');
  return toShare(row);
}

export async function listMyShares(db: D1Database, org: OrgId, userId: string): Promise<Share[]> {
  const result = await db
    .prepare('SELECT * FROM shares WHERE organization_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(org, userId)
    .all<ShareRow>();
  return (result.results ?? []).map(toShare);
}

/** Withdraws the maker's own share. False for one that is not theirs (or not there). */
export async function withdrawShare(db: D1Database, org: OrgId, userId: string, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE shares SET withdrawn_at = COALESCE(withdrawn_at, ${NOW})
       WHERE organization_id = ? AND user_id = ? AND id = ?`,
    )
    .bind(org, userId, id)
    .run();
  return Boolean(result.meta.changes);
}

/**
 * The public page's read: one primary-key read, and, for a live challenge, its
 * question without the key. A withdrawn or expired share reads "no longer
 * available" and carries nothing.
 */
export async function readPublicShare(db: D1Database, id: string): Promise<PublicShare | null> {
  const row = await db
    .prepare(
      // org-scope: the public page knows only the link's id; the row carries no organization's name.
      `SELECT s.id, s.kind, s.card, s.first_name, s.withdrawn_at, s.expires_at,
              q.stem, q.kind AS question_kind, q.choices, q.status AS question_status
       FROM shares s LEFT JOIN questions q ON q.id = s.question_id
       WHERE s.id = ?`,
    )
    .bind(id)
    .first<{
      id: string;
      kind: ShareKind;
      card: string;
      first_name: string | null;
      withdrawn_at: string | null;
      expires_at: string;
      stem: string | null;
      question_kind: 'choice' | 'numeric' | null;
      choices: string | null;
      question_status: string | null;
    }>();
  if (!row) return null;
  const live = !row.withdrawn_at && row.expires_at > new Date().toISOString();
  const questionLive = row.kind !== 'challenge' || row.question_status === 'approved';
  if (!live || !questionLive) {
    return { id: row.id, available: false, kind: null, card: null, first_name: null, question: null, turnstile_site_key: null };
  }
  return {
    id: row.id,
    available: true,
    kind: row.kind,
    card: JSON.parse(row.card) as ShareCard,
    first_name: row.first_name,
    question:
      row.kind === 'challenge' && row.stem && row.question_kind
        ? { stem: row.stem, kind: row.question_kind, choices: JSON.parse(row.choices ?? '[]') as string[] }
        : null,
    turnstile_site_key: null,
  };
}

/** A live challenge's question, with its key, for marking an answer on the server. */
export async function challengeQuestion(db: D1Database, id: string) {
  return db
    .prepare(
      // org-scope: the public page knows only the link's id.
      `SELECT q.kind, q.answer, q.solution FROM shares s JOIN questions q ON q.id = s.question_id
       WHERE s.id = ? AND s.kind = 'challenge' AND s.withdrawn_at IS NULL
         AND s.expires_at > ? AND q.status = 'approved'`,
    )
    .bind(id, new Date().toISOString())
    .first<{ kind: 'choice' | 'numeric'; answer: string; solution: string }>();
}

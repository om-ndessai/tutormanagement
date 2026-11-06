import { guestIdsFor } from './guest.js';
import { approveManyByConsensus } from './quest.js';
import {
  createGameSchema,
  INSTITUTE_TIME_ZONE,
  zonedClockParts,
  rankTeams,
  teamTotals,
  type CreateGameInput,
  type EngineGame,
  type GameFavorite,
  type GameLevelScope,
  type GameMode,
  type GamePlayerMode,
  type GameStatus,
  type WaitingGame,
  type GameSummary,
  type QuestionKind,
  type SeriesQuestion,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

// Quest Games (Phase 46, docs/quest-games-plan.md): the record of a game. The
// play runs in the game's Durable Object; these rows are written when a game is
// made, joined, started and ended -- never during play.

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/**
 * The series: up to `count` questions from a game's levels (one, or -- Random, Phase 47 -- a level
 * and those above it), approved -- and, on the organization's switch, checked ones too -- leaving
 * out standards that need a figure. Read once, when the game starts; the game's object keeps it.
 *
 * Phase 48 (docs/quest-games-g3-plan.md) curates it against what the players have seen
 * (`quest_game_seen`, in this organization): first the game's levels' questions none of them has
 * seen, at random; then, while it is short, the same from each level above in turn
 * (`climbLevelIds`); last, if the bank is still short, ones they have seen, the least recently seen
 * first. Each step reads only while the series is short.
 */
export async function drawGameSeries(
  db: D1Database,
  org: OrgId,
  input: {
    levelIds: readonly string[];
    climbLevelIds: readonly string[];
    playerIds: readonly string[];
    count: number;
    includeUnreviewed: boolean;
  },
): Promise<SeriesQuestion[]> {
  const series: SeriesQuestion[] = [];
  const players = JSON.stringify([...new Set(input.playerIds)]);
  const draw = async (levelIds: readonly string[], seen: boolean) => {
    if (series.length >= input.count || levelIds.length === 0) return;
    series.push(
      ...(await drawLevelQuestions(db, org, {
        levelIds,
        players,
        seen,
        limit: input.count - series.length,
        includeUnreviewed: input.includeUnreviewed,
      })),
    );
  };
  await draw(input.levelIds, false);
  for (const levelId of input.climbLevelIds) await draw([levelId], false);
  await draw([...input.levelIds, ...input.climbLevelIds], true);
  return series;
}

/** One step of the draw: the levels' questions the players have not seen (at random), or have (oldest first). */
async function drawLevelQuestions(
  db: D1Database,
  org: OrgId,
  input: { levelIds: readonly string[]; players: string; seen: boolean; limit: number; includeUnreviewed: boolean },
): Promise<SeriesQuestion[]> {
  const statuses = input.includeUnreviewed ? ['approved', 'checked'] : ['approved'];
  // Phase 63 (P9): the levels' guest questions are reserved for guests.
  const reserved = await guestIdsFor(db, input.levelIds);
  // Every topic of a level sorts between 'NC26.5.' and 'NC26.5/' ('/' follows '.').
  const ranges = input.levelIds.map(() => '(q.topic_id >= ? AND q.topic_id < ?)').join(' OR ');
  const result = await db
    .prepare(
      // org-scope: the platform bank's questions, drawn for a game, against what this organization's
      // players have seen here (the subquery names the organization).
      `SELECT * FROM (
         SELECT q.id, q.kind, q.stem, q.choices, q.answer, q.solution, q.status,
                (SELECT MAX(s.seen_at) FROM quest_game_seen s
                  WHERE s.organization_id = ? AND s.question_id = q.id
                    AND s.user_id IN (SELECT value FROM json_each(?))) AS last_seen
         FROM questions q
         WHERE (${ranges}) AND q.status IN (${statuses.map(() => '?').join(', ')})
           AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
           AND q.id NOT IN (SELECT value FROM json_each(?))
       )
       WHERE last_seen IS ${input.seen ? 'NOT NULL' : 'NULL'}
       ORDER BY ${input.seen ? 'last_seen, random()' : 'random()'}
       LIMIT ?`,
    )
    .bind(org, input.players, ...input.levelIds.flatMap((id) => [`${id}.`, `${id}/`]), ...statuses, reserved, input.limit)
    .all<{ id: string; kind: QuestionKind; stem: string; choices: string; answer: string; solution: string; status: string }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    stem: row.stem,
    choices: JSON.parse(row.choices) as string[],
    answer: row.answer,
    solution: row.solution,
    beta: row.status === 'checked',
  }));
}

/** Whether a code is in use anywhere: a game's or a team's, in any organization (codes never repeat). */
export async function codeInUse(db: D1Database, code: string): Promise<boolean> {
  const row = await db
    .prepare(
      // org-scope: codes are unique across the platform, so the check must read every organization's.
      `SELECT 1 AS used FROM quest_games WHERE code = ?1
       UNION ALL SELECT 1 FROM quest_game_teams WHERE code = ?1
       LIMIT 1`,
    )
    .bind(code)
    .first();
  return Boolean(row);
}

export async function insertGame(
  db: D1Database,
  org: OrgId,
  input: {
    id: string;
    code: string;
    hostId: string;
    levelId: string;
    levelScope: GameLevelScope;
    mode: GameMode;
    questionCount: number | null;
    durationSeconds: number | null;
    rightPoints: number;
    wrongPoints: number;
    knockout: boolean;
    players: GamePlayerMode;
    maxTeams: number;
    maxTeamSize: number;
    lateJoin: boolean;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO quest_games (id, organization_id, code, host_user_id, level_id, mode, question_count,
                                duration_seconds, negative_marking, max_team_size, level_scope, right_points,
                                wrong_points, knockout, players, max_teams, late_join)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      org,
      input.code,
      input.hostId,
      input.levelId,
      input.mode,
      input.questionCount,
      input.durationSeconds,
      input.wrongPoints < 0 ? 1 : 0,
      input.maxTeamSize,
      input.levelScope,
      input.rightPoints,
      input.wrongPoints,
      input.knockout ? 1 : 0,
      input.players,
      input.maxTeams,
      input.lateJoin ? 1 : 0,
    )
    .run();
}

/** The game a code names here, as a game's own code or one of its teams'; null for a code from elsewhere. */
export async function findGameByCode(
  db: D1Database,
  org: OrgId,
  code: string,
): Promise<{ game_id: string; team_id: string | null } | null> {
  return db
    .prepare(
      `SELECT id AS game_id, NULL AS team_id FROM quest_games WHERE organization_id = ?1 AND code = ?2
       UNION ALL
       SELECT game_id, id AS team_id FROM quest_game_teams WHERE organization_id = ?1 AND code = ?2
       LIMIT 1`,
    )
    .bind(org, code)
    .first<{ game_id: string; team_id: string | null }>();
}

/**
 * A team and its first player, in one batch. Phase 77 (JF15): `seatedBy` is the host who seated a child on their own
 * device (`quest_game_players.seated_by_user_id`); absent for everyone else.
 */
export async function insertTeamWithPlayer(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; teamId: string; code: string | null; name: string; solo: boolean; userId: string; seatedBy?: string | null },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO quest_game_teams (id, organization_id, game_id, code, name, solo, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.teamId, org, input.gameId, input.code, input.name, input.solo ? 1 : 0, input.userId),
    db
      .prepare('INSERT INTO quest_game_players (game_id, organization_id, team_id, user_id, seated_by_user_id) VALUES (?, ?, ?, ?, ?)')
      .bind(input.gameId, org, input.teamId, input.userId, input.seatedBy ?? null),
  ]);
}

/**
 * Phase 77 (JF15): the children a host asks to seat on their own device, as this space knows them: whether each is a
 * live dependent of the host HERE (a guardianship in this space, a live member with the student role) and whether they
 * sign in (have an email). One read; an id that is nobody here comes back as nothing.
 */
export async function seatCandidates(
  db: D1Database,
  org: OrgId,
  hostId: string,
  ids: readonly string[],
): Promise<{ id: string; full_name: string; has_email: number; own_child: number }[]> {
  const result = await db
    .prepare(
      `SELECT u.id, u.full_name, u.email IS NOT NULL AS has_email,
              (EXISTS (SELECT 1 FROM guardianships g
                        WHERE g.organization_id = m.organization_id AND g.guardian_user_id = ?2 AND g.dependent_user_id = u.id)
               AND EXISTS (SELECT 1 FROM user_roles r
                            WHERE r.organization_id = m.organization_id AND r.user_id = u.id AND r.role = 'student')
               AND m.status = 'active' AND m.removed_at IS NULL) AS own_child
       FROM org_members m
       JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
       WHERE m.organization_id = ?1 AND m.user_id IN (SELECT value FROM json_each(?3))`,
    )
    .bind(org, hostId, JSON.stringify([...new Set(ids)]))
    .all<{ id: string; full_name: string; has_email: number; own_child: number }>();
  return result.results ?? [];
}

export async function insertPlayer(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; teamId: string; userId: string },
): Promise<void> {
  await db
    .prepare('INSERT INTO quest_game_players (game_id, organization_id, team_id, user_id) VALUES (?, ?, ?, ?)')
    .bind(input.gameId, org, input.teamId, input.userId)
    .run();
}

/** A player leaving the lobby, and their team with them when they were its last player. */
export async function removePlayer(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; teamId: string; userId: string; dropTeam: boolean },
): Promise<void> {
  const statements = [
    db
      .prepare('DELETE FROM quest_game_players WHERE organization_id = ? AND game_id = ? AND user_id = ?')
      .bind(org, input.gameId, input.userId),
  ];
  if (input.dropTeam) {
    statements.push(
      db
        .prepare('DELETE FROM quest_game_teams WHERE organization_id = ? AND game_id = ? AND id = ?')
        .bind(org, input.gameId, input.teamId),
    );
  }
  await db.batch(statements);
}

export async function markGameStarted(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; startedAt: number; seriesLength: number; includeUnreviewed: boolean },
): Promise<void> {
  await db
    .prepare(
      `UPDATE quest_games SET status = 'running', started_at = ?, series_length = ?, include_unreviewed = ?
       WHERE organization_id = ? AND id = ?`,
    )
    .bind(iso(input.startedAt), input.seriesLength, input.includeUnreviewed ? 1 : 0, org, input.gameId)
    .run();
}

/**
 * Writes the end: the game finished, and every team's totals, place and
 * answers -- one UPDATE for all the teams, from a JSON list, so a game of
 * sixty players is still two statements.
 */
/** What each team's players saw (Phase 48): their user ids and the question ids, for `quest_game_seen`. */
export interface GameSeen {
  users: string[];
  questions: string[];
}

/**
 * The end of a game: its row, every team's totals in one JSON UPDATE, and -- Phase 48 -- in one
 * more statement, every player's questions into `quest_game_seen` (a question seen again moves to
 * this game and this moment, so the next draw's "least recently seen" stays true).
 */
export async function writeGameResults(db: D1Database, org: OrgId, game: EngineGame, seen: readonly GameSeen[] = []): Promise<void> {
  const places = rankTeams(game);
  const teams = game.teams.map((team) => {
    const totals = teamTotals(team.answers, game);
    return {
      id: team.id,
      ...totals,
      finished_at: iso(team.finished_at),
      place: places.get(team.id) ?? null,
      answers: JSON.stringify(team.answers),
    };
  });
  const statements = [
    db
      .prepare(`UPDATE quest_games SET status = 'finished', ended_at = ?, end_reason = ? WHERE organization_id = ? AND id = ?`)
      .bind(iso(game.ended_at ?? Date.now()), game.end_reason, org, game.id),
    db
      .prepare(
        `UPDATE quest_game_teams AS t SET
           score = json_extract(j.value, '$.score'),
           correct = json_extract(j.value, '$.correct'),
           wrong = json_extract(j.value, '$.wrong'),
           skipped = json_extract(j.value, '$.skipped'),
           finished_at = json_extract(j.value, '$.finished_at'),
           place = json_extract(j.value, '$.place'),
           answers = json_extract(j.value, '$.answers')
         FROM json_each(?) AS j
         WHERE t.organization_id = ? AND t.game_id = ? AND t.id = json_extract(j.value, '$.id')`,
      )
      .bind(JSON.stringify(teams), org, game.id),
  ];
  const seenRows = seen.filter((team) => team.users.length > 0 && team.questions.length > 0);
  if (seenRows.length > 0) {
    statements.push(
      db
        .prepare(
          `INSERT INTO quest_game_seen (organization_id, user_id, question_id, game_id, seen_at)
           SELECT ?1, u.value, q.value, ?2, ?3
           FROM json_each(?4) AS t, json_each(t.value, '$.users') AS u, json_each(t.value, '$.questions') AS q
           -- Only for players still in the space, and a game still on record: the table's trigger would
           -- refuse either, fail the whole results batch and loop the object's alarm every minute.
           WHERE EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = ?1 AND m.user_id = u.value)
             AND EXISTS (SELECT 1 FROM quest_games g WHERE g.organization_id = ?1 AND g.id = ?2)
           ON CONFLICT (organization_id, user_id, question_id) DO UPDATE SET game_id = excluded.game_id, seen_at = excluded.seen_at`,
        )
        .bind(org, game.id, iso(game.ended_at ?? Date.now()), JSON.stringify(seenRows)),
    );
  }
  // Phase 62 (P2): who answered what correctly -- the answering player alone, not their teammates --
  // so game answers count toward the two-right-answers rule beside Question Quest's.
  const right = correctGameAnswers(game);
  if (right.length > 0 && seenRows.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE quest_game_seen SET correct = 1
           WHERE organization_id = ?1
             AND EXISTS (SELECT 1 FROM json_each(?2) AS r
                         WHERE json_extract(r.value, '$.u') = quest_game_seen.user_id
                           AND json_extract(r.value, '$.q') = quest_game_seen.question_id)`,
        )
        .bind(org, JSON.stringify(right.map((pair) => ({ u: pair.userId, q: pair.questionId })))),
    );
  }
  // Phase 64 (P17): the day each answering player played, on the space's clock, for the weekly streak.
  // `game_answers`, apart from Question Quest's `answers`; only players who answered; a player who has
  // since left is passed over (the EXISTS), so one departure cannot fail the batch and loop the alarm.
  const answered = new Map<string, number>();
  for (const answer of game.teams.flatMap((team) => team.answers)) {
    if (!answer.skipped) answered.set(answer.user_id, (answered.get(answer.user_id) ?? 0) + 1);
  }
  if (answered.size > 0) {
    const zone = await db.prepare('SELECT time_zone FROM organizations WHERE id = ?').bind(org).first<{ time_zone: string }>();
    const day = zonedClockParts(new Date(game.ended_at ?? Date.now()).toISOString(), zone?.time_zone ?? INSTITUTE_TIME_ZONE).day;
    statements.push(
      db
        .prepare(
          `INSERT INTO activity_days (organization_id, user_id, day, game_answers)
           SELECT ?1, json_extract(a.value, '$.u'), ?2, json_extract(a.value, '$.n')
           FROM json_each(?3) AS a
           WHERE EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = ?1 AND m.user_id = json_extract(a.value, '$.u'))
           ON CONFLICT (organization_id, user_id, day) DO UPDATE SET game_answers = game_answers + excluded.game_answers`,
        )
        .bind(org, day, JSON.stringify([...answered].map(([u, n]) => ({ u, n })))),
    );
  }
  await db.batch(statements);
  if (right.length === 0) return;
  try {
    // The latest correct answerer of each question, as reviewed_by.
    const last = new Map<string, string>();
    for (const pair of right) last.set(pair.questionId, pair.userId);
    await approveManyByConsensus(db, last);
  } catch (error) {
    // The results are written either way; the count runs again at the next correct answer.
    console.error('Quest consensus check after a game failed', error);
  }
}

/**
 * Each correct, unskipped answer of a game: who gave it, to which question, in the order given. Phase 77 (JF15): never a
 * seated child's -- a parent's device may be the parent answering -- so seat answers count toward no two-right-answers
 * approval (they still count as the child's days and games).
 */
export function correctGameAnswers(game: EngineGame): { userId: string; questionId: string }[] {
  const seated = new Set(Object.keys(game.seats ?? {}));
  return game.teams
    .flatMap((team) => team.answers)
    .filter((answer) => answer.correct && !answer.skipped && !seated.has(answer.user_id))
    .sort((a, b) => a.at - b.at)
    .map((answer) => ({ userId: answer.user_id, questionId: answer.question_id }));
}

/** A person's games here, newest first: those they host or play -- an admin's, every one. */
export async function listGames(
  db: D1Database,
  org: OrgId,
  viewer: { id: string; admin: boolean },
): Promise<GameSummary[]> {
  const result = await db
    .prepare(
      `SELECT g.id, g.code, g.level_id, g.level_scope, g.players, g.mode, g.question_count, g.duration_seconds, g.status, g.created_at,
              u.full_name AS host_name, g.host_user_id = ?2 AS is_host,
              (SELECT COUNT(*) FROM quest_game_teams t WHERE t.organization_id = g.organization_id AND t.game_id = g.id) AS teams,
              (SELECT t.place FROM quest_game_players p JOIN quest_game_teams t ON t.id = p.team_id
                WHERE p.organization_id = g.organization_id AND p.game_id = g.id AND p.user_id = ?2) AS place,
              EXISTS (SELECT 1 FROM quest_game_players p
                      WHERE p.organization_id = g.organization_id AND p.game_id = g.id
                        AND p.seated_by_user_id IS NOT NULL) AS seated
       FROM quest_games g
       JOIN users u ON u.id = g.host_user_id
       WHERE g.organization_id = ?1
         AND (?3 = 1 OR g.host_user_id = ?2
              OR EXISTS (SELECT 1 FROM quest_game_players p
                         WHERE p.organization_id = g.organization_id AND p.game_id = g.id AND p.user_id = ?2))
       ORDER BY g.created_at DESC
       LIMIT 20`,
    )
    .bind(org, viewer.id, viewer.admin ? 1 : 0)
    .all<{
      id: string;
      code: string;
      level_id: string;
      level_scope: GameLevelScope;
      players: GamePlayerMode;
      mode: GameMode;
      question_count: number | null;
      duration_seconds: number | null;
      status: GameStatus;
      created_at: string;
      host_name: string;
      is_host: number;
      teams: number;
      place: number | null;
      seated: number;
    }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    level_id: row.level_id,
    level_scope: row.level_scope,
    players: row.players,
    mode: row.mode,
    question_count: row.question_count,
    duration_seconds: row.duration_seconds,
    status: row.status,
    host_first_name: firstNameOf(row.host_name),
    is_host: row.is_host === 1,
    created_at: row.created_at,
    place: row.place,
    teams: row.teams,
    seated: row.seated === 1,
  }));
}

/** "Sofia Reyes" -> "Sofia": how a game names a person. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Player';
}

// ---------------------------------------------------------------------------
// Favorites (Phase 47): a person's own named settings, in one organization
// ---------------------------------------------------------------------------

interface FavoriteRow {
  id: string;
  name: string;
  config: string;
  roster: string | null;
  updated_at: string;
}

function parseRoster(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

/** A stored favorite, its settings checked again by the shared schema; null when they no longer parse. */
function toFavorite(row: FavoriteRow): GameFavorite | null {
  let parsed: ReturnType<typeof createGameSchema.safeParse>;
  try {
    const raw = JSON.parse(row.config) as Record<string, unknown>;
    // A single player's stored settings carry max_teams 1, which the schema's input refuses (it
    // fills the single-player values itself): drop it, or every such favorite would read as none.
    if (raw.players === 'single') delete raw.max_teams;
    parsed = createGameSchema.safeParse(raw);
  } catch {
    return null;
  }
  return parsed.success
    ? { id: row.id, name: row.name, config: parsed.data, roster: parseRoster(row.roster), updated_at: row.updated_at }
    : null;
}

export async function listFavorites(db: D1Database, org: OrgId, userId: string): Promise<GameFavorite[]> {
  const result = await db
    .prepare(
      `SELECT id, name, config, roster, updated_at FROM quest_game_favorites
       WHERE organization_id = ? AND user_id = ?
       ORDER BY updated_at DESC`,
    )
    .bind(org, userId)
    .all<FavoriteRow>();
  return (result.results ?? []).map(toFavorite).filter((f): f is GameFavorite => f !== null);
}

/** Saves under a name, replacing the person's favorite of that name (any case). Returns it, and whether it was new. */
export async function saveFavorite(
  db: D1Database,
  org: OrgId,
  input: { userId: string; name: string; config: CreateGameInput; roster?: string[] | null },
): Promise<{ favorite: GameFavorite; created: boolean }> {
  // Phase 62 (P8): absent leaves the roster as it is (an older app never wipes it); null clears it.
  const roster = input.roster === undefined ? undefined : input.roster === null || input.roster.length === 0 ? null : JSON.stringify(input.roster);
  const existing = await db
    .prepare('SELECT id FROM quest_game_favorites WHERE organization_id = ? AND user_id = ? AND name = ?')
    .bind(org, input.userId, input.name)
    .first<{ id: string }>();
  const config = JSON.stringify(input.config);
  const now = new Date().toISOString();
  if (existing) {
    await db
      .prepare(
        `UPDATE quest_game_favorites SET name = ?, config = ?, updated_at = ?,
                roster = CASE WHEN ? = 1 THEN ? ELSE roster END
         WHERE organization_id = ? AND user_id = ? AND id = ?`,
      )
      .bind(input.name, config, now, roster === undefined ? 0 : 1, roster ?? null, org, input.userId, existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO quest_game_favorites (id, organization_id, user_id, name, config, roster, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), org, input.userId, input.name, config, roster ?? null, now, now)
      .run();
  }
  const row = await db
    .prepare('SELECT id, name, config, roster, updated_at FROM quest_game_favorites WHERE organization_id = ? AND user_id = ? AND name = ?')
    .bind(org, input.userId, input.name)
    .first<FavoriteRow>();
  return { favorite: toFavorite(row!)!, created: !existing };
}

/** Deletes the person's own favorite; returns its name, or null when they have none by that id. */
export async function deleteFavorite(db: D1Database, org: OrgId, userId: string, id: string): Promise<string | null> {
  const row = await db
    .prepare('DELETE FROM quest_game_favorites WHERE organization_id = ? AND user_id = ? AND id = ? RETURNING name')
    .bind(org, userId, id)
    .first<{ name: string }>();
  return row?.name ?? null;
}

// ---------------------------------------------------------------------------
// Phase 62 (P8): rosters, invitations and "Waiting for you"
// ---------------------------------------------------------------------------

/**
 * The members a reader may put on a roster (R27): in a self-serve space, every live member (a family's
 * own space); in any other, an admin may name anyone and everyone else their own family -- the people
 * they are a guardian of, and their own guardians. First names only. Never the reader themselves.
 */
export async function rosterMembers(
  db: D1Database,
  org: OrgId,
  reader: { id: string; admin: boolean; selfServe: boolean },
): Promise<{ id: string; full_name: string }[]> {
  const everyone = reader.selfServe || reader.admin;
  const result = await db
    .prepare(
      `SELECT u.id, u.full_name FROM org_members m JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
       WHERE m.organization_id = ?1 AND m.status = 'active' AND m.removed_at IS NULL AND m.user_id <> ?2
         AND (?3 = 1 OR EXISTS (SELECT 1 FROM guardianships g WHERE g.organization_id = ?1
                                 AND ((g.guardian_user_id = ?2 AND g.dependent_user_id = m.user_id)
                                   OR (g.dependent_user_id = ?2 AND g.guardian_user_id = m.user_id))))
       ORDER BY u.full_name`,
    )
    .bind(org, reader.id, everyone ? 1 : 0)
    .all<{ id: string; full_name: string }>();
  return result.results ?? [];
}

/** Invites a game's roster: the ids that are members the host may name (`allowed`), the host left out. */
export async function inviteToGame(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; hostId: string; userIds: readonly string[]; allowed: ReadonlySet<string> },
): Promise<number> {
  const ids = input.userIds.filter((id) => id !== input.hostId && input.allowed.has(id));
  if (ids.length === 0) return 0;
  const insert = db.prepare(
    `INSERT INTO quest_game_invites (organization_id, game_id, user_id) VALUES (?, ?, ?)
     ON CONFLICT (game_id, user_id) DO NOTHING`,
  );
  await db.batch(ids.map((id) => insert.bind(org, input.gameId, id)));
  return ids.length;
}

/**
 * "Waiting for you": games a roster invited the reader to in the last day, in the lobby or running with
 * joining open, that they have not joined. One indexed read of their invitations.
 */
/**
 * Phase 73 (JF13): the reader's latest games here, newest first, for Continue: one read through the player index. A
 * game counts as open while it is running (started within 3 hours) or in its lobby (made within 6 hours); the game
 * itself has the last word, and D1's status can lag behind it.
 */
export async function latestGamesOf(
  db: D1Database,
  org: OrgId,
  userId: string,
): Promise<
  {
    id: string;
    status: 'lobby' | 'running' | 'finished';
    level_id: string;
    level_scope: 'level' | 'upward';
    mode: 'count' | 'timed';
    question_count: number | null;
    duration_seconds: number | null;
    open: number;
  }[]
> {
  const result = await db
    .prepare(
      `SELECT g.id, g.status, g.level_id, g.level_scope, g.mode, g.question_count, g.duration_seconds,
              CASE WHEN g.status = 'running' AND g.started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 hours') THEN 1
                   WHEN g.status = 'lobby' AND g.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours') THEN 1
                   ELSE 0 END AS open
       FROM quest_game_players p
       JOIN quest_games g ON g.organization_id = p.organization_id AND g.id = p.game_id
       WHERE p.organization_id = ? AND p.user_id = ?
       ORDER BY g.created_at DESC
       LIMIT 5`,
    )
    .bind(org, userId)
    .all();
  return (result.results ?? []) as never;
}

export async function waitingGames(db: D1Database, org: OrgId, userId: string): Promise<WaitingGame[]> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const result = await db
    .prepare(
      `SELECT g.id AS game_id, g.code, u.full_name AS host_name, g.level_id, g.level_scope, g.mode, g.question_count,
              g.duration_seconds, g.status, g.created_at
       FROM quest_game_invites i
       JOIN quest_games g ON g.organization_id = i.organization_id AND g.id = i.game_id
       JOIN users u ON u.id = g.host_user_id
       WHERE i.organization_id = ?1 AND i.user_id = ?2 AND i.created_at >= ?3
         AND (g.status = 'lobby' OR (g.status = 'running' AND g.late_join = 1))
         AND NOT EXISTS (SELECT 1 FROM quest_game_players p
                         WHERE p.organization_id = g.organization_id AND p.game_id = g.id AND p.user_id = ?2)
       ORDER BY i.created_at DESC
       LIMIT 10`,
    )
    .bind(org, userId, since)
    .all<{
      game_id: string;
      code: string;
      host_name: string;
      level_id: string;
      level_scope: GameLevelScope;
      mode: GameMode;
      question_count: number | null;
      duration_seconds: number | null;
      status: GameStatus;
      created_at: string;
    }>();
  return (result.results ?? []).map(({ host_name, ...row }) => ({ ...row, host_first_name: firstNameOf(host_name) }));
}


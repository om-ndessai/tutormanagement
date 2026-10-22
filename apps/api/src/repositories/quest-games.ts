import {
  createGameSchema,
  rankTeams,
  teamTotals,
  type CreateGameInput,
  type EngineGame,
  type GameFavorite,
  type GameLevelScope,
  type GameMode,
  type GamePlayerMode,
  type GameStatus,
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
  // Every topic of a level sorts between 'NC26.5.' and 'NC26.5/' ('/' follows '.').
  const ranges = input.levelIds.map(() => '(q.topic_id >= ? AND q.topic_id < ?)').join(' OR ');
  const result = await db
    .prepare(
      // org-scope: the platform bank's questions, drawn for a game, against what this organization's
      // players have seen here (the subquery names the organization).
      `SELECT * FROM (
         SELECT q.id, q.kind, q.stem, q.choices, q.answer, q.solution,
                (SELECT MAX(s.seen_at) FROM quest_game_seen s
                  WHERE s.organization_id = ? AND s.question_id = q.id
                    AND s.user_id IN (SELECT value FROM json_each(?))) AS last_seen
         FROM questions q
         WHERE (${ranges}) AND q.status IN (${statuses.map(() => '?').join(', ')})
           AND NOT EXISTS (SELECT 1 FROM question_bank_topics b WHERE b.topic_id = q.topic_id AND b.needs_figure = 1)
       )
       WHERE last_seen IS ${input.seen ? 'NOT NULL' : 'NULL'}
       ORDER BY ${input.seen ? 'last_seen, random()' : 'random()'}
       LIMIT ?`,
    )
    .bind(org, input.players, ...input.levelIds.flatMap((id) => [`${id}.`, `${id}/`]), ...statuses, input.limit)
    .all<{ id: string; kind: QuestionKind; stem: string; choices: string; answer: string; solution: string }>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    stem: row.stem,
    choices: JSON.parse(row.choices) as string[],
    answer: row.answer,
    solution: row.solution,
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

/** A team and its first player, in one batch. */
export async function insertTeamWithPlayer(
  db: D1Database,
  org: OrgId,
  input: { gameId: string; teamId: string; code: string | null; name: string; solo: boolean; userId: string },
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO quest_game_teams (id, organization_id, game_id, code, name, solo, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.teamId, org, input.gameId, input.code, input.name, input.solo ? 1 : 0, input.userId),
    db
      .prepare('INSERT INTO quest_game_players (game_id, organization_id, team_id, user_id) VALUES (?, ?, ?, ?)')
      .bind(input.gameId, org, input.teamId, input.userId),
  ]);
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
           WHERE true
           ON CONFLICT (organization_id, user_id, question_id) DO UPDATE SET game_id = excluded.game_id, seen_at = excluded.seen_at`,
        )
        .bind(org, game.id, iso(game.ended_at ?? Date.now()), JSON.stringify(seenRows)),
    );
  }
  await db.batch(statements);
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
                WHERE p.organization_id = g.organization_id AND p.game_id = g.id AND p.user_id = ?2) AS place
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
  updated_at: string;
}

/** A stored favorite, its settings checked again by the shared schema; null when they no longer parse. */
function toFavorite(row: FavoriteRow): GameFavorite | null {
  let parsed: ReturnType<typeof createGameSchema.safeParse>;
  try {
    parsed = createGameSchema.safeParse(JSON.parse(row.config));
  } catch {
    return null;
  }
  return parsed.success ? { id: row.id, name: row.name, config: parsed.data, updated_at: row.updated_at } : null;
}

export async function listFavorites(db: D1Database, org: OrgId, userId: string): Promise<GameFavorite[]> {
  const result = await db
    .prepare(
      `SELECT id, name, config, updated_at FROM quest_game_favorites
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
  input: { userId: string; name: string; config: CreateGameInput },
): Promise<{ favorite: GameFavorite; created: boolean }> {
  const existing = await db
    .prepare('SELECT id FROM quest_game_favorites WHERE organization_id = ? AND user_id = ? AND name = ?')
    .bind(org, input.userId, input.name)
    .first<{ id: string }>();
  const config = JSON.stringify(input.config);
  const now = new Date().toISOString();
  if (existing) {
    await db
      .prepare(
        `UPDATE quest_game_favorites SET name = ?, config = ?, updated_at = ?
         WHERE organization_id = ? AND user_id = ? AND id = ?`,
      )
      .bind(input.name, config, now, org, input.userId, existing.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO quest_game_favorites (id, organization_id, user_id, name, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), org, input.userId, input.name, config, now, now)
      .run();
  }
  const row = await db
    .prepare('SELECT id, name, config, updated_at FROM quest_game_favorites WHERE organization_id = ? AND user_id = ? AND name = ?')
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

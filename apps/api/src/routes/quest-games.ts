import { Hono } from 'hono';
import {
  GAME_LIMITS,
  createGameSchema,
  gameAnswerSchema,
  gameCodeSchema,
  gameFavoriteSchema,
  gameClimbLevelIds,
  gameLevelIds,
  gameLevelLabel,
  joinGameSchema,
  levelLabel,
  makeGameCode,
  type ApiOk,
  type EngineGame,
  type GameFavorite,
  type GameLevel,
  type GameLookup,
  type GameResults,
  type GameSummary,
  type GameView,
  type User,
} from '@tmi/shared';

import type { AppEnv, Env } from '../types.js';
import type { GameReply, GameViewer } from '../durable/quest-game.js';
import type { OrgId } from '../lib/org.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { countDrawableQuestions } from '../repositories/canvas-assessments.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import {
  codeInUse,
  deleteFavorite,
  findGameByCode,
  firstNameOf,
  insertGame,
  listFavorites,
  listGames,
  saveFavorite,
} from '../repositories/quest-games.js';

// Quest Games (Phase 46, docs/quest-games-plan.md), under Quest's switch: any
// member starts a game or joins one with a code. These routes check the person
// (requireAuth, requireOrg) and pass the request to the game's Durable Object,
// named by the organization AND the game -- so a game id from another
// organization reaches an empty object and is not found (R13, R20).

function gameStub(env: Env, org: OrgId, gameId: string) {
  return env.QUEST_GAMES.get(env.QUEST_GAMES.idFromName(`${org}:${gameId}`));
}

function viewerOf(user: User): GameViewer {
  return { id: user.id, admin: isAdmin(user) };
}

/** The object's answer, or its refusal as the envelope's error. */
function unwrap<T>(reply: GameReply<T>): T {
  if (reply.ok) return reply.data;
  if (reply.status === 404) throw ApiError.notFound(reply.message);
  if (reply.status === 403) throw new ApiError(403, 'forbidden', reply.message);
  throw ApiError.conflict(reply.message);
}

/** The bank's levels this organization offers (its curricula), with how many questions each has to play. */
async function playableLevels(db: D1Database, org: { id: OrgId; canvas_assessments_unreviewed: boolean }): Promise<GameLevel[]> {
  const offered = await listOrganizationCurricula(db, org.id);
  const live = new Set(offered.filter((cur) => !cur.retired).map((cur) => cur.id));
  const levels = await countDrawableQuestions(db, org.canvas_assessments_unreviewed, live);
  return levels.map((level) => ({ level_id: level.level_id, label: level.label, available: level.available }));
}

/** "a G5 Quest game", "a G5-and-up Quest game", "a single-player G5 Quest game": for the log. */
function gameWords(game: { level_id: string; level_scope?: 'level' | 'upward'; players?: 'single' | 'multi' }): string {
  const level = game.level_scope === 'upward' ? `${levelLabel(game.level_id)}-and-up` : levelLabel(game.level_id);
  return game.players === 'single' ? `a single-player ${level} Quest game` : `a ${level} Quest game`;
}

export const questGameRoutes = new Hono<AppEnv>()
  // The bank's levels this organization offers, with how many questions each has to play.
  .get('/levels', async (c) => {
    const body: ApiOk<GameLevel[]> = { data: await playableLevels(c.env.DB, c.get('org')) };
    return c.json(body);
  })

  // Phase 47: the person's own favorites here (a favorite is nobody else's; R20).
  .get('/favorites', async (c) => {
    const body: ApiOk<GameFavorite[]> = { data: await listFavorites(c.env.DB, c.get('org').id, c.get('user').id) };
    return c.json(body);
  })

  // Saves settings under a name, replacing the person's favorite of that name.
  .put('/favorites', zValidator('json', gameFavoriteSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const input = c.req.valid('json');
    const existing = await listFavorites(c.env.DB, org.id, user.id);
    const replacing = existing.some((f) => f.name.toLowerCase() === input.name.toLowerCase());
    if (!replacing && existing.length >= GAME_LIMITS.maxFavorites) {
      throw ApiError.conflict(`You can keep ${GAME_LIMITS.maxFavorites} favorites. Delete one to save another.`);
    }
    const saved = await saveFavorite(c.env.DB, org.id, { userId: user.id, name: input.name, config: input.config });
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_favorite_saved',
      description: saved.created
        ? `Saved the Quest game favorite "${saved.favorite.name}"`
        : `Updated the Quest game favorite "${saved.favorite.name}"`,
      entity_type: 'quest_game_favorite',
      entity_id: saved.favorite.id,
    });
    const body: ApiOk<GameFavorite> = { data: saved.favorite };
    return c.json(body, saved.created ? 201 : 200);
  })

  .delete('/favorites/:favoriteId', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const id = c.req.param('favoriteId');
    const name = await deleteFavorite(c.env.DB, org.id, user.id, id);
    if (name === null) throw ApiError.notFound('That favorite was not found.');
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_favorite_deleted',
      description: `Deleted the Quest game favorite "${name}"`,
      entity_type: 'quest_game_favorite',
      entity_id: id,
    });
    const body: ApiOk<{ id: string }> = { data: { id } };
    return c.json(body);
  })

  // A person's games: those they host or play (an admin's: every game here).
  .get('/', async (c) => {
    const body: ApiOk<GameSummary[]> = { data: await listGames(c.env.DB, c.get('org').id, viewerOf(c.get('user'))) };
    return c.json(body);
  })

  .post('/', zValidator('json', createGameSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const input = c.req.valid('json');
    const levels = await playableLevels(c.env.DB, org);
    if (!levels.some((level) => level.level_id === input.level_id)) {
      throw ApiError.badRequest('This organization does not offer that level.');
    }
    // Random draws from the level and those above it that have questions here.
    const playable = levels.filter((level) => level.available > 0).map((level) => level.level_id);
    const levelIds = gameLevelIds(input.level_id, input.level_scope, playable);
    // Phase 48: a level's game climbs into the ones above it once its players have seen too much of it,
    // so those count towards what it can play.
    const climbLevelIds = gameClimbLevelIds(input.level_id, input.level_scope, playable);
    const available = levels
      .filter((level) => levelIds.includes(level.level_id) || climbLevelIds.includes(level.level_id))
      .reduce((n, level) => n + level.available, 0);
    const named = gameLevelLabel(input, levelLabel);
    if (available === 0) throw ApiError.conflict(`${named} has no questions to play yet.`);
    if (input.mode === 'count' && available < input.question_count!) {
      throw ApiError.conflict(`${named} has only ${available} questions to play. Choose fewer.`);
    }

    let code: string | null = null;
    for (let tries = 0; tries < 6 && code === null; tries += 1) {
      const candidate = makeGameCode();
      if (!(await codeInUse(c.env.DB, candidate))) code = candidate;
    }
    if (code === null) throw ApiError.conflict('Could not make a game code just now. Try again.');

    const id = crypto.randomUUID();
    const now = Date.now();
    const durationSeconds = input.mode === 'timed' ? input.duration_minutes! * 60 : null;
    await insertGame(c.env.DB, org.id, {
      id,
      code,
      hostId: user.id,
      levelId: input.level_id,
      levelScope: input.level_scope,
      mode: input.mode,
      questionCount: input.mode === 'count' ? input.question_count! : null,
      durationSeconds,
      rightPoints: input.right_points,
      wrongPoints: input.wrong_points,
      knockout: input.knockout,
      players: input.players,
      maxTeams: input.max_teams,
      maxTeamSize: input.max_team_size,
      lateJoin: input.late_join,
    });
    const game: EngineGame = {
      id,
      organization_id: org.id,
      code,
      host: { user_id: user.id, first_name: firstNameOf(user.full_name) },
      level_id: input.level_id,
      level_scope: input.level_scope,
      level_ids: levelIds,
      climb_level_ids: climbLevelIds,
      mode: input.mode,
      question_count: input.mode === 'count' ? input.question_count! : null,
      duration_seconds: durationSeconds,
      right_points: input.right_points,
      wrong_points: input.wrong_points,
      negative_marking: input.wrong_points < 0,
      knockout: input.knockout,
      players: input.players,
      max_teams: input.max_teams,
      max_team_size: input.max_team_size,
      late_join: input.late_join,
      include_unreviewed: org.canvas_assessments_unreviewed,
      status: 'lobby',
      created_at: now,
      started_at: null,
      ended_at: null,
      end_reason: null,
      series_length: 0,
      teams: [],
    };
    // A single player's game is begun as it is made (the object draws its series now).
    const view = unwrap(await gameStub(c.env, org.id, id).create(game, org.canvas_assessments_unreviewed));
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_created',
      description:
        input.players === 'single' ? `Started ${gameWords(input)}` : `Started ${gameWords(input)} (code ${code})`,
      entity_type: 'quest_game',
      entity_id: id,
    });
    const body: ApiOk<GameView> = { data: view };
    return c.json(body, 201);
  })

  // A typed code: a game's own, or one of its teams'. Only codes made here are found.
  .post('/lookup', zValidator('json', gameCodeSchema), async (c) => {
    const org = c.get('org');
    const found = await findGameByCode(c.env.DB, org.id, c.req.valid('json').code);
    if (!found) throw ApiError.notFound('No game or team has that code.');
    const body: ApiOk<GameLookup> = {
      data: unwrap(await gameStub(c.env, org.id, found.game_id).lookup(viewerOf(c.get('user')), found.team_id)),
    };
    return c.json(body);
  })

  // The game now: its teams and scores, the clock, and the question in the person's hand.
  .get('/:id', async (c) => {
    const org = c.get('org');
    const body: ApiOk<GameView> = {
      data: unwrap(await gameStub(c.env, org.id, c.req.param('id')).view(viewerOf(c.get('user')))),
    };
    return c.json(body);
  })

  .post('/:id/join', zValidator('json', joinGameSchema), async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const id = c.req.param('id');
    const joined = unwrap(
      await gameStub(c.env, org.id, id).join({ id: user.id, first_name: firstNameOf(user.full_name) }, c.req.valid('json')),
    );
    const game = gameWords(joined.view);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_joined',
      description: joined.team.solo
        ? `Joined ${game} on their own`
        : joined.team.started
          ? `Started the team ${joined.team.name} in ${game}`
          : `Joined the team ${joined.team.name} in ${game}`,
      entity_type: 'quest_game',
      entity_id: id,
    });
    const body: ApiOk<GameView> = { data: joined.view };
    return c.json(body);
  })

  .post('/:id/leave', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const id = c.req.param('id');
    const stub = gameStub(c.env, org.id, id);
    const left = unwrap(await stub.leave(viewerOf(user)));
    if (left.left_lobby) {
      await recordAudit(c.env.DB, user, org.id, {
        action: 'quest.game_left',
        description: 'Left a Quest game before it began',
        entity_type: 'quest_game',
        entity_id: id,
      });
    }
    // Having left the lobby they may no longer see the game: say so plainly.
    const view = await stub.view(viewerOf(user));
    const body: ApiOk<GameView | null> = { data: view.ok ? view.data : null };
    return c.json(body);
  })

  .post('/:id/start', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const id = c.req.param('id');
    const view = unwrap(await gameStub(c.env, org.id, id).start(viewerOf(user), org.canvas_assessments_unreviewed));
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_started',
      description: `Began ${gameWords(view)} with ${view.teams.length} ${view.teams.length === 1 ? 'team' : 'teams'}`,
      entity_type: 'quest_game',
      entity_id: id,
    });
    const body: ApiOk<GameView> = { data: view };
    return c.json(body);
  })

  .post('/:id/end', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    const id = c.req.param('id');
    const view = unwrap(await gameStub(c.env, org.id, id).end(viewerOf(user)));
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_ended',
      description: `Ended ${gameWords(view)}`,
      entity_type: 'quest_game',
      entity_id: id,
    });
    const body: ApiOk<GameView> = { data: view };
    return c.json(body);
  })

  // One answer or skip; never an audit line (answers are the game's own record).
  .post('/:id/answer', zValidator('json', gameAnswerSchema), async (c) => {
    const org = c.get('org');
    const body: ApiOk<GameView> = {
      data: unwrap(await gameStub(c.env, org.id, c.req.param('id')).answer(viewerOf(c.get('user')), c.req.valid('json'))),
    };
    return c.json(body);
  })

  // After the game: a team's questions, with the right answers.
  .get('/:id/results', async (c) => {
    const org = c.get('org');
    const team = c.req.query('team') ?? null;
    const body: ApiOk<GameResults> = {
      data: unwrap(await gameStub(c.env, org.id, c.req.param('id')).results(viewerOf(c.get('user')), team)),
    };
    return c.json(body);
  });


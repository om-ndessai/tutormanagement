import { Hono, type Context } from 'hono';
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
  checkedQuestionsOn,
  type QuestMember,
  type WaitingGame,
} from '@tmi/shared';

import type { AppEnv, Env } from '../types.js';
import type { GameReply, GameViewer } from '../durable/quest-game.js';
import type { OrgId } from '../lib/org.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { cachedDrawableCounts } from '../repositories/level-counts.js';
import { isNewBest } from '../repositories/habit.js';
import { listOrganizationCurricula } from '../repositories/curricula.js';
import {
  codeInUse,
  deleteFavorite,
  findGameByCode,
  firstNameOf,
  insertGame,
  inviteToGame,
  listFavorites,
  listGames,
  rosterMembers,
  saveFavorite,
  waitingGames,
} from '../repositories/quest-games.js';

// Quest Games (Phase 46, docs/quest-games-plan.md), under Quest's switch: any
// member starts a game or joins one with a code. These routes check the person
// (requireAuth, requireOrg) and pass the request to the game's Durable Object,
// named by the organization AND the game -- so a game id from another
// organization reaches an empty object and is not found (R13, R20).

function gameStub(env: Env, org: OrgId, gameId: string) {
  return env.QUEST_GAMES.get(env.QUEST_GAMES.idFromName(`${org}:${gameId}`));
}

/** Phase 62 (P8): who is asking, for the roster rule (R27). */
function readerOf(c: Context<AppEnv>): { id: string; admin: boolean; selfServe: boolean } {
  const user = c.get('user');
  return { id: user.id, admin: isAdmin(user), selfServe: c.get('org').created_via === 'self_serve' };
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
async function playableLevels(db: D1Database, org: { id: OrgId; checked_questions: boolean }): Promise<GameLevel[]> {
  const offered = await listOrganizationCurricula(db, org.id);
  const live = new Set(offered.filter((cur) => !cur.retired).map((cur) => cur.id));
  // Phase 62 (P4): the platform's cached counts, not a count of the bank on every start.
  const levels = await cachedDrawableCounts(db, checkedQuestionsOn(org), live);
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

  /**
   * Phase 62 (P8, R27): who the reader may put on a roster -- every member of a self-serve space; in
   * any other, everyone for an admin and their own family for anyone else. First names only.
   */
  .get('/members', async (c) => {
    const members = await rosterMembers(c.env.DB, c.get('org').id, readerOf(c));
    const body: ApiOk<QuestMember[]> = { data: members.map((m) => ({ id: m.id, first_name: firstNameOf(m.full_name) })) };
    return c.json(body);
  })

  /** Phase 62 (P8): games a roster invited the reader to, not yet joined: "Waiting for you". */
  .get('/waiting', async (c) => {
    const body: ApiOk<WaitingGame[]> = { data: await waitingGames(c.env.DB, c.get('org').id, c.get('user').id) };
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
    // Phase 62 (P8): a roster names only people the reader may name (R27); anyone else is dropped.
    let roster = input.roster;
    if (roster) {
      const allowed = new Set((await rosterMembers(c.env.DB, org.id, readerOf(c))).map((m) => m.id));
      roster = roster.filter((id) => allowed.has(id));
    }
    const saved = await saveFavorite(c.env.DB, org.id, { userId: user.id, name: input.name, config: input.config, roster });
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
      throw ApiError.badRequest('This space does not offer that level.');
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
      include_unreviewed: checkedQuestionsOn(org),
      status: 'lobby',
      created_at: now,
      started_at: null,
      ended_at: null,
      end_reason: null,
      series_length: 0,
      teams: [],
    };
    // A single player's game is begun as it is made (the object draws its series now).
    const view = unwrap(await gameStub(c.env, org.id, id).create(game, checkedQuestionsOn(org), input.host_plays));
    // Phase 62 (P8): a roster favorite's people see it under "Waiting for you" (R27: only those the
    // host may name).
    let invited = 0;
    if (input.invite_user_ids.length > 0) {
      const allowed = new Set((await rosterMembers(c.env.DB, org.id, readerOf(c))).map((m) => m.id));
      invited = await inviteToGame(c.env.DB, org.id, { gameId: id, hostId: user.id, userIds: input.invite_user_ids, allowed });
    }
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_created',
      description:
        input.players === 'single'
          ? `Started ${gameWords(input)}`
          : `Started ${gameWords(input)} (code ${code})${invited > 0 ? `, inviting ${invited} ${invited === 1 ? 'person' : 'people'}` : ''}`,
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
    // Honest, and revealing nothing (owner, 2026-11-04; UI audit JF9): the same words whether the code is another
    // space's or nobody's (R13).
    if (!found) {
      throw ApiError.notFound(
        'No game in this space has that code. Games are joined inside their own space: ask your friend to invite you there, or start your own game.',
      );
    }
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
    const view = unwrap(await gameStub(c.env, org.id, id).start(viewerOf(user), checkedQuestionsOn(org)));
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
    const results = unwrap(await gameStub(c.env, org.id, c.req.param('id')).results(viewerOf(c.get('user')), team));
    // Phase 64 (P20): a single player's own results say whether they beat their best.
    const newBest =
      results.game.players === 'single' && results.game.status === 'finished'
        ? await isNewBest(c.env.DB, org.id, c.get('user').id, c.req.param('id'))
        : false;
    const body: ApiOk<GameResults> = { data: { ...results, new_best: newBest } };
    return c.json(body);
  });


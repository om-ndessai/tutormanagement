import { Hono } from 'hono';
import {
  assessmentLevelCurriculum,
  createGameSchema,
  gameAnswerSchema,
  gameCodeSchema,
  joinGameSchema,
  levelLabel,
  makeGameCode,
  type ApiOk,
  type EngineGame,
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
import { codeInUse, findGameByCode, firstNameOf, insertGame, listGames } from '../repositories/quest-games.js';

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

async function offeredLevel(db: D1Database, org: OrgId, levelId: string): Promise<boolean> {
  const curriculum = assessmentLevelCurriculum(levelId);
  if (curriculum === null) return true;
  const offered = await listOrganizationCurricula(db, org);
  return offered.some((c) => c.id === curriculum && !c.retired);
}

export const questGameRoutes = new Hono<AppEnv>()
  // The bank's levels this organization offers, with how many questions each has to play.
  .get('/levels', async (c) => {
    const org = c.get('org');
    const [levels, offered] = await Promise.all([
      countDrawableQuestions(c.env.DB, org.canvas_assessments_unreviewed),
      listOrganizationCurricula(c.env.DB, org.id),
    ]);
    const live = new Set(offered.filter((cur) => !cur.retired).map((cur) => cur.id));
    const body: ApiOk<GameLevel[]> = {
      data: levels
        .filter((level) => {
          const curriculum = assessmentLevelCurriculum(level.level_id);
          return curriculum === null || live.has(curriculum);
        })
        .map((level) => ({ level_id: level.level_id, label: level.label, available: level.available })),
    };
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
    if (!(await offeredLevel(c.env.DB, org.id, input.level_id))) {
      throw ApiError.badRequest('This organization does not offer that level.');
    }
    const available =
      (await countDrawableQuestions(c.env.DB, org.canvas_assessments_unreviewed)).find((l) => l.level_id === input.level_id)
        ?.available ?? 0;
    if (available === 0) throw ApiError.conflict(`${levelLabel(input.level_id)} has no questions to play yet.`);
    if (input.mode === 'count' && available < input.question_count!) {
      throw ApiError.conflict(`${levelLabel(input.level_id)} has only ${available} questions to play. Choose fewer.`);
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
      mode: input.mode,
      questionCount: input.mode === 'count' ? input.question_count! : null,
      durationSeconds,
      negativeMarking: input.negative_marking,
      maxTeamSize: input.max_team_size,
    });
    const game: EngineGame = {
      id,
      organization_id: org.id,
      code,
      host: { user_id: user.id, first_name: firstNameOf(user.full_name) },
      level_id: input.level_id,
      mode: input.mode,
      question_count: input.mode === 'count' ? input.question_count! : null,
      duration_seconds: durationSeconds,
      negative_marking: input.negative_marking,
      max_team_size: input.max_team_size,
      include_unreviewed: org.canvas_assessments_unreviewed,
      status: 'lobby',
      created_at: now,
      started_at: null,
      ended_at: null,
      series_length: 0,
      teams: [],
    };
    const view = unwrap(await gameStub(c.env, org.id, id).create(game));
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_created',
      description: `Started a ${levelLabel(input.level_id)} Quest game (code ${code})`,
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
    const level = levelLabel(joined.view.level_id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'quest.game_joined',
      description: joined.team.solo
        ? `Joined a ${level} Quest game on their own`
        : joined.team.started
          ? `Started the team ${joined.team.name} in a ${level} Quest game`
          : `Joined the team ${joined.team.name} in a ${level} Quest game`,
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
      description: `Began a ${levelLabel(view.level_id)} Quest game with ${view.teams.length} ${view.teams.length === 1 ? 'team' : 'teams'}`,
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
      description: `Ended a ${levelLabel(view.level_id)} Quest game`,
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


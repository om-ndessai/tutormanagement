import { DurableObject } from 'cloudflare:workers';
import {
  GAME_LIMITS,
  answerQuestion,
  findTeamOf,
  gameEndsAt,
  gameIsOver,
  makeGameCode,
  rankTeams,
  releaseHand,
  serveNext,
  teamTotals,
  type EngineGame,
  type EngineTeam,
  type GameAnswerInput,
  type GameLookup,
  type GameResults,
  type GameTeamView,
  type GameView,
  type JoinGameInput,
  type SeriesQuestion,
} from '@tmi/shared';

import type { Env } from '../types.js';
import { orgIdFromRow } from '../lib/org.js';
import {
  codeInUse,
  drawGameSeries,
  insertPlayer,
  insertTeamWithPlayer,
  markGameStarted,
  removePlayer,
  writeGameResults,
} from '../repositories/quest-games.js';

// Quest Games (Phase 46, docs/quest-games-plan.md): one Durable Object per
// game, named `<organization>:<game id>`. It holds the game in memory -- the
// teams, the series WITH its keys (never sent until the results), each team's
// queue and the question in each player's hand -- and handles one request at a
// time, which is what makes "the next question no teammate has been served"
// exact. Every change is written to the object's own storage too, so an object
// evicted from memory wakes with the game intact. Serving and answering read
// nothing from D1; D1 is written when a game is joined, started and ended.

/** A lobby nobody starts is closed after a day; a count game nobody finishes, after three hours. */
const LOBBY_TTL_MS = 24 * 60 * 60 * 1000;
const COUNT_GAME_TTL_MS = 3 * 60 * 60 * 1000;

export interface GameViewer {
  id: string;
  admin: boolean;
}

type Failure = { ok: false; status: 403 | 404 | 409; message: string };
export type GameReply<T> = { ok: true; data: T } | Failure;

const ok = <T>(data: T): GameReply<T> => ({ ok: true, data });
const notFound = (message = 'That game was not found.'): Failure => ({ ok: false, status: 404, message });
const conflict = (message: string): Failure => ({ ok: false, status: 409, message });
const forbidden = (message: string): Failure => ({ ok: false, status: 403, message });

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export class QuestGame extends DurableObject<Env> {
  private game: EngineGame | null = null;
  private series: SeriesQuestion[] = [];
  /** A start or an end is writing to D1: joins and starts wait their turn. */
  private busy = false;
  /** The results could not be written yet; the alarm tries again. */
  private unwritten = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.game = (await ctx.storage.get<EngineGame>('game')) ?? null;
      this.series = (await ctx.storage.get<SeriesQuestion[]>('series')) ?? [];
      this.unwritten = (await ctx.storage.get<boolean>('unwritten')) ?? false;
    });
  }

  private async save(): Promise<void> {
    await this.ctx.storage.put('game', this.game);
  }

  private canSee(game: EngineGame, viewer: GameViewer): boolean {
    return viewer.admin || game.host.user_id === viewer.id || findTeamOf(game, viewer.id) !== null;
  }

  /** Ends the game if its time is up or every team is done: true when it did. */
  private async settle(now: number): Promise<void> {
    const game = this.game;
    if (game && game.status === 'running' && gameIsOver(game, now)) await this.finish(now);
  }

  private async finish(now: number): Promise<void> {
    const game = this.game;
    if (!game || game.status === 'finished') return;
    game.status = 'finished';
    // A timed game ends at its clock, even when the end is noticed later.
    const endsAt = gameEndsAt(game);
    game.ended_at = endsAt !== null ? Math.min(now, endsAt) : now;
    for (const team of game.teams) team.hands = {};
    await this.save();
    await this.ctx.storage.deleteAlarm();
    await this.writeResults();
  }

  private async writeResults(): Promise<void> {
    if (!this.game) return;
    try {
      await writeGameResults(this.env.DB, orgIdFromRow(this.game.organization_id), this.game);
      this.unwritten = false;
      await this.ctx.storage.delete('unwritten');
    } catch (error) {
      console.error('Quest game results not written yet', error);
      this.unwritten = true;
      await this.ctx.storage.put('unwritten', true);
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }

  // ---------------------------------------------------------------------------
  // What the Worker's routes call (RPC)
  // ---------------------------------------------------------------------------

  /** Opens a new game, already recorded in D1. */
  async create(game: EngineGame): Promise<GameReply<GameView>> {
    if (this.game) return conflict('That game already exists.');
    this.game = game;
    await this.save();
    await this.ctx.storage.setAlarm(game.created_at + LOBBY_TTL_MS);
    return ok(this.toView(game, { id: game.host.user_id, admin: false }, Date.now()));
  }

  /** What a code shows before joining: anyone here with the code may see it. */
  async lookup(viewer: GameViewer, teamId: string | null): Promise<GameReply<GameLookup>> {
    const now = Date.now();
    await this.settle(now);
    const game = this.game;
    if (!game) return notFound('No game has that code.');
    const team = teamId ? game.teams.find((t) => t.id === teamId) : undefined;
    if (teamId && !team) return notFound('No team has that code.');
    return ok({
      game_id: game.id,
      team: team && team.code ? { id: team.id, name: team.name, code: team.code, players: team.players.length } : null,
      level_id: game.level_id,
      mode: game.mode,
      question_count: game.question_count,
      duration_seconds: game.duration_seconds,
      negative_marking: game.negative_marking,
      max_team_size: game.max_team_size,
      host_first_name: game.host.first_name,
      status: game.status,
      teams: game.teams.map((t) => ({ id: t.id, name: t.name, solo: t.solo, players: t.players.length })),
      joined: findTeamOf(game, viewer.id) !== null,
    });
  }

  /** The game as this person sees it now; while it runs, it hands them their question. */
  async view(viewer: GameViewer): Promise<GameReply<GameView>> {
    const now = Date.now();
    await this.settle(now);
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    const team = findTeamOf(game, viewer.id);
    if (team && game.status === 'running') {
      const before = team.hands[viewer.id]?.index;
      const index = serveNext(game, team, viewer.id, now);
      if (index !== null && index !== before) await this.save();
    }
    return ok(this.toView(game, viewer, now));
  }

  async join(
    person: { id: string; first_name: string },
    input: JoinGameInput,
  ): Promise<GameReply<{ view: GameView; team: { name: string; solo: boolean; started: boolean } }>> {
    const now = Date.now();
    await this.settle(now);
    const game = this.game;
    if (!game) return notFound();
    if (game.status !== 'lobby' || this.busy) return conflict('This game has started, so it cannot be joined now.');
    if (findTeamOf(game, person.id)) return conflict('You are in this game already.');
    const players = game.teams.reduce((n, t) => n + t.players.length, 0);
    if (players >= GAME_LIMITS.maxPlayers) return conflict('This game is full.');
    const org = orgIdFromRow(game.organization_id);
    const player = { user_id: person.id, first_name: person.first_name, joined_at: now };

    if (input.as === 'team') {
      const team = game.teams.find((t) => t.code === input.team_code);
      if (!team) return notFound('No team in this game has that code.');
      if (team.players.length >= game.max_team_size) return conflict('That team is full.');
      // Into memory first, so a second join in the same moment sees the place taken.
      team.players.push(player);
      try {
        await insertPlayer(this.env.DB, org, { gameId: game.id, teamId: team.id, userId: person.id });
      } catch (error) {
        team.players = team.players.filter((p) => p.user_id !== person.id);
        throw error;
      }
      await this.save();
      return ok({ view: this.toView(game, { id: person.id, admin: false }, now), team: { name: team.name, solo: false, started: false } });
    }

    if (input.as === 'new_team' && game.max_team_size === 1) {
      return conflict('This game is for players on their own.');
    }
    const solo = input.as === 'solo';
    let code: string | null = null;
    if (!solo) {
      for (let tries = 0; tries < 6 && code === null; tries += 1) {
        const candidate = makeGameCode();
        if (!(await codeInUse(this.env.DB, candidate))) code = candidate;
      }
      if (code === null) return conflict('Could not make a team code just now. Try again.');
      if (game.status !== 'lobby' || findTeamOf(game, person.id)) return conflict('This game has started, so it cannot be joined now.');
    }
    const team: EngineTeam = {
      id: crypto.randomUUID(),
      name: solo ? person.first_name : input.team_name,
      solo,
      code,
      created_by: person.id,
      players: [player],
      next: 0,
      returned: [],
      hands: {},
      answers: [],
      last: {},
      finished_at: null,
    };
    game.teams.push(team);
    try {
      await insertTeamWithPlayer(this.env.DB, org, {
        gameId: game.id,
        teamId: team.id,
        code,
        name: team.name,
        solo,
        userId: person.id,
      });
    } catch (error) {
      game.teams = game.teams.filter((t) => t.id !== team.id);
      throw error;
    }
    await this.save();
    return ok({ view: this.toView(game, { id: person.id, admin: false }, now), team: { name: team.name, solo, started: !solo } });
  }

  /** Before the start, leaves the game; during it, hands their question back to the team. */
  async leave(viewer: GameViewer): Promise<GameReply<{ left_lobby: boolean }>> {
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    const team = findTeamOf(game, viewer.id);
    if (!team) return conflict('You are not playing in this game.');
    if (game.status === 'running') {
      releaseHand(team, viewer.id);
      await this.save();
      return ok({ left_lobby: false });
    }
    if (game.status !== 'lobby' || this.busy) return conflict('This game has ended.');
    const dropTeam = team.players.length === 1;
    await removePlayer(this.env.DB, orgIdFromRow(game.organization_id), {
      gameId: game.id,
      teamId: team.id,
      userId: viewer.id,
      dropTeam,
    });
    team.players = team.players.filter((p) => p.user_id !== viewer.id);
    if (dropTeam) game.teams = game.teams.filter((t) => t.id !== team.id);
    await this.save();
    return ok({ left_lobby: true });
  }

  /** The host starts the game: the series is drawn once, here, and kept in memory. */
  async start(viewer: GameViewer, includeUnreviewed: boolean): Promise<GameReply<GameView>> {
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    if (game.host.user_id !== viewer.id) return forbidden('Only the person who started the game can begin it.');
    if (game.status !== 'lobby' || this.busy) return conflict('This game has already begun.');
    if (!game.teams.some((t) => t.players.length > 0)) return conflict('Nobody has joined yet.');
    this.busy = true;
    try {
      const wanted = game.mode === 'count' ? game.question_count! : GAME_LIMITS.timedSeries;
      const series = await drawGameSeries(this.env.DB, { levelId: game.level_id, count: wanted, includeUnreviewed });
      if (series.length === 0) return conflict('There are no questions to play at this level yet.');
      if (game.mode === 'count' && series.length < wanted) {
        return conflict(`This level has only ${series.length} question${series.length === 1 ? '' : 's'} to play. Choose fewer.`);
      }
      const now = Date.now();
      this.series = series;
      await this.ctx.storage.put('series', series);
      game.status = 'running';
      game.started_at = now;
      game.series_length = series.length;
      game.include_unreviewed = includeUnreviewed;
      await this.save();
      await markGameStarted(this.env.DB, orgIdFromRow(game.organization_id), {
        gameId: game.id,
        startedAt: now,
        seriesLength: series.length,
        includeUnreviewed,
      });
      await this.ctx.storage.setAlarm(gameEndsAt(game) ?? now + COUNT_GAME_TTL_MS);
      return ok(this.toView(game, viewer, now));
    } finally {
      this.busy = false;
    }
  }

  /** The host (or an admin) ends the game now. */
  async end(viewer: GameViewer): Promise<GameReply<GameView>> {
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    if (game.host.user_id !== viewer.id && !viewer.admin) return forbidden('Only the person who started the game can end it.');
    if (game.status === 'finished') return conflict('This game has ended already.');
    if (this.busy) return conflict('The game is starting. Try again in a moment.');
    await this.finish(Date.now());
    return ok(this.toView(game, viewer, Date.now()));
  }

  /** An answer (or a skip) to the question in hand; the reply carries the next one. */
  async answer(viewer: GameViewer, input: GameAnswerInput): Promise<GameReply<GameView>> {
    const now = Date.now();
    await this.settle(now);
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    const team = findTeamOf(game, viewer.id);
    if (!team) return conflict('You are not playing in this game.');
    const outcome = answerQuestion(game, team, this.series, {
      userId: viewer.id,
      questionId: input.question_id,
      answer: input.answer ?? null,
      skip: input.skip === true,
      now,
    });
    if (!outcome.ok) {
      if (outcome.reason === 'not_yours') {
        return conflict('That question is no longer yours to answer: a teammate has it, or it was answered.');
      }
      return conflict('The game is over.');
    }
    if (gameIsOver(game, now)) {
      await this.finish(now);
    } else {
      serveNext(game, team, viewer.id, now);
      await this.save();
    }
    return ok(this.toView(game, viewer, now));
  }

  /** After the game: a team's questions with their answers and solutions. */
  async results(viewer: GameViewer, teamId: string | null): Promise<GameReply<GameResults>> {
    const game = this.game;
    if (!game || !this.canSee(game, viewer)) return notFound();
    if (game.status !== 'finished') return conflict('The results come when the game ends.');
    const mine = findTeamOf(game, viewer.id);
    const overseer = viewer.admin || game.host.user_id === viewer.id;
    let team: EngineTeam | null | undefined;
    if (teamId) {
      team = game.teams.find((t) => t.id === teamId);
      // A player reads their own team's answers only.
      if (!team || (!overseer && team !== mine)) return notFound('That team was not found.');
    } else {
      const places = rankTeams(game);
      team = mine ?? [...game.teams].sort((a, b) => (places.get(a.id) ?? 99) - (places.get(b.id) ?? 99))[0] ?? null;
    }
    const names = new Map(game.teams.flatMap((t) => t.players.map((p) => [p.user_id, p.first_name] as const)));
    const items = (team?.answers ?? [])
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((a) => {
        const q = this.series[a.index]!;
        return {
          number: a.index + 1,
          question: { id: q.id, kind: q.kind, stem: q.stem, choices: q.choices, answer: q.answer, solution: q.solution },
          answered_by: names.get(a.user_id) ?? null,
          answer: a.answer,
          correct: a.correct,
          skipped: a.skipped,
        };
      });
    return ok({ game: this.toView(game, viewer, Date.now()), team_id: team?.id ?? null, items });
  }

  /** The end of a timed game, a lobby left unstarted, or a retry of the results. */
  override async alarm(): Promise<void> {
    const game = this.game;
    if (!game) return;
    const now = Date.now();
    if (game.status === 'lobby' && now >= game.created_at + LOBBY_TTL_MS) await this.finish(now);
    else if (game.status === 'running' && (gameIsOver(game, now) || now >= (game.started_at ?? now) + COUNT_GAME_TTL_MS)) {
      await this.finish(now);
    } else if (game.status === 'finished' && this.unwritten) await this.writeResults();
    else if (game.status === 'running') await this.ctx.storage.setAlarm(gameEndsAt(game) ?? (game.started_at ?? now) + COUNT_GAME_TTL_MS);
  }

  // ---------------------------------------------------------------------------

  private toView(game: EngineGame, viewer: GameViewer, now: number): GameView {
    const places = game.status === 'finished' ? rankTeams(game) : null;
    const mine = findTeamOf(game, viewer.id);
    const overseer = viewer.admin || game.host.user_id === viewer.id;
    const teams: GameTeamView[] = game.teams
      .filter((team) => team.players.length > 0 || team.answers.length > 0)
      .map((team) => {
        const totals = teamTotals(team.answers, game.negative_marking);
        return {
          id: team.id,
          name: team.name,
          solo: team.solo,
          code: team === mine || overseer ? team.code : null,
          players: team.players.map((p) => ({ user_id: p.user_id, first_name: p.first_name })),
          ...totals,
          answered: team.answers.length,
          finished_at: iso(team.finished_at),
          place: places?.get(team.id) ?? null,
        };
      });
    if (places) teams.sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    else if (game.status === 'running') teams.sort((a, b) => b.score - a.score || b.answered - a.answered);

    const hand = mine && game.status === 'running' ? mine.hands[viewer.id] : undefined;
    const question = hand ? this.series[hand.index] : undefined;
    return {
      id: game.id,
      code: game.code,
      level_id: game.level_id,
      mode: game.mode,
      question_count: game.question_count,
      duration_seconds: game.duration_seconds,
      negative_marking: game.negative_marking,
      max_team_size: game.max_team_size,
      unreviewed: game.include_unreviewed,
      status: game.status,
      host: game.host,
      is_host: game.host.user_id === viewer.id,
      created_at: iso(game.created_at)!,
      started_at: iso(game.started_at),
      ends_at: iso(gameEndsAt(game)),
      ended_at: iso(game.ended_at),
      now: iso(now)!,
      series_length: game.status === 'lobby' ? null : game.series_length,
      teams,
      me: {
        team_id: mine?.id ?? null,
        question:
          hand && question
            ? { id: question.id, kind: question.kind, stem: question.stem, choices: question.choices, number: hand.index + 1 }
            : null,
        last: mine?.last[viewer.id] ?? null,
        waiting: Boolean(mine && game.status === 'running' && !hand),
      },
    };
  }
}

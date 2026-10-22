import { z } from 'zod';
import { checkAnswer, QUESTION_BANK_LEVEL_IDS, type QuestionKind } from './questions.js';
import { QUEST_LEVEL_FAMILIES } from './quest.js';
import { refuseSsn } from './tax.js';

// ---------------------------------------------------------------------------
// Quest Games (Phase 46, docs/quest-games-plan.md)
// ---------------------------------------------------------------------------
// Under Quest, anyone signed in to the organization starts a game -- a level of
// the bank, a number of questions or a time limit, negative marking, a team
// size -- and anyone joins it with its code, on their own or in a team with a
// code of its own. Every team plays the same series, drawn once at the start;
// a teammate is served the next question no teammate has had. The rules below
// are pure: the game's Durable Object (apps/api/src/durable/quest-game.ts)
// runs them in memory, and the clients use the labels.
//
// Phase 47 (docs/quest-games-g2-plan.md) adds the start wizard's settings:
// Random from a level upward, points for right and for wrong, knockout, single
// player or multiplayer with the most teams, and joining left open once it
// starts; the countdown before the first question; and named favorites.

export const GAME_MODES = ['count', 'timed'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_STATUSES = ['lobby', 'running', 'finished'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** One level's questions, or (Random) the level and every level above it in its family. */
export const GAME_LEVEL_SCOPES = ['level', 'upward'] as const;
export type GameLevelScope = (typeof GAME_LEVEL_SCOPES)[number];

/** The host alone, for practice, or a game others join with its code. */
export const GAME_PLAYER_MODES = ['single', 'multi'] as const;
export type GamePlayerMode = (typeof GAME_PLAYER_MODES)[number];

/** Why a game ended: every team done, the clock, a knockout, the host, or left too long. */
export const GAME_END_REASONS = ['complete', 'time', 'knockout', 'host', 'expired'] as const;
export type GameEndReason = (typeof GAME_END_REASONS)[number];

export const GAME_LIMITS = {
  minQuestions: 1,
  maxQuestions: 50,
  minMinutes: 1,
  maxMinutes: 30,
  minTeamSize: 1,
  maxTeamSize: 6,
  defaultTeamSize: 4,
  /** The most questions a timed game draws: more than any team answers in 30 minutes. */
  timedSeries: 150,
  /** Players in one game, all teams together. */
  maxPlayers: 60,
  minRightPoints: 1,
  maxRightPoints: 10,
  minWrongPoints: -10,
  maxWrongPoints: 0,
  minTeams: 2,
  maxTeams: 20,
  defaultTeams: 10,
  /** Favorites one person keeps in one organization. */
  maxFavorites: 12,
} as const;

/** Between "Start the Quest" and the first question: every screen counts down to the same moment. */
export const GAME_COUNTDOWN_MS = 5000;

/** A question held this long while a teammate has nothing left passes to that teammate. */
export const GAME_STALE_HAND_MS = 2 * 60 * 1000;

/** How often the screens ask the game for the scoreboard and the clock. */
export const GAME_POLL_MS = 2000;

/** Codes: six of these, none that can be misread (no 0/O, 1/I/L). */
export const GAME_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const GAME_CODE_LENGTH = 6;

/** A fresh code from a source of random numbers in [0, 1). */
export function makeGameCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < GAME_CODE_LENGTH; i += 1) {
    code += GAME_CODE_ALPHABET[Math.floor(random() * GAME_CODE_ALPHABET.length)]!;
  }
  return code;
}

/** A typed code, tidied: "ab c-12d" -> "ABC12D". */
export function normalizeGameCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const gameCodeSchema = z.object({
  code: z
    .string()
    .transform(normalizeGameCode)
    .pipe(z.string().length(GAME_CODE_LENGTH, 'A code is six letters and numbers.')),
});
export type GameCodeInput = z.infer<typeof gameCodeSchema>;

const points = (min: number, max: number, what: string) =>
  z.number().int().min(min, `${what}: from ${min} to ${max}.`).max(max, `${what}: from ${min} to ${max}.`);

/**
 * A game's settings, as the start wizard sends them and a favorite keeps them.
 * An older app sends only level, length, negative_marking and team size: the
 * rest default to Phase 46's game (one level, right +1, wrong -1 or 0, a
 * multiplayer game, joining closed at the start).
 */
export const createGameSchema = z
  .object({
    level_id: z.enum(QUESTION_BANK_LEVEL_IDS, { message: 'Choose a level.' }),
    level_scope: z.enum(GAME_LEVEL_SCOPES).default('level'),
    mode: z.enum(GAME_MODES),
    question_count: z.number().int().min(GAME_LIMITS.minQuestions).max(GAME_LIMITS.maxQuestions).optional(),
    duration_minutes: z.number().int().min(GAME_LIMITS.minMinutes).max(GAME_LIMITS.maxMinutes).optional(),
    right_points: points(GAME_LIMITS.minRightPoints, GAME_LIMITS.maxRightPoints, 'Points for a right answer').optional(),
    wrong_points: points(GAME_LIMITS.minWrongPoints, GAME_LIMITS.maxWrongPoints, 'Points for a wrong answer').optional(),
    /** Phase 46's switch: wrong -1. Ignored when wrong_points is sent. */
    negative_marking: z.boolean().optional(),
    knockout: z.boolean().default(false),
    players: z.enum(GAME_PLAYER_MODES).default('multi'),
    max_teams: z.number().int().min(GAME_LIMITS.minTeams).max(GAME_LIMITS.maxTeams).optional(),
    max_team_size: z.number().int().min(GAME_LIMITS.minTeamSize).max(GAME_LIMITS.maxTeamSize),
    late_join: z.boolean().default(false),
  })
  .refine((value) => value.mode !== 'count' || value.question_count !== undefined, {
    message: `Choose how many questions (${GAME_LIMITS.minQuestions}-${GAME_LIMITS.maxQuestions}).`,
    path: ['question_count'],
  })
  .refine((value) => value.mode !== 'timed' || value.duration_minutes !== undefined, {
    message: `Choose how many minutes (${GAME_LIMITS.minMinutes}-${GAME_LIMITS.maxMinutes}).`,
    path: ['duration_minutes'],
  })
  .transform((value) => {
    const single = value.players === 'single';
    return {
      level_id: value.level_id,
      level_scope: value.level_scope,
      mode: value.mode,
      question_count: value.mode === 'count' ? value.question_count : undefined,
      duration_minutes: value.mode === 'timed' ? value.duration_minutes : undefined,
      right_points: value.right_points ?? 1,
      wrong_points: value.wrong_points ?? (value.negative_marking ? -1 : 0),
      // A single player has nobody to knock out, no teams to cap and nobody to let in late.
      knockout: single ? false : value.knockout,
      players: value.players,
      max_teams: single ? 1 : (value.max_teams ?? GAME_LIMITS.maxTeams),
      max_team_size: single ? 1 : value.max_team_size,
      late_join: single ? false : value.late_join,
    };
  });
/** What a client sends: the wizard's settings (the defaults are filled in by the schema). */
export type CreateGameRequest = z.input<typeof createGameSchema>;
/** The settings once checked, every default filled in. */
export type CreateGameInput = z.output<typeof createGameSchema>;

/** A person's named settings for a game (Phase 47): saved from the review, offered on the first step. */
export const gameFavoriteSchema = z.object({
  name: refuseSsn(z.string().trim().min(1, 'Name the favorite.').max(40, 'Keep the name under 40 characters.')),
  config: createGameSchema,
});
export type GameFavoriteRequest = z.input<typeof gameFavoriteSchema>;

export interface GameFavorite {
  id: string;
  name: string;
  config: CreateGameInput;
  updated_at: string;
}

const teamName = refuseSsn(z.string().trim().min(1, 'Name your team.').max(30, 'Keep the name under 30 characters.'));

/** How a player joins: on their own, by starting a team, or into a team by its code. */
export const joinGameSchema = z.discriminatedUnion('as', [
  z.object({ as: z.literal('solo') }),
  z.object({ as: z.literal('new_team'), team_name: teamName }),
  z.object({
    as: z.literal('team'),
    team_code: z.string().transform(normalizeGameCode).pipe(z.string().length(GAME_CODE_LENGTH, 'A code is six letters and numbers.')),
  }),
]);
export type JoinGameInput = z.infer<typeof joinGameSchema>;

/** One answer, or a skip, to the question in the player's hand. */
export const gameAnswerSchema = z
  .object({
    question_id: z.string().uuid(),
    answer: refuseSsn(z.string().trim().max(120, 'That answer is too long.')).optional(),
    skip: z.boolean().optional(),
  })
  .refine((value) => value.skip === true || (value.answer ?? '').length > 0, {
    message: 'Give an answer, or skip.',
    path: ['answer'],
  });
export type GameAnswerInput = z.infer<typeof gameAnswerSchema>;

// ---------------------------------------------------------------------------
// What the clients read
// ---------------------------------------------------------------------------

export interface GamePlayer {
  user_id: string;
  /** First names only: a child is shown to other children this way. */
  first_name: string;
}

export interface GameTeamView {
  id: string;
  name: string;
  solo: boolean;
  /** Shown to the team's own players, the host and admins; null to everyone else (and for a solo player). */
  code: string | null;
  players: GamePlayer[];
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Questions answered or skipped. */
  answered: number;
  /** When a count game's team had done every question. */
  finished_at: string | null;
  /** 1 for the winner; set once the game is finished. Tied teams share a place. */
  place: number | null;
}

/** The question in a player's hand: never its key. */
export interface GameQuestion {
  id: string;
  kind: QuestionKind;
  stem: string;
  choices: string[];
  /** Its place in the series, from 1. */
  number: number;
}

/** A game's settings, as every reply carries them (Phase 47's on top of Phase 46's). */
export interface GameSettings {
  level_id: string;
  level_scope: GameLevelScope;
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  right_points: number;
  wrong_points: number;
  /** Derived: wrong_points below 0. Kept for the app builds of Phase 46. */
  negative_marking: boolean;
  knockout: boolean;
  players: GamePlayerMode;
  max_teams: number;
  max_team_size: number;
  late_join: boolean;
}

export interface GameView extends GameSettings {
  id: string;
  code: string;
  /** The series may include questions not yet reviewed (the organization's switch at the start). */
  unreviewed: boolean;
  status: GameStatus;
  host: GamePlayer;
  is_host: boolean;
  created_at: string;
  /** The first question's moment: GAME_COUNTDOWN_MS after the host's start, so it may be a few seconds ahead of `now`. */
  started_at: string | null;
  /** A timed game's end. */
  ends_at: string | null;
  ended_at: string | null;
  /** Why it ended, once finished. */
  end_reason: GameEndReason | null;
  /** The server's clock, so a screen's countdown does not depend on the device's. */
  now: string;
  /** Questions in the series, once started. */
  series_length: number | null;
  teams: GameTeamView[];
  me: {
    team_id: string | null;
    /** The question to answer now, while the game runs. */
    question: GameQuestion | null;
    /** How their last answer went: shown for a moment. */
    last: { correct: boolean; skipped: boolean } | null;
    /** True while the game runs but the team has no question left to hand them. */
    waiting: boolean;
  };
}

/** Milliseconds until the first question (the doors' countdown), by the server's clock; 0 once it has begun. */
export function gameCountdownLeft(game: Pick<GameView, 'status' | 'started_at' | 'now'>, deviceOffsetMs = 0): number {
  if (game.status !== 'running' || game.started_at === null) return 0;
  return Math.max(0, Date.parse(game.started_at) - (Date.parse(game.now) + deviceOffsetMs));
}

/** What a code shows before joining: enough to choose how. */
export interface GameLookup extends GameSettings {
  game_id: string;
  /** Set when the code was a team's: joining joins that team. */
  team: { id: string; name: string; code: string; players: number } | null;
  host_first_name: string;
  status: GameStatus;
  teams: { id: string; name: string; solo: boolean; players: number }[];
  /** True when the person is in the game already. */
  joined: boolean;
  /** Whether a new player may join now (in the lobby, or while it runs with joining left open). */
  open: boolean;
}

/** One question of a team's series, after the game: the answer revealed. */
export interface GameResultItem {
  number: number;
  question: { id: string; kind: QuestionKind; stem: string; choices: string[]; answer: string; solution: string };
  /** Who on the team answered it, if anyone did. */
  answered_by: string | null;
  answer: string | null;
  correct: boolean;
  skipped: boolean;
}

export interface GameResults {
  game: GameView;
  team_id: string | null;
  items: GameResultItem[];
}

/** A game in a person's list. */
export interface GameSummary {
  id: string;
  code: string;
  level_id: string;
  level_scope: GameLevelScope;
  players: GamePlayerMode;
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  status: GameStatus;
  host_first_name: string;
  is_host: boolean;
  created_at: string;
  /** Their team's place, once finished. */
  place: number | null;
  teams: number;
}

/** A bank level a game may draw from, with how many questions it has to draw. */
export interface GameLevel {
  level_id: string;
  label: string;
  available: number;
}

// ---------------------------------------------------------------------------
// The rules, run by the game's Durable Object
// ---------------------------------------------------------------------------

export interface SeriesQuestion {
  id: string;
  kind: QuestionKind;
  stem: string;
  choices: string[];
  /** The key: never leaves the Worker until the results. */
  answer: string;
  solution: string;
}

export interface EngineAnswer {
  index: number;
  question_id: string;
  user_id: string;
  answer: string | null;
  correct: boolean;
  skipped: boolean;
  at: number;
}

export interface EngineTeam {
  id: string;
  name: string;
  solo: boolean;
  code: string | null;
  created_by: string;
  players: (GamePlayer & { joined_at: number })[];
  /** The next index of the series no teammate has been served. */
  next: number;
  /** Indices handed back (a player who left), served before `next`. */
  returned: number[];
  /** What each player holds now. */
  hands: Record<string, { index: number; served_at: number }>;
  answers: EngineAnswer[];
  /** The last answer per player, for the moment's "right!" or "not quite". */
  last: Record<string, { correct: boolean; skipped: boolean }>;
  finished_at: number | null;
}

export interface EngineGame {
  id: string;
  organization_id: string;
  code: string;
  host: GamePlayer;
  level_id: string;
  level_scope: GameLevelScope;
  /** The levels the series is drawn from: the level, or it and those above it the organization offers. */
  level_ids: string[];
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  right_points: number;
  wrong_points: number;
  negative_marking: boolean;
  knockout: boolean;
  players: GamePlayerMode;
  max_teams: number;
  max_team_size: number;
  late_join: boolean;
  include_unreviewed: boolean;
  status: GameStatus;
  created_at: number;
  /** The first question's moment (the countdown's end), in ms. */
  started_at: number | null;
  ended_at: number | null;
  end_reason: GameEndReason | null;
  series_length: number;
  teams: EngineTeam[];
}

/**
 * A game as a Durable Object stored it, with Phase 47's settings filled in for
 * one stored by Phase 46: one level, right +1, wrong by its negative marking,
 * multiplayer, joining closed at the start.
 */
export function normalizeEngineGame(stored: EngineGame): EngineGame {
  const game = stored as EngineGame & Partial<Pick<EngineGame, 'level_scope' | 'level_ids' | 'right_points'>>;
  return {
    ...game,
    level_scope: game.level_scope ?? 'level',
    level_ids: game.level_ids ?? [game.level_id],
    right_points: game.right_points ?? 1,
    wrong_points: game.wrong_points ?? (game.negative_marking ? -1 : 0),
    knockout: game.knockout ?? false,
    players: game.players ?? 'multi',
    max_teams: game.max_teams ?? GAME_LIMITS.maxTeams,
    late_join: game.late_join ?? false,
    end_reason: game.end_reason ?? null,
  };
}

/**
 * The levels a game draws from: the level itself, or -- Random -- it and every
 * level after it in its family (QUEST_LEVEL_FAMILIES), never one below. A
 * level in no family draws only itself. `offered` keeps it to the levels the
 * organization has questions in (its curricula), the chosen one always first.
 */
export function gameLevelIds(levelId: string, scope: GameLevelScope, offered?: readonly string[]): string[] {
  if (scope === 'level') return [levelId];
  const family = QUEST_LEVEL_FAMILIES.find((f) => (f as readonly string[]).includes(levelId)) as readonly string[] | undefined;
  const upward = family ? family.slice(family.indexOf(levelId)) : [levelId];
  return upward.filter((id) => id === levelId || !offered || offered.includes(id));
}

export interface GameScoring {
  right_points: number;
  wrong_points: number;
}

/** Phase 46's switch as points: right +1, wrong -1 or 0. */
function scoringOf(scoring: boolean | GameScoring): GameScoring {
  return typeof scoring === 'boolean' ? { right_points: 1, wrong_points: scoring ? -1 : 0 } : scoring;
}

/** A team's score and counts. A skip scores 0; the game's points (or Phase 46's switch) set the rest. */
export function teamTotals(
  answers: readonly EngineAnswer[],
  scoring: boolean | GameScoring,
): { score: number; correct: number; wrong: number; skipped: number } {
  const { right_points, wrong_points } = scoringOf(scoring);
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  for (const a of answers) {
    if (a.skipped) skipped += 1;
    else if (a.correct) correct += 1;
    else wrong += 1;
  }
  return { score: correct * right_points + wrong * wrong_points, correct, wrong, skipped };
}

/** A timed game's end, in ms; null for a count game or one not started. */
export function gameEndsAt(game: Pick<EngineGame, 'mode' | 'started_at' | 'duration_seconds'>): number | null {
  if (game.mode !== 'timed' || game.started_at === null || game.duration_seconds === null) return null;
  return game.started_at + game.duration_seconds * 1000;
}

export function findTeamOf(game: EngineGame, userId: string): EngineTeam | null {
  return game.teams.find((team) => team.players.some((p) => p.user_id === userId)) ?? null;
}

/** The teams still in the game: those with players, or with answers given before they left. */
function teamsInPlay(game: EngineGame): EngineTeam[] {
  return game.teams.filter((team) => team.players.length > 0);
}

/**
 * Knockout (Phase 47): true when one team's lowest possible final score is
 * above every other team's highest possible one -- nobody can catch it, so
 * the game need not go on. An unfinished team may still gain its remaining
 * questions times the points for right, and lose them times the points for
 * wrong (when that is below 0); a finished team's score is final.
 */
export function knockoutDecided(game: EngineGame): boolean {
  if (!game.knockout || game.players !== 'multi' || game.status !== 'running') return false;
  const teams = teamsInPlay(game);
  if (teams.length < 2) return false;
  const bounds = teams.map((team) => {
    const { score } = teamTotals(team.answers, game);
    const left = team.finished_at !== null ? 0 : Math.max(0, game.series_length - team.answers.length);
    return {
      min: score + left * Math.min(0, game.wrong_points),
      max: score + left * Math.max(0, game.right_points),
    };
  });
  return bounds.some((leader, i) => bounds.every((other, j) => i === j || leader.min > other.max));
}

/** Why the game should end now, or null: the time is up, every team has done every question, or a knockout. */
export function gameEndReason(game: EngineGame, now: number): GameEndReason | null {
  if (game.status !== 'running') return null;
  const endsAt = gameEndsAt(game);
  if (endsAt !== null && now >= endsAt) return 'time';
  const playing = teamsInPlay(game);
  if (playing.length > 0 && playing.every((team) => team.answers.length >= game.series_length)) return 'complete';
  if (knockoutDecided(game)) return 'knockout';
  return null;
}

/** True when the game should end now (or has ended). */
export function gameIsOver(game: EngineGame, now: number): boolean {
  if (game.status !== 'running') return game.status === 'finished';
  return gameEndReason(game, now) !== null;
}

/** Whether a new player may join now: in the lobby, or while it runs when the host left joining open. */
export function gameOpenToJoin(game: EngineGame, now: number): boolean {
  if (game.players === 'single') return false;
  if (game.status === 'lobby') return true;
  return game.status === 'running' && game.late_join && gameEndReason(game, now) === null;
}

/**
 * The question to hand a player now, as an index of the series, or null. The
 * one in their hand if they hold one (a reload keeps it); else a question a
 * teammate handed back; else the next one no teammate has been served; else a
 * teammate's question held past GAME_STALE_HAND_MS, which passes to them.
 * Marks the hand. Only while the game runs and its time is not up.
 */
export function serveNext(game: EngineGame, team: EngineTeam, userId: string, now: number): number | null {
  if (game.status !== 'running') return null;
  // The doors' countdown: nothing is served before the first question's moment.
  if (game.started_at !== null && now < game.started_at) return null;
  const endsAt = gameEndsAt(game);
  if (endsAt !== null && now >= endsAt) return null;
  const held = team.hands[userId];
  if (held) return held.index;
  let index: number | undefined = team.returned.shift();
  if (index === undefined && team.next < game.series_length) {
    index = team.next;
    team.next += 1;
  }
  if (index === undefined) {
    const stale = Object.entries(team.hands)
      .filter(([holder, hand]) => holder !== userId && now - hand.served_at >= GAME_STALE_HAND_MS)
      .sort((a, b) => a[1].served_at - b[1].served_at)[0];
    if (!stale) return null;
    delete team.hands[stale[0]];
    index = stale[1].index;
  }
  team.hands[userId] = { index, served_at: now };
  return index;
}

/** Hands a player's question back to the front of their team's queue (they left). */
export function releaseHand(team: EngineTeam, userId: string): void {
  const held = team.hands[userId];
  if (!held) return;
  delete team.hands[userId];
  team.returned.unshift(held.index);
}

export type AnswerOutcome =
  | { ok: true; correct: boolean; skipped: boolean }
  | { ok: false; reason: 'not_running' | 'not_yours' | 'time_up' | 'not_started' };

/**
 * Marks the answer (or skip) to the question in the player's hand, by code,
 * and records it on the team; a count game's team that has now done every
 * question is finished. Refused when the question is not the one they hold
 * (a teammate took it over, or it was answered) or the time is up.
 */
export function answerQuestion(
  game: EngineGame,
  team: EngineTeam,
  series: readonly SeriesQuestion[],
  input: { userId: string; questionId: string; answer: string | null; skip: boolean; now: number },
): AnswerOutcome {
  if (game.status !== 'running') return { ok: false, reason: 'not_running' };
  if (game.started_at !== null && input.now < game.started_at) return { ok: false, reason: 'not_started' };
  const endsAt = gameEndsAt(game);
  if (endsAt !== null && input.now >= endsAt) return { ok: false, reason: 'time_up' };
  const held = team.hands[input.userId];
  const question = held ? series[held.index] : undefined;
  if (!held || !question || question.id !== input.questionId) return { ok: false, reason: 'not_yours' };
  const skipped = input.skip || !input.answer;
  const correct = !skipped && checkAnswer({ kind: question.kind, answer: question.answer }, input.answer!);
  delete team.hands[input.userId];
  team.answers.push({
    index: held.index,
    question_id: question.id,
    user_id: input.userId,
    answer: skipped ? null : input.answer,
    correct,
    skipped,
    at: input.now,
  });
  team.last[input.userId] = { correct, skipped };
  if (team.finished_at === null && team.answers.length >= game.series_length) team.finished_at = input.now;
  return { ok: true, correct, skipped };
}

/** The time a team reached its final score: its last answer that changed the score. */
function scoreReachedAt(team: EngineTeam, scoring: GameScoring): number {
  let at = 0;
  for (const a of team.answers) {
    if (!a.skipped && (a.correct || scoring.wrong_points !== 0)) at = Math.max(at, a.at);
  }
  return at;
}

/**
 * The places, best first, for every team with players. The highest score
 * wins. A count game breaks a tie by finishing every question, then by the
 * earlier finish; a timed game by fewer wrong answers, then by reaching the
 * score first. Teams still level share the place.
 */
export function rankTeams(game: EngineGame): Map<string, number> {
  const teams = game.teams
    .filter((team) => team.players.length > 0 || team.answers.length > 0)
    .map((team) => {
      const totals = teamTotals(team.answers, game);
      return {
        id: team.id,
        score: totals.score,
        keys:
          game.mode === 'count'
            ? [team.finished_at === null ? 1 : 0, team.finished_at ?? 0]
            : [totals.wrong, scoreReachedAt(team, game)],
      };
    });
  const compare = (a: (typeof teams)[number], b: (typeof teams)[number]) =>
    b.score - a.score || a.keys[0]! - b.keys[0]! || a.keys[1]! - b.keys[1]!;
  teams.sort(compare);
  const places = new Map<string, number>();
  teams.forEach((team, i) => {
    const previous = teams[i - 1];
    places.set(team.id, previous && compare(previous, team) === 0 ? places.get(previous.id)! : i + 1);
  });
  return places;
}

// ---------------------------------------------------------------------------
// Words the screens share
// ---------------------------------------------------------------------------

export function gameLengthLabel(game: Pick<GameView, 'mode' | 'question_count' | 'duration_seconds'>): string {
  if (game.mode === 'count') return `${game.question_count ?? 0} question${game.question_count === 1 ? '' : 's'}`;
  const minutes = Math.round((game.duration_seconds ?? 0) / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** "Right +1, wrong −1": from the game's points, or Phase 46's switch. */
export function gameMarkingLabel(scoring: boolean | GameScoring): string {
  const { right_points, wrong_points } = scoringOf(scoring);
  return `Right ${signed(right_points)}, wrong ${signed(wrong_points)}`;
}

/** "+2" / "−1" / "0": a point value as a counter shows it. */
export function pointsLabel(points: number): string {
  return signed(points);
}

/** "G5" or "G5 and up, at random". */
export function gameLevelLabel(game: { level_id: string; level_scope?: GameLevelScope }, label: (id: string) => string): string {
  return game.level_scope === 'upward' ? `${label(game.level_id)} and up, at random` : label(game.level_id);
}

/** Who plays, in words: "Single player", "Up to 10 players on their own", "Up to 10 teams of up to 4". */
export function gamePlayersLabel(game: Pick<GameSettings, 'players' | 'max_teams' | 'max_team_size'>): string {
  if (game.players === 'single') return 'Single player';
  if (game.max_team_size === 1) return `Up to ${game.max_teams} players, each on their own`;
  return `Up to ${game.max_teams} teams of up to ${game.max_team_size}`;
}

/** The ending's headline beside the winners: why it ended, when it ended early. */
export function gameEndLabel(reason: GameEndReason | null): string | null {
  if (reason === 'knockout') return 'Knockout! Nobody could catch the leader.';
  if (reason === 'time') return 'Time is up.';
  if (reason === 'host') return 'The host ended the game.';
  if (reason === 'expired') return 'The game was closed.';
  return null;
}

/**
 * A line for a team that did not win: about their own game, never how far
 * behind they were (Phase 47, "positive encouragement").
 */
export function gameEncouragement(team: Pick<GameTeamView, 'correct' | 'answered' | 'solo'>): string {
  const you = team.solo ? 'You' : 'Your team';
  if (team.correct === 0) return team.answered === 0 ? 'Next game is yours. Jump in early!' : 'Every question you try makes the next one easier. Go again!';
  if (team.answered > 0 && team.correct === team.answered) return `${you} got every one you answered right. Brilliant!`;
  return `${you} got ${team.correct} right. Great effort, and every game makes you sharper!`;
}

/** "1st", "2nd", "3rd", "4th". */
export function placeLabel(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  return `${place}${['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'}`;
}

/** "4:05" left, from milliseconds; never below zero. */
export function clockLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The winning teams' names, for the results' headline. */
export function winnersLabel(teams: readonly GameTeamView[]): string {
  const winners = teams.filter((team) => team.place === 1).map((team) => team.name);
  if (winners.length === 0) return 'Nobody played';
  if (winners.length === 1) return `${winners[0]} wins!`;
  return `${winners.slice(0, -1).join(', ')} and ${winners.at(-1)} share first place!`;
}

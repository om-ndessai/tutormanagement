import { z } from 'zod';
import { checkAnswer, QUESTION_BANK_LEVEL_IDS, type QuestionKind } from './questions.js';
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

export const GAME_MODES = ['count', 'timed'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const GAME_STATUSES = ['lobby', 'running', 'finished'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

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
} as const;

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

export const createGameSchema = z
  .object({
    level_id: z.enum(QUESTION_BANK_LEVEL_IDS, { message: 'Choose a level.' }),
    mode: z.enum(GAME_MODES),
    question_count: z.number().int().min(GAME_LIMITS.minQuestions).max(GAME_LIMITS.maxQuestions).optional(),
    duration_minutes: z.number().int().min(GAME_LIMITS.minMinutes).max(GAME_LIMITS.maxMinutes).optional(),
    negative_marking: z.boolean(),
    max_team_size: z.number().int().min(GAME_LIMITS.minTeamSize).max(GAME_LIMITS.maxTeamSize),
  })
  .refine((value) => value.mode !== 'count' || value.question_count !== undefined, {
    message: `Choose how many questions (${GAME_LIMITS.minQuestions}-${GAME_LIMITS.maxQuestions}).`,
    path: ['question_count'],
  })
  .refine((value) => value.mode !== 'timed' || value.duration_minutes !== undefined, {
    message: `Choose how many minutes (${GAME_LIMITS.minMinutes}-${GAME_LIMITS.maxMinutes}).`,
    path: ['duration_minutes'],
  });
export type CreateGameInput = z.infer<typeof createGameSchema>;

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

export interface GameView {
  id: string;
  code: string;
  level_id: string;
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  negative_marking: boolean;
  max_team_size: number;
  /** The series may include questions not yet reviewed (the organization's switch at the start). */
  unreviewed: boolean;
  status: GameStatus;
  host: GamePlayer;
  is_host: boolean;
  created_at: string;
  started_at: string | null;
  /** A timed game's end. */
  ends_at: string | null;
  ended_at: string | null;
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

/** What a code shows before joining: enough to choose how. */
export interface GameLookup {
  game_id: string;
  /** Set when the code was a team's: joining joins that team. */
  team: { id: string; name: string; code: string; players: number } | null;
  level_id: string;
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  negative_marking: boolean;
  max_team_size: number;
  host_first_name: string;
  status: GameStatus;
  teams: { id: string; name: string; solo: boolean; players: number }[];
  /** True when the person is in the game already. */
  joined: boolean;
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
  mode: GameMode;
  question_count: number | null;
  duration_seconds: number | null;
  negative_marking: boolean;
  max_team_size: number;
  include_unreviewed: boolean;
  status: GameStatus;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
  series_length: number;
  teams: EngineTeam[];
}

export function teamTotals(
  answers: readonly EngineAnswer[],
  negativeMarking: boolean,
): { score: number; correct: number; wrong: number; skipped: number } {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  for (const a of answers) {
    if (a.skipped) skipped += 1;
    else if (a.correct) correct += 1;
    else wrong += 1;
  }
  return { score: correct - (negativeMarking ? wrong : 0), correct, wrong, skipped };
}

/** A timed game's end, in ms; null for a count game or one not started. */
export function gameEndsAt(game: Pick<EngineGame, 'mode' | 'started_at' | 'duration_seconds'>): number | null {
  if (game.mode !== 'timed' || game.started_at === null || game.duration_seconds === null) return null;
  return game.started_at + game.duration_seconds * 1000;
}

export function findTeamOf(game: EngineGame, userId: string): EngineTeam | null {
  return game.teams.find((team) => team.players.some((p) => p.user_id === userId)) ?? null;
}

/** True when the game should end now: the time is up, or every team has done every question. */
export function gameIsOver(game: EngineGame, now: number): boolean {
  if (game.status !== 'running') return game.status === 'finished';
  const endsAt = gameEndsAt(game);
  if (endsAt !== null && now >= endsAt) return true;
  const playing = game.teams.filter((team) => team.players.length > 0);
  return playing.length > 0 && playing.every((team) => team.answers.length >= game.series_length);
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
  | { ok: false; reason: 'not_running' | 'not_yours' | 'time_up' };

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
function scoreReachedAt(team: EngineTeam, negativeMarking: boolean): number {
  let at = 0;
  for (const a of team.answers) {
    if (!a.skipped && (a.correct || negativeMarking)) at = Math.max(at, a.at);
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
      const totals = teamTotals(team.answers, game.negative_marking);
      return {
        id: team.id,
        score: totals.score,
        keys:
          game.mode === 'count'
            ? [team.finished_at === null ? 1 : 0, team.finished_at ?? 0]
            : [totals.wrong, scoreReachedAt(team, game.negative_marking)],
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

export function gameMarkingLabel(negativeMarking: boolean): string {
  return negativeMarking ? 'Right +1, wrong −1' : 'Right +1, wrong 0';
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

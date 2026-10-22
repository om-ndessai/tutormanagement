// Quest Games' pure rules for the app's screens (Phase 46, design 60), from
// apps/web/src/features/quest/{games-api.ts, games-card.tsx, game-page.tsx} @ cd0378d (working
// tree): when the game is polled, the lines and labels the screens show (the web's copy), what a
// Create sends, the moment's notice after an answer, the clock on the server's time, and the native
// line of each result. Pure: no React, no api client. The game's own rules live in @tmi/shared.
import {
  GAME_CODE_LENGTH,
  GAME_LIMITS,
  GAME_POLL_MS,
  createGameSchema,
  gameLengthLabel,
  gameMarkingLabel,
  levelLabel,
  normalizeGameCode,
  placeLabel,
  type CreateGameInput,
  type GameMode,
  type GameResultItem,
  type GameStatus,
  type GameSummary,
  type GameTeamView,
  type GameView,
} from '@tmi/shared';

import { questChoiceText } from './quest-html';

// --- Polling ----------------------------------------------------------------------------------

/** How often the game is read: every GAME_POLL_MS while the screen is focused and the game not over. */
export function gamePollInterval(active: boolean, status: GameStatus | undefined): number | false {
  return active && status !== 'finished' ? GAME_POLL_MS : false;
}

// --- The hub ----------------------------------------------------------------------------------

/** What a typed code becomes as it is typed: "ab c-12d" -> "ABC12D", at most six. */
export function gameCodeInput(text: string): string {
  return normalizeGameCode(text).slice(0, GAME_CODE_LENGTH);
}

export function gameCodeReady(code: string): boolean {
  return code.length === GAME_CODE_LENGTH;
}

/** A games-list row's trailing status: "Waiting to start", "Playing now", "Finished · 1st". */
export function gameRowStatus(game: Pick<GameSummary, 'status' | 'place'>): string {
  if (game.status === 'finished') return game.place ? `Finished · ${placeLabel(game.place)}` : 'Finished';
  return game.status === 'running' ? 'Playing now' : 'Waiting to start';
}

/** A games-list row's second line: "You host · 2 teams", "Priya hosts · 1 team". */
export function gameRowHost(game: Pick<GameSummary, 'is_host' | 'host_first_name' | 'teams'>): string {
  return `${game.is_host ? 'You host' : `${game.host_first_name} hosts`} · ${game.teams} ${game.teams === 1 ? 'team' : 'teams'}`;
}

/** A games-list row's title: "G6 · 2 questions". */
export function gameRowTitle(
  game: Pick<GameSummary, 'level_id' | 'mode' | 'question_count' | 'duration_seconds'>,
): string {
  return `${levelLabel(game.level_id)} · ${gameLengthLabel(game)}`;
}

/** The share sheet's text: the code and nothing else (no name, no organization). */
export function shareText(code: string): string {
  return `Join my Quest game with the code ${code}.`;
}

/** A code spelled out for a screen reader: "A B C 2 3 4". */
export function spelledCode(code: string): string {
  return code.split('').join(' ');
}

// --- The rules of a game ----------------------------------------------------------------------

/** "teams of up to 4", or "everyone on their own". */
export function teamsLabel(maxTeamSize: number): string {
  return maxTeamSize === 1 ? 'everyone on their own' : `teams of up to ${maxTeamSize}`;
}

/** The team-size choice's label: "On their own", then the number. */
export function teamSizeLabel(size: number): string {
  return size === 1 ? 'On their own' : String(size);
}

/** The team-size choice read aloud: the web's option text. */
export function teamSizeSpeech(size: number): string {
  return size === 1 ? 'Everyone on their own' : `Up to ${size} a team`;
}

/** "G6 · 2 questions · Right +1, wrong 0 · teams of up to 2 · may include questions not yet reviewed". */
export function gameRulesLine(
  game: Pick<
    GameView,
    | 'level_id'
    | 'mode'
    | 'question_count'
    | 'duration_seconds'
    | 'negative_marking'
    | 'max_team_size'
    | 'unreviewed'
  >,
): string {
  return (
    `${levelLabel(game.level_id)} · ${gameLengthLabel(game)} · ${gameMarkingLabel(game.negative_marking)} · ` +
    `${teamsLabel(game.max_team_size)}${game.unreviewed ? ' · may include questions not yet reviewed' : ''}`
  );
}

/** The join sheet's line: "Priya’s game · Right +1, wrong 0 · teams of up to 2". */
export function lookupLine(lookup: {
  host_first_name: string;
  negative_marking: boolean;
  max_team_size: number;
}): string {
  return `${lookup.host_first_name}’s game · ${gameMarkingLabel(lookup.negative_marking)} · ${teamsLabel(lookup.max_team_size)}`;
}

/** A game the code found that has gone past its lobby. */
export function notJoinableText(status: GameStatus): string {
  return `This game has ${status === 'running' ? 'started' : 'ended'}, so it cannot be joined now.`;
}

// --- Starting a game --------------------------------------------------------------------------

/** The range under the amount, the web's words: "questions (1-50)", "minutes (1-30)". */
export function amountHint(mode: GameMode): string {
  return mode === 'count'
    ? `questions (${GAME_LIMITS.minQuestions}-${GAME_LIMITS.maxQuestions})`
    : `minutes (${GAME_LIMITS.minMinutes}-${GAME_LIMITS.maxMinutes})`;
}

/** What is wrong with the amount as typed, in the shared schema's words; null when it will do. */
export function amountProblem(mode: GameMode, text: string): string | null {
  const trimmed = text.trim();
  const amount = Number(trimmed);
  const [min, max] =
    mode === 'count'
      ? [GAME_LIMITS.minQuestions, GAME_LIMITS.maxQuestions]
      : [GAME_LIMITS.minMinutes, GAME_LIMITS.maxMinutes];
  if (trimmed !== '' && /^\d+$/.test(trimmed) && Number.isInteger(amount) && amount >= min && amount <= max) {
    return null;
  }
  return mode === 'count'
    ? `Choose how many questions (${min}-${max}).`
    : `Choose how many minutes (${min}-${max}).`;
}

export interface NewGameForm {
  levelId: string;
  mode: GameMode;
  /** The amount as typed: questions for a count game, minutes for a timed one. */
  amount: string;
  negativeMarking: boolean;
  teamSize: number;
}

/** What Create sends, checked with the shared schema; null while the form will not do. */
export function createInput(form: NewGameForm): CreateGameInput | null {
  if (amountProblem(form.mode, form.amount) !== null) return null;
  const amount = Number(form.amount.trim());
  const parsed = createGameSchema.safeParse({
    level_id: form.levelId,
    mode: form.mode,
    negative_marking: form.negativeMarking,
    max_team_size: form.teamSize,
    ...(form.mode === 'count' ? { question_count: amount } : { duration_minutes: amount }),
  });
  return parsed.success ? parsed.data : null;
}

// --- In the game ------------------------------------------------------------------------------

/** "Quest game · G6", or "Quest game" before it is read. */
export function gameTitle(game: Pick<GameView, 'level_id'> | undefined): string {
  return game ? `Quest game · ${levelLabel(game.level_id)}` : 'Quest game';
}

/** "1 point", "3 points", "-1 points" (a score may go below zero with negative marking). */
export function scoreLabel(score: number): string {
  return `${score} ${score === 1 ? 'point' : 'points'}`;
}

/** "1 player", "3 players": the lobby's scoreboard title. */
export function playersLabel(game: Pick<GameView, 'teams'>): string {
  const players = game.teams.reduce((n, team) => n + team.players.length, 0);
  return `${players} ${players === 1 ? 'player' : 'players'}`;
}

export function playerCount(game: Pick<GameView, 'teams'>): number {
  return game.teams.reduce((n, team) => n + team.players.length, 0);
}

/**
 * The series length to show beside a question or a team's count: a count game's only. A timed
 * game's series is just the most it draws (150): never "of 150" (the web, 2026-10-21).
 */
export function seriesTotal(game: Pick<GameView, 'mode' | 'series_length'>): number | null {
  return game.mode === 'count' ? game.series_length : null;
}

/** "Question 2 of 5", or "Question 2" in a timed game. */
export function questionHeading(number: number, total: number | null): string {
  return `Question ${number}${total !== null ? ` of ${total}` : ''}`;
}

/** Under a team's score: "1/2" while a count game's team plays, "Done", or the count answered. */
export function teamProgress(
  team: Pick<GameTeamView, 'answered' | 'finished_at'>,
  total: number | null,
): string {
  if (total !== null && team.finished_at === null) return `${team.answered}/${total}`;
  return team.finished_at ? 'Done' : `${team.answered}`;
}

/** A team's row, read as one line: "1st, Owls, you, Alex and Sofia, 3 points, 2/2". */
export function teamRowSpeech(
  team: GameTeamView,
  { mine, total, showScore }: { mine: boolean; total: number | null; showScore: boolean },
): string {
  const parts: string[] = [];
  if (team.place !== null) parts.push(placeLabel(team.place));
  parts.push(mine ? `${team.name} (you)` : team.name);
  if (!team.solo && team.players.length > 0) parts.push(listNames(team.players.map((p) => p.first_name)));
  if (showScore) {
    parts.push(scoreLabel(team.score));
    parts.push(teamProgress(team, total));
  }
  return parts.join(', ');
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Whoever oversees the game (its host, or an admin not playing): may read every team's results. */
export function isOverseer(game: Pick<GameView, 'is_host' | 'me'>): boolean {
  return game.is_host || game.me.team_id === null;
}

export interface AnswerNotice {
  text: string;
  tone: 'success' | 'error' | 'info';
}

/** The moment's word after an answer: "Right!", "Not quite.", "Not quite. −1", "Skipped.". */
export function answerNotice(
  last: { correct: boolean; skipped: boolean } | null | undefined,
  negativeMarking: boolean,
): AnswerNotice {
  if (last?.skipped) return { text: 'Skipped.', tone: 'info' };
  if (last?.correct) return { text: 'Right!', tone: 'success' };
  return { text: negativeMarking ? 'Not quite. −1' : 'Not quite.', tone: 'error' };
}

export const HOSTING_TEXT = 'You are hosting. The scores update as the teams play.';
export const MISSING_TEXT =
  'This game was not found, or you are not in it. Join it with its code from the Quest page.';
export const WAITING_TITLE = 'Your team has no more questions to hand out.';

export function waitingText(mode: GameMode): string {
  return `Your teammates are answering the last ones. The game ends when every team is done${mode === 'timed' ? ' or the time is up' : ''}.`;
}

// --- The clock --------------------------------------------------------------------------------

/**
 * Milliseconds left on a timed game, ticking on the device but set by the server's clock (the web's
 * useTimeLeft): the device's offset from the server is taken when the game was read. Never below 0.
 */
export function timeLeftMs(endsAt: string, serverNow: string, receivedAt: number, deviceNow: number): number {
  const offset = Date.parse(serverNow) - receivedAt;
  return Math.max(0, Date.parse(endsAt) - (deviceNow + offset));
}

/** The clock read aloud: "4 minutes 5 seconds left", "10 seconds left", "Time is up". */
export function clockSpeech(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total === 0) return 'Time is up';
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts = [
    minutes > 0 ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : null,
    seconds > 0 ? `${seconds} ${seconds === 1 ? 'second' : 'seconds'}` : null,
  ].filter(Boolean);
  return `${parts.join(' ')} left`;
}

/** The moments the clock is announced: one minute and ten seconds left. */
export const CLOCK_ANNOUNCE_SECONDS = [60, 10] as const;

/** The announcement due as the clock passes from `before` to `after` ms, if any. */
export function clockAnnouncement(before: number | null, after: number): string | null {
  if (before === null) return null;
  for (const seconds of CLOCK_ANNOUNCE_SECONDS) {
    const at = seconds * 1000;
    if (before > at && after <= at) return seconds === 60 ? 'One minute left' : 'Ten seconds left';
  }
  return null;
}

/** Under this the clock turns to the error colour. */
export const CLOCK_URGENT_MS = 30_000;

// --- The results ------------------------------------------------------------------------------

export function outcomeLabel(item: Pick<GameResultItem, 'correct' | 'skipped'>): string {
  return item.skipped ? 'Skipped' : item.correct ? 'Right' : 'Not quite';
}

/** A result's native line: "Question 1 · Right · Sofia · Answered: 5 to 3 · Answer: 5 to 3". */
export function reviewLine(item: GameResultItem): string {
  const parts = [`Question ${item.number}`, outcomeLabel(item)];
  if (item.answered_by) parts.push(item.answered_by);
  if (!item.skipped && item.answer !== null) parts.push(`Answered: ${questChoiceText(item.answer)}`);
  parts.push(`Answer: ${questChoiceText(item.question.answer)}`);
  return parts.join(' · ');
}

export const NO_ANSWERS_TEXT = 'No questions were answered.';

/** The review's heading: "Owls’s questions", or "Questions". */
export function reviewHeading(teamName: string | undefined): string {
  return teamName ? `${teamName}’s questions` : 'Questions';
}

/** Whether to celebrate: the game is finished and your team placed first. */
export function wonGame(game: Pick<GameView, 'status' | 'teams' | 'me'>): boolean {
  if (game.status !== 'finished' || game.me.team_id === null) return false;
  return game.teams.some((team) => team.id === game.me.team_id && team.place === 1);
}

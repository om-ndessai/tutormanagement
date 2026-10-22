// Quest Games' pure rules for the app's screens (Phase 46, design 60), from
// apps/web/src/features/quest/{games-api.ts, games-card.tsx, game-page.tsx} @ cd0378d (working
// tree): when the game is polled, the lines and labels the screens show (the web's copy), the moment's
// notice after an answer, the clock on the server's time, and the native line of each result. Phase 47
// (design 61) @ 9eccdf2 (working tree): the settings' words (the level's scope, the points, who plays,
// knockout, late joining), the lookup's single-player and late-joining lines, the lobby's label and
// board, the waiting card once a team is done, the results' headline and encouragement, who is
// celebrated, and the doors' countdown words. What a Create sends is game-wizard-model.ts now. Pure: no
// React, no api client. The game's own rules live in @tmi/shared.
import {
  GAME_CODE_LENGTH,
  GAME_POLL_MS,
  gameEncouragement,
  gameLengthLabel,
  gameLevelLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  levelLabel,
  normalizeGameCode,
  placeLabel,
  // Quest's own `pointsLabel` (quest-model.ts) means a count of points; this one is "+2" / "−3".
  pointsLabel as signedPoints,
  winnersLabel,
  type GameLookup,
  type GameMode,
  type GameResultItem,
  type GameScoring,
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

/** A games-list row's second line: "You host · 2 teams", "Priya hosts · 1 team", "Single player". */
export function gameRowHost(
  game: Pick<GameSummary, 'is_host' | 'host_first_name' | 'teams'> & Partial<Pick<GameSummary, 'players'>>,
): string {
  if (game.players === 'single') return 'Single player';
  return `${game.is_host ? 'You host' : `${game.host_first_name} hosts`} · ${game.teams} ${game.teams === 1 ? 'team' : 'teams'}`;
}

/** A games-list row's title: "G6 · 2 questions", "G5 and up, at random · 5 minutes". */
export function gameRowTitle(
  game: Pick<GameSummary, 'level_id' | 'mode' | 'question_count' | 'duration_seconds'> &
    Partial<Pick<GameSummary, 'level_scope'>>,
): string {
  return `${gameLevelLabel(game, levelLabel)} · ${gameLengthLabel(game)}`;
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

/**
 * The web's Rules: "G6 · 2 questions · Right +1, wrong −1 · Up to 20 teams of up to 2 · knockout ·
 * joining open while it runs · may include questions not yet reviewed".
 */
export function gameRulesLine(
  game: Pick<
    GameView,
    | 'level_id'
    | 'level_scope'
    | 'mode'
    | 'question_count'
    | 'duration_seconds'
    | 'right_points'
    | 'wrong_points'
    | 'players'
    | 'max_teams'
    | 'max_team_size'
    | 'knockout'
    | 'late_join'
    | 'unreviewed'
  >,
): string {
  return (
    `${gameLevelLabel(game, levelLabel)} · ${gameLengthLabel(game)} · ${gameMarkingLabel(game)} · ` +
    `${gamePlayersLabel(game)}${game.knockout ? ' · knockout' : ''}` +
    `${game.late_join ? ' · joining open while it runs' : ''}` +
    `${game.unreviewed ? ' · may include questions not yet reviewed' : ''}`
  );
}

/** The join sheet's line: "Priya’s game · Right +1, wrong 0 · Up to 20 teams of up to 2 · knockout". */
export function lookupLine(
  lookup: Pick<
    GameLookup,
    | 'host_first_name'
    | 'right_points'
    | 'wrong_points'
    | 'players'
    | 'max_teams'
    | 'max_team_size'
    | 'knockout'
  >,
): string {
  return `${lookup.host_first_name}’s game · ${gameMarkingLabel(lookup)} · ${gamePlayersLabel(lookup)}${lookup.knockout ? ' · knockout' : ''}`;
}

/**
 * Why a code's game cannot be joined, or null when it can: a single player's game never, any other
 * once it has started (with joining closed) or ended. The lookup's `open` decides it, not its status.
 */
export function joinClosedText(
  lookup: Pick<GameLookup, 'players' | 'open' | 'status' | 'host_first_name'>,
): string | null {
  if (lookup.players === 'single') {
    return `This is ${lookup.host_first_name}’s single-player game, so it cannot be joined.`;
  }
  if (lookup.open) return null;
  return `This game has ${lookup.status === 'finished' ? 'ended' : 'started'}, so it cannot be joined now.`;
}

/** Over the join choices when a game left open is already under way. */
export const JOIN_RUNNING_TEXT =
  'This game is under way: you can still join, and start from its first question.';

// --- In the game ------------------------------------------------------------------------------

/** "Quest game · G6", "Quest game · G5 and up, at random", or "Quest game" before it is read. */
export function gameTitle(game: Pick<GameView, 'level_id' | 'level_scope'> | undefined): string {
  return game ? `Quest game · ${gameLevelLabel(game, levelLabel)}` : 'Quest game';
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

/** Over the lobby's code: the web's label. */
export const LOBBY_LABEL = 'Game status · waiting to start · game code';

/** The lobby's scoreboard title: "1 player · 1 of 10 teams", or "places" when everyone is on their own. */
export function lobbyBoardTitle(game: Pick<GameView, 'teams' | 'max_teams' | 'max_team_size'>): string {
  return `${playersLabel(game)} · ${game.teams.length} of ${game.max_teams} ${game.max_team_size === 1 ? 'places' : 'teams'}`;
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

/** The moment's word after an answer, with the game's points: "Right! +2", "Not quite. −3", "Not quite.", "Skipped.". */
export function answerNotice(
  last: { correct: boolean; skipped: boolean } | null | undefined,
  scoring: GameScoring,
): AnswerNotice {
  if (last?.skipped) return { text: 'Skipped.', tone: 'info' };
  if (last?.correct) return { text: `Right! ${signedPoints(scoring.right_points)}`, tone: 'success' };
  return {
    text: scoring.wrong_points < 0 ? `Not quite. ${signedPoints(scoring.wrong_points)}` : 'Not quite.',
    tone: 'error',
  };
}

export const HOSTING_TEXT = 'You are hosting. The scores update as the teams play.';
export const MISSING_TEXT =
  'This game was not found, or you are not in it. Join it with its code from the Quest page.';
/** The waiting card's label (Phase 47: it is the game's status page). */
export const WAITING_LABEL = 'Game status';
/** Under the doors while they count down. */
export const GETTING_READY_TEXT = 'Get ready: the doors are opening…';

/**
 * The waiting card: once the team is done, its score and what it waits for (the others, the clock, a
 * knockout); before that, the teammates answering the last ones.
 */
export function waitingCopy(
  game: Pick<GameView, 'mode' | 'knockout'>,
  mine: Pick<GameTeamView, 'finished_at' | 'solo' | 'score'> | undefined,
): { title: string; body: string } {
  if (mine?.finished_at) {
    return {
      title: `${mine.solo ? 'You are done' : 'Your team is done'}: ${scoreLabel(mine.score)}.`,
      body:
        `Waiting for the others to finish${game.mode === 'timed' ? ' or the time to run out' : ''}` +
        `${game.knockout ? ', or for a knockout' : ''}. The scores update here as they play.`,
    };
  }
  return {
    title: 'Your team has no more questions to hand out.',
    body: waitingText(game.mode),
  };
}

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

/** The reader's own team, if they played. */
export function myTeam(game: Pick<GameView, 'teams' | 'me'>): GameTeamView | undefined {
  return game.teams.find((team) => team.id === game.me.team_id);
}

/**
 * Whether to celebrate (confetti and the success haptic): the game is finished and the reader's team
 * won -- or, a single player having nobody to beat, they got any answer right.
 */
export function celebrates(game: Pick<GameView, 'status' | 'teams' | 'me' | 'players'>): boolean {
  if (game.status !== 'finished') return false;
  const mine = myTeam(game);
  if (!mine) return false;
  return game.players === 'single' ? mine.correct > 0 : mine.place === 1;
}

/** The results' headline: a single player's "N right, M points", else the winners. */
export function resultsHeadline(
  game: Pick<GameView, 'players' | 'teams'>,
  mine: Pick<GameTeamView, 'correct' | 'score'> | undefined,
): string {
  if (game.players === 'single' && mine) return `${mine.correct} right, ${scoreLabel(mine.score)}`;
  return winnersLabel(game.teams);
}

/** Under the headline, for someone who played: "You won with N points. Fantastic!", or encouragement. */
export function resultsLine(
  game: Pick<GameView, 'status' | 'teams' | 'me' | 'players'>,
  mine: GameTeamView,
): string {
  if (game.players !== 'single' && celebrates(game)) {
    return `${mine.solo ? 'You won' : 'Your team won'} with ${scoreLabel(mine.score)}. Fantastic!`;
  }
  return gameEncouragement(mine);
}

// --- The doors' countdown (Phase 47) ----------------------------------------------------------

/** 5 s: "Get ready", then 3, 2, 1, and "Go!" for the last second, as the doors open (the web's). */
export function countdownLabel(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds > 4) return 'Get ready';
  if (ms <= 1000) return 'Go!';
  return String(seconds - 1);
}

/** What a screen reader is told: "The Quest begins in 5 seconds" on showing, and "Go!" at the end. */
export function countdownSpeech(ms: number): string {
  if (ms <= 1000) return 'Go!';
  const seconds = Math.ceil(ms / 1000);
  return `The Quest begins in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

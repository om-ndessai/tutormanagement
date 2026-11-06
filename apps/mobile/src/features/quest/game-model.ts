// Quest Games' pure rules for the app's screens (Phase 46, design 60), from
// apps/web/src/features/quest/{games-api.ts, games-card.tsx, game-page.tsx} @ cd0378d (working
// tree): when the game is polled, the lines and labels the screens show (the web's copy), the moment's
// notice after an answer, the clock on the server's time, and the native line of each result. Phase 47
// (design 61) @ 9eccdf2 (working tree): the settings' words (the level's scope, the points, who plays,
// knockout, late joining), the lookup's single-player and late-joining lines, the lobby's label and
// board, the waiting card once a team is done, the results' headline and encouragement, who is
// celebrated, and the doors' countdown words. What a Create sends is game-wizard-model.ts now. Pure: no
// React, no api client. The game's own rules live in @tmi/shared.
// Phase 77 (JF15, docs/journey-fixes-plan.md): a game on one device -- whose turn (the child first on each
// question), the hand-over line, both scores by first name, each player's own result -- and the lobby's "Invited:".
// Phase 78 (owner 2026-11-05; JF32): a game is a "quest" on screen ("game" only in "game code" and "Play with"), its
// level in words ("Grade 6", never "G6"), its header the quest in words (`gameWords`); and the rules line no longer
// says "may include questions not yet reviewed" (checked questions are served like any other).
import {
  GAME_CODE_LENGTH,
  GAME_POLL_MS,
  gameEncouragement,
  gameLengthLabel,
  gameMarkingLabel,
  gamePlayersLabel,
  normalizeGameCode,
  placeLabel,
  // Quest's own `pointsLabel` (quest-model.ts) means a count of points; this one is "+2" / "−3".
  pointsLabel as signedPoints,
  winnersLabel,
  type GameLookup,
  type GameMode,
  type GameQuestion,
  type GameResultItem,
  type GameScoring,
  type GameStatus,
  type GameSummary,
  type GameTeamView,
  type GameView,
  type QuestionBankLevelId,
  gameRefetchDelay,
  gameWords,
} from '@tmi/shared';

import { gameShareText } from '@/features/play/play-model';

import { gameLevelWords } from './level-words';
import { questChoiceText } from './quest-html';

// --- Polling ----------------------------------------------------------------------------------

/** How often the game is read: every GAME_POLL_MS while the screen is focused and the game not over. */
export function gamePollInterval(active: boolean, status: GameStatus | undefined): number | false {
  return active && status !== 'finished' ? GAME_POLL_MS : false;
}

/**
 * Phase 62 (P4): the next read of a game this screen holds, in ms, or false. While the screen is
 * not active, none; otherwise shared `gameRefetchDelay`: several teams every GAME_POLL_MS, a single
 * player's game only at the countdown's end and when its time is up.
 */
export function gameRefetchInterval(
  active: boolean,
  game: Parameters<typeof gameRefetchDelay>[0],
  fetchedAtMs: number,
  nowMs: number,
): number | false {
  return active ? gameRefetchDelay(game, fetchedAtMs, nowMs) : false;
}

// --- The hub ----------------------------------------------------------------------------------

/**
 * The code a field holds, once it holds one: "ab c-12d" -> "ABC12D", else null. The field keeps
 * what was typed (autoCapitalize offers capitals) and is read through this, never rewritten as it
 * is typed: rewriting a controlled field on each change dropped a keystroke on the iPad when the
 * case changed under it ("8s639d" arrived as "8S39D").
 */
export function typedGameCode(text: string): string | null {
  const code = normalizeGameCode(text);
  return code.length === GAME_CODE_LENGTH ? code : null;
}

/** A games-list row's trailing status: "Waiting to start", "Playing now", "Finished · 1st". */
export function gameRowStatus(game: Pick<GameSummary, 'status' | 'place'>): string {
  if (game.status === 'finished') return game.place ? `Finished · ${placeLabel(game.place)}` : 'Finished';
  return game.status === 'running' ? 'Playing now' : 'Waiting to start';
}

/**
 * A games-list row's second line: "You host · 2 teams", "Priya hosts · 1 team", "Single player"; Phase 77 (JF15), a
 * game on one device: "On this device" (its host), "On Tom's device" (the office).
 */
export function gameRowHost(
  game: Pick<GameSummary, 'is_host' | 'host_first_name' | 'teams'> & Partial<Pick<GameSummary, 'players' | 'seated'>>,
): string {
  if (game.seated) return game.is_host ? 'On this device' : `On ${game.host_first_name}'s device`;
  if (game.players === 'single') return 'Single player';
  return `${game.is_host ? 'You host' : `${game.host_first_name} hosts`} · ${game.teams} ${game.teams === 1 ? 'team' : 'teams'}`;
}

/**
 * Phase 73 (JF32): a game in words, never its code -- "Grade 6 Quick 2", "Grade 5 and up 5-minute dash" (shared
 * `gameWords`). For a games-list row, a waiting game and Next up's invitation.
 */
export function gameWordsOf(
  game: Pick<GameSummary, 'level_id' | 'mode' | 'question_count' | 'duration_seconds'> &
    Partial<Pick<GameSummary, 'level_scope'>>,
): string {
  return gameWords({
    level_id: game.level_id as QuestionBankLevelId,
    level_scope: game.level_scope ?? 'level',
    mode: game.mode,
    question_count: game.question_count,
    duration_seconds: game.duration_seconds,
  });
}

/** A games-list row's title, in words (Phase 73): "Grade 6 Quick 2"; the code follows, small. */
export function gameRowTitle(
  game: Pick<GameSummary, 'level_id' | 'mode' | 'question_count' | 'duration_seconds'> &
    Partial<Pick<GameSummary, 'level_scope'>>,
): string {
  return gameWordsOf(game);
}

/**
 * The share sheet's text: the code and the quest in words, no name and no organization. Phase 62 (P7), Phase 78: the
 * web's LobbyInvite words, "Join my Grade 6 Quick 5 quest on Aimtrue: game code ABC234".
 */
export function shareText(code: string, title?: string): string {
  return gameShareText(code, title);
}

/** A code spelled out for a screen reader: "A B C 2 3 4". */
export function spelledCode(code: string): string {
  return code.split('').join(' ');
}

// --- The rules of a game ----------------------------------------------------------------------

/**
 * The rules: "Grade 6 · 2 questions · Right +1, wrong −1 · Up to 20 teams, at most 2 players per team · knockout ·
 * joining open while it runs". (`unreviewed` is still read by older apps; this one no longer says it.)
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
  > &
    Partial<Pick<GameView, 'seats'>>,
): string {
  // Phase 77 (JF15): a game on this device names who plays, never places or teams.
  const players = seatedGame(game) ? seatedPlayersLabel(game) : gamePlayersLabel(game);
  return (
    `${gameLevelWords(game)} · ${gameLengthLabel(game)} · ${gameMarkingLabel(game)} · ` +
    `${players}${game.knockout ? ' · knockout' : ''}` +
    `${game.late_join ? ' · joining open while it runs' : ''}`
  );
}

/** The join sheet's line: "Priya’s quest · Right +1, wrong 0 · Up to 20 teams, at most 2 players per team · knockout". */
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
  return `${lookup.host_first_name}’s quest · ${gameMarkingLabel(lookup)} · ${gamePlayersLabel(lookup)}${lookup.knockout ? ' · knockout' : ''}`;
}

/**
 * Why a code's game cannot be joined, or null when it can: a single player's game never, any other
 * once it has started (with joining closed) or ended. The lookup's `open` decides it, not its status.
 */
export function joinClosedText(
  lookup: Pick<GameLookup, 'players' | 'open' | 'status' | 'host_first_name'>,
): string | null {
  if (lookup.players === 'single') {
    return `This is ${lookup.host_first_name}’s single-player quest, so it cannot be joined.`;
  }
  if (lookup.open) return null;
  return `This quest has ${lookup.status === 'finished' ? 'ended' : 'started'}, so it cannot be joined now.`;
}

/** Over the join choices when a game left open is already under way. */
export const JOIN_RUNNING_TEXT =
  'This quest is under way: you can still join, and start from its first question.';

// --- In the game ------------------------------------------------------------------------------

/** The header: the quest in words, "Grade 6 Quick 2", "Grade 5 and up 5-minute dash"; "Quest" before it is read. */
export function gameTitle(
  game: Pick<GameView, 'level_id' | 'level_scope' | 'mode' | 'question_count' | 'duration_seconds'> | undefined,
): string {
  return game ? gameWordsOf(game) : 'Quest';
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

/** Over the lobby's code (owner, 2026-10-23: no "Game status" there). */
export const LOBBY_LABEL = 'Game code';

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
  'This quest was not found, or you are not in it. Join it with its code from the Quest page.';
/** No game yet and the server not reached: a connection, not a missing game. */
export const UNREACHABLE_TEXT = 'Could not reach the quest just now. Check your connection, then try again.';
/** While a poll is failing: the game stays as it was. */
export const RECONNECTING_TEXT = 'Reconnecting to the quest…';
/** The waiting card's label (Phase 47: it is the game's status page). */
export const WAITING_LABEL = 'Quest status';
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
  return `Your teammates are answering the last ones. The quest ends when every team is done${mode === 'timed' ? ' or the time is up' : ''}.`;
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
 * Phase 73 (JF16): a game nobody answered anything in -- cancelled in its lobby, or ended at once. It is not a
 * result: no winner ("Nobody played"), no celebration. The server no longer places such a team either.
 */
export function nobodyPlayed(game: Pick<GameView, 'teams'>): boolean {
  return game.teams.every((team) => team.answered === 0);
}

/**
 * Whether to celebrate (confetti and the success haptic): the game is finished and the reader's team
 * won -- or, a single player having nobody to beat, they got any answer right; on one device, whoever won.
 * Never an empty game.
 */
export function celebrates(
  game: Pick<GameView, 'status' | 'teams' | 'me' | 'players'> & Partial<Pick<GameView, 'seats'>>,
): boolean {
  if (game.status !== 'finished' || nobodyPlayed(game)) return false;
  // Phase 77 (JF15): on one device everyone watching played, so whoever won is celebrated -- a child's win too.
  if (seatedGame(game)) return true;
  const mine = myTeam(game);
  if (!mine || mine.answered === 0) return false;
  return game.players === 'single' ? mine.correct > 0 : mine.place === 1;
}

/** The results' headline: a single player's "N right, M points", else the winners; "Nobody played" for an empty game. */
export function resultsHeadline(
  game: Pick<GameView, 'players' | 'teams'>,
  mine: Pick<GameTeamView, 'correct' | 'score'> | undefined,
): string {
  if (nobodyPlayed(game)) return 'Nobody played';
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

/** What a screen reader is told: "The quest begins in 5 seconds" on showing, and "Go!" at the end. */
export function countdownSpeech(ms: number): string {
  if (ms <= 1000) return 'Go!';
  const seconds = Math.ceil(ms / 1000);
  return `The quest begins in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}

// --- On one device (Phase 77, JF15) -----------------------------------------------------------

/**
 * A game played on this device: the host and the children they seated (`GameView.seats`, the host's view only). Every
 * team plays the same series, so the screen takes turns -- the child first on each question.
 */
export function seatedGame(game: Pick<GameView, 'seats'>): boolean {
  return (game.seats?.length ?? 0) > 0;
}

/** Whose turn it is on a seated game: a child's (`user_id`, answered with `as_user_id`) or the host's own (null). */
export interface SeatTurn {
  user_id: string | null;
  first_name: string | null;
  question: GameQuestion;
}

/**
 * The hand to answer now: the one furthest behind in the series, a child before the host on the same question (and
 * the children in the order they were seated). Null when nobody holds a question -- the doors, the end, or waiting.
 * Leaving and coming back lands on the same turn: it is read from the hands the server keeps.
 */
export function seatedTurn(game: Pick<GameView, 'seats' | 'me'>): SeatTurn | null {
  const hands: SeatTurn[] = [];
  for (const seat of game.seats ?? []) {
    if (seat.question) hands.push({ user_id: seat.user_id, first_name: seat.first_name, question: seat.question });
  }
  if (game.me.question) hands.push({ user_id: null, first_name: null, question: game.me.question });
  let turn: SeatTurn | null = null;
  for (const hand of hands) if (!turn || hand.question.number < turn.question.number) turn = hand;
  return turn;
}

/** "Ben's turn" or "Your turn": always in words, never a colour alone. */
export function turnTitle(turn: Pick<SeatTurn, 'first_name'>): string {
  return turn.first_name ? `${turn.first_name}'s turn` : 'Your turn';
}

/** The children seated on this device, by first name, in the order they were seated. */
function seatNames(game: Pick<GameView, 'seats'>): string[] {
  return (game.seats ?? []).map((seat) => seat.first_name);
}

/**
 * The hand-over line under it (the web's): "Pass the device to Ben.", or the host's "Ben has answered: take the device
 * back." ("Ben and Mia have answered: …").
 */
export function handOverLine(turn: Pick<SeatTurn, 'first_name'>, game: Pick<GameView, 'seats'>): string {
  if (turn.first_name) return `Pass the device to ${turn.first_name}.`;
  const names = seatNames(game);
  return `${listNames(names)} ${names.length === 1 ? 'has' : 'have'} answered: take the device back.`;
}

/** What a screen reader hears as the turn changes: "Ben's turn. Pass the device to Ben. Question 2 of 5." */
export function turnSpeech(turn: SeatTurn, game: Pick<GameView, 'seats'>, total: number | null): string {
  return `${turnTitle(turn)}. ${handOverLine(turn, game)} ${questionHeading(turn.question.number, total)}.`;
}

/** Under the doors of a game on this device: "Get ready: Ben goes first." */
export function seatedReadyText(game: Pick<GameView, 'seats'>): string {
  return `Get ready: ${seatNames(game)[0] ?? 'the first player'} goes first.`;
}

/** Nobody holds a question on this device: every hand is answered and the end is being written. */
export const SEATED_WAITING_TEXT = 'Everyone has answered. The results are on their way.';

/** The notice after a child's answer says whose it was: "Ben: Right! +1", "Ben: Skipped.". */
export function seatNotice(notice: AnswerNotice, firstName: string | null): AnswerNotice {
  return firstName ? { ...notice, text: `${firstName}: ${notice.text}` } : notice;
}

/** The last answer of the hand just answered: a seated child's (`as_user_id`), else the reader's own. */
export function handLast(
  game: Pick<GameView, 'seats' | 'me'>,
  asUserId: string | null | undefined,
): { correct: boolean; skipped: boolean } | null {
  if (!asUserId) return game.me.last;
  return game.seats?.find((seat) => seat.user_id === asUserId)?.last ?? null;
}

/** Both scores side by side, by first name: the children first (they answer first), then the host. */
export function seatedScores(
  game: Pick<GameView, 'seats' | 'teams' | 'me'>,
): { team_id: string; name: string; score: number; mine: boolean }[] {
  const order = [...(game.seats ?? []).map((seat) => seat.team_id), game.me.team_id];
  return order.flatMap((teamId) => {
    const team = game.teams.find((t) => t.id === teamId);
    return team ? [{ team_id: team.id, name: team.name, score: team.score, mine: team.id === game.me.team_id }] : [];
  });
}

/** "Ben and you, on this device": the rules' players for a seated game. */
export function seatedPlayersLabel(game: Pick<GameView, 'seats'>): string {
  return `${listNames([...seatNames(game), 'you'])}, on this device`;
}

/** Each player's own result, no team words (the web's): "Ben: 3 right, 3 points · 1st", the reader's "You: …". */
export function seatedResultLine(team: Pick<GameTeamView, 'name' | 'correct' | 'score' | 'place'>, mine: boolean): string {
  return `${mine ? 'You' : team.name}: ${team.correct} right, ${scoreLabel(team.score)}${team.place !== null ? ` · ${placeLabel(team.place)}` : ''}`;
}

/** Ending a game early, asked first; a seated game has no teams to speak of. */
export function endGameBody(game: Pick<GameView, 'seats'>): string {
  return seatedGame(game)
    ? 'Everyone stops where they are, and the places are given.'
    : 'Every team stops where it is, and the places are given.';
}

/**
 * The lobby's "Invited: Sanjay", then "Invited: Sanjay (joined)" once he is in (the web's) -- whom the host's roster
 * invited (`GameView.invited`, the host's and admins' view only). Null when nobody was, or from an older Worker.
 */
export function invitedLine(game: Pick<GameView, 'invited' | 'teams'>): string | null {
  const joined = new Set(game.teams.flatMap((team) => team.players.map((player) => player.user_id)));
  const names = (game.invited ?? []).map((person) =>
    joined.has(person.user_id) ? `${person.first_name} (joined)` : person.first_name,
  );
  return names.length > 0 ? `Invited: ${names.join(', ')}` : null;
}

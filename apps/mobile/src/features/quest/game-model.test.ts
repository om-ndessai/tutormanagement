// Quest Games' screen rules (Phase 46, design 60): the games list's lines, the rules line, the moment's
// notice, a team's progress -- with no "of 150" in a timed game -- who oversees, the clock on the
// server's time, the results' native line, and the hub's line for a parent. Phase 47 (design 61): the
// settings' words, the single-player and late-joining lookups, the lobby's board, the waiting card once
// done, the results' headline and encouragement, who is celebrated, and the doors' words. Phase 77 (JF15): the turns
// of a game on one device, its words and scores, and the lobby's "Invited:".
import { GAME_POLL_MS, type GameResultItem, type GameTeamView, type GameView } from '@tmi/shared';

import {
  JOIN_RUNNING_TEXT,
  LOBBY_LABEL,
  answerNotice,
  celebrates,
  nobodyPlayed,
  clockAnnouncement,
  clockSpeech,
  countdownLabel,
  countdownSpeech,
  endGameBody,
  gamePollInterval,
  gameRefetchInterval,
  gameRowHost,
  gameRowStatus,
  gameRowTitle,
  gameRulesLine,
  gameTitle,
  handLast,
  handOverLine,
  invitedLine,
  typedGameCode,
  isOverseer,
  joinClosedText,
  lobbyBoardTitle,
  lookupLine,
  playersLabel,
  questionHeading,
  resultsHeadline,
  resultsLine,
  reviewHeading,
  reviewLine,
  scoreLabel,
  seatNotice,
  seatedGame,
  seatedPlayersLabel,
  seatedReadyText,
  seatedResultLine,
  seatedScores,
  seatedTurn,
  seriesTotal,
  shareText,
  spelledCode,
  teamProgress,
  teamRowSpeech,
  timeLeftMs,
  turnSpeech,
  turnTitle,
  waitingCopy,
  waitingText,
} from './game-model';
import { questIntro } from './quest-model';

function team(over: Partial<GameTeamView> = {}): GameTeamView {
  return {
    id: 't1',
    name: 'Owls',
    solo: false,
    code: 'W7WYQB',
    players: [
      { user_id: 'a', first_name: 'Alex' },
      { user_id: 's', first_name: 'Sofia' },
    ],
    score: 1,
    correct: 1,
    wrong: 0,
    skipped: 0,
    answered: 1,
    finished_at: null,
    place: null,
    ...over,
  };
}

function game(over: Partial<GameView> = {}): GameView {
  return {
    id: 'g1',
    code: 'ABC234',
    level_id: 'NC26.6',
    level_scope: 'level',
    mode: 'count',
    question_count: 2,
    duration_seconds: null,
    right_points: 1,
    wrong_points: 0,
    negative_marking: false,
    knockout: false,
    players: 'multi',
    max_teams: 20,
    max_team_size: 2,
    late_join: false,
    unreviewed: false,
    status: 'running',
    host: { user_id: 'p', first_name: 'Priya' },
    is_host: false,
    created_at: '2026-10-21T10:00:00.000Z',
    started_at: '2026-10-21T10:01:00.000Z',
    ends_at: null,
    ended_at: null,
    end_reason: null,
    now: '2026-10-21T10:02:00.000Z',
    series_length: 2,
    teams: [team()],
    me: { team_id: 't1', question: null, last: null, waiting: false },
    ...over,
  };
}

describe('polling', () => {
  it('polls only while the screen is focused and the game is not over', () => {
    expect(gamePollInterval(true, 'lobby')).toBe(GAME_POLL_MS);
    expect(gamePollInterval(true, 'running')).toBe(GAME_POLL_MS);
    expect(gamePollInterval(true, undefined)).toBe(GAME_POLL_MS);
    expect(gamePollInterval(false, 'running')).toBe(false);
    expect(gamePollInterval(true, 'finished')).toBe(false);
  });
});

describe('the hub', () => {
  it('reads a typed code, in any case, once it is six readable characters', () => {
    expect(typedGameCode('ab c-12d')).toBe('ABC12D');
    expect(typedGameCode('8s639d')).toBe('8S639D');
    expect(typedGameCode('ABC12')).toBeNull();
    expect(typedGameCode('abcdefgh')).toBeNull();
  });

  it("says a game's row: its title, its host and teams, its status and place", () => {
    const row = {
      level_id: 'NC26.6',
      mode: 'count' as const,
      question_count: 2,
      duration_seconds: null,
      is_host: false,
      host_first_name: 'Priya',
      teams: 1,
    };
    // Phase 73 (JF32): in words, never the code first.
    expect(gameRowTitle(row)).toBe('Grade 6 Quick 2');
    expect(gameRowHost(row)).toBe('Priya hosts · 1 team');
    expect(gameRowHost({ ...row, is_host: true, teams: 3 })).toBe('You host · 3 teams');
    expect(gameRowStatus({ status: 'lobby', place: null })).toBe('Waiting to start');
    expect(gameRowStatus({ status: 'running', place: null })).toBe('Playing now');
    expect(gameRowStatus({ status: 'finished', place: 1 })).toBe('Finished · 1st');
    expect(gameRowStatus({ status: 'finished', place: null })).toBe('Finished');
    // Phase 47: a Random level's scope, and a single player's game.
    expect(gameRowTitle({ ...row, level_scope: 'upward' })).toBe('Grade 6 and up Quick 2');
    expect(gameRowTitle({ ...row, mode: 'timed', question_count: null, duration_seconds: 600 })).toBe(
      'Grade 6 10-minute challenge',
    );
    expect(gameRowHost({ ...row, players: 'single' })).toBe('Single player');
    // Phase 77 (JF15): a game on one device names the device, never teams or a code.
    expect(gameRowHost({ ...row, is_host: true, teams: 2, seated: true })).toBe('On this device');
    expect(gameRowHost({ ...row, host_first_name: 'Tom', teams: 2, seated: true })).toBe("On Tom's device");
    expect(gameRowHost({ ...row, seated: false })).toBe('Priya hosts · 1 team');
  });

  it('shares the code and nothing else, and spells it out for a screen reader', () => {
    expect(shareText('ABC234')).toBe('Join my Aimtrue game: code ABC234');
    expect(spelledCode('ABC234')).toBe('A B C 2 3 4');
  });

  it("gives a parent the games' line, and everyone else the Quest blurb", () => {
    expect(questIntro(['parent'])).toBe(
      'Play the question bank together: start a game and share its code, or join one with a code.',
    );
    expect(questIntro([])).toMatch(/^Play the question bank together/);
    expect(questIntro(['student'])).toMatch(/^Answer the question bank’s new questions/);
    expect(questIntro(['parent', 'tutor'])).toMatch(/^Answer the question bank’s new questions/);
  });
});

describe('the rules of a game', () => {
  it('says the level, the length, the points, who plays, knockout, late joining and the unreviewed note', () => {
    expect(gameRulesLine(game())).toBe('G6 · 2 questions · Right +1, wrong 0 · Up to 20 teams, at most 2 players per team');
    expect(
      gameRulesLine(
        game({
          mode: 'timed',
          duration_seconds: 300,
          wrong_points: -1,
          max_teams: 10,
          max_team_size: 1,
          unreviewed: true,
        }),
      ),
    ).toBe(
      'G6 · 5 minutes · Right +1, wrong −1 · Up to 10 players, each on their own · may include questions not yet reviewed',
    );
    expect(gameRulesLine(game({ wrong_points: -1, knockout: true, late_join: true, unreviewed: true }))).toBe(
      'G6 · 2 questions · Right +1, wrong −1 · Up to 20 teams, at most 2 players per team · knockout · joining open while it runs · may include questions not yet reviewed',
    );
    expect(gameRulesLine(game({ level_scope: 'upward', right_points: 2, wrong_points: -3 }))).toBe(
      'G6 and up, at random · 2 questions · Right +2, wrong −3 · Up to 20 teams, at most 2 players per team',
    );
    expect(gameRulesLine(game({ players: 'single', max_teams: 1, max_team_size: 1 }))).toBe(
      'G6 · 2 questions · Right +1, wrong 0 · Single player',
    );
  });

  it("gives the join sheet's line, with knockout", () => {
    const lookup = {
      host_first_name: 'Priya',
      right_points: 1,
      wrong_points: 0,
      players: 'multi' as const,
      max_teams: 20,
      max_team_size: 2,
      knockout: false,
    };
    expect(lookupLine(lookup)).toBe('Priya’s game · Right +1, wrong 0 · Up to 20 teams, at most 2 players per team');
    expect(lookupLine({ ...lookup, wrong_points: -1, knockout: true })).toBe(
      'Priya’s game · Right +1, wrong −1 · Up to 20 teams, at most 2 players per team · knockout',
    );
  });

  it('refuses a single player’s game, and any other once it is closed: by `open`, not the status', () => {
    const lookup = {
      host_first_name: 'Priya',
      players: 'multi' as const,
      open: true,
      status: 'lobby' as const,
    };
    expect(joinClosedText(lookup)).toBeNull();
    // Running with joining left open: joinable, and said so above the choices.
    expect(joinClosedText({ ...lookup, status: 'running' })).toBeNull();
    expect(JOIN_RUNNING_TEXT).toBe(
      'This game is under way: you can still join, and start from its first question.',
    );
    expect(joinClosedText({ ...lookup, status: 'running', open: false })).toBe(
      'This game has started, so it cannot be joined now.',
    );
    expect(joinClosedText({ ...lookup, status: 'finished', open: false })).toBe(
      'This game has ended, so it cannot be joined now.',
    );
    expect(joinClosedText({ ...lookup, players: 'single', open: false, status: 'running' })).toBe(
      'This is Priya’s single-player game, so it cannot be joined.',
    );
  });
});

describe('in the game', () => {
  it('titles the screen and says points and players', () => {
    expect(gameTitle(undefined)).toBe('Quest game');
    expect(gameTitle(game())).toBe('Quest game · G6');
    expect(scoreLabel(0)).toBe('0 points');
    expect(scoreLabel(1)).toBe('1 point');
    expect(scoreLabel(-1)).toBe('-1 points');
    expect(playersLabel(game())).toBe('2 players');
    expect(playersLabel(game({ teams: [team({ players: [{ user_id: 'a', first_name: 'Alex' }] })] }))).toBe(
      '1 player',
    );
  });

  it('labels the lobby, and counts the places taken on its board', () => {
    expect(LOBBY_LABEL).toBe('Game code');
    expect(lobbyBoardTitle(game({ max_teams: 10 }))).toBe('2 players · 1 of 10 teams');
    expect(
      lobbyBoardTitle(
        game({
          max_teams: 10,
          max_team_size: 1,
          teams: [team({ players: [{ user_id: 'a', first_name: 'Alex' }] })],
        }),
      ),
    ).toBe('1 player · 1 of 10 places');
  });

  it('shows the series total in a count game only: never "of 150" against the clock', () => {
    expect(seriesTotal(game())).toBe(2);
    expect(seriesTotal(game({ mode: 'timed', series_length: 150 }))).toBeNull();
    expect(questionHeading(2, 2)).toBe('Question 2 of 2');
    expect(questionHeading(7, null)).toBe('Question 7');
    expect(teamProgress(team(), 2)).toBe('1/2');
    expect(teamProgress(team({ finished_at: '2026-10-21T10:03:00.000Z', answered: 2 }), 2)).toBe('Done');
    expect(teamProgress(team({ answered: 12 }), null)).toBe('12');
  });

  it("reads a team's row as one line", () => {
    expect(teamRowSpeech(team({ place: 1 }), { mine: true, total: 2, showScore: true })).toBe(
      '1st, Owls (you), Alex and Sofia, 1 point, 1/2',
    );
    expect(
      teamRowSpeech(team({ solo: true, name: 'Sofia', players: [{ user_id: 's', first_name: 'Sofia' }] }), {
        mine: false,
        total: null,
        showScore: false,
      }),
    ).toBe('Sofia');
  });

  it('lets the host, or an admin not playing, oversee every team', () => {
    expect(isOverseer(game())).toBe(false);
    expect(isOverseer(game({ is_host: true }))).toBe(true);
    expect(isOverseer(game({ me: { team_id: null, question: null, last: null, waiting: false } }))).toBe(
      true,
    );
  });

  it("says how the last answer went, with the game's points", () => {
    const plain = { right_points: 1, wrong_points: 0 };
    expect(answerNotice({ correct: true, skipped: false }, plain)).toEqual({
      text: 'Right! +1',
      tone: 'success',
    });
    expect(answerNotice({ correct: true, skipped: false }, { right_points: 2, wrong_points: 0 })).toEqual({
      text: 'Right! +2',
      tone: 'success',
    });
    expect(answerNotice({ correct: false, skipped: false }, plain)).toEqual({
      text: 'Not quite.',
      tone: 'error',
    });
    expect(answerNotice({ correct: false, skipped: false }, { right_points: 1, wrong_points: -3 })).toEqual({
      text: 'Not quite. −3',
      tone: 'error',
    });
    expect(answerNotice({ correct: false, skipped: true }, { right_points: 1, wrong_points: -1 })).toEqual({
      text: 'Skipped.',
      tone: 'info',
    });
  });

  it('waits for the team, and once it is done for the others, the clock or a knockout', () => {
    expect(waitingText('count')).toBe(
      'Your teammates are answering the last ones. The game ends when every team is done.',
    );
    expect(waitingText('timed')).toMatch(/every team is done or the time is up\.$/);
    expect(waitingCopy(game(), team())).toEqual({
      title: 'Your team has no more questions to hand out.',
      body: 'Your teammates are answering the last ones. The game ends when every team is done.',
    });
    const done = team({ finished_at: '2026-10-21T10:03:00.000Z', score: 3 });
    expect(waitingCopy(game(), done)).toEqual({
      title: 'Your team is done: 3 points.',
      body: 'Waiting for the others to finish. The scores update here as they play.',
    });
    expect(waitingCopy(game({ mode: 'timed', knockout: true }), { ...done, solo: true, score: 1 })).toEqual({
      title: 'You are done: 1 point.',
      body: 'Waiting for the others to finish or the time to run out, or for a knockout. The scores update here as they play.',
    });
  });

  it('celebrates a first place, or a single player with any right answer, once the game is finished', () => {
    const won = game({ status: 'finished', teams: [team({ place: 1 })] });
    expect(celebrates(won)).toBe(true);
    expect(celebrates({ ...won, teams: [team({ place: 2 })] })).toBe(false);
    expect(celebrates({ ...won, status: 'running' })).toBe(false);
    expect(celebrates({ ...won, me: { team_id: null, question: null, last: null, waiting: false } })).toBe(
      false,
    );
    const single = game({
      status: 'finished',
      players: 'single',
      teams: [team({ place: 1, correct: 0, score: 0 })],
    });
    expect(celebrates(single)).toBe(false);
    expect(celebrates({ ...single, teams: [team({ place: 1, correct: 1 })] })).toBe(true);
  });

  it("heads the results: a single player's tally, else the winners, and a line for whoever played", () => {
    const solo = team({ solo: true, name: 'Sofia', correct: 2, score: 2, answered: 2, place: 1 });
    const single = game({ status: 'finished', players: 'single', teams: [solo] });
    expect(resultsHeadline(single, solo)).toBe('2 right, 2 points');
    expect(resultsHeadline(single, { ...solo, correct: 1, score: 1 })).toBe('1 right, 1 point');
    expect(resultsHeadline(single, { ...solo, correct: 0, score: 0 })).toBe('0 right, 0 points');
    // A single player is encouraged, never "You won".
    expect(resultsLine(single, solo)).toBe('You got every one you answered right. Brilliant!');
    const owls = team({ place: 1, score: 3 });
    const multi = game({ status: 'finished', teams: [owls, team({ id: 't2', name: 'Bats', place: 2 })] });
    expect(resultsHeadline(multi, owls)).toBe('Owls wins!');
    expect(resultsLine(multi, owls)).toBe('Your team won with 3 points. Fantastic!');
    expect(resultsLine(multi, { ...owls, solo: true, score: 1 })).toBe('You won with 1 point. Fantastic!');
    const second = game({
      status: 'finished',
      me: { team_id: 't2', question: null, last: null, waiting: false },
      teams: [owls, team({ id: 't2', name: 'Bats', place: 2, correct: 0, answered: 1 })],
    });
    expect(resultsLine(second, second.teams[1]!)).toBe(
      'Every question you try makes the next one easier. Go again!',
    );
  });

  it('an empty game -- nobody answered or skipped anything -- is "Nobody played": no win, no celebration (Phase 73, JF16)', () => {
    // Cancelled in its lobby, or ended at once: the server places nobody either.
    const empty = team({ answered: 0, correct: 0, score: 0, place: null });
    const multi = game({ status: 'finished', teams: [empty, team({ id: 't2', name: 'Bats', answered: 0, correct: 0, score: 0 })] });
    expect(nobodyPlayed(multi)).toBe(true);
    expect(resultsHeadline(multi, empty)).toBe('Nobody played');
    expect(celebrates(multi)).toBe(false);
    expect(resultsLine(multi, empty)).not.toMatch(/won/);
    // Even an older Worker that still placed the empty team first.
    const placed = game({ status: 'finished', teams: [{ ...empty, place: 1 }] });
    expect(celebrates(placed)).toBe(false);
    expect(resultsHeadline(placed, placed.teams[0])).toBe('Nobody played');
    const single = game({ status: 'finished', players: 'single', teams: [{ ...empty, solo: true, name: 'Sofia' }] });
    expect(resultsHeadline(single, single.teams[0])).toBe('Nobody played');
    expect(celebrates(single)).toBe(false);
    // A skip counts as playing: skipped through is a result.
    const skipped = game({ status: 'finished', players: 'single', teams: [team({ answered: 2, skipped: 2, correct: 0, score: 0, place: 1 })] });
    expect(nobodyPlayed(skipped)).toBe(false);
    expect(resultsHeadline(skipped, skipped.teams[0])).toBe('0 right, 0 points');
  });
});

describe("the doors' countdown", () => {
  it('says Get ready, then 3, 2, 1, and Go! for the last second', () => {
    expect(countdownLabel(5000)).toBe('Get ready');
    expect(countdownLabel(4001)).toBe('Get ready');
    expect(countdownLabel(4000)).toBe('3');
    expect(countdownLabel(3000)).toBe('2');
    expect(countdownLabel(1001)).toBe('1');
    expect(countdownLabel(1000)).toBe('Go!');
    expect(countdownLabel(1)).toBe('Go!');
  });

  it('tells a screen reader how long, and Go! at the end', () => {
    expect(countdownSpeech(5000)).toBe('The Quest begins in 5 seconds');
    expect(countdownSpeech(1500)).toBe('The Quest begins in 2 seconds');
    expect(countdownSpeech(1000)).toBe('Go!');
  });
});

describe('the clock', () => {
  const endsAt = '2026-10-21T10:05:00.000Z';
  const serverNow = '2026-10-21T10:00:00.000Z';
  const server = Date.parse(serverNow);

  it("counts down on the server's time, whatever the device's clock says", () => {
    // In step with the server, one second after the reading.
    expect(timeLeftMs(endsAt, serverNow, server, server + 1000)).toBe(299_000);
    // A device clock an hour ahead of the server's.
    const ahead = server + 3_600_000;
    expect(timeLeftMs(endsAt, serverNow, ahead, ahead + 1000)).toBe(299_000);
    // And ten minutes behind.
    const behind = server - 600_000;
    expect(timeLeftMs(endsAt, serverNow, behind, behind + 5000)).toBe(295_000);
  });

  it('never goes below zero', () => {
    expect(timeLeftMs(endsAt, serverNow, server, server + 400_000)).toBe(0);
  });

  it('reads aloud, and is announced at one minute and ten seconds', () => {
    expect(clockSpeech(245_000)).toBe('4 minutes 5 seconds left');
    expect(clockSpeech(60_000)).toBe('1 minute left');
    expect(clockSpeech(1_000)).toBe('1 second left');
    expect(clockSpeech(0)).toBe('Time is up');
    expect(clockAnnouncement(null, 59_000)).toBeNull();
    expect(clockAnnouncement(61_000, 60_000)).toBe('One minute left');
    expect(clockAnnouncement(60_000, 59_000)).toBeNull();
    expect(clockAnnouncement(11_000, 10_000)).toBe('Ten seconds left');
    expect(clockAnnouncement(30_000, 29_000)).toBeNull();
  });
});

describe('the results', () => {
  const item = (over: Partial<GameResultItem> = {}): GameResultItem => ({
    number: 1,
    question: {
      id: 'q1',
      kind: 'choice',
      stem: 'Which ratio?',
      choices: ['5 to 3', '3 to 5', '8 to 3', '3 to 8'],
      answer: '5 to 3',
      solution: 'Count them.',
    },
    answered_by: 'Sofia',
    answer: '5 to 3',
    correct: true,
    skipped: false,
    ...over,
  });

  it('gives each result a native line with the mark, who answered and the key', () => {
    expect(reviewLine(item())).toBe('Question 1 · Right · Sofia · Answered: 5 to 3 · Answer: 5 to 3');
    expect(reviewLine(item({ number: 2, answer: '3 to 8', correct: false }))).toBe(
      'Question 2 · Not quite · Sofia · Answered: 3 to 8 · Answer: 5 to 3',
    );
    expect(reviewLine(item({ answer: null, skipped: true, correct: false, answered_by: 'Alex' }))).toBe(
      'Question 1 · Skipped · Alex · Answer: 5 to 3',
    );
    expect(reviewLine(item({ answered_by: null, answer: null, skipped: true, correct: false }))).toBe(
      'Question 1 · Skipped · Answer: 5 to 3',
    );
    expect(reviewLine(item({ question: { ...item().question, answer: '$\\frac{3}{4}$' } }))).toContain(
      'Answer: 3/4',
    );
  });

  it("heads the review with the team's name", () => {
    expect(reviewHeading('Owls')).toBe('Owls’s questions');
    expect(reviewHeading(undefined)).toBe('Questions');
  });
});

describe('gameRefetchInterval (Phase 62, P4)', () => {
  const at = Date.parse('2026-11-01T12:00:00.000Z');
  const base = {
    status: 'running' as const,
    mode: 'count' as const,
    duration_seconds: null,
    now: '2026-11-01T12:00:00.000Z',
  };
  it('polls a game of several teams, and nothing while the screen is away', () => {
    expect(gameRefetchInterval(true, { ...base, players: 'multi', started_at: base.now }, at, at)).toBe(GAME_POLL_MS);
    expect(gameRefetchInterval(false, { ...base, players: 'multi', started_at: base.now }, at, at)).toBe(false);
  });
  it("reads a single player's game at the countdown's end, then only every 30 seconds", () => {
    const counting = { ...base, players: 'single' as const, started_at: '2026-11-01T12:00:05.000Z' };
    expect(gameRefetchInterval(true, counting, at, at)).toBe(5150);
    expect(gameRefetchInterval(true, counting, at, at + 2000)).toBe(3150);
    const playing = { ...base, players: 'single' as const, started_at: '2026-11-01T11:59:00.000Z' };
    // Then only the safety read, every 30 seconds.
    expect(gameRefetchInterval(true, playing, at, at)).toBe(30_000);
  });
  it("reads a single player's timed game when its time is up", () => {
    const timed = {
      ...base,
      players: 'single' as const,
      mode: 'timed' as const,
      duration_seconds: 120,
      started_at: '2026-11-01T11:59:00.000Z',
    };
    expect(gameRefetchInterval(true, timed, at, at)).toBe(30_000);
    expect(gameRefetchInterval(true, timed, at, at + 45_000)).toBe(15_250);
  });
  it('never reads a finished game', () => {
    expect(gameRefetchInterval(true, { ...base, status: 'finished', players: 'single', started_at: base.now }, at, at)).toBe(false);
  });
});


// --- Phase 77 (JF15): on one device, and the lobby's invited ----------------------------------------------------

describe('a game on one device (Phase 77)', () => {
  const q = (id: string, number: number) => ({ id, kind: 'numeric' as const, stem: 'x', choices: [], number });
  const seat = (over: Partial<NonNullable<GameView['seats']>[number]> = {}) => ({
    user_id: 'ben',
    first_name: 'Ben',
    team_id: 't-ben',
    question: null,
    last: null,
    waiting: false,
    ...over,
  });
  const me = (question: ReturnType<typeof q> | null, last: { correct: boolean; skipped: boolean } | null = null) => ({
    team_id: 't-tom',
    question,
    last,
    waiting: false,
  });

  it('is a game with seats in the host’s view, and only then', () => {
    expect(seatedGame({ seats: [seat()] })).toBe(true);
    expect(seatedGame({ seats: [] })).toBe(false);
    expect(seatedGame({})).toBe(false);
  });

  it('takes turns: the hand furthest behind, the child first on the same question', () => {
    expect(seatedTurn({ seats: [seat({ question: q('a', 1) })], me: me(q('a', 1)) })).toMatchObject({ user_id: 'ben', first_name: 'Ben' });
    expect(seatedTurn({ seats: [seat({ question: q('b', 2) })], me: me(q('a', 1)) })).toMatchObject({ user_id: null });
    // The child done (no hand), the host plays on; nobody holding a question: no turn.
    expect(seatedTurn({ seats: [seat()], me: me(q('c', 3)) })).toMatchObject({ user_id: null });
    expect(seatedTurn({ seats: [seat()], me: me(null) })).toBeNull();
    // Two children: in the order they were seated.
    const two = [seat({ question: q('a', 1) }), seat({ user_id: 'mia', first_name: 'Mia', team_id: 't-mia', question: q('a', 1) })];
    expect(seatedTurn({ seats: two, me: me(q('a', 1)) })?.first_name).toBe('Ben');
  });

  it('says whose turn in words, with the hand-over line', () => {
    expect(turnTitle({ first_name: 'Ben' })).toBe("Ben's turn");
    expect(turnTitle({ first_name: null })).toBe('Your turn');
    const one = { seats: [seat()] };
    expect(handOverLine({ first_name: 'Ben' }, one)).toBe('Pass the device to Ben.');
    expect(handOverLine({ first_name: null }, one)).toBe('Ben has answered: take the device back.');
    expect(
      handOverLine({ first_name: null }, { seats: [seat(), seat({ user_id: 'mia', first_name: 'Mia', team_id: 't-mia' })] }),
    ).toBe('Ben and Mia have answered: take the device back.');
    expect(turnSpeech({ user_id: 'ben', first_name: 'Ben', question: q('a', 2) }, one, 5)).toBe(
      "Ben's turn. Pass the device to Ben. Question 2 of 5.",
    );
    expect(seatedReadyText(one)).toBe('Get ready: Ben goes first.');
  });

  it('reads the notice from the hand just answered', () => {
    const game = { seats: [seat({ last: { correct: true, skipped: false } })], me: me(null, { correct: false, skipped: true }) };
    expect(handLast(game, 'ben')).toEqual({ correct: true, skipped: false });
    expect(handLast(game, null)).toEqual({ correct: false, skipped: true });
    expect(handLast(game, 'someone')).toBeNull();
  });

  it('puts both scores side by side by first name, the child first, and each result in words', () => {
    const teams = [
      team({ id: 't-tom', name: 'Tom', solo: true, score: 2 }),
      team({ id: 't-ben', name: 'Ben', solo: true, score: 3 }),
    ];
    expect(seatedScores({ seats: [seat()], teams, me: me(null) })).toEqual([
      { team_id: 't-ben', name: 'Ben', score: 3, mine: false },
      { team_id: 't-tom', name: 'Tom', score: 2, mine: true },
    ]);
    expect(seatedResultLine({ name: 'Ben', correct: 1, score: 1, place: 1 }, false)).toBe('Ben: 1 right, 1 point · 1st');
    expect(seatedResultLine({ name: 'Tom', correct: 0, score: 0, place: 2 }, true)).toBe('You: 0 right, 0 points · 2nd');
    expect(seatedResultLine({ name: 'Tom', correct: 0, score: 0, place: null }, true)).toBe('You: 0 right, 0 points');
    expect(seatNotice({ text: 'Right! +1', tone: 'success' }, 'Ben')).toEqual({ text: 'Ben: Right! +1', tone: 'success' });
    expect(seatNotice({ text: 'Skipped.', tone: 'info' }, null)).toEqual({ text: 'Skipped.', tone: 'info' });
    expect(seatedPlayersLabel({ seats: [seat()] })).toBe('Ben and you, on this device');
  });

  it('names no teams in its rules or when ending early', () => {
    const rules = {
      level_id: 'NC26.5',
      level_scope: 'level' as const,
      mode: 'count' as const,
      question_count: 5,
      duration_seconds: null,
      right_points: 1,
      wrong_points: 0,
      players: 'multi' as const,
      max_teams: 2,
      max_team_size: 1,
      knockout: false,
      late_join: false,
      unreviewed: false,
    };
    expect(gameRulesLine({ ...rules, seats: [seat()] })).toMatch(/· Ben and you, on this device$/);
    expect(gameRulesLine(rules)).toMatch(/Up to 2 players, each on their own$/);
    expect(endGameBody({ seats: [seat()] })).toBe('Everyone stops where they are, and the places are given.');
    expect(endGameBody({})).toBe('Every team stops where it is, and the places are given.');
  });

  it('celebrates whoever won on one device -- a child’s win too -- but never an empty game', () => {
    const finished = (benPlace: number, answered = 5) =>
      ({
        status: 'finished',
        players: 'multi',
        me: me(null),
        seats: [seat()],
        teams: [
          team({ id: 't-tom', name: 'Tom', solo: true, place: 2, answered }),
          team({ id: 't-ben', name: 'Ben', solo: true, place: benPlace, answered }),
        ],
      }) as Pick<GameView, 'status' | 'teams' | 'me' | 'players' | 'seats'>;
    expect(celebrates(finished(1))).toBe(true);
    expect(celebrates(finished(1, 0))).toBe(false);
  });
});

describe("the lobby's invited (Phase 77)", () => {
  it('lists whom the host invited, marking who has joined', () => {
    const invited = [{ user_id: 'sanjay', first_name: 'Sanjay' }];
    expect(invitedLine({ invited, teams: [team({ players: [{ user_id: 'anita', first_name: 'Anita' }] })] })).toBe('Invited: Sanjay');
    expect(invitedLine({ invited, teams: [team({ players: [{ user_id: 'sanjay', first_name: 'Sanjay' }] })] })).toBe(
      'Invited: Sanjay (joined)',
    );
    expect(invitedLine({ invited: [], teams: [] })).toBeNull();
    // An older Worker sends nobody.
    expect(invitedLine({ teams: [] })).toBeNull();
    expect(invitedLine({ invited: [...invited, { user_id: 'arjun', first_name: 'Arjun' }], teams: [] })).toBe(
      'Invited: Sanjay, Arjun',
    );
  });
});

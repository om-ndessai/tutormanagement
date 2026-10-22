// Quest Games' screen rules (Phase 46, design 60): the games list's lines, the rules line, what
// Create sends (checked against the shared schema), the moment's notice, a team's progress -- with no
// "of 150" in a timed game -- who oversees, the clock on the server's time, the results' native line,
// and the hub's line for a parent.
import {
  GAME_POLL_MS,
  createGameSchema,
  type GameResultItem,
  type GameTeamView,
  type GameView,
} from '@tmi/shared';

import {
  amountHint,
  amountProblem,
  answerNotice,
  clockAnnouncement,
  clockSpeech,
  createInput,
  gameCodeInput,
  gameCodeReady,
  gamePollInterval,
  gameRowHost,
  gameRowStatus,
  gameRowTitle,
  gameRulesLine,
  gameTitle,
  isOverseer,
  lookupLine,
  notJoinableText,
  playersLabel,
  questionHeading,
  reviewHeading,
  reviewLine,
  scoreLabel,
  seriesTotal,
  shareText,
  spelledCode,
  teamProgress,
  teamRowSpeech,
  teamSizeLabel,
  teamSizeSpeech,
  timeLeftMs,
  waitingText,
  wonGame,
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
    mode: 'count',
    question_count: 2,
    duration_seconds: null,
    negative_marking: false,
    max_team_size: 2,
    unreviewed: false,
    status: 'running',
    host: { user_id: 'p', first_name: 'Priya' },
    is_host: false,
    created_at: '2026-10-21T10:00:00.000Z',
    started_at: '2026-10-21T10:01:00.000Z',
    ends_at: null,
    ended_at: null,
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
  it('tidies a typed code to six readable characters', () => {
    expect(gameCodeInput('ab c-12d')).toBe('ABC12D');
    expect(gameCodeInput('abcdefgh')).toBe('ABCDEF');
    expect(gameCodeReady('ABC12')).toBe(false);
    expect(gameCodeReady('ABC12D')).toBe(true);
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
    expect(gameRowTitle(row)).toBe('G6 · 2 questions');
    expect(gameRowHost(row)).toBe('Priya hosts · 1 team');
    expect(gameRowHost({ ...row, is_host: true, teams: 3 })).toBe('You host · 3 teams');
    expect(gameRowStatus({ status: 'lobby', place: null })).toBe('Waiting to start');
    expect(gameRowStatus({ status: 'running', place: null })).toBe('Playing now');
    expect(gameRowStatus({ status: 'finished', place: 1 })).toBe('Finished · 1st');
    expect(gameRowStatus({ status: 'finished', place: null })).toBe('Finished');
  });

  it('shares the code and nothing else, and spells it out for a screen reader', () => {
    expect(shareText('ABC234')).toBe('Join my Quest game with the code ABC234.');
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
  it('says the level, the length, the marking, the teams and the unreviewed note', () => {
    expect(gameRulesLine(game())).toBe('G6 · 2 questions · Right +1, wrong 0 · teams of up to 2');
    expect(
      gameRulesLine(
        game({
          mode: 'timed',
          duration_seconds: 300,
          negative_marking: true,
          max_team_size: 1,
          unreviewed: true,
        }),
      ),
    ).toBe(
      'G6 · 5 minutes · Right +1, wrong −1 · everyone on their own · may include questions not yet reviewed',
    );
    expect(lookupLine({ host_first_name: 'Priya', negative_marking: false, max_team_size: 2 })).toBe(
      'Priya’s game · Right +1, wrong 0 · teams of up to 2',
    );
    expect(notJoinableText('running')).toBe('This game has started, so it cannot be joined now.');
    expect(notJoinableText('finished')).toBe('This game has ended, so it cannot be joined now.');
    expect(teamSizeLabel(1)).toBe('On their own');
    expect(teamSizeLabel(4)).toBe('4');
    expect(teamSizeSpeech(1)).toBe('Everyone on their own');
    expect(teamSizeSpeech(4)).toBe('Up to 4 a team');
  });
});

describe('starting a game', () => {
  it('holds the amount to the ranges, in the web’s words', () => {
    expect(amountHint('count')).toBe('questions (1-50)');
    expect(amountHint('timed')).toBe('minutes (1-30)');
    expect(amountProblem('count', '10')).toBeNull();
    expect(amountProblem('count', '99')).toBe('Choose how many questions (1-50).');
    expect(amountProblem('count', '0')).toBe('Choose how many questions (1-50).');
    expect(amountProblem('count', '')).toBe('Choose how many questions (1-50).');
    expect(amountProblem('count', '2.5')).toBe('Choose how many questions (1-50).');
    expect(amountProblem('timed', '30')).toBeNull();
    expect(amountProblem('timed', '31')).toBe('Choose how many minutes (1-30).');
  });

  it('sends what the shared schema accepts, and nothing while the form will not do', () => {
    const form = {
      levelId: 'NC26.6',
      mode: 'count' as const,
      amount: '2',
      negativeMarking: true,
      teamSize: 2,
    };
    const input = createInput(form);
    expect(input).toEqual({
      level_id: 'NC26.6',
      mode: 'count',
      question_count: 2,
      negative_marking: true,
      max_team_size: 2,
    });
    expect(createGameSchema.safeParse(input).success).toBe(true);
    expect(createInput({ ...form, mode: 'timed', amount: '5' })).toEqual({
      level_id: 'NC26.6',
      mode: 'timed',
      duration_minutes: 5,
      negative_marking: true,
      max_team_size: 2,
    });
    expect(createInput({ ...form, levelId: '' })).toBeNull();
    expect(createInput({ ...form, amount: '99' })).toBeNull();
    expect(createInput({ ...form, teamSize: 7 })).toBeNull();
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

  it('says how the last answer went, with the −1 only under negative marking', () => {
    expect(answerNotice({ correct: true, skipped: false }, false)).toEqual({
      text: 'Right!',
      tone: 'success',
    });
    expect(answerNotice({ correct: false, skipped: false }, false)).toEqual({
      text: 'Not quite.',
      tone: 'error',
    });
    expect(answerNotice({ correct: false, skipped: false }, true)).toEqual({
      text: 'Not quite. −1',
      tone: 'error',
    });
    expect(answerNotice({ correct: false, skipped: true }, true)).toEqual({ text: 'Skipped.', tone: 'info' });
  });

  it('waits for the team, and for the clock in a timed game', () => {
    expect(waitingText('count')).toBe(
      'Your teammates are answering the last ones. The game ends when every team is done.',
    );
    expect(waitingText('timed')).toMatch(/every team is done or the time is up\.$/);
  });

  it('celebrates a first place only, once the game is finished', () => {
    const won = game({ status: 'finished', teams: [team({ place: 1 })] });
    expect(wonGame(won)).toBe(true);
    expect(wonGame({ ...won, teams: [team({ place: 2 })] })).toBe(false);
    expect(wonGame({ ...won, status: 'running' })).toBe(false);
    expect(wonGame({ ...won, me: { team_id: null, question: null, last: null, waiting: false } })).toBe(
      false,
    );
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

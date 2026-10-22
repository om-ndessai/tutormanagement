// Quest Games' pure rules (Phase 46, packages/shared/src/quest-games.ts): the ones the game's Durable
// Object runs in memory -- the team's queue, the hand-back, the two-minute handover, marking with and
// without negative marking, the end, and the places with their tie-breaks -- and the words the
// screens share. docs/quest-games-plan.md.
import {
  GAME_STALE_HAND_MS,
  answerQuestion,
  clockLabel,
  gameAnswerSchema,
  gameCodeSchema,
  gameIsOver,
  joinGameSchema,
  makeGameCode,
  normalizeGameCode,
  placeLabel,
  rankTeams,
  releaseHand,
  serveNext,
  teamTotals,
  winnersLabel,
  createGameSchema,
  GAME_COUNTDOWN_MS,
  gameCountdownLeft,
  gameEncouragement,
  gameEndReason,
  gameLevelIds,
  gameMarkingLabel,
  gameOpenToJoin,
  gamePlayersLabel,
  gameFavoriteSchema,
  knockoutDecided,
  normalizeEngineGame,
  gameClimbLevelIds,
  teamSeenIndices,
  type EngineGame,
  type EngineTeam,
  type SeriesQuestion,
} from '@tmi/shared';

const T0 = 1_000_000;

function series(n: number): SeriesQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    kind: 'numeric' as const,
    stem: `What is ${i} + 1?`,
    choices: [],
    answer: String(i + 1),
    solution: '',
  }));
}

function team(id: string, players: string[]): EngineTeam {
  return {
    id,
    name: id,
    solo: players.length === 1,
    code: players.length === 1 ? null : 'ABCDEF',
    created_by: players[0]!,
    players: players.map((user_id) => ({ user_id, first_name: user_id, joined_at: T0 })),
    next: 0,
    returned: [],
    hands: {},
    answers: [],
    last: {},
    finished_at: null,
  };
}

function game(over: Partial<EngineGame> = {}): EngineGame {
  return {
    id: 'g',
    organization_id: 'o',
    code: 'ABCDEF',
    host: { user_id: 'host', first_name: 'Host' },
    level_id: 'NC26.5',
    level_scope: 'level',
    level_ids: ['NC26.5'],
    climb_level_ids: [],
    mode: 'count',
    question_count: 4,
    duration_seconds: null,
    right_points: 1,
    wrong_points: 0,
    negative_marking: false,
    knockout: false,
    players: 'multi',
    max_teams: 20,
    max_team_size: 4,
    late_join: false,
    include_unreviewed: false,
    status: 'running',
    created_at: T0,
    started_at: T0,
    ended_at: null,
    end_reason: null,
    series_length: 4,
    teams: [],
    ...over,
  };
}

describe("a team's queue", () => {
  it('serves each teammate the next question no teammate has had, and keeps a hand across reloads', () => {
    const g = game();
    const pi = team('pi', ['a', 'b']);
    g.teams = [pi];
    expect(serveNext(g, pi, 'a', T0)).toBe(0);
    expect(serveNext(g, pi, 'b', T0)).toBe(1);
    expect(serveNext(g, pi, 'a', T0 + 5)).toBe(0);
  });

  it('every team plays the same series from its start', () => {
    const g = game();
    const pi = team('pi', ['a', 'b']);
    const solo = team('solo', ['c']);
    g.teams = [pi, solo];
    serveNext(g, pi, 'a', T0);
    serveNext(g, pi, 'b', T0);
    expect(serveNext(g, solo, 'c', T0)).toBe(0);
  });

  it('a question handed back goes first; a stale one passes to an idle teammate', () => {
    const g = game({ series_length: 2, question_count: 2 });
    const pi = team('pi', ['a', 'b']);
    g.teams = [pi];
    serveNext(g, pi, 'a', T0);
    serveNext(g, pi, 'b', T0);
    releaseHand(pi, 'a');
    expect(pi.hands.a).toBeUndefined();
    expect(serveNext(g, pi, 'a', T0 + 10)).toBe(0);

    // b answers; nothing left; a's hand is fresh, so b waits.
    const s = series(2);
    expect(
      answerQuestion(g, pi, s, { userId: 'b', questionId: s[1]!.id, answer: '2', skip: false, now: T0 + 20 }),
    ).toEqual({
      ok: true,
      correct: true,
      skipped: false,
    });
    expect(serveNext(g, pi, 'b', T0 + 30)).toBeNull();
    // Past the stale limit, a's question passes to b, and a's answer to it is refused.
    expect(serveNext(g, pi, 'b', T0 + 10 + GAME_STALE_HAND_MS)).toBe(0);
    expect(
      answerQuestion(g, pi, s, {
        userId: 'a',
        questionId: s[0]!.id,
        answer: '1',
        skip: false,
        now: T0 + GAME_STALE_HAND_MS + 20,
      }),
    ).toEqual({
      ok: false,
      reason: 'not_yours',
    });
  });

  it('serves nothing once a timed game is over, or before it runs', () => {
    const g = game({ mode: 'timed', question_count: null, duration_seconds: 60, series_length: 150 });
    const solo = team('solo', ['c']);
    g.teams = [solo];
    expect(serveNext(g, solo, 'c', T0 + 60_000)).toBeNull();
    expect(serveNext({ ...g, status: 'lobby' }, solo, 'c', T0)).toBeNull();
  });
});

describe('marking and the end', () => {
  it('scores +1 right, -1 wrong only with negative marking, 0 skipped', () => {
    const answers = [
      { index: 0, question_id: 'q', user_id: 'a', answer: '1', correct: true, skipped: false, at: 1 },
      { index: 1, question_id: 'q', user_id: 'a', answer: 'x', correct: false, skipped: false, at: 2 },
      { index: 2, question_id: 'q', user_id: 'a', answer: null, correct: false, skipped: true, at: 3 },
    ];
    expect(teamTotals(answers, false)).toEqual({ score: 1, correct: 1, wrong: 1, skipped: 1 });
    expect(teamTotals(answers, true)).toEqual({ score: 0, correct: 1, wrong: 1, skipped: 1 });
  });

  it('marks by code, refuses an answer after the clock, and ends when every team is done', () => {
    const s = series(1);
    const g = game({ series_length: 1, question_count: 1 });
    const solo = team('solo', ['c']);
    g.teams = [solo];
    serveNext(g, solo, 'c', T0);
    expect(gameIsOver(g, T0)).toBe(false);
    expect(
      answerQuestion(g, solo, s, {
        userId: 'c',
        questionId: s[0]!.id,
        answer: '1',
        skip: false,
        now: T0 + 1,
      }),
    ).toMatchObject({ ok: true, correct: true });
    expect(solo.finished_at).toBe(T0 + 1);
    expect(gameIsOver(g, T0 + 1)).toBe(true);

    const timed = game({ mode: 'timed', question_count: null, duration_seconds: 60, series_length: 150 });
    const late = team('late', ['d']);
    timed.teams = [late];
    serveNext(timed, late, 'd', T0);
    expect(
      answerQuestion(timed, late, s, {
        userId: 'd',
        questionId: s[0]!.id,
        answer: '1',
        skip: false,
        now: T0 + 60_000,
      }),
    ).toEqual({
      ok: false,
      reason: 'time_up',
    });
    expect(gameIsOver(timed, T0 + 60_000)).toBe(true);
  });
});

describe('places', () => {
  const answer = (index: number, correct: boolean, at: number, skipped = false) => ({
    index,
    question_id: `q${index}`,
    user_id: 'x',
    answer: skipped ? null : 'x',
    correct,
    skipped,
    at,
  });

  it('a count game: the higher score, then finishing, then the earlier finish; ties share', () => {
    const g = game({ series_length: 2 });
    const a = team('a', ['a']);
    const b = team('b', ['b']);
    const c = team('c', ['c']);
    const d = team('d', ['d']);
    a.answers = [answer(0, true, 5), answer(1, true, 9)];
    a.finished_at = 9;
    b.answers = [answer(0, true, 3), answer(1, false, 4)];
    b.finished_at = 4;
    c.answers = [answer(0, true, 2)];
    d.answers = [answer(0, true, 2), answer(1, false, 4)];
    d.finished_at = 4;
    g.teams = [a, b, c, d];
    const places = rankTeams(g);
    expect(places.get('a')).toBe(1);
    expect(places.get('b')).toBe(2);
    expect(places.get('d')).toBe(2);
    expect(places.get('c')).toBe(4);
  });

  it('a timed game: the higher score, then fewer wrong, then reaching the score first', () => {
    const g = game({ mode: 'timed', question_count: null, duration_seconds: 300, series_length: 150 });
    const a = team('a', ['a']);
    const b = team('b', ['b']);
    const c = team('c', ['c']);
    a.answers = [answer(0, true, 10), answer(1, false, 11)];
    b.answers = [answer(0, true, 20), answer(1, false, 1, true)];
    c.answers = [answer(0, true, 15)];
    g.teams = [a, b, c];
    const places = rankTeams(g);
    expect(places.get('c')).toBe(1);
    expect(places.get('b')).toBe(2);
    expect(places.get('a')).toBe(3);
  });
});

describe('codes and inputs', () => {
  it('makes six readable characters and tidies what is typed', () => {
    const code = makeGameCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(normalizeGameCode('ab c-12d')).toBe('ABC12D');
    expect(gameCodeSchema.parse({ code: 'g5r 4k6' })).toEqual({ code: 'G5R4K6' });
    expect(gameCodeSchema.safeParse({ code: 'G5R4' }).success).toBe(false);
  });

  it('a count game needs its count, a timed one its minutes; a team its name; an answer or a skip', () => {
    const base = { level_id: 'NC26.5', negative_marking: false, max_team_size: 2 } as const;
    expect(createGameSchema.safeParse({ ...base, mode: 'count' }).success).toBe(false);
    expect(createGameSchema.safeParse({ ...base, mode: 'count', question_count: 10 }).success).toBe(true);
    expect(createGameSchema.safeParse({ ...base, mode: 'timed', duration_minutes: 31 }).success).toBe(false);
    expect(
      createGameSchema.safeParse({ ...base, max_team_size: 7, mode: 'timed', duration_minutes: 5 }).success,
    ).toBe(false);
    expect(joinGameSchema.safeParse({ as: 'new_team', team_name: '  ' }).success).toBe(false);
    expect(joinGameSchema.parse({ as: 'team', team_code: 'w7wy-qb' })).toEqual({
      as: 'team',
      team_code: 'W7WYQB',
    });
    const id = '00000000-0000-4000-8000-000000000001';
    expect(gameAnswerSchema.safeParse({ question_id: id }).success).toBe(false);
    expect(gameAnswerSchema.safeParse({ question_id: id, skip: true }).success).toBe(true);
    expect(gameAnswerSchema.safeParse({ question_id: id, answer: '123-45-6789' }).success).toBe(false);
  });

  it('says places, clocks and winners', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(placeLabel)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ]);
    expect(clockLabel(125_400)).toBe('2:06');
    expect(clockLabel(-5)).toBe('0:00');
    const row = (name: string, place: number | null) => ({
      id: name,
      name,
      solo: true,
      code: null,
      players: [],
      score: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      answered: 0,
      finished_at: null,
      place,
    });
    expect(winnersLabel([row('Owls', 1), row('Pi', 2)])).toBe('Owls wins!');
    expect(winnersLabel([row('Owls', 1), row('Pi', 1), row('Cats', 1)])).toBe(
      'Owls, Pi and Cats share first place!',
    );
    expect(winnersLabel([])).toBe('Nobody played');
  });
});

// ---------------------------------------------------------------------------
// Phase 47 (docs/quest-games-g2-plan.md)
// ---------------------------------------------------------------------------

const done = (index: number, correct: boolean, skipped = false) => ({
  index,
  question_id: `q${index}`,
  user_id: 'x',
  answer: skipped ? null : 'x',
  correct,
  skipped,
  at: T0 + index,
});

describe('Phase 47: points, the countdown, knockout, joining', () => {
  it("scores by the game's points; the old switch still means +1 / -1", () => {
    const answers = [done(0, true), done(1, false), done(2, false, true)];
    expect(teamTotals(answers, { right_points: 3, wrong_points: -2 })).toMatchObject({ score: 1 });
    expect(teamTotals(answers, true).score).toBe(0);
    expect(gameMarkingLabel({ right_points: 2, wrong_points: -1 })).toBe('Right +2, wrong −1');
    expect(gameMarkingLabel(false)).toBe('Right +1, wrong 0');
  });

  it('serves nothing and takes no answer before the countdown ends', () => {
    const s = series(2);
    const g = game({ started_at: T0 + GAME_COUNTDOWN_MS, series_length: 2 });
    const solo = team('solo', ['c']);
    g.teams = [solo];
    expect(serveNext(g, solo, 'c', T0 + 1000)).toBeNull();
    expect(
      answerQuestion(g, solo, s, {
        userId: 'c',
        questionId: s[0]!.id,
        answer: '1',
        skip: false,
        now: T0 + 1000,
      }),
    ).toEqual({
      ok: false,
      reason: 'not_started',
    });
    expect(serveNext(g, solo, 'c', T0 + GAME_COUNTDOWN_MS)).toBe(0);
    const view = {
      status: 'running' as const,
      started_at: new Date(T0 + 5000).toISOString(),
      now: new Date(T0 + 1500).toISOString(),
    };
    expect(gameCountdownLeft(view)).toBe(3500);
    expect(gameCountdownLeft({ ...view, status: 'lobby' })).toBe(0);
  });

  it("knockout: the brief's example ends the game; a team that could still tie keeps it going", () => {
    const g = game({ knockout: true, series_length: 25, question_count: 25 });
    const leader = team('a', ['a']);
    leader.answers = Array.from({ length: 25 }, (_, i) => done(i, i < 20));
    leader.finished_at = T0 + 100;
    const chaser = team('b', ['b']);
    chaser.answers = Array.from({ length: 5 }, (_, i) => done(i, false));
    g.teams = [leader, chaser];
    // 20 final; the chaser can reach at most 0 + 20 = 20: a tie is still possible.
    expect(knockoutDecided(g)).toBe(false);
    chaser.answers.push(done(5, false));
    // At question 6 on 0, at most 19: nobody can catch the leader.
    expect(knockoutDecided(g)).toBe(true);
    expect(gameEndReason(g, T0 + 200)).toBe('knockout');
    // Off, or a single player's game: never.
    expect(knockoutDecided({ ...g, knockout: false })).toBe(false);
    expect(knockoutDecided({ ...g, players: 'single' })).toBe(false);
  });

  it('knockout counts what an unfinished leader could still lose', () => {
    const g = game({ knockout: true, series_length: 4, wrong_points: -3 });
    const a = team('a', ['a']);
    a.answers = [done(0, true), done(1, true)]; // 2, two left: could fall to -4
    const b = team('b', ['b']);
    b.answers = [done(0, false, true), done(1, false, true), done(2, false, true)]; // 0, one left: at most 1
    g.teams = [a, b];
    expect(knockoutDecided(g)).toBe(false);
    a.answers.push(done(2, true), done(3, true)); // 4, finished
    a.finished_at = T0 + 10;
    expect(knockoutDecided(g)).toBe(true);
  });

  it("joining: the lobby, a running game left open, never a single player's", () => {
    const g = game({ status: 'lobby', started_at: null });
    expect(gameOpenToJoin(g, T0)).toBe(true);
    expect(gameOpenToJoin({ ...g, status: 'running', started_at: T0 }, T0)).toBe(false);
    expect(gameOpenToJoin({ ...g, status: 'running', started_at: T0, late_join: true }, T0)).toBe(true);
    expect(gameOpenToJoin({ ...g, players: 'single' }, T0)).toBe(false);
  });

  it('Random draws from the level and those above it in its family, never below', () => {
    expect(gameLevelIds('NC26.7', 'level')).toEqual(['NC26.7']);
    expect(gameLevelIds('NC26.7', 'upward').slice(0, 3)).toEqual(['NC26.7', 'NC26.8', 'NC26.M1']);
    expect(gameLevelIds('NC26.7', 'upward')).not.toContain('NC26.6');
    expect(gameLevelIds('BA4', 'upward', ['BA4', 'PRE'])).toEqual(['BA4', 'PRE']);
  });

  it("a Phase 46 game is read with the defaults; an old app's request still parses", () => {
    const {
      level_scope: _s,
      level_ids: _l,
      climb_level_ids: _c,
      right_points: _r,
      wrong_points: _w,
      ...old
    } = game({ negative_marking: true });
    const filled = normalizeEngineGame(old as EngineGame);
    expect(filled).toMatchObject({
      level_scope: 'level',
      level_ids: ['NC26.5'],
      climb_level_ids: [],
      right_points: 1,
      wrong_points: -1,
    });
    const parsed = createGameSchema.parse({
      level_id: 'NC26.5',
      mode: 'count',
      question_count: 5,
      negative_marking: true,
      max_team_size: 2,
    });
    expect(parsed).toMatchObject({
      right_points: 1,
      wrong_points: -1,
      players: 'multi',
      late_join: false,
      knockout: false,
    });
    const single = createGameSchema.parse({
      level_id: 'NC26.5',
      mode: 'timed',
      duration_minutes: 3,
      players: 'single',
      max_team_size: 4,
      knockout: true,
    });
    expect(single).toMatchObject({ max_teams: 1, max_team_size: 1, knockout: false, late_join: false });
    expect(
      createGameSchema.safeParse({
        level_id: 'NC26.5',
        mode: 'count',
        question_count: 5,
        max_team_size: 1,
        wrong_points: 2,
      }).success,
    ).toBe(false);
    expect(
      gameFavoriteSchema.safeParse({
        name: '',
        config: { level_id: 'NC26.5', mode: 'count', question_count: 5, max_team_size: 1 },
      }).success,
    ).toBe(false);
  });

  it('says who plays, and encourages without comparing', () => {
    expect(gamePlayersLabel({ players: 'single', max_teams: 1, max_team_size: 1 })).toBe('Single player');
    expect(gamePlayersLabel({ players: 'multi', max_teams: 6, max_team_size: 1 })).toBe(
      'Up to 6 players, each on their own',
    );
    expect(gamePlayersLabel({ players: 'multi', max_teams: 3, max_team_size: 2 })).toBe(
      'Up to 3 teams of up to 2',
    );
    expect(gameEncouragement({ correct: 4, answered: 6, solo: true })).toBe(
      'You got 4 right. Great effort, and every game makes you sharper!',
    );
    expect(gameEncouragement({ correct: 3, answered: 3, solo: false })).toBe(
      'Your team got every one you answered right. Brilliant!',
    );
  });
});

// Phase 48 (docs/quest-games-g3-plan.md): the series is curated against what the players have seen.
describe('curating the series (Phase 48)', () => {
  it('climbs into the levels above in the family, never below, and not at all for Random', () => {
    expect(gameClimbLevelIds('NC26.7', 'level').slice(0, 2)).toEqual(['NC26.8', 'NC26.M1']);
    expect(gameClimbLevelIds('NC26.7', 'level')).not.toContain('NC26.7');
    expect(gameClimbLevelIds('NC26.7', 'level')).not.toContain('NC26.6');
    expect(gameClimbLevelIds('BA4', 'level', ['BA4', 'PRE'])).toEqual(['PRE']);
    expect(gameClimbLevelIds('GEO', 'level')).toEqual([]);
    expect(gameClimbLevelIds('NC26.5', 'upward')).toEqual([]);
  });

  it("counts a team's answers, skips and the questions still in hand as seen, each once", () => {
    const seen = teamSeenIndices({
      answers: [
        { index: 2, question_id: 'q2', user_id: 'a', answer: null, correct: false, skipped: true, at: T0 },
        { index: 0, question_id: 'q0', user_id: 'b', answer: 'x', correct: true, skipped: false, at: T0 },
      ],
      hands: { a: { index: 3, served_at: T0 }, b: { index: 2, served_at: T0 } },
    });
    expect(seen).toEqual([0, 2, 3]);
    expect(teamSeenIndices({ answers: [], hands: {} })).toEqual([]);
  });
});

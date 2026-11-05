// Phase 63 (P10-P12): a guest's quest and Assessment on the phone -- the series unseen first, the clock
// that pauses for the offer, when the offer shows, and the marking -- and the offer's words.
import type { GuestQuestion, GuestTile } from '@tmi/shared';

import {
  answerQuest,
  assessmentBenefits,
  assessmentCount,
  benefitsFor,
  boardGrade,
  challengeText,
  clockText,
  elapsedMs,
  gradeLevel,
  guestQuestName,
  guestScore,
  markAssessment,
  markGuestAnswer,
  nudgeDue,
  pauseQuest,
  playLink,
  questDone,
  resumeQuest,
  roundedCount,
  startQuest,
  startTodayQuest,
  timeLeftMs,
  todayTile,
  usedUpText,
} from './guest-model';

const q = (id: string, difficulty: number, extra: Partial<GuestQuestion> = {}): GuestQuestion => ({
  id,
  kind: 'choice',
  stem: `Question ${id}`,
  choices: ['1', '2', '3', '4'],
  answer: '2',
  solution: 'Because.',
  difficulty,
  beta: false,
  ...extra,
});

const POOL = [q('e', 3), q('a', 1), q('c', 2), q('b', 1), q('d', 2), q('f', 3)];
const COUNT: GuestTile = { code: 'G4Q5', kind: 'quest', level_id: 'NC26.4', mode: 'count', value: 3, words: 'Grade 4 · 3 questions', locked: false };
const TIMED: GuestTile = { ...COUNT, code: 'G4T2', mode: 'timed', value: 2, words: 'Grade 4 · 2 minutes' };
const SETTINGS = { nudge_after: 1, nudge_cooldown_hours: 24 };
const T0 = 1_000_000;

describe('a guest quest (P10)', () => {
  it('serves the tile’s count, unseen first and easiest first', () => {
    const state = startQuest(COUNT, POOL, new Set(['a']), T0);
    expect(state.questionIds).toEqual(['b', 'c', 'd']);
    expect(state.answers).toEqual([]);
    expect(state.pausedAt).toBeNull();
  });

  it('serves a timed tile the whole pool, seen ones last', () => {
    const state = startQuest(TIMED, POOL, new Set(['a', 'b']), T0);
    expect(state.questionIds).toEqual(['c', 'd', 'e', 'f', 'a', 'b']);
  });

  it('marks an answer with the shared rule; a skip is never right', () => {
    const state = startQuest(COUNT, POOL, new Set(), T0);
    const right = answerQuest(state, POOL[1]!, '2', { nudge_after: 0, nudge_cooldown_hours: 24 }, undefined, T0);
    expect(right.correct).toBe(true);
    const skipped = answerQuest(right.state, POOL[3]!, null, SETTINGS, undefined, T0);
    expect(skipped.correct).toBe(false);
    expect(guestScore(skipped.state.answers)).toBe(1);
    expect(skipped.state.answers.map((a) => a.answer)).toEqual(['2', null]);
  });

  it('ends on the last answer, or when the clock runs out', () => {
    let state = startQuest(COUNT, POOL, new Set(), T0);
    for (const id of state.questionIds) {
      expect(questDone(COUNT, state, T0)).toBe(false);
      state = answerQuest(state, POOL.find((p) => p.id === id)!, '1', SETTINGS, undefined, T0).state;
    }
    expect(questDone(COUNT, state, T0)).toBe(true);
    const timed = startQuest(TIMED, POOL, new Set(), T0);
    expect(timeLeftMs(TIMED, timed, T0 + 60_000)).toBe(60_000);
    expect(questDone(TIMED, timed, T0 + 119_999)).toBe(false);
    expect(questDone(TIMED, timed, T0 + 120_000)).toBe(true);
    expect(timeLeftMs(COUNT, timed, T0)).toBeNull();
  });
});

describe('the clock pauses for the offer (P12)', () => {
  it('leaves paused time out, and holds still while paused', () => {
    const state = startQuest(TIMED, POOL, new Set(), T0);
    const paused = pauseQuest(state, T0 + 10_000);
    expect(elapsedMs(paused, T0 + 10_000)).toBe(10_000);
    expect(elapsedMs(paused, T0 + 70_000)).toBe(10_000);
    expect(timeLeftMs(TIMED, paused, T0 + 500_000)).toBe(110_000);
    const resumed = resumeQuest(paused, T0 + 70_000);
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.pausedMs).toBe(60_000);
    expect(elapsedMs(resumed, T0 + 75_000)).toBe(15_000);
    // Pausing twice or resuming a running clock changes nothing.
    expect(pauseQuest(paused, T0 + 99_000)).toBe(paused);
    expect(resumeQuest(resumed, T0 + 99_000)).toBe(resumed);
  });

  it('pauses the clock when the offer shows after question 1, once a quest', () => {
    const state = startQuest(TIMED, POOL, new Set(), T0);
    const first = answerQuest(state, POOL[1]!, '2', SETTINGS, undefined, T0 + 5_000);
    expect(first.nudge).toBe(true);
    expect(first.state.nudged).toBe(true);
    expect(first.state.pausedAt).toBe(T0 + 5_000);
    const resumed = resumeQuest(first.state, T0 + 65_000);
    const second = answerQuest(resumed, POOL[3]!, '2', { ...SETTINGS, nudge_after: 2 }, undefined, T0 + 70_000);
    expect(second.nudge).toBe(false);
  });
});

describe('when the offer shows (P12)', () => {
  const base = { after: 1, cooldownHours: 24, dismissedAt: undefined, answered: 1, total: 5, nudged: false, now: T0 };
  it('after the console’s question', () => {
    expect(nudgeDue(base)).toBe(true);
    expect(nudgeDue({ ...base, answered: 2 })).toBe(false);
    expect(nudgeDue({ ...base, after: 2, answered: 2 })).toBe(true);
  });
  it('never with N = 0, never twice in a quest, never on the last answer', () => {
    expect(nudgeDue({ ...base, after: 0, answered: 0 })).toBe(false);
    expect(nudgeDue({ ...base, nudged: true })).toBe(false);
    expect(nudgeDue({ ...base, total: 1 })).toBe(false);
  });
  it('not again within the cooldown after a dismissal on this phone', () => {
    expect(nudgeDue({ ...base, dismissedAt: T0 - 3_600_000 })).toBe(false);
    expect(nudgeDue({ ...base, dismissedAt: T0 - 25 * 3_600_000 })).toBe(true);
    expect(nudgeDue({ ...base, cooldownHours: 0, dismissedAt: T0 - 1 })).toBe(true);
  });
});

describe('the offer’s words (P12)', () => {
  it('rounds a level’s count down, never above the truth', () => {
    expect(roundedCount(12)).toBeNull();
    expect(roundedCount(47)).toBe('40+');
    expect(roundedCount(180)).toBe('150+');
    expect(roundedCount(1234)).toBe('1,200+');
  });
  it('leads with the level’s own line', () => {
    expect(benefitsFor('NC26.4', { 'NC26.4': 1234 })[0]).toBe('1,200+ more Grade 4 questions, never repeated');
    expect(benefitsFor('NC26.4', {})[0]).toBe('Many more questions, never repeated');
    expect(benefitsFor(undefined, {})).toHaveLength(4);
    expect(assessmentBenefits('NC26.4', { 'NC26.4': 300 })).toEqual([
      'A PDF of your work, kept for you',
      'A tutor can review it and write back',
      '300+ more Grade 4 questions, never repeated',
      'Every quest unlocked: longer, timed, and family games',
    ]);
  });
  it('says the free questions are played, and names nobody when shared', () => {
    expect(usedUpText(COUNT, ['1,200+ more Grade 4 questions, never repeated'])).toBe(
      'You’ve played all the free Grade 4 questions. 1,200+ more Grade 4 questions, never repeated with a free account.',
    );
    expect(challengeText(8, 10, '10 in a row, Grade 4')).toBe('I got 8/10 on 10 in a row, Grade 4 on Aimtrue. Can you beat it?');
    // An advanced level is masked: never its curriculum's name.
    expect(usedUpText({ level_id: 'BA2' }, ['x'])).toBe('You’ve played all the free Adv G2 questions. x with a free account.');
    expect(benefitsFor('MK34', { MK34: 40 })[0]).toBe('40+ more Adv G3–4 questions, never repeated');
    expect(playLink('https://tutoring.example.dev/', 'G4Q5')).toBe('https://tutoring.example.dev/play/G4Q5');
    expect(playLink('http://localhost:8787')).toBe('http://localhost:8787/');
  });
  it('shows the clock as minutes and seconds', () => {
    expect(clockText(125_000)).toBe('2:05');
    expect(clockText(0)).toBe('0:00');
  });
});

describe('the Quest board (landing, direction C)', () => {
  const tile = (code: string, level: GuestTile['level_id']): GuestTile => ({
    code,
    kind: 'quest',
    level_id: level,
    mode: 'count',
    value: 5,
    words: '',
    locked: false,
  });
  it('opens on the remembered grade, an older level mapped, else Grade 4', () => {
    expect(boardGrade(undefined)).toBe(4);
    expect(boardGrade('NC26.3')).toBe(3);
    expect(boardGrade('NC17.6')).toBe(6);
    expect(boardGrade('BA2')).toBe(2);
    expect(boardGrade('NC26.M1')).toBe(4);
  });
  it('remembers a grade as its own level, so a member’s Play home can lead with it', () => {
    const tiles = [tile('BA3Q5', 'BA3'), tile('G3Q5', 'NC26.3')];
    expect(gradeLevel(tiles, 3)).toBe('NC26.3');
    expect(gradeLevel([tile('BA3Q5', 'BA3')], 3)).toBe('BA3');
    expect(gradeLevel([], 7)).toBe('NC26.7');
  });
  it('plays Today’s 5 as a pseudo tile: five, untimed, named for a guest, counted as G4D5', () => {
    const today = todayTile('NC26.4');
    expect(today).toMatchObject({ code: 'G4D5', kind: 'quest', mode: 'count', value: 5, locked: false });
    expect(guestQuestName(today, true)).toBe('Today’s 5, Grade 4');
    expect(guestQuestName(tile('BA2Q5', 'BA2'))).toBe('Quick 5, Adv G2');
  });
  it('serves the same five that day, whatever the phone has seen', () => {
    const pool = [...POOL, q('g', 1), q('h', 2)];
    const one = startTodayQuest(todayTile('NC26.4'), pool, '2026-11-02', 'NC26.4', 0);
    const two = startTodayQuest(todayTile('NC26.4'), [...pool].reverse(), '2026-11-02', 'NC26.4', 5);
    expect(one.questionIds).toHaveLength(5);
    expect(two.questionIds).toEqual(one.questionIds);
    expect(one.code).toBe('G4D5');
  });
});

describe('a guest Assessment, marked on the phone (P11)', () => {
  const number = q('n', 1, { kind: 'numeric', choices: [], answer: '3/4' });
  it('draws the tile’s number, capped by the console’s', () => {
    expect(assessmentCount({ value: 5 }, { assessment_questions: 3 })).toBe(3);
    expect(assessmentCount({ value: 5 }, { assessment_questions: 10 })).toBe(5);
  });
  it('marks a choice by its text and a number by what was typed', () => {
    const marks = markAssessment([POOL[1]!, POOL[3]!, number, q('x', 1)], { a: 1, b: 0, x: null }, { n: ' 0.75 ' });
    expect(marks.map((m) => [m.question.id, m.given, m.right])).toEqual([
      ['a', '2', true],
      ['b', '1', false],
      ['n', '0.75', true],
      ['x', null, false],
    ]);
    expect(markAssessment([number], {}, { n: '   ' })[0]!.given).toBeNull();
  });

  it('counts a trailing % only where the question asks for a percent (Phase 72, owner 2026-11-04)', () => {
    const percent = q('p', 1, {
      kind: 'numeric',
      choices: [],
      answer: '30',
      stem: 'Of 40 students, 12 walk to school. What percent of the students walk?',
    });
    const amount = q('m', 1, { kind: 'numeric', choices: [], answer: '7', stem: 'What is 10% of 70?' });
    expect(markGuestAnswer(percent, '30%')).toBe(true);
    expect(markGuestAnswer(percent, '30 percent')).toBe(true);
    expect(markGuestAnswer(percent, '30')).toBe(true);
    expect(markGuestAnswer(amount, '7%')).toBe(false);
    expect(markGuestAnswer(amount, '7')).toBe(true);
    // The quest and the Assessment both mark with the question's text.
    const state = startQuest(COUNT, [percent], new Set(), T0);
    expect(answerQuest(state, percent, '30%', SETTINGS, undefined, T0).correct).toBe(true);
    expect(markAssessment([percent], {}, { p: '30%' })[0]!.right).toBe(true);
  });
});

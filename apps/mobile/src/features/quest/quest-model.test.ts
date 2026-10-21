// Question Quest's pure rules (Phase 42, from the web's quest pages): who plays and who reviews, the
// once-per-sign-in landing, the sentences the screens say, the level picker, and what a submit sends.
import { QUESTION_BANK_LEVEL_IDS, type QuestReviewQueue, type QuestState } from '@tmi/shared';

import {
  NOT_SET,
  decideQuestLanding,
  finishedText,
  firstName,
  forgetQuestLandings,
  hasLanded,
  landingKey,
  levelInput,
  levelOptions,
  levelToast,
  markLanded,
  movedUpText,
  playSummary,
  pointsLabel,
  questLandingKind,
  questResponse,
  questRoles,
  questWide,
  reviewToast,
  savedToast,
  solverLine,
  startLabel,
} from './quest-model';

const STATE: QuestState = {
  level_id: 'BA3',
  question: {
    id: 'q1',
    kind: 'choice',
    stem: 'What is $2+2$?',
    choices: ['3', '4', '5', '6'],
    level_id: 'BA3',
  },
  moved_up_from: null,
  finished: false,
  points: 3,
  answered: 3,
};
const QUEUE: QuestReviewQueue = { item: null, waiting: 2, points: 5 };

describe('who plays and who reviews', () => {
  it('a student plays; a tutor or an admin reviews', () => {
    expect(questRoles(['student'])).toEqual({ plays: true, reviews: false });
    expect(questRoles(['tutor'])).toEqual({ plays: false, reviews: true });
    expect(questRoles(['admin'])).toEqual({ plays: false, reviews: true });
    expect(questRoles(['parent'])).toEqual({ plays: false, reviews: false });
    expect(questRoles(undefined)).toEqual({ plays: false, reviews: false });
  });

  it('lands a pure student or a pure tutor only', () => {
    expect(questLandingKind(['student'])).toBe('student');
    expect(questLandingKind(['tutor'])).toBe('tutor');
    expect(questLandingKind(['tutor', 'parent'])).toBe('tutor');
    // An admin is never taken anywhere, tutoring or not; nor is someone on both sides, or a parent.
    expect(questLandingKind(['admin'])).toBeNull();
    expect(questLandingKind(['admin', 'tutor'])).toBeNull();
    expect(questLandingKind(['tutor', 'student'])).toBeNull();
    expect(questLandingKind(['parent'])).toBeNull();
    expect(questLandingKind(undefined)).toBeNull();
  });
});

describe('the landing', () => {
  const base = { on: true, wizardPending: false, state: undefined, queue: undefined };

  it('decides nothing while the organization has Quest off', () => {
    expect(decideQuestLanding({ ...base, on: false, kind: 'student', state: STATE })).toEqual({
      settled: false,
    });
  });

  it('waits for the server, then sends a student with a question to play', () => {
    expect(decideQuestLanding({ ...base, kind: 'student' })).toEqual({ settled: false });
    expect(decideQuestLanding({ ...base, kind: 'student', state: STATE })).toEqual({
      settled: true,
      href: '/quest/play',
    });
    // Nothing to answer (no level, or finished): settled, and left on Home.
    expect(decideQuestLanding({ ...base, kind: 'student', state: { ...STATE, question: null } })).toEqual({
      settled: true,
      href: null,
    });
  });

  it('sends a tutor with answers waiting to review, and one with none nowhere', () => {
    expect(decideQuestLanding({ ...base, kind: 'tutor' })).toEqual({ settled: false });
    expect(decideQuestLanding({ ...base, kind: 'tutor', queue: QUEUE })).toEqual({
      settled: true,
      href: '/quest/review',
    });
    expect(decideQuestLanding({ ...base, kind: 'tutor', queue: { ...QUEUE, waiting: 0 } })).toEqual({
      settled: true,
      href: null,
    });
  });

  it('never lands anyone else, and gives way to the welcome wizard', () => {
    expect(decideQuestLanding({ ...base, kind: null })).toEqual({ settled: true, href: null });
    expect(decideQuestLanding({ ...base, kind: 'student', wizardPending: true, state: STATE })).toEqual({
      settled: true,
      href: null,
    });
  });

  it('is remembered per person and organization until sign-out, in memory', () => {
    forgetQuestLandings();
    const sofia = landingKey('u-sofia', 'chmi');
    expect(hasLanded(sofia)).toBe(false);
    markLanded(sofia);
    expect(hasLanded(sofia)).toBe(true);
    expect(hasLanded(landingKey('u-sofia', 'tmi'))).toBe(false);
    expect(hasLanded(landingKey('u-alex', 'chmi'))).toBe(false);
    forgetQuestLandings();
    expect(hasLanded(sofia)).toBe(false);
  });
});

describe('words', () => {
  it('counts points and says what was saved, never right or wrong', () => {
    expect(pointsLabel(0)).toBe('0 points');
    expect(pointsLabel(1)).toBe('1 point');
    expect(pointsLabel(12)).toBe('12 points');
    expect(savedToast()).toBe('Saved. +1 point');
    expect(savedToast(2)).toBe('Saved. +2 points');
  });

  it("says the web's sentences", () => {
    expect(reviewToast('approve')).toBe('Approved. The question is in the bank.');
    expect(reviewToast('flag')).toBe('Flagged for the platform.');
    expect(playSummary(STATE)).toBe('BA3 · 3 answered');
    expect(playSummary(undefined)).toBe('No level yet · 0 answered');
    expect(startLabel(0)).toBe('Start');
    expect(startLabel(undefined)).toBe('Start');
    expect(startLabel(4)).toBe('Carry on');
    expect(movedUpText('BA3', 'BA4')).toBe('You finished BA3. On to BA4!');
    expect(movedUpText('NC26.8', 'NC26.M1')).toBe('You finished G8. On to Math 1!');
    expect(finishedText(40)).toBe(
      'You have answered every question there is to answer for now. 40 answered in all.',
    );
    expect(firstName('Sofia Okafor')).toBe('Sofia');
    expect(firstName('Cher')).toBe('Cher');
  });

  it("reports the blind solver's verdict only when it gave one", () => {
    expect(solverLine(null, null)).toBeNull();
    expect(solverLine('12', null)).toBe('The blind solver answered 12.');
    expect(solverLine('12', 'Two options fit.')).toBe(
      'The blind solver answered 12 and noted: Two options fit.',
    );
    expect(solverLine(null, 'No answer fits.')).toBe(
      'The blind solver answered — and noted: No answer fits.',
    );
  });
});

describe('the level picker', () => {
  it('offers Not set, then every level of the bank in order, by its short name', () => {
    const options = levelOptions();
    expect(options[0]).toEqual({ id: NOT_SET, label: 'Not set' });
    expect(options.slice(1).map((option) => option.id)).toEqual([...QUESTION_BANK_LEVEL_IDS]);
    expect(options.find((option) => option.id === 'NC26.4')?.label).toBe('G4');
    expect(options.find((option) => option.id === 'PRE')?.label).toBe('AoPS Prealgebra');
  });

  it('sends null for Not set, and says what changed', () => {
    expect(levelInput(NOT_SET)).toBeNull();
    expect(levelInput('BA3')).toBe('BA3');
    expect(levelToast('Sofia Okafor', 'BA4')).toBe('Sofia Okafor starts at BA4.');
    expect(levelToast('Sofia Okafor', NOT_SET)).toBe('Sofia Okafor’s level is cleared.');
  });
});

describe('answering', () => {
  it("sends the chosen option's text, or the number as typed", () => {
    const choice = { kind: 'choice', choices: ['3', '4', '5', '6'] };
    expect(questResponse(choice, null, '')).toBe('');
    expect(questResponse(choice, 1, '')).toBe('4');
    const numeric = { kind: 'numeric', choices: [] };
    expect(questResponse(numeric, null, '  3/4 ')).toBe('3/4');
    expect(questResponse(numeric, null, '   ')).toBe('');
  });

  it('puts the question beside the answer on an iPad, not a phone', () => {
    expect(questWide(390)).toBe(false);
    expect(questWide(430)).toBe(false);
    expect(questWide(744)).toBe(true);
    expect(questWide(1024)).toBe(true);
  });
});

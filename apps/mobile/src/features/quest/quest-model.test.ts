// Question Quest's pure rules (Phase 42, from the web's quest pages): who plays and who reviews, the
// sentences the screens say, the level picker, and what a submit sends.
import { QUESTION_BANK_LEVEL_IDS, type QuestState } from '@tmi/shared';

import {
  NOT_SET,
  finishedText,
  firstName,
  levelInput,
  levelOptions,
  levelToast,
  movedUpText,
  playSummary,
  pointsLabel,
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

describe('who plays and who reviews', () => {
  it('a student plays; a tutor or an admin reviews', () => {
    expect(questRoles(['student'])).toEqual({ plays: true, reviews: false });
    expect(questRoles(['tutor'])).toEqual({ plays: false, reviews: true });
    expect(questRoles(['admin'])).toEqual({ plays: false, reviews: true });
    expect(questRoles(['parent'])).toEqual({ plays: false, reviews: false });
    expect(questRoles(undefined)).toEqual({ plays: false, reviews: false });
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
    expect(reviewToast('approve', true)).toBe('Approved. The question is in the bank.');
    expect(reviewToast('approve', false)).toBe('Sent to the platform to approve.');
    expect(reviewToast('flag', false)).toBe('Flagged for the platform.');
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
    const options = levelOptions(new Set(['ba', 'nc-2017', 'mk']));
    expect(options[0]).toEqual({ id: NOT_SET, label: 'Not set' });
    expect(options.slice(1).map((option) => option.id)).toEqual([...QUESTION_BANK_LEVEL_IDS]);
    expect(options.find((option) => option.id === 'NC26.4')?.label).toBe('G4');
    expect(options.find((option) => option.id === 'NC17.4')?.label).toBe('G4 (2017)');
    expect(options.find((option) => option.id === 'PRE')?.label).toBe('AoPS Prealgebra');
  });

  it('offers only the levels of the curricula the organization offers, and keeps the chosen one', () => {
    const ids = (offered: string[], keep?: string) => levelOptions(new Set(offered), keep).slice(1).map((o) => o.id);
    // NC 2026 is everyone's; Beast Academy's and NC 2017's levels need their curriculum.
    expect(ids([])).toEqual(QUESTION_BANK_LEVEL_IDS.filter((id) => id.startsWith('NC26.')));
    expect(ids(['nc-2017'])).toContain('NC17.PC');
    expect(ids(['nc-2017'])).not.toContain('BA1');
    expect(ids(['ba'])).not.toContain('NC17.4');
    expect(ids(['ba'], 'NC17.4')).toContain('NC17.4');
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

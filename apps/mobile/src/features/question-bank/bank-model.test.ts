// The bank's figures and the cache updates that replace a refetch per action (#54).
import { aLevel, aQuestion, aTopic } from '@/test/question-bank';
import {
  actionsFor,
  applyActionToCoverage,
  applyActionToList,
  applyFilter,
  approvedTone,
  bankTotals,
  filterCounts,
  findStandard,
  leftCount,
  levelSummary,
  nextInQueue,
  queueRunsLow,
  standardStatusLine,
  unactedCount,
  waitingCount,
} from './bank-model';

const TOPIC_A = aTopic({ topic_id: 'A', approved: [2, 2, 2], checked: 8 });
const TOPIC_B = aTopic({ topic_id: 'B', approved: [1, 0, 3], checked: 3, flagged: 1, draft: 2 });
const FIGURE = aTopic({ topic_id: 'F', approved: [2, 2, 2], needs_figure: true });
const LEVELS = [aLevel('NC26.4', 'Grade 4', [TOPIC_A, TOPIC_B]), aLevel('NC26.5', 'Grade 5', [FIGURE])];

describe('the figures', () => {
  it('totals the bank, counting "at target" among standards askable in text only', () => {
    expect(bankTotals(LEVELS)).toEqual({ approved: 16, atTarget: 1, askable: 2, toReview: 11, flagged: 1 });
    expect(waitingCount(LEVELS)).toBe(11);
    expect(waitingCount(undefined)).toBeUndefined();
  });

  it("says a level's line, with what waits only when something does", () => {
    expect(levelSummary(LEVELS[0]!)).toBe('1 of 2 standards at target · 11 to review');
    expect(levelSummary(LEVELS[1]!)).toBe('1 of 1 standards at target');
  });

  it("says a standard's status line as the web does", () => {
    expect(standardStatusLine(TOPIC_A)).toBe('8 to review');
    expect(standardStatusLine(TOPIC_B)).toBe('3 to review · 1 flagged · 2 not checked');
    expect(standardStatusLine(FIGURE)).toBe('At target');
    expect(standardStatusLine(aTopic())).toBe('');
  });

  it('tones a pill by its count against the target of two', () => {
    expect([0, 1, 2, 3].map(approvedTone)).toEqual(['none', 'some', 'target', 'target']);
  });

  it('finds a standard with its level', () => {
    expect(findStandard(LEVELS, 'B')).toMatchObject({ topic_id: 'B', level: 'Grade 4' });
    expect(findStandard(LEVELS, 'nope')).toBeUndefined();
  });
});

describe('the filters', () => {
  const qs = [
    aQuestion({ id: '1', status: 'checked' }),
    aQuestion({ id: '2', status: 'approved' }),
    aQuestion({ id: '3', status: 'retired' }),
    aQuestion({ id: '4', status: 'draft' }),
    aQuestion({ id: '5', status: 'flagged' }),
  ];

  it('counts each status, All leaving the retired out', () => {
    expect(filterCounts(qs)).toEqual({ all: 4, draft: 1, checked: 1, flagged: 1, approved: 1, retired: 1 });
    expect(applyFilter(qs, 'all').map((q) => q.id)).toEqual(['1', '2', '4', '5']);
    expect(applyFilter(qs, 'retired').map((q) => q.id)).toEqual(['3']);
  });

  it('offers Approve only when checked and Restore only when retired', () => {
    expect(actionsFor('checked')).toEqual({ approve: true, retire: true, restore: false });
    expect(actionsFor('approved')).toEqual({ approve: false, retire: true, restore: false });
    expect(actionsFor('retired')).toEqual({ approve: false, retire: false, restore: true });
    expect(actionsFor('flagged')).toEqual({ approve: false, retire: true, restore: false });
  });
});

describe('the review queue', () => {
  const items = ['1', '2', '3', '4'].map((id) => aQuestion({ id }));

  it('shows the first question neither skipped nor done', () => {
    expect(nextInQueue(items, new Set(['1']), new Set(['2']))?.id).toBe('3');
    expect(nextInQueue(items, new Set(['1', '2']), new Set(['3', '4']))).toBeNull();
    expect(unactedCount(items, new Set(['1']), new Set(['2']))).toBe(2);
  });

  it('never counts below nothing left', () => {
    expect(leftCount(10, 2)).toBe(8);
    expect(leftCount(1, 3)).toBe(0);
  });

  it('reads the next page only when few are left here and more wait elsewhere', () => {
    expect(queueRunsLow(9, 400, 0)).toBe(true);
    expect(queueRunsLow(10, 400, 0)).toBe(false);
    expect(queueRunsLow(5, 5, 0)).toBe(false); // everything waiting is already here
    expect(queueRunsLow(0, 3, 3)).toBe(false); // only skipped ones wait
    expect(queueRunsLow(3, undefined, 0)).toBe(false);
  });
});

describe('applyActionToList', () => {
  const list = [aQuestion({ id: '1' }), aQuestion({ id: '2' })];

  it('takes an approved question out of the checked queue', () => {
    const next = applyActionToList(list, { status: 'checked' }, aQuestion({ id: '1', status: 'approved' }));
    expect(next.map((q) => q.id)).toEqual(['2']);
  });

  it("replaces it in place in its standard's list", () => {
    const approved = aQuestion({ id: '1', status: 'approved' });
    const next = applyActionToList(list, { topic_id: 'NC26.3.ANR.1' }, approved);
    expect(next.map((q) => [q.id, q.status])).toEqual([
      ['1', 'approved'],
      ['2', 'checked'],
    ]);
  });

  it("leaves another standard's list, and a list without it, untouched", () => {
    const other = aQuestion({ id: '1', status: 'retired', topic_id: 'X' });
    expect(applyActionToList(list, { topic_id: 'NC26.3.ANR.1' }, other)).toBe(list);
    expect(applyActionToList(list, { status: 'checked' }, aQuestion({ id: '9', status: 'approved' }))).toBe(
      list,
    );
  });
});

describe('applyActionToCoverage', () => {
  const coverage = [
    aLevel('NC26.3', 'Grade 3', [aTopic({ checked: 5, flagged: 1, draft: 1, approved: [1, 0, 0] })]),
  ];
  const topic = (levels: typeof coverage) => levels[0]!.topics[0]!;
  const at = (
    status: 'checked' | 'approved' | 'retired' | 'draft' | 'flagged',
    difficulty: 1 | 2 | 3 = 2,
  ) => ({
    topic_id: 'NC26.3.ANR.1',
    status,
    difficulty,
  });

  it('moves an approval from "to review" to approved at its difficulty', () => {
    const next = topic(applyActionToCoverage(coverage, at('checked'), at('approved')));
    expect(next).toMatchObject({ checked: 4, approved: [1, 1, 0] });
  });

  it('takes a retired question out of whichever count held it', () => {
    expect(topic(applyActionToCoverage(coverage, at('checked'), at('retired'))).checked).toBe(4);
    expect(topic(applyActionToCoverage(coverage, at('approved', 1), at('retired', 1))).approved).toEqual([
      0, 0, 0,
    ]);
    expect(topic(applyActionToCoverage(coverage, at('flagged'), at('retired'))).flagged).toBe(0);
  });

  it('counts a restored question as not checked, or as flagged', () => {
    expect(topic(applyActionToCoverage(coverage, at('retired'), at('draft'))).draft).toBe(2);
    expect(topic(applyActionToCoverage(coverage, at('retired'), at('flagged'))).flagged).toBe(2);
  });

  it('changes nothing when the status did not change (retiring a retired one)', () => {
    expect(applyActionToCoverage(coverage, at('retired'), at('retired'))).toBe(coverage);
  });
});

import type { CanvasAssessment } from '@tmi/shared';

import {
  latestByStudent,
  recentAssessments,
  shortDay,
  studentStatusLine,
  waitingForReview,
} from './assessment-home-model';

const TZ = 'America/New_York';

function row(id: string, overrides: Partial<CanvasAssessment> = {}): CanvasAssessment {
  return {
    id,
    student_user_id: 's1',
    student_name: 'Noor Haddad',
    started_by_name: null,
    level_id: 'NC26.4',
    status: 'submitted',
    question_count: 10,
    questions_written: 10,
    choice_questions: null,
    choices_answered: null,
    choices_correct: null,
    unreviewed_questions: null,
    started_at: '2026-10-20T15:00:00.000Z',
    submitted_at: '2026-10-20T16:00:00.000Z',
    can_review: true,
    can_continue: false,
    reviewed_at: null,
    reviewed_by_name: null,
    review_draft: null,
    ...overrides,
  };
}

describe('shortDay', () => {
  it('reads the day on the organization clock', () => {
    // 02:00 UTC on the 23rd is still the 22nd in New York.
    expect(shortDay('2026-10-23T02:00:00.000Z', TZ)).toBe('Oct 22');
  });
});

describe('latestByStudent', () => {
  it('picks each student’s newest row and skips discarded ones', () => {
    const rows = [
      row('a', { started_at: '2026-10-20T15:00:00.000Z' }),
      row('b', { started_at: '2026-10-22T15:00:00.000Z', status: 'discarded' }),
      row('c', { started_at: '2026-10-21T15:00:00.000Z' }),
      row('d', { student_user_id: 's2', started_at: '2026-10-01T15:00:00.000Z' }),
    ];
    const latest = latestByStudent(rows);
    expect(latest.get('s1')?.id).toBe('c');
    expect(latest.get('s2')?.id).toBe('d');
  });
});

describe('studentStatusLine', () => {
  it('words each state', () => {
    expect(studentStatusLine(undefined, TZ)).toBe('No assessment yet');
    expect(
      studentStatusLine(row('a', { status: 'in_progress', submitted_at: null, started_at: '2026-10-22T15:00:00.000Z' }), TZ),
    ).toBe('In progress, started Oct 22');
    expect(studentStatusLine(row('a', { submitted_at: '2026-10-22T15:00:00.000Z' }), TZ)).toBe(
      'Submitted Oct 22, waiting for review',
    );
    expect(studentStatusLine(row('a', { review_draft: true }), TZ)).toBe('Review in progress');
    expect(studentStatusLine(row('a', { reviewed_at: '2026-10-23T15:00:00.000Z' }), TZ)).toBe('Reviewed Oct 23');
  });
});

describe('waitingForReview', () => {
  it('takes submitted, unreviewed rows the reader reviews, oldest first, at most 5', () => {
    const rows = [
      row('new', { submitted_at: '2026-10-22T10:00:00.000Z' }),
      row('old', { submitted_at: '2026-10-19T10:00:00.000Z' }),
      row('done', { reviewed_at: '2026-10-21T10:00:00.000Z' }),
      row('theirs', { can_review: false }),
      row('open', { status: 'in_progress', submitted_at: null }),
      ...['1', '2', '3', '4'].map((n) => row(`more-${n}`, { submitted_at: `2026-10-2${n}T12:00:00.000Z` })),
    ];
    const waiting = waitingForReview(rows);
    expect(waiting).toHaveLength(5);
    expect(waiting[0]?.id).toBe('old');
    expect(waiting.map((r) => r.id)).not.toEqual(expect.arrayContaining(['done', 'theirs', 'open']));
  });
});

describe('recentAssessments', () => {
  it('takes the five newest that are not discarded', () => {
    const rows = ['1', '2', '3', '4', '5', '6'].map((n) => row(n, { started_at: `2026-10-1${n}T12:00:00.000Z` }));
    rows.push(row('gone', { status: 'discarded', started_at: '2026-10-30T12:00:00.000Z' }));
    expect(recentAssessments(rows).map((r) => r.id)).toEqual(['6', '5', '4', '3', '2']);
  });
});

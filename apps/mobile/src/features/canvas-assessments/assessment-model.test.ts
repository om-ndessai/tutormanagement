// The take screen's pure rules (from the web's take-assessment-page.tsx): what counts as
// unanswered, choosing and un-choosing, the page buttons, the request a submission sends, the work
// kept on the device, Undo, and the sentences the list and the review show.
import type { CanvasAssessment, CanvasAssessmentQuestion, CanvasStroke } from '@tmi/shared';

import {
  EMPTY_TAKE,
  levelOptionDetail,
  pageLabel,
  pageMark,
  parseSavedWork,
  reviewSummary,
  rowSummary,
  startNote,
  submitMessage,
  submitPages,
  takeReducer,
  toggleChoice,
  unansweredCount,
  type SavedWork,
} from './assessment-model';

const CHOICE: CanvasAssessmentQuestion = {
  id: 'q-choice',
  kind: 'choice',
  skill: 'Place value',
  stem: 'Which is $42{,}605$?',
  choices: ['42,605', '42,650', '4,265', '420,605'],
};
const NUMERIC: CanvasAssessmentQuestion = {
  id: 'q-number',
  kind: 'numeric',
  skill: null,
  stem: 'What is $7 \\times 1{,}000$?',
  choices: [],
};
const STROKE: CanvasStroke = { width: 4, points: [10, 20, 30, 40] };

describe('answers', () => {
  it('counts a choice question by its choice and any other by its writing', () => {
    const empty: SavedWork = { pages: {}, choices: {} };
    expect(unansweredCount([CHOICE, NUMERIC], empty)).toBe(2);
    // Writing on a choice question is working, not an answer.
    expect(unansweredCount([CHOICE, NUMERIC], { pages: { 'q-choice': [STROKE] }, choices: {} })).toBe(2);
    expect(unansweredCount([CHOICE, NUMERIC], { pages: { 'q-number': [STROKE] }, choices: { 'q-choice': 0 } })).toBe(0);
    expect(unansweredCount([CHOICE], { pages: {}, choices: { 'q-choice': null } })).toBe(1);
  });

  it('says how many have no answer before submitting', () => {
    expect(submitMessage(0, 10)).toMatch(/^Every question has an answer\. Once submitted/);
    expect(submitMessage(3, 10)).toMatch(/^3 of 10 questions have no answer yet\. Once submitted/);
  });

  it('chooses, moves the choice, and takes it back when tapped again', () => {
    const one = toggleChoice({}, 'q', 1);
    expect(one).toEqual({ q: 1 });
    expect(toggleChoice(one, 'q', 2)).toEqual({ q: 2 });
    expect(toggleChoice(one, 'q', 1)).toEqual({ q: null });
  });

  it('marks a page button with its writing and its answer', () => {
    const work: SavedWork = { pages: { 'q-choice': [STROKE] }, choices: { 'q-choice': 2 } };
    expect(pageMark(CHOICE, work)).toEqual({ written: true, chosen: true });
    expect(pageMark(NUMERIC, work)).toEqual({ written: false, chosen: false });
    expect(pageLabel(1, { written: true, chosen: true })).toBe('Question 1, has writing, answered');
    expect(pageLabel(2, { written: false, chosen: false })).toBe('Question 2');
  });
});

describe('submitting', () => {
  it('sends every question, its strokes on the wire and a choice only for a choice question', () => {
    const work: SavedWork = { pages: { 'q-number': [STROKE] }, choices: { 'q-choice': 3, 'q-number': 1 } };
    expect(submitPages([CHOICE, NUMERIC], work)).toEqual({
      pages: [
        { question_id: 'q-choice', strokes: [], choice: 3 },
        { question_id: 'q-number', strokes: ['4 10 20 30 40'], choice: null },
      ],
    });
  });
});

describe('the work kept on the device', () => {
  it('reads back what was saved', () => {
    const work: SavedWork = { pages: { a: [STROKE] }, choices: { b: 2, c: null } };
    expect(parseSavedWork(JSON.stringify(work))).toEqual(work);
  });

  it('leaves out anything that is not work, and survives nothing or rubbish', () => {
    expect(parseSavedWork(null)).toEqual({ pages: {}, choices: {} });
    expect(parseSavedWork('{not json')).toEqual({ pages: {}, choices: {} });
    expect(
      parseSavedWork(
        JSON.stringify({
          pages: { a: [STROKE, { width: 4, points: [1] }, 'x'], b: 'no' },
          choices: { c: 1.5, d: -1, e: 'A', f: 0 },
        }),
      ),
    ).toEqual({ pages: { a: [STROKE] }, choices: { f: 0 } });
  });
});

describe('takeReducer', () => {
  it('adds, undoes, clears and undoes the clear', () => {
    let state = takeReducer(EMPTY_TAKE, { type: 'add', questionId: 'q', stroke: STROKE });
    const second = { width: 4, points: [1, 1] };
    state = takeReducer(state, { type: 'add', questionId: 'q', stroke: second });
    expect(state.work.pages.q).toEqual([STROKE, second]);
    state = takeReducer(state, { type: 'undo', questionId: 'q' });
    expect(state.work.pages.q).toEqual([STROKE]);
    state = takeReducer(state, { type: 'clear', questionId: 'q' });
    expect(state.work.pages.q).toEqual([]);
    state = takeReducer(state, { type: 'undo', questionId: 'q' });
    expect(state.work.pages.q).toEqual([STROKE]);
    // Nothing left to undo: unchanged.
    state = takeReducer(state, { type: 'undo', questionId: 'q' });
    expect(takeReducer(state, { type: 'undo', questionId: 'q' })).toBe(state);
  });

  it('erases the strokes named, never by a stale index', () => {
    const a = { width: 4, points: [1, 1] };
    const b = { width: 4, points: [2, 2] };
    let state = takeReducer(EMPTY_TAKE, { type: 'load', work: { pages: { q: [a, b] }, choices: {} } });
    state = takeReducer(state, { type: 'erase', questionId: 'q', hit: [a] });
    expect(state.work.pages.q).toEqual([b]);
    // A second touch that saw `a` before it went: nothing more is removed.
    expect(takeReducer(state, { type: 'erase', questionId: 'q', hit: [a] })).toBe(state);
  });

  it('keeps each page apart and only the last 50 steps', () => {
    let state = EMPTY_TAKE;
    for (let i = 0; i < 60; i += 1) state = takeReducer(state, { type: 'add', questionId: 'q', stroke: STROKE });
    expect(state.history.q).toHaveLength(50);
    expect(state.history.other).toBeUndefined();
    state = takeReducer(state, { type: 'choose', questionId: 'c', index: 1 });
    expect(state.work.choices).toEqual({ c: 1 });
    state = takeReducer(state, { type: 'choose', questionId: 'c', index: 1 });
    expect(state.work.choices).toEqual({ c: null });
  });
});

describe('the sentences', () => {
  const NOW = new Date('2026-10-18T12:00:00Z');
  const ROW: CanvasAssessment = {
    id: 'a-1',
    student_user_id: 's-1',
    student_name: 'Sofia Okafor',
    started_by_name: 'Priya Raghavan',
    level_id: 'NC26.4',
    status: 'submitted',
    question_count: 10,
    questions_written: 7,
    choice_questions: 4,
    choices_answered: 4,
    choices_correct: 3,
    unreviewed_questions: 2,
    started_at: '2026-10-18T11:00:00Z',
    submitted_at: '2026-10-18T11:55:00Z',
    can_review: true,
    can_continue: false,
  };

  it('offers a grade with its question count, or says it has none', () => {
    expect(levelOptionDetail({ level_id: 'NC26.4', label: 'Grade 4', available: 12, unreviewed: 0 })).toBe(
      '10 questions',
    );
    expect(levelOptionDetail({ level_id: 'NC26.3', label: 'Grade 3', available: 1, unreviewed: 1 })).toBe(
      '1 question · includes unreviewed',
    );
    expect(levelOptionDetail({ level_id: 'NC26.5', label: 'Grade 5', available: 0, unreviewed: 0 })).toBe(
      'no approved questions yet',
    );
  });

  it('notes whether unreviewed questions are included', () => {
    expect(startNote(false)).toContain('chosen at random from the approved ones.');
    expect(startNote(true)).toContain('including questions not yet reviewed in the bank');
  });

  it('summarises a row as the web does', () => {
    expect(rowSummary(ROW, NOW)).toBe(
      '7 of 10 questions written · 3 of 4 choices correct · submitted 5 minutes ago · started by Priya Raghavan',
    );
    expect(rowSummary({ ...ROW, status: 'in_progress', started_by_name: null }, NOW)).toBe(
      '10 questions · started 1 hour ago',
    );
  });

  it('summarises a review: written, multiple choice and not yet reviewed', () => {
    expect(reviewSummary(ROW)).toBe(
      '7 of 10 questions written · multiple choice 3 of 4 correct · 2 not yet reviewed in the bank',
    );
    expect(reviewSummary({ ...ROW, choice_questions: 0, unreviewed_questions: 0 })).toBe('7 of 10 questions written');
  });
});

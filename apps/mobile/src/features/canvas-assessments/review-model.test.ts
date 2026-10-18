// The review editor's and the list's pure rules (Phase 40, from the web's review-assessment-page.tsx,
// assessments-page.tsx and assessment-pdf-page.tsx).
import { REVIEW_PAGE, formatStroke, parseStroke, type CanvasAssessment } from '@tmi/shared';

import { finishStroke, strokeFits } from './drawing-model';
import {
  REVIEW_PEN,
  inkFrom,
  mayOpenPdf,
  pdfScreenSummary,
  reviewPayload,
  rowActions,
  saveStateText,
  statusLabel,
} from './review-model';

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
  unreviewed_questions: 0,
  started_at: '2026-10-18T11:00:00Z',
  submitted_at: '2026-10-18T11:30:00Z',
  can_review: true,
  can_continue: false,
  reviewed_at: null,
  reviewed_by_name: null,
  review_draft: null,
};

describe('the ink', () => {
  it('is kept in the PDF page’s points and read back from the wire', () => {
    // A tutor's stroke near the bottom right corner of a page: inside 612 x 792, outside 1000 x 800's height.
    const stroke = finishStroke([600, 780.4, 611.6, 791.9, 700, 900], REVIEW_PEN, REVIEW_PAGE);
    expect(stroke).toEqual({ width: 2, points: [600, 780, 612, 792] });
    expect(parseStroke(formatStroke(stroke), REVIEW_PAGE)).toEqual(stroke);
    expect(inkFrom({ ink: [{ question_id: 'q', strokes: [formatStroke(stroke), 'not a stroke', '2 700 10'] }] })).toEqual({
      q: [stroke],
    });
  });

  it('is sent as every page’s strokes on the wire, with the notes and the comment', () => {
    const stroke = { width: 2, points: [10, 20, 30, 40] };
    expect(reviewPayload('Good work.', { q: 'Check the carry.' }, { q: [stroke], r: [] })).toEqual({
      comment: 'Good work.',
      notes: { q: 'Check the carry.' },
      ink: [
        { question_id: 'q', strokes: ['2 10 20 30 40'] },
        { question_id: 'r', strokes: [] },
      ],
    });
  });

  it('refuses a stroke past what a review keeps on one page', () => {
    const dot = { width: 2, points: [1, 1] };
    const full = Array.from({ length: 400 }, () => dot);
    expect(strokeFits(full.slice(1), dot, { strokesPerPage: 400, numbersPerPage: 20_000 })).toBe(true);
    expect(strokeFits(full, dot, { strokesPerPage: 400, numbersPerPage: 20_000 })).toBe(false);
  });
});

describe('saveStateText', () => {
  const base = { final: false, finishedAt: null, saveState: 'saved' as const, dirty: false, now: NOW };

  it('says what the draft is doing, as the web does', () => {
    expect(saveStateText(base)).toBe(
      'Draft saved. Only the student’s tutors and the office see it until it is saved as reviewed.',
    );
    expect(saveStateText({ ...base, dirty: true })).toBe('Changes not saved yet…');
    expect(saveStateText({ ...base, saveState: 'saving' })).toBe('Saving…');
    expect(saveStateText({ ...base, saveState: 'failed' })).toBe('Not saved yet. It will try again as you work.');
  });

  it('says when it was saved as reviewed', () => {
    expect(saveStateText({ ...base, final: true, finishedAt: '2026-10-18T11:55:00Z' })).toBe(
      'Saved as reviewed 5 minutes ago. Reopen it to change it.',
    );
    expect(saveStateText({ ...base, final: true })).toBe('Saved as reviewed. Reopen it to change it.');
  });
});

describe('a row of the list', () => {
  it('reads "Reviewed" once a tutor has saved it as reviewed', () => {
    expect(statusLabel(ROW)).toBe('Submitted');
    expect(statusLabel({ ...ROW, reviewed_at: NOW.toISOString() })).toBe('Reviewed');
    expect(statusLabel({ ...ROW, status: 'in_progress' })).toBe('In progress');
  });

  it('offers a reviewer Review, Continue review or Edit review, and the submitted PDF', () => {
    expect(rowActions(ROW)).toEqual({
      continue: false,
      discard: false,
      review: 'Review',
      submittedPdf: true,
      openReview: false,
    });
    expect(rowActions({ ...ROW, review_draft: true }).review).toBe('Continue review');
    expect(rowActions({ ...ROW, reviewed_at: NOW.toISOString(), review_draft: false })).toMatchObject({
      review: 'Edit review',
      openReview: true,
    });
  });

  it('offers the family only "Open the review", and only once it exists', () => {
    const family = { ...ROW, can_review: false };
    expect(rowActions(family)).toEqual({
      continue: false,
      discard: false,
      review: null,
      submittedPdf: false,
      openReview: false,
    });
    expect(rowActions({ ...family, reviewed_at: NOW.toISOString() })).toMatchObject({
      review: null,
      submittedPdf: false,
      openReview: true,
    });
  });

  it('offers whoever started one in progress Continue and Discard', () => {
    expect(rowActions({ ...ROW, can_continue: true, can_review: false })).toMatchObject({
      continue: true,
      discard: true,
      review: null,
    });
  });
});

describe('the PDF screen', () => {
  it('opens the submitted PDF for reviewers and the reviewed one for anyone once it exists', () => {
    expect(mayOpenPdf(ROW, 'submitted')).toBe(true);
    expect(mayOpenPdf({ ...ROW, can_review: false }, 'submitted')).toBe(false);
    expect(mayOpenPdf({ ...ROW, can_review: false }, 'reviewed')).toBe(false);
    expect(mayOpenPdf({ ...ROW, can_review: false, reviewed_at: NOW.toISOString() }, 'reviewed')).toBe(true);
  });

  it('names who reviewed it and when, or summarises the submission', () => {
    const reviewed = { ...ROW, reviewed_at: '2026-10-18T10:00:00Z', reviewed_by_name: 'Alex Chen' };
    expect(pdfScreenSummary(reviewed, 'reviewed', NOW)).toBe('Reviewed by Alex Chen 2 hours ago');
    expect(pdfScreenSummary({ ...reviewed, reviewed_by_name: null }, 'reviewed', NOW)).toBe(
      'Reviewed by the tutor 2 hours ago',
    );
    expect(pdfScreenSummary(ROW, 'submitted')).toBe('7 of 10 questions written · multiple choice 3 of 4 correct');
  });
});

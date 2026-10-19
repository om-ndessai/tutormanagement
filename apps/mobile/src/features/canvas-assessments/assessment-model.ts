// The rules of apps/web/src/features/canvas-assessments/{take-assessment-page.tsx,
// assessments-page.tsx, review-assessment-page.tsx} @ 37bdad1 (with Phase 40), kept pure so they are tested without a
// screen: what counts as unanswered, choosing and un-choosing, what a page button shows, the request
// a submission sends, the work saved on the device, and the sentences under a row and a review.
import {
  formatRelativeTime,
  formatStroke,
  type CanvasAssessment,
  type CanvasAssessmentLevel,
  type CanvasAssessmentQuestion,
  type CanvasStroke,
  type SubmitCanvasAssessmentInput,
} from '@tmi/shared';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export type Pages = Record<string, CanvasStroke[]>;
/** A multiple-choice question's selected choice, by position. */
export type Choices = Record<string, number | null>;
export interface SavedWork {
  pages: Pages;
  choices: Choices;
}

/** Unanswered: a multiple-choice question with nothing chosen, any other with nothing written. */
export function isAnswered(question: CanvasAssessmentQuestion, work: SavedWork): boolean {
  return question.kind === 'choice'
    ? (work.choices[question.id] ?? null) !== null
    : (work.pages[question.id]?.length ?? 0) > 0;
}

export function unansweredCount(questions: readonly CanvasAssessmentQuestion[], work: SavedWork): number {
  return questions.filter((question) => !isAnswered(question, work)).length;
}

/** The confirm's sentence before submitting (the web's AlertDialogDescription). */
export function submitMessage(unanswered: number, total: number): string {
  return (
    (unanswered === 0 ? 'Every question has an answer.' : `${unanswered} of ${total} questions have no answer yet.`) +
    ' Once submitted it cannot be changed, and your tutor gets a PDF of your answers.'
  );
}

/** Choosing it again takes the choice back. */
export function toggleChoice(choices: Choices, questionId: string, index: number): Choices {
  const selected = (choices[questionId] ?? null) === index;
  return { ...choices, [questionId]: selected ? null : index };
}

/** What a numbered page button shows: whether it has writing, and whether its choice is made. */
export function pageMark(
  question: CanvasAssessmentQuestion,
  work: SavedWork,
): { written: boolean; chosen: boolean } {
  return {
    written: (work.pages[question.id]?.length ?? 0) > 0,
    chosen: question.kind === 'choice' && (work.choices[question.id] ?? null) !== null,
  };
}

/** The page button's spoken label, as the web's aria-label. */
export function pageLabel(position: number, mark: { written: boolean; chosen: boolean }): string {
  return `Question ${position}${mark.written ? ', has writing' : ''}${mark.chosen ? ', answered' : ''}`;
}

/** The request a submission sends: every question, its strokes on the wire, its choice or null. */
export function submitPages(
  questions: readonly CanvasAssessmentQuestion[],
  work: SavedWork,
): SubmitCanvasAssessmentInput {
  return {
    pages: questions.map((question) => ({
      question_id: question.id,
      strokes: (work.pages[question.id] ?? []).map(formatStroke),
      choice: question.kind === 'choice' ? (work.choices[question.id] ?? null) : null,
    })),
  };
}

function isStroke(value: unknown): value is CanvasStroke {
  if (!value || typeof value !== 'object') return false;
  const stroke = value as { width?: unknown; points?: unknown };
  return (
    typeof stroke.width === 'number' &&
    Array.isArray(stroke.points) &&
    stroke.points.length >= 2 &&
    stroke.points.length % 2 === 0 &&
    stroke.points.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** The work kept on the device, read defensively: anything that is not work is left out. */
export function parseSavedWork(raw: string | null): SavedWork {
  const empty: SavedWork = { pages: {}, choices: {} };
  if (!raw) return empty;
  try {
    const saved = JSON.parse(raw) as Partial<Record<keyof SavedWork, unknown>>;
    const pages: Pages = {};
    if (saved.pages && typeof saved.pages === 'object') {
      for (const [id, strokes] of Object.entries(saved.pages as Record<string, unknown>)) {
        if (Array.isArray(strokes)) pages[id] = strokes.filter(isStroke);
      }
    }
    const choices: Choices = {};
    if (saved.choices && typeof saved.choices === 'object') {
      for (const [id, choice] of Object.entries(saved.choices as Record<string, unknown>)) {
        if (choice === null || (typeof choice === 'number' && Number.isInteger(choice) && choice >= 0)) {
          choices[id] = choice;
        }
      }
    }
    return { pages, choices };
  } catch {
    return empty;
  }
}

/**
 * A grade as the picker offers it (the web's SelectItem): "Grade 4 · 10 questions", at most the
 * organization's own count (Phase 40).
 */
export function levelOptionDetail(level: CanvasAssessmentLevel, questions = 10): string {
  if (level.available === 0) return 'no approved questions yet';
  return (
    `${Math.min(level.available, questions)} question${level.available === 1 ? '' : 's'}` +
    (level.unreviewed > 0 ? ' · includes unreviewed' : '')
  );
}

/** The start card's note under the pickers, with the organization's count (Phase 40). */
export function startNote(includesUnreviewed: boolean, questions = 10): string {
  return (
    `Up to ${questions} questions of the level, chosen at random` +
    (includesUnreviewed
      ? ', including questions not yet reviewed in the bank (your organization is trying them out)'
      : ' from the approved ones') +
    '. Multiple-choice questions are answered by choosing; the canvas is there for working. Work can be revisited and changed until it is submitted.'
  );
}

/** The line under a row of the list. */
export function rowSummary(row: CanvasAssessment, now?: Date): string {
  return (
    (row.status === 'submitted'
      ? `${row.questions_written} of ${row.question_count} questions written` +
        (row.choice_questions ? ` · ${row.choices_correct} of ${row.choice_questions} choices correct` : '') +
        ` · submitted ${formatRelativeTime(row.submitted_at ?? row.started_at, now)}` +
        (row.reviewed_at && row.reviewed_by_name ? ` · reviewed by ${row.reviewed_by_name}` : '')
      : `${row.question_count} questions · started ${formatRelativeTime(row.started_at, now)}`) +
    (row.started_by_name ? ` · started by ${row.started_by_name}` : '')
  );
}

/** The review screen's line: written, multiple choice correct, and not yet reviewed in the bank. */
export function reviewSummary(row: CanvasAssessment): string {
  return (
    `${row.questions_written} of ${row.question_count} questions written` +
    (row.choice_questions ? ` · multiple choice ${row.choices_correct} of ${row.choice_questions} correct` : '') +
    (row.unreviewed_questions ? ` · ${row.unreviewed_questions} not yet reviewed in the bank` : '')
  );
}

// --- The take screen's state ------------------------------------------------------------------

/** The work, and each page's earlier versions for Undo (the web keeps the last 50). */
export interface TakeState {
  work: SavedWork;
  history: Record<string, CanvasStroke[][]>;
}

export type TakeAction =
  | { type: 'load'; work: SavedWork }
  | { type: 'add'; questionId: string; stroke: CanvasStroke }
  | { type: 'erase'; questionId: string; hit: readonly CanvasStroke[] }
  | { type: 'clear'; questionId: string }
  | { type: 'undo'; questionId: string }
  | { type: 'choose'; questionId: string; index: number };

export const EMPTY_TAKE: TakeState = { work: { pages: {}, choices: {} }, history: {} };

/** Replaces a page's strokes, keeping the old ones for Undo. */
function changePage(state: TakeState, questionId: string, next: CanvasStroke[]): TakeState {
  const before = state.work.pages[questionId] ?? [];
  return {
    work: { ...state.work, pages: { ...state.work.pages, [questionId]: next } },
    history: { ...state.history, [questionId]: [...(state.history[questionId] ?? []), before].slice(-50) },
  };
}

/**
 * Every change to the work, applied to the latest state. The eraser names the strokes themselves,
 * so a second touch that reached it before the first was drawn never removes the wrong one.
 */
export function takeReducer(state: TakeState, action: TakeAction): TakeState {
  switch (action.type) {
    case 'load':
      return { work: action.work, history: {} };
    case 'add':
      return changePage(state, action.questionId, [...(state.work.pages[action.questionId] ?? []), action.stroke]);
    case 'erase': {
      const strokes = state.work.pages[action.questionId] ?? [];
      const next = strokes.filter((stroke) => !action.hit.includes(stroke));
      return next.length === strokes.length ? state : changePage(state, action.questionId, next);
    }
    case 'clear':
      return (state.work.pages[action.questionId]?.length ?? 0) === 0
        ? state
        : changePage(state, action.questionId, []);
    case 'undo': {
      const past = state.history[action.questionId] ?? [];
      const previous = past.at(-1);
      if (!previous) return state;
      return {
        work: { ...state.work, pages: { ...state.work.pages, [action.questionId]: previous } },
        history: { ...state.history, [action.questionId]: past.slice(0, -1) },
      };
    }
    case 'choose':
      return {
        ...state,
        work: { ...state.work, choices: toggleChoice(state.work.choices, action.questionId, action.index) },
      };
  }
}

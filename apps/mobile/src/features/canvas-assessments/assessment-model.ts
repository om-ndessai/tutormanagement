// The rules of apps/web/src/features/canvas-assessments/{take-assessment-page.tsx,
// assessments-page.tsx, review-assessment-page.tsx} @ 37bdad1 (with Phase 40), kept pure so they are tested without a
// screen: what counts as unanswered, choosing and un-choosing, what a page button shows, the request
// a submission sends, the work saved on the device, and the sentences under a row and a review.
// Phase 77 (JF20, owner 2026-11-05): the hand-over before the questions when the reader is not the student ("Hand the
// device to Noor"), Start's warning when the student already has one in progress, and what a submit by someone else
// says (the PDF is the tutor's; never linked to the guardian).
import {
  formatRelativeTime,
  formatStroke,
  type CanvasAssessment,
  type CanvasAssessmentLevel,
  type CanvasAssessmentQuestion,
  type CanvasStroke,
  type SubmitCanvasAssessmentInput,
} from '@tmi/shared';

import { levelWords } from '@/features/quest/level-words';

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
 * organization's own count (Phase 40). Phase 78 (owner 2026-11-05): no " · includes unreviewed" -- checked
 * questions are served like any other.
 */
export function levelOptionDetail(level: CanvasAssessmentLevel, questions = 10): string {
  if (level.available === 0) return 'no approved questions yet';
  return `${Math.min(level.available, questions)} question${level.available === 1 ? '' : 's'}`;
}

/**
 * The start card's note under the pickers, with the organization's count (Phase 40). Phase 78: the same words
 * whether or not the space draws checked questions (the tutor's PDF still marks each one "not yet reviewed").
 */
export function startNote(questions = 10): string {
  return (
    `Up to ${questions} questions of the level, chosen at random. Multiple-choice questions are answered by ` +
    'choosing; the canvas is there for working. Work can be revisited and changed until it is submitted.'
  );
}

/** "Ines Ferreira", "Ines Ferreira or Rosa Delgado", "A, B or C": who adds children here. */
export function namesWithOr(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? '';
  return `${clean.slice(0, -1).join(', ')} or ${clean[clean.length - 1]}`;
}

/**
 * Why the start card's student picker is empty, and who fills it (UI audit JF1, J07 steps 26-28): an admin
 * adds a student from People; anyone else is told nobody is linked to them here yet and who adds children --
 * the space's admins by name when the session carries them (`admin_names`, R31), else in general.
 */
export function noStudentsLine({
  isAdmin,
  spaceName,
  adminNames,
}: {
  isAdmin: boolean;
  spaceName: string | null | undefined;
  adminNames?: readonly string[] | null;
}): string {
  if (isAdmin) return 'No students here yet. Add one from People, then start an assessment for them here.';
  const named = namesWithOr(adminNames ?? []);
  const who = named ? `${named} adds them: ask to link your child` : "The space's admins add them: ask one to link your child";
  return `No children are linked to you in ${spaceName || 'this space'} yet. ${who}, then start an assessment for them here.`;
}

/**
 * Phase 79 (M6, docs/members-plan.md; the web's assessments-page.tsx, working tree): a member -- in a shared space
 * with no role -- plays Quest; assessments there are for students (owner, 2026-11-06: no self-assessment in shared
 * spaces). Their menu leaves the page out, and a link to it says so in one line. In a personal space the maker is
 * its admin, so this never applies there.
 */
export function assessmentsForMember(
  user: { roles: readonly string[] } | null | undefined,
  organization: { personal?: boolean } | null | undefined,
): boolean {
  return Boolean(user && user.roles.length === 0 && !organization?.personal);
}

/** The one line a member reads there (the web's words). */
export { MEMBER_ASSESSMENTS_LINE } from '@tmi/shared';

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

// --- Families at home (Phase 77, JF20) --------------------------------------------------------

/** "Noor" from "Noor Haddad". */
export function firstName(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

/** "Grade 4", "Beast Academy 3": a level in words (one helper for Quest, quests and Assessments). */
export { levelWords };

/** The student's assessment already in progress (the newest), for Start's warning; null for none. */
export function inProgressFor(rows: readonly CanvasAssessment[], studentId: string): CanvasAssessment | null {
  let newest: CanvasAssessment | null = null;
  for (const row of rows) {
    if (row.student_user_id !== studentId || row.status !== 'in_progress') continue;
    if (!newest || row.started_at > newest.started_at) newest = row;
  }
  return newest;
}

/** The warning's title (the web's). */
export const IN_PROGRESS_TITLE = 'One is already in progress';

/**
 * "Noor already has a Grade 4 assessment in progress (started 8 minutes ago).", or "You already have …" for the
 * student's own -- the web's words.
 */
export function inProgressWarning(
  row: Pick<CanvasAssessment, 'student_name' | 'level_id' | 'started_at'>,
  own = false,
  now?: Date,
): string {
  const level = levelWords(row.level_id);
  const who = own ? 'You already have' : `${firstName(row.student_name)} already has`;
  return `${who} ${/^[aeiou]/i.test(level) ? 'an' : 'a'} ${level} assessment in progress (started ${formatRelativeTime(row.started_at, now)}).`;
}

/** Whether the questions wait for the hand-over: whoever opened it is not the student who answers. */
export function handsOver(assessment: Pick<CanvasAssessment, 'student_user_id'>, readerId: string | null | undefined): boolean {
  return Boolean(readerId) && assessment.student_user_id !== readerId;
}

/** The hand-over screen's words, for the student's first name (the web's). */
export function handOverWords(studentName: string): { title: string; body: string; ready: string } {
  const first = firstName(studentName);
  return {
    title: `Hand the device to ${first}`,
    body: `${first} answers on this device. Answers written on another device stay there.`,
    ready: `${first} is ready`,
  };
}

/**
 * What a submit says. The student's own: as before. Anyone else's (a guardian, or whoever started it for them): where
 * the PDF goes -- the student's tutor, or where there is no Tutoring the space's admins -- never a link to it (R17).
 */
export function submittedMessage({
  own,
  studentName,
  tutoring,
}: {
  own: boolean;
  studentName: string;
  tutoring: boolean;
}): string {
  if (own) return 'Submitted. The tutor gets a PDF of your answers.';
  const first = firstName(studentName);
  return tutoring
    ? `Submitted. ${first}'s tutor gets a PDF of the answers.`
    : `Submitted. The space's admins get a PDF of ${first}'s answers.`;
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

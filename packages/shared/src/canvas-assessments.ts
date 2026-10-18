import { z } from 'zod';
import { QUESTION_BANK_LEVEL_IDS, type QuestionKind } from './questions.js';

// ---------------------------------------------------------------------------
// The Assessment menu, in beta (Phase 38, docs/canvas-assessment-plan.md)
// ---------------------------------------------------------------------------
// A student answers approved bank questions by hand, one question per page,
// with no feedback while they work; on submitting, the Worker writes a PDF of
// the questions and the handwriting for the tutor. Named `canvas_assessments`
// to keep it apart from the progress assessments (`assessments`).

export const CANVAS_ASSESSMENT_STATUSES = ['in_progress', 'submitted', 'discarded'] as const;
export type CanvasAssessmentStatus = (typeof CANVAS_ASSESSMENT_STATUSES)[number];

export const CANVAS_ASSESSMENT_STATUS_LABELS: Record<CanvasAssessmentStatus, string> = {
  in_progress: 'In progress',
  submitted: 'Submitted',
  discarded: 'Discarded',
};

export type QuestionBankLevelId = (typeof QUESTION_BANK_LEVEL_IDS)[number];

/** What people read for a bank level: "Grade 5", "Math 1". */
export const QUESTION_BANK_LEVEL_LABELS: Record<QuestionBankLevelId, string> = {
  'NC26.3': 'Grade 3',
  'NC26.4': 'Grade 4',
  'NC26.5': 'Grade 5',
  'NC26.6': 'Grade 6',
  'NC26.7': 'Grade 7',
  'NC26.8': 'Grade 8',
  'NC26.M1': 'Math 1',
};

export function levelLabel(levelId: string): string {
  return QUESTION_BANK_LEVEL_LABELS[levelId as QuestionBankLevelId] ?? levelId;
}

/**
 * The canvas, and what one submission may carry. Coordinates are on a fixed
 * 1000 x 800 page whatever the screen, so the PDF never depends on the device.
 * Handwriting travels as strings ("w x y x y ...") rather than arrays: Zod
 * checks a string's length cheaply, where validating 20,000 points as arrays
 * would cost the Worker more CPU than the free plan allows.
 */
export const CANVAS_LIMITS = {
  width: 1000,
  height: 800,
  /** Questions drawn for one assessment, unless the organization sets its own (Phase 40). */
  questions: 10,
  /** The most an organization may set (Phase 40): 25 pages stays well under D1's 2 MB a value. */
  maxQuestions: 25,
  strokesPerPage: 600,
  numbersPerPage: 20_000,
  /** Characters in one stroke's string. */
  strokeChars: 60_000,
  /** The whole request body, checked before it is parsed. */
  bodyBytes: 1_000_000,
  /** Pen widths, in canvas units. */
  minWidth: 1,
  maxWidth: 40,
} as const;

/** A stroke as drawn: its width, then x,y pairs. */
export interface CanvasStroke {
  width: number;
  points: number[];
}

/**
 * Reads one stroke string, or null when it is not one: integers only, a width
 * in range, at least one point, every point on the page. Hand-written rather
 * than a regex over the whole string, so it stays linear on 60,000 characters.
 */
export function parseStroke(
  text: string,
  bounds: { width: number; height: number } = CANVAS_LIMITS,
): CanvasStroke | null {
  const numbers: number[] = [];
  let current = 0;
  let digits = 0;
  let negative = false;
  for (let i = 0; i <= text.length; i += 1) {
    const code = i < text.length ? text.charCodeAt(i) : 32;
    if (code >= 48 && code <= 57) {
      current = current * 10 + (code - 48);
      digits += 1;
      if (digits > 6) return null;
    } else if (code === 32) {
      if (digits > 0) {
        numbers.push(negative ? -current : current);
        current = 0;
        digits = 0;
        negative = false;
      } else if (negative) {
        return null;
      }
    } else if (code === 45 && digits === 0 && !negative) {
      negative = true;
    } else {
      return null;
    }
  }
  if (numbers.length < 3 || numbers.length % 2 === 0) return null;
  const [width, ...points] = numbers;
  if (width === undefined || width < CANVAS_LIMITS.minWidth || width > CANVAS_LIMITS.maxWidth) return null;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    if (x < 0 || x > bounds.width || y < 0 || y > bounds.height) return null;
  }
  return { width, points };
}

/** Writes a stroke in the wire format, rounding to whole canvas units. */
export function formatStroke(stroke: CanvasStroke): string {
  return [stroke.width, ...stroke.points].map((n) => Math.round(n)).join(' ');
}

export const startCanvasAssessmentSchema = z.object({
  student_user_id: z.string().uuid('Choose a student.'),
  level_id: z.enum(QUESTION_BANK_LEVEL_IDS, { message: 'Choose a grade.' }),
});
export type StartCanvasAssessmentInput = z.infer<typeof startCanvasAssessmentSchema>;

export const canvasPageSchema = z.object({
  question_id: z.string().uuid(),
  /** A multiple-choice question's selected choice, by its position (0 = A); null when none. */
  choice: z.number().int().min(0).max(5).nullable().default(null),
  strokes: z.array(z.string().min(1).max(CANVAS_LIMITS.strokeChars)).max(CANVAS_LIMITS.strokesPerPage),
});
export type CanvasPage = z.infer<typeof canvasPageSchema>;

export const submitCanvasAssessmentSchema = z.object({
  pages: z.array(canvasPageSchema).max(CANVAS_LIMITS.maxQuestions),
});
export type SubmitCanvasAssessmentInput = z.infer<typeof submitCanvasAssessmentSchema>;

/** A question as the person taking the assessment sees it: never its answer or solution. */
export interface CanvasAssessmentQuestion {
  id: string;
  kind: QuestionKind;
  skill: string | null;
  stem: string;
  choices: string[];
}

export interface CanvasAssessment {
  id: string;
  student_user_id: string;
  student_name: string;
  /** Named only to the student's tutors, the admins and the person themselves (R17). */
  started_by_name: string | null;
  level_id: string;
  status: CanvasAssessmentStatus;
  question_count: number;
  questions_written: number;
  /**
   * Multiple-choice questions, how many were answered and how many correctly
   * (marked by code, `checkAnswer`). Reviewers only -- null for anyone else (R17).
   */
  choice_questions: number | null;
  choices_answered: number | null;
  choices_correct: number | null;
  /** Questions drawn while still unreviewed in the bank (the organization's trial flag). Reviewers only. */
  unreviewed_questions: number | null;
  started_at: string;
  submitted_at: string | null;
  /** The viewer may open the PDF: the student's current tutor, or an admin. */
  can_review: boolean;
  /** The viewer started it and it is still in progress. */
  can_continue: boolean;
  /**
   * Phase 40: when a tutor saved it as reviewed, and who. The reviewed PDF is
   * then readable by the student's whole audience (R17).
   */
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  /** Reviewers only: a review is in progress (a draft), not yet saved as reviewed. */
  review_draft: boolean | null;
}

export interface CanvasAssessmentDetail extends CanvasAssessment {
  /** Only for the person who started it, while it is in progress. */
  questions: CanvasAssessmentQuestion[] | null;
}

export interface CanvasAssessmentLevel {
  level_id: QuestionBankLevelId;
  label: string;
  /**
   * Questions it can draw on (standards needing a figure left out): the
   * approved ones, plus the checked-but-unreviewed ones while the organization
   * has `canvas_assessments_unreviewed` on.
   */
  available: number;
  /** How many of `available` are not yet reviewed. */
  unreviewed: number;
}

// ---------------------------------------------------------------------------
// Reviewing online (Phase 40)
// ---------------------------------------------------------------------------
// A tutor marks a submitted assessment up over its PDF's pages: red ink, a note
// per question, an overall comment. No scoring yet (owner, 2026-10-18). The
// review is kept as data and the reviewed PDF rebuilt from it, so the submitted
// PDF is never changed. Ink is in the PDF page's own points, from its top-left
// corner, so a mark lands where it was drawn on the rendered page.

export const REVIEW_PAGE = { width: 612, height: 792 } as const;

export const REVIEW_LIMITS = {
  noteChars: 1000,
  commentChars: 2000,
  strokesPerPage: 400,
  numbersPerPage: 20_000,
} as const;

export const reviewInkPageSchema = z.object({
  question_id: z.string().uuid(),
  strokes: z.array(z.string().min(1).max(CANVAS_LIMITS.strokeChars)).max(REVIEW_LIMITS.strokesPerPage),
});

export const saveCanvasReviewSchema = z.object({
  /** A note per question, by its id. */
  notes: z.record(z.string().uuid(), z.string().max(REVIEW_LIMITS.noteChars)).default({}),
  comment: z.string().max(REVIEW_LIMITS.commentChars).default(''),
  ink: z.array(reviewInkPageSchema).max(CANVAS_LIMITS.maxQuestions).default([]),
});
export type SaveCanvasReviewInput = z.input<typeof saveCanvasReviewSchema>;

/** A page of the review: the question as the student saw it, and what the tutor has added. */
export interface CanvasReviewQuestion {
  id: string;
  kind: QuestionKind;
  skill: string | null;
  stem: string;
  /** Its page in the submitted PDF (1 is the cover, so the first question is 2). */
  pdf_page: number;
}

export interface CanvasReview {
  status: 'none' | 'draft' | 'final';
  notes: Record<string, string>;
  comment: string;
  ink: { question_id: string; strokes: string[] }[];
  reviewer_name: string | null;
  updated_at: string | null;
  finished_at: string | null;
  questions: CanvasReviewQuestion[];
}

/** The bank statuses an assessment may draw on: approved, and -- on the organization's trial flag -- checked. */
export function drawableStatuses(includeUnreviewed: boolean): ('approved' | 'checked')[] {
  return includeUnreviewed ? ['approved', 'checked'] : ['approved'];
}

// ---------------------------------------------------------------------------
// Maths as plain text, for the PDF
// ---------------------------------------------------------------------------
// The PDF is set in Helvetica, one of the standard fonts, so nothing is
// embedded; the bank's LaTeX is rewritten as the plain text a person would
// type. Covers every command the bank uses (2026-10-18). The typeset version
// stays on screen.

const LATEX_SYMBOLS: Record<string, string> = {
  times: '×',
  div: '÷',
  cdot: '·',
  pm: '±',
  le: '<=',
  leq: '<=',
  ge: '>=',
  geq: '>=',
  ne: '!=',
  neq: '!=',
  approx: '~',
  pi: 'pi',
  circ: '°',
  angle: 'angle ',
  triangle: 'triangle ',
  square: '[ ]',
  cong: ' congruent to ',
  parallel: ' || ',
  to: ' -> ',
  ell: 'l',
  ldots: '...',
  dots: '...',
  cdots: '...',
  Delta: 'Delta ',
  infty: 'infinity',
  degree: '°',
  ',': ' ',
  ';': ' ',
  '!': '',
  ' ': ' ',
  '%': '%',
  $: '$',
  '{': '{',
  '}': '}',
  '#': '#',
  '&': '&',
  _: '_',
};

/** The text of a `{...}` group starting at `at` (which is '{'), and where it ends. */
function readGroup(text: string, at: number): { inner: string; end: number } {
  if (text[at] !== '{') {
    // A bare argument is one character (\frac12) or one command.
    if (text[at] === '\\') {
      const match = /^\\[a-zA-Z]+/.exec(text.slice(at));
      const length = match ? match[0].length : 2;
      return { inner: text.slice(at, at + length), end: at + length };
    }
    return { inner: text[at] ?? '', end: at + 1 };
  }
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(at + 1, i), end: i + 1 };
    }
  }
  return { inner: text.slice(at + 1), end: text.length };
}

function wrapIfLong(text: string): string {
  return /^[\w.]+$/.test(text) ? text : `(${text})`;
}

/** One maths span's LaTeX as plain text. */
export function latexToPlain(latex: string): string {
  let out = '';
  let i = 0;
  while (i < latex.length) {
    const ch = latex[i]!;
    if (ch === '\\') {
      const match = /^\\([a-zA-Z]+|.)/.exec(latex.slice(i));
      const name = match?.[1] ?? '';
      i += 1 + name.length;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const top = readGroup(latex, i);
        const bottom = readGroup(latex, top.end);
        // A mixed number, 1\frac{1}{4}: "1 1/4", never "11/4".
        if (/\d$/.test(out)) out += ' ';
        out += `${wrapIfLong(latexToPlain(top.inner))}/${wrapIfLong(latexToPlain(bottom.inner))}`;
        i = bottom.end;
      } else if (name === 'sqrt') {
        const arg = readGroup(latex, i);
        out += `sqrt(${latexToPlain(arg.inner)})`;
        i = arg.end;
      } else if (name === 'text' || name === 'mathrm' || name === 'textbf' || name === 'mathbf' || name === 'operatorname') {
        const arg = readGroup(latex, i);
        out += arg.inner;
        i = arg.end;
      } else if (name === 'overline' || name === 'overrightarrow' || name === 'overleftrightarrow' || name === 'hat') {
        const arg = readGroup(latex, i);
        out += latexToPlain(arg.inner);
        i = arg.end;
      } else if (name === 'left' || name === 'right') {
        // The delimiter that follows is kept as it is.
      } else {
        out += LATEX_SYMBOLS[name] ?? name;
      }
    } else if (ch === '^' || ch === '_') {
      const arg = readGroup(latex, i + 1);
      const inner = latexToPlain(arg.inner);
      if (ch === '^' && inner === '2') out += '²';
      else if (ch === '^' && inner === '3') out += '³';
      else if (ch === '^' && (inner === '\\circ' || inner === '°')) out += '°';
      else out += `${ch}${wrapIfLong(inner)}`;
      i = arg.end;
    } else if (ch === '{' || ch === '}') {
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out.replace(/ {2,}/g, ' ');
}

/** Text with maths in `$...$` (the bank's format) as plain text. */
export function mathTextToPlain(text: string): string {
  const pieces = text.split('$');
  // An odd number of `$` leaves the last piece unclosed: keep the text as written.
  if (pieces.length % 2 === 0) return text;
  return pieces.map((piece, index) => (index % 2 === 1 ? latexToPlain(piece) : piece)).join('');
}

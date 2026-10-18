// Phase 38: the PDF a tutor reviews -- a cover, then one page per question
// with the question, the student's handwriting and, at the foot, the answer
// and worked solution (docs/canvas-assessment-plan.md, "The PDF").
import {
  CANVAS_LIMITS,
  formatMinutesOfDay,
  levelLabel,
  mathTextToPlain,
  zonedClockParts,
  type CanvasStroke,
  type Question,
} from '@tmi/shared';

import { PAGE_HEIGHT, PAGE_WIDTH, PdfDocument, textWidth, wrapText, type PdfPage, type Rgb } from './pdf.js';

const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK: Rgb = [0.09, 0.16, 0.42];
const MUTED: Rgb = [0.42, 0.42, 0.47];
const RULE: Rgb = [0.82, 0.82, 0.86];
const TUTOR_FILL: Rgb = [0.955, 0.955, 0.97];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

export interface AssessmentPdfInput {
  organizationName: string;
  timeZone: string;
  studentName: string;
  startedByName: string;
  levelId: string;
  startedAt: string;
  submittedAt: string;
  pages: {
    question: Question;
    strokes: CanvasStroke[];
    /** The selected choice's position, for a multiple-choice question; null when none. */
    choice: number | null;
    /** Whether that choice is the key (by code); null when nothing was selected. */
    correct: boolean | null;
  }[];
}

/** "October 18, 2026 at 4:05 PM", on the organization's clock. */
function when(iso: string, timeZone: string): string {
  const { day, minutesOfDay } = zonedClockParts(iso, timeZone);
  const [year, month, date] = day.split('-').map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${date}, ${year} at ${formatMinutesOfDay(minutesOfDay)}`;
}

/** Writes lines down the page from `y` (a baseline), returning the next free baseline. */
function writeLines(
  page: PdfPage,
  lines: readonly string[],
  x: number,
  y: number,
  size: number,
  leading: number,
  font: 'regular' | 'bold' | 'italic' = 'regular',
  color: Rgb = [0, 0, 0],
): number {
  let at = y;
  for (const line of lines) {
    page.text(x, at, line, size, font, color);
    at -= leading;
  }
  return at;
}

function questionHeader(page: PdfPage, input: AssessmentPdfInput, index: number): void {
  const top = PAGE_HEIGHT - MARGIN;
  page.text(MARGIN, top, `${input.studentName} · ${levelLabel(input.levelId)}`, 9, 'bold', MUTED);
  const right = `Question ${index + 1} of ${input.pages.length}`;
  page.text(PAGE_WIDTH - MARGIN - textWidth(right, 9), top, right, 9, 'regular', MUTED);
  page.line(MARGIN, top - 8, PAGE_WIDTH - MARGIN, top - 8, RULE);
}

function cover(doc: PdfDocument, input: AssessmentPdfInput): void {
  const page = doc.addPage();
  let y = PAGE_HEIGHT - MARGIN - 10;
  page.text(MARGIN, y, input.organizationName, 10, 'regular', MUTED);
  y -= 30;
  page.text(MARGIN, y, 'Assessment (beta)', 22, 'bold');
  y -= 18;
  page.text(MARGIN, y, 'Answers written by hand, for the tutor to review.', 11, 'regular', MUTED);
  y -= 34;

  const written = input.pages.filter((p) => p.strokes.length > 0).length;
  const facts: [string, string][] = [
    ['Student', input.studentName],
    ['Grade', levelLabel(input.levelId)],
    ['Started by', input.startedByName],
    ['Started', when(input.startedAt, input.timeZone)],
    ['Submitted', when(input.submittedAt, input.timeZone)],
    ['Written on', `${written} of ${input.pages.length} questions`],
  ];
  const choicePages = input.pages.filter((p) => p.question.kind === 'choice');
  if (choicePages.length > 0) {
    const answered = choicePages.filter((p) => p.choice !== null).length;
    const correct = choicePages.filter((p) => p.correct === true).length;
    facts.push([
      'Multiple choice',
      `${correct} of ${choicePages.length} correct` + (answered < choicePages.length ? ` (${choicePages.length - answered} not answered)` : ''),
    ]);
  }
  const unreviewed = input.pages.filter((p) => p.question.status !== 'approved').length;
  if (unreviewed > 0) facts.push(['Not yet reviewed', `${unreviewed} question${unreviewed === 1 ? '' : 's'} from the bank`]);
  for (const [label, value] of facts) {
    page.text(MARGIN, y, label, 10, 'regular', MUTED);
    page.text(MARGIN + 90, y, value, 11, 'bold');
    y -= 18;
  }

  y -= 16;
  page.text(MARGIN, y, 'Questions', 12, 'bold');
  y -= 6;
  page.line(MARGIN, y, PAGE_WIDTH - MARGIN, y, RULE);
  y -= 16;
  for (const [index, { question, strokes, choice, correct }] of input.pages.entries()) {
    if (y < MARGIN + 60) break;
    const status =
      question.kind === 'choice'
        ? choice === null
          ? strokes.length > 0 ? 'written, no choice' : 'blank'
          : `${LETTERS[choice]} · ${correct ? 'correct' : 'incorrect'}`
        : strokes.length > 0 ? 'written' : 'blank';
    const label = question.skill ?? mathTextToPlain(question.stem);
    const lines = wrapText(`${index + 1}. ${label}`, 10, CONTENT_WIDTH - 120);
    page.text(PAGE_WIDTH - MARGIN - 105, y, status, 10, status === 'blank' ? 'italic' : 'regular',
      status === 'blank' ? MUTED : [0, 0, 0]);
    y = writeLines(page, lines.slice(0, 2), MARGIN, y, 10, 13) - 4;
  }

  writeLines(
    page,
    wrapText(
      'Each page shows the question, the student\'s handwriting as it was written, and at its foot the ' +
        'answer and the worked solution, for the tutor. Nothing was checked or marked while the student ' +
        'worked. Keep this document within the student\'s tutors and the office: it carries the answers.',
      9,
      CONTENT_WIDTH,
    ),
    MARGIN,
    MARGIN + 30,
    9,
    12,
    'regular',
    MUTED,
  );
}

function questionPage(doc: PdfDocument, input: AssessmentPdfInput, index: number): void {
  const { question, strokes, choice, correct } = input.pages[index]!;
  const page = doc.addPage();
  questionHeader(page, input, index);

  // The question.
  let y = PAGE_HEIGHT - MARGIN - 32;
  page.text(MARGIN, y, `Question ${index + 1}`, 13, 'bold');
  page.text(MARGIN + 80, y, question.topic_code, 9, 'regular', MUTED);
  if (question.status !== 'approved') {
    // The organization's trial: a question the bank checked but no person has approved yet.
    const tag = 'NOT YET REVIEWED';
    page.text(PAGE_WIDTH - MARGIN - textWidth(tag, 8, 'bold'), y, tag, 8, 'bold', [0.62, 0.36, 0.05]);
  }
  y -= 20;
  y = writeLines(page, wrapText(mathTextToPlain(question.stem), 12, CONTENT_WIDTH), MARGIN, y, 12, 16);
  if (question.kind === 'choice') {
    y -= 4;
    for (const [i, text] of question.choices.entries()) {
      const lines = wrapText(mathTextToPlain(text), 11, CONTENT_WIDTH - 40);
      if (i === choice) {
        // The student's choice, ringed as they would have ringed it on paper.
        page.rect(MARGIN, y - 4, CONTENT_WIDTH, 15 * lines.length + 1, { stroke: INK, lineWidth: 1 });
      }
      page.text(MARGIN + 4, y, `${LETTERS[i] ?? '?'}.`, 11, 'bold', i === choice ? INK : [0, 0, 0]);
      y = writeLines(page, lines, MARGIN + 22, y, 11, 15, i === choice ? 'bold' : 'regular', i === choice ? INK : [0, 0, 0]);
    }
    y -= 2;
    page.text(
      MARGIN,
      y,
      choice === null ? 'No choice selected.' : `Selected: ${LETTERS[choice]}`,
      10,
      choice === null ? 'italic' : 'bold',
      choice === null ? MUTED : INK,
    );
    y -= 14;
  }

  // For the tutor, at the foot: the answer and the worked solution.
  const letter = question.kind === 'choice' ? question.choices.indexOf(question.answer) : -1;
  const verdict = correct === null ? '' : correct ? '   (the selection is correct)' : '   (the selection is incorrect)';
  const answerLine = `Answer: ${letter >= 0 ? `${LETTERS[letter]}. ` : ''}${mathTextToPlain(question.answer)}${verdict}`;
  const solution = wrapText(`Worked solution: ${mathTextToPlain(question.solution)}`, 9, CONTENT_WIDTH - 20);
  const shown = solution.length > 7 ? [...solution.slice(0, 6), `${solution[6]}…`] : solution;
  const tutorHeight = 22 + 12 + shown.length * 11.5 + 8;
  page.rect(MARGIN, MARGIN, CONTENT_WIDTH, tutorHeight, { fill: TUTOR_FILL, stroke: RULE });
  let ty = MARGIN + tutorHeight - 15;
  page.text(MARGIN + 10, ty, 'FOR THE TUTOR', 8, 'bold', MUTED);
  ty -= 13;
  page.text(MARGIN + 10, ty, answerLine, 10, 'bold');
  ty -= 13;
  writeLines(page, shown, MARGIN + 10, ty, 9, 11.5, 'regular', [0.2, 0.2, 0.25]);

  // The working, between the question and the tutor's box, at the canvas's own shape.
  const boxTop = y - 8;
  const boxBottom = MARGIN + tutorHeight + 14;
  const boxHeight = boxTop - boxBottom;
  page.text(MARGIN, boxTop + 2, 'WORKING', 8, 'bold', MUTED);
  const innerTop = boxTop - 6;
  const innerHeight = boxHeight - 6;
  const scale = Math.min(CONTENT_WIDTH / CANVAS_LIMITS.width, innerHeight / CANVAS_LIMITS.height);
  const drawnWidth = CANVAS_LIMITS.width * scale;
  const drawnHeight = CANVAS_LIMITS.height * scale;
  const left = MARGIN + (CONTENT_WIDTH - drawnWidth) / 2;
  page.rect(left, innerTop - drawnHeight, drawnWidth, drawnHeight, { stroke: RULE });
  if (strokes.length === 0) {
    const note = 'Nothing written on this page.';
    page.text(left + (drawnWidth - textWidth(note, 11)) / 2, innerTop - drawnHeight / 2, note, 11, 'italic', MUTED);
  } else {
    page.strokes(strokes, left, innerTop, scale, INK);
  }
}

/** The whole document, as bytes. */
export async function buildAssessmentPdf(input: AssessmentPdfInput): Promise<Uint8Array> {
  const doc = new PdfDocument(`Assessment: ${input.studentName}, ${levelLabel(input.levelId)}`);
  cover(doc, input);
  for (let index = 0; index < input.pages.length; index += 1) questionPage(doc, input, index);
  return doc.save();
}

// Ported from apps/web/src/features/handwriting-lab/{handwriting-lab-page,reading-panel,samples-card}.tsx
// @ 4b16671 (working tree: Phase 54): the lab's rules and words, pulled out so Jest covers them (design
// #64). The ruled page and its first free line, the page's edits with undo, a line saved as a sample,
// what each line of "What I read" says, and the samples' summary. Pure: no React.
import {
  CANVAS_LIMITS,
  HANDWRITING_SAMPLE_CATEGORY_LABELS,
  SYNTHETIC_LINES,
  formatRelativeTime,
  formatStroke,
  writeLine,
  type CanvasStroke,
  type HandwritingReading,
  type HandwritingSample,
  type HandwritingSampleCategory,
  type HandwritingSampleSummary,
  type InkLine,
  type SaveHandwritingSampleInput,
} from '@tmi/shared';

import { pageSize } from '@/features/canvas-assessments/drawing-model';
import { mathSpeech } from './math-line-model';

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/** The page's faint rules: one step a line, eight lines (every 100 units of the 800-unit page). */
export const RULE_SPACING = 100;
export const RULES = CANVAS_LIMITS.height / RULE_SPACING;

/** The first ruled line with no ink on it, as a baseline to write on, or null when the page is full. */
export function freeBaseline(strokes: readonly CanvasStroke[]): number | null {
  for (let rule = 1; rule <= RULES; rule += 1) {
    const top = (rule - 1) * RULE_SPACING;
    const bottom = rule * RULE_SPACING;
    const used = strokes.some((stroke) => {
      for (let i = 1; i < stroke.points.length; i += 2) {
        if (stroke.points[i]! > top && stroke.points[i]! < bottom) return true;
      }
      return false;
    });
    if (!used) return bottom - 24;
  }
  return null;
}

/**
 * "Write a sample line": the next of the synthetic lines, in the synthetic hand, on the first free
 * ruled line -- or null when every line has writing. `seed` varies the hand (the web's Date.now()).
 */
export function syntheticLine(strokes: readonly CanvasStroke[], count: number, seed: number): CanvasStroke[] | null {
  const baseline = freeBaseline(strokes);
  if (baseline === null) return null;
  const line = SYNTHETIC_LINES[count % SYNTHETIC_LINES.length]!;
  return writeLine(line.truth, { x: 40, baseline, size: 44, seed: seed % 100_000, mess: 0.4 });
}

/** Whether the page still holds these strokes as well (the web's "The page is full" check). */
export function pageFits(strokes: readonly CanvasStroke[], added: readonly CanvasStroke[]): boolean {
  const next = [...strokes, ...added];
  return next.length <= CANVAS_LIMITS.strokesPerPage && pageSize(next) <= CANVAS_LIMITS.numbersPerPage;
}

/** The page and the pages before each change, for Undo. */
export interface LabPage {
  strokes: CanvasStroke[];
  history: CanvasStroke[][];
}

export const EMPTY_PAGE: LabPage = { strokes: [], history: [] };

/** Undo reaches back this many changes, as on the web. */
export const UNDO_STEPS = 50;

export type LabAction =
  | { type: 'add'; strokes: CanvasStroke[] }
  /** The strokes the eraser touched, as the objects themselves (the canvas never passes indexes). */
  | { type: 'erase'; hit: CanvasStroke[] }
  | { type: 'undo' }
  | { type: 'clear' };

function change(state: LabPage, strokes: CanvasStroke[]): LabPage {
  return { strokes, history: [...state.history, state.strokes].slice(-UNDO_STEPS) };
}

export function labReducer(state: LabPage, action: LabAction): LabPage {
  switch (action.type) {
    case 'add':
      return action.strokes.length === 0 ? state : change(state, [...state.strokes, ...action.strokes]);
    case 'erase': {
      const next = state.strokes.filter((stroke) => !action.hit.includes(stroke));
      return next.length === state.strokes.length ? state : change(state, next);
    }
    case 'clear':
      return state.strokes.length === 0 ? state : change(state, []);
    case 'undo': {
      const previous = state.history.at(-1);
      return previous ? { strokes: previous, history: state.history.slice(0, -1) } : state;
    }
  }
}

// ---------------------------------------------------------------------------
// What I read
// ---------------------------------------------------------------------------

/** What a line of the panel shows: the reading (or, while it is re-read, the last one in its place). */
export type ReadingView =
  | { kind: 'math'; latex: string }
  | { kind: 'raw'; latex: string }
  | { kind: 'not-math' }
  | { kind: 'unreadable' }
  | { kind: 'failed'; message: string }
  | { kind: 'waiting' };

/**
 * A reading that is not plain maths is shown only where `showNonMath` is set (the lab), as typed --
 * never to a student: no sentence a model wrote reaches a child that way (AI-13's third rule).
 */
export function readingView(shown: HandwritingReading | null, showNonMath: boolean): ReadingView {
  if (shown?.status === 'read' && shown.latex !== null) {
    if (shown.is_math) return { kind: 'math', latex: shown.latex };
    return showNonMath ? { kind: 'raw', latex: shown.latex } : { kind: 'not-math' };
  }
  if (shown?.status === 'unreadable') return { kind: 'unreadable' };
  if (shown?.status === 'failed') return { kind: 'failed', message: shown.error?.message ?? 'The line could not be read.' };
  return { kind: 'waiting' };
}

/** The line's words as the screen shows them, the maths said aloud. */
export function readingWords(view: ReadingView): string {
  switch (view.kind) {
    case 'math':
      return `I read: ${mathSpeech(view.latex)}`;
    case 'raw':
      return `I read: ${view.latex}`;
    case 'not-math':
      return 'Read, but not as maths.';
    case 'unreadable':
      return 'I could not read this line.';
    case 'failed':
      return view.message;
    case 'waiting':
      return 'Waiting for the pen to rest…';
  }
}

/** The reader's own confidence, once this ink is read: "87%". */
export function confidenceText(reading: HandwritingReading | null, pending: boolean): string | null {
  if (pending || reading?.status !== 'read' || reading.confidence === null) return null;
  return `${Math.round(reading.confidence * 100)}%`;
}

/** A line's label for a screen reader: its number, what was read, the confidence, and "reading". */
export function lineLabel(number: number, view: ReadingView, confidence: string | null, pending: boolean): string {
  const parts = [`Line ${number}`, readingWords(view)];
  if (confidence) parts.push(`The reader's own confidence: ${confidence}`);
  if (pending) parts.push('Reading');
  return parts.map((part) => part.replace(/[.…]$/, '')).join('. ') + '.';
}

/** Which model a sample says read it: `fake` locally, else the model; null before any reply. */
export function readingModel(source: { provider: string; model: string } | null): string | null {
  return source ? (source.provider === 'fake' ? 'fake' : source.model) : null;
}

/** The reading's badge: the fake reader says so. */
export function sourceLabel(source: { provider: string; model: string }): string {
  return source.provider === 'fake' ? 'Fake reader' : source.model;
}

/** The body that keeps a line as a sample: its strokes, what it says, and what the reader made of it. */
export function sampleInput(
  line: InkLine,
  page: readonly CanvasStroke[],
  reading: HandwritingReading,
  truth: string,
  category: HandwritingSampleCategory,
  model: string | null,
): SaveHandwritingSampleInput {
  return {
    strokes: line.strokes.map((index) => formatStroke(page[index]!)),
    truth,
    category,
    reading: reading.status === 'read' ? reading.latex : null,
    reading_status: reading.status === 'failed' ? null : reading.status,
    reading_model: reading.status === 'failed' ? null : model,
  };
}

export function savedToast(number: number, matched: boolean): string {
  return matched ? `Line ${number} saved: read right.` : `Line ${number} saved: misread.`;
}

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

export const percent = (part: number, whole: number) => (whole === 0 ? '–' : `${Math.round((part / whole) * 100)}%`);

/** "12 samples · read right 75%". */
export function summaryLabel(summary: HandwritingSampleSummary): string {
  return `${summary.total} ${summary.total === 1 ? 'sample' : 'samples'} · read right ${percent(summary.matched, summary.total)}`;
}

/** "A stacked fraction: 3/4". */
export function categoryCount(entry: HandwritingSampleSummary['by_category'][number]): string {
  return `${HANDWRITING_SAMPLE_CATEGORY_LABELS[entry.category]}: ${entry.matched}/${entry.total}`;
}

/** Its kind, the model that read it, who wrote it and when. */
export function sampleMeta(sample: HandwritingSample, now: Date = new Date()): string {
  return [
    HANDWRITING_SAMPLE_CATEGORY_LABELS[sample.category],
    sample.reading_model ?? 'not read',
    sample.written_by_name ?? 'someone',
    formatRelativeTime(sample.created_at, now),
  ].join(' · ');
}

// ---------------------------------------------------------------------------
// The picture the reader saw
// ---------------------------------------------------------------------------

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** The first bytes of base64 text (whole groups of four characters only). */
function decodeHead(text: string, bytes: number): number[] | null {
  const out: number[] = [];
  for (let i = 0; out.length < bytes; i += 4) {
    const group = text.slice(i, i + 4);
    if (group.length < 4) return null;
    const values = [...group].map((char) => BASE64.indexOf(char));
    if (values.some((v) => v < 0)) return null;
    const n = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    out.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  return out.slice(0, bytes);
}

/** A PNG data URL's width and height, from its header (the picture is sized by its own shape). */
export function pngSize(dataUrl: string): { width: number; height: number } | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+)/.exec(dataUrl);
  if (!match) return null;
  const head = decodeHead(match[1]!, 24);
  if (!head || PNG_SIGNATURE.some((byte, i) => head[i] !== byte)) return null;
  if (String.fromCharCode(...head.slice(12, 16)) !== 'IHDR') return null;
  const word = (at: number) => ((head[at]! << 24) | (head[at + 1]! << 16) | (head[at + 2]! << 8) | head[at + 3]!) >>> 0;
  const width = word(16);
  const height = word(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

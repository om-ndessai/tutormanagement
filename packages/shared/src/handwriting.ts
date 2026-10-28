import { z } from 'zod';
import { CANVAS_LIMITS, formatStroke, type CanvasStroke } from './canvas-assessments.js';
import { refuseSsn } from './tax.js';

// ---------------------------------------------------------------------------
// Reading handwriting, one line at a time (Phase 54: AI-13 stage 0)
// ---------------------------------------------------------------------------
// The first step of the think-aloud canvas (docs/think-aloud-plan.md): the canvas
// finds each line of ink from the gaps between them, the Worker draws that line
// as a small picture, and a model transcribes it BLIND -- it never sees the
// question, the answer or the other lines, so it has nothing to "correct" a
// slip towards. Code, not the model, decides later whether a line is right.
//
// Stage 0 reads ADULTS' handwriting only: the reader is in the platform
// console's Handwriting lab, where platform admins write. A child's work is a
// `child_input` task, refused until parental consent for AI processing exists
// (AG1, roadmap F7).

export const HANDWRITING_LIMITS = {
  /**
   * Lines one request may ask to be read: each is its own model call, and its own picture drawn
   * in the Worker (about a millisecond of CPU each, against the free plan's 10).
   */
  linesPerRequest: 4,
  strokesPerLine: 200,
  /** Numbers across one line's strokes (each stroke is its width plus its points). */
  numbersPerLine: 8_000,
  /** The whole request body, checked before it is parsed. */
  bodyBytes: 400_000,
  /** Characters in a reading, and in what the writer says they wrote. */
  latexChars: 300,
  /** A line key: the hash `lineKey` writes, or anything a client uses to match replies. */
  keyChars: 40,
  /** How long the pen must rest before the changed lines are read, in milliseconds. */
  pauseMs: 800,
} as const;

// ---------------------------------------------------------------------------
// Finding the lines
// ---------------------------------------------------------------------------

/** One line of ink on a page, found from the gaps between lines. */
export interface InkLine {
  /** Its place on the page, top first, from 0. */
  index: number;
  /** Its ink's extent, in the page's own units (a stroke's half-width included). */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** The strokes it holds, as indexes into the page's list, in the order they were written. */
  strokes: number[];
  /** Changes whenever any of its strokes do, so an unchanged line is never read twice. */
  key: string;
}

interface Extent {
  index: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function extentOf(stroke: CanvasStroke, index: number): Extent {
  const half = stroke.width / 2;
  let top = Infinity;
  let bottom = -Infinity;
  let left = Infinity;
  let right = -Infinity;
  for (let i = 0; i + 1 < stroke.points.length; i += 2) {
    const x = stroke.points[i]!;
    const y = stroke.points[i + 1]!;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return { index, top: top - half, bottom: bottom + half, left: left - half, right: right + half };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * The vertical gap, in page units, that separates two lines. Proportional to
 * the writing's size, so large and small hands both split where people leave
 * space -- and a stacked fraction (numerator, bar, denominator: small gaps)
 * stays one line. Flat strokes (a fraction bar, a minus, an equals sign) say
 * nothing about the hand's size, so only the taller ones are measured.
 */
export function lineGap(strokes: readonly CanvasStroke[]): number {
  const heights = strokes.map((stroke, i) => extentOf(stroke, i)).map((e) => e.bottom - e.top);
  const tall = heights.filter((h) => h >= 12);
  const typical = median(tall.length > 0 ? tall : heights);
  return Math.min(30, Math.max(8, typical * 0.4));
}

/** FNV-1a over the line's strokes as they travel: a short, stable key for "this exact ink". */
export function lineKey(strokes: readonly CanvasStroke[]): string {
  let hash = 0x811c9dc5;
  const text = strokes.map(formatStroke).join('|');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${strokes.length.toString(36)}-${hash.toString(36)}`;
}

/**
 * Groups a page's strokes into lines, top to bottom. A stroke joins the line
 * above it when its top is within `lineGap` of that line's lowest ink;
 * otherwise it starts a new line. Pure and cheap: run it on every stroke.
 */
export function segmentLines(strokes: readonly CanvasStroke[], gap = lineGap(strokes)): InkLine[] {
  const extents = strokes
    .map((stroke, i) => extentOf(stroke, i))
    .filter((e) => Number.isFinite(e.top))
    .sort((a, b) => a.top - b.top || a.index - b.index);
  const bands: Extent[][] = [];
  let bottom = -Infinity;
  for (const extent of extents) {
    const current = bands.at(-1);
    if (current && extent.top <= bottom + gap) {
      current.push(extent);
      bottom = Math.max(bottom, extent.bottom);
    } else {
      bands.push([extent]);
      bottom = extent.bottom;
    }
  }
  return bands.map((band, index) => {
    const ordered = [...band].sort((a, b) => a.index - b.index);
    const members = ordered.map((e) => strokes[e.index]!);
    return {
      index,
      top: Math.min(...band.map((e) => e.top)),
      bottom: Math.max(...band.map((e) => e.bottom)),
      left: Math.min(...band.map((e) => e.left)),
      right: Math.max(...band.map((e) => e.right)),
      strokes: ordered.map((e) => e.index),
      key: lineKey(members),
    };
  });
}

/** The numbers a line's strokes take on the wire, against HANDWRITING_LIMITS.numbersPerLine. */
export function lineSize(strokes: readonly CanvasStroke[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.points.length + 1, 0);
}

// ---------------------------------------------------------------------------
// What a reading may say
// ---------------------------------------------------------------------------

/**
 * LaTeX commands a reading may use. Anything else -- \text above all -- means
 * the reading is not plain maths, and a student is never shown it: no sentence
 * a model wrote reaches a child that way (think-aloud-canvas.md, "Readings shown
 * only as maths"). The lab shows every reading, and says which ones a student
 * would not see.
 */
export const MATH_READING_COMMANDS = new Set([
  'frac', 'dfrac', 'tfrac', 'times', 'div', 'cdot', 'pm', 'mp',
  'le', 'leq', 'ge', 'geq', 'ne', 'neq', 'approx', 'sim', 'equiv',
  'lt', 'gt', 'sqrt', 'left', 'right', 'pi', 'circ', 'degree', '%',
  'cdots', 'ldots', 'dots', 'overline', 'underline', 'quad', ',', ';', '!',
  'sin', 'cos', 'tan', 'log', 'ln', 'infty', 'angle', 'triangle', 'perp',
  'parallel', 'theta', 'alpha', 'beta', 'Delta', 'mid', '{', '}',
]);

const READING_CHARS = /^[0-9A-Za-z\s+\-=<>()[\]{}.,/^_|!%':×÷−·]$/;

/**
 * Whether a reading is maths and nothing else: digits, single letters (or
 * short runs, like 2ab), operators, brackets and the commands above. A run of
 * four or more letters outside a command is a word, and fails.
 */
export function isMathReading(latex: string): boolean {
  const text = latex.trim();
  if (text.length === 0 || text.length > HANDWRITING_LIMITS.latexChars) return false;
  let letters = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '\\') {
      const match = /^\\([A-Za-z]+|[^A-Za-z])/.exec(text.slice(i));
      if (!match || !MATH_READING_COMMANDS.has(match[1]!)) return false;
      i += match[0].length - 1;
      letters = 0;
      continue;
    }
    if (!READING_CHARS.test(char)) return false;
    letters = /[A-Za-z]/.test(char) ? letters + 1 : 0;
    if (letters >= 4) return false;
  }
  return true;
}

/**
 * A reading in one spelling, for deciding whether two say the same: spacing,
 * \left and \right, \dfrac, the long and short names of a relation, Unicode
 * operators and braces around a single character all fall away. What stays
 * distinct is what a reader could genuinely get wrong: \times against \cdot, a
 * slash against a stacked fraction, every digit and sign.
 */
export function normalizeReading(latex: string): string {
  let out = latex
    .replace(/\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[,;!]|\\quad/g, '')
    .replace(/\\[dt]frac/g, '\\frac')
    .replace(/\\leq?(?![A-Za-z])/g, '\\le')
    .replace(/\\geq?(?![A-Za-z])/g, '\\ge')
    .replace(/\\neq?(?![A-Za-z])/g, '\\ne')
    .replace(/\\lt(?![A-Za-z])/g, '<')
    .replace(/\\gt(?![A-Za-z])/g, '>')
    .replace(/×/g, '\\times')
    .replace(/÷/g, '\\div')
    .replace(/·/g, '\\cdot')
    .replace(/[−–]/g, '-')
    .replace(/≤/g, '\\le')
    .replace(/≥/g, '\\ge')
    .replace(/≠/g, '\\ne')
    .replace(/\s+/g, '');
  // {7} is 7, wherever it stands: \frac{1}{2} and \frac12 read the same, as do x^{2} and x^2.
  for (let before = ''; before !== out; ) {
    before = out;
    out = out.replace(/\{([^{}\\])\}/g, '$1');
  }
  return out;
}

/** Whether a reading says what was written. */
export function readingMatches(reading: string | null, truth: string): boolean {
  return reading !== null && normalizeReading(reading) === normalizeReading(truth);
}

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

const strokeText = z.string().min(1).max(CANVAS_LIMITS.strokeChars);
const latexText = (label: string) =>
  refuseSsn(z.string().trim().max(HANDWRITING_LIMITS.latexChars, `${label} must be ${HANDWRITING_LIMITS.latexChars} characters or fewer.`));

export const handwritingLineSchema = z.object({
  /** The client's key for the line (`lineKey`), echoed on its reading. */
  key: z.string().min(1).max(HANDWRITING_LIMITS.keyChars),
  /** The line's strokes, in the canvas's wire format ("w x y x y ..."), on the 1000 x 800 page. */
  strokes: z.array(strokeText).min(1).max(HANDWRITING_LIMITS.strokesPerLine),
  /**
   * What the line says, when the caller knows (the evaluation, a saved sample):
   * the reply then says whether the reading matched. Never sent to the reader.
   */
  truth: latexText('What was written').min(1).optional(),
});
export type HandwritingLine = z.infer<typeof handwritingLineSchema>;

export const readHandwritingSchema = z.object({
  lines: z.array(handwritingLineSchema).min(1).max(HANDWRITING_LIMITS.linesPerRequest),
  /** Send back the picture the reader was given, as a PNG data URL (the lab's "What the reader saw"). */
  include_image: z.boolean().optional(),
});
export type ReadHandwritingInput = z.infer<typeof readHandwritingSchema>;

export const HANDWRITING_READING_STATUSES = ['read', 'unreadable', 'failed'] as const;
export type HandwritingReadingStatus = (typeof HANDWRITING_READING_STATUSES)[number];

/** What the reader made of one line. */
export interface HandwritingReading {
  key: string;
  /** `failed`: the call did not complete (switched off, over budget, the provider): see `error`. */
  status: HandwritingReadingStatus;
  /** The line as written, in LaTeX; null unless read. */
  latex: string | null;
  /** Whether `latex` is maths and nothing else: only such a reading would ever reach a student. */
  is_math: boolean;
  /** The reader's own confidence, 0-1; null unless read. */
  confidence: number | null;
  /** When `truth` was sent: whether the reading says the same (`readingMatches`). */
  matched: boolean | null;
  /** Milliseconds this line took, picture and model together. */
  ms: number;
  /** The picture the reader was given, when asked for (`include_image`). */
  image: string | null;
  error: { code: string; message: string } | null;
}

export interface HandwritingReadResult {
  readings: HandwritingReading[];
  /** `fake` anywhere but production, unless the Worker is told otherwise (AI_PROVIDER). */
  provider: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Samples: the spike's corpus
// ---------------------------------------------------------------------------

/** The kinds of line the spike asks for (think-aloud-canvas.md, "The spike"). */
export const HANDWRITING_SAMPLE_CATEGORIES = [
  'clear',
  'slip',
  'messy',
  'fraction',
  'unfinished',
  'column',
  'other',
] as const;
export type HandwritingSampleCategory = (typeof HANDWRITING_SAMPLE_CATEGORIES)[number];

export const HANDWRITING_SAMPLE_CATEGORY_LABELS: Record<HandwritingSampleCategory, string> = {
  clear: 'A clear step',
  slip: 'A step with a slip',
  messy: 'Messy writing',
  fraction: 'A stacked fraction',
  unfinished: 'Half-finished',
  column: 'Column arithmetic',
  other: 'Something else',
};

export const saveHandwritingSampleSchema = z.object({
  strokes: z.array(strokeText).min(1).max(HANDWRITING_LIMITS.strokesPerLine),
  /** What the writer says the line says, in LaTeX. */
  truth: latexText('What was written').min(1, 'Say what the line says.'),
  category: z.enum(HANDWRITING_SAMPLE_CATEGORIES),
  /** The reading when the sample was saved, if there was one, and which model gave it. */
  reading: latexText('The reading').nullable(),
  reading_status: z.enum(['read', 'unreadable']).nullable(),
  reading_model: z.string().max(40).nullable(),
});
export type SaveHandwritingSampleInput = z.infer<typeof saveHandwritingSampleSchema>;

export interface HandwritingSample {
  id: string;
  stroke_count: number;
  truth: string;
  category: HandwritingSampleCategory;
  reading: string | null;
  reading_status: 'read' | 'unreadable' | null;
  reading_model: string | null;
  /** Whether the reading at the time said what was written. */
  matched: boolean;
  written_by_name: string | null;
  created_at: string;
}

export interface HandwritingSampleSummary {
  total: number;
  matched: number;
  by_category: { category: HandwritingSampleCategory; total: number; matched: number }[];
}

/** `GET /api/platform/handwriting/samples`: the newest samples, and the counts over all of them. */
export interface HandwritingSampleList {
  samples: HandwritingSample[];
  summary: HandwritingSampleSummary;
}

export const HANDWRITING_CORPUS_SOURCES = ['samples', 'synthetic'] as const;
export type HandwritingCorpusSource = (typeof HANDWRITING_CORPUS_SOURCES)[number];

/**
 * A corpus, as the lab exports it and the evaluation reads it
 * (`npm run handwriting:eval`). `source` says whose handwriting it is:
 * `samples` (adults, in the lab) or `synthetic` (`writeLine`, no hand at all).
 */
export interface HandwritingCorpus {
  version: 1;
  source: HandwritingCorpusSource;
  exported_at: string;
  samples: {
    id: string;
    category: HandwritingSampleCategory;
    truth: string;
    strokes: string[];
    reading?: string | null;
    reading_model?: string | null;
  }[];
}

import { z } from 'zod';
import { HANDWRITING_LIMITS, isMathReading, type CanvasStroke } from '@tmi/shared';

import type { Env } from '../../types.js';
import { encodePng, rasterizeLine, toBase64 } from '../raster.js';
import { runAi } from './run.js';

// ---------------------------------------------------------------------------
// The handwriting reader (Phase 54: AI-13 stage 0)
// ---------------------------------------------------------------------------
// One line's picture in, the line as written out, as LaTeX. The reader is
// BLIND: it is given no question, no answer and no other line, so it has
// nothing to "correct" a slip towards (a 2026 study of grading handwritten
// maths found models inventing content resembling the reference solution).
// Code decides later whether a line is right; the reader only reads.
//
// The instructions, the picture (lib/raster.ts) and how lines are found
// (segmentLines, shared) are what `npm run handwriting:eval` measures: change
// one, run the evaluation, and record the result (docs/think-aloud/reader-log.md).

export const READ_TOOL = {
  name: 'record_reading',
  description: 'Records what one handwritten line of maths says, exactly as written.',
  schema: z.object({
    status: z.enum(['read', 'unreadable']),
    /** The line in LaTeX; empty when unreadable. */
    latex: z.string().max(HANDWRITING_LIMITS.latexChars),
    /** How sure the reader is that every symbol is right, 0-1. */
    confidence: z.number().min(0).max(1),
  }),
};

export const READ_SYSTEM = `You transcribe handwriting. Each image shows ONE line of mathematical working, written by hand with a pen or a finger on a tablet.

Transcribe exactly what is written, symbol by symbol, as LaTeX.
- Write down what is there even when it is wrong, unfinished or makes no sense. Never correct, complete, simplify or evaluate it: "7 × 8 = 54" stays 7\\times8=54, and "9 - 4 =" stays 9-4=.
- A fraction written stacked (one number above a bar, one below) is \\frac{top}{bottom}. A slash written on the line is /.
- × is \\times, ÷ is \\div, a raised dot is \\cdot, ≤ is \\le, ≥ is \\ge, ≠ is \\ne.
- A raised small number is a power: x^{2}. A mixed number is 2\\frac{1}{2}.
- Letters are variables, written as they are (x, y, n). Digits, decimal points and minus signs exactly as written.
- Leave out anything crossed out.
- No $ signs, no \\text, no words, no spaces needed.

If you cannot read the line with reasonable confidence, or it is not mathematics, set status to "unreadable" and latex to "".
Confidence is how sure you are that every symbol is right, from 0 to 1.

Answer only by calling the record_reading tool, once.`;

export const READ_PROMPT = 'Transcribe this line exactly as it is written.';

export interface LineReading {
  status: 'read' | 'unreadable';
  latex: string | null;
  is_math: boolean;
  confidence: number;
  /** The picture the reader was given, as a data URL. */
  image: string;
}

/** A model's LaTeX, without the wrappers it sometimes adds anyway. */
export function cleanLatex(latex: string): string {
  return latex
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();
}

/**
 * Reads one line: draws its picture, sends it through runAi (switches, caps,
 * the run log), and returns what was read. Throws runAi's ApiError when the
 * call is refused or fails.
 */
export async function readLine(
  env: Env,
  options: { strokes: readonly CanvasStroke[]; actor: { id: string; full_name: string } },
): Promise<LineReading> {
  const png = await encodePng(rasterizeLine(options.strokes));
  const data = toBase64(png);
  const { output } = await runAi(env, {
    task: 'handwriting.read_line',
    system: READ_SYSTEM,
    prompt: READ_PROMPT,
    tool: READ_TOOL,
    actor: options.actor,
    organizationId: null,
    images: [{ media_type: 'image/png', data }],
    // The fake cannot see: it reads every line as its number of strokes, which is enough to show
    // the pipeline working (a line re-read only when it changes) and costs nothing.
    fake: () => ({ status: 'read', latex: String(options.strokes.length), confidence: 1 }),
    fakeTokens: { input: 600, output: 60 },
  });
  const latex = output.status === 'read' ? cleanLatex(output.latex) : '';
  const read = output.status === 'read' && latex.length > 0;
  return {
    status: read ? 'read' : 'unreadable',
    latex: read ? latex : null,
    is_math: read && isMathReading(latex),
    confidence: read ? output.confidence : 0,
    image: `data:image/png;base64,${data}`,
  };
}

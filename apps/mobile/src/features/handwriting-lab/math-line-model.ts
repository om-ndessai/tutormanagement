// A reading (LaTeX without `$`) as native runs, for the Handwriting lab (design #64). The web typesets
// each reading with KaTeX; the app's lab can hold a reading per ruled line and 50 samples, too many for
// one web view each (the bank's `MathBody`). So a top-level `\frac` is stacked -- numerator, bar,
// denominator, nested ones too -- and everything else is the bank's display text (`latexToText`: ×, ÷,
// ·, superscripts, √, ≤). That keeps apart what the reader can get wrong and the lab exists to catch: a
// slash against a stacked fraction (both read "3/4" as plain text), × against ·. Pure: no React.
import { latexToText } from '@/features/question-bank/math-text';

export type MathRun =
  | { kind: 'text'; text: string }
  | { kind: 'frac'; top: MathRun[]; bottom: MathRun[] };

const FRAC = /^\\[dt]?frac(?![A-Za-z])/;

/** One argument of `\frac` from `at`: a `{group}`, a `\command`, or one character. Null when none is left. */
function argumentAt(src: string, at: number): { value: string; end: number } | null {
  let i = at;
  while (src[i] === ' ') i += 1;
  if (i >= src.length) return null;
  if (src[i] === '{') {
    let depth = 0;
    for (let j = i; j < src.length; j += 1) {
      if (src[j] === '\\') {
        j += 1;
        continue;
      }
      if (src[j] === '{') depth += 1;
      if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) return { value: src.slice(i + 1, j), end: j + 1 };
      }
    }
    return null; // unclosed: the caller keeps the text as written
  }
  if (src[i] === '\\') {
    const name = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
    if (!name) return null;
    return { value: name[0], end: i + name[0].length };
  }
  if (src[i] === '}') return null;
  return { value: src[i]!, end: i + 1 };
}

function pushText(runs: MathRun[], latex: string) {
  const text = latexToText(latex, 'display');
  if (text !== '') runs.push({ kind: 'text', text });
}

/** The reading as text and stacked fractions, in order. */
export function mathRuns(latex: string): MathRun[] {
  const runs: MathRun[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < latex.length) {
    const char = latex[i]!;
    if (char === '\\') {
      if (depth === 0 && FRAC.test(latex.slice(i))) {
        const name = FRAC.exec(latex.slice(i))![0];
        const top = argumentAt(latex, i + name.length);
        const bottom = top ? argumentAt(latex, top.end) : null;
        if (top && bottom) {
          pushText(runs, latex.slice(start, i));
          runs.push({ kind: 'frac', top: mathRuns(top.value), bottom: mathRuns(bottom.value) });
          i = bottom.end;
          start = i;
          continue;
        }
      }
      i += 2; // a command's backslash and its first character (an escaped brace among them)
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth = Math.max(0, depth - 1);
    i += 1;
  }
  pushText(runs, latex.slice(start));
  return runs;
}

/** The reading in words, for a screen reader (`\frac{3}{4}` is "3 over 4"). */
export function mathSpeech(latex: string): string {
  return latexToText(latex, 'speech');
}

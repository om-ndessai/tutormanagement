// Ported from apps/web/src/features/question-bank/math-text.tsx @ b0d216e (the split on `$`).
// Mobile: the drawing is KaTeX in the card's web view (question-html.ts); this file adds the two
// plain forms the native parts need -- `display` for a line of native text (the blind solve's
// answer, the solver's working, the fallback when the web view cannot draw) and `speech` for the
// body's accessibility label, which the web view itself never gives (it is hidden from assistive
// tech). Pure: no React, no KaTeX.

export interface MathPart {
  math: boolean;
  value: string;
}

/**
 * Text with maths in `$...$`, the question bank's format: plain text and maths spans, in order.
 * An odd number of `$` leaves the last piece unclosed, so the text is kept as typed -- exactly as
 * the web's MathText does.
 */
export function splitMath(text: string): MathPart[] {
  const pieces = text.split('$');
  if (pieces.length % 2 === 0) return [{ math: false, value: text }];
  return pieces.map((value, index) => ({ math: index % 2 === 1, value }));
}

export type MathTextMode = 'display' | 'speech';

/** The text with each maths span in plain words or symbols; the text around it as written. */
export function mathToText(text: string, mode: MathTextMode): string {
  return splitMath(text)
    .map((part) => (part.math ? latexToText(part.value, mode) : part.value))
    .join('');
}

// --- One maths span -----------------------------------------------------------------------------

/**
 * A command with a fixed meaning: [display, speech]. Speech words are padded by the caller. The
 * display form of an operator (OPERATORS) is padded as KaTeX spaces it; a letter-like symbol
 * (TIGHT) takes the space after it, as LaTeX does after a control word: `2\pi r` is 2πr.
 */
const SYMBOLS: Record<string, [string, string]> = {
  times: ['×', 'times'],
  div: ['÷', 'divided by'],
  cdot: ['·', 'times'],
  pm: ['±', 'plus or minus'],
  le: ['≤', 'is less than or equal to'],
  leq: ['≤', 'is less than or equal to'],
  ge: ['≥', 'is greater than or equal to'],
  geq: ['≥', 'is greater than or equal to'],
  ne: ['≠', 'is not equal to'],
  neq: ['≠', 'is not equal to'],
  lt: ['<', 'is less than'],
  gt: ['>', 'is greater than'],
  approx: ['≈', 'is approximately'],
  to: ['→', 'to'],
  rightarrow: ['→', 'to'],
  pi: ['π', 'pi'],
  theta: ['θ', 'theta'],
  infty: ['∞', 'infinity'],
  angle: ['∠', 'angle'],
  circ: ['°', 'degrees'],
  degree: ['°', 'degrees'],
  square: ['□', 'blank'],
  ldots: ['…', 'and so on'],
  cdots: ['⋯', 'and so on'],
  dots: ['…', 'and so on'],
  perp: ['⊥', 'is perpendicular to'],
  parallel: ['∥', 'is parallel to'],
  triangle: ['△', 'triangle'],
  cong: ['≅', 'is congruent to'],
  sim: ['∼', 'is similar to'],
};

const OPERATORS = new Set([
  'times',
  'div',
  'cdot',
  'pm',
  'le',
  'leq',
  'ge',
  'geq',
  'ne',
  'neq',
  'lt',
  'gt',
  'approx',
  'to',
  'rightarrow',
  'perp',
  'parallel',
  'cong',
  'sim',
]);
const TIGHT = new Set(['pi', 'theta', 'infty', 'angle', 'triangle']);

/** Escaped characters and spacing: [display, speech]. */
const ESCAPES: Record<string, [string, string]> = {
  '%': ['%', 'percent'],
  $: ['$', 'dollars'],
  '&': ['&', 'and'],
  '#': ['#', 'number'],
  _: ['_', 'underscore'],
  '{': ['{', ''],
  '}': ['}', ''],
  ',': [' ', ''],
  ';': [' ', ''],
  ':': [' ', ''],
  '!': ['', ''],
  ' ': [' ', ''],
  '\\': [' ', ''],
};

/** Commands that only change spacing or style: their argument (if any) stands for itself. */
const SPACING = new Set(['quad', 'qquad', 'displaystyle', 'textstyle', 'limits', 'nolimits']);
const STYLE_WITH_ARG = new Set([
  'text',
  'textrm',
  'textbf',
  'textit',
  'mathrm',
  'mathbf',
  'mathit',
  'operatorname',
  'boldsymbol',
  'mbox',
]);

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ',
  x: 'ˣ',
  y: 'ʸ',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  o: 'ₒ',
  x: 'ₓ',
  n: 'ₙ',
  i: 'ᵢ',
};

function mapAll(text: string, table: Record<string, string>): string | null {
  let out = '';
  for (const char of text) {
    const mapped = table[char];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

/** A display operand with more than one term goes in brackets: (x + 1)/2, not x + 1/2. */
function grouped(text: string): string {
  const trimmed = text.trim();
  return /[\s+\-−×÷·=<>]/.test(trimmed) ? `(${trimmed})` : trimmed;
}

/**
 * A small reader for the LaTeX the bank uses (see apps/api/db/questions/*.json): commands, their
 * `{…}` arguments, `^` and `_`, and `\left` / `\right`. Anything else is kept as written; an
 * unknown command is read by its name, never dropped, so nothing silently disappears.
 */
class Reader {
  private at = 0;
  constructor(
    private readonly src: string,
    private readonly mode: MathTextMode,
  ) {}

  /** Everything up to the end, or up to the `}` closing the group we are in. */
  sequence(inGroup = false): string {
    let out = '';
    while (this.at < this.src.length) {
      const char = this.src[this.at]!;
      if (char === '}') {
        if (inGroup) {
          this.at += 1;
          return out;
        }
        this.at += 1; // a stray `}`: dropped, as KaTeX would refuse it
        continue;
      }
      out += this.item();
    }
    return out;
  }

  /** One argument: a `{group}`, a command, or a single character. */
  argument(): string {
    this.skipSpaces();
    if (this.at >= this.src.length) return '';
    const char = this.src[this.at]!;
    if (char === '{') {
      this.at += 1;
      return this.sequence(true);
    }
    if (char === '\\') return this.item();
    this.at += 1;
    return char;
  }

  private skipSpaces() {
    while (this.src[this.at] === ' ') this.at += 1;
  }

  private word(text: string): string {
    return this.mode === 'speech' ? ` ${text} ` : text;
  }

  private item(): string {
    const char = this.src[this.at]!;
    if (char === '{') {
      this.at += 1;
      return this.sequence(true);
    }
    if (char === '^') {
      this.at += 1;
      return this.power(this.argument());
    }
    if (char === '_') {
      this.at += 1;
      return this.subscript(this.argument());
    }
    if (char === '~') {
      this.at += 1;
      return ' ';
    }
    if (char !== '\\') {
      this.at += 1;
      return char;
    }
    // A command: `\name` or `\` + one character.
    const name = /^\\([a-zA-Z]+)/.exec(this.src.slice(this.at));
    if (!name) {
      const escaped = this.src[this.at + 1] ?? '';
      this.at += 2;
      const known = ESCAPES[escaped];
      if (known) return this.mode === 'display' ? known[0] : known[1] ? ` ${known[1]} ` : ' ';
      return escaped;
    }
    this.at += name[0].length;
    return this.command(name[1]!);
  }

  private command(name: string): string {
    const speech = this.mode === 'speech';
    const symbol = SYMBOLS[name];
    if (symbol) {
      if (TIGHT.has(name)) this.skipSpaces();
      if (speech) return ` ${symbol[1]} `;
      return OPERATORS.has(name) ? ` ${symbol[0]} ` : symbol[0];
    }
    if (SPACING.has(name)) return ' ';
    if (STYLE_WITH_ARG.has(name)) return this.argument();
    switch (name) {
      case 'frac':
      case 'dfrac':
      case 'tfrac': {
        const top = this.argument().trim();
        const bottom = this.argument().trim();
        return speech ? ` ${top} over ${bottom} ` : `${grouped(top)}/${grouped(bottom)}`;
      }
      case 'sqrt': {
        this.skipSpaces();
        let index = '';
        if (this.src[this.at] === '[') {
          const close = this.src.indexOf(']', this.at);
          index = this.src.slice(this.at + 1, close < 0 ? undefined : close).trim();
          this.at = close < 0 ? this.src.length : close + 1;
        }
        const body = this.argument().trim();
        if (speech) {
          const root = !index ? 'square root' : index === '3' ? 'cube root' : `root ${index}`;
          return ` ${root} of ${body} `;
        }
        return `${index ? (mapAll(index, SUPERSCRIPT) ?? index) : ''}√${grouped(body)}`;
      }
      case 'overrightarrow':
        return this.word(`ray ${this.argument().trim()}`);
      case 'overleftrightarrow':
        return this.word(`line ${this.argument().trim()}`);
      case 'overline': {
        const body = this.argument().trim();
        return speech ? ` segment ${body} ` : [...body].map((c) => `${c}̅`).join('');
      }
      case 'hat': {
        const body = this.argument().trim();
        return speech ? ` ${body} hat ` : `${body}̂`;
      }
      case 'left':
      case 'right':
      case 'big':
      case 'Big':
      case 'bigl':
      case 'bigr': {
        // The delimiter that follows: `(`, `)`, `[`, `]`, `|`, `.` (none) or `\{` / `\}`.
        this.skipSpaces();
        const next = this.src[this.at];
        if (next === '\\') {
          const escaped = this.src[this.at + 1] ?? '';
          this.at += 2;
          return speech ? ' ' : escaped;
        }
        this.at += 1;
        if (next === '.' || next === undefined) return '';
        return speech && (next === '(' || next === ')') ? ` ${next} ` : next;
      }
      default:
        // Unknown: read by its name, never dropped.
        return speech ? ` ${name} ` : name;
    }
  }

  private power(exponent: string): string {
    const raw = exponent.trim();
    if (this.mode === 'speech') {
      if (raw === 'degrees') return ' degrees ';
      if (raw === '2') return ' squared ';
      if (raw === '3') return ' cubed ';
      return ` to the power of ${raw} `;
    }
    if (raw === '°') return '°';
    return mapAll(raw, SUPERSCRIPT) ?? `^(${raw})`;
  }

  private subscript(index: string): string {
    const raw = index.trim();
    if (this.mode === 'speech') return ` sub ${raw} `;
    return mapAll(raw, SUBSCRIPT) ?? `_(${raw})`;
  }
}

/** One maths span (without its `$`), as display text or as words. */
export function latexToText(src: string, mode: MathTextMode): string {
  const text = new Reader(src, mode).sequence();
  return text
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:?!])/g, '$1')
    .trim();
}

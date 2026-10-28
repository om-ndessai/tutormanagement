import { CANVAS_LIMITS, type CanvasStroke } from './canvas-assessments.js';
import type { HandwritingSampleCategory } from './handwriting.js';

// ---------------------------------------------------------------------------
// Synthetic handwriting (Phase 54)
// ---------------------------------------------------------------------------
// A small single-stroke "hand" that writes a line of maths as strokes, the way a
// pen would. It is not anybody's handwriting, and reading it says little about
// reading a child's: it exists so the pipeline (finding lines, drawing the
// picture, the reader's wiring, the evaluation) can be tested and demonstrated
// with no pen, no person and no consent question. Deterministic for a seed.

type Polyline = number[];

interface Glyph {
  /** Advance width, in ems (an em is a digit's height). */
  w: number;
  /** Strokes in ems: x right, y down, 0 at the top of a digit and 1 on the baseline. */
  strokes: Polyline[];
}

/** Points on an ellipse, angles in degrees (0 = right, 90 = down, as the page's y runs). */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps = 14): Polyline {
  const out: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    out.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  }
  return out;
}

const dot = (x: number, y: number): Polyline => [x, y, x + 0.01, y + 0.01];

const GLYPHS: Record<string, Glyph> = {
  '0': { w: 0.62, strokes: [arc(0.3, 0.5, 0.26, 0.48, 270, 630, 24)] },
  '1': { w: 0.42, strokes: [[0.08, 0.2, 0.24, 0.02, 0.24, 1]] },
  '2': { w: 0.62, strokes: [[...arc(0.29, 0.28, 0.25, 0.26, 200, 380), 0.04, 1, 0.58, 1]] },
  '3': { w: 0.6, strokes: [[...arc(0.27, 0.25, 0.22, 0.24, 210, 450), ...arc(0.27, 0.74, 0.26, 0.25, 270, 515)]] },
  '4': { w: 0.62, strokes: [[0.42, 0.02, 0.03, 0.68, 0.58, 0.68], [0.45, 0.32, 0.45, 1]] },
  '5': { w: 0.6, strokes: [[0.52, 0.02, 0.12, 0.02, 0.07, 0.44, ...arc(0.28, 0.68, 0.25, 0.3, 225, 500)]] },
  '6': { w: 0.6, strokes: [[0.5, 0.02, 0.32, 0.1, 0.17, 0.26, 0.08, 0.45, 0.05, 0.68, ...arc(0.3, 0.72, 0.25, 0.27, 180, 540, 20)]] },
  '7': { w: 0.6, strokes: [[0.04, 0.02, 0.58, 0.02, 0.22, 1]] },
  '8': { w: 0.62, strokes: [arc(0.3, 0.25, 0.2, 0.23, 90, 450, 18), arc(0.3, 0.74, 0.26, 0.26, 270, 630, 20)] },
  '9': { w: 0.6, strokes: [[...arc(0.29, 0.3, 0.24, 0.28, 0, -360, 20), 0.53, 0.62, 0.42, 1]] },
  '+': { w: 0.62, strokes: [[0.08, 0.52, 0.54, 0.52], [0.31, 0.3, 0.31, 0.74]] },
  '-': { w: 0.56, strokes: [[0.08, 0.53, 0.48, 0.53]] },
  '=': { w: 0.6, strokes: [[0.07, 0.41, 0.52, 0.41], [0.07, 0.63, 0.52, 0.63]] },
  '\\times': { w: 0.58, strokes: [[0.1, 0.33, 0.47, 0.71], [0.47, 0.33, 0.1, 0.71]] },
  '\\div': { w: 0.6, strokes: [[0.07, 0.52, 0.52, 0.52], dot(0.29, 0.31), dot(0.29, 0.73)] },
  '(': { w: 0.38, strokes: [arc(0.4, 0.5, 0.3, 0.6, 235, 125, 12)] },
  ')': { w: 0.38, strokes: [arc(0.0, 0.5, 0.3, 0.6, -55, 55, 12)] },
  '.': { w: 0.24, strokes: [dot(0.1, 0.96)] },
  '/': { w: 0.46, strokes: [[0.42, 0.0, 0.05, 1]] },
  '<': { w: 0.56, strokes: [[0.48, 0.3, 0.08, 0.55, 0.48, 0.8]] },
  '>': { w: 0.56, strokes: [[0.08, 0.3, 0.48, 0.55, 0.08, 0.8]] },
  x: { w: 0.5, strokes: [[0.05, 0.46, 0.42, 1], [0.42, 0.46, 0.05, 1]] },
  y: { w: 0.5, strokes: [[0.05, 0.46, 0.25, 0.86], [0.44, 0.46, 0.12, 1.3]] },
  n: { w: 0.54, strokes: [[0.06, 0.46, 0.06, 1], [0.06, 0.64, 0.16, 0.5, 0.28, 0.46, 0.38, 0.5, 0.44, 0.64, 0.44, 1]] },
};

/** Binary operators and relations get a little air either side, as a hand leaves it. */
const SPACED = new Set(['+', '-', '=', '\\times', '\\div', '<', '>']);

type Node =
  | { kind: 'glyph'; name: string }
  | { kind: 'frac'; top: Node[]; bottom: Node[] }
  | { kind: 'sup'; body: Node[] };

/**
 * Reads the small part of LaTeX the hand can write: digits, x y n, + - = < > ( ) . /,
 * \times, \div, \frac{..}{..} and ^{..} (or ^2). Anything else throws.
 */
function parse(latex: string): Node[] {
  let i = 0;
  const group = (): Node[] => {
    if (latex[i] === '{') {
      i += 1;
      const nodes = sequence('}');
      i += 1;
      return nodes;
    }
    return [single()];
  };
  const single = (): Node => {
    const char = latex[i];
    if (char === '\\') {
      const match = /^\\[A-Za-z]+/.exec(latex.slice(i));
      if (!match) throw new Error(`Cannot write ${latex.slice(i)}`);
      i += match[0].length;
      if (match[0] === '\\frac') return { kind: 'frac', top: group(), bottom: group() };
      if (!GLYPHS[match[0]]) throw new Error(`Cannot write ${match[0]}`);
      return { kind: 'glyph', name: match[0] };
    }
    if (char === undefined || !GLYPHS[char]) throw new Error(`Cannot write ${char ?? 'the end'}`);
    i += 1;
    return { kind: 'glyph', name: char };
  };
  const sequence = (end?: string): Node[] => {
    const nodes: Node[] = [];
    while (i < latex.length && latex[i] !== end) {
      if (latex[i] === ' ') {
        i += 1;
        continue;
      }
      if (latex[i] === '^') {
        i += 1;
        nodes.push({ kind: 'sup', body: group() });
        continue;
      }
      nodes.push(single());
    }
    return nodes;
  };
  const nodes = sequence();
  if (i < latex.length) throw new Error(`Cannot write ${latex}`);
  return nodes;
}

/** A small, fast, seeded random source (mulberry32): the same seed writes the same line. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placed {
  /** Strokes in ems, relative to the line's start and its baseline (negative y is up). */
  strokes: Polyline[];
  width: number;
}

function layout(nodes: Node[], scale: number, rand: () => number, mess: number): Placed {
  const strokes: Polyline[] = [];
  let x = 0;
  for (const node of nodes) {
    if (node.kind === 'glyph') {
      const glyph = GLYPHS[node.name]!;
      const pad = SPACED.has(node.name) ? 0.14 * scale : 0;
      x += pad;
      // Each letter a little different: its size, its lean and where it sits.
      const size = scale * (1 + (rand() - 0.5) * 0.12 * (1 + mess));
      const lean = 0.12 + (rand() - 0.5) * 0.1 * (1 + mess);
      const lift = (rand() - 0.5) * 0.06 * scale * (1 + mess);
      for (const stroke of glyph.strokes) {
        const out: number[] = [];
        for (let p = 0; p + 1 < stroke.length; p += 2) {
          const gx = stroke[p]!;
          const gy = stroke[p + 1]!;
          const wobble = 0.025 * (1 + 2 * mess);
          const px = x + (gx + lean * (1 - gy)) * size + (rand() - 0.5) * wobble * size;
          const py = (gy - 1) * size + lift + (rand() - 0.5) * wobble * size;
          out.push(px, py);
        }
        strokes.push(out);
      }
      x += glyph.w * size + pad + 0.06 * scale;
    } else if (node.kind === 'sup') {
      const body = layout(node.body, scale * 0.6, rand, mess);
      for (const stroke of body.strokes) strokes.push(stroke.map((v, k) => (k % 2 === 0 ? v + x : v - 0.55 * scale)));
      x += body.width + 0.06 * scale;
    } else {
      const top = layout(node.top, scale * 0.8, rand, mess);
      const bottom = layout(node.bottom, scale * 0.8, rand, mess);
      const width = Math.max(top.width, bottom.width) + 0.2 * scale;
      const bar = -0.5 * scale;
      const place = (part: Placed, baseline: number) => {
        const shift = x + (width - part.width) / 2;
        for (const stroke of part.strokes) strokes.push(stroke.map((v, k) => (k % 2 === 0 ? v + shift : v + baseline)));
      };
      place(top, bar - 0.16 * scale);
      place(bottom, bar + 0.16 * scale + 0.8 * scale);
      strokes.push([x, bar + (rand() - 0.5) * 0.04 * scale, x + width, bar + (rand() - 0.5) * 0.04 * scale]);
      x += width + 0.1 * scale;
    }
  }
  return { strokes, width: x };
}

/** Straight runs filled in every few units, as a pen samples them. */
function densify(points: Polyline, step: number): Polyline {
  if (points.length <= 2) return points;
  const out = [points[0]!, points[1]!];
  for (let i = 2; i + 1 < points.length; i += 2) {
    const ax = points[i - 2]!;
    const ay = points[i - 1]!;
    const bx = points[i]!;
    const by = points[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k += 1) out.push(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
  }
  return out;
}

export interface WriteLineOptions {
  /** Where the line starts, and where its baseline runs, in page units. */
  x: number;
  baseline: number;
  /** A digit's height, in page units. 48 is a comfortable hand on the 1000 x 800 page. */
  size?: number;
  /** The same seed writes the same strokes. */
  seed?: number;
  /** 0 is a careful hand; 1 is a hurried one. */
  mess?: number;
  /** Pen width, in page units. */
  width?: number;
}

/**
 * Writes one line of maths as strokes on the page, in the canvas's own units
 * (`CANVAS_LIMITS`), or throws for something the hand cannot write. The
 * strokes are what a pen would have left: whole units, inside the page.
 */
export function writeLine(latex: string, options: WriteLineOptions): CanvasStroke[] {
  const rand = random(options.seed ?? 1);
  const size = options.size ?? 48;
  const placed = layout(parse(latex), 1, rand, options.mess ?? 0);
  const width = options.width ?? 4;
  return placed.strokes.map((stroke) => {
    const page = densify(
      stroke.map((v, k) => (k % 2 === 0 ? options.x + v * size : options.baseline + v * size)),
      4,
    );
    const points: number[] = [];
    for (let k = 0; k + 1 < page.length; k += 2) {
      const px = Math.min(CANVAS_LIMITS.width, Math.max(0, Math.round(page[k]!)));
      const py = Math.min(CANVAS_LIMITS.height, Math.max(0, Math.round(page[k + 1]!)));
      if (points.length >= 2 && points[points.length - 2] === px && points[points.length - 1] === py) continue;
      points.push(px, py);
    }
    return { width, points: points.length >= 2 ? points : [Math.round(options.x), Math.round(options.baseline)] };
  });
}

/** The lines the synthetic corpus is written from: what the spike asks for, as far as the hand can write it. */
export const SYNTHETIC_LINES: { truth: string; category: HandwritingSampleCategory }[] = [
  { truth: '12+7=19', category: 'clear' },
  { truth: '3x+5=20', category: 'clear' },
  { truth: '3x=15', category: 'clear' },
  { truth: 'x=5', category: 'clear' },
  { truth: '48\\div6=8', category: 'clear' },
  { truth: '0.5\\times4=2', category: 'clear' },
  { truth: '(8-3)\\times2=10', category: 'clear' },
  { truth: '5^{2}=25', category: 'clear' },
  { truth: 'y<12', category: 'clear' },
  { truth: '\\frac{3}{4}+\\frac{1}{4}=1', category: 'fraction' },
  { truth: '\\frac{2}{3}\\times6=4', category: 'fraction' },
  { truth: '\\frac{12}{16}=\\frac{3}{4}', category: 'fraction' },
  { truth: '7\\times8=54', category: 'slip' },
  { truth: '2(x+3)=2x+3', category: 'slip' },
  { truth: '\\frac{1}{2}+\\frac{1}{3}=\\frac{2}{5}', category: 'slip' },
  { truth: '-4+9=-5', category: 'slip' },
  { truth: '9-4=', category: 'unfinished' },
  { truth: '2x+', category: 'unfinished' },
  { truth: '36/9', category: 'other' },
  { truth: 'n>3', category: 'other' },
];

/** The synthetic corpus: every line written by two hands, the second hurried. */
export function syntheticSamples(): { id: string; category: HandwritingSampleCategory; truth: string; strokes: CanvasStroke[] }[] {
  return SYNTHETIC_LINES.flatMap((line, index) =>
    [0, 1].map((hand) => ({
      id: `synthetic-${index + 1}-${hand === 0 ? 'neat' : 'hurried'}`,
      category: hand === 1 && line.category === 'clear' ? ('messy' as const) : line.category,
      truth: line.truth,
      strokes: writeLine(line.truth, { x: 40, baseline: 120, size: hand === 0 ? 52 : 44, seed: 7919 * (index + 1) + hand, mess: hand }),
    })),
  );
}

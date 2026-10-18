// Ported from apps/web/src/features/canvas-assessments/drawing-canvas.tsx @ 37bdad1 and its Phase 40
// change (simplify, finishStroke, pageSize, distanceToStroke and the eraser's reach; the midpoint
// curve of drawStroke as an SVG path). A surface has units of its own: the student's 1000 x 800
// page, or a PDF page in points for the tutor's red ink. Mobile: pure, so Jest covers it;
// `strokePath` and `toCanvasUnits` are also worklets, because the stroke being written is drawn on
// the UI thread.
import { CANVAS_LIMITS, type CanvasStroke } from '@tmi/shared';

export type CanvasTool = 'pen' | 'eraser';

/** The pen's width, in canvas units: about 3 px on a laptop, 2 on a phone. */
export const PEN_WIDTH = 4;
/** How near the eraser must come to a stroke to take it away, in canvas units. */
export const ERASER_REACH = 14;

/** Ramer-Douglas-Peucker on x,y pairs: drops points a stroke does not need. */
export function simplify(points: number[], tolerance: number): number[] {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length / 2);
  keep[0] = 1;
  keep[keep.length - 1] = 1;
  const stack: [number, number][] = [[0, keep.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const ax = points[first * 2]!;
    const ay = points[first * 2 + 1]!;
    const bx = points[last * 2]!;
    const by = points[last * 2 + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstAt = -1;
    for (let i = first + 1; i < last; i += 1) {
      const px = points[i * 2]!;
      const py = points[i * 2 + 1]!;
      const distance = Math.abs(dy * px - dx * py + bx * ay - by * ax) / length;
      if (distance > worst) {
        worst = distance;
        worstAt = i;
      }
    }
    if (worst > tolerance && worstAt > 0) {
      keep[worstAt] = 1;
      stack.push([first, worstAt], [worstAt, last]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < keep.length; i += 1) if (keep[i]) out.push(points[i * 2]!, points[i * 2 + 1]!);
  return out;
}

/** A drawing surface's own units: the student's page, or (Phase 40) a PDF page in points. */
export interface CanvasSize {
  width: number;
  height: number;
}

/** What one page may hold: the student's page, or (Phase 40) the tutor's ink on one. */
export interface PageLimits {
  strokesPerPage: number;
  numbersPerPage: number;
}

/** The finished stroke as it is kept: whole units, inside the page, simplified. */
export function finishStroke(raw: number[], width = PEN_WIDTH, size: CanvasSize = CANVAS_LIMITS): CanvasStroke {
  const rounded: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const x = Math.min(size.width, Math.max(0, Math.round(raw[i]!)));
    const y = Math.min(size.height, Math.max(0, Math.round(raw[i + 1]!)));
    const last = rounded.length;
    if (last >= 2 && rounded[last - 2] === x && rounded[last - 1] === y) continue;
    rounded.push(x, y);
  }
  return { width, points: simplify(rounded, 0.8) };
}

/** The numbers a page's strokes take on the wire, against CANVAS_LIMITS.numbersPerPage. */
export function pageSize(strokes: readonly CanvasStroke[]): number {
  return strokes.reduce((sum, stroke) => sum + stroke.points.length + 1, 0);
}

/** Whether one more stroke still fits on the page (the web's "This page is full" check). */
export function strokeFits(
  strokes: readonly CanvasStroke[],
  stroke: CanvasStroke,
  limits: PageLimits = CANVAS_LIMITS,
): boolean {
  return (
    strokes.length < limits.strokesPerPage &&
    pageSize(strokes) + stroke.points.length + 1 <= limits.numbersPerPage
  );
}

export function distanceToStroke(stroke: CanvasStroke, x: number, y: number): number {
  const p = stroke.points;
  let best = Infinity;
  if (p.length === 2) return Math.hypot(p[0]! - x, p[1]! - y);
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i]!;
    const ay = p[i + 1]!;
    const bx = p[i + 2]!;
    const by = p[i + 3]!;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return best;
}

/** The strokes the eraser touches at (x, y), by index: it removes a whole stroke. */
export function strokeHits(strokes: readonly CanvasStroke[], x: number, y: number): number[] {
  const hit: number[] = [];
  strokes.forEach((stroke, index) => {
    if (distanceToStroke(stroke, x, y) <= ERASER_REACH + stroke.width / 2) hit.push(index);
  });
  return hit;
}

/**
 * A stroke's points as an SVG path in canvas units: through the midpoints, so a simplified stroke
 * still reads as handwriting (the web's drawStroke). A single point is a dot (with a round cap).
 */
export function strokePath(points: readonly number[]): string {
  'worklet';
  const n = points.length;
  if (n < 2) return '';
  let d = `M${points[0]} ${points[1]}`;
  if (n === 2) return `${d}L${points[0]! + 0.01} ${points[1]}`;
  for (let i = 2; i + 3 < n; i += 2) {
    const mx = (points[i]! + points[i + 2]!) / 2;
    const my = (points[i + 1]! + points[i + 3]!) / 2;
    d += `Q${points[i]} ${points[i + 1]} ${mx} ${my}`;
  }
  return `${d}L${points[n - 2]} ${points[n - 1]}`;
}

/** A point on a view of `width` x `height` points, in the surface's units (the student's page by default). */
export function toCanvasUnits(
  x: number,
  y: number,
  width: number,
  height: number,
  unitsWide: number = CANVAS_LIMITS.width,
  unitsHigh: number = CANVAS_LIMITS.height,
): [number, number] {
  'worklet';
  return [(x / (width || 1)) * unitsWide, (y / (height || 1)) * unitsHigh];
}

/** The largest box of `size`'s shape (the student's 5:4 page by default) that fits in a box. */
export function fitCanvas(width: number, height: number, size: CanvasSize = CANVAS_LIMITS): CanvasSize {
  const ratio = size.width / size.height;
  const w = Math.max(0, Math.min(width, height * ratio));
  return { width: Math.floor(w), height: Math.floor(w / ratio) };
}

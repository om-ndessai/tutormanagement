// The canvas's pure rules, ported from the web's drawing-canvas.tsx: strokes kept in whole canvas
// units inside the page, simplified before they are sent; the eraser's reach; the path drawn.
import { CANVAS_LIMITS, formatStroke, parseStroke } from '@tmi/shared';

import {
  ERASER_REACH,
  PEN_WIDTH,
  finishStroke,
  fitCanvas,
  pageSize,
  simplify,
  strokeFits,
  strokeHits,
  strokePath,
  toCanvasUnits,
} from './drawing-model';

describe('finishStroke', () => {
  it('rounds to whole units, clamps to the page and drops repeated points', () => {
    const stroke = finishStroke([10.4, 20.6, 10.4, 20.6, -5, 900, 1200.2, 400]);
    expect(stroke.width).toBe(PEN_WIDTH);
    expect(stroke.points).toEqual([10, 21, 0, 800, 1000, 400]);
    expect(stroke.points.every(Number.isInteger)).toBe(true);
  });

  it('keeps a tap as a single point (a dot)', () => {
    expect(finishStroke([500.2, 400.7, 500.4, 400.9]).points).toEqual([500, 401]);
  });

  it('simplifies a straight line to its ends, and keeps a corner', () => {
    const line: number[] = [];
    for (let x = 0; x <= 100; x += 1) line.push(x, 50);
    expect(finishStroke(line).points).toEqual([0, 50, 100, 50]);
    const corner = [0, 0, 50, 0, 100, 0, 100, 50, 100, 100];
    expect(finishStroke(corner).points).toEqual([0, 0, 100, 0, 100, 100]);
  });

  it('writes what the server reads back', () => {
    const stroke = finishStroke([1, 2, 300, 400, 999.6, 799.6]);
    expect(parseStroke(formatStroke(stroke))).toEqual(stroke);
  });
});

describe('simplify', () => {
  it('leaves two points alone and drops points within the tolerance', () => {
    expect(simplify([0, 0, 10, 10], 0.8)).toEqual([0, 0, 10, 10]);
    expect(simplify([0, 0, 5, 0.5, 10, 0], 0.8)).toEqual([0, 0, 10, 0]);
    expect(simplify([0, 0, 5, 3, 10, 0], 0.8)).toEqual([0, 0, 5, 3, 10, 0]);
  });
});

describe('the page limits', () => {
  it('counts a stroke as its points and its width', () => {
    expect(pageSize([{ width: 4, points: [1, 2, 3, 4] }, { width: 4, points: [5, 6] }])).toBe(8);
  });

  it('refuses a stroke past the strokes or the numbers a page may hold', () => {
    const dot = { width: 4, points: [1, 1] };
    expect(strokeFits([], dot)).toBe(true);
    expect(strokeFits(Array.from({ length: CANVAS_LIMITS.strokesPerPage }, () => dot), dot)).toBe(false);
    const big = { width: 4, points: Array.from({ length: CANVAS_LIMITS.numbersPerPage - 2 }, () => 1) };
    expect(strokeFits([big], dot)).toBe(false);
  });
});

describe('the eraser', () => {
  const across = { width: 4, points: [100, 100, 300, 100] };
  const dot = { width: 4, points: [600, 600] };

  it('takes a whole stroke it comes within reach of, by index', () => {
    expect(strokeHits([across, dot], 200, 100 + ERASER_REACH)).toEqual([0]);
    expect(strokeHits([across, dot], 200, 100 + ERASER_REACH + 3)).toEqual([]);
    expect(strokeHits([across, dot], 605, 600)).toEqual([1]);
  });
});

describe('strokePath', () => {
  it('draws a dot, a line and a curve through the midpoints', () => {
    expect(strokePath([])).toBe('');
    expect(strokePath([5, 6])).toBe('M5 6L5.01 6');
    expect(strokePath([0, 0, 10, 10])).toBe('M0 0L10 10');
    expect(strokePath([0, 0, 10, 0, 20, 10])).toBe('M0 0Q10 0 15 5L20 10');
  });
});

describe('the canvas on screen', () => {
  it('maps points on the view to canvas units', () => {
    expect(toCanvasUnits(50, 40, 500, 400)).toEqual([100, 80]);
  });

  it('fits the largest 5:4 page in a box', () => {
    expect(fitCanvas(358, 600)).toEqual({ width: 358, height: 286 });
    expect(fitCanvas(1000, 400)).toEqual({ width: 500, height: 400 });
    expect(fitCanvas(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

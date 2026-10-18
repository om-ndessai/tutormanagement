import { useCallback, useEffect, useRef } from 'react';
import { CANVAS_LIMITS, type CanvasStroke } from '@tmi/shared';

import { cn } from '@/lib/utils';

// Phase 38: a page to write on. Pointer Events cover a pen, a finger and a
// mouse alike; once a pen has been used, touches are ignored, which is palm
// rejection. Strokes are kept in the canvas's own units (a 1000 x 800 page,
// whatever the screen), so the PDF never depends on the device. No feedback:
// it only draws.

export type CanvasTool = 'pen' | 'eraser';

/** The pen's width, in canvas units: about 3 px on a laptop, 2 on a phone. */
export const PEN_WIDTH = 4;
/** How near the eraser must come to a stroke to take it away, in canvas units. */
const ERASER_REACH = 14;

/** Ramer-Douglas-Peucker on x,y pairs: drops points a stroke does not need. */
function simplify(points: number[], tolerance: number): number[] {
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

/** The finished stroke as it is kept: whole units, inside the page, simplified. */
export function finishStroke(raw: number[], width = PEN_WIDTH): CanvasStroke {
  const rounded: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const x = Math.min(CANVAS_LIMITS.width, Math.max(0, Math.round(raw[i]!)));
    const y = Math.min(CANVAS_LIMITS.height, Math.max(0, Math.round(raw[i + 1]!)));
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

function distanceToStroke(stroke: CanvasStroke, x: number, y: number): number {
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

function drawStroke(ctx: CanvasRenderingContext2D, points: readonly number[], width: number, scale: number) {
  if (points.length < 2) return;
  ctx.lineWidth = width * scale;
  ctx.beginPath();
  ctx.moveTo(points[0]! * scale, points[1]! * scale);
  if (points.length === 2) {
    ctx.lineTo(points[0]! * scale + 0.01, points[1]! * scale);
  } else {
    // Through the midpoints, so a simplified stroke still reads as handwriting.
    for (let i = 2; i + 3 < points.length; i += 2) {
      const mx = (points[i]! + points[i + 2]!) / 2;
      const my = (points[i + 1]! + points[i + 3]!) / 2;
      ctx.quadraticCurveTo(points[i]! * scale, points[i + 1]! * scale, mx * scale, my * scale);
    }
    ctx.lineTo(points[points.length - 2]! * scale, points[points.length - 1]! * scale);
  }
  ctx.stroke();
}

export function DrawingCanvas({
  strokes,
  tool,
  onStroke,
  onErase,
  className,
  label,
}: {
  strokes: readonly CanvasStroke[];
  tool: CanvasTool;
  /** A finished stroke; the page decides whether it still fits. */
  onStroke: (stroke: CanvasStroke) => void;
  /** The strokes the eraser touched, by index. */
  onErase: (indexes: number[]) => void;
  className?: string;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ pointerId: number; points: number[] } | null>(null);
  const penSeen = useRef(false);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scale = canvas.width / CANVAS_LIMITS.width;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // The ink is the page's own text colour, so it follows the theme.
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke.points, stroke.width, scale);
    if (live.current) drawStroke(ctx, live.current.points, PEN_WIDTH, scale);
  }, []);

  // Sized to its box in device pixels, and redrawn whenever the box changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  function toCanvas(event: { clientX: number; clientY: number }): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * CANVAS_LIMITS.width,
      ((event.clientY - rect.top) / rect.height) * CANVAS_LIMITS.height,
    ];
  }

  function erase(x: number, y: number) {
    const hit: number[] = [];
    strokesRef.current.forEach((stroke, index) => {
      if (distanceToStroke(stroke, x, y) <= ERASER_REACH + stroke.width / 2) hit.push(index);
    });
    if (hit.length > 0) onErase(hit);
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'pen') penSeen.current = true;
    // Palm rejection: once a pen has written here, a touch is a resting hand.
    if (event.pointerType === 'touch' && penSeen.current) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (live.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = toCanvas(event);
    if (tool === 'eraser') {
      live.current = { pointerId: event.pointerId, points: [] };
      erase(x, y);
      return;
    }
    live.current = { pointerId: event.pointerId, points: [x, y] };
    redraw();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = live.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Every sample, not one per frame: a pen reports far faster than the screen draws.
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) {
      const [x, y] = toCanvas(sample);
      if (tool === 'eraser') erase(x, y);
      else current.points.push(x, y);
    }
    if (tool === 'pen') redraw();
  }

  function onPointerEnd(event: React.PointerEvent<HTMLCanvasElement>) {
    const current = live.current;
    if (!current || current.pointerId !== event.pointerId) return;
    live.current = null;
    if (tool === 'pen' && current.points.length >= 2) onStroke(finishStroke(current.points));
    redraw();
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      data-testid="assessment-canvas"
      className={cn(
        // As wide as the page allows, but never taller than the screen leaves room for, so the
        // whole page can be written on without scrolling (a pen cannot scroll and write at once).
        'bg-card text-foreground mx-auto block aspect-[5/4] w-full max-w-[min(100%,calc((100dvh-15rem)*1.25))] touch-none rounded-lg border select-none',
        tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair',
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

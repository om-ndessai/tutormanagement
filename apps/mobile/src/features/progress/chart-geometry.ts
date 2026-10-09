// Ported from apps/web/src/features/progress/progress-chart.tsx @ 1132322 (the geometry, lifted
// out of the component so it is tested without drawing).
//
// The goal timeline:
//   y  share of the plan's topics mastered (rated 4 or 5), 0-100%
//   x  the calendar, from the plan's start to its goal date (or today, if that is later)
import type { LearningPlan, ProgressCancellation, ProgressPoint, ProgressSummary } from '@tmi/shared';

export const FULL = { height: 240, margin: { top: 26, right: 44, bottom: 30, left: 40 }, floor: 280 };
/**
 * The dashboard's card-sized version (Phase 21): the same geometry with the words taken off -- no
 * axes, labels, legend or tooltip -- so the shape of the run against the pace line is what reads.
 */
export const COMPACT = { height: 64, margin: { top: 6, right: 6, bottom: 6, left: 6 }, floor: 120 };
export type ChartSize = typeof FULL | typeof COMPACT;

const DAY_MS = 86_400_000;

/** A finger's reach: a tap further than this from every mark selects nothing. */
export const REACH = 44;

export function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** The total length of a polyline, for drawing it on with a dash offset. */
export function pathLength(points: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1]!;
    const [x2, y2] = points[index]!;
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

/** The chart's geometry for a width: pure, so it is tested without drawing. */
export function chartGeometry({
  plan,
  summary,
  timeline,
  today,
  width,
  size = COMPACT,
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: Pick<ProgressSummary, 'start_percent'>;
  timeline: Pick<ProgressPoint, 'occurred_on' | 'percent'>[];
  today: string;
  width: number;
  size?: ChartSize;
}) {
  const { height: HEIGHT, margin: MARGIN } = size;
  const start = toDay(plan.starts_on);
  const goal = toDay(plan.target_on);
  const now = toDay(today);
  const first = timeline[0] ? toDay(timeline[0].occurred_on) : start;

  const min = Math.min(start, first);
  const max = Math.max(goal, now);
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const x = (day: number) => MARGIN.left + ((day - min) / Math.max(1, max - min)) * innerWidth;
  const y = (percent: number) => MARGIN.top + (1 - percent / 100) * innerHeight;

  // Month ticks, thinned so labels never collide on a phone.
  const ticks: number[] = [];
  const cursor = new Date(min * DAY_MS);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() / DAY_MS <= max) {
    ticks.push(Math.floor(cursor.getTime() / DAY_MS));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const every = Math.max(1, Math.ceil(ticks.length / Math.max(1, Math.floor(innerWidth / 56))));

  // The real line: flat at the starting share, stepping at each lesson, and carried on to today
  // so the gap to the pace line is visible now.
  const points: [number, number][] = [[x(start), y(summary.start_percent)]];
  for (const point of timeline) {
    const px = x(toDay(point.occurred_on));
    points.push([px, points.at(-1)![1]], [px, y(point.percent)]);
  }
  const end = Math.min(now, max);
  if (end > (timeline.at(-1) ? toDay(timeline.at(-1)!.occurred_on) : start)) {
    points.push([x(end), points.at(-1)![1]]);
  }

  return {
    x,
    y,
    start,
    goal,
    now,
    innerHeight,
    innerWidth,
    ticks: ticks.filter((_, index) => index % every === 0),
    /** The pace line: nothing at the start, everything at the goal. */
    pace: { x1: x(start), y1: y(0), x2: x(goal), y2: y(100) },
    line: points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px},${py}`).join(' '),
    lineLength: pathLength(points),
    area:
      `M${points[0]![0]},${y(0)} ` +
      points.map(([px, py]) => `L${px},${py}`).join(' ') +
      ` L${points.at(-1)![0]},${y(0)} Z`,
    endPoint: points.at(-1)!,
  };
}

/** The mark under a finger or the screen reader: a lesson, or a cancelled one. */
export type Mark = { kind: 'lesson' | 'cancelled'; index: number };

/**
 * Snap a finger to the nearest lesson or cancelled one: readers aim at a date, not a dot. Null
 * when nothing is within reach.
 */
export function nearestMark(
  px: number,
  x: (day: number) => number,
  timeline: Pick<ProgressPoint, 'occurred_on'>[],
  cancellations: Pick<ProgressCancellation, 'occurs_on'>[],
  reach = REACH,
): Mark | null {
  let nearest: Mark | null = null;
  let distance = Infinity;
  const consider = (kind: Mark['kind'], day: string, index: number) => {
    const gap = Math.abs(x(toDay(day)) - px);
    if (gap < distance) {
      distance = gap;
      nearest = { kind, index };
    }
  };
  timeline.forEach((point, index) => consider('lesson', point.occurred_on, index));
  cancellations.forEach((row, index) => consider('cancelled', row.occurs_on, index));
  return distance <= reach ? nearest : null;
}

/** Every mark in date order: what the screen reader's swipe up and down steps through. */
export function orderedMarks(
  timeline: Pick<ProgressPoint, 'occurred_on'>[],
  cancellations: Pick<ProgressCancellation, 'occurs_on'>[],
): Mark[] {
  return [
    ...timeline.map((point, index) => ({ kind: 'lesson' as const, index, day: point.occurred_on })),
    ...cancellations.map((row, index) => ({ kind: 'cancelled' as const, index, day: row.occurs_on })),
  ]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(({ kind, index }) => ({ kind, index }));
}

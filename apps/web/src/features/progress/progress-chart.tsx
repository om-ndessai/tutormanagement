import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GOAL_RATING_LABELS,
  SCHEDULE_CANCELLER_LABELS,
  formatClockTime,
  formatDuration,
  type LearningPlan,
  type ProgressCancellation,
  type ProgressPoint,
  type ProgressSummary,
} from '@tmi/shared';

import { ratingStyle } from './rating';

/**
 * The goal timeline: where the student started, where the plan says they
 * should be by now, and where each lesson has actually left them.
 *
 *   y  share of the plan's topics mastered (rated 4 or 5), 0-100%
 *   x  the calendar, from the plan's start to its goal date (or today, if
 *      that is later)
 *
 * Two series and no more. The thin grey line is the pace a straight run from
 * start to goal would keep; the brand line is the real thing, stepping up at
 * each lesson that moved a topic over the line. Each lesson is a dot, shaded
 * by how the tutor rated its step towards the goal, so "lots of lessons, flat
 * line" and "few lessons, steep line" both read at a glance.
 *
 * A lesson of the schedule that was called off (Phase 24) is a small cross on
 * the baseline at its date, fainter while it is still ahead: not a step and
 * not a series, just the reason a week has no dot.
 */

const FULL = { height: 240, margin: { top: 26, right: 44, bottom: 30, left: 40 }, floor: 280 };
/**
 * The dashboard's card-sized version (Phase 21): the same geometry with the
 * words taken off -- no axes, labels, legend or tooltip -- so the shape of the
 * run against the pace line is what reads. The full chart is one click away.
 */
const COMPACT = { height: 64, margin: { top: 6, right: 6, bottom: 6, left: 6 }, floor: 120 };
const DAY_MS = 86_400_000;

function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function monthLabel(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString(undefined, {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Tracks an element's rendered width so text stays at its real size. */
function useWidth<T extends HTMLElement>(floor: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(floor === FULL.floor ? 640 : 240);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(floor, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [floor]);

  return { ref, width };
}

/** The mark under the pointer or the keyboard: a lesson, or a cancelled one. */
type Active = { kind: 'lesson' | 'cancelled'; index: number } | null;

export function ProgressChart({
  plan,
  summary,
  timeline,
  today,
  cancellations = [],
  compact = false,
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: ProgressSummary;
  timeline: ProgressPoint[];
  today: string;
  /** Lessons of the schedule that were called off, inside the plan's dates. */
  cancellations?: ProgressCancellation[];
  /** The card-sized sparkline: no axes, labels, legend or tooltip. */
  compact?: boolean;
}) {
  const size = compact ? COMPACT : FULL;
  const HEIGHT = size.height;
  const MARGIN = size.margin;
  const { ref, width } = useWidth<HTMLDivElement>(size.floor);
  const [active, setActive] = useState<Active>(null);

  const geometry = useMemo(() => {
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
    const every = Math.max(1, Math.ceil(ticks.length / Math.floor(innerWidth / 56)));

    // The real line: flat at the starting share, stepping at each lesson, and
    // carried on to today so the gap to the pace line is visible now.
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
      ticks: ticks.filter((_, index) => index % every === 0),
      line: points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px},${py}`).join(' '),
      area:
        `M${points[0]![0]},${y(0)} ` +
        points.map(([px, py]) => `L${px},${py}`).join(' ') +
        ` L${points.at(-1)![0]},${y(0)} Z`,
      endPoint: points.at(-1)!,
    };
  }, [plan.starts_on, plan.target_on, summary.start_percent, timeline, today, width, HEIGHT, MARGIN]);

  const { x, y } = geometry;
  const activePoint = active?.kind === 'lesson' ? timeline[active.index] : null;
  const activeCancellation = active?.kind === 'cancelled' ? cancellations[active.index] : null;
  const activeDay = activePoint?.occurred_on ?? activeCancellation?.occurs_on ?? null;
  const cancelledCount = cancellations.length;

  /**
   * Snap the pointer to the nearest lesson or cancelled one: readers aim at a
   * date, not a dot.
   */
  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    if (timeline.length === 0 && cancellations.length === 0) return;
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = event.clientX - bounds.left;

    let nearest: Active = null;
    let distance = Infinity;
    const consider = (kind: 'lesson' | 'cancelled', day: string, index: number) => {
      const gap = Math.abs(x(toDay(day)) - px);
      if (gap < distance) {
        distance = gap;
        nearest = { kind, index };
      }
    };
    timeline.forEach((point, index) => consider('lesson', point.occurred_on, index));
    cancellations.forEach((row, index) => consider('cancelled', row.occurs_on, index));
    setActive(distance < 40 ? nearest : null);
  }

  return (
    <figure className={compact ? undefined : 'space-y-3'}>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            `Progress towards the goal: ${summary.percent}% of plan topics mastered, ` +
            `against ${summary.expected_percent}% expected by today.` +
            (cancelledCount > 0
              ? ` ${cancelledCount} ${cancelledCount === 1 ? 'lesson' : 'lessons'} cancelled.`
              : '')
          }
          className="block overflow-visible"
        >
          {/* Recessive frame: hairline gridlines at the quarter marks. */}
          {!compact && [0, 25, 50, 75, 100].map((percent) => (
            <g key={percent}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(percent)}
                y2={y(percent)}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(percent)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {percent}%
              </text>
            </g>
          ))}

          {!compact && geometry.ticks.map((day) => (
            <text
              key={day}
              x={x(day)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {monthLabel(day)}
            </text>
          ))}

          {/* Start and goal: the two ends of the timeline, named. */}
          {!compact && (
            [
              [geometry.start, 'Start'],
              [geometry.goal, 'Goal'],
            ] as const
          ).map(([day, label]) => (
            <g key={label}>
              <line
                x1={x(day)}
                x2={x(day)}
                y1={MARGIN.top - 6}
                y2={y(0)}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.45}
                strokeWidth={1}
              />
              <text
                x={x(day)}
                y={MARGIN.top - 12}
                textAnchor={label === 'Start' ? 'start' : 'end'}
                className="fill-muted-foreground text-[10px] font-medium"
              >
                {label} · {shortDate(label === 'Start' ? plan.starts_on : plan.target_on)}
              </text>
            </g>
          ))}

          {/* Planned pace: straight from nothing at the start to everything at the goal. */}
          <line
            x1={x(geometry.start)}
            y1={y(0)}
            x2={x(geometry.goal)}
            y2={y(100)}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          <path d={geometry.area} fill="var(--primary)" fillOpacity={0.1} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Today, when it falls inside the timeline. */}
          {geometry.now >= geometry.start && geometry.now <= geometry.goal && (
            <g>
              <line
                x1={x(geometry.now)}
                x2={x(geometry.now)}
                y1={MARGIN.top}
                y2={y(0)}
                stroke="var(--foreground)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
              {!compact && (
                <text
                  x={x(geometry.now) + 4}
                  y={y(100) + 10}
                  className="fill-muted-foreground text-[10px]"
                >
                  Today
                </text>
              )}
            </g>
          )}

          {/* The one direct label: where the student is now -- lifted clear
              of a cancelled-lesson cross that sits just after today. */}
          {!compact && (
          <text
            x={geometry.endPoint[0] + 8}
            y={
              geometry.endPoint[1] -
              (cancellations.some((row) => {
                const cx = x(toDay(row.occurs_on));
                return cx >= geometry.endPoint[0] - 4 && cx <= geometry.endPoint[0] + 36;
              }) && geometry.endPoint[1] > y(0) - 16
                ? 14
                : 0)
            }
            dy="0.32em"
            className="fill-foreground text-[11px] font-semibold tabular-nums"
          >
            {summary.percent}%
          </text>
          )}

          {activeDay && (
            <line
              x1={x(toDay(activeDay))}
              x2={x(toDay(activeDay))}
              y1={MARGIN.top}
              y2={y(0)}
              stroke="var(--primary)"
              strokeOpacity={0.5}
              strokeWidth={1}
            />
          )}

          {timeline.map((point, index) => {
            const cx = x(toDay(point.occurred_on));
            const cy = y(point.percent);
            const fill = point.goal_rating
              ? ratingStyle(point.goal_rating).backgroundColor
              : 'var(--muted)';

            return (
              <circle
                key={point.session_id}
                cx={cx}
                cy={cy}
                r={compact ? 2.5 : active?.kind === 'lesson' && active.index === index ? 6 : 4.5}
                fill={fill}
                stroke="var(--card)"
                strokeWidth={compact ? 1 : 2}
                tabIndex={compact ? undefined : 0}
                role={compact ? undefined : 'button'}
                aria-label={compact ? undefined :
                  `${shortDate(point.occurred_on)} with ${point.tutor_name}: ` +
                  (point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'not scored') +
                  `, ${point.percent}% mastered after it`
                }
                onFocus={() => setActive({ kind: 'lesson', index })}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            );
          })}

          {/* Cancelled lessons: a cross on the baseline at the date, fainter
              while still ahead. Muted ink, not a series colour -- it marks an
              absence, and its label says so. */}
          {cancellations.map((row, index) => {
            const cx = x(toDay(row.occurs_on));
            const cy = y(0) - (compact ? 3 : 6);
            const arm = compact ? 2.5 : active?.kind === 'cancelled' && active.index === index ? 5 : 4;
            const ahead = row.occurs_on >= today;

            return (
              <g
                key={`${row.schedule_id}-${row.occurs_on}`}
                data-cancelled-mark
                stroke="var(--muted-foreground)"
                strokeOpacity={ahead ? 0.5 : 0.95}
                strokeWidth={compact ? 1.25 : 1.75}
                strokeLinecap="round"
                tabIndex={compact ? undefined : 0}
                role={compact ? undefined : 'button'}
                aria-label={compact ? undefined : cancellationLabel(row)}
                onFocus={() => setActive({ kind: 'cancelled', index })}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* A wider invisible disc, so focus has something to ring. */}
                {!compact && <circle cx={cx} cy={cy} r={7} fill="transparent" stroke="none" />}
                <line x1={cx - arm} y1={cy - arm} x2={cx + arm} y2={cy + arm} />
                <line x1={cx - arm} y1={cy + arm} x2={cx + arm} y2={cy - arm} />
              </g>
            );
          })}

          {/* A hit layer over the whole plot: the crosshair finds the lesson. */}
          {!compact && (
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, width - MARGIN.left - MARGIN.right)}
            height={geometry.innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
          )}
        </svg>

        {activeCancellation && (
          <div
            role="status"
            className="bg-popover text-popover-foreground pointer-events-none absolute z-10 w-56 rounded-md border px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(
                Math.max(0, x(toDay(activeCancellation.occurs_on)) - 112),
                Math.max(0, width - 224),
              ),
              top: Math.max(0, y(0) - 104),
            }}
          >
            <p className="text-sm font-semibold">
              Cancelled{activeCancellation.occurs_on >= today ? ' · upcoming' : ''}
            </p>
            <p className="text-muted-foreground">
              {shortDate(activeCancellation.occurs_on)} ·{' '}
              {formatClockTime(activeCancellation.start_time)} with {activeCancellation.tutor_name}
            </p>
            <p className="text-muted-foreground">
              By {activeCancellation.cancelled_by_name ?? SCHEDULE_CANCELLER_LABELS[activeCancellation.cancelled_as]}
            </p>
            {activeCancellation.note && <p className="mt-1">{activeCancellation.note}</p>}
          </div>
        )}

        {activePoint && (
          <div
            role="status"
            className="bg-popover text-popover-foreground pointer-events-none absolute z-10 w-52 rounded-md border px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(
                Math.max(0, x(toDay(activePoint.occurred_on)) - 104),
                Math.max(0, width - 208),
              ),
              top: Math.max(0, y(activePoint.percent) - 96),
            }}
          >
            <p className="text-sm font-semibold tabular-nums">{activePoint.percent}% mastered</p>
            <p className="text-muted-foreground">
              {shortDate(activePoint.occurred_on)} · {formatDuration(activePoint.duration_minutes)}{' '}
              with {activePoint.tutor_name}
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{
                  backgroundColor: activePoint.goal_rating
                    ? ratingStyle(activePoint.goal_rating).backgroundColor
                    : 'var(--muted)',
                }}
              />
              {activePoint.goal_rating
                ? GOAL_RATING_LABELS[activePoint.goal_rating]
                : 'Not scored against the goal'}
            </p>
            <p className="text-muted-foreground">
              {activePoint.topics_rated} {activePoint.topics_rated === 1 ? 'topic' : 'topics'} rated
            </p>
          </div>
        )}
      </div>

      {!compact && (
      <figcaption className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary inline-block h-0.5 w-4 rounded" />
          Topics mastered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/60 inline-block h-0.5 w-4 rounded" />
          Planned pace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex">
            {([1, 3, 5] as const).map((rating) => (
              <span
                key={rating}
                className="border-card -ml-0.5 inline-block size-2.5 rounded-full border first:ml-0"
                style={{ backgroundColor: ratingStyle(rating).backgroundColor }}
              />
            ))}
          </span>
          Lesson, darker = bigger step towards the goal
        </span>
        {cancelledCount > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10" aria-hidden className="shrink-0">
              <g stroke="var(--muted-foreground)" strokeWidth={1.75} strokeLinecap="round">
                <line x1={1} y1={1} x2={9} y2={9} />
                <line x1={1} y1={9} x2={9} y2={1} />
              </g>
            </svg>
            Cancelled lesson
          </span>
        )}
      </figcaption>
      )}
    </figure>
  );
}

/** How a cancelled lesson reads to a screen reader. */
function cancellationLabel(row: ProgressCancellation): string {
  return (
    `Cancelled lesson, ${shortDate(row.occurs_on)} with ${row.tutor_name}, ` +
    `by ${row.cancelled_by_name ?? SCHEDULE_CANCELLER_LABELS[row.cancelled_as]}` +
    (row.note ? `: ${row.note}` : '')
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GOAL_RATING_LABELS,
  formatDuration,
  type LearningPlan,
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
 */

const HEIGHT = 240;
const MARGIN = { top: 26, right: 44, bottom: 30, left: 40 };
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
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function ProgressChart({
  plan,
  summary,
  timeline,
  today,
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: ProgressSummary;
  timeline: ProgressPoint[];
  today: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

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
  }, [plan.starts_on, plan.target_on, summary.start_percent, timeline, today, width]);

  const { x, y } = geometry;
  const activePoint = active === null ? null : timeline[active];

  /** Snap the pointer to the nearest lesson: readers aim at a date, not a dot. */
  function handlePointer(event: React.PointerEvent<SVGRectElement>) {
    if (timeline.length === 0) return;
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = event.clientX - bounds.left;

    let nearest = 0;
    let distance = Infinity;
    timeline.forEach((point, index) => {
      const gap = Math.abs(x(toDay(point.occurred_on)) - px);
      if (gap < distance) {
        distance = gap;
        nearest = index;
      }
    });
    setActive(distance < 40 ? nearest : null);
  }

  return (
    <figure className="space-y-3">
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={
            `Progress towards the goal: ${summary.percent}% of plan topics mastered, ` +
            `against ${summary.expected_percent}% expected by today.`
          }
          className="block overflow-visible"
        >
          {/* Recessive frame: hairline gridlines at the quarter marks. */}
          {[0, 25, 50, 75, 100].map((percent) => (
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

          {geometry.ticks.map((day) => (
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
          {(
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
              <text
                x={x(geometry.now) + 4}
                y={y(100) + 10}
                className="fill-muted-foreground text-[10px]"
              >
                Today
              </text>
            </g>
          )}

          {/* The one direct label: where the student is now. */}
          <text
            x={geometry.endPoint[0] + 8}
            y={geometry.endPoint[1]}
            dy="0.32em"
            className="fill-foreground text-[11px] font-semibold tabular-nums"
          >
            {summary.percent}%
          </text>

          {activePoint && (
            <line
              x1={x(toDay(activePoint.occurred_on))}
              x2={x(toDay(activePoint.occurred_on))}
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
                r={active === index ? 6 : 4.5}
                fill={fill}
                stroke="var(--card)"
                strokeWidth={2}
                tabIndex={0}
                role="button"
                aria-label={
                  `${shortDate(point.occurred_on)} with ${point.tutor_name}: ` +
                  (point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'not scored') +
                  `, ${point.percent}% mastered after it`
                }
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            );
          })}

          {/* A hit layer over the whole plot: the crosshair finds the lesson. */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={Math.max(0, width - MARGIN.left - MARGIN.right)}
            height={geometry.innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>

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
      </figcaption>
    </figure>
  );
}

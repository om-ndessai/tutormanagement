// Ported from apps/web/src/features/progress/progress-chart.tsx @ 1132322 (the compact variant;
// the full chart with axes and its tooltip arrives with the Progress feature, 24)
import type { LearningPlan, ProgressCancellation, ProgressPoint, ProgressSummary } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { useAppTheme } from '@/providers/theme-provider';
import { ratingStyle } from './rating';

/**
 * The goal timeline, card-sized (Phase 21): where the student started, where the plan says they
 * should be by now, and where each lesson has actually left them -- with the words taken off (no
 * axes, labels, legend or tooltip), so the shape of the run against the pace line is what reads.
 *
 *   y  share of the plan's topics mastered (rated 4 or 5), 0-100%
 *   x  the calendar, from the plan's start to its goal date (or today, if that is later)
 */
const COMPACT = { height: 64, margin: { top: 6, right: 6, bottom: 6, left: 6 }, floor: 120 };
const DAY_MS = 86_400_000;

function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** The chart's geometry for a width: pure, so it is tested without drawing. */
export function chartGeometry({
  plan,
  summary,
  timeline,
  today,
  width,
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: Pick<ProgressSummary, 'start_percent'>;
  timeline: Pick<ProgressPoint, 'occurred_on' | 'percent'>[];
  today: string;
  width: number;
}) {
  const { height: HEIGHT, margin: MARGIN } = COMPACT;
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
    line: points.map(([px, py], index) => `${index === 0 ? 'M' : 'L'}${px},${py}`).join(' '),
    area:
      `M${points[0]![0]},${y(0)} ` +
      points.map(([px, py]) => `L${px},${py}`).join(' ') +
      ` L${points.at(-1)![0]},${y(0)} Z`,
  };
}

export function ProgressChart({
  plan,
  summary,
  timeline,
  today,
  cancellations = [],
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: ProgressSummary;
  timeline: ProgressPoint[];
  today: string;
  cancellations?: ProgressCancellation[];
}) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const [measured, setMeasured] = useState(240);
  const width = Math.max(COMPACT.floor, measured);
  const HEIGHT = COMPACT.height;
  const MARGIN = COMPACT.margin;

  const geometry = useMemo(
    () => chartGeometry({ plan, summary, timeline, today, width }),
    [plan, summary, timeline, today, width],
  );
  const { x, y } = geometry;
  const cancelledCount = cancellations.length;

  return (
    <View
      onLayout={(event) => setMeasured(Math.round(event.nativeEvent.layout.width))}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        `Progress towards the goal: ${summary.percent}% of plan topics mastered, ` +
        `against ${summary.expected_percent}% expected by today.` +
        (cancelledCount > 0
          ? ` ${cancelledCount} ${cancelledCount === 1 ? 'lesson' : 'lessons'} cancelled.`
          : '')
      }
    >
      <Svg width={width} height={HEIGHT}>
        {/* Planned pace: straight from nothing at the start to everything at the goal. */}
        <Line
          x1={x(geometry.start)}
          y1={y(0)}
          x2={x(geometry.goal)}
          y2={y(100)}
          stroke={t.mutedForeground}
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Path d={geometry.area} fill={t.primary} fillOpacity={0.1} />
        <Path
          d={geometry.line}
          fill="none"
          stroke={t.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {geometry.now >= geometry.start && geometry.now <= geometry.goal ? (
          <Line
            x1={x(geometry.now)}
            x2={x(geometry.now)}
            y1={MARGIN.top}
            y2={y(0)}
            stroke={t.foreground}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
        ) : null}

        {timeline.map((point) => (
          <Circle
            key={point.session_id}
            cx={x(toDay(point.occurred_on))}
            cy={y(point.percent)}
            r={2.5}
            fill={point.goal_rating ? ratingStyle(theme, point.goal_rating).backgroundColor : t.muted}
            stroke={t.card}
            strokeWidth={1}
          />
        ))}

        {/* Cancelled lessons: a cross on the baseline at the date, fainter while still ahead. */}
        {cancellations.map((row) => {
          const cx = x(toDay(row.occurs_on));
          const cy = y(0) - 3;
          const arm = 2.5;
          return (
            <G
              key={`${row.schedule_id}-${row.occurs_on}`}
              stroke={t.mutedForeground}
              strokeOpacity={row.occurs_on >= today ? 0.5 : 0.95}
              strokeWidth={1.25}
              strokeLinecap="round"
            >
              <Line x1={cx - arm} y1={cy - arm} x2={cx + arm} y2={cy + arm} />
              <Line x1={cx - arm} y1={cy + arm} x2={cx + arm} y2={cy - arm} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

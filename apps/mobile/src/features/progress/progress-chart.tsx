// Ported from apps/web/src/features/progress/progress-chart.tsx @ 1132322 -- both variants: the
// dashboard's compact sparkline (#13) and the student page's full chart (#24). The web's hover
// tooltip becomes a tap, or a long-press-and-drag scrub, that snaps to the nearest lesson.
import {
  type LearningPlan,
  type ProgressCancellation,
  type ProgressPoint,
  type ProgressSummary,
} from '@tmi/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Text } from 'react-native-paper';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { COMPACT, FULL, chartGeometry, nearestMark, orderedMarks, toDay, type Mark } from './chart-geometry';
import { ChartTooltip, cancellationLabel, lessonLabel } from './chart-tooltip';
import { ratingStyle } from './rating';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DRAW_MS = 700;

function monthLabel(day: number): string {
  return new Date(day * 86_400_000).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The goal timeline: where the student started, where the plan says they should be by now, and
 * where each lesson has actually left them.
 *
 * Two series and no more. The thin grey line is the pace a straight run from start to goal would
 * keep; the brand line is the real thing, stepping up at each lesson that moved a topic over the
 * line. Each lesson is a dot, shaded by how the tutor rated its step towards the goal. A lesson of
 * the schedule that was called off is a small cross on the baseline at its date, fainter while it
 * is still ahead.
 */
export function ProgressChart({
  plan,
  summary,
  timeline,
  today,
  cancellations = [],
  variant = 'compact',
}: {
  plan: Pick<LearningPlan, 'starts_on' | 'target_on'>;
  summary: ProgressSummary;
  timeline: ProgressPoint[];
  today: string;
  /** Lessons of the schedule that were called off, inside the plan's dates. */
  cancellations?: ProgressCancellation[];
  /** `compact`: the card-sized sparkline, no words. `full`: axes, labels, legend and the scrub. */
  variant?: 'compact' | 'full';
}) {
  const full = variant === 'full';
  const size = full ? FULL : COMPACT;
  const theme = useAppTheme();
  const t = theme.tokens;
  const reduced = useReducedMotion();
  const [measured, setMeasured] = useState(0);
  const width = Math.max(size.floor, measured || (full ? 320 : 240));
  const HEIGHT = size.height;
  const MARGIN = size.margin;
  const [active, setActive] = useState<Mark | null>(null);

  const geometry = useMemo(
    () => chartGeometry({ plan, summary, timeline, today, width, size }),
    [plan, summary, timeline, today, width, size],
  );
  const { x, y } = geometry;
  const cancelledCount = cancellations.length;
  const marks = useMemo(() => orderedMarks(timeline, cancellations), [timeline, cancellations]);

  // Draw-on: the mastered line traces itself in once, when the chart is first laid out. Drawn at
  // once under reduce motion, and never again on a refetch.
  const undrawn = useSharedValue(full && !reduced ? 1 : 0);
  const drawn = useRef(false);
  useEffect(() => {
    if (!full || measured === 0 || drawn.current) return;
    drawn.current = true;
    undrawn.set(reduced ? 0 : withTiming(0, { duration: DRAW_MS }));
  }, [full, measured, reduced, undrawn]);
  const length = geometry.lineLength;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: undrawn.get() * length }));

  // The gestures are rebuilt on every render (GestureDetector picks up the new callbacks), so
  // `active` here is the mark showing now.
  function choose(next: Mark | null, viaScrub: boolean) {
    const changed = next?.kind !== active?.kind || next?.index !== active?.index;
    if (!changed) return;
    setActive(next);
    if (next && viaScrub) haptics.selection();
  }

  const pick = (px: number) => nearestMark(px, x, timeline, cancellations);
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const next = pick(event.x);
      if (next) haptics.selection();
      choose(next, false);
    });
  // Long-press first, so a vertical swipe over the chart still scrolls the page.
  const scrub = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(200)
    .onStart((event) => {
      haptics.impact();
      choose(pick(event.x), false);
    })
    .onUpdate((event) => {
      const next = pick(event.x);
      if (next) choose(next, true);
    });
  const gesture = Gesture.Exclusive(scrub, tap);

  const activePoint = active?.kind === 'lesson' ? timeline[active.index] : undefined;
  const activeCancellation = active?.kind === 'cancelled' ? cancellations[active.index] : undefined;
  const activeDay = activePoint?.occurred_on ?? activeCancellation?.occurs_on ?? null;

  const description =
    `Progress towards the goal: ${summary.percent}% of plan topics mastered, ` +
    `against ${summary.expected_percent}% expected by today.` +
    (cancelledCount > 0
      ? ` ${cancelledCount} ${cancelledCount === 1 ? 'lesson' : 'lessons'} cancelled.`
      : '');

  const svg = (
    <Svg width={width} height={HEIGHT}>
      {/* Recessive frame: hairline gridlines at the quarter marks. */}
      {full
        ? [0, 25, 50, 75, 100].map((percent) => (
            <G key={percent}>
              <Line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(percent)}
                y2={y(percent)}
                stroke={t.border}
                strokeWidth={1}
              />
              <SvgText
                x={MARGIN.left - 8}
                y={y(percent) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill={t.mutedForeground}
              >
                {`${percent}%`}
              </SvgText>
            </G>
          ))
        : null}

      {full
        ? geometry.ticks.map((day) => (
            <SvgText
              key={day}
              x={x(day)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              fontSize={10}
              fill={t.mutedForeground}
            >
              {monthLabel(day)}
            </SvgText>
          ))
        : null}

      {/* Start and goal: the two ends of the timeline, named. */}
      {full
        ? (
            [
              [geometry.start, 'Start', plan.starts_on],
              [geometry.goal, 'Goal', plan.target_on],
            ] as const
          ).map(([day, label, iso]) => (
            <G key={label}>
              <Line
                x1={x(day)}
                x2={x(day)}
                y1={MARGIN.top - 6}
                y2={y(0)}
                stroke={t.mutedForeground}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
              <SvgText
                x={x(day)}
                y={MARGIN.top - 12}
                textAnchor={label === 'Start' ? 'start' : 'end'}
                fontSize={10}
                fontWeight="500"
                fill={t.mutedForeground}
              >
                {`${label} · ${shortDay(iso)}`}
              </SvgText>
            </G>
          ))
        : null}

      {/* Planned pace: straight from nothing at the start to everything at the goal. */}
      <Line
        x1={geometry.pace.x1}
        y1={geometry.pace.y1}
        x2={geometry.pace.x2}
        y2={geometry.pace.y2}
        stroke={t.mutedForeground}
        strokeOpacity={0.6}
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      <Path d={geometry.area} fill={t.primary} fillOpacity={0.1} />
      {full ? (
        <AnimatedPath
          d={geometry.line}
          fill="none"
          stroke={t.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={[length, length]}
          animatedProps={lineProps}
        />
      ) : (
        <Path
          d={geometry.line}
          fill="none"
          stroke={t.primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Today, when it falls inside the timeline. */}
      {geometry.now >= geometry.start && geometry.now <= geometry.goal ? (
        <G>
          <Line
            x1={x(geometry.now)}
            x2={x(geometry.now)}
            y1={MARGIN.top}
            y2={y(0)}
            stroke={t.foreground}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          {full ? (
            <SvgText x={x(geometry.now) + 4} y={y(100) + 10} fontSize={10} fill={t.mutedForeground}>
              Today
            </SvgText>
          ) : null}
        </G>
      ) : null}

      {/* The one direct label: where the student is now -- lifted clear of a cancelled-lesson
          cross that sits just after today. */}
      {full ? (
        <SvgText
          x={geometry.endPoint[0] + 8}
          y={
            geometry.endPoint[1] +
            4 -
            (cancellations.some((row) => {
              const cx = x(toDay(row.occurs_on));
              return cx >= geometry.endPoint[0] - 4 && cx <= geometry.endPoint[0] + 36;
            }) && geometry.endPoint[1] > y(0) - 16
              ? 14
              : 0)
          }
          fontSize={11}
          fontWeight="600"
          fill={t.foreground}
        >
          {`${summary.percent}%`}
        </SvgText>
      ) : null}

      {activeDay ? (
        <Line
          x1={x(toDay(activeDay))}
          x2={x(toDay(activeDay))}
          y1={MARGIN.top}
          y2={y(0)}
          stroke={t.primary}
          strokeOpacity={0.5}
          strokeWidth={1}
        />
      ) : null}

      {timeline.map((point, index) => (
        <Circle
          key={point.session_id}
          cx={x(toDay(point.occurred_on))}
          cy={y(point.percent)}
          r={full ? (active?.kind === 'lesson' && active.index === index ? 6 : 4.5) : 2.5}
          fill={point.goal_rating ? ratingStyle(theme, point.goal_rating).backgroundColor : t.muted}
          stroke={t.card}
          strokeWidth={full ? 2 : 1}
        />
      ))}

      {/* Cancelled lessons: a cross on the baseline at the date, fainter while still ahead. Muted
          ink, not a series colour -- it marks an absence. */}
      {cancellations.map((row, index) => {
        const cx = x(toDay(row.occurs_on));
        const cy = y(0) - (full ? 6 : 3);
        const arm = full ? (active?.kind === 'cancelled' && active.index === index ? 5 : 4) : 2.5;
        return (
          <G
            key={`${row.schedule_id}-${row.occurs_on}`}
            stroke={t.mutedForeground}
            strokeOpacity={row.occurs_on >= today ? 0.5 : 0.95}
            strokeWidth={full ? 1.75 : 1.25}
            strokeLinecap="round"
          >
            <Line x1={cx - arm} y1={cy - arm} x2={cx + arm} y2={cy + arm} />
            <Line x1={cx - arm} y1={cy + arm} x2={cx + arm} y2={cy - arm} />
          </G>
        );
      })}
    </Svg>
  );

  if (!full) {
    return (
      <View
        onLayout={(event) => setMeasured(Math.round(event.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={description}
      >
        {svg}
      </View>
    );
  }

  // The screen reader steps through the marks with a swipe up or down, as a scrub would.
  function step(by: 1 | -1) {
    if (marks.length === 0) return;
    const at = active ? marks.findIndex((m) => m.kind === active.kind && m.index === active.index) : -1;
    const next =
      at === -1 ? (by === 1 ? 0 : marks.length - 1) : Math.min(marks.length - 1, Math.max(0, at + by));
    choose(marks[next]!, false);
  }
  const activeText = activePoint
    ? lessonLabel(activePoint)
    : activeCancellation
      ? cancellationLabel(activeCancellation)
      : 'Swipe up or down to step through the lessons.';

  return (
    <View style={{ gap: space.md }}>
      <View
        style={{ position: 'relative' }}
        onLayout={(event) => setMeasured(Math.round(event.nativeEvent.layout.width))}
      >
        <GestureDetector gesture={gesture}>
          <View
            testID="progress-chart"
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={description}
            accessibilityValue={{ text: activeText }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          >
            {svg}
          </View>
        </GestureDetector>
        {activePoint || activeCancellation ? (
          <ChartTooltip
            point={activePoint}
            cancellation={activeCancellation}
            today={today}
            anchorX={x(toDay(activeDay!))}
            anchorY={activePoint ? y(activePoint.percent) : y(0)}
            width={width}
          />
        ) : null}
      </View>
      <ChartLegend cancelled={cancelledCount > 0} />
    </View>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
        {label}
      </Text>
    </View>
  );
}

function ChartLegend({ cancelled }: { cancelled: boolean }) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const bar = (color: string, opacity = 1) => (
    <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: color, opacity }} />
  );
  return (
    <View
      testID="progress-chart-legend"
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 4 }}
    >
      <LegendItem swatch={bar(t.primary)} label="Topics mastered" />
      <LegendItem swatch={bar(t.mutedForeground, 0.6)} label="Planned pace" />
      <LegendItem
        swatch={
          <View style={{ flexDirection: 'row' }}>
            {([1, 3, 5] as const).map((rating, index) => (
              <View
                key={rating}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginLeft: index === 0 ? 0 : -2,
                  borderWidth: 1,
                  borderColor: t.card,
                  backgroundColor: ratingStyle(theme, rating).backgroundColor,
                }}
              />
            ))}
          </View>
        }
        label="Lesson, darker = bigger step towards the goal"
      />
      {cancelled ? (
        <LegendItem
          swatch={
            <Svg width={10} height={10}>
              <G stroke={t.mutedForeground} strokeWidth={1.75} strokeLinecap="round">
                <Line x1={1} y1={1} x2={9} y2={9} />
                <Line x1={1} y1={9} x2={9} y2={1} />
              </G>
            </Svg>
          }
          label="Cancelled lesson"
        />
      ) : null}
    </View>
  );
}

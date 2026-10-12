// Ported from apps/web/src/features/progress/progress-chart.tsx @ 1132322 (the two tooltips and
// the screen-reader sentences). A cancelled lesson's note and who cancelled it appear only when
// the server sent them (R11): to a reader outside the schedule's audience they are null.
import {
  GOAL_RATING_LABELS,
  SCHEDULE_CANCELLER_LABELS,
  formatClockTime,
  formatDuration,
  type ProgressCancellation,
  type ProgressPoint,
} from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { ratingStyle } from './rating';

function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Who called a lesson off: their name when the reader may know it, else the capacity. */
export function cancelledBy(row: Pick<ProgressCancellation, 'cancelled_by_name' | 'cancelled_as'>): string {
  return row.cancelled_by_name ?? SCHEDULE_CANCELLER_LABELS[row.cancelled_as];
}

/** How a lesson reads to a screen reader. */
export function lessonLabel(point: ProgressPoint): string {
  return (
    `${shortDay(point.occurred_on)} with ${point.tutor_name}: ` +
    (point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'not scored') +
    `, ${point.percent}% mastered after it`
  );
}

/** How a cancelled lesson reads to a screen reader. */
export function cancellationLabel(row: ProgressCancellation): string {
  return (
    `Cancelled lesson, ${shortDay(row.occurs_on)} with ${row.tutor_name}, by ${cancelledBy(row)}` +
    (row.note ? `: ${row.note}` : '')
  );
}

const WIDTH = 216;

export function ChartTooltip({
  point,
  cancellation,
  today,
  anchorX,
  anchorY,
  width,
}: {
  point?: ProgressPoint;
  cancellation?: ProgressCancellation;
  today: string;
  anchorX: number;
  anchorY: number;
  width: number;
}) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const left = Math.min(Math.max(0, anchorX - WIDTH / 2), Math.max(0, width - WIDTH));
  // Above the mark where there is room, else below it, so the finger never covers it.
  const above = anchorY > 110;
  const muted = { color: t.mutedForeground };

  return (
    <View
      testID="progress-chart-tooltip"
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left,
        ...(above ? { top: Math.max(0, anchorY - 104) } : { top: anchorY + 14 }),
        width: WIDTH,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.popover,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        shadowColor: t.foreground,
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      {point ? (
        <>
          <Text variant="titleSmall" style={{ color: t.popoverForeground, fontVariant: ['tabular-nums'] }}>
            {point.percent}% mastered
          </Text>
          <Text variant="bodySmall" style={muted}>
            {shortDay(point.occurred_on)} · {formatDuration(point.duration_minutes)} with {point.tutor_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: point.goal_rating
                  ? ratingStyle(theme, point.goal_rating).backgroundColor
                  : t.muted,
              }}
            />
            <Text variant="bodySmall" style={{ color: t.popoverForeground }}>
              {point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'Not scored against the goal'}
            </Text>
          </View>
          <Text variant="bodySmall" style={muted}>
            {point.topics_rated} {point.topics_rated === 1 ? 'topic' : 'topics'} rated
          </Text>
        </>
      ) : cancellation ? (
        <>
          <Text variant="titleSmall" style={{ color: t.popoverForeground }}>
            Cancelled{cancellation.occurs_on >= today ? ' · upcoming' : ''}
          </Text>
          <Text variant="bodySmall" style={muted}>
            {shortDay(cancellation.occurs_on)} · {formatClockTime(cancellation.start_time)} with{' '}
            {cancellation.tutor_name}
          </Text>
          <Text variant="bodySmall" style={muted}>
            By {cancelledBy(cancellation)}
          </Text>
          {cancellation.note ? (
            <Text variant="bodySmall" style={{ color: t.popoverForeground, marginTop: 4 }}>
              {cancellation.note}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

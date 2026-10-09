// Ported from apps/web/src/features/progress/student-progress-page.tsx (the "Lessons in this plan"
// table: LessonRow, CancelledLessonRow) @ 1132322 -- as rows, the table's columns stacked. It is
// the chart's text view: every value the chart plots, without a tap.
import { GOAL_RATING_LABELS, type ProgressCancellation, type ProgressPoint } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Divider, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { cancelledBy } from './chart-tooltip';
import { lessonRows, longDate } from './progress-model';
import { RatingChip } from './rating';

export function LessonList({
  timeline,
  cancellations,
  today,
}: {
  timeline: ProgressPoint[];
  cancellations: ProgressCancellation[];
  today: string;
}) {
  const rows = lessonRows(timeline, cancellations);
  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={row.kind === 'lesson' ? row.item.session_id : `${row.item.schedule_id}-${row.item.occurs_on}`}
        >
          {index > 0 ? <Divider /> : null}
          {row.kind === 'lesson' ? (
            <LessonRow point={row.item} />
          ) : (
            <CancelledLessonRow row={row.item} upcoming={row.item.occurs_on >= today} />
          )}
        </View>
      ))}
    </View>
  );
}

/** One lesson of the plan: when, with whom, how it moved them, and where it left them. */
function LessonRow({ point }: { point: ProgressPoint }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const rated = `${point.topics_rated} ${point.topics_rated === 1 ? 'topic' : 'topics'} rated`;
  return (
    <Pressable
      testID={`progress-lesson-${point.session_id}`}
      accessibilityRole="link"
      accessibilityLabel={
        `${longDate(point.occurred_on)} with ${point.tutor_name}. ` +
        `${point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'Not scored'}. ${rated}. ` +
        `${point.percent}% mastered after it. Open the lesson`
      }
      // The lesson in the Sessions list, on its Tutoring tab: no money.
      onPress={() => router.navigate({ pathname: '/sessions', params: { focus: point.session_id } })}
      style={({ pressed }) => ({
        minHeight: MIN_TARGET,
        paddingVertical: space.sm,
        gap: 4,
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
        borderRadius: radius.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <Text variant="labelLarge" style={{ flex: 1 }}>
          {longDate(point.occurred_on)}
          <Text variant="bodySmall" style={{ color: muted }}>
            {' '}
            · {point.tutor_name}
          </Text>
        </Text>
        <Text variant="labelMedium" style={{ fontVariant: ['tabular-nums'] }}>
          {point.percent}%
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <RatingChip rating={point.goal_rating} labels={GOAL_RATING_LABELS} size={20} />
        <Text variant="bodySmall" style={{ color: muted, flex: 1 }}>
          {point.goal_rating ? GOAL_RATING_LABELS[point.goal_rating] : 'Not scored'} · {rated}
        </Text>
        <Icon source="chevron-right" size={18} color={muted} />
      </View>
    </Pressable>
  );
}

/** A called-off lesson: when, with whom, and why if the reader may know (R11). */
function CancelledLessonRow({ row, upcoming }: { row: ProgressCancellation; upcoming: boolean }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <View
      testID={`progress-cancelled-${row.schedule_id}-${row.occurs_on}`}
      accessible
      accessibilityLabel={
        `Cancelled${upcoming ? ', upcoming' : ''}: ${longDate(row.occurs_on)} with ${row.tutor_name}, ` +
        `by ${cancelledBy(row)}${row.note ? `. ${row.note}` : ''}`
      }
      style={{ paddingVertical: space.sm, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
        <Text variant="labelLarge" style={{ color: muted, textDecorationLine: 'line-through' }}>
          {longDate(row.occurs_on)}
        </Text>
        <Text variant="bodySmall" style={{ color: muted }}>
          · {row.tutor_name}
        </Text>
        <Tag label="Cancelled" />
        {upcoming ? <Tag label="Upcoming" filled /> : null}
      </View>
      <Text variant="bodySmall" style={{ color: muted }}>
        by {cancelledBy(row)}
      </Text>
      {row.note ? (
        <Text testID={`progress-cancelled-note-${row.schedule_id}-${row.occurs_on}`} variant="bodySmall">
          {row.note}
        </Text>
      ) : null}
    </View>
  );
}

function Tag({ label, filled = false }: { label: string; filled?: boolean }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: filled ? 'transparent' : theme.colors.outline,
        backgroundColor: filled ? theme.tokens.secondary : 'transparent',
        paddingHorizontal: 6,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: filled ? theme.tokens.secondaryForeground : theme.tokens.mutedForeground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

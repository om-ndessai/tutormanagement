// Ported from apps/web/src/features/schedules/cancelled-lessons-panel.tsx @ 1132322.
//
// Lessons of the reader's schedules that were called off (Phase 24): the ones coming up first,
// then the last four weeks. For the Sessions tab's Tutoring half, beside the lessons that did
// happen -- a cancelled one is why a week has no entry in the log. Only the schedules the reader
// can list (R11), so only their own lessons or their family's; renders nothing when there are
// none. No money.
//
// On the phone it starts folded to one line ("Cancelled lessons · 2, 1 coming up"): above the list,
// a panel of rows pushed the lessons themselves off the first screen, and the lessons are what a
// tutor opens this tab for. A tap unfolds it.
import { formatClockTime, type ScheduleCancellation } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Divider, Icon, Text } from 'react-native-paper';

import { Tag } from '@/features/teaching/session-card';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { haptics } from '@/lib/haptics';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useScheduleCancellations } from './api';
import { cancelledByText, formatLessonDay, organizationToday, shiftDay } from './lesson-cancellation';
import { useConfirmRestore } from './use-restore-lesson';

const SHOWN = 8;

/** Upcoming cancellations soonest first, then the earlier ones latest first. */
export function orderCancellations(rows: ScheduleCancellation[], today: string): ScheduleCancellation[] {
  const upcoming = rows.filter((row) => row.occurs_on >= today);
  const earlier = rows.filter((row) => row.occurs_on < today).reverse();
  return [...upcoming, ...earlier];
}

export function CancelledLessonsPanel() {
  const theme = useAppTheme();
  const today = organizationToday(useOrgTimeZone());
  const { data } = useScheduleCancellations({ from: shiftDay(today, -28), limit: 100 });
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const confirmRestore = useConfirmRestore();

  const rows = data?.data ?? [];
  if (rows.length === 0) return null;

  const ordered = orderCancellations(rows, today);
  const comingUp = rows.filter((row) => row.occurs_on >= today).length;
  const summary = `${ordered.length} ${ordered.length === 1 ? 'lesson' : 'lessons'}${comingUp > 0 ? `, ${comingUp} coming up` : ''}`;
  const shown = expanded ? ordered : ordered.slice(0, SHOWN);

  return (
    <Card
      testID="cancelled-lessons-panel"
      mode="outlined"
      style={{ borderRadius: radius.lg, borderStyle: 'dashed' }}
    >
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm }}>
        <Pressable
          testID="cancelled-lessons-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Cancelled lessons: ${summary}. ${open ? 'Hide' : 'Show'}`}
          onPress={() => {
            haptics.selection();
            setOpen((was) => !was);
          }}
          style={{ minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.sm }}
        >
          <Icon source="calendar-remove-outline" size={18} color={theme.tokens.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text variant="titleSmall" accessibilityRole="header">
              Cancelled lessons
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                {'  '}
                {summary}
              </Text>
            </Text>
            {open ? (
              <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                Called off from the schedule, so not counted as missed
              </Text>
            ) : null}
          </View>
          <Icon
            source={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.tokens.mutedForeground}
          />
        </Pressable>

        {open
          ? shown.map((row, index) => (
              <View key={`${row.schedule_id}-${row.occurs_on}`}>
                {index > 0 ? <Divider /> : null}
                <CancelledRow
                  row={row}
                  upcoming={row.occurs_on >= today}
                  onRestore={
                    row.can_restore
                      ? () =>
                          confirmRestore({
                            scheduleId: row.schedule_id,
                            occursOn: row.occurs_on,
                            studentName: row.student_name,
                          })
                      : undefined
                  }
                />
              </View>
            ))
          : null}

        {open && ordered.length > SHOWN ? (
          <Button
            testID="cancelled-show-all"
            mode="text"
            compact
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setExpanded((open) => !open)}
          >
            {expanded ? 'Show fewer' : `Show all ${ordered.length}`}
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

function CancelledRow({
  row,
  upcoming,
  onRestore,
}: {
  row: ScheduleCancellation;
  upcoming: boolean;
  onRestore?: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const day = formatLessonDay(row.occurs_on);
  const key = `${row.schedule_id}-${row.occurs_on}`;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
      <Pressable
        testID={`cancelled-row-${key}`}
        accessibilityRole="link"
        // No label of its own: VoiceOver (and a test) reads the lines inside, note and all.
        accessibilityHint="Opens it in the schedule"
        onPress={() =>
          router.navigate({ pathname: '/schedule', params: { focus: row.schedule_id, on: row.occurs_on } })
        }
        style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Text variant="bodyMedium">
            <Text style={{ fontWeight: '600' }}>{row.student_name}</Text>
            <Text style={{ color: muted }}> with {row.tutor_name}</Text>
          </Text>
          {upcoming ? <Tag label="Upcoming" /> : null}
        </View>
        <Text variant="bodySmall" style={{ color: muted }}>
          <Text style={{ color: muted, textDecorationLine: 'line-through' }}>
            {day} · {formatClockTime(row.start_time)}–{formatClockTime(row.end_time)}
          </Text>{' '}
          · cancelled {cancelledByText(row.cancelled_by_name, row.cancelled_as)}
        </Text>
        {row.note ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            {row.note}
          </Text>
        ) : null}
      </Pressable>
      {onRestore ? (
        <Button
          testID={`cancelled-restore-${key}`}
          mode="text"
          compact
          icon="undo"
          accessibilityLabel={`Restore the lesson on ${day}`}
          onPress={onRestore}
        >
          Restore
        </Button>
      ) : null}
    </View>
  );
}

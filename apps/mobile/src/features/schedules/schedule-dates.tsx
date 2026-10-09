// Ported from apps/web/src/features/schedules/schedule-dates.tsx @ 1132322.
//
// One series' dates (Phase 24): what is coming, each one cancellable, with the ones already called
// off shown in place -- struck through, with who and why, and a way to put them back. Past
// cancellations follow, for the record. Every button here is one the API would honour for this
// reader: Cancel only when the list says they may cancel at all (`cancel_as`), Restore only on rows
// it marks `can_restore`.
import {
  formatClockTime,
  type ScheduleCancellation,
  type UpcomingSession,
  type VisibleSchedule,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Button, Divider, IconButton, Text } from 'react-native-paper';

import { Skeleton } from '@/components/skeleton';
import { Tag } from '@/features/teaching/session-card';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useScheduleCancellations, useScheduleOccurrences } from './api';
import { cancelledByText, formatLessonDay, organizationToday } from './lesson-cancellation';
import { useConfirmRestore } from './use-restore-lesson';

export function ScheduleDates({
  schedule,
  highlight,
}: {
  schedule: VisibleSchedule;
  /** A date to pick out, when a link names one. */
  highlight: string | null;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const today = organizationToday(useOrgTimeZone());
  const occurrences = useScheduleOccurrences(schedule.id, true);
  const cancellations = useScheduleCancellations({ schedule_id: schedule.id, limit: 50 });
  const confirmRestore = useConfirmRestore();

  const dates = occurrences.data?.pages.flatMap((page) => page.data) ?? [];
  const earlier = (cancellations.data?.data ?? [])
    .filter((row) => row.occurs_on < today)
    .reverse()
    .slice(0, 5);
  const mayCancel = schedule.cancel_as !== null && schedule.is_active;

  // A link can name a date several pages ahead (the sessions tab's panel links every cancelled
  // date here): keep paging until it is on screen.
  const lastLoaded = dates.at(-1)?.occurs_on;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = occurrences;
  useEffect(() => {
    if (
      highlight &&
      highlight >= today &&
      lastLoaded &&
      highlight > lastLoaded &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [highlight, today, lastLoaded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openCancel = (date: string | null) =>
    router.push({
      pathname: '/cancel-lesson',
      params: date ? { schedule: schedule.id, date } : { schedule: schedule.id },
    });
  const restore = (occursOn: string) =>
    confirmRestore({ scheduleId: schedule.id, occursOn, studentName: schedule.student_name });

  return (
    <View testID={`schedule-dates-${schedule.id}`} style={{ gap: space.xs }}>
      <Divider />
      <Text variant="labelSmall" style={{ color: muted, textTransform: 'uppercase', marginTop: space.sm }}>
        Coming dates
      </Text>

      {occurrences.isPending ? (
        <Skeleton width="100%" height={96} style={{ borderRadius: radius.md }} />
      ) : null}
      {!occurrences.isPending && dates.length === 0 ? (
        <Text variant="bodySmall" style={{ color: muted, paddingVertical: space.sm }}>
          No more lessons in this series.
        </Text>
      ) : null}

      {dates.map((date, index) => (
        <View key={date.occurs_on}>
          {index > 0 ? <Divider /> : null}
          <DateRow
            scheduleId={schedule.id}
            date={date}
            highlighted={date.occurs_on === highlight}
            onCancel={mayCancel ? () => openCancel(date.occurs_on) : undefined}
            onRestore={date.cancellation?.can_restore ? () => restore(date.occurs_on) : undefined}
          />
        </View>
      ))}

      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' }}
      >
        {occurrences.hasNextPage ? (
          <Button
            testID={`schedule-later-${schedule.id}`}
            mode="text"
            compact
            onPress={() => void occurrences.fetchNextPage()}
            loading={occurrences.isFetchingNextPage}
            disabled={occurrences.isFetchingNextPage}
          >
            Show later dates
          </Button>
        ) : (
          <View />
        )}
        {mayCancel ? (
          <Button
            testID={`schedule-cancel-other-${schedule.id}`}
            mode="text"
            compact
            icon="calendar-remove-outline"
            onPress={() => openCancel(null)}
          >
            Cancel another date…
          </Button>
        ) : null}
      </View>

      {earlier.length > 0 ? (
        <>
          <Text
            variant="labelSmall"
            style={{ color: muted, textTransform: 'uppercase', marginTop: space.sm }}
          >
            Earlier cancelled dates
          </Text>
          {earlier.map((row, index) => (
            <View key={row.occurs_on}>
              {index > 0 ? <Divider /> : null}
              <PastCancellationRow
                scheduleId={schedule.id}
                row={row}
                highlighted={row.occurs_on === highlight}
                onRestore={row.can_restore ? () => restore(row.occurs_on) : undefined}
              />
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function DateRow({
  scheduleId,
  date,
  highlighted,
  onCancel,
  onRestore,
}: {
  scheduleId: string;
  date: UpcomingSession;
  highlighted: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const cancelled = date.cancellation;
  const day = formatLessonDay(date.occurs_on);
  const key = `${scheduleId}-${date.occurs_on}`;

  return (
    <View
      testID={cancelled ? `schedule-cancelled-${key}` : `schedule-date-${key}`}
      style={{
        paddingVertical: space.xs,
        paddingHorizontal: highlighted ? space.sm : 0,
        marginHorizontal: highlighted ? -space.sm : 0,
        borderRadius: radius.md,
        backgroundColor: highlighted ? withAlpha(theme.colors.tertiaryContainer, 0.6) : 'transparent',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        <Text
          variant="bodyMedium"
          style={{
            width: 104,
            fontVariant: ['tabular-nums'],
            color: cancelled ? muted : theme.colors.onSurface,
            textDecorationLine: cancelled ? 'line-through' : 'none',
          }}
        >
          {day}
        </Text>
        <View
          style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
        >
          {cancelled ? (
            <>
              <Tag label="Cancelled" />
              <Text variant="bodySmall" style={{ color: muted }}>
                {cancelledByText(cancelled.cancelled_by_name, cancelled.cancelled_as)}
              </Text>
            </>
          ) : (
            <Text variant="bodySmall" style={{ color: muted, fontVariant: ['tabular-nums'] }}>
              {formatClockTime(date.start_time)}–{formatClockTime(date.end_time)}
            </Text>
          )}
        </View>
        {cancelled ? (
          onRestore ? (
            <Button
              testID={`schedule-restore-${key}`}
              mode="text"
              compact
              icon="undo"
              accessibilityLabel={`Restore the lesson on ${day}`}
              onPress={onRestore}
            >
              Restore
            </Button>
          ) : null
        ) : onCancel ? (
          <IconButton
            testID={`schedule-cancel-${key}`}
            icon="calendar-remove-outline"
            size={20}
            accessibilityLabel={`Cancel the lesson on ${day}`}
            onPress={onCancel}
            style={{ margin: 0 }}
          />
        ) : null}
      </View>
      {cancelled?.note ? (
        <Text variant="bodySmall" style={{ color: muted, paddingBottom: space.xs }}>
          {cancelled.note}
        </Text>
      ) : null}
    </View>
  );
}

function PastCancellationRow({
  scheduleId,
  row,
  highlighted,
  onRestore,
}: {
  scheduleId: string;
  row: ScheduleCancellation;
  highlighted: boolean;
  onRestore?: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const day = formatLessonDay(row.occurs_on);
  const key = `${scheduleId}-${row.occurs_on}`;

  return (
    <View
      testID={`schedule-earlier-${key}`}
      style={{
        paddingVertical: space.xs,
        paddingHorizontal: highlighted ? space.sm : 0,
        marginHorizontal: highlighted ? -space.sm : 0,
        borderRadius: radius.md,
        backgroundColor: highlighted ? withAlpha(theme.colors.tertiaryContainer, 0.6) : 'transparent',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        <Text
          variant="bodyMedium"
          style={{
            width: 104,
            color: muted,
            textDecorationLine: 'line-through',
            fontVariant: ['tabular-nums'],
          }}
        >
          {day}
        </Text>
        <Text variant="bodySmall" style={{ flex: 1, color: muted }}>
          {cancelledByText(row.cancelled_by_name, row.cancelled_as)}
        </Text>
        {onRestore ? (
          <Button
            testID={`schedule-restore-${key}`}
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
      {row.note ? (
        <Text variant="bodySmall" style={{ color: muted, paddingBottom: space.xs }}>
          {row.note}
        </Text>
      ) : null}
    </View>
  );
}

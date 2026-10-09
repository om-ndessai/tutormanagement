// Ported from apps/web/src/features/schedules/schedules-page.tsx @ 1132322.
//
// Standing weekly lessons, grouped by weekday so the week reads top to bottom, with a week strip
// above to narrow it to one day. Everyone who can see a schedule can add it to their calendar;
// only its tutor (or an admin) can change it; cancelling one date is for whoever the server says
// may (`cancel_as`), never a student. Nothing here is money.
import { DAYS_OF_WEEK, describeSchedule, weekdayOf, type VisibleSchedule } from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

import { FocusNotice } from '@/components/focus-notice';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { AccountButton } from '@/features/shell/account-button';
import { SearchButton } from '@/features/shell/search-button';
import { ApiRequestError } from '@/lib/api-client';
import { downloadAndShare } from '@/lib/download';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { calendarHref, useDeleteSchedule, useSchedules } from './api';
import { organizationToday } from './lesson-cancellation';
import { ScheduleCard } from './schedule-card';
import { WeekStrip } from './week-strip';

export function SchedulesScreen() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const muted = theme.tokens.mutedForeground;
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;
  const today = organizationToday(useOrgTimeZone());

  const { data, isPending, error, refetch } = useSchedules();
  const remove = useDeleteSchedule();
  const [showingDates, setShowingDates] = useState(new Set<string>());
  const [day, setDay] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** One slot, when a link names it -- the dashboard's carousel names one date of it too. */
  const params = useLocalSearchParams<{ focus?: string; on?: string }>();
  const focusId = params.focus || null;
  const focusDate = params.on || null;
  const all = data?.data ?? [];
  const focused = focusId ? all.filter((row) => row.id === focusId) : all;
  const clearFocus = () => router.setParams({ focus: undefined, on: undefined });

  const counts = DAYS_OF_WEEK.map((weekday) => all.filter((row) => row.day_of_week === weekday.value).length);
  // A day emptied since it was chosen (a schedule removed) shows the whole week again.
  const chosenDay = !focusId && day !== null && (counts[day] ?? 0) > 0 ? day : null;
  const schedules = chosenDay === null ? focused : focused.filter((row) => row.day_of_week === chosenDay);
  const byDay = DAYS_OF_WEEK.map((weekday) => ({
    day: weekday,
    items: schedules.filter((schedule) => schedule.day_of_week === weekday.value),
  })).filter((group) => group.items.length > 0);

  const mayCreate = isTutor || isAdmin;
  const openForm = (schedule?: VisibleSchedule) =>
    router.push(schedule ? { pathname: '/schedule-form', params: { id: schedule.id } } : '/schedule-form');

  async function download(key: string, path: string, fallback: string) {
    setDownloading(key);
    try {
      haptics.impact();
      await downloadAndShare(path, fallback);
    } catch (failure) {
      toast.error(failure instanceof ApiRequestError ? failure.message : 'Could not download the file.');
    } finally {
      setDownloading(null);
    }
  }

  function confirmRemove(schedule: VisibleSchedule) {
    haptics.warning();
    Alert.alert(
      'Remove this recurring session?',
      `${schedule.student_name}'s ${describeSchedule(schedule)} slot will no longer appear, and any of its lessons that were cancelled go with it — so they stop counting as cancelled in the student's progress. Sessions already taught are unaffected. To stop a series but keep its record, give it an end date instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            remove.mutate(schedule.id, {
              onSuccess: () => toast.success('Schedule removed.'),
              onError: (failure) =>
                toast.error(
                  failure instanceof ApiRequestError ? failure.message : 'Could not remove the schedule.',
                ),
            }),
        },
      ],
    );
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['schedules', 'upcoming'] })]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-schedule" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {mayCreate ? (
                <IconButton
                  testID="schedule-add"
                  icon="calendar-plus"
                  size={24}
                  accessibilityLabel="Schedule a session"
                  style={{ margin: 0 }}
                  onPress={() => openForm()}
                />
              ) : null}
              <SearchButton />
              <AccountButton />
            </View>
          ),
        }}
      />
      <Text variant="bodyMedium" style={{ color: muted }}>
        Standing weekly lessons. Add them to your calendar in one tap.
      </Text>
      {mayCreate || all.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {mayCreate ? (
            <Button
              testID="schedule-add-button"
              mode="contained"
              icon="calendar-plus"
              onPress={() => openForm()}
            >
              Schedule a session
            </Button>
          ) : null}
          {all.length > 0 ? (
            <Button
              testID="schedule-calendar-all"
              mode="outlined"
              icon="calendar-export"
              loading={downloading === 'all'}
              disabled={downloading !== null}
              onPress={() => void download('all', calendarHref.all(), 'schedule.ics')}
            >
              Add all to calendar
            </Button>
          ) : null}
        </View>
      ) : null}

      <FocusNotice
        active={Boolean(focusId)}
        found={focused.length > 0}
        what="scheduled session"
        onClear={clearFocus}
      />

      {!focusId && all.length > 0 ? (
        <WeekStrip counts={counts} todayWeekday={weekdayOf(today)} selected={chosenDay} onSelect={setDay} />
      ) : null}

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading the schedule"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={96} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}

      {!isPending && !error && all.length === 0 ? (
        <EmptyState
          testID="schedule-empty"
          icon="calendar-month-outline"
          title={
            mayCreate
              ? 'No recurring sessions scheduled yet.'
              : 'No recurring sessions have been scheduled for you.'
          }
        />
      ) : null}

      {byDay.map(({ day: weekday, items }) => (
        <View key={weekday.value} testID={`schedule-group-${weekday.value}`} style={{ gap: space.sm }}>
          <Text
            variant="labelMedium"
            accessibilityRole="header"
            style={{ color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            {weekday.label}
          </Text>
          {items.map((schedule) => {
            // Its dates open by themselves when a link points at this slot.
            const datesOpen = showingDates.has(schedule.id) || schedule.id === focusId;
            return (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                canEdit={isAdmin || schedule.tutor_user_id === user?.id}
                datesOpen={datesOpen}
                highlight={schedule.id === focusId ? focusDate : null}
                downloading={downloading !== null}
                onToggleDates={() => {
                  haptics.selection();
                  setShowingDates((current) => {
                    const next = new Set(current);
                    if (datesOpen) next.delete(schedule.id);
                    else next.add(schedule.id);
                    return next;
                  });
                }}
                onCalendar={() => void download(schedule.id, calendarHref.one(schedule.id), 'lesson.ics')}
                onEdit={() => openForm(schedule)}
                onRemove={() => confirmRemove(schedule)}
              />
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

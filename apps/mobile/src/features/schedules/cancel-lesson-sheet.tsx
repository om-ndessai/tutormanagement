// Ported from apps/web/src/features/schedules/lesson-cancellation.tsx @ 1132322 (CancelLessonDialog).
// The dialog becomes a form sheet, `(org)/cancel-lesson?schedule=<id>[&date=<YYYY-MM-DD>]`.
//
// Calls off one lesson of a series, with an optional note. Opened with a date from the list of
// coming dates, or without one to pick any date -- a later week, or (for the tutor and the office)
// one already past. Who may cancel, and which dates, is the server's: the sheet only narrows the
// picker to what it would accept and shows its refusal under the field.
import { describeSchedule, scheduleCancellationInputSchema, type VisibleSchedule } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { NoteField } from '@/features/teaching/session-notes';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCancelLesson, useSchedules } from './api';
import {
  cancelDateBounds,
  defaultCancelDate,
  formatLessonDay,
  organizationToday,
} from './lesson-cancellation';
import { useRestoreNow } from './use-restore-lesson';

function close() {
  if (router.canGoBack()) router.back();
}

export function CancelLessonSheet({
  scheduleId,
  date,
}: {
  scheduleId: string | undefined;
  date: string | undefined;
}) {
  const list = useSchedules();

  let body;
  if (list.isPending) body = <LoadingState label="Loading the schedule…" />;
  else if (list.isError) body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  else {
    const schedule = list.data.data.find((row) => row.id === scheduleId);
    if (!schedule) {
      body = <ErrorState error={new ApiRequestError(404, 'not_found', 'That schedule does not exist.')} />;
    } else if (schedule.cancel_as === null) {
      // A student has no capacity to cancel in; the API refuses them too.
      body = (
        <EmptyState icon="lock-outline" title="Only the tutor, a parent or the office can cancel a lesson." />
      );
    } else {
      body = (
        <CancelLessonForm
          key={`${schedule.id}-${date ?? ''}`}
          schedule={schedule}
          presetDate={date ?? null}
        />
      );
    }
  }

  return (
    <Screen testID="screen-cancel-lesson" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function CancelLessonForm({
  schedule,
  presetDate,
}: {
  schedule: VisibleSchedule;
  presetDate: string | null;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const muted = theme.tokens.mutedForeground;
  const isAdmin = user?.roles.includes('admin') ?? false;
  const today = organizationToday(useOrgTimeZone());
  const cancel = useCancelLesson();
  const restoreNow = useRestoreNow();

  const bounds = cancelDateBounds(schedule, isAdmin, today);
  const [date, setDate] = useState(presetDate ?? defaultCancelDate(schedule, today));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setErrors({});
    const input = { occurs_on: date, note: note.trim() || null };
    const parsed = scheduleCancellationInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    haptics.warning();
    try {
      await cancel.mutateAsync({ scheduleId: schedule.id, input });
      const target = { scheduleId: schedule.id, occursOn: date, studentName: schedule.student_name };
      // Undo puts it straight back; the server still decides whether this reader may.
      toast.success(`The ${formatLessonDay(date)} lesson is cancelled.`, {
        label: 'Undo',
        onPress: () => void restoreNow(target),
      });
      close();
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not cancel the lesson.');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {presetDate ? `Cancel the lesson on ${formatLessonDay(presetDate)}?` : 'Cancel a lesson'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {schedule.student_name} with {schedule.tutor_name}, {describeSchedule(schedule)}. Only this date is
          called off; the rest of the series is unchanged.
        </Text>
      </View>

      {!presetDate ? (
        <View style={{ gap: space.xs }}>
          <DateTimeField
            testID="cancel-date"
            mode="date"
            label="Date"
            value={date}
            onChange={setDate}
            minimumDate={bounds.min}
            maximumDate={bounds.max ?? undefined}
            error={Boolean(errors.occurs_on)}
          />
          <Text testID="cancel-date-hint" variant="bodySmall" style={{ color: muted }}>
            {bounds.hint}
          </Text>
        </View>
      ) : null}
      {errors.occurs_on ? (
        <HelperText type="error" padding="none">
          {errors.occurs_on}
        </HelperText>
      ) : null}

      <View style={{ gap: space.xs }}>
        <NoteField
          testID="cancel-note"
          label="Note"
          value={note}
          onChange={setNote}
          placeholder="Why, for the record: a holiday, a trip, illness…"
          error={errors.note}
        />
        <Text variant="bodySmall" style={{ color: muted }}>
          Optional. Seen by the tutor, the family and the office.
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <Button
          testID="cancel-submit"
          mode="contained"
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
          onPress={() => void handleSubmit()}
          loading={cancel.isPending}
          disabled={cancel.isPending}
        >
          Cancel lesson
        </Button>
        <Button testID="cancel-keep" mode="outlined" onPress={close} disabled={cancel.isPending}>
          Keep the lesson
        </Button>
      </View>
    </View>
  );
}

// Ported from apps/web/src/features/schedules/schedule-dialog.tsx @ 1132322.
// The dialog becomes a form sheet, `(org)/schedule-form` (`?id=<schedule>` to edit).
//
// A standing weekly lesson: which pairing, the weekday, the start and length, the mode, and the
// dates it runs between. An admin schedules any pairing; a tutor only their own. Editing is for an
// admin or the schedule's own tutor -- what the API allows.
import {
  DAYS_OF_WEEK,
  LOCATION_KIND_LABELS,
  SESSION_MODES,
  SESSION_MODE_LABELS,
  formatDuration,
  scheduleInputSchema,
  scheduleLocationProblem,
  scheduleUpdateSchema,
  type Location,
  type SessionMode,
  type VisibleSchedule,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { OfflineSaveNote, useOffline } from '@/components/connectivity';
import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { FieldError } from '@/components/field-error';
import { DateTimeField } from '@/components/date-time-field';
import { Choice, Field } from '@/components/form-choice';
import { OptionPicker } from '@/components/option-picker';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { useAssignments } from '@/features/teaching/api';
import { PairingPicker } from '@/features/teaching/session-form/pairing-picker';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { NoteField } from '@/features/teaching/session-notes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useCreateSchedule, useSchedules, useUpdateSchedule } from './api';
import { organizationToday, shiftDay } from './lesson-cancellation';
import {
  chosenScheduleLocations,
  defaultScheduleLocations,
  existingScheduleLocations,
  type ScheduleLocationChoice,
} from './schedule-locations';

/** Lesson lengths worth offering; anything else is an edge case. */
const DURATIONS = [30, 45, 60, 75, 90, 120];

function close() {
  if (router.canGoBack()) router.back();
}

export function ScheduleFormSheet({ scheduleId }: { scheduleId: string | undefined }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;
  const list = useSchedules();

  let body;
  if (!scheduleId) {
    body =
      isAdmin || isTutor ? (
        <ScheduleForm existing={null} />
      ) : (
        <EmptyState icon="lock-outline" title="Only a tutor or an admin can schedule a session." />
      );
  } else if (list.isPending) {
    body = <FormSkeleton label="Loading the schedule…" fields={6} />;
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  } else {
    const existing = list.data.data.find((row) => row.id === scheduleId);
    if (!existing) {
      body = <ErrorState error={new ApiRequestError(404, 'not_found', 'That schedule does not exist.')} />;
    } else if (!isAdmin && existing.tutor_user_id !== user?.id) {
      body = <EmptyState icon="lock-outline" title="Only its tutor or an admin can change this schedule." />;
    } else {
      body = <ScheduleForm key={existing.id} existing={existing} />;
    }
  }

  return (
    <Screen testID="screen-schedule-form" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function ScheduleForm({ existing }: { existing: VisibleSchedule | null }) {
  const theme = useAppTheme();
  const toast = useToast();
  const { user } = useAuth();
  const muted = theme.tokens.mutedForeground;
  const isEdit = existing !== null;
  const isAdmin = user?.roles.includes('admin') ?? false;
  const today = organizationToday(useOrgTimeZone());

  // An admin may schedule for anyone; a tutor only for their own students.
  const pairings = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const assignments = pairings.data?.data ?? [];

  const [assignmentId, setAssignmentId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(existing?.day_of_week ?? 2);
  const [startTime, setStartTime] = useState(existing?.start_time ?? '16:00');
  const [duration, setDuration] = useState(existing?.duration_minutes ?? 60);
  const [mode, setMode] = useState<SessionMode>(existing?.mode ?? 'in_person');
  const [startsOn, setStartsOn] = useState(existing?.starts_on ?? today);
  const [endsOn, setEndsOn] = useState(existing?.ends_on ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  // Phase 33: one in-person place and one online room, each optional, at least one in all.
  const [places, setPlaces] = useState<ScheduleLocationChoice>(() =>
    existing ? existingScheduleLocations(existing.locations) : { physicalId: '', virtualId: '' },
  );
  // Whether the places are the person's choice, rather than the pairing's default.
  const [placesTouched, setPlacesTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // With one pairing to choose from, it is chosen (once the list arrives).
  const [autoPicked, setAutoPicked] = useState(false);
  if (!isEdit && !autoPicked && pairings.isSuccess) {
    setAutoPicked(true);
    if (assignments.length === 1) setAssignmentId(assignments[0]!.id);
  }

  // The pairing whose locations this schedule may use: the chosen one, or the one being edited.
  const pairing = existing
    ? assignments.find(
        (candidate) =>
          candidate.tutor_user_id === existing.tutor_user_id &&
          candidate.student_user_id === existing.student_user_id,
      )
    : assignments.find((candidate) => candidate.id === assignmentId);
  const pairingLocations: Location[] = pairing?.locations ?? existing?.locations ?? [];

  // A new schedule takes the pairing's default places when a pairing is chosen (adjusting state
  // while rendering, as the auto-picked pairing above does), and again whenever it changes.
  const [defaultedFor, setDefaultedFor] = useState<string | null>(null);
  if (!isEdit && pairing && defaultedFor !== pairing.id) {
    setDefaultedFor(pairing.id);
    setPlaces(defaultScheduleLocations(pairing));
    setPlacesTouched(false);
  }
  const choosePlace = (next: Partial<ScheduleLocationChoice>) => {
    setPlaces((current) => ({ ...current, ...next }));
    setPlacesTouched(true);
  };

  // What was typed is not lost to a swipe or Back (ux-audit F-3); offline, Save waits (F-16).
  const dirty = useDirty({
    // The one pairing chosen for them as the sheet opened is not an edit.
    assignmentId: assignments.length === 1 && assignmentId === assignments[0]!.id ? '' : assignmentId,
    dayOfWeek,
    startTime,
    duration,
    mode,
    startsOn,
    endsOn,
    location,
    notes,
    // The default places that came with the pairing are not an edit.
    places: placesTouched ? places : null,
  });
  const { leave } = useUnsavedChangesGuard(dirty);
  const offline = useOffline();

  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const saving = create.isPending || update.isPending;
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  async function handleSave() {
    setErrors({});
    const assignment = assignments.find((candidate) => candidate.id === assignmentId);
    if (!isEdit && !assignment) {
      setErrors({ assignment: 'Choose which student this is for.' });
      haptics.error();
      return;
    }

    const chosen = chosenScheduleLocations(pairingLocations, places);
    const problem = scheduleLocationProblem(chosen);
    if (problem) {
      setErrors({ location_ids: problem });
      haptics.error();
      return;
    }

    const shared = {
      location_ids: chosen.map((place) => place.id),
      day_of_week: dayOfWeek,
      start_time: startTime,
      duration_minutes: duration,
      mode,
      starts_on: startsOn,
      ends_on: endsOn || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (isEdit) {
        const parsed = scheduleUpdateSchema.safeParse(shared);
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await update.mutateAsync({ id: existing.id, input: parsed.data });
        toast.success('Schedule updated.');
      } else {
        const parsed = scheduleInputSchema.safeParse({
          tutor_user_id: assignment!.tutor_user_id,
          student_user_id: assignment!.student_user_id,
          ...shared,
        });
        if (!parsed.success) {
          setErrors(issuesToErrors(parsed.error.issues));
          haptics.error();
          return;
        }
        await create.mutateAsync(parsed.data);
        toast.success('Session scheduled.');
      }
      leave(close);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the schedule.');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {isEdit ? 'Edit schedule' : 'Schedule a session'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {isEdit
            ? `${existing.tutor_name} with ${existing.student_name}, every week.`
            : 'A standing weekly lesson. Everyone involved can add it to their calendar.'}
        </Text>
      </View>

      {!isEdit ? (
        <View style={{ gap: space.xs }}>
          <PairingPicker
            testID="schedule-pairing"
            assignments={assignments}
            value={assignmentId}
            onChange={setAssignmentId}
            showTutor={isAdmin}
            error={errors.assignment ?? errors.student_user_id ?? errors.tutor_user_id}
          />
        </View>
      ) : null}

      <Field label="Every" error={errors.day_of_week}>
        <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="radiogroup">
          {DAYS_OF_WEEK.map((day) => (
            <Choice
              key={day.value}
              testID={`schedule-form-day-${day.value}`}
              label={day.short}
              accessibilityLabel={day.label}
              selected={dayOfWeek === day.value}
              onPress={() => setDayOfWeek(day.value)}
            />
          ))}
        </View>
      </Field>

      <View style={{ gap: space.xs }}>
        <DateTimeField
          testID="schedule-form-time"
          mode="time"
          label="At"
          value={startTime}
          onChange={setStartTime}
          error={Boolean(errors.start_time)}
        />
        {errors.start_time ? <FieldError>{errors.start_time}</FieldError> : null}
      </View>

      <Field label="For" error={errors.duration_minutes}>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
          accessibilityRole="radiogroup"
        >
          {durations.map((minutes) => (
            <Choice
              key={minutes}
              testID={`schedule-form-length-${minutes}`}
              label={formatDuration(minutes)}
              selected={duration === minutes}
              onPress={() => setDuration(minutes)}
              wide
            />
          ))}
        </View>
      </Field>

      <Field label="Mode">
        <SegmentedButtons
          value={mode}
          onValueChange={(value) => {
            haptics.selection();
            setMode(value as SessionMode);
          }}
          buttons={SESSION_MODES.map((value) => ({
            value,
            label: SESSION_MODE_LABELS[value],
            testID: `schedule-form-mode-${value}`,
          }))}
        />
      </Field>

      <View style={{ gap: space.xs }}>
        <DateTimeField
          testID="schedule-form-starts"
          mode="date"
          label="Starting"
          value={startsOn}
          onChange={(value) => {
            setStartsOn(value);
            if (endsOn && endsOn < value) setEndsOn(value);
          }}
          error={Boolean(errors.starts_on)}
        />
        {errors.starts_on ? <FieldError>{errors.starts_on}</FieldError> : null}
        {endsOn ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                testID="schedule-form-ends"
                mode="date"
                label="Until"
                value={endsOn}
                onChange={setEndsOn}
                minimumDate={startsOn}
                error={Boolean(errors.ends_on)}
              />
            </View>
            <Button testID="schedule-form-ends-clear" mode="text" compact onPress={() => setEndsOn('')}>
              No end
            </Button>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="bodySmall" style={{ color: muted }}>
              Runs indefinitely.
            </Text>
            <Button
              testID="schedule-form-ends-add"
              mode="text"
              compact
              icon="calendar-end"
              onPress={() => setEndsOn(shiftDay(startsOn > today ? startsOn : today, 7 * 12))}
            >
              Add an end date
            </Button>
          </View>
        )}
        {errors.ends_on ? <FieldError>{errors.ends_on}</FieldError> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <PlacePicker
          kind="physical"
          offered={pairingLocations}
          value={places.physicalId}
          onChange={(id) => choosePlace({ physicalId: id })}
        />
        <PlacePicker
          kind="virtual"
          offered={pairingLocations}
          value={places.virtualId}
          onChange={(id) => choosePlace({ virtualId: id })}
        />
        {errors.location_ids ? (
          <FieldError>{errors.location_ids}</FieldError>
        ) : (
          <Text testID="schedule-locations-hint" variant="bodySmall" style={{ color: muted }}>
            {pairing && pairingLocations.length === 0
              ? 'This pairing has no locations yet. An admin adds them on the Pairings page.'
              : 'At least one, and at most one of each.'}
          </Text>
        )}
      </View>

      <View>
        <TextInput
          testID="schedule-form-location"
          mode="outlined"
          label={mode === 'virtual' ? 'Meeting link note (optional)' : 'Room or note (optional)'}
          value={location}
          onChangeText={setLocation}
          placeholder={mode === 'virtual' ? 'https://meet.example.com/…' : 'Room 2'}
          autoCapitalize={mode === 'virtual' ? 'none' : 'sentences'}
          keyboardType={mode === 'virtual' ? 'url' : 'default'}
          returnKeyType="done"
          error={Boolean(errors.location)}
        />
        {errors.location ? <FieldError>{errors.location}</FieldError> : null}
      </View>

      <NoteField
        testID="schedule-form-notes"
        label="Notes (optional)"
        value={notes}
        onChange={setNotes}
        placeholder="Exam prep, weekly slot…"
        error={errors.notes}
      />
      {errors.form ? <FieldError>{errors.form}</FieldError> : null}

      <View style={{ gap: space.sm }}>
        <Button
          testID="schedule-form-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={saving || offline}
        >
          {isEdit ? 'Save changes' : 'Schedule'}
        </Button>
        <OfflineSaveNote offline={offline} />
        <Button testID="schedule-form-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

const NONE = 'none';

/** One kind of place for a schedule: none, or one of the pairing's. */
function PlacePicker({
  kind,
  offered,
  value,
  onChange,
}: {
  kind: Location['kind'];
  offered: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options = offered.filter((place) => place.kind === kind);
  return (
    <OptionPicker
      testID={`schedule-location-${kind}`}
      label={LOCATION_KIND_LABELS[kind]}
      placeholder="None"
      options={[
        { id: NONE, label: 'None' },
        ...options.map((place) => ({ id: place.id, label: place.name, detail: place.owner_name })),
      ]}
      value={value || NONE}
      onChange={(id) => onChange(id === NONE ? '' : id)}
    />
  );
}

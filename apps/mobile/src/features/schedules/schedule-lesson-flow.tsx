// Schedule a lesson as a step flow (UI upgrades U5; docs/ui-upgrades-spec.md, build log #50):
// Who -> When -> From when -> Where -> Review, the Review said as a sentence ("Every Monday,
// 4:00–5:00 PM, at Institute, room 2, starting Oct 19."). Opened by the create button, Schedule's
// own button and the carousel's "Nothing scheduled". Editing a schedule stays the sheet
// (`/schedule-form?id=`): a correction is one field, and the sheet shows them all at once.
//
// The same request as the sheet (`scheduleInputSchema`, `scheduleLocationProblem`), from the same
// pairings: an admin schedules any pairing, a tutor only their own. The place is chosen from the
// pairing's locations, at most one in person and one online; with both, the lesson's usual mode is
// asked, otherwise it follows the place. No money anywhere in it. No toast while the flow is up (U3):
// a refusal is said in the footer, and "Session scheduled." once the flow has gone.
import {
  DAYS_OF_WEEK,
  LOCATION_KIND_LABELS,
  formatDuration,
  formatTimeRange,
  parseClockTime,
  scheduleInputSchema,
  scheduleLocationProblem,
  type Assignment,
  type Location,
  type SessionMode,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/date-time-field';
import { FieldError } from '@/components/field-error';
import { Choice, Field } from '@/components/form-choice';
import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { SearchPicker } from '@/components/search-picker';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { StepFlow, type StepDef } from '@/components/step-flow';
import { useToast } from '@/components/toast';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { useAssignments } from '@/features/teaching/api';
import { studentItems } from '@/features/teaching/session-form/record-lesson-flow';
import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { NoteField } from '@/features/teaching/session-notes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCreateSchedule } from './api';
import { organizationToday, shiftDay } from './lesson-cancellation';
import { chosenScheduleLocations, defaultScheduleLocations, type ScheduleLocationChoice } from './schedule-locations';
import { scheduleSentence, shortDate } from './schedule-sentence';

/** Lesson lengths worth offering, as the sheet. */
export const SCHEDULE_LENGTHS = [30, 45, 60, 75, 90, 120] as const;

/** The server's field names each step owns: a refusal naming one opens that step. */
export const SCHEDULE_STEP_FIELDS = {
  who: ['assignment', 'student_user_id', 'tutor_user_id'],
  when: ['day_of_week', 'start_time', 'duration_minutes'],
  dates: ['starts_on', 'ends_on', 'notes'],
  where: ['location_ids', 'mode', 'location'],
} as const;

export const CHOOSE_PAIRING = 'Choose which student this is for.';

/** The usual mode in the places' own words: "In person" or "Online". */
const USUAL_LABELS: Record<SessionMode, string> = {
  in_person: LOCATION_KIND_LABELS.physical,
  virtual: LOCATION_KIND_LABELS.virtual,
};

export interface ScheduleDraft {
  assignmentId: string;
  dayOfWeek: number;
  startTime: string;
  duration: number;
  startsOn: string;
  endsOn: string;
  notes: string;
  places: ScheduleLocationChoice;
  /** The usual mode when both an in-person place and an online room are chosen. */
  usual: SessionMode;
}

/** The lesson's mode: the place's kind, or the usual one when there are both. */
export function scheduleMode(places: readonly Pick<Location, 'kind'>[], usual: SessionMode): SessionMode {
  const physical = places.some((place) => place.kind === 'physical');
  const virtual = places.some((place) => place.kind === 'virtual');
  if (physical && virtual) return usual;
  return virtual ? 'virtual' : 'in_person';
}

/** Chooses a place, or unchooses it: at most one of each kind, so a second of a kind replaces the first. */
export function togglePlace(choice: ScheduleLocationChoice, place: Pick<Location, 'id' | 'kind'>): ScheduleLocationChoice {
  const key = place.kind === 'virtual' ? 'virtualId' : 'physicalId';
  return { ...choice, [key]: choice[key] === place.id ? '' : place.id };
}

function close() {
  if (router.canGoBack()) router.back();
}

/** The route's body: waits for the reader's pairings, then starts the flow from them once. */
export function ScheduleLessonFlow() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;
  // An admin may schedule for anyone; a tutor only for their own students.
  const pairings = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });

  if (!isAdmin && !isTutor) {
    return (
      <FlowFrame>
        <EmptyState icon="lock-outline" title="Only a tutor or an admin can schedule a session." />
      </FlowFrame>
    );
  }
  if (pairings.isPending) {
    return (
      <FlowFrame>
        <FormSkeleton label="Loading…" fields={4} />
      </FlowFrame>
    );
  }
  if (pairings.isError) {
    return (
      <FlowFrame>
        <ErrorState error={pairings.error} onRetry={() => void pairings.refetch()} />
      </FlowFrame>
    );
  }
  return <ScheduleSteps assignments={pairings.data?.data ?? []} isAdmin={isAdmin} />;
}

/** The flow's frame before it can start: a close button over the loading or error state. */
function FlowFrame({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="schedule-lesson-loading"
      style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}
    >
      <View style={{ paddingHorizontal: space.sm, minHeight: 48, justifyContent: 'center' }}>
        <IconButton testID="step-flow-close" icon="close" accessibilityLabel="Close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}>{children}</ScrollView>
    </View>
  );
}

function ScheduleSteps({ assignments, isAdmin }: { assignments: Assignment[]; isAdmin: boolean }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const today = organizationToday(useOrgTimeZone());
  const create = useCreateSchedule();

  // With one pairing to choose from, it is chosen, with its default places.
  const only = assignments.length === 1 ? assignments[0]! : null;
  const [draft, setDraft] = useState<ScheduleDraft>(() => ({
    assignmentId: only?.id ?? '',
    dayOfWeek: 2,
    startTime: '16:00',
    duration: 60,
    startsOn: today,
    endsOn: '',
    notes: '',
    places: only ? defaultScheduleLocations(only) : { physicalId: '', virtualId: '' },
    usual: 'in_person',
  }));
  const set = <K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  // Anything chosen or typed beyond how the flow opened is work a Close would lose.
  const dirty = useDirty(draft);

  const [serverErrors, setServerErrors] = useState<Record<string, string> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const pairing = assignments.find((candidate) => candidate.id === draft.assignmentId) ?? null;
  const offered: Location[] = pairing?.locations ?? [];
  const chosen = chosenScheduleLocations(offered, draft.places);
  const mode = scheduleMode(chosen, draft.usual);
  const items = useMemo(() => studentItems(assignments, isAdmin), [assignments, isAdmin]);

  function choosePairing(id: string) {
    const next = assignments.find((candidate) => candidate.id === id);
    if (!next) return;
    // A new pairing brings its own default places: the old ones are not its to use.
    setDraft((previous) =>
      previous.assignmentId === id
        ? previous
        : { ...previous, assignmentId: id, places: defaultScheduleLocations(next) },
    );
  }

  const sentence = scheduleSentence({
    dayOfWeek: draft.dayOfWeek,
    startTime: draft.startTime,
    durationMinutes: draft.duration,
    mode,
    places: chosen,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn || null,
    today,
  });
  const start = parseClockTime(draft.startTime) ?? 0;
  const day = DAYS_OF_WEEK[draft.dayOfWeek]?.label ?? '';
  const durations: number[] = (SCHEDULE_LENGTHS as readonly number[]).includes(draft.duration)
    ? [...SCHEDULE_LENGTHS]
    : [...SCHEDULE_LENGTHS, draft.duration].sort((a, b) => a - b);

  const steps: StepDef<ScheduleDraft>[] = [
    {
      key: 'who',
      title: 'Who is the lesson with?',
      description: isAdmin ? 'A student and their tutor: one of the pairings.' : 'One of your students.',
      fields: SCHEDULE_STEP_FIELDS.who,
      scroll: false,
      validate: (current) => (current.assignmentId ? null : { assignment: CHOOSE_PAIRING }),
      render: ({ errors }) => (
        <View style={{ flex: 1, gap: space.sm }}>
          <SearchPicker
            testID="schedule-pairing"
            label="Students"
            placeholder={isAdmin ? 'Search students or tutors' : 'Search your students'}
            items={items}
            value={draft.assignmentId || null}
            onChange={choosePairing}
            emptyTitle={assignments.length === 0 ? 'No students to schedule yet' : 'No one by that name'}
            emptyBody={
              assignments.length === 0
                ? 'A lesson is scheduled for a student and tutor who are paired. An admin pairs them.'
                : 'Try part of their first or last name.'
            }
            style={{ flex: 1 }}
          />
          {(errors.assignment ?? errors.student_user_id ?? errors.tutor_user_id) ? (
            <FieldError testID="schedule-pairing-error">
              {errors.assignment ?? errors.student_user_id ?? errors.tutor_user_id}
            </FieldError>
          ) : null}
        </View>
      ),
      summary: () =>
        pairing ? (isAdmin ? `${pairing.student_name} with ${pairing.tutor_name}` : pairing.student_name) : null,
    },
    {
      key: 'when',
      title: 'When is it?',
      description: 'The day each week, the time it starts and how long it runs.',
      fields: SCHEDULE_STEP_FIELDS.when,
      render: ({ errors }) => (
        <>
          <Field label="Every" error={errors.day_of_week}>
            <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="radiogroup">
              {DAYS_OF_WEEK.map((weekday) => (
                <Choice
                  key={weekday.value}
                  testID={`schedule-form-day-${weekday.value}`}
                  label={weekday.short}
                  accessibilityLabel={weekday.label}
                  selected={draft.dayOfWeek === weekday.value}
                  onPress={() => set('dayOfWeek', weekday.value)}
                />
              ))}
            </View>
          </Field>
          <View style={{ gap: space.xs }}>
            <DateTimeField
              testID="schedule-form-time"
              mode="time"
              label="Starts at"
              value={draft.startTime}
              onChange={(value) => set('startTime', value)}
              error={Boolean(errors.start_time)}
            />
            {errors.start_time ? <FieldError>{errors.start_time}</FieldError> : null}
          </View>
          <Field label="For" error={errors.duration_minutes}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }} accessibilityRole="radiogroup">
              {durations.map((minutes) => (
                <Choice
                  key={minutes}
                  testID={`schedule-form-length-${minutes}`}
                  label={formatDuration(minutes)}
                  selected={draft.duration === minutes}
                  onPress={() => set('duration', minutes)}
                  wide
                />
              ))}
            </View>
          </Field>
          <Text testID="schedule-when-line" variant="bodyMedium" style={{ color: muted }}>
            {`${day}s, ${formatTimeRange(start, start + draft.duration)}`}
          </Text>
        </>
      ),
      summary: () => `${day}s, ${formatTimeRange(start, start + draft.duration)} · ${formatDuration(draft.duration)}`,
    },
    {
      key: 'dates',
      title: 'From when?',
      description: 'The first week it runs, and an end date if it has one.',
      fields: SCHEDULE_STEP_FIELDS.dates,
      validate: (current) =>
        current.endsOn && current.endsOn < current.startsOn
          ? { ends_on: 'The end date cannot be before the start date.' }
          : null,
      render: ({ errors }) => (
        <>
          <View style={{ gap: space.xs }}>
            <DateTimeField
              testID="schedule-form-starts"
              mode="date"
              label="Starting"
              value={draft.startsOn}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  startsOn: value,
                  endsOn: previous.endsOn && previous.endsOn < value ? value : previous.endsOn,
                }))
              }
              error={Boolean(errors.starts_on)}
            />
            {errors.starts_on ? <FieldError>{errors.starts_on}</FieldError> : null}
          </View>
          {draft.endsOn ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <DateTimeField
                  testID="schedule-form-ends"
                  mode="date"
                  label="Until"
                  value={draft.endsOn}
                  onChange={(value) => set('endsOn', value)}
                  minimumDate={draft.startsOn}
                  error={Boolean(errors.ends_on)}
                />
              </View>
              <Button
                testID="schedule-form-ends-clear"
                mode="text"
                compact
                onPress={() => set('endsOn', '')}
                contentStyle={{ minHeight: MIN_TARGET }}
              >
                No end
              </Button>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="bodyMedium" style={{ color: muted }}>
                Runs every week until it is removed.
              </Text>
              <Button
                testID="schedule-form-ends-add"
                mode="text"
                compact
                icon="calendar-end"
                contentStyle={{ minHeight: MIN_TARGET }}
                onPress={() =>
                  set('endsOn', shiftDay(draft.startsOn > today ? draft.startsOn : today, 7 * 12))
                }
              >
                Add an end
              </Button>
            </View>
          )}
          {errors.ends_on ? <FieldError>{errors.ends_on}</FieldError> : null}
          <NoteField
            testID="schedule-form-notes"
            label="Note (optional)"
            value={draft.notes}
            onChange={(value) => set('notes', value)}
            placeholder="Exam prep, weekly slot…"
            error={errors.notes}
          />
        </>
      ),
      summary: () => {
        const thisYear = today.slice(0, 4);
        const range = draft.endsOn
          ? `From ${shortDate(draft.startsOn, thisYear)} until ${shortDate(draft.endsOn, thisYear)}`
          : `From ${shortDate(draft.startsOn, thisYear)}, every week`;
        return draft.notes.trim() ? `${range}\n${draft.notes.trim()}` : range;
      },
    },
    {
      key: 'where',
      title: 'Where is it?',
      description: 'One of the places this pairing may use: in person, online, or one of each.',
      fields: SCHEDULE_STEP_FIELDS.where,
      validate: () => {
        const problem = scheduleLocationProblem(chosen);
        return problem ? { location_ids: problem } : null;
      },
      render: ({ errors }) => (
        <WhereStep
          offered={offered}
          places={draft.places}
          usual={draft.usual}
          onToggle={(place) => set('places', togglePlace(draft.places, place))}
          onUsual={(value) => set('usual', value)}
          error={errors.location_ids ?? errors.mode ?? errors.location}
        />
      ),
      summary: () =>
        chosen.length > 0 ? (
          <View style={{ gap: 2 }}>
            {chosen.map((place) => (
              <Text key={place.id} variant="bodyMedium">
                {`${LOCATION_KIND_LABELS[place.kind]}: ${place.name}`}
              </Text>
            ))}
            {chosen.length > 1 ? (
              <Text variant="bodyMedium" style={{ color: muted }}>
                {`Usually ${USUAL_LABELS[mode].toLowerCase()}`}
              </Text>
            ) : null}
          </View>
        ) : null,
    },
  ];

  async function submit({ leave }: { leave: (close?: () => void) => void }) {
    setServerErrors(null);
    setFailure(null);
    const parsed = scheduleInputSchema.safeParse({
      tutor_user_id: pairing?.tutor_user_id,
      student_user_id: pairing?.student_user_id,
      day_of_week: draft.dayOfWeek,
      start_time: draft.startTime,
      duration_minutes: draft.duration,
      mode,
      starts_on: draft.startsOn,
      ends_on: draft.endsOn || null,
      notes: draft.notes.trim() || null,
      location_ids: chosen.map((place) => place.id),
    });
    if (!parsed.success) {
      setServerErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      haptics.success();
      leave(close);
      toast.success('Session scheduled.');
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setServerErrors(error.fieldErrors);
        setFailure(error.message);
        return;
      }
      setFailure('Could not save the schedule.');
    }
  }

  return (
    <StepFlow
      title="Schedule a lesson"
      steps={steps}
      draft={draft}
      review={{
        title: 'Does this look right?',
        description: 'Everyone involved can add it to their calendar once it is scheduled.',
        lead: () => (
          <View
            testID="schedule-review-sentence"
            accessible
            accessibilityLabel={sentence}
            style={{
              backgroundColor: theme.tokens.highlightSoft,
              borderRadius: radius.lg,
              padding: space.lg,
              flexDirection: 'row',
              gap: space.md,
              alignItems: 'flex-start',
            }}
          >
            <Icon source="calendar-sync-outline" size={24} color={theme.tokens.highlightSoftForeground} />
            <Text variant="titleMedium" style={{ flex: 1, color: theme.tokens.highlightSoftForeground }}>
              {sentence}
            </Text>
          </View>
        ),
      }}
      submitLabel="Schedule"
      submitting={create.isPending}
      fieldErrors={serverErrors}
      formError={failure}
      dirty={dirty}
      onSubmit={submit}
    />
  );
}

/** The pairing's places as cards, in person and online, one of each kind at most. */
function WhereStep({
  offered,
  places,
  usual,
  onToggle,
  onUsual,
  error,
}: {
  offered: Location[];
  places: ScheduleLocationChoice;
  usual: SessionMode;
  onToggle: (place: Location) => void;
  onUsual: (mode: SessionMode) => void;
  error?: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const both = Boolean(places.physicalId && places.virtualId);

  if (offered.length === 0) {
    return (
      <View style={{ gap: space.sm }}>
        <Text testID="schedule-locations-hint" variant="bodyMedium" style={{ color: muted }}>
          This pairing has no locations yet. An admin adds them on the Pairings page.
        </Text>
        {error ? <FieldError testID="schedule-locations-error">{error}</FieldError> : null}
      </View>
    );
  }

  return (
    <>
      {(['physical', 'virtual'] as const).map((kind) => {
        const ofKind = offered.filter((place) => place.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <View key={kind} style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={LOCATION_KIND_LABELS[kind]}>
            <Text variant="titleSmall" accessibilityRole="header">
              {LOCATION_KIND_LABELS[kind]}
            </Text>
            {ofKind.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                selected={place.id === places.physicalId || place.id === places.virtualId}
                onPress={() => onToggle(place)}
              />
            ))}
          </View>
        );
      })}
      {both ? (
        <Field label="Usually">
          <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
            {(['in_person', 'virtual'] as const).map((value) => (
              <Choice
                key={value}
                testID={`schedule-usual-${value}`}
                label={USUAL_LABELS[value]}
                selected={usual === value}
                onPress={() => onUsual(value)}
              />
            ))}
          </View>
        </Field>
      ) : null}
      {error ? (
        <FieldError testID="schedule-locations-error">{error}</FieldError>
      ) : (
        <Text testID="schedule-locations-hint" variant="bodyMedium" style={{ color: muted }}>
          At least one, and at most one of each. Tap a chosen place to take it off.
        </Text>
      )}
    </>
  );
}

function PlaceCard({ place, selected, onPress }: { place: Location; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  return (
    <OutlinedCard
      style={
        selected
          ? { borderColor: theme.colors.primary, backgroundColor: withAlpha(theme.colors.primary, 0.08) }
          : undefined
      }
    >
      <Pressable
        testID={`schedule-place-${place.id}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${LOCATION_KIND_LABELS[place.kind]}: ${place.name}, ${place.owner_name}’s`}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
          minHeight: 56,
          borderRadius: radius.md,
        }}
      >
        <Icon
          source={place.kind === 'virtual' ? 'video-outline' : 'map-marker-outline'}
          size={24}
          color={selected ? theme.colors.primary : muted}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
            {place.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: muted }}>
            {`${place.owner_name}’s`}
          </Text>
        </View>
        <Icon
          source={selected ? 'check-circle' : 'checkbox-blank-circle-outline'}
          size={24}
          color={selected ? theme.colors.primary : muted}
        />
      </Pressable>
    </OutlinedCard>
  );
}

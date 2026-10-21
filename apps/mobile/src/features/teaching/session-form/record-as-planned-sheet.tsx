// Record the lesson at hand from Home's Next up card (UI upgrades U4; #43 before it), or a finished
// one from the tutor's Now card (Phase 43, with the homework set last time in Homework review): a
// quick sheet already filled with the student, the day, the scheduled times and the place. "It ran as planned"
// records it in one tap; "Different times" opens the two time fields first. Once recorded, the
// sheet offers "Write up the lesson", which opens the write-up cards for that new lesson.
//
// Tutoring: no money anywhere (the length only). The place is shown, not sent -- a lesson on the
// record has a mode, not a location. The record is the ordinary `POST /sessions`; the write-up that
// follows is an edit of a lesson on the record, so it is never a draft.
import {
  SESSION_MODE_LABELS,
  formatDuration,
  sessionInputSchema,
  type Assignment,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useOffline } from '@/components/connectivity';
import { DateTimeField } from '@/components/date-time-field';
import { DictationField } from '@/features/dictation/dictation-field';
import { FieldError } from '@/components/field-error';
import { OutlinedCard } from '@/components/outlined-card';
import { QuickSheet } from '@/components/quick-sheet';
import { FormSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/state-views';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAssignments, useRecordSession } from '../api';
import { formatSessionDay, formatSessionTimes } from '../session-format';
import { organizationToday } from '../session-ranges';
import { previewFigures } from './session-money-preview';
import { formBody, issuesToErrors, prefilledForm, type RecordPrefill } from './use-session-form';
import { PART_MAX } from './use-session-write-up';

function close() {
  if (router.canGoBack()) router.back();
}

/** A centred body for the states before the sheet can offer anything. */
function SheetState({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <ScrollView
      testID="record-quick"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: space.lg, paddingTop: space.xl }}
    >
      {children}
    </ScrollView>
  );
}

export function RecordAsPlannedSheet({ prefill, place }: { prefill: RecordPrefill; place?: string }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const assignments = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const [recorded, setRecorded] = useState<TutoringSession | null>(null);

  if (recorded) return <RecordedSheet session={recorded} />;
  if (assignments.isPending) {
    return (
      <SheetState>
        <FormSkeleton label="Loading…" fields={2} />
      </SheetState>
    );
  }
  if (assignments.isError) {
    return (
      <SheetState>
        <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
      </SheetState>
    );
  }
  const list = assignments.data?.data ?? [];
  const match = list.find(
    (a) => a.student_user_id === prefill.student && (!prefill.tutor || a.tutor_user_id === prefill.tutor),
  );
  if (!match) {
    return (
      <SheetState>
        <EmptyState
          icon="account-question-outline"
          title="This lesson is not one of yours to record."
          body="Only the lesson's tutor records it."
          action={
            <Button mode="outlined" onPress={close}>
              Close
            </Button>
          }
        />
      </SheetState>
    );
  }
  return (
    <AsPlanned
      assignments={list}
      assignment={match}
      prefill={prefill}
      place={place}
      onRecorded={setRecorded}
    />
  );
}

function AsPlanned({
  assignments,
  assignment,
  prefill,
  place,
  onRecorded,
}: {
  assignments: Assignment[];
  assignment: Assignment;
  prefill: RecordPrefill;
  place?: string;
  onRecorded: (session: TutoringSession) => void;
}) {
  const theme = useAppTheme();
  const offline = useOffline();
  const today = organizationToday(useOrgTimeZone());
  const record = useRecordSession();
  // Filled once from the schedule: the pairing, the date (never after today), the times, the mode.
  const [values, setValues] = useState(() => prefilledForm(today, assignments, prefill));
  const [different, setDifferent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const preview = previewFigures(values.startedAt, values.endedAt, values.mode, assignment, null);
  const muted = theme.tokens.mutedForeground;

  async function handleRecord() {
    setErrors({});
    setFailure(null);
    const input = formBody(values, {
      tutor_user_id: assignment.tutor_user_id,
      student_user_id: assignment.student_user_id,
    });
    const parsed = sessionInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      setFailure(parsed.error.issues[0]?.message ?? 'Check the times.');
      // The refusal is about the times: open them.
      setDifferent(true);
      haptics.error();
      return;
    }
    try {
      const result = await record.mutateAsync(parsed.data);
      haptics.success();
      onRecorded(result.data);
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('Could not record the lesson.');
      }
    }
  }

  return (
    <QuickSheet
      testID="record-quick"
      title="Record this lesson"
      description="Check it is the lesson you taught."
      primaryLabel={different ? 'Record lesson' : 'It ran as planned'}
      primaryIcon="check"
      onPrimary={() => handleRecord()}
      loading={record.isPending}
      // Recording offline would only fail.
      primaryDisabled={offline}
      error={failure ?? (offline ? 'You are offline. Record it once you are back online.' : null)}
    >
      <OutlinedCard>
        <View testID="record-quick-summary" style={{ padding: space.lg, gap: space.md }}>
          <SummaryLine icon="account-outline" testID="record-quick-student">
            {assignment.student_name}
          </SummaryLine>
          <SummaryLine icon="calendar-outline" testID="record-quick-day">
            {values.occurredOn === today ? 'Today' : formatSessionDay(values.occurredOn, today)}
          </SummaryLine>
          <SummaryLine icon="clock-outline" testID="record-quick-times">
            {`${formatSessionTimes(values.startedAt, values.endedAt)}${
              preview ? ` · ${formatDuration(preview.billed)}` : ''
            }`}
          </SummaryLine>
          <SummaryLine
            icon={values.mode === 'virtual' ? 'laptop' : 'map-marker-outline'}
            testID="record-quick-place"
          >
            {place ? `${place} · ${SESSION_MODE_LABELS[values.mode]}` : SESSION_MODE_LABELS[values.mode]}
          </SummaryLine>
        </View>
      </OutlinedCard>

      {different ? (
        <View testID="record-quick-times-fields" style={{ gap: space.sm }}>
          <DateTimeField
            mode="time"
            testID="record-quick-start"
            label="Started"
            value={values.startedAt}
            onChange={(time) => setValues((was) => ({ ...was, startedAt: time }))}
            error={Boolean(errors.started_at)}
          />
          {errors.started_at ? <FieldError>{errors.started_at}</FieldError> : null}
          <DateTimeField
            mode="time"
            testID="record-quick-end"
            label="Ended"
            value={values.endedAt}
            onChange={(time) => setValues((was) => ({ ...was, endedAt: time }))}
            error={Boolean(errors.ended_at)}
          />
          {errors.ended_at ? <FieldError>{errors.ended_at}</FieldError> : null}
        </View>
      ) : (
        <Button
          testID="record-quick-different"
          mode="outlined"
          icon="clock-edit-outline"
          onPress={() => {
            haptics.selection();
            setDifferent(true);
          }}
          contentStyle={{ minHeight: 48 }}
        >
          Different times
        </Button>
      )}
      {/* Phase 43: from the Now card, the homework set last time starts the Homework review. */}
      {prefill.homeworkReview !== undefined ? (
        <DictationField
          testID="record-quick-homework"
          label="Homework review"
          value={values.homeworkReview}
          onChange={(text) => setValues((was) => ({ ...was, homeworkReview: text }))}
          placeholder="How the homework from last time went"
          error={errors['write_up.homework_review']}
          maxLength={PART_MAX}
        />
      ) : null}
      <Text variant="bodySmall" style={{ color: muted }}>
        You can add notes, homework and progress once it is recorded.
      </Text>
    </QuickSheet>
  );
}

function SummaryLine({ icon, children, testID }: { icon: string; children: ReactNode; testID: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Icon source={icon} size={22} color={theme.colors.primary} />
      <Text testID={testID} variant="bodyLarge" style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Recorded: say so in the sheet (a toast would sit under it), and offer the write-up. */
function RecordedSheet({ session }: { session: TutoringSession }) {
  const today = organizationToday(useOrgTimeZone());
  return (
    <QuickSheet
      testID="record-quick-done"
      title="Session recorded."
      description={`${session.student_name}, ${
        session.occurred_on === today ? 'today' : formatSessionDay(session.occurred_on, today)
      }, ${formatSessionTimes(session.started_at, session.ended_at)}. Add the write-up now, or later from the lesson.`}
      primaryLabel="Write up the lesson"
      primaryIcon="pencil-outline"
      cancelLabel="Done"
      onPrimary={() => {
        haptics.selection();
        // The sheet gives way to the write-up cards for this lesson.
        router.replace({ pathname: '/record-lesson', params: { id: session.id } });
      }}
    >
      {null}
    </QuickSheet>
  );
}

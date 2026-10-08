// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (recording a lesson
// and editing one on the record). The dialog becomes a form sheet, `(org)/record-session`. Drafts
// and the 3-second autosave arrive with item 19; the form's state (`useSessionForm`) is already
// shaped for them.
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  formatDuration,
  sessionInputSchema,
  sessionUpdateSchema,
  type Assignment,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useUserDetail } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useAssignments, usePreviousSession, useRecordSession, useSession, useUpdateSession } from '../api';
import { organizationToday } from '../session-ranges';
import { AssessmentFields, HomeworkStatusPicker, NoteField, likelyAssessorRole } from '../session-notes';
import { FormSection } from './form-section';
import { PairingPicker } from './pairing-picker';
import { PreviousLesson } from './previous-lesson';
import { ProgressSection } from './progress-section';
import { SessionMoneyPreview, previewFigures } from './session-money-preview';
import {
  QUICK_LENGTHS,
  addMinutes,
  emptyForm,
  formBody,
  formFromSession,
  issuesToErrors,
  toUpdatePayload,
  useSessionForm,
} from './use-session-form';

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * The sheet: waits for the pairings (and, editing, the lesson), then starts the form from them
 * once -- a refetch never stomps on what is being typed.
 */
export function RecordSessionSheet({
  sessionId,
  showMoney = false,
}: {
  /** Editing this lesson; a new one when absent. */
  sessionId?: string;
  /** True only when opened from Finance. */
  showMoney?: boolean;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  // A tutor only ever sees their own pairings; an admin sees all of them.
  const assignments = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const existing = useSession(sessionId ?? null);

  let body;
  if (assignments.isPending || (sessionId && existing.isPending)) {
    body = <LoadingState label="Loading…" />;
  } else if (assignments.isError) {
    body = <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />;
  } else if (sessionId && (existing.isError || !existing.data)) {
    body = <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />;
  } else {
    body = (
      <SessionForm
        key={sessionId ?? 'new'}
        assignments={assignments.data?.data ?? []}
        existing={existing.data?.data ?? null}
        showMoney={showMoney}
      />
    );
  }

  return (
    <Screen testID="screen-record-session" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

function SessionForm({
  assignments,
  existing,
  showMoney,
}: {
  assignments: Assignment[];
  existing: TutoringSession | null;
  showMoney: boolean;
}) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const today = organizationToday(useOrgTimeZone());
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isEdit = existing !== null;

  const { values, set } = useSessionForm(() =>
    existing ? formFromSession(existing, assignments, user?.id) : emptyForm(today, assignments),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A sheet covers the app's toasts, so the reason a save failed is also said by the button.
  const [failure, setFailure] = useState<string | null>(null);
  const record = useRecordSession();
  const update = useUpdateSession();
  const saving = record.isPending || update.isPending;

  const assignment = assignments.find((a) => a.id === values.assignmentId);
  const studentId = existing?.student_user_id ?? assignment?.student_user_id;

  // The lesson before this one, whose homework and notes the review parts look back on.
  const { data: previous } = usePreviousSession(
    studentId,
    { occurredOn: values.occurredOn, startedAt: values.startedAt },
    existing?.id,
  );

  // The price is set on the student and only an admin may read it, so only an admin's preview
  // from Finance shows the family's side; nothing is fetched otherwise.
  const { data: studentDetail } = useUserDetail(showMoney && isAdmin && studentId ? studentId : null);
  const studentPrices = studentDetail?.data.student_profile ?? null;
  const preview = previewFigures(values.startedAt, values.endedAt, values.mode, assignment, studentPrices);

  /** Whose assessment the form is holding, for wording the question. */
  const myRole =
    existing && user
      ? likelyAssessorRole(existing, user)
      : isAdmin && assignment && assignment.tutor_user_id !== user?.id
        ? 'admin'
        : 'tutor';

  function fail(message: string, fieldErrors: Record<string, string>) {
    setErrors(fieldErrors);
    setFailure(message);
    haptics.error();
    toast.error(message);
  }

  async function handleSubmit() {
    setErrors({});
    setFailure(null);

    if (!isEdit && !assignment) {
      fail('Choose which student this session was with.', {
        assignment: 'Choose which student this session was with.',
      });
      return;
    }

    try {
      if (existing) {
        const input = toUpdatePayload(values, existing, user?.id);
        const parsed = sessionUpdateSchema.safeParse(input);
        if (!parsed.success) {
          fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
          return;
        }
        await update.mutateAsync({ id: existing.id, input });
        toast.success('Session updated.');
      } else {
        const input = formBody(values, {
          tutor_user_id: assignment!.tutor_user_id,
          student_user_id: assignment!.student_user_id,
        });
        const parsed = sessionInputSchema.safeParse(input);
        if (!parsed.success) {
          fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
          return;
        }
        await record.mutateAsync(parsed.data);
        toast.success('Session recorded.');
      }
      haptics.success();
      close();
    } catch (error) {
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not save the session.', {});
    }
  }

  const muted = theme.tokens.mutedForeground;
  const errorText = (key: string) =>
    errors[key] ? (
      <HelperText type="error" padding="none">
        {errors[key]}
      </HelperText>
    ) : null;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {isEdit ? 'Edit session' : 'Record a session'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {existing
            ? `${existing.tutor_name} with ${existing.student_name}.`
            : 'Log a lesson that has already taken place.'}
        </Text>
      </View>

      {!isEdit ? (
        <View>
          <PairingPicker
            assignments={assignments}
            value={values.assignmentId}
            onChange={(id) => {
              set('assignmentId', id);
              // The one complaint a choice answers.
              setFailure(null);
              setErrors(({ assignment: _a, student_user_id: _s, ...rest }) => rest);
            }}
            showTutor={isAdmin}
            error={errors.assignment ?? errors.student_user_id}
          />
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <DateTimeField
          mode="date"
          testID="record-date"
          label="Date"
          value={values.occurredOn}
          maximumDate={today}
          onChange={(day) => set('occurredOn', day)}
          error={Boolean(errors.occurred_on)}
        />
        {errorText('occurred_on')}
        <DateTimeField
          mode="time"
          testID="record-start"
          label="Started"
          value={values.startedAt}
          onChange={(time) => set('startedAt', time)}
          error={Boolean(errors.started_at)}
        />
        {errorText('started_at')}
        <DateTimeField
          mode="time"
          testID="record-end"
          label="Ended"
          value={values.endedAt}
          onChange={(time) => set('endedAt', time)}
          error={Boolean(errors.ended_at)}
        />
        {errorText('ended_at')}
      </View>

      {/* One tap for the usual lengths, instead of doing clock arithmetic. */}
      <View style={{ gap: space.xs }}>
        <Text variant="bodySmall" style={{ color: muted }}>
          Ran for
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {QUICK_LENGTHS.map((minutes) => {
            const active = preview?.billed === minutes;
            return (
              <Chip
                key={minutes}
                testID={`record-length-${minutes}`}
                selected={active}
                showSelectedCheck={false}
                mode={active ? 'flat' : 'outlined'}
                onPress={() => {
                  haptics.selection();
                  set('endedAt', addMinutes(values.startedAt, minutes));
                }}
              >
                {formatDuration(minutes)}
              </Chip>
            );
          })}
        </View>
      </View>

      <SegmentedButtons
        value={values.mode}
        onValueChange={(mode) => {
          haptics.selection();
          set('mode', mode as (typeof SESSION_MODES)[number]);
        }}
        buttons={SESSION_MODES.map((mode) => ({
          value: mode,
          label: SESSION_MODE_LABELS[mode],
          testID: `record-mode-${mode}`,
        }))}
      />
      {errorText('mode')}

      <SessionMoneyPreview
        preview={preview}
        hasAssignment={Boolean(assignment) || isEdit}
        isAdmin={isAdmin}
        showMoney={showMoney}
      />

      {/* The write-up, in the order the lesson ran. Every part is optional; together they are
          what a summary is built from. */}
      <FormSection title="Looking back" description="What this lesson was for, and how last time held up.">
        {previous ? <PreviousLesson session={previous} showTutor={isAdmin} /> : null}
        <NoteField
          testID="record-planned"
          label="What was planned"
          value={values.planned}
          onChange={(text) => set('planned', text)}
          placeholder="What this lesson set out to cover"
          error={errors['write_up.planned']}
        />
        <NoteField
          testID="record-previous-review"
          label="Previous session review"
          value={values.previousReview}
          onChange={(text) => set('previousReview', text)}
          placeholder="How much of last time had stuck"
          error={errors['write_up.previous_review']}
        />
        <NoteField
          testID="record-homework-review"
          label="Homework review"
          value={values.homeworkReview}
          onChange={(text) => set('homeworkReview', text)}
          placeholder="How the homework from last time went"
          error={errors['write_up.homework_review']}
        />
        <HomeworkStatusPicker
          testID="record-homework"
          value={values.homeworkStatus}
          onChange={(status) => set('homeworkStatus', status)}
        />
      </FormSection>

      <FormSection title="This lesson">
        <NoteField
          testID="record-notes"
          label="Session notes"
          value={values.notes}
          onChange={(text) => set('notes', text)}
          placeholder="What was covered, and how it went"
          error={errors.notes}
          long
        />
        <NoteField
          testID="record-homework-set"
          label="Homework set"
          value={values.homeworkAssigned}
          onChange={(text) => set('homeworkAssigned', text)}
          placeholder="What they are to do before next time"
          error={errors['write_up.homework_assigned']}
        />
      </FormSection>

      {studentId ? (
        <ProgressSection
          studentId={studentId}
          goalRating={values.goalRating}
          onGoalRating={(rating) => set('goalRating', rating)}
          topicRatings={values.topicRatings}
          onTopicRatings={(ratings) => set('topicRatings', ratings)}
          error={errors['progress.topic_ratings'] ?? errors['progress.goal_rating']}
        />
      ) : null}

      <FormSection
        title="Your assessment"
        description="Optional. Everyone this lesson concerns can read it once it is recorded."
      >
        <AssessmentFields
          testID="record-assessment"
          role={myRole}
          rating={values.myRating}
          onRating={(rating) => set('myRating', rating)}
          body={values.myAssessment}
          onBody={(text) => set('myAssessment', text)}
          errors={{
            rating: errors['assessment.rating'] ?? errors.assessment,
            body: errors['assessment.body'],
          }}
        />
      </FormSection>

      <View style={{ gap: space.sm }}>
        {failure ? (
          <HelperText testID="record-error" type="error" padding="none">
            {failure}
          </HelperText>
        ) : null}
        <Button
          testID="record-submit"
          mode="contained"
          onPress={() => void handleSubmit()}
          loading={saving}
          disabled={saving}
        >
          {isEdit ? 'Save changes' : 'Record session'}
        </Button>
        <Button testID="record-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

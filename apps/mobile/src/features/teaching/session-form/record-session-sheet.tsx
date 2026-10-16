// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (recording a lesson,
// editing one on the record, and picking a draft back up). The dialog becomes a form sheet,
// `(org)/record-session`. A new write-up autosaves into the writer's own draft every 3 s
// (`useDraftAutosave`); recording consumes it.
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  formatDuration,
  type Assignment,
  type SessionDraft,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Chip, SegmentedButtons, Text } from 'react-native-paper';

import { OfflineSaveNote, useOffline } from '@/components/connectivity';
import { FieldError } from '@/components/field-error';
import { DateTimeField } from '@/components/date-time-field';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { DictationField } from '@/features/dictation/dictation-field';
import { useUserDetail } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';
import { useAssignments, useMyDrafts, usePreviousSession, useSession } from '../api';
import { AssessmentFields, HomeworkStatusPicker } from '../session-notes';
import { FormSection } from './form-section';
import { PairingPicker } from './pairing-picker';
import { PreviousLesson } from './previous-lesson';
import { ProgressSection } from './progress-section';
import { AutosaveStatus } from './autosave-status';
import { SessionMoneyPreview, previewFigures } from './session-money-preview';
import { QUICK_LENGTHS, addMinutes, type RecordPrefill } from './use-session-form';
import { NOTES_MAX, PART_MAX, outcomeMessage, useSessionWriteUp } from './use-session-write-up';

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * The sheet: waits for the pairings (and, editing, the lesson), then starts the form from them
 * once -- a refetch never stomps on what is being typed.
 */
export function RecordSessionSheet({
  sessionId,
  draftId,
  showMoney = false,
  prefill,
}: {
  /** Editing this lesson; a new one when absent. */
  sessionId?: string;
  /** Picking this draft back up (the writer's own; there is nobody else's to pick). */
  draftId?: string;
  /** True only when opened from Finance. */
  showMoney?: boolean;
  /** A new lesson, filled in from Home's Next up card (#43). */
  prefill?: RecordPrefill;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  // A tutor only ever sees their own pairings; an admin sees all of them.
  const assignments = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const existing = useSession(sessionId ?? null);
  // There is no read of one draft: it is found among the writer's own.
  const drafts = useMyDrafts();
  const draft = draftId ? (drafts.data?.data.find((row) => row.id === draftId) ?? null) : null;

  let body;
  if (assignments.isPending || (sessionId && existing.isPending) || (draftId && drafts.isPending)) {
    body = <FormSkeleton label="Loading…" fields={5} />;
  } else if (assignments.isError) {
    body = <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />;
  } else if (sessionId && (existing.isError || !existing.data)) {
    body = <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />;
  } else if (draftId && !draft) {
    body = (
      <ErrorState
        error={drafts.error ?? new ApiRequestError(404, 'not_found', 'That draft does not exist.')}
        onRetry={() => void drafts.refetch()}
      />
    );
  } else {
    body = (
      <SessionForm
        key={sessionId ?? draftId ?? 'new'}
        assignments={assignments.data?.data ?? []}
        existing={existing.data?.data ?? null}
        draft={draft}
        showMoney={showMoney}
        prefill={sessionId || draftId ? undefined : prefill}
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
  draft,
  showMoney,
  prefill,
}: {
  assignments: Assignment[];
  existing: TutoringSession | null;
  /** An unposted write-up being picked back up; never together with `existing`. */
  draft: SessionDraft | null;
  showMoney: boolean;
  prefill?: RecordPrefill;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const offline = useOffline();
  // The form's state, its autosave and its saves are shared with the record step flow (U4).
  const w = useSessionWriteUp({ assignments, existing, draft, prefill, onFail: (m) => toast.error(m) });
  const { values, set, errors, failure, saving, isAdmin, isEdit, isDraft, assignment, studentId, dictation } =
    w;
  const today = w.today;
  const normalise = w.normalise;

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
  const myRole = w.myRole;

  async function handleSaveDraft() {
    const outcome = await w.saveAsDraft();
    if (!outcome) return;
    toast.success(outcomeMessage(outcome));
    close();
  }

  async function handleSubmit() {
    const outcome = await w.submit();
    if (!outcome) return;
    toast.success(outcomeMessage(outcome));
    close();
  }

  const muted = theme.tokens.mutedForeground;
  const errorText = (key: string) => (errors[key] ? <FieldError>{errors[key]}</FieldError> : null);

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {isEdit ? 'Edit session' : isDraft ? 'Finish this draft' : 'Record a session'}
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
            // The one complaint a choice answers goes with it.
            onChange={w.chooseAssignment}
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
                hitSlop={CHIP_HIT_SLOP}
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
        <DictationField
          testID="record-planned"
          label="What was planned"
          value={values.planned}
          onChange={(text) => set('planned', text)}
          placeholder="What this lesson set out to cover"
          error={errors['write_up.planned']}
          maxLength={PART_MAX}
          normalise={normalise}
        />
        <DictationField
          testID="record-previous-review"
          label="Previous session review"
          value={values.previousReview}
          onChange={(text) => set('previousReview', text)}
          placeholder="How much of last time had stuck"
          error={errors['write_up.previous_review']}
          maxLength={PART_MAX}
          normalise={normalise}
        />
        <DictationField
          testID="record-homework-review"
          label="Homework review"
          value={values.homeworkReview}
          onChange={(text) => set('homeworkReview', text)}
          placeholder="How the homework from last time went"
          error={errors['write_up.homework_review']}
          maxLength={PART_MAX}
          normalise={normalise}
        />
        <HomeworkStatusPicker
          testID="record-homework"
          value={values.homeworkStatus}
          onChange={(status) => set('homeworkStatus', status)}
        />
      </FormSection>

      <FormSection title="This lesson">
        <DictationField
          testID="record-notes"
          label="Session notes"
          value={values.notes}
          onChange={(text) => set('notes', text)}
          placeholder="What was covered, and how it went"
          error={errors.notes}
          long
          maxLength={NOTES_MAX}
          normalise={normalise}
        />
        <DictationField
          testID="record-homework-set"
          label="Homework set"
          value={values.homeworkAssigned}
          onChange={(text) => set('homeworkAssigned', text)}
          placeholder="What they are to do before next time"
          error={errors['write_up.homework_assigned']}
          maxLength={PART_MAX}
          normalise={normalise}
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
        description={
          isEdit
            ? 'Optional. Everyone this lesson concerns can read it.'
            : 'Optional. Private with the rest of a draft; everyone this lesson concerns can read it once it is recorded.'
        }
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
          dictate
          normalise={normalise}
        />
      </FormSection>

      <View style={{ gap: space.sm }}>
        {!isEdit ? <AutosaveStatus state={w.autosave.state} /> : null}
        {failure ? <FieldError testID="record-error">{failure}</FieldError> : null}
        <Button
          testID="record-submit"
          mode="contained"
          onPress={() => void handleSubmit()}
          loading={saving}
          // Saving a lesson offline would only fail; the draft keeps it meanwhile (F-16).
          disabled={saving || offline}
        >
          {isEdit ? 'Save changes' : isDraft ? 'Post session' : 'Record session'}
        </Button>
        <OfflineSaveNote offline={offline} />
        {/* Offered while writing up a lesson, and while picking a draft back up. Not while
            editing a session already on the record: that one has been posted. */}
        {!isEdit ? (
          <Button
            testID="record-save-draft"
            mode="contained-tonal"
            onPress={() => void handleSaveDraft()}
            loading={w.savingDraft}
            disabled={saving}
          >
            Save draft
          </Button>
        ) : null}
        <Button
          testID="record-cancel"
          mode="outlined"
          onPress={() => {
            // Closing drops the phrase in flight; what was already said is in the draft (P3).
            dictation.abort();
            close();
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </View>
    </View>
  );
}

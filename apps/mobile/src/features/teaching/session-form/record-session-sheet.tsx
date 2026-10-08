// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (recording a lesson,
// editing one on the record, and picking a draft back up). The dialog becomes a form sheet,
// `(org)/record-session`. A new write-up autosaves into the writer's own draft every 3 s
// (`useDraftAutosave`); recording consumes it.
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  formatDuration,
  sessionDraftInputSchema,
  sessionInputSchema,
  sessionUpdateSchema,
  type ApiOk,
  type Assignment,
  type SessionDraft,
  type SessionDraftInput,
  type TutoringSession,
} from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  useAssignments,
  useAutosaveDraft,
  useMyDrafts,
  usePostDraft,
  usePreviousSession,
  useRecordSession,
  useSaveDraft,
  useSession,
  useUpdateSession,
} from '../api';
import { organizationToday } from '../session-ranges';
import { AssessmentFields, HomeworkStatusPicker, NoteField, likelyAssessorRole } from '../session-notes';
import { FormSection } from './form-section';
import { PairingPicker } from './pairing-picker';
import { PreviousLesson } from './previous-lesson';
import { ProgressSection } from './progress-section';
import { AutosaveStatus } from './autosave-status';
import { SessionMoneyPreview, previewFigures } from './session-money-preview';
import { useDraftAutosave, withDraft } from './use-draft-autosave';
import {
  QUICK_LENGTHS,
  addMinutes,
  emptyForm,
  formBody,
  formFromDraft,
  formFromSession,
  hasContent,
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
  draftId,
  showMoney = false,
}: {
  /** Editing this lesson; a new one when absent. */
  sessionId?: string;
  /** Picking this draft back up (the writer's own; there is nobody else's to pick). */
  draftId?: string;
  /** True only when opened from Finance. */
  showMoney?: boolean;
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
    body = <LoadingState label="Loading…" />;
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
}: {
  assignments: Assignment[];
  existing: TutoringSession | null;
  /** An unposted write-up being picked back up; never together with `existing`. */
  draft: SessionDraft | null;
  showMoney: boolean;
}) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = organizationToday(useOrgTimeZone());
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isEdit = existing !== null;
  const isDraft = draft !== null;

  const { values, set } = useSessionForm(() =>
    existing
      ? formFromSession(existing, assignments, user?.id)
      : draft
        ? formFromDraft(draft, assignments)
        : emptyForm(today, assignments),
  );
  const [submitErrors, setErrors] = useState<Record<string, string>>({});
  // What the draft schema said about the last body the autosave looked at; answered by an edit.
  const [autosaveErrors, setAutosaveErrors] = useState<Record<string, string>>({});
  const errors = { ...autosaveErrors, ...submitErrors };
  // A sheet covers the app's toasts, so the reason a save failed is also said by the button.
  const [failure, setFailure] = useState<string | null>(null);
  const record = useRecordSession();
  const update = useUpdateSession();
  const saveDraft = useSaveDraft();
  const postDraft = usePostDraft();
  const autosaveDraft = useAutosaveDraft();
  const saving = record.isPending || update.isPending || saveDraft.isPending || postDraft.isPending;

  const assignment = assignments.find((a) => a.id === values.assignmentId);
  /** The pairing the write-up names: the one chosen, else the draft's own. */
  const pair = assignment
    ? { tutor_user_id: assignment.tutor_user_id, student_user_id: assignment.student_user_id }
    : draft
      ? { tutor_user_id: draft.tutor_user_id, student_user_id: draft.student_user_id }
      : null;

  const autosave = useDraftAutosave({
    enabled: !isEdit,
    initialDraftId: draft?.id ?? null,
    getBody: () =>
      pair && (isDraft || hasContent(values)) ? (formBody(values, pair) as SessionDraftInput) : null,
    save: async (id, input) => {
      const result = await autosaveDraft.mutateAsync({ id, input });
      // Keeps the cached list in step with every quiet save, so "Continue" opens what was kept.
      queryClient.setQueryData<ApiOk<SessionDraft[]>>(['session-drafts'], (list) =>
        withDraft(list, result.data),
      );
      return result;
    },
    onInvalid: setAutosaveErrors,
    onValid: () => setAutosaveErrors({}),
    onKeptAsDraft: () => toast.success('Your write-up is kept as a draft. Pick it up from Drafts.'),
  });
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

  /**
   * Keeps the write-up without posting it. Nobody else can see a draft, so this is the safe
   * button: it never puts an unfinished note in front of a family, and it never bills anything.
   */
  async function handleSaveDraft() {
    setErrors({});
    setFailure(null);
    if (!pair) {
      fail('Choose which student this session was with.', {
        assignment: 'Choose which student this session was with.',
      });
      return;
    }
    const input = formBody(values, pair) as SessionDraftInput;
    const parsed = sessionDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
      return;
    }
    await autosave.settle();
    try {
      await saveDraft.mutateAsync({ id: autosave.draftId() ?? undefined, input });
      toast.success(isDraft ? 'Draft saved.' : 'Saved as a draft. Only you can see it.');
      close();
    } catch (error) {
      autosave.resume();
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not save the draft.', {});
    }
  }

  /** Saves any edits, then posts: one button, because the writer pressed post. */
  async function handlePostDraft() {
    if (!draft || !pair) return;
    const input = formBody(values, pair) as SessionDraftInput;
    const parsed = sessionDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check the form.', issuesToErrors(parsed.error.issues));
      return;
    }
    await autosave.settle();
    try {
      // Brings the draft up to date first. Quietly: posting is the action, and is what the log
      // records.
      await autosaveDraft.mutateAsync({ id: draft.id, input });
      await postDraft.mutateAsync(draft.id);
      toast.success('Session recorded. Everyone concerned can see it now.');
      close();
    } catch (error) {
      autosave.resume();
      if (error instanceof ApiRequestError) fail(error.message, error.fieldErrors);
      else fail('Could not post the draft.', {});
    }
  }

  async function handleSubmit() {
    setErrors({});
    setFailure(null);

    if (isDraft) {
      await handlePostDraft();
      return;
    }

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
        // Lets an autosave on its way land, then records from the draft it made, which the
        // server deletes in the same request: one write-up never becomes a session and a draft.
        await autosave.settle();
        const fromDraft = autosave.draftId();
        await record.mutateAsync({ ...parsed.data, ...(fromDraft ? { from_draft_id: fromDraft } : {}) });
        // The server deleted that draft; `useRecordSession`'s invalidations (copied from the web)
        // do not cover the drafts list, so it is refreshed here.
        if (fromDraft) void queryClient.invalidateQueries({ queryKey: ['session-drafts'] });
        toast.success('Session recorded.');
      }
      close();
    } catch (error) {
      // Not recorded, so keep the write-up safe again.
      if (!isEdit) autosave.resume();
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
        />
      </FormSection>

      <View style={{ gap: space.sm }}>
        {!isEdit ? <AutosaveStatus state={autosave.state} /> : null}
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
          {isEdit ? 'Save changes' : isDraft ? 'Post session' : 'Record session'}
        </Button>
        {/* Offered while writing up a lesson, and while picking a draft back up. Not while
            editing a session already on the record: that one has been posted. */}
        {!isEdit ? (
          <Button
            testID="record-save-draft"
            mode="contained-tonal"
            onPress={() => void handleSaveDraft()}
            loading={saveDraft.isPending}
            disabled={saving}
          >
            Save draft
          </Button>
        ) : null}
        <Button testID="record-cancel" mode="outlined" onPress={close} disabled={saving}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

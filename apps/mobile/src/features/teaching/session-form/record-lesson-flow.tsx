// Record a lesson as a step flow (UI upgrades U4; docs/ui-upgrades-spec.md, build log #49):
// Student -> When -> the write-up as four optional cards (Planned, Covered, Homework, Progress).
// Opened from the create button, the Sessions page's Tutoring tab, the "Record a lesson" quick action
// and a draft's Continue. The same flow without the first two steps writes up a lesson already on
// the record (`?id=`), which is where "Write up the lesson" leads after recording from Next up.
//
// A new write-up (and a draft picked back up) autosaves into the writer's own draft every 3 s, as
// the record sheet always has (`useSessionWriteUp`); recording consumes that draft. Leaving keeps
// it, so a new write-up never asks "Discard changes?". Editing a lesson on the record has no draft,
// so leaving that one asks. Tutoring only: no money anywhere in it (the Finance path keeps the
// record sheet and its money preview). No toast while the flow is up -- it would take the next tap
// (U3) -- so refusals are said in the footer and the outcome once the flow has gone.
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  elapsedMinutes,
  formatDuration,
  type Assignment,
  type SessionDraft,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, SegmentedButtons } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateTimeField } from '@/components/date-time-field';
import { FieldError } from '@/components/field-error';
import { IconButton } from '@/components/icon-button';
import { SearchPicker, type SearchPickerItem } from '@/components/search-picker';
import { FormSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { StepFlow, type StepDef } from '@/components/step-flow';
import { useToast } from '@/components/toast';
import { useDirty } from '@/hooks/use-unsaved-changes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, space } from '@/theme/tokens';
import { useAssignments, useMyDrafts, usePreviousSession, useSession } from '../api';
import { AutosaveStatus } from './autosave-status';
import { SessionMoneyPreview, previewFigures } from './session-money-preview';
import { QUICK_LENGTHS, addMinutes, type SessionFormValues } from './use-session-form';
import {
  CHOOSE_STUDENT,
  outcomeMessage,
  useSessionWriteUp,
  type SessionWriteUp,
} from './use-session-write-up';
import { CoveredCard, HomeworkCard, PlannedCard, ProgressCard, WRITE_UP_STEP_FIELDS } from './write-up-cards';

/** The server's field names the first two steps own. */
export const RECORD_STEP_FIELDS = {
  student: ['assignment', 'student_user_id', 'tutor_user_id'],
  when: ['occurred_on', 'started_at', 'ended_at', 'mode'],
} as const;

/** The reader's pairings as rows to pick from: the student, and for an admin the tutor too. */
export function studentItems(assignments: readonly Assignment[], showTutor: boolean): SearchPickerItem[] {
  return assignments.map((assignment) => ({
    id: assignment.id,
    title: assignment.student_name,
    description: showTutor ? `with ${assignment.tutor_name}` : undefined,
    avatarName: assignment.student_name,
    keywords: showTutor ? assignment.tutor_name : undefined,
  }));
}

/** The When step's own check: the shared schema's sentence for an end before the start. */
export function whenIssues(values: Pick<SessionFormValues, 'startedAt' | 'endedAt'>) {
  return elapsedMinutes(values.startedAt, values.endedAt) === null
    ? { ended_at: 'The end time must be after the start time.' }
    : null;
}

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * The route's body: waits for the pairings (and the draft or the lesson being written up), then
 * starts the flow from them once -- a refetch never stomps on what is being typed.
 */
export function RecordLessonFlow({ sessionId, draftId }: { sessionId?: string; draftId?: string }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  // A tutor only ever sees their own pairings; an admin sees all of them.
  const assignments = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const existing = useSession(sessionId ?? null);
  const drafts = useMyDrafts();
  const draft = draftId ? (drafts.data?.data.find((row) => row.id === draftId) ?? null) : null;

  if (assignments.isPending || (sessionId && existing.isPending) || (draftId && drafts.isPending)) {
    return (
      <FlowFrame>
        <FormSkeleton label="Loading…" fields={4} />
      </FlowFrame>
    );
  }
  if (assignments.isError) {
    return (
      <FlowFrame>
        <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
      </FlowFrame>
    );
  }
  if (sessionId && (existing.isError || !existing.data)) {
    return (
      <FlowFrame>
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      </FlowFrame>
    );
  }
  if (draftId && !draft) {
    return (
      <FlowFrame>
        <ErrorState
          error={drafts.error ?? new ApiRequestError(404, 'not_found', 'That draft does not exist.')}
          onRetry={() => void drafts.refetch()}
        />
      </FlowFrame>
    );
  }
  return (
    <RecordSteps
      key={sessionId ?? draftId ?? 'new'}
      assignments={assignments.data?.data ?? []}
      existing={sessionId ? (existing.data?.data ?? null) : null}
      draft={draft}
    />
  );
}

/** The flow's frame before it can start: a close button over the loading or error state. */
function FlowFrame({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="record-lesson-loading"
      style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}
    >
      <View style={{ paddingHorizontal: space.sm, minHeight: 48, justifyContent: 'center' }}>
        <IconButton testID="step-flow-close" icon="close" accessibilityLabel="Close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}>{children}</ScrollView>
    </View>
  );
}

function RecordSteps({
  assignments,
  existing,
  draft,
}: {
  assignments: Assignment[];
  existing: TutoringSession | null;
  draft: SessionDraft | null;
}) {
  const toast = useToast();
  const w = useSessionWriteUp({ assignments, existing, draft });
  const { values, isEdit, isDraft } = w;
  // Only a lesson on the record can lose work by leaving: a new write-up is kept as a draft.
  const editDirty = useDirty(values);
  const dirty = isEdit && editDirty;

  // The lesson before this one, whose homework and notes the Planned card looks back on.
  const { data: previous } = usePreviousSession(
    w.studentId,
    { occurredOn: values.occurredOn, startedAt: values.startedAt },
    existing?.id,
  );

  const items = useMemo(() => studentItems(assignments, w.isAdmin), [assignments, w.isAdmin]);

  const writeUp: StepDef<SessionFormValues>[] = [
    {
      key: 'planned',
      title: 'What was planned?',
      description: 'What this lesson set out to cover, and how much of last time had stuck.',
      optional: true,
      fields: WRITE_UP_STEP_FIELDS.planned,
      render: () => <PlannedCard w={w} previous={previous} />,
    },
    {
      key: 'covered',
      title: 'What was covered?',
      description: 'What you worked on, and how it went.',
      optional: true,
      fields: WRITE_UP_STEP_FIELDS.covered,
      render: () => <CoveredCard w={w} />,
    },
    {
      key: 'homework',
      title: 'Homework',
      description: 'How last time’s went, and what is set for next time.',
      optional: true,
      fields: WRITE_UP_STEP_FIELDS.homework,
      render: () => <HomeworkCard w={w} />,
    },
    {
      key: 'progress',
      title: 'Progress',
      description: 'How far the lesson moved them, and how you think it went. Every score is optional.',
      // Optional like the others, but the last: its action records, so a Skip beside it would too.
      fields: WRITE_UP_STEP_FIELDS.progress,
      render: () => <ProgressCard w={w} />,
    },
  ];

  const steps: StepDef<SessionFormValues>[] = isEdit
    ? writeUp
    : [
        {
          key: 'student',
          title: 'Who was the lesson with?',
          fields: RECORD_STEP_FIELDS.student,
          scroll: false,
          validate: (draftValues) => (draftValues.assignmentId ? null : { assignment: CHOOSE_STUDENT }),
          render: ({ errors }) => (
            <View style={{ flex: 1, gap: space.sm }}>
              <SearchPicker
                testID="record-student"
                label="Students"
                placeholder="Search your students"
                items={items}
                value={values.assignmentId || null}
                onChange={(id) => {
                  haptics.selection();
                  w.chooseAssignment(id);
                }}
                emptyTitle={assignments.length === 0 ? 'No students to record yet' : 'No one by that name'}
                emptyBody={
                  assignments.length === 0
                    ? 'A lesson is recorded for a student you are paired with.'
                    : 'Try part of their first or last name.'
                }
                style={{ flex: 1 }}
              />
              {(errors.assignment ?? w.errors.assignment ?? w.errors.student_user_id) ? (
                <FieldError testID="record-student-error">
                  {errors.assignment ?? w.errors.assignment ?? w.errors.student_user_id}
                </FieldError>
              ) : null}
            </View>
          ),
        },
        {
          key: 'when',
          title: 'When was it?',
          description: 'Started and ended, or tap how long it ran.',
          fields: RECORD_STEP_FIELDS.when,
          validate: (draftValues) => whenIssues(draftValues),
          render: ({ errors }) => <WhenStep w={w} errors={{ ...w.errors, ...errors }} />,
        },
        ...writeUp,
      ];

  return (
    <StepFlow
      title={isEdit ? 'Write up the lesson' : isDraft ? 'Finish this draft' : 'Record a lesson'}
      steps={steps}
      draft={values}
      initialStep={isDraft ? 'planned' : undefined}
      submitLabel={isEdit ? 'Save write-up' : isDraft ? 'Post session' : 'Record lesson'}
      dirty={dirty}
      submitting={w.saving}
      fieldErrors={w.errors}
      formError={w.failure}
      footerNote={
        isEdit ? null : (
          <View testID="record-autosave">
            <AutosaveStatus state={w.autosave.state} />
          </View>
        )
      }
      headerAction={
        isEdit ? undefined : (
          <Button
            testID="record-save-draft"
            mode="text"
            compact
            onPress={() => void saveDraft(w, toast)}
            loading={w.savingDraft}
            disabled={w.saving}
            contentStyle={{ minHeight: 48 }}
          >
            Save draft
          </Button>
        )
      }
      onClose={() => {
        // Closing drops the phrase in flight; what was already said is in the draft (P3).
        w.dictation.abort();
        close();
      }}
      onSubmit={async ({ leave }) => {
        const outcome = await w.submit();
        if (!outcome) return;
        haptics.success();
        leave(close);
        toast.success(outcome.kind === 'updated' ? 'Write-up saved.' : outcomeMessage(outcome));
      }}
    />
  );
}

/** The explicit, logged save: kept as a draft, then the flow closes and says so. */
async function saveDraft(w: SessionWriteUp, toast: ReturnType<typeof useToast>) {
  const outcome = await w.saveAsDraft();
  if (!outcome) return;
  close();
  toast.success(outcomeMessage(outcome));
}

/** Date, the two times (or a usual length in one tap), and in person or online. */
function WhenStep({ w, errors }: { w: SessionWriteUp; errors: Record<string, string> }) {
  const { values, set, today, assignment } = w;
  // Tutoring: the length, never a figure (`showMoney` stays false).
  const preview = previewFigures(values.startedAt, values.endedAt, values.mode, assignment, null);
  return (
    <>
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
        {errors.occurred_on ? <FieldError>{errors.occurred_on}</FieldError> : null}
        <DateTimeField
          mode="time"
          testID="record-start"
          label="Started"
          value={values.startedAt}
          onChange={(time) => set('startedAt', time)}
          error={Boolean(errors.started_at)}
        />
        {errors.started_at ? <FieldError>{errors.started_at}</FieldError> : null}
        <DateTimeField
          mode="time"
          testID="record-end"
          label="Ended"
          value={values.endedAt}
          onChange={(time) => set('endedAt', time)}
          error={Boolean(errors.ended_at)}
        />
        {errors.ended_at ? <FieldError>{errors.ended_at}</FieldError> : null}
      </View>
      {/* One tap for the usual lengths, instead of doing clock arithmetic. */}
      <View accessibilityLabel="Ran for" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
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
      <SessionMoneyPreview preview={preview} hasAssignment={Boolean(assignment)} isAdmin={w.isAdmin} />
    </>
  );
}

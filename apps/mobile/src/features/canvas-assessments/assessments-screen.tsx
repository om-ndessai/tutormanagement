// Ported from apps/web/src/features/canvas-assessments/assessments-page.tsx @ 37bdad1, with Phase 40
// (the organization's question count; Reviewed, Review in progress, and the review's buttons).
// Phase 50 (build-log entry 62): `?student=` from the Assessment home, and `AssessmentRow` exported.
//
// Phase 38: the Assessment menu (beta), docs/canvas-assessment-plan.md. Starting one for a student,
// and the list of those the reader may see. Who sees which row, who may continue or discard one and
// who may open its PDF are the server's (R17: `can_continue`, `can_review`); the screen only offers
// what it says.
// Phase 77 (JF20, owner 2026-11-05): Start warns when the student already has one in progress -- "Noor already has a
// Grade 4 assessment in progress (started 8 minutes ago)" -- with "Continue it" (where the reader may) and "Start
// another"; Continue is also a guardian's of the student (`can_continue`), Discard only the starter's or an admin's
// (`can_discard`).
import {
  levelLabel,
  type CanvasAssessment,
  type CanvasAssessmentLevelId,
} from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { OptionPicker } from '@/components/option-picker';
import { BadgePill } from '@/components/badge-pill';
import { OutlinedCard } from '@/components/outlined-card';
import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { writeCanvasWork } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import {
  useCanvasAssessmentLevels,
  useCanvasAssessments,
  useDiscardCanvasAssessment,
  useStartCanvasAssessment,
} from './api';
import {
  IN_PROGRESS_TITLE,
  inProgressFor,
  inProgressWarning,
  levelOptionDetail,
  noStudentsLine,
  rowSummary,
  startNote,
} from './assessment-model';
import { rowActions, statusLabel } from './review-model';

export function AssessmentsScreen() {
  // Phase 50: the Assessment home's "Start an assessment" names the student; StartCard checks it.
  const { student } = useLocalSearchParams<{ student?: string }>();
  const list = useCanvasAssessments();
  const levels = useCanvasAssessmentLevels();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([list.refetch(), levels.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-assessments" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Assessment' }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <PageIntro>
            In beta. A student answers questions by hand, one per page, with nothing marked while they work. When it is
            submitted, their tutors get a PDF of the questions and the handwriting.
          </PageIntro>
        </View>
        <BadgePill testID="assessment-beta" />
      </View>
      <StartCard initialStudentId={typeof student === 'string' ? student : undefined} />
      <AssessmentList />
    </Screen>
  );
}

function StartCard({ initialStudentId }: { initialStudentId?: string }) {
  const { user, organization } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const onlyStudent = Boolean(user && user.roles.length > 0 && user.roles.every((role) => role === 'student'));
  // The students this reader may follow: a tutor's own, a parent's children, everyone for an admin.
  const students = useUsers(
    { role: 'student', limit: 100, sort: 'full_name', order: 'asc' },
    { enabled: !onlyStudent },
  );
  const levels = useCanvasAssessmentLevels();
  const start = useStartCanvasAssessment();
  // The list below reads the same query: one request.
  const assessments = useCanvasAssessments();

  const [studentId, setStudentId] = useState('');
  const [levelId, setLevelId] = useState('');
  // Phase 77 (JF20): the assessment in progress Start has warned about (its id), until another is chosen.
  const [warnedAbout, setWarnedAbout] = useState<string | null>(null);

  const studentList = students.data?.data ?? [];
  const levelList = levels.data?.data ?? [];

  // Phase 50: a student named by the link is taken only once they are among the reader's own
  // students; anything else is ignored, never trusted.
  const seeded = Boolean(initialStudentId && studentList.some((student) => student.id === initialStudentId));
  const pickedStudent = studentId || (seeded && initialStudentId ? initialStudentId : '');
  const chosenStudent = onlyStudent ? (user?.id ?? '') : pickedStudent;
  const studentChosen = Boolean(initialStudentId && (seeded || (onlyStudent && initialStudentId === user?.id)));

  const existing = chosenStudent ? inProgressFor(assessments.data?.data ?? [], chosenStudent) : null;
  const warning = existing && warnedAbout === existing.id ? existing : null;

  async function begin(another = false) {
    // One already in progress for this student: say so first, with the choice of continuing it.
    if (!another && existing) {
      haptics.warning();
      setWarnedAbout(existing.id);
      return;
    }
    setWarnedAbout(null);
    try {
      const created = await start.mutateAsync({
        student_user_id: chosenStudent,
        level_id: levelId as CanvasAssessmentLevelId,
      });
      router.push({ pathname: '/assessments/[id]', params: { id: created.data.id } });
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not start the assessment.');
    }
  }

  return (
    <Panel title="Start an assessment" testID="assessment-start">
      <View style={{ gap: space.md }}>
        {!onlyStudent ? (
          <OptionPicker
            testID="assessment-student"
            label="Student"
            placeholder={students.isPending ? 'Loading…' : 'Choose a student'}
            options={studentList.map((student) => ({ id: student.id, label: student.full_name }))}
            value={pickedStudent}
            onChange={setStudentId}
            searchPlaceholder="Search students"
            defaultOpen={false}
          />
        ) : null}
        {!onlyStudent && students.isSuccess && studentList.length === 0 ? (
          // A parent let in with no child linked once met an empty picker and a grey Start, with no reason
          // (UI audit J07 steps 26-28, JF1): say why, and who adds children.
          <View
            testID="assessment-no-students"
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            style={{ backgroundColor: theme.tokens.muted, borderRadius: radius.md, padding: space.md }}
          >
            <Text variant="bodyMedium">
              {noStudentsLine({
                isAdmin: user?.roles.includes('admin') ?? false,
                spaceName: organization?.name,
                adminNames: organization?.admin_names,
              })}
            </Text>
          </View>
        ) : null}
        <OptionPicker
          testID="assessment-level"
          label="Level"
          placeholder={levels.isPending ? 'Loading…' : 'Choose a level'}
          options={levelList.map((level) => ({
            id: level.level_id,
            label: level.label,
            detail: `· ${levelOptionDetail(level, organization?.canvas_assessment_questions ?? 10)}`,
            disabled: level.available === 0,
          }))}
          value={levelId}
          onChange={setLevelId}
          // Phase 50: with the student chosen by the link, the levels open by themselves.
          key={studentChosen ? 'levels-open' : 'levels'}
          defaultOpen={studentChosen}
          searchPlaceholder="Search levels"
          scroll
        />
        {warning ? (
          // Phase 77 (JF20): the web's dialog, in place -- Continue it (only where the reader may), Start another, Not now.
          <View
            testID="assessment-in-progress"
            accessibilityLiveRegion="polite"
            style={{
              gap: space.md,
              padding: space.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              backgroundColor: theme.tokens.muted,
            }}
          >
            <Text variant="titleSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
              {IN_PROGRESS_TITLE}
            </Text>
            <Text testID="assessment-in-progress-words" variant="bodyMedium" accessibilityRole="alert">
              {inProgressWarning(warning, warning.student_user_id === user?.id)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {warning.can_continue ? (
                <Button
                  testID="assessment-continue-it"
                  mode="contained"
                  contentStyle={{ minHeight: MIN_TARGET }}
                  onPress={() => {
                    haptics.selection();
                    setWarnedAbout(null);
                    router.push({ pathname: '/assessments/[id]', params: { id: warning.id } });
                  }}
                >
                  Continue it
                </Button>
              ) : null}
              <Button
                testID="assessment-start-another"
                mode="outlined"
                contentStyle={{ minHeight: MIN_TARGET }}
                disabled={!levelId || start.isPending}
                loading={start.isPending}
                onPress={() => void begin(true)}
              >
                Start another
              </Button>
              <Button
                testID="assessment-in-progress-cancel"
                mode="text"
                contentStyle={{ minHeight: MIN_TARGET }}
                onPress={() => setWarnedAbout(null)}
              >
                Not now
              </Button>
            </View>
          </View>
        ) : (
          <Button
            testID="assessment-begin"
            mode="contained"
            icon="pen"
            disabled={!chosenStudent || !levelId || start.isPending}
            loading={start.isPending}
            onPress={() => void begin()}
            style={{ alignSelf: 'flex-start' }}
          >
            Start
          </Button>
        )}
        <Text testID="assessment-start-note" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {startNote(
            Boolean(organization?.canvas_assessments_unreviewed),
            organization?.canvas_assessment_questions ?? 10,
          )}
        </Text>
      </View>
    </Panel>
  );
}

function AssessmentList() {
  const theme = useAppTheme();
  const list = useCanvasAssessments();
  const rows = list.data?.data ?? [];

  return (
    <View style={{ gap: space.sm }} accessibilityLabel="Assessments">
      <Text variant="titleMedium" accessibilityRole="header">
        Assessments
      </Text>
      {list.isPending ? (
        <ListSkeleton label="Loading the assessments…" count={2} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <Text testID="assessments-empty" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          No assessments yet.
        </Text>
      ) : (
        rows.map((row) => <AssessmentRow key={row.id} row={row} />)
      )}
    </View>
  );
}

function StatusPill({ row }: { row: CanvasAssessment }) {
  const theme = useAppTheme();
  const submitted = row.status === 'submitted';
  return (
    <View
      style={{
        backgroundColor: submitted ? theme.colors.primary : theme.tokens.secondary,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
      }}
    >
      {/* The id is on the text itself, so a test (and assistive tech) reads the status from it. */}
      <Text
        testID={`assessment-status-${row.id}`}
        variant="labelMedium"
        style={{ color: submitted ? theme.colors.onPrimary : theme.tokens.secondaryForeground }}
      >
        {statusLabel(row)}
      </Text>
    </View>
  );
}

/** "Review in progress": a draft review, shown to its reviewers only (the server sends null to others). */
function DraftPill({ row }: { row: CanvasAssessment }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.outline,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 1,
      }}
    >
      <Text testID={`assessment-review-draft-${row.id}`} variant="labelMedium">
        Review in progress
      </Text>
    </View>
  );
}

/** One assessment, with the buttons its reader may use. Also the Assessment home's Recent list. */
export function AssessmentRow({ row }: { row: CanvasAssessment }) {
  const theme = useAppTheme();
  const toast = useToast();
  const discard = useDiscardCanvasAssessment();

  function confirmDiscard() {
    haptics.warning();
    Alert.alert(
      'Discard this assessment?',
      'The writing on it is thrown away and it can no longer be submitted. It stays in the list as discarded.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void doDiscard() },
      ],
    );
  }

  async function doDiscard() {
    try {
      await discard.mutateAsync(row.id);
      await writeCanvasWork(row.id, null);
      toast.success('Assessment discarded.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not discard the assessment.');
    }
  }

  const actions = rowActions(row);
  // Phase 77: an admin who did not start it may discard it without continuing it.
  const anyAction = actions.continue || actions.discard || actions.review !== null || actions.openReview;
  return (
    <OutlinedCard testID={`assessment-row-${row.id}`} style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Text variant="titleSmall">{row.student_name}</Text>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {levelLabel(row.level_id)}
          </Text>
          <StatusPill row={row} />
          {row.review_draft ? <DraftPill row={row} /> : null}
        </View>
        <Text
          testID={`assessment-summary-${row.id}`}
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
        >
          {rowSummary(row)}
        </Text>
        {anyAction ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs }}>
            {actions.continue ? (
              <Button
                testID={`assessment-continue-${row.id}`}
                mode="contained"
                compact
                onPress={() => router.push({ pathname: '/assessments/[id]', params: { id: row.id } })}
              >
                Continue
              </Button>
            ) : null}
            {actions.discard ? (
              <Button
                testID={`assessment-discard-${row.id}`}
                mode="outlined"
                compact
                disabled={discard.isPending}
                onPress={confirmDiscard}
                textColor={theme.colors.error}
                style={{ borderColor: withAlpha(theme.colors.error, 0.5) }}
              >
                Discard
              </Button>
            ) : null}
            {actions.review ? (
              <Button
                testID={`assessment-review-${row.id}`}
                mode="contained"
                compact
                icon="draw-pen"
                onPress={() => router.push({ pathname: '/assessments/review/[id]', params: { id: row.id } })}
              >
                {actions.review}
              </Button>
            ) : null}
            {actions.submittedPdf ? (
              <Button
                testID={`assessment-open-pdf-${row.id}`}
                mode="outlined"
                compact
                icon="file-document-outline"
                onPress={() => router.push({ pathname: '/assessments/pdf/[id]', params: { id: row.id } })}
              >
                Submitted PDF
              </Button>
            ) : null}
            {actions.openReview ? (
              <Button
                testID={`assessment-open-review-${row.id}`}
                mode={actions.review ? 'outlined' : 'contained'}
                compact
                onPress={() =>
                  router.push({ pathname: '/assessments/pdf/[id]', params: { id: row.id, kind: 'reviewed' } })
                }
              >
                Open the review
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    </OutlinedCard>
  );
}

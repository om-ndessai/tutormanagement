// Ported from apps/web/src/features/dashboard/assessment-home.tsx @ 2471d84 (working tree), as entry
// 62 of docs/mobile/build-log.md lays it out for the phone: three panels in place of the web's start
// card and list.
//
// Phase 50: Home in a space where Assessment is on and Tutoring is not. Built from two reads the app
// already makes -- the assessments (`['canvas-assessments','list']`) and the students the reader may
// follow (the same params as the Assessment screen's StartCard, so one cache entry). Never
// `/dashboard`, which is Tutoring's. Who may continue, review or open a PDF is the server's
// (`can_continue`, `can_review`, R17): the home only links into the Assessment screens.
import { levelLabel, type CanvasAssessment } from '@tmi/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { AdaptiveRow } from '@/components/adaptive-row';
import { BadgePill } from '@/components/badge-pill';
import { EmptyNote, Panel } from '@/components/section';
import { ListSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useCanvasAssessments } from '@/features/canvas-assessments/api';
import { AssessmentRow } from '@/features/canvas-assessments/assessments-screen';
import { rowActions } from '@/features/canvas-assessments/review-model';
import { useUsers } from '@/features/users/api';
import { haptics } from '@/lib/haptics';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import {
  latestByStudent,
  recentAssessments,
  studentStatusLine,
  submittedAgo,
  waitingForReview,
} from './assessment-home-model';

/** The students list shows this many before "Show all N". */
export const STUDENTS_SHOWN = 10;

function startFor(studentId: string) {
  haptics.selection();
  router.push({ pathname: '/assessments', params: { student: studentId } });
}

export function AssessmentHome() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes('admin');
  const onlyStudent = roles.length > 0 && roles.every((role) => role === 'student');
  const list = useCanvasAssessments();
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const reviews = isAdmin || rows.some((row) => row.can_review);

  return (
    <View testID="assessment-home" style={{ gap: space.lg }}>
      <StudentsPanel rows={rows} rowsPending={list.isPending} isAdmin={isAdmin} onlyStudent={onlyStudent} />
      {reviews ? <WaitingPanel rows={rows} pending={list.isPending} /> : null}
      <RecentPanel rows={rows} pending={list.isPending} error={list.isError ? list.error : null} retry={() => void list.refetch()} />
    </View>
  );
}

function StudentsPanel({
  rows,
  rowsPending,
  isAdmin,
  onlyStudent,
}: {
  rows: CanvasAssessment[];
  rowsPending: boolean;
  isAdmin: boolean;
  onlyStudent: boolean;
}) {
  const { user } = useAuth();
  const isParent = user?.roles.includes('parent') ?? false;
  const students = useUsers(
    { role: 'student', limit: 100, sort: 'full_name', order: 'asc' },
    { enabled: !onlyStudent },
  );
  const [showAll, setShowAll] = useState(false);
  const latest = useMemo(() => latestByStudent(rows), [rows]);

  const title = onlyStudent ? 'Your assessments' : !isAdmin && isParent ? 'Your children' : 'Students';
  const people = onlyStudent
    ? user
      ? [{ id: user.id, full_name: user.full_name }]
      : []
    : (students.data?.data ?? []).map((student) => ({ id: student.id, full_name: student.full_name }));
  const shown = showAll ? people : people.slice(0, STUDENTS_SHOWN);
  const pending = rowsPending || (!onlyStudent && students.isPending);

  return (
    <Panel
      title={title}
      testID="assess-home-students"
      tourId="dash-assess-students"
    >
      {pending ? (
        <ListSkeleton label="Loading the students…" count={2} />
      ) : !onlyStudent && students.isError ? (
        <ErrorState error={students.error} onRetry={() => void students.refetch()} />
      ) : people.length === 0 ? (
        <View style={{ alignItems: 'center' }}>
          <EmptyNote>No students yet.</EmptyNote>
          {isAdmin ? (
            <Button testID="assess-home-add-student" mode="contained-tonal" onPress={() => router.push('/add-student')}>
              Add a student
            </Button>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {shown.map((person) => (
            <StudentRow key={person.id} id={person.id} name={person.full_name} latest={latest.get(person.id)} />
          ))}
          {!showAll && people.length > STUDENTS_SHOWN ? (
            <Button
              testID="assess-home-students-more"
              mode="text"
              onPress={() => setShowAll(true)}
              style={{ alignSelf: 'flex-start' }}
            >
              {`Show all ${people.length}`}
            </Button>
          ) : null}
        </View>
      )}
    </Panel>
  );
}

function StudentRow({ id, name, latest }: { id: string; name: string; latest: CanvasAssessment | undefined }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const canContinue = Boolean(latest && latest.status === 'in_progress' && latest.can_continue);
  return (
    <AdaptiveRow testID={`assess-home-student-${id}`} align="center" justify="space-between">
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="titleSmall">{name}</Text>
        <Text
          testID={`assess-home-status-${id}`}
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
        >
          {studentStatusLine(latest, timeZone)}
        </Text>
      </View>
      {canContinue && latest ? (
        <Button
          testID={`assess-home-continue-${id}`}
          mode="contained"
          compact
          onPress={() => {
            haptics.selection();
            router.push({ pathname: '/assessments/[id]', params: { id: latest.id } });
          }}
        >
          Continue
        </Button>
      ) : (
        <Button testID={`assess-home-start-${id}`} mode="contained-tonal" compact onPress={() => startFor(id)}>
          Start an assessment
        </Button>
      )}
    </AdaptiveRow>
  );
}

function WaitingPanel({ rows, pending }: { rows: CanvasAssessment[]; pending: boolean }) {
  const theme = useAppTheme();
  const waiting = useMemo(() => waitingForReview(rows), [rows]);
  return (
    <Panel title="Waiting for review" testID="assess-home-waiting" tourId="dash-assess-waiting">
      {pending ? (
        <ListSkeleton label="Loading the assessments…" count={1} />
      ) : waiting.length === 0 ? (
        <EmptyNote>Nothing waiting for review.</EmptyNote>
      ) : (
        <View style={{ gap: space.md }}>
          {waiting.map((row) => (
            <AdaptiveRow key={row.id} testID={`assess-home-waiting-${row.id}`} align="center" justify="space-between">
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="titleSmall">{row.student_name}</Text>
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {`${levelLabel(row.level_id)} · ${submittedAgo(row)}`}
                </Text>
              </View>
              <Button
                testID={`assess-home-review-${row.id}`}
                mode="contained"
                compact
                icon="draw-pen"
                onPress={() => {
                  haptics.selection();
                  router.push({ pathname: '/assessments/review/[id]', params: { id: row.id } });
                }}
              >
                {rowActions(row).review ?? 'Review'}
              </Button>
            </AdaptiveRow>
          ))}
        </View>
      )}
    </Panel>
  );
}

function RecentPanel({
  rows,
  pending,
  error,
  retry,
}: {
  rows: CanvasAssessment[];
  pending: boolean;
  error: Error | null;
  retry: () => void;
}) {
  const recent = useMemo(() => recentAssessments(rows), [rows]);
  return (
    <Panel testID="assess-home-recent" tourId="dash-assess-recent">
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="titleSmall" accessibilityRole="header" style={{ flex: 1 }}>
            Recent assessments
          </Text>
          <BadgePill testID="assess-home-beta" />
        </View>
        {pending ? (
          <ListSkeleton label="Loading the assessments…" count={2} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} />
        ) : recent.length === 0 ? (
          <EmptyNote>No assessments yet.</EmptyNote>
        ) : (
          recent.map((row) => <AssessmentRow key={row.id} row={row} />)
        )}
        <Button
          testID="assess-home-all"
          mode="text"
          onPress={() => router.navigate('/assessments')}
          style={{ alignSelf: 'flex-start' }}
        >
          All assessments
        </Button>
      </View>
    </Panel>
  );
}

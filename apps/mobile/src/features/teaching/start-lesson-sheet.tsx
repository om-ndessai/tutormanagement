// Ported from apps/web/src/features/teaching/start-session-button.tsx @ 1132322 (the dialog). The
// dialog becomes a form sheet, `(org)/start-lesson`, opened from the Sessions tab's "Start a lesson".
//
// Phase 75 (docs/journey-fixes-plan.md JF18, JF30): every Start opens this sheet in place (the quick action, Next up's
// Start lesson, Sessions, the (+)), with the lesson's student and mode chosen; the server refuses a lesson it cannot
// price up front, in the reader's words ("Ask the office to set Yusuf's price."), said here once -- never a toast
// under the sheet; with a lesson running it says which, and offers to stop it. "Lesson", never "session".
import { SESSION_MODES, SESSION_MODE_LABELS, type SessionMode } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, HelperText, Icon, SegmentedButtons, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { ListSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useActiveSession, useAssignments, useStartSession } from './api';
import { askForLiveSurfacePermission } from './live-surface';
import { failureLines } from './refusal';

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * "When the session is to start, the tutor could click the start session button and select
 * student." The tutor's own pairings only: an admin who is not teaching has nothing to start.
 */
export function StartLessonSheet({
  initialStudent,
  initialMode,
}: {
  /** Chosen already, from Home's Next up card (#43); ignored unless it is one of the tutor's own. */
  initialStudent?: string;
  initialMode?: SessionMode;
} = {}) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const muted = theme.tokens.mutedForeground;

  const [picked, setStudentId] = useState('');
  const [mode, setMode] = useState<SessionMode>(initialMode ?? 'in_person');
  const [errors, setErrors] = useState<string[]>([]);

  const active = useActiveSession();
  const assignments = useAssignments({ tutor_user_id: user?.id });
  const start = useStartSession();
  const students = assignments.data?.data ?? [];
  // A tap wins; until then, the student the sheet was opened for, once the pairings show it is theirs.
  const studentId =
    picked ||
    (initialStudent && students.some((a) => a.student_user_id === initialStudent) ? initialStudent : '');
  const runningLesson = active.data?.data.mine ?? null;
  const running = Boolean(runningLesson);

  async function handleStart() {
    if (!studentId) {
      setErrors(['Choose a student.']);
      haptics.error();
      return;
    }
    setErrors([]);
    try {
      await start.mutateAsync({ student_user_id: studentId, mode });
      // A physical cue that the clock is running; the banner takes it from here.
      haptics.impact();
      toast.info('Lesson started.');
      close();
      // The moment to ask for Android's notification permission (#45): never at launch.
      void askForLiveSurfacePermission();
    } catch (failure) {
      // Said here, once (JF18): a toast would sit under the sheet, and the mode's detail repeats the message.
      haptics.error();
      setErrors(failureLines(failure, 'Could not start the lesson.'));
    }
  }

  let body;
  if (assignments.isPending) body = <ListSkeleton label="Loading your students…" count={3} height={48} />;
  else if (assignments.isError) {
    body = <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />;
  } else if (running) {
    body = (
      <View testID="start-running" style={{ gap: space.md }}>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {`Your lesson with ${runningLesson!.student_name} is still running. Stop it before starting another.`}
        </Text>
        <Button
          testID="start-stop-running"
          mode="contained-tonal"
          icon="stop"
          contentStyle={{ minHeight: 48 }}
          onPress={() => {
            haptics.selection();
            router.replace('/stop-lesson');
          }}
        >
          Stop that lesson
        </Button>
      </View>
    );
  } else {
    body = (
      <>
        <View style={{ gap: space.xs }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            Student
          </Text>
          {students.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: muted }}>
              You have no students assigned. An admin assigns students to tutors.
            </Text>
          ) : (
            <View
              accessibilityRole="radiogroup"
              style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: radius.md }}
            >
              {students.map((assignment, index) => {
                const selected = assignment.student_user_id === studentId;
                return (
                  <View key={assignment.id}>
                    {index > 0 ? <Divider /> : null}
                    <Pressable
                      testID={`start-student-${assignment.student_user_id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        haptics.selection();
                        setStudentId(assignment.student_user_id);
                        setErrors([]);
                      }}
                      style={({ pressed }) => ({
                        minHeight: MIN_TARGET + 4,
                        paddingHorizontal: space.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        backgroundColor: selected
                          ? theme.colors.secondaryContainer
                          : pressed
                            ? theme.tokens.muted
                            : 'transparent',
                      })}
                    >
                      <Icon
                        source={selected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={20}
                        color={selected ? theme.colors.primary : muted}
                      />
                      <Text variant="bodyLarge">{assignment.student_name}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ gap: space.xs }}>
          <Text variant="bodySmall" style={{ color: muted }}>
            Mode
          </Text>
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => {
              haptics.selection();
              setMode(value as SessionMode);
              // A price missing for one mode may be set for the other.
              setErrors([]);
            }}
            buttons={SESSION_MODES.map((value) => ({
              value,
              label: SESSION_MODE_LABELS[value],
              testID: `start-mode-${value}`,
            }))}
          />
        </View>

        {errors.length > 0 ? (
          <View testID="start-error">
            {errors.map((line) => (
              <HelperText key={line} type="error" padding="none">
                {line}
              </HelperText>
            ))}
          </View>
        ) : null}
        <Button
          testID="start-submit"
          mode="contained"
          icon="play"
          onPress={() => void handleStart()}
          loading={start.isPending}
          disabled={start.isPending || students.length === 0}
        >
          Start now
        </Button>
      </>
    );
  }

  return (
    <Screen testID="screen-start-lesson" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          Start a lesson
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          The clock starts now. Both the start and the end are recorded to the nearest quarter hour.
        </Text>
      </View>
      {body}
      <Button testID="start-cancel" mode="outlined" onPress={close} disabled={start.isPending}>
        Cancel
      </Button>
    </Screen>
  );
}

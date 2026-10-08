// Ported from apps/web/src/features/teaching/start-session-button.tsx @ 1132322 (the dialog). The
// dialog becomes a form sheet, `(org)/start-lesson`, opened from the Sessions tab's "Start a lesson".
import { SESSION_MODES, SESSION_MODE_LABELS, type SessionMode } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Divider, HelperText, Icon, SegmentedButtons, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useActiveSession, useAssignments, useStartSession } from './api';

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * "When the session is to start, the tutor could click the start session button and select
 * student." The tutor's own pairings only: an admin who is not teaching has nothing to start.
 */
export function StartLessonSheet() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const muted = theme.tokens.mutedForeground;

  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState<SessionMode>('in_person');
  const [error, setError] = useState<string | null>(null);

  const active = useActiveSession();
  const assignments = useAssignments({ tutor_user_id: user?.id });
  const start = useStartSession();
  const students = assignments.data?.data ?? [];
  const running = Boolean(active.data?.data.mine);

  async function handleStart() {
    if (!studentId) {
      setError('Choose a student.');
      haptics.error();
      return;
    }
    setError(null);
    try {
      await start.mutateAsync({ student_user_id: studentId, mode });
      // A physical cue that the clock is running; the banner takes it from here.
      haptics.impact();
      toast.info('Session started.');
      close();
    } catch (failure) {
      const message =
        failure instanceof ApiRequestError
          ? (failure.fieldErrors.student_user_id ?? failure.message)
          : 'Could not start the session.';
      setError(message);
      toast.error(message);
    }
  }

  let body;
  if (assignments.isPending) body = <LoadingState label="Loading your students…" />;
  else if (assignments.isError) {
    body = <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />;
  } else if (running) {
    body = (
      <Text variant="bodyMedium" style={{ color: muted }}>
        You already have a session running. Stop it before starting another.
      </Text>
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
                        setError(null);
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
            }}
            buttons={SESSION_MODES.map((value) => ({
              value,
              label: SESSION_MODE_LABELS[value],
              testID: `start-mode-${value}`,
            }))}
          />
        </View>

        {error ? (
          <HelperText testID="start-error" type="error" padding="none">
            {error}
          </HelperText>
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
          Start a session
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

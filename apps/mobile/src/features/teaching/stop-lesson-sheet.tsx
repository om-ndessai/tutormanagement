// Ported from apps/web/src/features/teaching/live-session-bar.tsx @ 1132322 (StopDialog). The
// dialog becomes a form sheet, `(org)/stop-lesson`, opened from the live lesson banner's Stop.
import { formatClockTime, formatDuration, stopSessionSchema, type ActiveSession } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useActiveSession, useStopSession } from './api';
import { stopToast } from './live-session';
import { NoteField } from './session-notes';

function close() {
  if (router.canGoBack()) router.back();
}

export function StopLessonSheet() {
  const theme = useAppTheme();
  const active = useActiveSession();
  // Held once it has loaded: stopping refetches the live lesson (now none) while this sheet is
  // still sliding away, and it should not flash "no session running" on its way out.
  const [held, setHeld] = useState<ActiveSession | null>(null);
  const current = active.data?.data.mine ?? null;
  if (current && current.started_at !== held?.started_at) setHeld(current);
  const mine = held ?? current;

  let body;
  if (active.isPending) body = <LoadingState label="Loading the lesson…" />;
  else if (!mine) {
    // Stopped elsewhere (another device, or the limit) since the banner was pressed.
    body = (
      <View style={{ gap: space.md }}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          You have no session running.
        </Text>
        <Button mode="outlined" onPress={close}>
          Close
        </Button>
      </View>
    );
  } else {
    body = <StopForm key={mine.started_at} active={mine} />;
  }

  return (
    <Screen testID="screen-stop-lesson" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

/**
 * "The tutor can record session details at that time or can edit those later." Notes are offered
 * here but never required.
 */
function StopForm({ active }: { active: ActiveSession }) {
  const theme = useAppTheme();
  const toast = useToast();
  const stop = useStopSession();
  const [notes, setNotes] = useState(active.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const muted = theme.tokens.mutedForeground;

  async function handleStop() {
    setError(null);
    const parsed = stopSessionSchema.safeParse({ notes: notes.trim() || null });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the notes.');
      return;
    }
    try {
      const result = await stop.mutateAsync(parsed.data);
      // The times and the length, never the money: said with the student beside the tutor.
      toast.success(stopToast(result.data));
      close();
    } catch (failure) {
      const message =
        failure instanceof ApiRequestError
          ? (failure.fieldErrors.notes ?? failure.message)
          : 'Could not stop the session.';
      setError(message);
      toast.error(message);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          End the session with {active.student_name}?
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          The start is recorded to the nearest quarter hour, so this will be logged from{' '}
          {formatClockTime(active.rounded_start)}, and billed for however long it ran, rounded the same way —
          up to the {formatDuration(active.max_minutes)} limit for this pairing. You can edit the details
          afterwards.
        </Text>
      </View>
      <View style={{ gap: space.xs }}>
        <NoteField
          testID="stop-notes"
          label="Session notes"
          value={notes}
          onChange={setNotes}
          placeholder="What was covered, how it went, progress towards their goal, homework set…"
          error={error ?? undefined}
          long
        />
        {!error ? (
          <HelperText type="info" padding="none">
            Optional. The rest of the write-up — the plan, the homework and your assessment — can be added by
            editing the session afterwards.
          </HelperText>
        ) : null}
      </View>
      <View style={{ gap: space.sm }}>
        <Button
          testID="stop-submit"
          mode="contained"
          icon="stop"
          onPress={() => void handleStop()}
          loading={stop.isPending}
          disabled={stop.isPending}
        >
          End and record
        </Button>
        <Button testID="stop-keep-going" mode="outlined" onPress={close} disabled={stop.isPending}>
          Keep going
        </Button>
      </View>
    </View>
  );
}

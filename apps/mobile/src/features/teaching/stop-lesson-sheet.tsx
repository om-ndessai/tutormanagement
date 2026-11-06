// Ported from apps/web/src/features/teaching/live-session-bar.tsx @ 1132322 (StopDialog). The
// dialog becomes a form sheet, `(org)/stop-lesson`, opened from the live lesson banner's Stop.
//
// Phase 75 (docs/journey-fixes-plan.md JF18, JF30): a refused stop says everything, once -- the server's message
// ("Ask the office to set Yusuf's price.") and any other field's error, as text in the sheet, never a toast under it
// -- and loses nothing: the server keeps the typed note on the running lesson before pricing, and "Keep going" saves
// a changed note (`PATCH /sessions/active`) before it closes, so the sheet opens on it next time. Next up's
// `lesson_running` opens it too. "Lesson", never "session".
import {
  formatClockTime,
  formatDuration,
  stopSessionSchema,
  updateActiveSessionSchema,
  type ActiveSession,
} from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { FormSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useActiveSession, useStopSession, useUpdateActiveSession } from './api';
import { stopToast } from './live-session';
import { failureLines } from './refusal';
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
  if (active.isPending) body = <FormSkeleton label="Loading the lesson…" fields={2} />;
  else if (!mine) {
    // Stopped elsewhere (another device, or the limit) since the banner was pressed.
    body = (
      <View style={{ gap: space.md }}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          You have no lesson running.
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
  const queryClient = useQueryClient();
  const stop = useStopSession();
  const update = useUpdateActiveSession();
  // The note as the running lesson holds it -- typed before, or kept by a refused stop.
  const [notes, setNotes] = useState(active.notes ?? '');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string[]>([]);
  const muted = theme.tokens.mutedForeground;
  const busy = stop.isPending || update.isPending;

  async function handleStop() {
    setNotesError(null);
    setRefusal([]);
    const parsed = stopSessionSchema.safeParse({ notes: notes.trim() || null });
    if (!parsed.success) {
      setNotesError(parsed.error.issues[0]?.message ?? 'Check the notes.');
      return;
    }
    try {
      const result = await stop.mutateAsync(parsed.data);
      // The times and the length, never the money: said with the student beside the tutor.
      toast.success(stopToast(result.data));
      close();
    } catch (failure) {
      haptics.error();
      // The server kept the note on the running lesson before refusing: read it again, so the next open shows it.
      void queryClient.invalidateQueries({ queryKey: ['active-session'] });
      // The notes' own complaint under the notes; everything else once, as text above the buttons (JF18).
      if (failure instanceof ApiRequestError && failure.fieldErrors.notes) setNotesError(failure.fieldErrors.notes);
      setRefusal(
        failure instanceof ApiRequestError && failure.fieldErrors.notes && failure.message === failure.fieldErrors.notes
          ? []
          : failureLines(failure, 'Could not stop the lesson.', ['notes']),
      );
    }
  }

  /** "Keep going": a changed note is kept on the running lesson first, so the next Stop opens on it. */
  async function keepGoing() {
    const typed = notes.trim() || null;
    if (typed === ((active.notes ?? '').trim() || null)) {
      close();
      return;
    }
    const parsed = updateActiveSessionSchema.safeParse({ notes: typed });
    if (!parsed.success) {
      setNotesError(parsed.error.issues[0]?.message ?? 'Check the notes.');
      return;
    }
    try {
      await update.mutateAsync(parsed.data);
      close();
    } catch (failure) {
      haptics.error();
      setRefusal(failureLines(failure, 'Could not keep the notes. Try again.', ['notes']));
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          End the lesson with {active.student_name}?
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
          label="Lesson notes"
          value={notes}
          onChange={setNotes}
          placeholder="What was covered, how it went, progress towards their goal, homework set…"
          error={notesError ?? undefined}
          long
        />
        {!notesError ? (
          <HelperText type="info" padding="none">
            Optional. The rest of the write-up — the plan, the homework and your assessment — can be added by
            editing the lesson afterwards.
          </HelperText>
        ) : null}
      </View>
      {refusal.length > 0 ? (
        <View testID="stop-error">
          {refusal.map((line) => (
            <HelperText key={line} type="error" padding="none">
              {line}
            </HelperText>
          ))}
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Button
          testID="stop-submit"
          mode="contained"
          icon="stop"
          onPress={() => void handleStop()}
          loading={stop.isPending}
          disabled={busy}
        >
          End and record
        </Button>
        <Button
          testID="stop-keep-going"
          mode="outlined"
          onPress={() => void keepGoing()}
          loading={update.isPending}
          disabled={busy}
        >
          Keep going
        </Button>
      </View>
    </View>
  );
}

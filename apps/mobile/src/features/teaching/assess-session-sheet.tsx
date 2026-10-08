// Ported from apps/web/src/features/teaching/session-notes.tsx @ 1132322 (SessionAssessmentDialog).
// The dialog becomes a form sheet, `(org)/assess-session?session=<id>`.
import { sessionAssessmentInputSchema, type Rating, type TutoringSession } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useSaveSessionAssessment, useSession, useWithdrawSessionAssessment } from './api';
import { issuesToErrors } from './session-form/use-session-form';
import { AssessmentFields, likelyAssessorRole } from './session-notes';

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * Gives, revises or withdraws the reader's own assessment of a lesson. Loaded through the
 * ordinary scoped read, so a lesson the reader may not see is "not found". Nobody else's
 * assessment can be touched here: the routes take no author.
 */
export function AssessSessionSheet({ sessionId }: { sessionId: string | undefined }) {
  const lesson = useSession(sessionId ?? null);

  let body;
  if (!sessionId) body = <ErrorState error={new ApiRequestError(404, 'not_found', 'No lesson given.')} />;
  else if (lesson.isPending) body = <LoadingState label="Loading the lesson…" />;
  else if (lesson.isError || !lesson.data) {
    body = <ErrorState error={lesson.error} onRetry={() => void lesson.refetch()} />;
  } else {
    // Keyed on the lesson: the fields start from the reader's own assessment, once.
    body = <AssessForm key={lesson.data.data.id} session={lesson.data.data} />;
  }

  return (
    <Screen testID="screen-assess-session" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

export function AssessForm({ session }: { session: TutoringSession }) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSaveSessionAssessment();
  const withdraw = useWithdrawSessionAssessment();

  const mine = session.assessments.find((row) => row.author_user_id === user?.id) ?? null;
  const role = mine?.author_role ?? (user ? likelyAssessorRole(session, user) : 'admin');
  // The lesson's student reflects instead (Phase 25): one they gave before may only be withdrawn.
  const isStudent = user ? session.student_user_id === user.id : false;

  const [rating, setRating] = useState<Rating | null>(mine?.rating ?? null);
  const [body, setBody] = useState(mine?.body ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = save.isPending || withdraw.isPending;
  const muted = theme.tokens.mutedForeground;

  async function handleSave() {
    setErrors({});
    const input = { rating, body: body.trim() || null };
    const parsed = sessionAssessmentInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      haptics.error();
      return;
    }
    try {
      await save.mutateAsync({ sessionId: session.id, input });
      toast.success(mine ? 'Assessment updated.' : 'Assessment saved.');
      close();
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save the assessment.');
    }
  }

  async function handleWithdraw() {
    haptics.warning();
    try {
      await withdraw.mutateAsync(session.id);
      toast.success('Assessment withdrawn.');
      close();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not withdraw the assessment.');
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {mine ? 'Your assessment' : 'Assess this session'}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {session.student_name} with {session.tutor_name}, {session.occurred_on}. Everyone this lesson
          concerns can read it: its tutor, the student, their parents and the office.
        </Text>
      </View>

      {isStudent ? (
        <Text testID="assess-student-note" variant="bodyMedium" style={{ color: muted }}>
          A student reflects on a lesson rather than assessing it: use Reflect instead.
        </Text>
      ) : (
        <AssessmentFields
          testID="assess"
          role={role}
          rating={rating}
          onRating={setRating}
          body={body}
          onBody={setBody}
          errors={{ rating: errors.rating, body: errors.body }}
        />
      )}
      {errors.form ? (
        <HelperText type="error" padding="none">
          {errors.form}
        </HelperText>
      ) : null}

      <View style={{ gap: space.sm }}>
        {!isStudent ? (
          <Button
            testID="assess-save"
            mode="contained"
            onPress={() => void handleSave()}
            loading={save.isPending}
            disabled={busy}
          >
            Save assessment
          </Button>
        ) : null}
        {/* Only ever the reader's own: there is no way to remove anybody else's. */}
        {mine ? (
          <Button
            testID="assess-withdraw"
            mode="text"
            textColor={theme.colors.error}
            onPress={() => void handleWithdraw()}
            loading={withdraw.isPending}
            disabled={busy}
          >
            Withdraw
          </Button>
        ) : null}
        <Button testID="assess-cancel" mode="outlined" onPress={close} disabled={busy}>
          Cancel
        </Button>
      </View>
    </View>
  );
}

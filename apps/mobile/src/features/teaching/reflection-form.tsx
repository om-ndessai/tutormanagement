// Ported from apps/web/src/features/teaching/session-reflection.tsx @ 1132322 (ReflectionFields,
// ReflectionDialog) -- the dialog becomes a form sheet, `(org)/reflection`.
import {
  REFLECTION_QUESTIONS,
  sessionReflectionInputSchema,
  type Rating,
  type ReflectionKey,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { RatingPicker } from '@/features/progress/rating';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useSaveReflection, useSession, useWithdrawReflection } from './api';
import { firstName, likelyReflectorRole, mayChangeReflection } from './reflection-logic';

type Answers = Record<ReflectionKey, Rating | null>;

const NO_ANSWERS: Answers = { learned_new: null, difficulty: null, understanding: null, pace: null };

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * The reflection sheet: loads the lesson through the ordinary scoped read (a lesson the reader
 * may not see answers 404, shown as "not found"), then offers the questions to whoever may change
 * the reflection. An adult, once the student has entered their own, gets a note instead -- the
 * API refuses the same.
 */
export function ReflectionSheet({ sessionId }: { sessionId: string | undefined }) {
  const { user } = useAuth();
  const lesson = useSession(sessionId ?? null);

  let body;
  if (!sessionId) body = <ErrorState error={new Error('No lesson given.')} />;
  else if (lesson.isPending) body = <LoadingState label="Loading the lesson…" />;
  else if (lesson.isError || !lesson.data) {
    body = <ErrorState error={lesson.error} onRetry={() => void lesson.refetch()} />;
  } else if (!mayChangeReflection(lesson.data.data, user)) {
    body = <ReadOnlyNote session={lesson.data.data} />;
  } else {
    // Keyed on the lesson: the form's state starts from its reflection, once.
    body = <ReflectionForm key={lesson.data.data.id} session={lesson.data.data} />;
  }

  return (
    <Screen testID="screen-reflection" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

function ReadOnlyNote({ session }: { session: TutoringSession }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: space.md }}>
      <Text variant="titleLarge">{firstName(session.student_name)}’s reflection</Text>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {session.reflection?.entered_as === 'student'
          ? `${firstName(session.student_name)} entered this reflection, so it is theirs to change.`
          : 'You cannot enter a reflection on this lesson.'}
      </Text>
      <Button mode="outlined" onPress={close}>
        Close
      </Button>
    </View>
  );
}

function ReflectionForm({ session }: { session: TutoringSession }) {
  const { user } = useAuth();
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSaveReflection();
  const withdraw = useWithdrawReflection();

  const current = session.reflection;
  const [answers, setAnswers] = useState<Answers>(
    current
      ? {
          learned_new: current.learned_new,
          difficulty: current.difficulty,
          understanding: current.understanding,
          pace: current.pace,
        }
      : NO_ANSWERS,
  );
  const [homeworkNotes, setHomeworkNotes] = useState(current?.homework_notes ?? '');
  const [comment, setComment] = useState(current?.comment ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const forStudent = user ? likelyReflectorRole(session, user) === 'student' : false;
  const name = firstName(session.student_name);
  const busy = save.isPending || withdraw.isPending;

  async function handleSave() {
    setErrors({});
    const input = {
      ...answers,
      homework_notes: homeworkNotes.trim() || null,
      comment: comment.trim() || null,
    };
    const parsed = sessionReflectionInputSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'learned_new');
        next[key] ??= issue.message;
      }
      setErrors(next);
      toast.error(parsed.error.issues[0]?.message ?? 'Check the answers.');
      return;
    }
    try {
      await save.mutateAsync({ sessionId: session.id, input });
      toast.success(forStudent ? 'Thanks — your reflection is saved.' : 'Reflection saved.');
      close();
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save the reflection.');
    }
  }

  async function handleWithdraw() {
    try {
      await withdraw.mutateAsync(session.id);
      toast.success('Reflection withdrawn.');
      close();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not withdraw the reflection.');
    }
  }

  const muted = theme.tokens.mutedForeground;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {forStudent ? 'How did this lesson go for you?' : `${name}’s reflection`}
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          The {session.occurred_on} lesson with {session.tutor_name}.{' '}
          {forStudent
            ? 'Your tutor, your parents and the office can read it.'
            : `You are entering this for ${name}, in ${name}’s words. The tutor, the family and the office can read it, and ${name} can change it later.`}
        </Text>
      </View>

      {REFLECTION_QUESTIONS.map((question) => {
        const prompt = forStudent ? question.ask : question.askAbout(name);
        const value = answers[question.key];
        return (
          <View key={question.key} testID={`reflection-question-${question.key}`} style={{ gap: 6 }}>
            <Text variant="bodyLarge">{prompt}</Text>
            <RatingPicker
              testID={`reflection-${question.key}`}
              name={prompt}
              value={value}
              onChange={(next) => setAnswers((before) => ({ ...before, [question.key]: next }))}
              labels={question.labels}
              neutral={question.centred}
            />
            <Text variant="bodySmall" style={{ color: muted }}>
              {value ? question.labels[value] : `${question.labels[1]} … ${question.labels[5]}`}
            </Text>
            {errors[question.key] ? (
              <HelperText type="error" padding="none">
                {errors[question.key]}
              </HelperText>
            ) : null}
          </View>
        );
      })}

      <View>
        <TextInput
          testID="reflection-homework"
          mode="outlined"
          label="Homework notes"
          value={homeworkNotes}
          onChangeText={setHomeworkNotes}
          multiline
          // Short notes: Return closes the keyboard, which otherwise covers Save in the sheet.
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholder={
            forStudent
              ? 'Anything about the homework: what was hard, what you finished'
              : `Anything ${name} said about the homework`
          }
          error={Boolean(errors.homework_notes)}
        />
        {errors.homework_notes ? <HelperText type="error">{errors.homework_notes}</HelperText> : null}
      </View>
      <View>
        <TextInput
          testID="reflection-comment"
          mode="outlined"
          label="Anything else"
          value={comment}
          onChangeText={setComment}
          multiline
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholder="Optional"
          error={Boolean(errors.comment)}
        />
        {errors.comment ? <HelperText type="error">{errors.comment}</HelperText> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Button
          testID="reflection-save"
          mode="contained"
          onPress={() => void handleSave()}
          loading={save.isPending}
          disabled={busy}
        >
          Save reflection
        </Button>
        <Button testID="reflection-cancel" mode="outlined" onPress={close} disabled={busy}>
          Cancel
        </Button>
        {current ? (
          <Button
            testID="reflection-withdraw"
            mode="text"
            textColor={theme.colors.error}
            onPress={() => void handleWithdraw()}
            disabled={busy}
          >
            Withdraw
          </Button>
        ) : null}
      </View>
    </View>
  );
}

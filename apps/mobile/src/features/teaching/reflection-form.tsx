// Ported from apps/web/src/features/teaching/session-reflection.tsx @ 1132322 (ReflectionFields,
// ReflectionDialog) -- the dialog becomes a form sheet, `(org)/reflection`.
//
// UI upgrades U4: one question per card, answered with five faces and their words, progress dots
// over the cards, then the homework note, then a thank-you. The questions are shared's
// (`REFLECTION_QUESTIONS`); the faces and their words are `reflection-faces.ts`. The stored answers
// are unchanged: 1-5, every one optional, and the same `PUT /sessions/:id/reflection`.
//
// A reflection is the student's: once they have entered it themselves, an adult sees it read-only
// (the API refuses the same). Difficulty and pace are centred on "About right" and coloured
// symmetrically, never darker for a higher value.
import {
  REFLECTION_QUESTIONS,
  sessionReflectionInputSchema,
  type Rating,
  type ReflectionKey,
  type TutoringSession,
} from '@tmi/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';

import { FieldError } from '@/components/field-error';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { FormSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { useDirty, useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useSaveReflection, useSession, useWithdrawReflection } from './api';
import { faceColours } from './reflection-face-colours';
import { faceFor, facesFor, faceWord } from './reflection-faces';
import { firstName, likelyReflectorRole, mayChangeReflection } from './reflection-logic';

type Answers = Record<ReflectionKey, Rating | null>;

const NO_ANSWERS: Answers = { learned_new: null, difficulty: null, understanding: null, pace: null };

/** The four questions, then the homework note: the cards the dots count. */
const CARD_COUNT = REFLECTION_QUESTIONS.length + 1;
const HOMEWORK_CARD = REFLECTION_QUESTIONS.length;

function close() {
  if (router.canGoBack()) router.back();
}

/**
 * The reflection sheet: loads the lesson through the ordinary scoped read (a lesson the reader
 * may not see answers 404, shown as "not found"), then offers the questions to whoever may change
 * the reflection. An adult, once the student has entered their own, reads it instead -- the API
 * refuses the same.
 */
export function ReflectionSheet({ sessionId }: { sessionId: string | undefined }) {
  const { user } = useAuth();
  const lesson = useSession(sessionId ?? null);

  let body;
  if (!sessionId) body = <ErrorState error={new Error('No lesson given.')} />;
  else if (lesson.isPending) body = <FormSkeleton label="Loading the lesson…" fields={4} />;
  else if (lesson.isError || !lesson.data) {
    body = <ErrorState error={lesson.error} onRetry={() => void lesson.refetch()} />;
  } else if (!mayChangeReflection(lesson.data.data, user)) {
    body = <ReadOnlyReflection session={lesson.data.data} />;
  } else {
    // Keyed on the lesson: the cards' state starts from its reflection, once.
    body = <ReflectionCards key={lesson.data.data.id} session={lesson.data.data} />;
  }

  return (
    <Screen testID="screen-reflection" edges={['bottom']} contentStyle={{ paddingTop: space.xl }}>
      {body}
    </Screen>
  );
}

/** One face: a disc with the face drawn in it, and its word under it. */
function FaceButton({
  questionKey,
  value,
  selected,
  onPress,
  disabled = false,
}: {
  questionKey: ReflectionKey;
  value: Rating;
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const face = faceFor(questionKey, value);
  const colours = faceColours(theme, face.tone);
  return (
    <Pressable
      testID={`reflection-${questionKey}-${value}`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={face.word}
      accessibilityState={{ checked: selected, disabled }}
      style={{ flex: 1, alignItems: 'center', gap: space.xs, paddingVertical: space.xs, minHeight: 88 }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colours.border : theme.colors.outlineVariant,
          backgroundColor: selected ? colours.fill : 'transparent',
        }}
      >
        <Icon source={face.icon} size={32} color={selected ? colours.ink : theme.tokens.mutedForeground} />
      </View>
      <Text
        variant="labelMedium"
        numberOfLines={2}
        style={{
          textAlign: 'center',
          color: selected ? theme.colors.onSurface : theme.tokens.mutedForeground,
          fontWeight: selected ? '700' : '400',
        }}
      >
        {face.word}
      </Text>
    </Pressable>
  );
}

/** The five faces for one question, as a radio group. Tapping the chosen face again clears it. */
function FaceRow({
  questionKey,
  name,
  value,
  onChange,
}: {
  questionKey: ReflectionKey;
  name: string;
  value: Rating | null;
  onChange?: (value: Rating | null) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={{ flexDirection: 'row', gap: 2 }}>
      {facesFor(questionKey).map((face) => (
        <FaceButton
          key={face.value}
          questionKey={questionKey}
          value={face.value}
          selected={value === face.value}
          disabled={!onChange}
          onPress={
            onChange
              ? () => {
                  haptics.selection();
                  onChange(value === face.value ? null : face.value);
                }
              : undefined
          }
        />
      ))}
    </View>
  );
}

/** Where the reader is among the cards: filled dots up to the current one. */
function ProgressDots({ current }: { current: number }) {
  const theme = useAppTheme();
  return (
    <View
      testID="reflection-dots"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Card ${current + 1} of ${CARD_COUNT}`}
      accessibilityValue={{ min: 1, max: CARD_COUNT, now: current + 1 }}
      style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}
    >
      {Array.from({ length: CARD_COUNT }, (_, index) => (
        <View
          key={index}
          style={{
            width: index === current ? 22 : 10,
            height: 10,
            borderRadius: radius.pill,
            backgroundColor: index <= current ? theme.colors.primary : theme.colors.outlineVariant,
          }}
        />
      ))}
    </View>
  );
}

function ReflectionCards({ session }: { session: TutoringSession }) {
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
  const [card, setCard] = useState(0);
  const [saved, setSaved] = useState(false);

  // What was typed is not lost to a swipe or Back (ux-audit F-3); once saved, nothing is.
  const changed = useDirty({ answers, homeworkNotes, comment });
  useUnsavedChangesGuard(changed && !saved);

  const forStudent = user ? likelyReflectorRole(session, user) === 'student' : false;
  const name = firstName(session.student_name);
  const busy = save.isPending || withdraw.isPending;
  const muted = theme.tokens.mutedForeground;

  // Each new card's heading takes the screen reader's focus.
  const headingRef = useRef<View>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (headingRef.current) AccessibilityInfo.sendAccessibilityEvent(headingRef.current, 'focus');
    }, 120);
    return () => clearTimeout(timer);
  }, [card, saved]);

  function go(next: number) {
    haptics.selection();
    setCard(Math.max(0, Math.min(HOMEWORK_CARD, next)));
  }

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
      haptics.error();
      return;
    }
    try {
      await save.mutateAsync({ sessionId: session.id, input });
      haptics.success();
      setSaved(true);
    } catch (error) {
      haptics.error();
      if (error instanceof ApiRequestError) {
        setErrors({ ...error.fieldErrors, form: error.message });
      } else {
        setErrors({ form: 'Could not save the reflection.' });
      }
    }
  }

  async function handleWithdraw() {
    try {
      await withdraw.mutateAsync(session.id);
      setSaved(true);
      toast.success('Reflection withdrawn.');
      close();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not withdraw the reflection.');
    }
  }

  if (saved) {
    return (
      <View testID="reflection-thanks" style={{ gap: space.lg, alignItems: 'center', paddingTop: space.xl }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(theme.tokens.celebrate, 0.16),
          }}
        >
          <Icon source="party-popper" size={48} color={theme.tokens.celebrate} />
        </View>
        <View style={{ gap: space.xs }}>
          {/* The heading alone is the element focus lands on, so it reads as itself. */}
          <View ref={headingRef} accessible accessibilityRole="header">
            <Text variant="headlineSmall" style={{ textAlign: 'center' }}>
              {forStudent ? 'Thanks — your reflection is saved.' : 'Reflection saved.'}
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ textAlign: 'center', color: muted }}>
            {forStudent
              ? `${session.tutor_name} will read it before your next lesson.`
              : `Saved for ${name}. ${name} can change it later.`}
          </Text>
        </View>
        <Button
          testID="reflection-done"
          mode="contained"
          onPress={close}
          style={{ alignSelf: 'stretch' }}
          contentStyle={{ minHeight: 48 }}
        >
          Done
        </Button>
      </View>
    );
  }

  const question = card < HOMEWORK_CARD ? REFLECTION_QUESTIONS[card]! : null;
  const prompt = question ? (forStudent ? question.ask : question.askAbout(name)) : null;
  const firstError = Object.entries(errors).find(([key]) => key !== 'form')?.[1];

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

      <ProgressDots current={card} />

      <OutlinedCard>
        <View style={{ padding: space.lg, gap: space.lg }}>
          {question ? (
            <View testID={`reflection-question-${question.key}`} style={{ gap: space.lg }}>
              <View ref={headingRef} accessible accessibilityRole="header">
                <Text variant="headlineSmall">{prompt}</Text>
              </View>
              <FaceRow
                questionKey={question.key}
                name={prompt ?? question.short}
                value={answers[question.key]}
                onChange={(next) => {
                  setErrors({});
                  setAnswers((before) => ({ ...before, [question.key]: next }));
                }}
              />
              <Text
                testID={`reflection-word-${question.key}`}
                variant="bodyLarge"
                style={{ textAlign: 'center', color: answers[question.key] ? theme.colors.onSurface : muted }}
              >
                {faceWord(question.key, answers[question.key]) ?? 'Tap a face, or skip this one.'}
              </Text>
            </View>
          ) : (
            <View testID="reflection-question-homework" style={{ gap: space.md }}>
              <View ref={headingRef} accessible accessibilityRole="header">
                <Text variant="headlineSmall">
                  {forStudent ? 'Anything about the homework?' : `Anything about ${name}’s homework?`}
                </Text>
              </View>
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
                      ? 'What was hard, what you finished'
                      : `Anything ${name} said about the homework`
                  }
                  error={Boolean(errors.homework_notes)}
                />
                {errors.homework_notes ? (
                  <FieldError padding="normal">{errors.homework_notes}</FieldError>
                ) : null}
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
                {errors.comment ? <FieldError padding="normal">{errors.comment}</FieldError> : null}
              </View>
            </View>
          )}
        </View>
      </OutlinedCard>

      {card === HOMEWORK_CARD && (firstError || errors.form) ? (
        <FieldError testID="reflection-error">{errors.form ?? firstError}</FieldError>
      ) : null}

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            testID={card === 0 ? 'reflection-cancel' : 'reflection-back'}
            mode="outlined"
            onPress={card === 0 ? close : () => go(card - 1)}
            disabled={busy}
            contentStyle={{ minHeight: 48 }}
          >
            {card === 0 ? 'Cancel' : 'Back'}
          </Button>
          {card < HOMEWORK_CARD ? (
            <Button
              testID="reflection-next"
              mode="contained"
              onPress={() => go(card + 1)}
              style={{ flex: 1 }}
              contentStyle={{ minHeight: 48 }}
            >
              {question && answers[question.key] === null ? 'Skip' : 'Next'}
            </Button>
          ) : (
            <Button
              testID="reflection-save"
              mode="contained"
              onPress={() => void handleSave()}
              loading={save.isPending}
              disabled={busy}
              style={{ flex: 1 }}
              contentStyle={{ minHeight: 48 }}
            >
              Save reflection
            </Button>
          )}
        </View>
        {current && card === HOMEWORK_CARD ? (
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

/**
 * The student's own reflection, as an adult reads it once the student has entered it: the faces
 * they chose, their note, and why it cannot be changed here.
 */
function ReadOnlyReflection({ session }: { session: TutoringSession }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const name = firstName(session.student_name);
  const reflection = session.reflection;
  return (
    <View testID="reflection-read-only" style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {name}’s reflection
        </Text>
        <Text variant="bodyMedium" style={{ color: muted }}>
          {reflection?.entered_as === 'student'
            ? `${name} entered this reflection, so it is theirs to change.`
            : 'You cannot enter a reflection on this lesson.'}
        </Text>
      </View>
      {reflection?.entered_as === 'student'
        ? REFLECTION_QUESTIONS.map((question) => (
            <View key={question.key} style={{ gap: space.xs }}>
              <Text variant="bodyLarge">{question.askAbout(name)}</Text>
              {reflection[question.key] === null ? (
                <Text variant="bodyMedium" style={{ color: muted }}>
                  Not answered
                </Text>
              ) : (
                <FaceRow
                  questionKey={question.key}
                  name={question.askAbout(name)}
                  value={reflection[question.key]}
                />
              )}
            </View>
          ))
        : null}
      {reflection?.entered_as === 'student' && reflection.homework_notes ? (
        <Text variant="bodyMedium">
          <Text variant="bodySmall" style={{ color: muted }}>
            Homework notes:{' '}
          </Text>
          {reflection.homework_notes}
        </Text>
      ) : null}
      <Button testID="reflection-close" mode="outlined" onPress={close}>
        Close
      </Button>
    </View>
  );
}

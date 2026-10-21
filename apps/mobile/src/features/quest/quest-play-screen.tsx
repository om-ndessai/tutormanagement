// Ported from apps/web/src/features/quest/quest-play-page.tsx @ 82397b8 (working tree).
//
// Phase 42: a student's Question Quest, full screen. One question at a time, answered once: no going
// back, no skipping. Nothing is marked here -- the key has not been checked by a person yet -- so the
// student sees "saved", and the points for trying. docs/gamification-plan.md.
// Mobile: a full-screen modal outside the tabs (quest-frame.tsx); the stem and the choices are drawn
// by the bank's KaTeX web view, the choices large radio buttons laid over it; a number is typed on a
// keypad that has the minus sign and the fraction bar too (an answer may be -3 or 3/4). On an iPad
// the question sits beside the answer. The two web views stay for the session, each next question
// swapped into them in place, and the screen goes back to its top. A refusal that says the question
// moved on (409) reads the state again, so the student is never left on a question the server will
// not take. "Saved" is said in Quest's own frame (quest-notice.tsx).
// Owner, 2026-10-21 (with the web): a welcome each time the screen opens (quest-welcome.tsx, from
// GET /quest/me/summary, read fresh), and on a saved answer a "+1" that flies from Submit to the
// points, which bump as they tick up (quest-burst.tsx, quest-points.tsx), while the question eases
// out and the next eases in. Nothing is ever marked right or wrong. Reduce motion stills all of it.
import { questLevelLabel, type QuestQuestion } from '@tmi/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Icon, Portal, Text, TextInput } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { OutlinedCard } from '@/components/outlined-card';
import { DetailSkeleton } from '@/components/skeletons';
import { MathBody } from '@/features/question-bank/math-body';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useAnswerQuest, useQuestState, useQuestSummary } from './api';
import { useQuestBurst } from './quest-burst';
import { QuestChoices } from './quest-choices';
import { QuestFrame, QuestStatus, exitQuest } from './quest-frame';
import { questStemHtml, questStemSpeech, questStemText } from './quest-html';
import { useQuestNotice } from './quest-notice';
import {
  NO_LEVEL_TEXT,
  finishedText,
  movedUpText,
  questResponse,
  questWide,
  savedToast,
} from './quest-model';
import { QuestPoints } from './quest-points';
import { QuestWelcome } from './quest-welcome';
import { burstText, welcomeDecision } from './quest-welcome-model';

export function QuestPlayScreen() {
  const state = useQuestState();
  const data = state.data?.data;
  const scroller = useRef<ScrollView>(null);
  // The welcome: once per opening, on numbers read since this screen opened.
  const summary = useQuestSummary();
  const [welcome, setWelcome] = useState<'pending' | 'open' | 'closed'>('pending');
  const decision = welcomeDecision({
    summary: summary.isFetchedAfterMount ? summary.data?.data : undefined,
    summaryFailed: summary.isError,
    state: data,
  });
  if (welcome === 'pending' && decision !== undefined) setWelcome(decision ? 'open' : 'closed');
  const closeWelcome = useCallback(() => setWelcome('closed'), []);

  return (
    <QuestFrame
      title="Question Quest"
      testID="screen-quest-play"
      scrollRef={scroller}
      status={
        data ? (
          <>
            <QuestStatus testID="quest-level">{questLevelLabel(data.level_id)}</QuestStatus>
            <QuestPoints points={data.points} live />
          </>
        ) : null
      }
    >
      {state.isPending ? (
        <DetailSkeleton label="Loading your Quest…" rows={4} />
      ) : state.isError || !data ? (
        <Message text="Question Quest could not be loaded." />
      ) : !data.level_id ? (
        <Message testID="quest-no-level" text={NO_LEVEL_TEXT} />
      ) : data.finished || !data.question ? (
        <Message testID="quest-finished" text={finishedText(data.answered)} />
      ) : (
        <>
          {data.moved_up_from ? <MovedUp from={data.moved_up_from} to={data.level_id} /> : null}
          <QuestionCard question={data.question} answered={data.answered} scroller={scroller} />
        </>
      )}
      {welcome === 'open' && summary.data ? (
        <Portal>
          <QuestWelcome summary={summary.data.data} onClose={closeWelcome} />
        </Portal>
      ) : null}
    </QuestFrame>
  );
}

function Message({ text, testID }: { text: string; testID?: string }) {
  return (
    <OutlinedCard testID={testID} style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.lg }}>
        <Text variant="bodyLarge">{text}</Text>
        <Button testID="quest-back" mode="outlined" style={{ alignSelf: 'flex-start' }} onPress={exitQuest}>
          Back
        </Button>
      </View>
    </OutlinedCard>
  );
}

function MovedUp({ from, to }: { from: string; to: string | null }) {
  const theme = useAppTheme();
  return (
    <View
      testID="quest-moved-up"
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        borderRadius: radius.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: withAlpha(theme.colors.primary, 0.1),
      }}
    >
      <Icon source="star-four-points-outline" size={18} color={theme.colors.primary} />
      <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.primary, fontWeight: '600' }}>
        {movedUpText(from, to)}
      </Text>
    </View>
  );
}

/** What the student has given so far, for the question it was given to. */
interface Draft {
  questionId: string;
  choice: number | null;
  number: string;
}

function QuestionCard({
  question,
  answered,
  scroller,
}: {
  question: QuestQuestion;
  answered: number;
  scroller: RefObject<ScrollView | null>;
}) {
  const theme = useAppTheme();
  const notice = useQuestNotice();
  const { width } = useWindowDimensions();
  const answer = useAnswerQuest();
  const state = useQuestState();
  const burst = useQuestBurst();
  const submitRef = useRef<View>(null);
  // The question eases out while the answer is sent, and the next eases in.
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);
  const card = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: shift.value }] }));
  const field = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: shift.value }] }));
  // Not keyed on the question (which would make new web views for each): a draft for another
  // question is an empty one.
  const [draft, setDraft] = useState<Draft>({ questionId: question.id, choice: null, number: '' });
  const current =
    draft.questionId === question.id ? draft : { questionId: question.id, choice: null, number: '' };
  const { choice, number } = current;
  const setChoice = (next: number | null) => setDraft({ ...current, choice: next });
  const setNumber = (next: string) => setDraft({ ...current, number: next });
  const response = questResponse(question, choice, number);

  // A new question starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [question.id, scroller]);
  const wide = questWide(width);
  const stemHtml = useMemo(
    () => questStemHtml(question.stem, { errorColor: theme.colors.error }),
    [question.stem, theme.colors.error],
  );

  async function submit() {
    if (!response || answer.isPending) return;
    const ease = { duration: 180, easing: Easing.out(Easing.quad) };
    if (!reduced) {
      shift.set(withTiming(-32, ease));
      fade.set(withTiming(0, ease));
    }
    try {
      await answer.mutateAsync({ question_id: question.id, answer: response });
      burst?.fly(submitRef.current, burstText());
      // The "Saved" notice gives the success haptic (haptics.ts: one per confirmation).
      notice.success(savedToast());
      if (!reduced) {
        shift.set(32);
        shift.set(withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }));
        fade.set(withTiming(1, { duration: 240 }));
      }
    } catch (caught) {
      if (!reduced) {
        shift.set(withTiming(0, ease));
        fade.set(withTiming(1, ease));
      }
      notice.error(caught instanceof ApiRequestError ? caught.message : 'Could not save your answer.');
      // The server has moved on (answered elsewhere, or the question left the queue): catch up.
      if (caught instanceof ApiRequestError && caught.status === 409) void state.refetch();
    }
  }

  const questionCard = (
    <Animated.View style={[wide ? { flex: 3 } : null, card]}>
      <OutlinedCard testID="quest-question" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text
            variant="labelMedium"
            style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {`Question ${answered + 1}`}
          </Text>
          <MathBody
            testID="quest-stem"
            html={stemHtml}
            speech={questStemSpeech(question.stem)}
            plain={questStemText(question.stem)}
            contentKey={question.id}
            persistent
          />
        </View>
      </OutlinedCard>
    </Animated.View>
  );

  const answerColumn = (
    <View style={{ gap: space.lg, ...(wide ? { flex: 2 } : null) }}>
      <Animated.View style={field}>
        {question.kind === 'choice' ? (
          <QuestChoices
            questionId={question.id}
            choices={question.choices}
            selected={choice}
            onChoose={(index) => setChoice(choice === index ? null : index)}
          />
        ) : (
          <TextInput
            testID="quest-number"
            mode="outlined"
            label="Your answer"
            value={number}
            onChangeText={setNumber}
            placeholder="A number, like 12, 3/4 or 2.5"
            // A keypad with the minus sign and the fraction bar as well as the digits and the point:
            // iOS's decimal pad has neither, and an answer may be -3 or 3/4.
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'phone-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            // Return only puts the keyboard away: with no going back, sending stays a deliberate tap.
            returnKeyType="done"
            maxLength={120}
            style={{ fontSize: 22 }}
            contentStyle={{ minHeight: 60 }}
          />
        )}
      </Animated.View>
      <View ref={submitRef} collapsable={false}>
        <Button
          testID="quest-submit"
          mode="contained"
          icon="send"
          disabled={!response || answer.isPending}
          loading={answer.isPending}
          onPress={() => void submit()}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 17 }}
        >
          Submit answer
        </Button>
      </View>
      <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
        Once you submit, the answer is saved and the next question comes. Your tutor checks each one.
      </Text>
    </View>
  );

  return wide ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xl }}>
      {questionCard}
      {answerColumn}
    </View>
  ) : (
    <View style={{ gap: space.lg }}>
      {questionCard}
      {answerColumn}
    </View>
  );
}

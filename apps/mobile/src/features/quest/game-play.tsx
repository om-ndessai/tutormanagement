// Ported from apps/web/src/features/quest/game-page.tsx @ cd0378d (working tree): Play and
// QuestionPanel.
//
// A game under way: the question in your hand (never its key: the server does not send it), Submit or
// Skip, right or wrong said at once, and the next question in the reply; the scoreboard beside it.
// "Question 2 of 5" in a count game; a timed game's has no "of" (its series is only the most it
// draws). A host who is not playing watches the scores. Mobile (design 60): the stem and the choices
// in Quest's persistent KaTeX web views (QuestChoices with `game-choice-*`), a number on Quest's
// keypad; the draft is keyed on the question, so a poll that hands over another question (a stale one
// passed to a teammate) starts it afresh, and a 409 reads the game again. The question eases out and
// the next in (stilled under reduce motion). The notices are Quest's own (quest-notice.tsx). On an
// iPad the play sits beside the scoreboard. End the game asks first.
import { useQueryClient } from '@tanstack/react-query';
import { gameAnswerSchema, type GameQuestion, type GameView } from '@tmi/shared';
import { useMemo, useState } from 'react';
import { Alert, Platform, View, useWindowDimensions } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useLargeText } from '@/hooks/use-large-text';
import { OutlinedCard } from '@/components/outlined-card';
import { MathBody } from '@/features/question-bank/math-body';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import {
  HOSTING_TEXT,
  WAITING_TITLE,
  answerNotice,
  questionHeading,
  seriesTotal,
  waitingText,
} from './game-model';
import { Scoreboard } from './game-scoreboard';
import { gameKeys, useGameAction } from './games-api';
import { QuestChoices } from './quest-choices';
import { questStemHtml, questStemSpeech, questStemText } from './quest-html';
import { questResponse, questWide } from './quest-model';
import { useQuestNotice } from './quest-notice';

const message = (caught: unknown, fallback: string) =>
  caught instanceof ApiRequestError ? caught.message : fallback;

/** Asks before something that cannot be undone: ending or cancelling a game. */
export function confirmEnd({
  title,
  body,
  confirm,
  keep,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  keep: string;
  onConfirm: () => void;
}) {
  haptics.warning();
  Alert.alert(title, body, [
    { text: keep, style: 'cancel' },
    { text: confirm, style: 'destructive', onPress: onConfirm },
  ]);
}

export function GamePlay({ game }: { game: GameView }) {
  const { width } = useWindowDimensions();
  const action = useGameAction(game.id);
  const notice = useQuestNotice();
  const wide = questWide(width);
  const playing = game.me.team_id !== null;

  function end() {
    confirmEnd({
      title: 'End the game now?',
      body: 'Every team stops where it is, and the places are given.',
      confirm: 'End the game',
      keep: 'Keep playing',
      onConfirm: () =>
        void action
          .mutateAsync({ kind: 'end' })
          .catch((caught) => notice.error(message(caught, 'Could not end the game.'))),
    });
  }

  const main = (
    <View style={{ gap: space.lg, ...(wide ? { flex: 3 } : null) }}>
      {!playing ? (
        <OutlinedCard testID="game-hosting" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg }}>
            <Text variant="bodyLarge">{HOSTING_TEXT}</Text>
          </View>
        </OutlinedCard>
      ) : game.me.question ? (
        <QuestionPanel game={game} question={game.me.question} />
      ) : (
        <Waiting game={game} />
      )}
      {game.is_host ? (
        <Button
          testID="game-end"
          mode="outlined"
          icon="flag-checkered"
          onPress={end}
          disabled={action.isPending}
          style={{ alignSelf: 'flex-start' }}
          contentStyle={{ minHeight: 48 }}
        >
          End the game now
        </Button>
      ) : null}
    </View>
  );

  const board = (
    <View style={wide ? { flex: 2 } : undefined}>
      <Scoreboard game={game} title="Scores" />
    </View>
  );

  return wide ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xl }}>
      {main}
      {board}
    </View>
  ) : (
    <View style={{ gap: space.lg }}>
      {main}
      {board}
    </View>
  );
}

function Waiting({ game }: { game: GameView }) {
  const theme = useAppTheme();
  return (
    <OutlinedCard testID="game-waiting" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
          {WAITING_TITLE}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          {waitingText(game.mode)}
        </Text>
      </View>
    </OutlinedCard>
  );
}

/** What has been given so far, for the question it was given to. */
interface Draft {
  questionId: string;
  choice: number | null;
  number: string;
}

function QuestionPanel({ game, question }: { game: GameView; question: GameQuestion }) {
  const theme = useAppTheme();
  const notice = useQuestNotice();
  const action = useGameAction(game.id);
  const queryClient = useQueryClient();
  const stacked = useLargeText();
  const reduced = useReducedMotion();
  const shift = useSharedValue(0);
  const fade = useSharedValue(1);
  const slide = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: shift.value }] }));
  const total = seriesTotal(game);

  // Not keyed on the question (which would make new web views for each): a draft for another
  // question is an empty one.
  const [draft, setDraft] = useState<Draft>({ questionId: question.id, choice: null, number: '' });
  const current =
    draft.questionId === question.id ? draft : { questionId: question.id, choice: null, number: '' };
  const { choice, number } = current;
  const response = questResponse(question, choice, number);
  const stemHtml = useMemo(
    () => questStemHtml(question.stem, { errorColor: theme.colors.error }),
    [question.stem, theme.colors.error],
  );

  async function send(skip: boolean) {
    if (action.isPending) return;
    const raw = skip
      ? { question_id: question.id, skip: true }
      : { question_id: question.id, answer: response };
    const parsed = gameAnswerSchema.safeParse(raw);
    if (!parsed.success) {
      notice.error(parsed.error.issues[0]?.message ?? 'Give an answer, or skip.');
      return;
    }
    const ease = { duration: 180, easing: Easing.out(Easing.quad) };
    if (!reduced) {
      shift.set(withTiming(-32, ease));
      fade.set(withTiming(0, ease));
    }
    try {
      const reply = await action.mutateAsync({ kind: 'answer', ...parsed.data });
      const said = answerNotice(reply.data?.me.last, reply.data?.negative_marking ?? game.negative_marking);
      notice[said.tone](said.text);
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
      notice.error(message(caught, 'Could not send your answer.'));
      // The question moved to a teammate, or the time is up: catch up with the game.
      if (caught instanceof ApiRequestError && caught.status === 409) {
        void queryClient.invalidateQueries({ queryKey: gameKeys.game(game.id) });
      }
    }
  }

  return (
    <Animated.View style={[{ gap: space.lg }, slide]}>
      <OutlinedCard testID="game-question" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text
            testID="game-question-number"
            variant="labelMedium"
            style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {questionHeading(question.number, total)}
          </Text>
          <MathBody
            testID="game-stem"
            html={stemHtml}
            speech={questStemSpeech(question.stem)}
            plain={questStemText(question.stem)}
            contentKey={question.id}
            persistent
          />
        </View>
      </OutlinedCard>
      {question.kind === 'choice' ? (
        <QuestChoices
          questionId={question.id}
          choices={question.choices}
          selected={choice}
          onChoose={(index) => setDraft({ ...current, choice: choice === index ? null : index })}
          testIDPrefix="game-choice"
        />
      ) : (
        <TextInput
          testID="game-number"
          mode="outlined"
          label="Your answer"
          value={number}
          onChangeText={(text) => setDraft({ ...current, number: text })}
          placeholder="A number, like 12, 3/4 or 2.5"
          // Quest's keypad: the minus sign and the fraction bar as well as the digits and the point.
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'phone-pad'}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={() => {
            if (response) void send(false);
          }}
          maxLength={120}
          style={{ fontSize: 22 }}
          contentStyle={{ minHeight: 60 }}
        />
      )}
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: space.sm }}>
        <Button
          testID="game-submit"
          mode="contained"
          icon="send"
          disabled={!response || action.isPending}
          loading={action.isPending}
          onPress={() => void send(false)}
          style={stacked ? undefined : { flex: 1 }}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 17 }}
        >
          Submit
        </Button>
        <Button
          testID="game-skip"
          mode="outlined"
          icon="skip-next"
          disabled={action.isPending}
          onPress={() => void send(true)}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 17 }}
        >
          Skip
        </Button>
      </View>
    </Animated.View>
  );
}

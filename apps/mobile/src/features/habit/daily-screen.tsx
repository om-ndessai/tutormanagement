// Ported from apps/web/src/features/habit/daily-page.tsx @ 0e3ec7a (working tree). Phase 64 (P19,
// docs/stickiness-plan.md): the Daily set -- five questions of a level, the same for everyone today. The
// questions come without keys; the answers go to the server in one request at the end, which marks them
// and sends back the keys with the result (R20). One play a day, and a share grid that names nobody.
//
// Mobile: full screen in Quest's frame, like a game. The stem and the choices in Quest's persistent KaTeX
// web views (QuestChoices, `daily-choice-<i>` as on the web), a number on Quest's keypad. A choice is
// chosen, then Submit (as every quest on the phone; the web answers on the tap); Skip gives none. The
// result's questions are one web view, never one per question. Share is the system share sheet. A
// refused save (409: played elsewhere, or the day turned) reads the Daily again; any other failure takes
// the last answer back, so it can be given again.
import { useQueryClient } from '@tanstack/react-query';
import { dailyShareText, type DailyQuestion, type DailySet } from '@tmi/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useLargeText } from '@/hooks/use-large-text';
import { MathBody } from '@/features/question-bank/math-body';
import { exitGame, QuestFrame, QuestStatus } from '@/features/quest/quest-frame';
import { QuestChoices } from '@/features/quest/quest-choices';
import { questStemHtml, questStemSpeech, questStemText } from '@/features/quest/quest-html';
import { questResponse } from '@/features/quest/quest-model';
import { useQuestNotice } from '@/features/quest/quest-notice';
import { numberAnswerKeyboard } from '@/features/quest/number-keyboard';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useDaily, useSaveDaily } from './api';
import { dailyResultHtml, dailyResultSpeech, dailyResultText } from './daily-html';
import {
  DAILY_NEXT_TEXT,
  dailyGrid,
  dailyGridSpeech,
  dailyHeading,
  dailyProgress,
  giveAnswer,
  levelTag,
  levelWords,
  secondsSince,
} from './habit-model';

/** Back where the Daily was opened: the Play home. */
const backToPlay = () => exitGame('home');

export function DailyScreen({ level }: { level: string }) {
  const daily = useDaily(level);
  const data = daily.data?.data;
  const tag = levelTag(level);
  // 403 (the console has the Daily off) and 404 (a level this space does not offer) are the web's one
  // calm line; anything else can be tried again.
  const missing =
    daily.error instanceof ApiRequestError && (daily.error.status === 403 || daily.error.status === 404);

  return (
    <QuestFrame
      testID="screen-quest-daily"
      title="Today's Daily"
      status={data ? <QuestStatus strong>{`${tag}D #${data.number}`}</QuestStatus> : undefined}
      onExit={backToPlay}
    >
      {daily.isPending ? (
        <LoadingState label="Getting today's Daily…" />
      ) : daily.isError && !missing ? (
        <ErrorState error={daily.error} onRetry={() => void daily.refetch()} />
      ) : !data || data.questions.length === 0 ? (
        <NoDaily level={level} />
      ) : data.result ? (
        <DailyResult data={data} result={data.result} />
      ) : (
        <DailyPlay key={data.day} data={data} level={level} />
      )}
    </QuestFrame>
  );
}

function NoDaily({ level }: { level: string }) {
  return (
    <View testID="daily-none" style={{ gap: space.lg }}>
      <Text variant="bodyLarge">{`There is no Daily for ${levelWords(level)} today.`}</Text>
      <Button testID="daily-back" mode="outlined" onPress={backToPlay} style={{ alignSelf: 'flex-start' }}>
        Back to Play
      </Button>
    </View>
  );
}

/** What has been given so far, for the question it was given to. */
interface Draft {
  questionId: string;
  choice: number | null;
  number: string;
}

function DailyPlay({ data, level }: { data: DailySet; level: string }) {
  const theme = useAppTheme();
  const notice = useQuestNotice();
  const queryClient = useQueryClient();
  const save = useSaveDaily(level);
  const stacked = useLargeText();
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  // When the play began: set as it mounts (and again on a new day).
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, [data.day]);

  const total = data.questions.length;
  const index = Math.min(answers.length, total - 1);
  const question: DailyQuestion = data.questions[index]!;
  const [draft, setDraft] = useState<Draft>({ questionId: question.id, choice: null, number: '' });
  const current =
    draft.questionId === question.id ? draft : { questionId: question.id, choice: null, number: '' };
  const response = questResponse(question, current.choice, current.number);
  const stemHtml = useMemo(
    () => questStemHtml(question.stem, { errorColor: theme.colors.error }),
    [question.stem, theme.colors.error],
  );
  const busy = save.isPending;

  function answer(given: string | null) {
    if (busy) return;
    haptics.selection();
    const { answers: next, done } = giveAnswer(answers, given, total);
    setAnswers(next);
    if (!done) return;
    save
      .mutateAsync({ day: data.day, answers: next, seconds: secondsSince(started.current, Date.now()) })
      .then(() => haptics.success())
      .catch((caught: unknown) => {
        haptics.error();
        notice.error(caught instanceof ApiRequestError ? caught.message : 'The result could not be saved.');
        if (caught instanceof ApiRequestError && caught.status === 409) {
          void queryClient.invalidateQueries({ queryKey: ['quest', 'daily', level] });
        } else {
          setAnswers(next.slice(0, -1));
        }
      });
  }

  return (
    <View testID="daily-play" style={{ gap: space.lg }}>
      <Text testID="daily-progress" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {dailyProgress(level, index, total)}
      </Text>
      <OutlinedCard testID="daily-question" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          {question.beta ? (
            <Chip
              testID="daily-question-beta"
              compact
              accessibilityLabel="Beta: a new question no person has approved yet"
              textStyle={{ fontSize: 11, marginVertical: 0 }}
              style={{ alignSelf: 'flex-start', backgroundColor: theme.colors.secondaryContainer }}
            >
              Beta
            </Chip>
          ) : null}
          <MathBody
            testID="daily-stem"
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
          selected={current.choice}
          onChoose={(i) => setDraft({ ...current, choice: current.choice === i ? null : i })}
          testIDFor={(i) => `daily-choice-${i}`}
        />
      ) : (
        <TextInput
          testID="daily-number"
          mode="outlined"
          label="Your answer"
          accessibilityLabel="Your answer"
          value={current.number}
          onChangeText={(text) => setDraft({ ...current, number: text })}
          placeholder="A number, like 12, 3/4 or 2.5"
          keyboardType={numberAnswerKeyboard(Platform.OS)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={() => {
            if (response) answer(response);
          }}
          maxLength={120}
          style={{ fontSize: 22 }}
          contentStyle={{ minHeight: 60 }}
        />
      )}
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: space.sm }}>
        <Button
          testID="daily-submit"
          mode="contained"
          icon="send"
          disabled={!response || busy}
          loading={busy}
          onPress={() => answer(response)}
          style={stacked ? undefined : { flex: 1 }}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 17 }}
        >
          Submit
        </Button>
        <Button
          testID="daily-skip"
          mode="outlined"
          icon="skip-next"
          disabled={busy}
          onPress={() => answer(null)}
          contentStyle={{ minHeight: 52 }}
          labelStyle={{ fontSize: 17 }}
        >
          Skip
        </Button>
      </View>
    </View>
  );
}

function DailyResult({ data, result }: { data: DailySet; result: NonNullable<DailySet['result']> }) {
  const theme = useAppTheme();
  const tag = levelTag(data.level_id);
  const text = dailyShareText(tag, data.number, result.marks, result.seconds);
  const html = useMemo(
    () => dailyResultHtml(data.questions, result.marks, { errorColor: theme.colors.error }),
    [data.questions, result.marks, theme.colors.error],
  );

  async function share() {
    haptics.selection();
    try {
      await Share.share({ message: text });
    } catch {
      // Dismissed.
    }
  }

  return (
    <View testID="daily-result" style={{ gap: space.lg }}>
      <OutlinedCard style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text testID="daily-heading" variant="headlineSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
            {dailyHeading(data.level_id, data.number, result.right, result.of)}
          </Text>
          <Text
            testID="daily-grid"
            variant="headlineSmall"
            // The heading says the score; the hint says each mark (the glyphs read poorly), and the grid stays
            // its own text for the tests and for anyone reading it.
            accessibilityHint={dailyGridSpeech(result.marks)}
            style={{ letterSpacing: 6 }}
          >
            {dailyGrid(result.marks)}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {DAILY_NEXT_TEXT}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Button testID="daily-share" mode="contained" icon="share-variant" onPress={() => void share()} contentStyle={{ minHeight: 48 }}>
              Share
            </Button>
            <Button testID="daily-back" mode="outlined" onPress={backToPlay} contentStyle={{ minHeight: 48 }}>
              Back to Play
            </Button>
          </View>
        </View>
      </OutlinedCard>
      <OutlinedCard testID="daily-review" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg }}>
          <MathBody
            html={html}
            speech={dailyResultSpeech(data.questions, result.marks)}
            plain={dailyResultText(data.questions, result.marks)}
            contentKey={`${data.day}:${data.level_id}`}
          />
        </View>
      </OutlinedCard>
    </View>
  );
}

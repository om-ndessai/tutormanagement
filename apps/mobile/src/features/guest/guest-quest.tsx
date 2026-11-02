// Ported from apps/web/src/features/guest/guest-quest.tsx @ 0e3ec7a (working tree). Phase 63 (P10, P12):
// a guest's quest, played entirely on the phone from the level's guest pool: marked by the shared
// `checkAnswer`, timed by a clock that pauses for the sign-up offer, the series unseen first
// (`guestSeries`). Nothing is sent but anonymous counts. Kept in memory for the run, so signing up over
// it (the sheet) comes back to it.
//
// Mobile differences: in the Quest frame (Exit goes to the Play home); a choice is chosen, then
// "Answer" (as the members' quest on the phone, so a stray tap while scrolling answers nothing); the
// clock stays paused while the sign-up sheet is over the quest and runs again when it closes (the web
// resumes it as the sheet opens); the results show one question at a time (guest-results.tsx); once
// signed up, the results offer "Go to my space" in place of "Save this score".
import { guestPoolUsedUp, type GuestQuestion, type GuestTile } from '@tmi/shared';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { BadgePill } from '@/components/badge-pill';
import { OutlinedCard } from '@/components/outlined-card';
import { MathBody } from '@/features/question-bank/math-body';
import { numberAnswerKeyboard } from '@/features/quest/number-keyboard';
import { QuestChoices } from '@/features/quest/quest-choices';
import { QuestFrame, QuestStatus } from '@/features/quest/quest-frame';
import { questStemHtml, questStemSpeech, questStemText } from '@/features/quest/quest-html';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { countEvent, flushEvents, useGuestPool } from './guest-api';
import {
  answerQuest,
  benefitsFor,
  challengeText,
  clockText,
  guestScore,
  limitMsOf,
  playLink,
  questDone,
  resumeQuest,
  startQuest,
  timeLeftMs,
  usedUpText,
  type GuestQuestState,
} from './guest-model';
import { exitGuestPlay, openSignupSheet, toSpace } from './guest-nav';
import { GuestResultPager, type GuestResultItem } from './guest-results';
import { guestMemory, readQuestState, writeQuestState } from './guest-store';
import { NudgeSheet } from './nudge-sheet';

export function GuestQuest({ tile }: { tile: GuestTile }) {
  const theme = useAppTheme();
  const { config, status } = useAuth();
  const guest = config?.guest;
  const signedIn = status === 'authenticated';
  const focused = useIsFocused();
  const pool = useGuestPool(guest?.version, tile.level_id);
  // A quest left unfinished in this run (a sign-up over it) goes on; a finished one starts afresh.
  const [state, setState] = useState<GuestQuestState | null>(() => {
    const kept = readQuestState(tile.code);
    return kept && !kept.finished ? kept : null;
  });
  const [now, setNow] = useState(() => Date.now());
  const [nudge, setNudge] = useState<{ right: boolean } | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  // The sign-up sheet is over the quest: the clock stays paused until it closes.
  const signingUp = useRef(false);
  const questions = useMemo(() => pool.data?.questions ?? [], [pool.data]);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const limitMs = limitMsOf(tile);

  // Start (or resume) once the pool is here.
  useEffect(() => {
    if (state || questions.length === 0) return;
    // Set from the pool's arrival, once: not a render-time derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(startQuest(tile, questions, guestMemory.seen(tile.level_id), Date.now()));
    guestMemory.addPlayed(tile.code);
    countEvent({ name: 'tile_started', tile: tile.code, source: 'guest' });
  }, [state, questions, tile]);

  useEffect(() => writeQuestState(state), [state]);

  // Back from the sign-up sheet: the clock runs again.
  useEffect(() => {
    if (!focused || !signingUp.current) return;
    signingUp.current = false;
    const at = Date.now();
    setState((s) => (s ? resumeQuest(s, at) : s));
    setNow(at);
  }, [focused]);

  // The clock: a timed quest ends at its limit; a pause stops it.
  const running = limitMs !== null && state !== null && state.pausedAt === null && !state.finished;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  const done = state !== null && questDone(tile, state, now);

  // The end, by the last answer or the clock: recorded once (the phone's memory and the counts).
  useEffect(() => {
    if (!state || !done || state.finished) return;
    const score = guestScore(state.answers);
    guestMemory.addSeen(tile.level_id, state.answers.map((a) => a.id));
    guestMemory.setBest(tile.code, score);
    countEvent({ name: 'quest_finished', tile: tile.code, value: score });
    const usedUp = guestPoolUsedUp(questions, guestMemory.seen(tile.level_id));
    if (usedUp) countEvent({ name: 'pool_used_up', tile: tile.code });
    flushEvents();
    // Kept on the quest: the phone's memory is a module, not state, so a render reading it would be
    // memoised by the React Compiler on the tile alone and say "not used up" after the last round.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ...state, finished: true, usedUp });
  }, [done, state, tile, questions]);

  const exit = () => exitGuestPlay(signedIn);

  if (!guest) {
    return (
      <QuestFrame title={tile.code} testID="screen-guest-quest" onExit={exit}>
        <Text variant="bodyMedium">This quest is not available just now.</Text>
      </QuestFrame>
    );
  }
  if (pool.isPending || (!state && questions.length > 0)) {
    return (
      <QuestFrame title={tile.code} testID="screen-guest-quest" onExit={exit}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Getting your quest ready…
        </Text>
      </QuestFrame>
    );
  }
  if (pool.isError || questions.length === 0 || !state) {
    return (
      <QuestFrame title={tile.code} testID="screen-guest-quest" onExit={exit}>
        <Text testID="guest-unavailable" variant="bodyMedium">
          This quest is not available just now.
        </Text>
      </QuestFrame>
    );
  }

  const settings = guest.settings;
  const benefits = benefitsFor(tile.level_id, guest.member_counts);
  const signUp = (source: 'nudge' | 'results') => {
    countEvent({ name: 'signup_started', source, tile: tile.code });
    flushEvents();
    signingUp.current = true;
    openSignupSheet();
  };

  if (done) {
    const usedUp = state.usedUp === true;
    return (
      <QuestFrame title={tile.code} testID="screen-guest-quest" onExit={exit}>
        <Results
          tile={tile}
          state={state}
          byId={byId}
          usedUp={usedUp}
          benefits={benefits}
          signedIn={signedIn}
          signupOpen={config?.signup_open === true}
          onSignUp={() => signUp('results')}
          onAgain={() => {
            writeQuestState(null);
            setState(null);
            setChoice(null);
            setTyped('');
          }}
        />
      </QuestFrame>
    );
  }

  const current = byId.get(state.questionIds[state.answers.length]!);
  const timeLeft = timeLeftMs(tile, state, now);

  function answer(question: GuestQuestion, given: string | null) {
    const at = Date.now();
    const result = answerQuest(state!, question, given, settings, guestMemory.nudgeDismissedAt(), at);
    setChoice(null);
    setTyped('');
    if (given === null) haptics.selection();
    else if (result.correct) haptics.success();
    else haptics.warning();
    if (result.state.answers.length === 1) countEvent({ name: 'first_answer', tile: tile.code, value: result.correct ? 1 : 0 });
    if (result.nudge) {
      setNudge({ right: result.correct });
      countEvent({ name: 'nudge_shown', tile: tile.code, variant: `n${settings.nudge_after}` });
    }
    setState(result.state);
    setNow(at);
  }

  function closeNudge(accepted: boolean) {
    setNudge(null);
    if (accepted) {
      countEvent({ name: 'nudge_accepted', tile: tile.code });
      // Paused until the sheet closes.
      signUp('nudge');
      return;
    }
    guestMemory.dismissNudge();
    countEvent({ name: 'nudge_dismissed', tile: tile.code });
    const at = Date.now();
    setState((s) => (s ? resumeQuest(s, at) : s));
    setNow(at);
  }

  const given = current
    ? current.kind === 'choice'
      ? choice !== null
        ? (current.choices[choice] ?? null)
        : null
      : typed.trim() || null
    : null;

  return (
    <QuestFrame
      title={tile.code}
      testID="screen-guest-quest"
      onExit={exit}
      status={
        <QuestStatus testID="guest-progress">
          {timeLeft !== null
            ? state.pausedAt !== null
              ? 'Paused'
              : clockText(timeLeft)
            : `${state.answers.length + 1} of ${state.questionIds.length}`}
        </QuestStatus>
      }
    >
      {current ? (
        <View style={{ gap: space.lg }}>
          <OutlinedCard testID="guest-question" style={{ borderRadius: radius.lg }}>
            <View style={{ padding: space.lg, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
                >
                  {tile.code}
                </Text>
                {current.beta ? <BadgePill testID="guest-question-beta" /> : null}
              </View>
              <MathBody
                testID="guest-stem"
                html={questStemHtml(current.stem, { errorColor: theme.colors.error })}
                speech={questStemSpeech(current.stem)}
                plain={questStemText(current.stem)}
                contentKey={current.id}
                persistent
              />
            </View>
          </OutlinedCard>
          {current.kind === 'choice' ? (
            <QuestChoices
              questionId={current.id}
              choices={current.choices}
              selected={choice}
              onChoose={(index) => setChoice(choice === index ? null : index)}
              testIDPrefix="guest-choice"
            />
          ) : (
            <TextInput
              testID="guest-number"
              mode="outlined"
              label="Your answer"
              value={typed}
              onChangeText={setTyped}
              placeholder="A number, like 12, 3/4 or 2.5"
              keyboardType={numberAnswerKeyboard(Platform.OS)}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="done"
              maxLength={120}
              style={{ fontSize: 22 }}
              contentStyle={{ minHeight: 60 }}
            />
          )}
          <Button
            testID="guest-answer"
            mode="contained"
            icon="send"
            disabled={given === null}
            onPress={() => answer(current, given)}
            contentStyle={{ minHeight: 52 }}
            labelStyle={{ fontSize: 17 }}
          >
            Answer
          </Button>
          <Button testID="guest-skip" mode="text" style={{ alignSelf: 'flex-start' }} onPress={() => answer(current, null)}>
            Skip
          </Button>
        </View>
      ) : null}
      <NudgeSheet
        open={nudge !== null}
        headline={nudge?.right ? settings.nudge_right : settings.nudge_wrong}
        benefits={benefits}
        onSignUp={() => closeNudge(true)}
        onClose={() => closeNudge(false)}
        shareLink={playLink(serverOrigin(), tile.code)}
      />
    </QuestFrame>
  );
}

/** The results: the main moment to offer an account (P12), with the worked solutions. */
function Results({
  tile,
  state,
  byId,
  usedUp,
  benefits,
  signedIn,
  signupOpen,
  onSignUp,
  onAgain,
}: {
  tile: GuestTile;
  state: GuestQuestState;
  byId: Map<string, GuestQuestion>;
  usedUp: boolean;
  benefits: string[];
  signedIn: boolean;
  signupOpen: boolean;
  onSignUp: () => void;
  onAgain: () => void;
}) {
  const theme = useAppTheme();
  const score = guestScore(state.answers);
  const items: GuestResultItem[] = state.answers.flatMap((given, index) => {
    const question = byId.get(given.id);
    return question
      ? [{ number: index + 1, question, answer: given.answer, correct: given.correct, skipped: given.answer === null }]
      : [];
  });

  async function challenge() {
    try {
      await Share.share({
        message: `${challengeText(score, state.answers.length, tile.code)} ${playLink(serverOrigin(), tile.code)}`,
      });
    } catch {
      // Dismissed.
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <OutlinedCard testID="guest-results" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text testID="guest-score" variant="headlineSmall" accessibilityRole="header" style={{ fontWeight: '700' }}>
            {`${score} of ${state.answers.length} right`}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {`${tile.code} · ${tile.words}`}
          </Text>
          {usedUp ? (
            <Text testID="guest-used-up" variant="bodyMedium">
              {usedUpText(tile, benefits)}
            </Text>
          ) : null}
          <View style={{ gap: space.sm }}>
            {signedIn ? (
              <Button testID="guest-to-space" mode="contained" icon="home-outline" onPress={toSpace}>
                Go to my space
              </Button>
            ) : (
              <Button testID="guest-save-score" mode="contained" onPress={onSignUp}>
                {signupOpen ? 'Save this score: sign up free' : 'Sign in'}
              </Button>
            )}
            <Button testID="guest-challenge" mode="outlined" icon="share-variant" onPress={() => void challenge()}>
              Challenge a friend
            </Button>
            <Button testID="guest-again" mode="outlined" icon="replay" onPress={onAgain}>
              {usedUp ? 'Play these again' : 'Play again'}
            </Button>
          </View>
        </View>
      </OutlinedCard>
      <GuestResultPager items={items} />
    </View>
  );
}

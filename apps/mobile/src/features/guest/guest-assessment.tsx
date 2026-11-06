// Ported from apps/web/src/features/guest/guest-assessment.tsx @ 0e3ec7a (working tree). Phase 63 (P11):
// a guest's Assessment, entirely on the phone. A few questions from the level's guest pool, one page
// each, with the drawing canvas for working: a choice question answered by choosing, a number question
// by typing the final number. Marked on the phone (`checkAnswer`, markAssessment); the results redraw
// each page beside the key and the worked solution. No PDF is built and nothing is stored or sent --
// the PDF, a tutor's review and the progress are what an account adds.
//
// Mobile: the members' Assessment pieces -- QuestionView (the stem and the choices, `assessment-choice-A`)
// and DrawingCanvas with the take screen's reducer (pen, eraser, undo) -- in the Quest frame, the canvas
// inside its scroll view (a touch on the page writes rather than scrolls). The results show one page at
// a time (guest-results.tsx) with that page's working drawn beneath, read-only.
import type { CanvasStroke, GuestTile } from '@tmi/shared';
import { guestSeries, guestTileName } from '@tmi/shared';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { EMPTY_TAKE, takeReducer } from '@/features/canvas-assessments/assessment-model';
import { DrawingCanvas } from '@/features/canvas-assessments/drawing-canvas';
import { fitCanvas, strokeFits, type CanvasTool } from '@/features/canvas-assessments/drawing-model';
import { QuestionView } from '@/features/canvas-assessments/question-view';
import { numberAnswerKeyboard } from '@/features/quest/number-keyboard';
import { QuestFrame, QuestStatus } from '@/features/quest/quest-frame';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { countEvent, flushEvents, useGuestPool } from './guest-api';
import { assessmentBenefits, assessmentCount, guestScore, markAssessment, playLink } from './guest-model';
import { exitGuestPlay, openSignupSheet, toSpace } from './guest-nav';
import { GuestResultPager } from './guest-results';
import { guestMemory } from './guest-store';
import { NudgeSheet } from './nudge-sheet';

const NO_STROKES: CanvasStroke[] = [];

export function GuestAssessment({ tile }: { tile: GuestTile }) {
  const theme = useAppTheme();
  const toast = useToast();
  const window = useWindowDimensions();
  const { config, status } = useAuth();
  const guest = config?.guest;
  const signedIn = status === 'authenticated';
  const pool = useGuestPool(guest?.version, tile.level_id);
  const count = guest ? assessmentCount(tile, guest.settings) : tile.value;
  // Drawn once from the pool: the series must not change under the guest as the memory does.
  const [seen] = useState(() => guestMemory.seen(tile.level_id));
  const questions = useMemo(
    () => guestSeries(pool.data?.questions ?? [], seen).slice(0, count),
    [pool.data, seen, count],
  );
  const [index, setIndex] = useState(0);
  const [take, dispatch] = useReducer(takeReducer, EMPTY_TAKE);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [finished, setFinished] = useState(false);
  const [offer, setOffer] = useState(false);
  const scroller = useRef<ScrollView | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || questions.length === 0) return;
    started.current = true;
    countEvent({ name: 'tile_started', tile: tile.code, source: 'guest' });
  }, [questions.length, tile.code]);

  const question = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const strokes = (question && take.work.pages[question.id]) || NO_STROKES;
  const addStroke = useCallback(
    (stroke: CanvasStroke) => {
      if (!question) return false;
      if (!strokeFits(strokes, stroke)) {
        toast.error('This page is full. Clear some writing to add more.');
        return false;
      }
      dispatch({ type: 'add', questionId: question.id, stroke });
      return true;
    },
    [question, strokes, toast],
  );
  const erase = useCallback(
    (hit: CanvasStroke[]) => {
      if (question) dispatch({ type: 'erase', questionId: question.id, hit });
    },
    [question],
  );

  const exit = () => exitGuestPlay(signedIn);
  // The page: the widest 5:4 sheet the screen gives, never taller than half of it.
  const canvas = fitCanvas(Math.min(window.width, 1100) - 2 * space.lg, window.height * 0.5);

  if (!guest || pool.isPending) {
    return (
      <QuestFrame title={guestTileName(tile)} testID="screen-guest-assessment" onExit={exit}>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Getting your assessment ready…
        </Text>
      </QuestFrame>
    );
  }
  if (!question) {
    return (
      <QuestFrame title={guestTileName(tile)} testID="screen-guest-assessment" onExit={exit}>
        <Text testID="guest-unavailable" variant="bodyMedium">
          This assessment is not available just now.
        </Text>
      </QuestFrame>
    );
  }

  const marks = markAssessment(questions, take.work.choices, numbers);
  const score = guestScore(marks.map((m) => ({ correct: m.right })));

  function finish() {
    haptics.success();
    setFinished(true);
    guestMemory.addSeen(tile.level_id, questions.map((q) => q.id));
    guestMemory.setBest(tile.code, score);
    countEvent({ name: 'assessment_finished', tile: tile.code, value: score });
    flushEvents();
    scroller.current?.scrollTo({ y: 0, animated: false });
  }

  const offerSheet = (
    <NudgeSheet
      open={offer}
      headline="Keep this assessment"
      description="With a free account:"
      benefits={assessmentBenefits(tile.level_id, guest.member_counts)}
      onSignUp={() => {
        countEvent({ name: 'signup_started', source: 'results', tile: tile.code });
        flushEvents();
        setOffer(false);
        openSignupSheet();
      }}
      onClose={() => setOffer(false)}
      closeLabel="Not now"
      shareLink={playLink(serverOrigin(), tile.code)}
    />
  );

  if (finished) {
    const items = marks.map((m, i) => ({
      number: i + 1,
      question: m.question,
      answer: m.given,
      correct: m.right,
      skipped: m.given === null,
    }));
    return (
      <QuestFrame title={guestTileName(tile)} testID="screen-guest-assessment" onExit={exit} scrollRef={scroller}>
        <OutlinedCard testID="guest-assessment-results" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.md }}>
            <Text
              testID="guest-assessment-score"
              variant="headlineSmall"
              accessibilityRole="header"
              style={{ fontWeight: '700' }}
            >
              {`${score} of ${questions.length} right`}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {guestTileName(tile)}
            </Text>
            {signedIn ? (
              <Button testID="guest-to-space" mode="contained" icon="home-outline" onPress={toSpace}>
                Go to my space
              </Button>
            ) : (
              <Button testID="guest-assessment-keep" mode="contained" onPress={() => setOffer(true)}>
                Keep it: PDF and a tutor’s review
              </Button>
            )}
            <Button testID="guest-assessment-home" mode="outlined" onPress={exit}>
              Back to quests
            </Button>
          </View>
        </OutlinedCard>
        <GuestResultPager
          items={items}
          label="Page"
          below={(item) => {
            const work = take.work.pages[item.question.id] ?? NO_STROKES;
            if (work.length === 0) return null;
            return (
              <View style={{ gap: space.xs }}>
                <Text variant="labelMedium" style={{ color: theme.tokens.mutedForeground }}>
                  Your working
                </Text>
                <DrawingCanvas
                  testID="guest-assessment-working"
                  strokes={work}
                  tool="pen"
                  width={canvas.width}
                  height={canvas.height}
                  onStroke={() => false}
                  onErase={() => undefined}
                  label={`Your working on page ${item.number}`}
                  disabled
                />
              </View>
            );
          }}
        />
        {offerSheet}
      </QuestFrame>
    );
  }

  const selected = question.kind === 'choice' ? (take.work.choices[question.id] ?? null) : null;
  const undoable = (take.history[question.id]?.length ?? 0) > 0;
  const last = index >= questions.length - 1;

  return (
    <QuestFrame
      title={guestTileName(tile)}
      testID="screen-guest-assessment"
      onExit={exit}
      scrollRef={scroller}
      status={<QuestStatus testID="guest-assessment-progress">{`Page ${index + 1} of ${questions.length}`}</QuestStatus>}
    >
      <OutlinedCard testID="guest-assessment-page" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text
              variant="labelMedium"
              style={{ color: theme.tokens.mutedForeground, fontWeight: '700' }}
            >
              {guestTileName(tile)}
            </Text>
          </View>
          <QuestionView
            question={{ ...question, skill: null }}
            selected={selected}
            onChoose={(choice) => dispatch({ type: 'choose', questionId: question.id, index: choice })}
          />
          {question.kind !== 'choice' ? (
            <TextInput
              testID="guest-assessment-number"
              mode="outlined"
              label="Your final answer"
              placeholder="Your final answer"
              value={numbers[question.id] ?? ''}
              onChangeText={(text) => setNumbers({ ...numbers, [question.id]: text })}
              keyboardType={numberAnswerKeyboard(Platform.OS)}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              returnKeyType="done"
              maxLength={120}
            />
          ) : null}
        </View>
      </OutlinedCard>

      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Writing tools"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
      >
        <Button
          testID="guest-assessment-pen"
          compact
          icon="pen"
          mode={tool === 'pen' ? 'contained' : 'outlined'}
          accessibilityState={{ selected: tool === 'pen' }}
          onPress={() => {
            haptics.selection();
            setTool('pen');
          }}
        >
          Pen
        </Button>
        <Button
          testID="guest-assessment-eraser"
          compact
          icon="eraser"
          mode={tool === 'eraser' ? 'contained' : 'outlined'}
          accessibilityState={{ selected: tool === 'eraser' }}
          onPress={() => {
            haptics.selection();
            setTool('eraser');
          }}
        >
          Eraser
        </Button>
        <View style={{ flex: 1 }} />
        <IconButton
          testID="guest-assessment-undo"
          icon="undo"
          accessibilityLabel="Undo"
          disabled={!undoable}
          onPress={() => dispatch({ type: 'undo', questionId: question.id })}
        />
      </View>
      <View style={{ alignItems: 'center' }}>
        <DrawingCanvas
          key={question.id}
          testID="guest-assessment-canvas"
          strokes={strokes}
          tool={tool}
          width={canvas.width}
          height={canvas.height}
          onStroke={addStroke}
          onErase={erase}
          label={`Working for page ${index + 1}`}
          scrollRef={scroller}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Button
          testID="guest-assessment-prev"
          mode="outlined"
          icon="chevron-left"
          disabled={index === 0}
          onPress={() => setIndex(index - 1)}
        >
          Previous
        </Button>
        {last ? (
          <Button testID="guest-assessment-finish" mode="contained" icon="check" onPress={finish}>
            Finish and mark
          </Button>
        ) : (
          <Button
            testID="guest-assessment-next"
            mode="contained"
            icon="chevron-right"
            contentStyle={{ flexDirection: 'row-reverse' }}
            onPress={() => {
              haptics.selection();
              setIndex(index + 1);
              scroller.current?.scrollTo({ y: 0, animated: false });
            }}
          >
            Next page
          </Button>
        )}
      </View>
    </QuestFrame>
  );
}

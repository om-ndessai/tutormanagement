// Ported from apps/web/src/features/canvas-assessments/take-assessment-page.tsx @ 22b9701.
//
// Taking an assessment. One question per page, written by hand, with nothing checked or marked; any
// page can be revisited and edited, and it can be submitted at any time. The work stays on this
// device (saved as it goes, so leaving and coming back loses nothing) until it is submitted.
// Mobile: the screen never scrolls while writing -- the question scrolls in its own box, and the
// canvas is the largest 5:4 page that fits what is left (beside the question on a wide screen, an
// iPad in landscape). The swipe back is off here, so an edge stroke never leaves the page.
// Phase 77 (JF20, owner 2026-11-05): when whoever opened it is not the student -- a guardian continuing her child's,
// or whoever started it for them -- the questions wait behind "Hand the device to Noor" ("Noor answers on this device.
// Answers written on another device stay there.", then "Noor is ready"); a submit then says where the PDF goes, never
// linking it (R17: the PDF is the tutors' and the admins').
import { featureAllowed, levelLabel } from '@tmi/shared';
import type { CanvasStroke } from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { BadgePill } from '@/components/badge-pill';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { DetailSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { readCanvasWork, writeCanvasWork } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCanvasAssessment, useSubmitCanvasAssessment } from './api';
import {
  EMPTY_TAKE,
  handOverWords,
  handsOver,
  pageLabel,
  pageMark,
  parseSavedWork,
  submitMessage,
  submitPages,
  submittedMessage,
  takeReducer,
  unansweredCount,
} from './assessment-model';
import { DrawingCanvas } from './drawing-canvas';
import { fitCanvas, strokeFits, type CanvasTool } from './drawing-model';
import { QuestionView } from './question-view';

const NO_STROKES: CanvasStroke[] = [];

export function TakeAssessmentScreen() {
  const { organization, user } = useAuth();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const detail = useCanvasAssessment(id);
  const submit = useSubmitCanvasAssessment(id);

  const [state, dispatch] = useReducer(takeReducer, EMPTY_TAKE);
  const [loaded, setLoaded] = useState(false);
  // Phase 77 (JF20): the device handed to the student, once per opening.
  const [handedOver, setHandedOver] = useState(false);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [area, setArea] = useState({ width: 0, height: 0 });
  // The question card's scroll on a phone: whether more of the question waits below its edge. Kept per
  // question (its id), so a new question starts at the top without an effect resetting it.
  const [cardScrollState, setCardScrollState] = useState({ id: '', view: 0, content: 0, offset: 0 });

  const assessment = detail.data?.data;
  const questions = useMemo(() => assessment?.questions ?? [], [assessment]);
  const question = questions[index];
  const cardScroll =
    question && cardScrollState.id === question.id ? cardScrollState : { id: question?.id ?? '', view: 0, content: 0, offset: 0 };
  // Built from the latest state (onLayout and onContentSizeChange can land in one tick), started afresh per question.
  const setCardScroll = (update: (s: typeof cardScroll) => typeof cardScroll) => {
    const id = question?.id ?? '';
    setCardScrollState((prev) => ({ ...update(prev.id === id ? prev : { id, view: 0, content: 0, offset: 0 }), id }));
  };
  const strokes = (question && state.work.pages[question.id]) || NO_STROKES;
  const unanswered = unansweredCount(questions, state.work);

  // The work kept on this device: read once, then saved as it changes (and when the app is left).
  const latest = useRef(state.work);
  useEffect(() => {
    latest.current = state.work;
  }, [state.work]);
  const keep = useRef(true);
  useEffect(() => {
    let cancelled = false;
    void readCanvasWork(id).then((raw) => {
      if (cancelled) return;
      dispatch({ type: 'load', work: parseSavedWork(raw) });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      if (keep.current) void writeCanvasWork(id, JSON.stringify(state.work));
    }, 300);
    return () => clearTimeout(timer);
  }, [id, loaded, state.work]);
  useEffect(() => {
    const flush = () => {
      if (loaded && keep.current) void writeCanvasWork(id, JSON.stringify(latest.current));
    };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [id, loaded]);
  // Submitted or discarded elsewhere: nothing here is worth keeping.
  useEffect(() => {
    if (assessment && assessment.status !== 'in_progress') {
      keep.current = false;
      void writeCanvasWork(id, null);
    }
  }, [assessment, id]);

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

  async function send() {
    try {
      await submit.mutateAsync(submitPages(questions, state.work));
      keep.current = false;
      await writeCanvasWork(id, null);
      toast.success(
        submittedMessage({
          own: !assessment || assessment.student_user_id === user?.id,
          studentName: assessment?.student_name ?? '',
          tutoring: featureAllowed(organization, 'tutoring'),
        }),
      );
      if (router.canGoBack()) router.back();
      else router.replace('/assessments');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not submit the assessment.');
    }
  }

  function confirmSubmit() {
    haptics.warning();
    Alert.alert('Submit this assessment?', submitMessage(unanswered, questions.length), [
      { text: 'Keep working', style: 'cancel' },
      { text: 'Submit', onPress: () => void send() },
    ]);
  }

  function onArea(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setArea((was) =>
      Math.round(was.width) === Math.round(width) && Math.round(was.height) === Math.round(height)
        ? was
        : { width, height },
    );
  }

  if (detail.isPending || !loaded) {
    return (
      <Screen testID="screen-assessment-take">
        <Stack.Screen options={{ title: 'Assessment' }} />
        <DetailSkeleton label="Loading the assessment…" rows={4} />
      </Screen>
    );
  }

  if (!assessment || !assessment.questions || questions.length === 0 || !question) {
    return (
      <Screen testID="screen-assessment-take">
        <Stack.Screen options={{ title: 'Assessment' }} />
        <OutlinedCard testID="assessment-unavailable">
          <View style={{ gap: space.md, padding: space.lg }}>
            <Text variant="bodyMedium">
              This assessment cannot be taken here: it has been submitted or discarded, or it is not yours to continue.
            </Text>
            <Button
              mode="outlined"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/assessments'))}
            >
              Back to Assessment
            </Button>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  if (handsOver(assessment, user?.id) && !handedOver) {
    const words = handOverWords(assessment.student_name);
    return (
      <Screen testID="screen-assessment-take">
        <Stack.Screen options={{ title: 'Assessment' }} />
        <OutlinedCard testID="assessment-hand-over" style={{ borderRadius: radius.lg }}>
          <View style={{ gap: space.lg, padding: space.xl, alignItems: 'flex-start' }}>
            <Icon source="hand-extended-outline" size={40} color={theme.colors.primary} />
            <Text
              testID="assessment-hand-over-title"
              variant="headlineSmall"
              accessibilityRole="header"
              style={{ fontWeight: '700' }}
            >
              {words.title}
            </Text>
            <Text testID="assessment-hand-over-body" variant="bodyLarge">
              {words.body}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {`${assessment.student_name} · ${levelLabel(assessment.level_id)} · ${questions.length} ${
                questions.length === 1 ? 'question' : 'questions'
              }`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Button
                testID="assessment-ready"
                mode="contained"
                icon="pen"
                contentStyle={{ minHeight: MIN_TARGET }}
                onPress={() => {
                  haptics.selection();
                  setHandedOver(true);
                }}
              >
                {words.ready}
              </Button>
              <Button
                testID="assessment-hand-over-not-now"
                mode="outlined"
                contentStyle={{ minHeight: MIN_TARGET }}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/assessments'))}
              >
                Not now
              </Button>
            </View>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  // An iPad in landscape (or any wide screen): the question beside the page, not above it.
  const wide = window.width >= 700 && window.width > window.height;
  const canvas = fitCanvas(area.width, area.height);
  const undoable = (state.history[question.id]?.length ?? 0) > 0;
  const selected = question.kind === 'choice' ? (state.work.choices[question.id] ?? null) : null;

  const pageButtons = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Questions"
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: space.xs, paddingVertical: 2 }}
    >
      {questions.map((q, i) => {
        const mark = pageMark(q, state.work);
        const current = i === index;
        const marked = (mark.written || mark.chosen) && !current;
        return (
          <Button
            key={q.id}
            testID={`assessment-page-${i + 1}`}
            compact
            mode={current ? 'contained' : 'outlined'}
            accessibilityLabel={pageLabel(i + 1, mark)}
            accessibilityState={{ selected: current }}
            onPress={() => setIndex(i)}
            style={{
              minWidth: MIN_TARGET,
              borderRadius: radius.md,
              borderColor: marked ? theme.colors.primary : theme.colors.outline,
              borderWidth: marked ? 2 : 1,
            }}
            labelStyle={{ marginHorizontal: space.sm, color: current || marked ? undefined : theme.colors.onSurface }}
          >
            {String(i + 1)}
          </Button>
        );
      })}
    </ScrollView>
  );

  // On a phone the card shares the screen with the page for working. A choice question gets up to half of
  // it, so its answers fit (the page is only for working there), and any card still taller than its space
  // says so: the fourth choice once sat hidden below the card with nothing to show it was there (UI audit
  // J06A step 37) -- and code marks the choice, so an unseen right answer is marked wrong.
  const cardMax = Math.max(question.kind === 'choice' ? 220 : 160, window.height * (question.kind === 'choice' ? 0.5 : 0.34));
  const showMore = !wide && cardScroll.content > cardScroll.view + 4 && cardScroll.offset + cardScroll.view < cardScroll.content - 4;
  const questionCard = (
    <OutlinedCard
      style={{ borderRadius: radius.lg, ...(wide ? { flex: 1 } : { flexShrink: 1 }) }}
      contentStyle={wide ? { flex: 1 } : undefined}
    >
      <ScrollView
        testID="assessment-question-card"
        style={wide ? { flex: 1 } : { maxHeight: cardMax }}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        persistentScrollbar
        scrollEventThrottle={64}
        onLayout={(event) => {
          // Read now: the event is released before a state update runs.
          const height = event.nativeEvent.layout.height;
          setCardScroll((s) => ({ ...s, view: height }));
        }}
        onContentSizeChange={(_w, h) => setCardScroll((s) => ({ ...s, content: h }))}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          setCardScroll((s) => (Math.abs(s.offset - y) < 8 ? s : { ...s, offset: y }));
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          <BadgePill />
          <Text variant="bodySmall" style={{ flex: 1, minWidth: 160, color: theme.tokens.mutedForeground }}>
            {`${assessment.student_name} · ${levelLabel(assessment.level_id)} · ` +
              (question.kind === 'choice'
                ? 'Choose your answer, and use the page below for your working.'
                : 'Write your working and your answer below.') +
              (featureAllowed(organization, 'tutoring')
                ? ' Nothing is marked until your tutor reviews it.'
                : // Phase 74 (JF31): a space without Tutoring has no tutor to promise.
                  ' Nothing is marked yet: your teacher (or parent) looks at it next.')}
          </Text>
        </View>
        <QuestionView
          question={question}
          selected={selected}
          onChoose={(choice) => dispatch({ type: 'choose', questionId: question.id, index: choice })}
        />
      </ScrollView>
      {showMore ? (
        <View
          testID="assessment-more-below"
          pointerEvents="none"
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: space.xs,
            paddingVertical: space.xs,
            borderTopWidth: 1,
            borderTopColor: theme.tokens.border,
            backgroundColor: theme.colors.elevation.level1,
          }}
        >
          <Icon source="chevron-down" size={18} color={theme.tokens.mutedForeground} />
          <Text variant="labelMedium" style={{ color: theme.tokens.mutedForeground }}>
            {question.kind === 'choice' ? 'More choices below: scroll the question' : 'More below: scroll the question'}
          </Text>
        </View>
      ) : null}
    </OutlinedCard>
  );

  const tools = (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Writing tools"
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
    >
      <Button
        testID="assessment-pen"
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
        testID="assessment-eraser"
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
        testID="assessment-undo"
        icon="undo"
        accessibilityLabel="Undo"
        disabled={!undoable}
        onPress={() => dispatch({ type: 'undo', questionId: question.id })}
      />
      <IconButton
        testID="assessment-clear"
        icon="delete-outline"
        accessibilityLabel="Clear page"
        disabled={strokes.length === 0}
        onPress={() => dispatch({ type: 'clear', questionId: question.id })}
      />
    </View>
  );

  const page = (
    <View style={{ flex: 1, gap: space.sm }}>
      {tools}
      <View style={{ flex: 1, justifyContent: 'center' }} onLayout={onArea}>
        {canvas.width > 0 ? (
          <DrawingCanvas
            strokes={strokes}
            tool={tool}
            width={canvas.width}
            height={canvas.height}
            onStroke={addStroke}
            onErase={erase}
            label={`Writing for question ${index + 1}`}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        <Button
          testID="assessment-previous"
          mode="outlined"
          icon="chevron-left"
          disabled={index === 0}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </Button>
        <Button
          testID="assessment-next"
          mode="outlined"
          icon="chevron-right"
          contentStyle={{ flexDirection: 'row-reverse' }}
          disabled={index === questions.length - 1}
          onPress={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Next
        </Button>
      </View>
    </View>
  );

  return (
    <Screen
      testID="screen-assessment-take"
      scroll={false}
      contentStyle={{ gap: space.sm, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom }}
    >
      <Stack.Screen
        options={{
          title: `Question ${index + 1} of ${questions.length}`,
          // A stroke from the left edge must never leave the page.
          gestureEnabled: false,
          headerRight: () => (
            <Button
              testID="assessment-submit"
              mode="contained"
              compact
              disabled={submit.isPending}
              loading={submit.isPending}
              onPress={confirmSubmit}
            >
              Submit
            </Button>
          ),
        }}
      />
      {wide ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: space.lg }}>
          <View style={{ width: Math.min(460, window.width * 0.38), gap: space.sm }}>
            {pageButtons}
            {questionCard}
          </View>
          {page}
        </View>
      ) : (
        <>
          {pageButtons}
          {questionCard}
          {page}
        </>
      )}
    </Screen>
  );
}

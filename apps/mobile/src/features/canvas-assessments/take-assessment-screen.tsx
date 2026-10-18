// Ported from apps/web/src/features/canvas-assessments/take-assessment-page.tsx @ 22b9701.
//
// Taking an assessment. One question per page, written by hand, with nothing checked or marked; any
// page can be revisited and edited, and it can be submitted at any time. The work stays on this
// device (saved as it goes, so leaving and coming back loses nothing) until it is submitted.
// Mobile: the screen never scrolls while writing -- the question scrolls in its own box, and the
// canvas is the largest 5:4 page that fits what is left (beside the question on a wide screen, an
// iPad in landscape). The swipe back is off here, so an edge stroke never leaves the page.
import { levelLabel } from '@tmi/shared';
import type { CanvasStroke } from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, AppState, ScrollView, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Button, Text } from 'react-native-paper';
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
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCanvasAssessment, useSubmitCanvasAssessment } from './api';
import {
  EMPTY_TAKE,
  pageLabel,
  pageMark,
  parseSavedWork,
  submitMessage,
  submitPages,
  takeReducer,
  unansweredCount,
} from './assessment-model';
import { DrawingCanvas } from './drawing-canvas';
import { fitCanvas, strokeFits, type CanvasTool } from './drawing-model';
import { QuestionView } from './question-view';

const NO_STROKES: CanvasStroke[] = [];

export function TakeAssessmentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const detail = useCanvasAssessment(id);
  const submit = useSubmitCanvasAssessment(id);

  const [state, dispatch] = useReducer(takeReducer, EMPTY_TAKE);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [area, setArea] = useState({ width: 0, height: 0 });

  const assessment = detail.data?.data;
  const questions = useMemo(() => assessment?.questions ?? [], [assessment]);
  const question = questions[index];
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
      toast.success('Submitted. The tutor gets a PDF of your answers.');
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
              This assessment cannot be taken here: it has been submitted or discarded, or somebody else started it.
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

  const questionCard = (
    <OutlinedCard
      style={{ borderRadius: radius.lg, ...(wide ? { flex: 1 } : { flexShrink: 1 }) }}
      contentStyle={wide ? { flex: 1 } : undefined}
    >
      <ScrollView
        style={wide ? { flex: 1 } : { maxHeight: Math.max(160, window.height * 0.34) }}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
          <BadgePill />
          <Text variant="bodySmall" style={{ flex: 1, minWidth: 160, color: theme.tokens.mutedForeground }}>
            {`${assessment.student_name} · ${levelLabel(assessment.level_id)} · ` +
              (question.kind === 'choice'
                ? 'Choose your answer, and use the page below for your working.'
                : 'Write your working and your answer below.') +
              ' Nothing is marked until your tutor reviews it.'}
          </Text>
        </View>
        <QuestionView
          question={question}
          selected={selected}
          onChoose={(choice) => dispatch({ type: 'choose', questionId: question.id, index: choice })}
        />
      </ScrollView>
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

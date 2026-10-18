// Ported from apps/web/src/features/canvas-assessments/review-assessment-page.tsx (Phase 40), which
// replaced the Phase 38 page this file first held (that one is now assessment-pdf-screen.tsx).
//
// The tutor reviews a submitted assessment online. The submitted PDF's pages, each with a layer of
// the tutor's red ink and a note, and an overall comment; no scoring yet (owner, 2026-10-18). The
// draft saves itself as the tutor works; "Save as reviewed" writes the reviewed PDF, which the
// student, their parents, their tutors and the admins can then read. Only the student's current
// tutors and the admins come here (R17).
//
// Mobile: the pages are drawn by pdf.js in a hidden web view and shown as native images
// (use-pdf-pages.tsx); the ink is the student's canvas as a red overlay in the page's own points.
// A touch on a page marks it and a touch beside it scrolls; once a stylus is used, a finger scrolls
// anywhere. The pen and the eraser sit in the header, so they stay in reach down a long review. The
// draft is also saved when the screen is left.
import {
  REVIEW_LIMITS,
  REVIEW_PAGE,
  levelLabel,
  type CanvasReview,
  type CanvasStroke,
} from '@tmi/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, Image, PixelRatio, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Button, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { DetailSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import {
  useCanvasAssessmentSummary,
  useCanvasReview,
  useFinishCanvasReview,
  useReopenCanvasReview,
  useSaveCanvasReview,
} from './api';
import { takeReducer, type TakeState } from './assessment-model';
import { DrawingCanvas } from './drawing-canvas';
import { strokeFits, type CanvasTool } from './drawing-model';
import { AUTOSAVE_MS, inkFrom, REVIEW_PEN, reviewPayload, saveStateText, type SaveState } from './review-model';
import { usePdfPageImages } from './use-pdf-pages';

const NO_STROKES: CanvasStroke[] = [];

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/assessments');
}

export function ReviewAssessmentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const summary = useCanvasAssessmentSummary(id);
  const review = useCanvasReview(id);
  const assessment = summary.data?.data;

  if (summary.isPending || (assessment?.can_review && review.isPending)) {
    return (
      <Screen testID="screen-assessment-review">
        <Stack.Screen options={{ title: 'Review' }} />
        <DetailSkeleton label="Loading the review…" rows={4} />
      </Screen>
    );
  }

  if (!assessment || !assessment.can_review || !review.data) {
    return (
      <Screen testID="screen-assessment-review">
        <Stack.Screen options={{ title: 'Review' }} />
        <OutlinedCard testID="assessment-review-denied">
          <View style={{ gap: space.md, padding: space.lg }}>
            <Text variant="bodyMedium">Reviewing an assessment is for the student’s tutors and the office.</Text>
            {assessment?.reviewed_at ? (
              <Button
                mode="contained"
                style={{ alignSelf: 'flex-start' }}
                onPress={() =>
                  router.replace({ pathname: '/assessments/pdf/[id]', params: { id, kind: 'reviewed' } })
                }
              >
                Open the review
              </Button>
            ) : null}
            <Button mode="outlined" style={{ alignSelf: 'flex-start' }} onPress={back}>
              Back to Assessment
            </Button>
          </View>
        </OutlinedCard>
      </Screen>
    );
  }

  return (
    <ReviewEditor
      key={id}
      id={id}
      review={review.data.data}
      title={`${assessment.student_name} · ${levelLabel(assessment.level_id)}`}
    />
  );
}

function initialInk(review: CanvasReview): TakeState {
  return { work: { pages: inkFrom(review), choices: {} }, history: {} };
}

function ReviewEditor({ id, review, title }: { id: string; review: CanvasReview; title: string }) {
  const theme = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const save = useSaveCanvasReview(id);
  const finish = useFinishCanvasReview(id);
  const reopen = useReopenCanvasReview(id);
  const scrollRef = useRef<ScrollView>(null);

  // Each page as wide as the screen allows (and on a tablet, no taller than the screen), drawn at
  // up to twice its width in pixels.
  const pageWidth = Math.floor(
    Math.min(window.width - 2 * space.lg - 2 * space.md, (window.height - 160) * (REVIEW_PAGE.width / REVIEW_PAGE.height), 900),
  );
  const pageHeight = Math.round(pageWidth * (REVIEW_PAGE.height / REVIEW_PAGE.width));
  const [pixelWidth] = useState(() => Math.min(1600, Math.max(800, Math.round(pageWidth * Math.min(PixelRatio.get(), 2)))));
  const images = usePdfPageImages(id, pixelWidth);

  const [final, setFinal] = useState(review.status === 'final');
  const [comment, setComment] = useState(review.comment);
  const [notes, setNotes] = useState<Record<string, string>>(review.notes);
  const [ink, dispatch] = useReducer(takeReducer, review, initialInk);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  // Whether the review exists on the server yet: finishing needs one, even an empty one.
  const [hasRow, setHasRow] = useState(review.status !== 'none');

  // What the next save sends, and whether leaving the screen should save it.
  const latest = useRef({ comment, notes, ink: ink.work.pages, dirty, final });
  useEffect(() => {
    latest.current = { comment, notes, ink: ink.work.pages, dirty, final };
  }, [comment, notes, ink.work.pages, dirty, final]);

  const flush = useCallback(async (): Promise<boolean> => {
    setSaveState('saving');
    try {
      const { comment: c, notes: n, ink: k } = latest.current;
      await save.mutateAsync(reviewPayload(c, n, k));
      setDirty(false);
      setHasRow(true);
      setSaveState('saved');
      return true;
    } catch (caught) {
      setSaveState('failed');
      if (caught instanceof ApiRequestError) toast.error(caught.message);
      return false;
    }
  }, [save, toast]);

  // The draft saves itself a moment after the tutor stops.
  useEffect(() => {
    if (!dirty || final) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, comment, notes, ink.work.pages, final, flush]);

  // Leaving with changes not yet saved: they are saved on the way out.
  const saveOnLeave = save.mutate;
  useEffect(
    () => () => {
      const { comment: c, notes: n, ink: k, dirty: d, final: f } = latest.current;
      if (d && !f) saveOnLeave(reviewPayload(c, n, k));
    },
    [saveOnLeave],
  );

  function touch() {
    setDirty(true);
  }

  async function saveAsReviewed() {
    if ((dirty || !hasRow) && !(await flush())) return;
    try {
      await finish.mutateAsync();
      toast.success('Saved as reviewed. The student and their family can now read it.');
      router.replace({ pathname: '/assessments/pdf/[id]', params: { id, kind: 'reviewed' } });
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save the review.');
    }
  }

  function confirmFinish() {
    haptics.warning();
    Alert.alert(
      'Save this as reviewed?',
      'The reviewed PDF is written with your marks, notes and comment, and the student, their parents, their tutors and the office can then read it. You can reopen it later to change it.',
      [
        { text: 'Keep reviewing', style: 'cancel' },
        { text: 'Save as reviewed', onPress: () => void saveAsReviewed() },
      ],
    );
  }

  async function reopenReview() {
    try {
      await reopen.mutateAsync();
      setFinal(false);
      toast.success('Review reopened. The family no longer sees it until it is saved as reviewed again.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not reopen the review.');
    }
  }

  function chooseTool(next: CanvasTool) {
    haptics.selection();
    setTool(next);
  }

  const muted = theme.tokens.mutedForeground;
  const inputColors = { backgroundColor: theme.colors.surface };

  return (
    <View testID="screen-assessment-review" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen
        options={{
          title: 'Review',
          headerRight: final
            ? undefined
            : () => (
                <View accessibilityRole="toolbar" accessibilityLabel="Marking tools" style={{ flexDirection: 'row' }}>
                  <IconButton
                    testID="review-pen"
                    icon="pen"
                    mode={tool === 'pen' ? 'contained' : undefined}
                    selected={tool === 'pen'}
                    iconColor={theme.colors.error}
                    accessibilityLabel="Red pen"
                    accessibilityState={{ selected: tool === 'pen' }}
                    onPress={() => chooseTool('pen')}
                  />
                  <IconButton
                    testID="review-eraser"
                    icon="eraser"
                    mode={tool === 'eraser' ? 'contained' : undefined}
                    selected={tool === 'eraser'}
                    accessibilityLabel="Eraser"
                    accessibilityState={{ selected: tool === 'eraser' }}
                    onPress={() => chooseTool('eraser')}
                  />
                </View>
              ),
        }}
      />
      {images.renderer}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
            <Text variant="titleLarge" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {`Review: ${title}`}
            </Text>
            <View
              style={{
                backgroundColor: final ? theme.colors.primary : theme.tokens.secondary,
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: 2,
              }}
            >
              <Text
                testID="review-status"
                variant="labelMedium"
                style={{ color: final ? theme.colors.onPrimary : theme.tokens.secondaryForeground }}
              >
                {final ? 'Reviewed' : 'Draft'}
              </Text>
            </View>
          </View>
          <Text testID="review-save-state" variant="bodySmall" style={{ color: muted }}>
            {saveStateText({ final, finishedAt: review.finished_at, saveState, dirty })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Button
            testID="review-submitted-pdf"
            mode="outlined"
            compact
            icon="file-document-outline"
            onPress={() => router.push({ pathname: '/assessments/pdf/[id]', params: { id } })}
          >
            Submitted PDF
          </Button>
          {final ? (
            <>
              <Button
                testID="review-open-reviewed"
                mode="contained"
                compact
                onPress={() => router.push({ pathname: '/assessments/pdf/[id]', params: { id, kind: 'reviewed' } })}
              >
                Open the review
              </Button>
              <Button
                testID="review-reopen"
                mode="outlined"
                compact
                disabled={reopen.isPending}
                loading={reopen.isPending}
                onPress={() => void reopenReview()}
              >
                Reopen review
              </Button>
            </>
          ) : (
            <Button
              testID="review-finish"
              mode="contained"
              compact
              disabled={finish.isPending}
              loading={finish.isPending}
              onPress={confirmFinish}
            >
              Save as reviewed
            </Button>
          )}
        </View>

        <OutlinedCard style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.md, gap: space.sm }}>
            <TextInput
              testID="review-comment"
              mode="outlined"
              label="Overall comment"
              placeholder="What went well, and what to work on next."
              value={comment}
              disabled={final}
              multiline
              numberOfLines={3}
              maxLength={REVIEW_LIMITS.commentChars}
              onChangeText={(next) => {
                setComment(next);
                touch();
              }}
              style={inputColors}
            />
            {!final ? (
              <Text variant="bodySmall" style={{ color: muted }}>
                Mark up any page with the red pen. No scores: say what you see in the notes.
              </Text>
            ) : null}
          </View>
        </OutlinedCard>

        {images.state === 'error' ? (
          <Text testID="review-pages-error" variant="bodyMedium" style={{ color: theme.colors.error }}>
            The submitted PDF could not be shown.
          </Text>
        ) : null}
        {images.state === 'loading' ? (
          <View accessibilityLabel="Loading the pages…">
            <Skeleton width="100%" height={pageHeight} style={{ borderRadius: radius.md }} />
          </View>
        ) : null}

        {images.state === 'ready'
          ? review.questions.map((question, index) => {
              const position = index + 1;
              const image = images.pages.find((page) => page.number === question.pdf_page);
              const strokes = ink.work.pages[question.id] ?? NO_STROKES;
              const undoable = (ink.history[question.id]?.length ?? 0) > 0;
              return (
                <OutlinedCard key={question.id} testID={`review-page-${position}`} style={{ borderRadius: radius.lg }}>
                  <View style={{ padding: space.md, gap: space.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="titleMedium" accessibilityRole="header">
                        {`Question ${position}`}
                      </Text>
                      {!final ? (
                        <View style={{ flexDirection: 'row' }}>
                          <IconButton
                            testID={`review-undo-${position}`}
                            icon="undo"
                            accessibilityLabel={`Undo on question ${position}`}
                            disabled={!undoable}
                            onPress={() => {
                              dispatch({ type: 'undo', questionId: question.id });
                              touch();
                            }}
                          />
                          <IconButton
                            testID={`review-clear-${position}`}
                            icon="delete-outline"
                            accessibilityLabel={`Clear marks on question ${position}`}
                            disabled={strokes.length === 0}
                            onPress={() => {
                              dispatch({ type: 'clear', questionId: question.id });
                              touch();
                            }}
                          />
                        </View>
                      ) : null}
                    </View>
                    {image ? (
                      <View
                        style={{
                          width: pageWidth,
                          height: pageHeight,
                          alignSelf: 'center',
                          borderRadius: radius.sm,
                          borderWidth: 1,
                          borderColor: theme.colors.outlineVariant,
                          overflow: 'hidden',
                        }}
                      >
                        <Image
                          source={{ uri: image.src }}
                          accessibilityLabel={`Question ${position} as submitted`}
                          style={{ width: pageWidth, height: pageHeight }}
                          resizeMode="contain"
                        />
                        <DrawingCanvas
                          testID={`review-ink-${position}`}
                          variant="overlay"
                          size={REVIEW_PAGE}
                          penWidth={REVIEW_PEN}
                          width={pageWidth}
                          height={pageHeight}
                          strokes={strokes}
                          tool={tool}
                          disabled={final}
                          scrollRef={scrollRef}
                          label={`Your marks on question ${position}`}
                          onStroke={(stroke) => {
                            if (!strokeFits(strokes, stroke, REVIEW_LIMITS)) {
                              toast.error('This page holds as much marking as a review can keep.');
                              return false;
                            }
                            dispatch({ type: 'add', questionId: question.id, stroke });
                            touch();
                            return true;
                          }}
                          onErase={(hit) => {
                            dispatch({ type: 'erase', questionId: question.id, hit });
                            touch();
                          }}
                        />
                      </View>
                    ) : null}
                    <TextInput
                      testID={`review-note-${position}`}
                      mode="outlined"
                      label={`Note on question ${position}`}
                      value={notes[question.id] ?? ''}
                      disabled={final}
                      multiline
                      maxLength={REVIEW_LIMITS.noteChars}
                      onChangeText={(next) => {
                        setNotes((was) => ({ ...was, [question.id]: next }));
                        touch();
                      }}
                      style={inputColors}
                    />
                  </View>
                </OutlinedCard>
              );
            })
          : null}
      </ScrollView>
    </View>
  );
}

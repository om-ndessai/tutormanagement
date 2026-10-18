// Ported from apps/web/src/features/question-bank/review-page.tsx @ b0d216e: the review queue, every
// checked question one at a time, with Approve, Retire and Skip, and "N left" from the coverage.
// Mobile (#54):
// - one web view for the session: each next body is swapped into it in place;
// - the actions sit in a bar at the bottom, in thumb reach, and wake only once the question has been
//   drawn and 350 ms have passed, so a quick second tap cannot approve a question nobody saw;
// - no toasts (the next card is the confirmation; a refusal stays inline above the bar);
// - an action's answer is written into the caches; the queue is read again only when the loaded
//   page runs low (or on a pull), never after each tap -- the web's refetch-per-action reads
//   ~4,500 D1 rows per approval.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, RefreshControl, ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConnectivityBanner } from '@/components/connectivity';
import { EmptyState, ErrorState } from '@/components/state-views';
import { ListSkeleton } from '@/components/skeletons';
import { useLargeText } from '@/hooks/use-large-text';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useQuestionAction, useQuestionCoverage, useQuestions } from './api';
import { leftCount, nextInQueue, queueRunsLow, unactedCount, waitingCount } from './bank-model';
import { QuestionCard, errorMessage } from './question-card';
import { confirmRetire } from './retire-confirm';

/** How long a new card shows before its actions wake. */
export const ARM_DELAY_MS = 350;

export function ReviewScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const large = useLargeText();
  const queue = useQuestions({ status: 'checked' });
  const coverage = useQuestionCoverage();
  const action = useQuestionAction();
  const items = useMemo(() => queue.data?.data ?? [], [queue.data]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const skippedSet = useMemo(() => new Set(skipped), [skipped]);
  const current = nextInQueue(items, skippedSet, done);
  const currentId = current?.id ?? null;
  const [rendered, setRendered] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ id: string; message: string } | null>(null);
  const [move, setMove] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const position = useRef<View>(null);

  // The queue loads a page at a time; the count is the whole bank's.
  const waiting = waitingCount(coverage.data?.data);
  const left = leftCount(waiting ?? items.length, skipped.length);
  const ready = currentId !== null && rendered === currentId && armed === currentId && !action.isPending;

  // A new card: back to its top, its actions asleep for a moment, and (after a move) the screen
  // reader taken to the position line, which says what happened and what is next.
  useEffect(() => {
    if (!currentId) return;
    scroller.current?.scrollTo({ y: 0, animated: false });
    const timer = setTimeout(() => setArmed(currentId), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  useEffect(() => {
    if (currentId && move && position.current) {
      AccessibilityInfo.sendAccessibilityEvent(position.current, 'focus');
    }
  }, [currentId, move]);

  // Few un-acted questions left in the loaded page, and more waiting: read the next page -- at most
  // once per move, so a page that brings nothing new (all skipped) cannot loop.
  const unacted = unactedCount(items, skippedSet, done);
  const moves = done.size + skipped.length;
  const asked = useRef(-1);
  const { isSuccess, isFetching, refetch } = queue;
  useEffect(() => {
    if (!isSuccess || isFetching || asked.current === moves) return;
    if (!queueRunsLow(unacted, waiting, skipped.length)) return;
    asked.current = moves;
    void refetch();
  }, [isSuccess, isFetching, moves, unacted, waiting, skipped.length, refetch]);

  async function act(kind: 'approve' | 'retire') {
    if (!ready || !current) return;
    const id = current.id;
    if (kind === 'retire' && !(await confirmRetire())) return;
    setRefusal(null);
    try {
      await action.mutateAsync({ id, action: kind });
      haptics.success();
      setMove(kind === 'approve' ? 'Approved.' : 'Retired.');
      setDone((was) => new Set(was).add(id));
    } catch (error) {
      haptics.error();
      setRefusal({ id, message: errorMessage(error) });
      // A refusal means something changed elsewhere: read the queue again.
      if (error instanceof ApiRequestError && error.status === 409) void queue.refetch();
    }
  }

  function skip() {
    if (!ready || !current) return;
    haptics.selection();
    setRefusal(null);
    setMove('Skipped.');
    setSkipped((was) => [...was, current.id]);
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([queue.refetch(), coverage.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const leftLine = `${left} left${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}`;
  const spokenPosition = current
    ? `${move ? `${move} Next: ` : ''}${current.level_name}, ${current.topic_code} ${current.topic_name}. ${leftLine}.`
    : '';

  let body;
  if (queue.isError) {
    body = <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />;
  } else if (!queue.isSuccess || (!current && queue.isFetching)) {
    body = <ListSkeleton label="Loading the questions to review…" count={2} height={200} />;
  } else if (!current) {
    body =
      skipped.length > 0 ? (
        <EmptyState
          testID="question-bank-empty"
          icon="skip-next-circle-outline"
          title="Only skipped questions are left."
          action={
            <Button
              testID="question-bank-again"
              mode="contained"
              onPress={() => {
                haptics.selection();
                setMove(null);
                setSkipped([]);
              }}
            >
              Go through them again
            </Button>
          }
        />
      ) : (
        <EmptyState
          testID="question-bank-empty"
          icon="check-all"
          title="Nothing waiting for review."
          action={
            <Button
              mode="outlined"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/platform/questions'))}
            >
              Back to the question bank
            </Button>
          }
        />
      );
  } else {
    body = (
      <View style={{ gap: space.md }}>
        <View ref={position} accessible accessibilityLabel={spokenPosition} style={{ gap: 2 }}>
          <Text
            testID="question-bank-position"
            variant="bodyMedium"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {current.level_name} ·{' '}
            <Text style={{ fontWeight: '700', color: theme.colors.onSurface }}>{current.topic_code}</Text>{' '}
            {current.topic_name}
          </Text>
          <Text
            testID="question-bank-left"
            variant="bodySmall"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {leftLine}
          </Text>
        </View>
        <QuestionCard question={current} persistent onRendered={setRendered} />
      </View>
    );
  }

  const shownRefusal = refusal && refusal.id === currentId ? refusal.message : null;
  const buttonContent = { minHeight: 48 };
  // The bar stays on screen, so its labels grow only so far: at iOS's largest sizes "Retire" broke
  // mid-word and the bar took a third of the screen. The question above follows the reader's size.
  const BAR_TEXT_CAP = 2;
  const approve = (
    <Button
      testID="question-bank-approve"
      mode="contained"
      icon="check"
      disabled={!ready}
      loading={action.isPending && action.variables?.action === 'approve'}
      onPress={() => void act('approve')}
      contentStyle={buttonContent}
      maxFontSizeMultiplier={BAR_TEXT_CAP}
      style={large ? undefined : { flex: 1 }}
    >
      Approve
    </Button>
  );
  const retire = (
    <Button
      testID="question-bank-retire"
      mode="outlined"
      icon="close"
      disabled={!ready}
      loading={action.isPending && action.variables?.action === 'retire'}
      textColor={theme.colors.error}
      onPress={() => void act('retire')}
      contentStyle={buttonContent}
      maxFontSizeMultiplier={BAR_TEXT_CAP}
      // A floor beside Approve's flex, which otherwise squeezed the label onto two lines.
      style={[large ? { flex: 1 } : { minWidth: 116 }, ready ? { borderColor: theme.colors.error } : null]}
    >
      Retire
    </Button>
  );
  const skipButton = (
    <Button
      testID="question-bank-skip"
      mode="text"
      icon="skip-next"
      disabled={!ready}
      onPress={skip}
      contentStyle={buttonContent}
      maxFontSizeMultiplier={BAR_TEXT_CAP}
      style={large ? { flex: 1 } : undefined}
    >
      Skip
    </Button>
  );

  return (
    <View testID="screen-question-review" style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.md }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.primary}
          />
        }
      >
        <ConnectivityBanner />
        {body}
      </ScrollView>
      {current ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.sm + insets.bottom,
            gap: space.sm,
          }}
        >
          {shownRefusal ? (
            <Text
              testID="question-bank-error"
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              variant="bodySmall"
              style={{ color: theme.colors.error }}
            >
              {shownRefusal}
            </Text>
          ) : null}
          <View testID="question-bank-actions" style={{ gap: space.sm }}>
            {large ? (
              <>
                {approve}
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {retire}
                  {skipButton}
                </View>
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {retire}
                {skipButton}
                {approve}
              </View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Ported from apps/web/src/features/quest/quest-review-page.tsx @ 82397b8 (working tree).
//
// Phase 42: a tutor's Question Quest review, full screen. One answer at a time, oldest first. The
// tutor judges the QUESTION: approving it puts it in the bank for every organization (owner,
// 2026-10-20); flagging it, with a reason, sends it to the platform console. docs/gamification-plan.md.
// Mobile:
// - one KaTeX web view for the session (`persistent`): each next answer swaps into it in place;
// - the buttons wake only once the question has been drawn and a moment has passed, as in the
//   console's review queue, so a quick second tap cannot approve a question nobody saw;
// - "Question has a problem" opens a sheet over the review, in Quest's own frame, asking for the
//   reason, checked by the shared schema before it is sent; a refusal is said
//   in the sheet, under the reason;
// - the confirmations are said in Quest's own frame (quest-notice.tsx);
// - on an iPad the student's answer and the buttons sit beside the question.
import {
  QUESTION_DIFFICULTY_LABELS,
  questLevelLabel,
  questReviewSchema,
  type QuestReviewDecision,
  type QuestReviewItem,
} from '@tmi/shared';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Icon, Portal, Surface, Text, TextInput } from 'react-native-paper';
import Animated, { SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgePill } from '@/components/badge-pill';
import { FieldError } from '@/components/field-error';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { OutlinedCard } from '@/components/outlined-card';
import { DetailSkeleton } from '@/components/skeletons';
import { MathBody } from '@/features/question-bank/math-body';
import { mathToText } from '@/features/question-bank/math-text';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useQuestReview, useReviewQuest } from './api';
import { QuestFrame, QuestStatus, exitQuest } from './quest-frame';
import { questReviewHtml, questReviewSpeech, questReviewText } from './quest-html';
import { useQuestNotice } from './quest-notice';
import { firstName, questWide, reviewToast, solverLine } from './quest-model';
import { QuestPoints } from './quest-points';

/** How long a newly drawn answer shows before its buttons wake (the console's review uses the same). */
export const ARM_DELAY_MS = 350;

export function QuestReviewScreen() {
  const queue = useQuestReview();
  const data = queue.data?.data;
  const scroller = useRef<ScrollView>(null);

  return (
    <QuestFrame
      title="Review Quest answers"
      testID="screen-quest-review"
      scrollRef={scroller}
      status={
        data ? (
          <>
            <QuestStatus testID="quest-waiting">{`${data.waiting} waiting`}</QuestStatus>
            <QuestPoints points={data.points} />
          </>
        ) : null
      }
    >
      {queue.isPending ? (
        <DetailSkeleton label="Loading the answers…" rows={5} />
      ) : queue.isError || !data ? (
        <Text testID="quest-review-error" variant="bodyMedium">
          The answers could not be loaded.
        </Text>
      ) : !data.item ? (
        <OutlinedCard testID="quest-review-empty" style={{ borderRadius: radius.lg }}>
          <View style={{ padding: space.lg, gap: space.lg }}>
            <Text variant="bodyLarge">No answers are waiting for you. Well done.</Text>
            <Button
              testID="quest-back"
              mode="outlined"
              style={{ alignSelf: 'flex-start' }}
              onPress={exitQuest}
            >
              Back
            </Button>
          </View>
        </OutlinedCard>
      ) : (
        <ReviewItem item={data.item} scroller={scroller} />
      )}
    </QuestFrame>
  );
}

function ReviewItem({ item, scroller }: { item: QuestReviewItem; scroller: RefObject<ScrollView | null> }) {
  const theme = useAppTheme();
  const notice = useQuestNotice();
  const { width } = useWindowDimensions();
  const review = useReviewQuest();
  const queue = useQuestReview();
  const q = item.question;
  const who = firstName(item.student_name);
  const id = item.attempt_id;
  const wide = questWide(width);
  const muted = theme.tokens.mutedForeground;

  const html = useMemo(
    () => questReviewHtml(item, who, { errorColor: theme.colors.error }),
    [item, who, theme.colors.error],
  );

  // The buttons wake once this answer's question has been drawn, and a moment has passed.
  const [rendered, setRendered] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (rendered !== id) return;
    const timer = setTimeout(() => setArmed(id), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rendered, id]);
  // A new answer starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [id, scroller]);
  const ready = armed === id && !review.isPending;

  // The flag sheet belongs to the answer it was opened on.
  const [flagFor, setFlagFor] = useState<string | null>(null);

  /** Saves the review; null when it was saved, else what went wrong, in the server's words. */
  async function decide(decision: QuestReviewDecision, note?: string): Promise<string | null> {
    try {
      await review.mutateAsync({ attemptId: id, decision, ...(decision === 'flag' ? { note } : {}) });
      notice.success(reviewToast(decision));
      return null;
    } catch (caught) {
      // Reviewed elsewhere already, or no longer theirs: the queue has moved on, so catch up.
      if (caught instanceof ApiRequestError && (caught.status === 409 || caught.status === 404)) {
        void queue.refetch();
      }
      return caught instanceof ApiRequestError ? caught.message : 'Could not save the review.';
    }
  }

  async function approve() {
    const refused = await decide('approve');
    if (refused) notice.error(refused);
  }

  const meta = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}>
      <BadgePill label={questLevelLabel(q.level_id)} testID="quest-review-level" />
      <Text testID="quest-review-topic" variant="bodySmall" style={{ color: muted, flexShrink: 1 }}>
        {`${q.topic_code} · ${q.topic_name} · ${QUESTION_DIFFICULTY_LABELS[q.difficulty]}${q.skill ? ` · ${q.skill}` : ''}`}
      </Text>
    </View>
  );

  const questionCard = (
    <OutlinedCard
      testID="quest-review-item"
      style={{ borderRadius: radius.lg, ...(wide ? { flex: 3 } : null) }}
    >
      <View style={{ padding: space.lg, gap: space.md }}>
        {meta}
        <MathBody
          testID="quest-review-body"
          html={html}
          speech={questReviewSpeech(item, who)}
          plain={questReviewText(item, who)}
          contentKey={id}
          onRendered={setRendered}
          persistent
        />
      </View>
    </OutlinedCard>
  );

  const solver = solverLine(q.solver_answer, q.solver_issues);
  const side = (
    <View style={{ gap: space.lg, ...(wide ? { flex: 2 } : null) }}>
      <OutlinedCard style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text variant="labelLarge">{`${item.student_name}’s answer`}</Text>
          <View
            testID="quest-student-answer"
            style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm }}
          >
            <Text variant="titleLarge">{mathToText(item.answer, 'display')}</Text>
            <AnswerMark correct={item.correct} />
          </View>
          {q.kind === 'numeric' ? (
            <Text testID="quest-key" variant="bodyMedium" style={{ color: muted }}>
              {`Key: ${mathToText(q.answer, 'display')}`}
            </Text>
          ) : null}
          {solver ? (
            <Text testID="quest-solver" variant="bodySmall" style={{ color: muted }}>
              {solver}
            </Text>
          ) : null}
        </View>
      </OutlinedCard>
      <Text variant="bodySmall" style={{ color: muted }}>
        Judge the question, not only the answer: is the key right, is there exactly one defensible answer, is
        it clear and fit for the level? Approving puts it in the bank for every organization.
      </Text>
      <View style={{ gap: space.sm }}>
        <Button
          testID="quest-approve"
          mode="contained"
          icon="check"
          disabled={!ready}
          loading={review.isPending && review.variables?.decision === 'approve'}
          onPress={() => void approve()}
          contentStyle={{ minHeight: 52 }}
        >
          Question is right
        </Button>
        <Button
          testID="quest-flag"
          mode="outlined"
          icon="flag-outline"
          disabled={!ready}
          onPress={() => setFlagFor(id)}
          contentStyle={{ minHeight: 52 }}
        >
          Question has a problem
        </Button>
      </View>
    </View>
  );

  return (
    <>
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xl }}>
          {questionCard}
          {side}
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          {questionCard}
          {side}
        </View>
      )}
      <FlagSheet
        key={flagFor ?? 'closed'}
        visible={flagFor === id}
        who={who}
        busy={review.isPending}
        onCancel={() => setFlagFor(null)}
        onConfirm={async (note) => {
          const refused = await decide('flag', note);
          if (!refused) setFlagFor(null);
          return refused;
        }}
      />
    </>
  );
}

/** "Matches the key" / "Does not match": code's mark against the bank's key. */
function AnswerMark({ correct }: { correct: boolean }) {
  const theme = useAppTheme();
  const color = correct ? theme.colors.onPrimary : theme.colors.onSurface;
  return (
    <View
      testID="quest-answer-mark"
      accessible
      accessibilityLabel={correct ? 'Matches the key' : 'Does not match'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: correct ? theme.colors.primary : theme.colors.outline,
        backgroundColor: correct ? theme.colors.primary : 'transparent',
      }}
    >
      <Icon source={correct ? 'check' : 'close'} size={14} color={color} />
      <Text variant="labelMedium" style={{ color, fontWeight: '700' }}>
        {correct ? 'Matches the key' : 'Does not match'}
      </Text>
    </View>
  );
}

/**
 * The web's flag dialog as a bottom sheet over the review: what is wrong with the question, required.
 * Drawn in Quest's own frame (a Paper portal into `QuestFrame`'s host), never a native modal: on
 * Android a modal's window is not resized for the keyboard, and typing into one left the screen
 * blank. Android's back cancels it; it rides on the keyboard.
 */
function FlagSheet({
  visible,
  who,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  who: string;
  busy: boolean;
  onCancel: () => void;
  /** Resolves to null once flagged, or to the refusal to show under the reason. */
  onConfirm: (note: string) => Promise<string | null>;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // The keyboard's height; Android reports it without the navigation bar beneath it.
  const keyboard = useKeyboardHeight();
  const lift = keyboard > 0 ? keyboard + (Platform.OS === 'android' ? insets.bottom : 0) : 0;
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Closing it (flagged, cancelled, or the next answer) puts the keyboard away with it: on Android it
  // stayed up over the review and the notice.
  useEffect(() => {
    if (!visible) return;
    return () => Keyboard.dismiss();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onCancel]);

  async function confirm() {
    const parsed = questReviewSchema.safeParse({ decision: 'flag', note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Say what is wrong with the question.');
      return;
    }
    setError(null);
    const refused = await onConfirm(parsed.data.note ?? '');
    if (refused) setError(refused);
  }

  if (!visible) return null;
  return (
    <Portal>
      <View style={{ ...StyleSheetFill, justifyContent: 'flex-end', paddingBottom: lift }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={{
            ...StyleSheetFill,
            backgroundColor: withAlpha(
              theme.dark ? theme.tokens.background : theme.tokens.foreground,
              theme.dark ? 0.6 : 0.35,
            ),
          }}
        />
        <Animated.View
          entering={reduced ? undefined : SlideInDown.duration(250)}
          accessibilityViewIsModal
          style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}
        >
          <Surface
            testID="quest-flag-sheet"
            elevation={3}
            style={{
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.lg,
              paddingTop: space.lg,
              paddingBottom: space.lg + (keyboard > 0 ? 0 : insets.bottom),
              gap: space.md,
              backgroundColor: theme.colors.elevation.level3,
            }}
          >
            <Text variant="titleMedium" accessibilityRole="header">
              What is wrong with the question?
            </Text>
            <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
              {`It leaves the bank’s queue and goes to the platform, with your reason. ${who}’s answer is kept.`}
            </Text>
            <View>
              <TextInput
                testID="quest-flag-note"
                mode="outlined"
                label="Reason"
                accessibilityLabel="Reason"
                value={note}
                onChangeText={(text) => {
                  setNote(text);
                  if (error) setError(null);
                }}
                placeholder="For example: two of the options are correct."
                multiline
                numberOfLines={4}
                maxLength={400}
                error={Boolean(error)}
                style={{ minHeight: 104 }}
              />
              {error ? <FieldError testID="quest-flag-error">{error}</FieldError> : null}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
              <Button testID="quest-flag-cancel" mode="text" onPress={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button
                testID="quest-flag-confirm"
                mode="contained"
                icon="flag-outline"
                disabled={!note.trim() || busy}
                loading={busy}
                onPress={() => void confirm()}
              >
                Flag the question
              </Button>
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Portal>
  );
}

const StyleSheetFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

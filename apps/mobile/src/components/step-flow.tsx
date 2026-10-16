// A task in steps (UI upgrades U2; docs/ui-upgrades-spec.md): the body of a full-screen modal
// route. "Step 2 of 5" over a segmented bar, one topic per step, and a footer pinned in the thumb
// zone -- above the home indicator, and above the keyboard while it is up -- with Cancel or Back,
// Skip for an optional step, and Next or the finishing action. A Review step (cards per step, each
// with Edit) can close the flow.
//
// The draft is the caller's (controlled): StepFlow never copies it, so nothing is lost between
// steps and the caller builds its one request from it at the end. Each step may validate before
// Next (its messages show under its fields, and clear as they are fixed); errors from the server
// are passed back in as `fieldErrors`, and the flow jumps to the step that owns the first of them.
// Leaving with unsaved work asks first (`useUnsavedChangesGuard`); `onSubmit` gets `leave` to close
// after a save without being asked.
import { router, useNavigation } from 'expo-router';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { AccessibilityInfo, BackHandler, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { FieldErrorProvider, useFieldErrorAnchors } from './field-error';
import { IconButton } from './icon-button';
import { OutlinedCard } from './outlined-card';

/** Messages by field name: a step's own validation, or the server's `fieldErrors`. */
export type StepErrors = Record<string, string>;

/** What a step's `render` receives. */
export interface StepContext<D> {
  draft: D;
  /**
   * This step's messages, by field: its own validation once Next has been refused here (re-run as
   * the draft changes, so a fixed field's message goes), and the server's for the fields it owns.
   */
  errors: StepErrors;
  /** Jump to another step by key (a "Change" link inside a step). */
  goTo: (key: string) => void;
}

export interface StepDef<D> {
  key: string;
  /** The step's heading: what it asks ("Who is the student?"). */
  title: string;
  /** One muted line under the title. */
  description?: string;
  /** May be skipped: the footer offers Skip. */
  optional?: boolean;
  /** Runs when the step is skipped, e.g. to clear what it holds. */
  onSkip?: () => void;
  /** The server's field names this step owns: a refusal naming one of them opens this step. */
  fields?: readonly string[];
  /** Messages by field when the draft is not ready to leave this step; null or {} when it is. */
  validate?: (draft: D) => StepErrors | null | undefined;
  render: (context: StepContext<D>) => ReactNode;
  /** The step's card on the Review step; a step without one has no card. Null shows "Nothing added". */
  summary?: (draft: D) => ReactNode;
  /**
   * False when the body scrolls itself (a `SearchPicker`): it then gets the space between the
   * header and the footer, rather than a scroll view around it.
   */
  scroll?: boolean;
  /** The primary button's label on this step (default "Next"). */
  nextLabel?: string;
}

export interface StepFlowHandle {
  goTo: (key: string) => void;
  next: () => void;
  back: () => void;
}

export interface StepFlowProps<D> {
  /** The flow's name, in the bar above the steps ("Add a student"). */
  title: string;
  steps: readonly StepDef<D>[];
  draft: D;
  /**
   * Close with a Review step: a card per step that has a `summary`, each with Edit. `lead` goes
   * above the cards (Schedule a lesson's sentence, U5).
   */
  review?: { title?: string; description?: string; lead?: (draft: D) => ReactNode } | false;
  /** The finishing action's label ("Add", "Schedule"). */
  submitLabel?: string;
  /** Runs on the last step's action, once every step validates. Close with `leave(close)` on success. */
  onSubmit: (done: { leave: (close?: () => void) => void }) => void | Promise<void>;
  submitting?: boolean;
  /** The server's `details.fieldErrors` from a refused submit: shown on, and opening, their step. */
  fieldErrors?: Record<string, string | readonly string[] | undefined> | null;
  /** A refusal tied to no field, shown above the footer. */
  formError?: string | null;
  /** Whether leaving would lose work: Cancel, close and Android's back then ask first. */
  dirty: boolean;
  /** How to leave (default: back out of the route). */
  onClose?: () => void;
  /** Told whenever the step changes. */
  onStepChange?: (key: string) => void;
  /** The step to open on (a draft picked back up opens on its write-up). Default: the first. */
  initialStep?: string;
  /** One quiet action at the right of the top bar ("Save draft"). */
  headerAction?: ReactNode;
  /** A line above the footer's buttons on every step (an autosave status). */
  footerNote?: ReactNode;
  ref?: Ref<StepFlowHandle>;
}

export const REVIEW_KEY = 'review';

/** The first message for each field, from the server's `fieldErrors` shape. */
export function firstMessages(
  fieldErrors: Record<string, string | readonly string[] | undefined> | null | undefined,
): StepErrors {
  const out: StepErrors = {};
  for (const [field, value] of Object.entries(fieldErrors ?? {})) {
    const message = typeof value === 'string' ? value : value?.[0];
    if (message) out[field] = message;
  }
  return out;
}

/** The index of the first step owning one of these fields, or -1. */
export function stepForFields<D>(steps: readonly StepDef<D>[], fields: readonly string[]): number {
  return steps.findIndex((step) => step.fields?.some((field) => fields.includes(field)));
}

function hasErrors(errors: StepErrors | null | undefined): errors is StepErrors {
  return Boolean(errors && Object.keys(errors).length > 0);
}

export function StepFlow<D>({
  title,
  steps,
  draft,
  review = false,
  submitLabel = 'Done',
  onSubmit,
  submitting = false,
  fieldErrors,
  formError,
  dirty,
  onClose,
  onStepChange,
  initialStep,
  headerAction,
  footerNote,
  ref,
}: StepFlowProps<D>) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const navigation = useNavigation();
  const { leave } = useUnsavedChangesGuard(dirty);

  const hasReview = review !== false && steps.some((step) => step.summary);
  const count = steps.length + (hasReview ? 1 : 0);
  const [index, setIndex] = useState(() =>
    Math.max(0, initialStep ? steps.findIndex((candidate) => candidate.key === initialStep) : 0),
  );
  // Steps where Next was refused: their validation shows, live, until it passes.
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(new Set());
  // Opened from the Review step's Edit: the primary goes straight back there.
  const [returnToReview, setReturnToReview] = useState(false);

  const onReview = hasReview && index === steps.length;
  const step = onReview ? null : (steps[index] ?? null);
  const isLast = index === count - 1;

  const server = useMemo(() => firstMessages(fieldErrors), [fieldErrors]);

  const errorsFor = useCallback(
    (target: StepDef<D>): StepErrors => {
      const own = attempted.has(target.key) ? (target.validate?.(draft) ?? {}) : {};
      const fromServer: StepErrors = {};
      for (const field of target.fields ?? []) if (server[field]) fromServer[field] = server[field];
      return { ...fromServer, ...own };
    },
    [attempted, draft, server],
  );

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(count - 1, next))), [count]);

  // The server refused a field: open the step that owns it (its message is already in `errors`).
  // Adjusted while rendering, once per new refusal, rather than in an effect.
  const [seenServer, setSeenServer] = useState(server);
  if (seenServer !== server) {
    setSeenServer(server);
    const owner = stepForFields(steps, Object.keys(server));
    if (owner >= 0) {
      setReturnToReview(hasReview);
      setIndex(owner);
    }
  }

  const stepKey = index === steps.length ? REVIEW_KEY : (steps[index]?.key ?? REVIEW_KEY);
  const told = useRef(stepKey);
  useEffect(() => {
    if (told.current === stepKey) return;
    told.current = stepKey;
    onStepChange?.(stepKey);
  }, [onStepChange, stepKey]);

  const goTo = useCallback(
    (key: string) => {
      if (key === REVIEW_KEY && hasReview) return go(steps.length);
      const target = steps.findIndex((candidate) => candidate.key === key);
      if (target >= 0) go(target);
    },
    [go, hasReview, steps],
  );

  /** Refuses to leave `target` when it does not validate: its messages show, and the buzz says so. */
  const blocked = useCallback(
    (target: StepDef<D>): boolean => {
      if (!hasErrors(target.validate?.(draft))) return false;
      setAttempted((was) => new Set(was).add(target.key));
      haptics.error();
      return true;
    },
    [draft],
  );

  const submit = useCallback(async () => {
    // Every step again: an Edit from the review may have emptied an earlier one.
    const failing = steps.findIndex((candidate) => hasErrors(candidate.validate?.(draft)));
    if (failing >= 0) {
      setAttempted((was) => new Set(was).add(steps[failing]!.key));
      haptics.error();
      go(failing);
      return;
    }
    await onSubmit({ leave: (close) => leave(close ?? (() => (onClose ? onClose() : router.back()))) });
  }, [draft, go, leave, onClose, onSubmit, steps]);

  const next = useCallback(() => {
    if (submitting) return;
    if (step && blocked(step)) return;
    if (isLast) {
      void submit();
      return;
    }
    haptics.selection();
    if (returnToReview && hasReview) {
      setReturnToReview(false);
      go(steps.length);
      return;
    }
    go(index + 1);
  }, [blocked, go, hasReview, index, isLast, returnToReview, step, steps.length, submit, submitting]);

  const close = useCallback(() => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
  }, [onClose]);

  const back = useCallback(() => {
    if (index === 0) {
      close();
      return;
    }
    haptics.selection();
    setReturnToReview(false);
    go(index - 1);
  }, [close, go, index]);

  const skip = useCallback(() => {
    if (!step?.optional) return;
    step.onSkip?.();
    haptics.selection();
    if (returnToReview && hasReview) {
      setReturnToReview(false);
      go(steps.length);
      return;
    }
    if (isLast) void submit();
    else go(index + 1);
  }, [go, hasReview, index, isLast, returnToReview, step, steps.length, submit]);

  const edit = useCallback(
    (key: string) => {
      haptics.selection();
      setReturnToReview(true);
      goTo(key);
    },
    [goTo],
  );

  useImperativeHandle(ref, () => ({ goTo, next, back }), [back, goTo, next]);

  // Android's back is Back while there is a step to go back to -- and only while this screen is the
  // one in front (a sheet opened over the flow takes its own back).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0 || !navigation.isFocused()) return false;
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back, index, navigation]);

  // A new step starts at its top, with the screen reader on its title.
  const titleRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const first = useRef(true);
  const heading = onReview ? (review && review.title) || 'Review' : (step?.title ?? '');
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, 120);
    return () => clearTimeout(timer);
  }, [index]);

  const errors = step ? errorsFor(step) : {};
  const scrolls = onReview || step?.scroll !== false;
  const anchors = useFieldErrorAnchors(scrollRef, scrolls);
  const description = onReview
    ? (review && review.description) || `Check the details, then ${submitLabel.toLowerCase()}.`
    : step?.description;

  const body = onReview ? (
    <>
      {review && review.lead ? review.lead(draft) : null}
      <ReviewCards steps={steps} draft={draft} onEdit={edit} />
    </>
  ) : step ? (
    step.render({ draft, errors, goTo })
  ) : null;

  const primaryLabel = isLast
    ? submitLabel
    : returnToReview && hasReview
      ? 'Back to review'
      : (step?.nextLabel ?? 'Next');

  return (
    <View
      testID="step-flow"
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        // The footer rides on the keyboard. Android (edge to edge) reports the keyboard without the
        // navigation bar beneath it; iOS's height already reaches the bottom edge.
        paddingBottom: keyboard > 0 && Platform.OS === 'android' ? keyboard + insets.bottom : keyboard,
      }}
    >
      <View style={styles.topBar}>
        <IconButton testID="step-flow-close" icon="close" accessibilityLabel="Close" onPress={close} />
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={{ flex: 1, textAlign: 'center', color: theme.tokens.mutedForeground }}
        >
          {title}
        </Text>
        {/* Balances the close button, so the name sits in the middle. */}
        {headerAction ?? <View style={styles.balance} />}
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm }}>
        <StepProgress current={index} count={count} />
        <View
          ref={titleRef}
          testID="step-flow-title"
          accessible
          accessibilityRole="header"
          accessibilityLabel={[`Step ${index + 1} of ${count}`, heading, description]
            .filter(Boolean)
            .join('. ')}
          style={{ gap: space.xs, paddingTop: space.xs }}
        >
          <Text variant="headlineSmall">{heading}</Text>
          {description ? (
            <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      {scrolls ? (
        <ScrollView
          ref={scrollRef}
          testID="step-flow-body"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.lg, flexGrow: 1 }}
          // Fits at the default text size, so it does not scroll (or bounce) unless it must.
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          onScroll={(event) => anchors.onScroll(event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={64}
        >
          <FieldErrorProvider value={anchors.anchors}>{body}</FieldErrorProvider>
        </ScrollView>
      ) : (
        <View testID="step-flow-body" style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          {body}
        </View>
      )}

      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.background,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: (keyboard > 0 ? 0 : insets.bottom) + space.md,
          gap: space.sm,
        }}
      >
        {footerNote}
        {formError ? (
          <HelperText type="error" padding="none" testID="step-flow-error">
            {formError}
          </HelperText>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Button
            testID="step-flow-back"
            mode="outlined"
            onPress={back}
            disabled={submitting}
            contentStyle={styles.button}
          >
            {index === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step?.optional ? (
            <Button
              testID="step-flow-skip"
              mode="text"
              onPress={skip}
              disabled={submitting}
              contentStyle={styles.button}
            >
              Skip
            </Button>
          ) : null}
          <Button
            testID="step-flow-next"
            mode="contained"
            onPress={next}
            loading={submitting && isLast}
            disabled={submitting}
            style={{ flexGrow: 1 }}
            contentStyle={styles.button}
          >
            {primaryLabel}
          </Button>
        </View>
      </View>
    </View>
  );
}

/** "Step n of N" and a bar of N segments, the ones reached filled. */
function StepProgress({ current, count }: { current: number; count: number }) {
  const theme = useAppTheme();
  return (
    <View
      testID="step-flow-progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: current + 1 }}
      style={{ gap: space.xs }}
    >
      <Text variant="labelLarge" style={{ color: theme.tokens.mutedForeground }}>
        Step {current + 1} of {count}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {Array.from({ length: count }, (_, segment) => (
          <View
            key={segment}
            style={{
              flex: 1,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: segment <= current ? theme.colors.primary : theme.colors.outlineVariant,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** The Review step: what each step holds, with Edit to go back to it. */
function ReviewCards<D>({
  steps,
  draft,
  onEdit,
}: {
  steps: readonly StepDef<D>[];
  draft: D;
  onEdit: (key: string) => void;
}) {
  return (
    <View testID="step-flow-review" style={{ gap: space.md }}>
      {steps
        .filter((step) => step.summary)
        .map((step) => (
          <ReviewCard
            key={step.key}
            title={step.title}
            testID={`step-flow-edit-${step.key}`}
            onEdit={() => onEdit(step.key)}
          >
            {step.summary?.(draft)}
          </ReviewCard>
        ))}
    </View>
  );
}

/**
 * One step's card on a Review step: its title, what it holds, and Edit. Exported for a review that
 * a caller lays out itself (a sentence summary, as U5's schedule will).
 */
export function ReviewCard({
  title,
  children,
  onEdit,
  testID,
}: {
  title: string;
  children?: ReactNode;
  onEdit?: () => void;
  /** The Edit button's testID. */
  testID?: string;
}) {
  const theme = useAppTheme();
  const empty = children === null || children === undefined || children === false || children === '';
  return (
    <OutlinedCard>
      <View style={{ padding: space.lg, paddingRight: space.sm, gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="titleMedium" style={{ flex: 1 }}>
            {title}
          </Text>
          {onEdit ? (
            <Button
              testID={testID}
              mode="text"
              compact
              onPress={onEdit}
              accessibilityLabel={`Edit ${title}`}
              contentStyle={styles.button}
            >
              Edit
            </Button>
          ) : null}
        </View>
        {empty ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            Nothing added
          </Text>
        ) : typeof children === 'string' ? (
          <Text variant="bodyMedium">{children}</Text>
        ) : (
          children
        )}
      </View>
    </OutlinedCard>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    minHeight: 48,
  },
  balance: { width: 48 },
  button: { minHeight: 48 },
});

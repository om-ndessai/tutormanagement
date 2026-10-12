// Ported from apps/web/src/features/onboarding/tour.tsx @ 1132322. The page dimmed, one part of
// it lit, and a card saying what that part does: Back, Next, Skip tour, Finish. The web's
// `data-tour` elements are views registered with `useTourTarget`; the tab bar, which the system
// draws, is lit from where its tabs sit.
import type { TourOutcome } from '@tmi/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { withAlpha } from '@/theme/alpha';
import { useAppTheme } from '@/providers/theme-provider';
import { motion, radius, space } from '@/theme/tokens';
import { placementOf, TAB_COUNT, type TourStep } from './tour-steps';
import {
  measureView,
  resolveTarget,
  scrollIntoView,
  useTourRegistry,
  type TourRegistry,
  type WindowRect,
} from './tour-targets';

const PAD = 6;
/** The band a lit view should sit in: below the header (past the safe area), above the tab bar and the card. */
const TOP_CLEAR = 70;
const BOTTOM_CLEAR = 300;

/**
 * Where a tab sits in the system's tab bar: Material 3's 80dp bar across the bottom on Android;
 * on iOS the floating bar, inset from the sides. An approximation -- the system draws the bar
 * and exposes no frames -- close enough to say "this one".
 */
export function tabRect(index: number, width: number, height: number, insets: EdgeInsets): WindowRect {
  if (Platform.OS === 'ios') {
    const side = 20;
    const barHeight = 62;
    const bottom = Math.max(insets.bottom - 12, 8);
    const tab = (width - side * 2) / TAB_COUNT;
    return { x: side + tab * index, y: height - bottom - barHeight, width: tab, height: barHeight };
  }
  const barHeight = 80;
  const tab = width / TAB_COUNT;
  return { x: tab * index, y: height - insets.bottom - barHeight, width: tab, height: barHeight };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Where a view comes to rest after a scroll: measured until two readings agree (a scroll's
 * deceleration outlasts any fixed delay), for at most about a second.
 */
async function settledRect(view: View): Promise<WindowRect | null> {
  let last: WindowRect | null = null;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    await wait(80);
    const now = await measureView(view);
    if (attempt >= 2 && now && last && Math.abs(now.y - last.y) < 1 && Math.abs(now.x - last.x) < 1)
      return now;
    last = now;
  }
  return last;
}

/** Whether a step has something to point at now. */
async function hasTarget(registry: TourRegistry, step: TourStep): Promise<boolean> {
  const placement = placementOf(step.target);
  if (placement.kind === 'tab') return true;
  return (await resolveTarget(registry, placement.id)) !== null;
}

/**
 * Which steps run is decided once the dashboard has drawn: a step whose target is not on screen
 * -- a panel this person does not have -- is left out, so the counter never promises a step that
 * will not come.
 */
export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: (outcome: TourOutcome) => void }) {
  const theme = useAppTheme();
  const registry = useTourRegistry();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const placed = useRef(false);

  const [available, setAvailable] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [lit, setLit] = useState<WindowRect | null>(null);

  const holeX = useSharedValue(0);
  const holeY = useSharedValue(0);
  const holeW = useSharedValue(0);
  const holeH = useSharedValue(0);

  // Wait for the dashboard to have drawn -- the tour may have just brought it forward -- then
  // keep the steps that have something to point at.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const settle = async () => {
      if (cancelled) return;
      if (registry.has('dash-') || attempts >= 25) {
        const keep: TourStep[] = [];
        for (const step of steps) if (await hasTarget(registry, step)) keep.push(step);
        if (!cancelled) setAvailable(keep);
        return;
      }
      attempts += 1;
      timer = setTimeout(() => void settle(), 100);
    };
    // A beat first, for a dismissing modal to finish and the dashboard to lay out.
    timer = setTimeout(() => void settle(), 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [registry, steps]);

  const step = available?.[index] ?? null;
  const placement = step ? placementOf(step.target) : null;

  // Point at the current step's target: scrolled into the clear band first when it is below the
  // fold, then measured where it landed.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const point = async () => {
      const where = placementOf(step.target);
      let rect: WindowRect | null = null;
      if (where.kind === 'tab') {
        rect = tabRect(where.index, width, height, insets);
      } else {
        const found = await resolveTarget(registry, where.id);
        if (found) {
          rect = found.rect;
          const top = insets.top + TOP_CLEAR;
          const tall = rect.height > height - top - BOTTOM_CLEAR;
          const outside = rect.y < top || (!tall && rect.y + rect.height > height - BOTTOM_CLEAR);
          if (outside && (await scrollIntoView(registry, found.view, top, !reduceMotion))) {
            rect = (await settledRect(found.view)) ?? rect;
          }
        }
      }
      if (cancelled) return;
      // The overlay's own origin: window coordinates in, overlay coordinates out.
      const origin = overlayRef.current ? await measureView(overlayRef.current) : null;
      // Padded, but kept on screen so the ring never runs off an edge.
      let target: WindowRect | null = null;
      if (rect) {
        const left = Math.max(2, rect.x - (origin?.x ?? 0) - PAD);
        const top = Math.max(2, rect.y - (origin?.y ?? 0) - PAD);
        const right = Math.min(width - 2, rect.x - (origin?.x ?? 0) + rect.width + PAD);
        const bottom = Math.min(height - 2, rect.y - (origin?.y ?? 0) + rect.height + PAD);
        target = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      }
      if (cancelled) return;
      setLit(target);
      if (target) {
        // The first light appears where it belongs; after that it travels from step to step.
        const still = reduceMotion || !placed.current;
        placed.current = true;
        const timing = (value: number) => (still ? value : withTiming(value, { duration: motion.medium }));
        holeX.set(timing(target.x));
        holeY.set(timing(target.y));
        holeW.set(timing(target.width));
        holeH.set(timing(target.height));
      }
    };
    void point();
    return () => {
      cancelled = true;
    };
    // The shared values are stable; re-point when the step or the screen changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, registry, width, height, reduceMotion]);

  const finish = useCallback(
    (outcome: TourOutcome) => {
      if (outcome === 'completed') haptics.success();
      onDone(outcome);
    },
    [onDone],
  );

  // Nothing on this screen to point at: there is no tour to give.
  useEffect(() => {
    if (available && available.length === 0) finish('completed');
  }, [available, finish]);

  const scrim = withAlpha(
    theme.dark ? theme.tokens.background : theme.tokens.foreground,
    theme.dark ? 0.78 : 0.6,
  );

  const topStyle = useAnimatedStyle(() => ({ top: 0, left: 0, right: 0, height: Math.max(0, holeY.value) }));
  const bottomStyle = useAnimatedStyle(() => ({
    top: holeY.value + holeH.value,
    left: 0,
    right: 0,
    bottom: 0,
  }));
  const leftStyle = useAnimatedStyle(() => ({
    top: holeY.value,
    height: holeH.value,
    left: 0,
    width: Math.max(0, holeX.value),
  }));
  const rightStyle = useAnimatedStyle(() => ({
    top: holeY.value,
    height: holeH.value,
    left: holeX.value + holeW.value,
    right: 0,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    top: holeY.value,
    left: holeX.value,
    width: holeW.value,
    height: holeH.value,
  }));

  const last = available ? index === available.length - 1 : false;
  // The card sits away from what it describes: above a target low on the screen, else below.
  const cardAtTop = lit ? lit.y + lit.height / 2 > height / 2 : false;

  return (
    // Holds the page still while the tour talks about it.
    <View ref={overlayRef} testID="tour" style={StyleSheet.absoluteFill} collapsable={false}>
      {step && lit ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.shade, { backgroundColor: scrim }, topStyle]} />
          <Animated.View
            pointerEvents="none"
            style={[styles.shade, { backgroundColor: scrim }, bottomStyle]}
          />
          <Animated.View pointerEvents="none" style={[styles.shade, { backgroundColor: scrim }, leftStyle]} />
          <Animated.View
            pointerEvents="none"
            style={[styles.shade, { backgroundColor: scrim }, rightStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shade,
              { borderWidth: 2, borderColor: theme.colors.primary, borderRadius: radius.md },
              ringStyle,
            ]}
          />
        </>
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]} />
      )}

      {step && available ? (
        <Surface
          testID="tour-card"
          elevation={3}
          accessibilityViewIsModal
          style={[
            styles.card,
            // A rule round the card keeps it apart from the dimmed page in dark mode too.
            {
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
            },
            cardAtTop ? { top: insets.top + space.xl } : { bottom: insets.bottom + 120 },
          ]}
        >
          <Text
            testID="tour-count"
            variant="labelMedium"
            accessibilityLiveRegion="polite"
            style={{ color: theme.tokens.mutedForeground }}
          >
            {index + 1} of {available.length}
          </Text>
          <Text
            testID="tour-title"
            variant="titleMedium"
            accessibilityRole="header"
            style={{ fontWeight: '600' }}
          >
            {step.title}
          </Text>
          <Text testID="tour-body" variant="bodyMedium">
            {step.body}
            {placement?.kind === 'tab' && placement.underMore ? (
              <Text style={{ color: theme.tokens.mutedForeground }}> You will find it under More.</Text>
            ) : null}
          </Text>
          <View style={styles.actions}>
            <Button testID="tour-skip" mode="text" compact onPress={() => finish('skipped')}>
              Skip tour
            </Button>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {index > 0 ? (
                <Button
                  testID="tour-back"
                  mode="outlined"
                  onPress={() => {
                    haptics.selection();
                    setIndex((current) => current - 1);
                  }}
                >
                  Back
                </Button>
              ) : null}
              <Button
                testID={last ? 'tour-finish' : 'tour-next'}
                mode="contained"
                onPress={() => {
                  if (last) return finish('completed');
                  haptics.selection();
                  setIndex((current) => current + 1);
                }}
              >
                {last ? 'Finish' : 'Next'}
              </Button>
            </View>
          </View>
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute' },
  card: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  actions: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
  },
});

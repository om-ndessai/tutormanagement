// Ported from apps/web/src/features/quest/game-effects.tsx @ 9eccdf2 (working tree): useCountdown,
// DoorsCountdown and KnockoutBurst (Confetti is Home's, reused).
//
// Phase 47 (docs/quest-games-g2-plan.md, design 61): the moments of a game. The doors that open on 3,
// 2, 1, Go! when the host starts the Quest -- every screen counts to the same instant, the server's --
// and the knockout stamp when a game ends early. Mobile: Reanimated only, on the UI thread; drawn over
// the game's frame through its own Paper portal host, never an RN Modal. The countdown re-renders
// about six times (a timer aligned to the next whole second), never in render. Under reduce motion
// there are no doors and no stamp: a plain card with the words or the number, and the end-reason line
// says the knockout.
import { gameCountdownLeft, type GameView } from '@tmi/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { countdownLabel, countdownSpeech } from './game-model';
import { questWide } from './quest-model';

/**
 * Milliseconds until the first question, by the server's clock: the game's `started_at` less its
 * `now`, less the time since that reading arrived on this device (`receivedAt`, the query's
 * dataUpdatedAt). 0 once it has begun. A device clock ahead of or behind the server's does not matter:
 * only the time elapsed on this device since the reading is used.
 */
export function countdownLeft(
  game: Pick<GameView, 'status' | 'started_at' | 'now'> | undefined,
  receivedAt: number,
  deviceNow: number,
): number {
  if (!game) return 0;
  return gameCountdownLeft(game, Math.max(0, deviceNow - receivedAt));
}

/**
 * The doors' countdown for a game: ms left, recomputed on a timer aligned to the next whole second of
 * it; `onDone` once when it reaches 0 (the screen asks for the first question at once).
 */
export function useGameCountdown(
  game: Pick<GameView, 'status' | 'started_at' | 'now'> | undefined,
  receivedAt: number,
  onDone?: () => void,
): number {
  const [now, setNow] = useState(() => Date.now());
  const left = countdownLeft(game, receivedAt, now);
  const counted = useRef<string | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (left <= 0) return;
    // To the next whole second of the countdown (a label changes there), at least a frame away.
    const wait = Math.max(16, left % 1000 || 1000);
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [left]);

  const startedAt = game?.started_at ?? null;
  useEffect(() => {
    if (left > 0) {
      counted.current = startedAt;
      return;
    }
    // Once per countdown: it was counting for this start, and has reached 0.
    if (counted.current !== null && counted.current === startedAt) {
      counted.current = null;
      done.current?.();
    }
  }, [left, startedAt]);

  return left;
}

/** The doors over the whole frame: "The Quest begins", Get ready, 3, 2, 1, and they open on Go!. */
export function DoorsCountdown({ msLeft }: { msLeft: number }) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const wide = questWide(width);
  const label = countdownLabel(msLeft);
  const opening = label === 'Go!';

  // Said once on showing, and "Go!" at the end; light taps on 3, 2 and 1, success on Go!.
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (said.current === null) {
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(countdownSpeech(msLeft));
    } else if (said.current !== label) {
      if (opening) {
        haptics.success();
        if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility('Go!');
      } else if (label !== 'Get ready') {
        haptics.impact();
      }
    }
    said.current = label;
  }, [label, msLeft, opening]);

  const number = (
    <PopText key={label} still={reduced} go={opening}>
      <Text
        testID="game-countdown-number"
        variant="displayLarge"
        accessibilityLiveRegion="polite"
        style={{
          color: t.brand50,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
          ...(wide ? { fontSize: 114, lineHeight: 128 } : null),
        }}
      >
        {label}
      </Text>
    </PopText>
  );

  return (
    <View
      testID="game-countdown"
      accessibilityViewIsModal
      // Touches stop here for the five seconds.
      onStartShouldSetResponder={() => true}
      style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(t.brand950, 0.7), overflow: 'hidden' }]}
    >
      {reduced ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <View
            style={{
              alignItems: 'center',
              gap: space.md,
              padding: space.xl,
              borderRadius: radius.xl,
              backgroundColor: t.brand900,
              minWidth: 240,
            }}
          >
            <BeginsLabel />
            {number}
          </View>
        </View>
      ) : (
        <>
          <Door side="left" open={opening} />
          <Door side="right" open={opening} />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center', gap: space.md },
            ]}
          >
            {opening ? null : <BeginsLabel />}
            {number}
          </View>
        </>
      )}
    </View>
  );
}

function BeginsLabel() {
  const theme = useAppTheme();
  return (
    <Text
      variant="labelLarge"
      style={{ color: theme.tokens.brand50, opacity: 0.85, letterSpacing: 3, textTransform: 'uppercase' }}
    >
      The Quest begins
    </Text>
  );
}

/** A number pops in (1.4 → 1); Go! pops out and settles (0.6 → 1.15 → 1). Still under reduce motion. */
function PopText({ children, still, go }: { children: ReactNode; still: boolean; go: boolean }) {
  const scale = useSharedValue(still ? 1 : go ? 0.6 : 1.4);
  useEffect(() => {
    if (still) return;
    scale.value = go
      ? withSequence(
          withTiming(1.15, { duration: 220, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 160 }),
        )
      : withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [go, scale, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** One door: half the width, two inset panels and a handle; it swings open on its outer edge. */
function Door({ side, open }: { side: 'left' | 'right'; open: boolean }) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const { width, height } = useWindowDimensions();
  const swing = useSharedValue(0);
  useEffect(() => {
    if (open) swing.value = withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) });
  }, [open, swing]);
  const left = side === 'left';
  const style = useAnimatedStyle(() => ({
    opacity: 1 - swing.value * 0.9,
    transform: [{ perspective: 1200 }, { rotateY: `${(left ? -100 : 100) * swing.value}deg` }],
  }));
  // Wider than tall (an iPad in landscape): the inset panels keep a door's proportions.
  const inset = Math.max(space.xl, Math.min(width / 2, height) * 0.08);
  return (
    <Animated.View
      testID={`game-door-${side}`}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '50%',
          ...(left ? { left: 0, borderRightWidth: 4 } : { right: 0, borderLeftWidth: 4 }),
          transformOrigin: left ? 'left center' : 'right center',
          backgroundColor: t.brand900,
          borderColor: withAlpha(t.brand50, 0.2),
        },
        style,
      ]}
    >
      <View
        style={{ position: 'absolute', top: inset, bottom: inset, left: inset, right: inset, gap: inset }}
      >
        <View style={doorPanel(t.brand50)} />
        <View style={doorPanel(t.brand50)} />
      </View>
      <View
        style={{
          position: 'absolute',
          top: '50%',
          marginTop: -10,
          ...(left ? { right: space.lg } : { left: space.lg }),
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: t.brand200,
        }}
      />
    </Animated.View>
  );
}

function doorPanel(ink: string) {
  return { flex: 1, borderRadius: radius.md, borderWidth: 2, borderColor: withAlpha(ink, 0.15) } as const;
}

/** How long the stamp stays, landing and fading included. */
export const KNOCKOUT_MS = 2600;

/**
 * "K.O.!": a stamp that lands once when a knockout ends the game, holds, and fades by 2.6 s; then
 * `onDone` (the results' confetti follows it). Nothing under reduce motion (`onDone` at once): the
 * end-reason line says it. Never touched, hidden from accessibility.
 */
export function KnockoutStamp({ onDone }: { onDone?: () => void }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const scale = useSharedValue(3);
  const fade = useSharedValue(1);
  const [shown, setShown] = useState(true);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (reduced) {
      done.current?.();
      return;
    }
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    fade.value = withDelay(KNOCKOUT_MS - 500, withTiming(0, { duration: 500 }));
    const landed = setTimeout(() => haptics.impact(), 180);
    const gone = setTimeout(() => {
      setShown(false);
      done.current?.();
    }, KNOCKOUT_MS);
    return () => {
      clearTimeout(landed);
      clearTimeout(gone);
    };
  }, [fade, reduced, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }, { rotate: '-6deg' }],
  }));

  if (reduced || !shown) return null;
  return (
    <View
      testID="game-knockout-burst"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
    >
      <Animated.View
        style={[
          {
            backgroundColor: theme.colors.error,
            borderRadius: radius.xl,
            paddingHorizontal: space.xxl,
            paddingVertical: space.xl,
          },
          style,
        ]}
      >
        <Text
          variant="displayLarge"
          style={{
            color: theme.colors.onError,
            fontWeight: '900',
            ...(questWide(width) ? { fontSize: 114, lineHeight: 128 } : null),
          }}
        >
          K.O.!
        </Text>
      </Animated.View>
    </View>
  );
}

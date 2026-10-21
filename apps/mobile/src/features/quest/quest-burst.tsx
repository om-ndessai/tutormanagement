// The point's flight in a student's Quest (owner, 2026-10-21; the web's play page has the same): on a
// saved answer a "+1" rises from Submit to the header's points and fades, and the points tick up with
// a bump as it lands (quest-points.tsx). The layer fills Quest's frame and never takes a touch.
// Reanimated only; under reduce motion nothing flies and the number simply changes.
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/providers/theme-provider';
import { BURST_FLIGHT_MS, burstPath, type Box } from './quest-welcome-model';

interface Flight {
  id: number;
  text: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface QuestBurstApi {
  /** The header's points, where a point lands. */
  pointsRef: RefObject<View | null>;
  /** Sends a "+N" from `from` (the Submit button) to the points. */
  fly: (from: View | null, text: string) => void;
}

const QuestBurstContext = createContext<QuestBurstApi | null>(null);

/** The burst is kept in the tree a little past its flight, faded, so a UI test can see it was there. */
const LINGER_MS = 800;
const TAG_WIDTH = 96;
const TAG_HEIGHT = 36;

function measure(view: View | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

export function QuestBurstHost({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const root = useRef<View>(null);
  const pointsRef = useRef<View>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fly = useCallback(
    (from: View | null, text: string) => {
      if (reduced) return;
      void Promise.all([measure(from), measure(pointsRef.current), measure(root.current)]).then(
        ([fromBox, toBox, frameBox]) => {
          if (!fromBox || !toBox || !frameBox) return;
          const { start, end } = burstPath(fromBox, toBox, frameBox);
          setFlight({ id: Date.now(), text, start, end });
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setFlight(null), BURST_FLIGHT_MS + LINGER_MS);
        },
      );
    },
    [reduced],
  );

  const api = useMemo<QuestBurstApi>(() => ({ pointsRef, fly }), [fly]);

  return (
    <QuestBurstContext value={api}>
      <View ref={root} collapsable={false} style={{ flex: 1 }}>
        {children}
        {flight ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <BurstTag key={flight.id} flight={flight} />
          </View>
        ) : null}
      </View>
    </QuestBurstContext>
  );
}

function BurstTag({ flight }: { flight: Flight }) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: BURST_FLIGHT_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  const dx = flight.end.x - flight.start.x;
  const dy = flight.end.y - flight.start.y;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: progress.value * dx },
      { translateY: progress.value * dy },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.8, 1.15, 0.7]) },
    ],
  }));
  return (
    <Animated.View
      testID="quest-points-burst"
      style={[
        {
          position: 'absolute',
          left: flight.start.x - TAG_WIDTH / 2,
          top: flight.start.y - TAG_HEIGHT / 2,
          width: TAG_WIDTH,
          height: TAG_HEIGHT,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '800' }}>
        {flight.text}
      </Text>
    </Animated.View>
  );
}

/** The burst, inside Quest's frame; null elsewhere (the Quest page's card has no flight). */
export function useQuestBurst(): QuestBurstApi | null {
  return use(QuestBurstContext);
}

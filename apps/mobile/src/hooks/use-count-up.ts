// Ported from apps/web/src/hooks/use-count-up.ts @ 1132322
import { useEffect, useRef, useState } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Animates a number up to its target, on the UI thread.
 *
 * Eases out, so the figure lands rather than stopping dead. Returns the value straight away when
 * the viewer has asked for reduced motion, or when the number changes again after its first
 * arrival -- a dashboard refreshing under you should not replay its animations. A screen reader
 * is always given the target itself (StatCard's label), never a figure in flight.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const shown = useSharedValue(0);
  const arrived = useRef(false);

  useAnimatedReaction(
    () => Math.round(shown.get()),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(setValue, now);
    },
  );

  useEffect(() => {
    if (reduced) return;
    if (arrived.current) {
      // A data change, not an entrance.
      cancelAnimation(shown);
      shown.set(target);
      return;
    }
    arrived.current = true;
    shown.set(withTiming(target, { duration: durationMs, easing: Easing.out(Easing.cubic) }));
  }, [target, durationMs, reduced, shown]);

  return reduced ? target : value;
}

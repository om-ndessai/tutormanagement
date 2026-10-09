// The app's answer to apps/web/src/components/layout/theme-transition.ts @ 1132322. The web reveals a
// new theme through a View Transition snapshot; React Native has no snapshot without a native
// dependency, so the new palette fades in over the old background instead of flashing.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

/**
 * Laid over the whole app: when the scheme changes, a layer in the OLD background colour fades out,
 * so the new palette appears beneath it. Never takes a touch; stilled by reduce motion.
 */
export function ThemeFade({ scheme, background }: { scheme: string; background: string }) {
  const reduced = useReducedMotion();
  const last = useRef({ scheme, background });
  const [from, setFrom] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A layout effect, so the old colour is on screen before the new theme's first paint.
  useLayoutEffect(() => {
    const previous = last.current;
    last.current = { scheme, background };
    if (previous.scheme === scheme || reduced) return;
    setFrom(previous.background);
    opacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: motion.slow, easing: Easing.out(Easing.quad) }),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFrom(null), motion.slow + 50);
  }, [scheme, background, reduced, opacity]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!from) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: from }, style]}
    />
  );
}

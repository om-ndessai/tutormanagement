import { useEffect } from 'react';
import { type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/providers/theme-provider';
import { radius } from '@/theme/tokens';

/**
 * A placeholder block in the muted colour, gently pulsing while its content loads (still under
 * reduce motion). Never shaped like an amount on a Tutoring tab.
 */
export function Skeleton({
  width,
  height,
  style,
  testID,
}: {
  width: DimensionValue;
  height: DimensionValue;
  style?: ViewStyle;
  testID?: string;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) return;
    opacity.set(withRepeat(withTiming(0.55, { duration: 800 }), -1, true));
  }, [reduced, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius.md, backgroundColor: theme.tokens.muted },
        reduced ? null : animated,
        style,
      ]}
    />
  );
}

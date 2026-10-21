// Confetti for a finished lesson (Phase 43): a few dozen paper pieces falling once over the Now card.
// Reanimated only (no new native dependency); never touches, never blocks a tap (pointerEvents none);
// and nothing at all under reduce motion.
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/providers/theme-provider';

const PIECES = 36;
const FALL = 420;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  wide: boolean;
}

/** A stable pseudo-random sequence, so a re-render does not reshuffle the pieces mid-fall. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function ConfettiPiece({ piece }: { piece: Piece }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.in(Easing.quad) }),
    );
  }, [piece.delay, piece.duration, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value >= 1 ? 0 : 1,
    transform: [
      { translateY: -24 + progress.value * FALL },
      { translateX: Math.sin(progress.value * Math.PI * 2) * piece.drift },
      { rotate: `${progress.value * piece.spin}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: `${piece.left}%`,
          width: piece.wide ? 12 : 8,
          height: piece.wide ? 6 : 10,
          borderRadius: 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

export function Confetti({ seed = 7, testID }: { seed?: number; testID?: string }) {
  const reduced = useReducedMotion();
  const theme = useAppTheme();
  const t = theme.tokens;
  const pieces = useMemo(() => {
    const colors = [t.primary, t.success, t.highlight, t.celebrate, t.info, t.warning];
    const random = seeded(seed);
    return Array.from({ length: PIECES }, (_, index): Piece => ({
      left: random() * 96,
      delay: random() * 500,
      duration: 1800 + random() * 900,
      drift: 8 + random() * 18,
      spin: (random() > 0.5 ? 1 : -1) * (180 + random() * 360),
      color: colors[index % colors.length] ?? t.primary,
      wide: random() > 0.5,
    }));
  }, [seed, t.primary, t.success, t.highlight, t.celebrate, t.info, t.warning]);

  if (reduced) return null;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      {pieces.map((piece, index) => (
        <ConfettiPiece key={index} piece={piece} />
      ))}
    </View>
  );
}

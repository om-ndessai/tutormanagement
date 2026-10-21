// The trophy and "N points" of the web's Quest header and cards (TrophyIcon + count) @ 82397b8.
// `live` (the student's play screen, owner 2026-10-21): this is where a saved answer's "+1" lands
// (quest-burst.tsx), so a rise waits for the flight, then the number ticks up and the trophy and the
// count bump. Under reduce motion the number simply changes.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useQuestBurst } from './quest-burst';
import { pointsLabel } from './quest-model';
import { BURST_FLIGHT_MS } from './quest-welcome-model';

export function QuestPoints({
  points,
  testID = 'quest-points',
  live = false,
}: {
  points: number;
  testID?: string;
  live?: boolean;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const burst = useQuestBurst();
  const animate = live && !reduced;
  const [shown, setShown] = useState(points);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animate || points === shown) return;
    // A rise lands with the flight; anything else (a reset, a refetch) is shown at once.
    const rise = points > shown;
    const timer = setTimeout(
      () => {
        setShown(points);
        if (rise)
          scale.value = withSequence(withTiming(1.25, { duration: 140 }), withTiming(1, { duration: 200 }));
      },
      rise ? BURST_FLIGHT_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [animate, points, shown, scale]);

  const bump = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const value = animate ? shown : points;

  return (
    <View
      ref={live ? burst?.pointsRef : undefined}
      collapsable={false}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.xs }, bump]}>
        <Icon source="trophy-outline" size={16} color={theme.colors.onSurface} />
        <Text
          testID={testID}
          variant="bodyMedium"
          style={{ color: theme.colors.onSurface, fontWeight: '700' }}
        >
          {pointsLabel(value)}
        </Text>
      </Animated.View>
    </View>
  );
}

// Ported from apps/web/src/features/progress/progress-list.tsx (ProgressMeter) @ 1132322
import { View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';
import { radius } from '@/theme/tokens';

/**
 * A meter: how much of the plan is mastered, with a tick where the pace line says it should be by
 * today. Filled and unfilled are steps of the one brand ramp, so the bar reads as a single
 * quantity. The fill does not animate: a bar that grows on every refetch reads as change.
 */
export function ProgressMeter({
  percent,
  expected,
  testID,
  style,
}: {
  percent: number;
  expected: number;
  testID?: string;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  const t = theme.tokens;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${percent}% mastered, ${expected}% expected by now`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[
        {
          height: 8,
          borderRadius: radius.pill,
          backgroundColor: theme.dark ? t.brand950 : t.brand100,
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.max(percent, percent > 0 ? 3 : 0)}%`,
          borderRadius: radius.pill,
          backgroundColor: t.primary,
        }}
      />
      {expected > 0 && expected < 100 ? (
        <View
          style={{
            position: 'absolute',
            left: `${expected}%`,
            marginLeft: -1,
            top: -4,
            width: 2,
            height: 16,
            borderRadius: 1,
            backgroundColor: t.foreground,
            opacity: 0.6,
          }}
        />
      ) : null}
    </View>
  );
}

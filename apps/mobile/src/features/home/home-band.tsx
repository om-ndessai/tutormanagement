// The member home's band (Phase 66, H1): the greeting, the space's short name and one line for the first
// hat -- in the guest home's look (the brand's deepest blues, the bullseye's rings faint at the top
// right), slimmer, as a rounded card inside Home's frame. No money.
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export function HomeBand({ greeting, strip }: { greeting: string; strip: string | null }) {
  const theme = useAppTheme();
  const brand = useBrand();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onBand = theme.tokens.brand50;
  return (
    <View
      testID="home-band"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      style={{
        backgroundColor: theme.tokens.brand900,
        borderRadius: radius.xl,
        paddingHorizontal: space.lg,
        paddingVertical: space.lg,
        gap: space.xs,
        overflow: 'hidden',
      }}
    >
      <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={size.width} height={size.height} aria-hidden>
        <Defs>
          <LinearGradient id="home-band" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.tokens.brand900} />
            <Stop offset="1" stopColor={theme.tokens.brand800} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#home-band)" />
      </Svg>
      <View pointerEvents="none" aria-hidden style={{ position: 'absolute', top: -80, right: -80, opacity: 0.09 }}>
        <Svg width={200} height={200} viewBox="0 0 260 260">
          {[124, 92, 60, 28].map((r) => (
            <Circle key={r} cx={130} cy={130} r={r} stroke={onBand} strokeWidth={10} fill="none" />
          ))}
        </Svg>
      </View>
      <Text
        testID="home-greeting"
        variant="headlineSmall"
        accessibilityRole="header"
        style={{ fontWeight: '800', color: onBand }}
      >
        {greeting}
      </Text>
      <Text testID="home-org" variant="labelLarge" numberOfLines={1} style={{ color: onBand, opacity: 0.8 }}>
        {brand.short}
      </Text>
      {strip ? (
        <Text testID="home-strip" variant="bodyMedium" style={{ color: onBand, marginTop: space.xs }}>
          {strip}
        </Text>
      ) : null}
    </View>
  );
}

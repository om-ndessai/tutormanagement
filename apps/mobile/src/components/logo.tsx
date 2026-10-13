import type { Brand } from '@tmi/shared';
import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { brandLogoUrl, useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';

/**
 * The brand's mark: its uploaded logo, else the drawn mark (a lowercase a whose bowl is a
 * bullseye, docs/naming/README.md) on the palette's primary -- the
 * same artwork the web app draws for its favicon. Never an organization's name or colour
 * written into code: both come from the brand.
 */
export function LogoMark({ size = 40, brand: given }: { size?: number; brand?: Brand }) {
  const current = useBrand();
  const brand = given ?? current;
  const theme = useAppTheme();
  const url = brandLogoUrl(brand);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size * 0.27 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${brand.short} logo`}
      />
    );
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${brand.short} logo`}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width={48} height={48} rx={13} fill={theme.tokens.primary} />
        <G stroke={theme.tokens.primaryForeground} strokeWidth={4.2} strokeLinecap="round" fill="none">
          <Circle cx={22.5} cy={24.4} r={9.4} />
          <Path d="M34.2 13.9v20.5" />
          <Circle cx={22.5} cy={24.4} r={3.4} fill={theme.tokens.primaryForeground} stroke="none" />
        </G>
      </Svg>
    </View>
  );
}

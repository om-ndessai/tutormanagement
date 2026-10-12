// Ported from apps/web/src/features/dashboard/money-icon.tsx @ 1132322
import { View } from 'react-native';
import { Icon } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';

/**
 * A wallet carrying a plus or minus sign. Material Community has a wallet-plus but no
 * wallet-minus, so, as on the web, the sign is composed on top as a small filled disc in the
 * icon's own colour with the sign knocked out in the card's colour -- it reads on any background.
 *
 * Hidden from the screen reader: these sit beside a label that already says which figure it is.
 */
function WalletWithSign({
  sign,
  size,
  color: given,
}: {
  sign: 'plus' | 'minus';
  size: number;
  color?: string;
}) {
  const theme = useAppTheme();
  const color = given ?? theme.tokens.mutedForeground;
  const badge = Math.round(size * 0.58);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Icon source="wallet-outline" size={size} color={color} />
      <View
        style={{
          position: 'absolute',
          right: -size * 0.12,
          bottom: -size * 0.12,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          source={sign === 'plus' ? 'plus-thick' : 'minus-thick'}
          size={Math.round(badge * 0.78)}
          color={theme.colors.surface}
        />
      </View>
    </View>
  );
}

interface IconSourceProps {
  size: number;
  color?: string;
}

/** Money still to come in. A Paper `Icon` source. */
export function walletPlusIcon({ size, color }: IconSourceProps) {
  return <WalletWithSign sign="plus" size={size} color={color} />;
}

/** Money still owed out. A Paper `Icon` source. */
export function walletMinusIcon({ size, color }: IconSourceProps) {
  return <WalletWithSign sign="minus" size={size} color={color} />;
}

import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useLargeText } from '@/hooks/use-large-text';
import { space } from '@/theme/tokens';

/**
 * A row that stacks under large text (ux-audit F-12). A name beside a badge or a few icons is
 * fine at the usual sizes; at AX5 the side-by-side pieces left the name a word, or a few letters
 * ("Whitfie / ld"), per line. Stacked, the first child takes the full width and the rest sit under
 * it, start-aligned.
 */
export function AdaptiveRow({
  children,
  gap = space.sm,
  align = 'flex-start',
  justify,
  style,
  testID,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  style?: ViewStyle;
  testID?: string;
}) {
  const stacked = useLargeText();
  return (
    <View
      testID={testID}
      style={[
        stacked
          ? { flexDirection: 'column', alignItems: 'flex-start', gap }
          : { flexDirection: 'row', alignItems: align, justifyContent: justify, gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

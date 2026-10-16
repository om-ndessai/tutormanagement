import type { ComponentProps } from 'react';
import { Card } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';

/**
 * Paper's outlined card with the soft divider edge (UI upgrades U1). The theme's `outline` is the
 * stronger edge a control needs (3:1: inputs, chips, segmented buttons); a card is a container,
 * so it takes `outlineVariant`. A border colour in `style` still wins.
 */
export function OutlinedCard({ style, ...props }: Omit<ComponentProps<typeof Card>, 'mode' | 'elevation'>) {
  const theme = useAppTheme();
  return <Card {...props} mode="outlined" style={[{ borderColor: theme.colors.outlineVariant }, style]} />;
}

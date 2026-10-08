import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/theme-provider';
import { useLiveBannerInset } from './live-banner-inset';
import { space } from '@/theme/tokens';

/**
 * A screen's frame: the theme's background and (by default) a scroll view with pull-to-refresh
 * when `onRefresh` is given. The scroll view is the root, so an iOS large title collapses into
 * the bar as it scrolls and the system insets content under the header and tab bar
 * (`contentInsetAdjustmentBehavior`). `edges` pads the sides with no system bar over them --
 * a screen without a header passes 'top'. Every screen root carries a `testID`
 * (`screen-<route>`), which the Maestro flows wait on.
 */
export function Screen({
  testID,
  children,
  scroll = true,
  edges = [],
  refreshing = false,
  onRefresh,
  contentStyle,
}: {
  testID: string;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bannerInset = useLiveBannerInset();
  const padded: ViewStyle = {
    padding: space.lg,
    gap: space.lg,
    paddingTop: space.lg + (edges.includes('top') ? insets.top : 0),
    paddingBottom: space.xxl + (edges.includes('bottom') ? insets.bottom : 0) + bannerInset,
    ...contentStyle,
  };
  if (!scroll) {
    return (
      <View testID={testID} style={[{ flex: 1, backgroundColor: theme.colors.background }, padded]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={padded}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

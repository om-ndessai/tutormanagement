import type { ReactNode, Ref } from 'react';
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
  scrollRef,
}: {
  testID: string;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** The scroll view itself, for a screen that scrolls a child into view (the feature tour). */
  scrollRef?: Ref<ScrollView>;
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
      ref={scrollRef}
      testID={testID}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={padded}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // Android: a form sheet is a BottomSheetBehavior, which only lets a NESTED-scrolling child
      // scroll before it drags the sheet. Without this, dragging down in a scrolled sheet moved the
      // sheet instead of the content, so the top of a long form could not be reached again.
      nestedScrollEnabled
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

import { useCallback, useRef, type ReactNode, type RefObject } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/theme-provider';
import { ConnectivityBanner } from './connectivity';
import { FieldErrorProvider, useFieldErrorAnchors } from './field-error';
import { useLiveBannerInset } from './live-banner-inset';
import { space } from '@/theme/tokens';

/**
 * A screen's frame: the theme's background and (by default) a scroll view with pull-to-refresh
 * when `onRefresh` is given. The scroll view is the root, so an iOS large title collapses into
 * the bar as it scrolls and the system insets content under the header
 * (`contentInsetAdjustmentBehavior`); the app's tab bar sits below the screen, not over it. `edges` pads the sides with no system bar over them --
 * a screen without a header passes 'top'. Every screen root carries a `testID`
 * (`screen-<route>`), which the Maestro flows wait on.
 *
 * It also leads with the offline / unreachable banner when there is one (ux-audit F-16), and
 * brings a field error that appears in it into view (F-22) unless `scrollToErrors` is false.
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
  scrollToErrors = true,
}: {
  testID: string;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** The scroll view itself, for a screen that scrolls a child into view (the feature tour). */
  scrollRef?: RefObject<ScrollView | null> | ((view: ScrollView | null) => void | (() => void));
  /** False for a form that places its own errors in view (the person form scrolls to its foot). */
  scrollToErrors?: boolean;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bannerInset = useLiveBannerInset();
  // The scroll view, for bringing errors into view: the caller's own ref object when it passes
  // one; with a callback ref (the tour's), ours, handing the view on and its cleanup back.
  const own = useRef<ScrollView | null>(null);
  const scroller = scrollRef && typeof scrollRef === 'object' ? scrollRef : own;
  const errors = useFieldErrorAnchors(scroller, scroll && scrollToErrors);
  const forward = useCallback(
    (node: ScrollView | null) => {
      own.current = node;
      return typeof scrollRef === 'function' ? scrollRef(node) : undefined;
    },
    [scrollRef],
  );
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
        <ConnectivityBanner />
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      ref={typeof scrollRef === 'function' ? forward : scroller}
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
      onScroll={(event) => errors.onScroll(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={64}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        ) : undefined
      }
    >
      <ConnectivityBanner />
      <FieldErrorProvider value={errors.anchors}>{children}</FieldErrorProvider>
    </ScrollView>
  );
}

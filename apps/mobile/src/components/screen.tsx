import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/**
 * A screen's frame: the theme's background, safe areas, and (by default) a scroll view with
 * pull-to-refresh when `onRefresh` is given. Every screen root carries a `testID`
 * (`screen-<route>`), which the Maestro flows wait on.
 */
export function Screen({
  testID,
  children,
  scroll = true,
  edges = ['bottom'],
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
  const padded: ViewStyle = { padding: space.lg, gap: space.lg, ...contentStyle };
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={padded}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

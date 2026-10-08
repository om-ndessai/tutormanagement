import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';

type ScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>['options']>,
  (...args: never[]) => unknown
>;

/**
 * Header options every stack shares: large titles on iOS that collapse as the content scrolls
 * (the system draws the bar's material), the organization's primary for tints, the theme's
 * background beneath. `large: false` for detail screens.
 */
export function useStackOptions({ large = true }: { large?: boolean } = {}): ScreenOptions {
  const theme = useAppTheme();
  return {
    headerLargeTitle: large && Platform.OS === 'ios',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: theme.colors.primary,
    // iOS draws the bar (and its large title) itself; only Android gets painted colours.
    ...(Platform.OS === 'ios'
      ? {}
      : {
          headerTitleStyle: { color: theme.colors.onBackground },
          headerStyle: { backgroundColor: theme.colors.background },
        }),
    contentStyle: { backgroundColor: theme.colors.background },
    headerBackButtonDisplayMode: 'minimal',
  };
}

import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import type { AppTheme } from '@/theme/paper-theme';

/**
 * The native stack's theme, from the app's (ux-audit F-4). Without one the stack believed it was
 * always light: in dark mode iOS drew the header's buttons and glass for a light page, and the
 * icons on them all but vanished. `dark` follows the app's resolved mode, the colours its tokens.
 */
export function navigationTheme(theme: AppTheme): Theme {
  const base = theme.dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.dark,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.onBackground,
      border: theme.colors.outlineVariant,
      notification: theme.colors.error,
    },
  };
}

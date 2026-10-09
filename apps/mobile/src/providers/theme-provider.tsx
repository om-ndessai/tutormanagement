import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import { buildTheme, type AppTheme } from '@/theme/paper-theme';
import { useBrand } from './brand-provider';
import { ThemeFade } from './theme-fade';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: AppTheme;
}

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Light, dark or the system's choice (the web app's ThemeProvider), applied to the active
 * organization's palette. Paper's components read the result, so they wear the organization's
 * colours; our own components read `useAppTheme().tokens`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const brand = useBrand();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void readPref(STORAGE_KEYS.theme).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writePref(STORAGE_KEYS.theme, next);
  }, []);

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(() => buildTheme(brand.palette, scheme), [brand.palette, scheme]);
  const value = useMemo(() => ({ mode, setMode, theme }), [mode, setMode, theme]);

  return (
    <ThemeContext value={value}>
      <PaperProvider theme={theme}>
        <View style={{ flex: 1 }}>
          {children}
          <ThemeFade scheme={scheme} background={theme.colors.background} />
        </View>
      </PaperProvider>
    </ThemeContext>
  );
}

export function useThemeMode(): Pick<ThemeState, 'mode' | 'setMode'> {
  const context = use(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used inside <ThemeProvider>.');
  return context;
}

/** The active theme: Paper's MD3 roles plus the web app's tokens (`.tokens`). */
export function useAppTheme(): AppTheme {
  const context = use(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside <ThemeProvider>.');
  return context.theme;
}

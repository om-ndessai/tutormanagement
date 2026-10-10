import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme, View } from 'react-native';
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

  // The in-app choice reaches the system too (ux-audit F-4): the native header, its glass, the tab
  // bar and alerts take the app's trait, so an in-app Dark under a light system no longer draws
  // the app's pale ink on light materials. 'unspecified' hands it back to the system.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const reduceMotion = useReduceMotion();
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(() => {
    const built = buildTheme(brand.palette, scheme);
    // Paper's own motion (Snackbar, Menu, SegmentedButtons, the TextInput label) is stilled with
    // the app's under Reduce Motion (ux-audit F-19).
    return reduceMotion ? { ...built, animation: { ...built.animation, scale: 0 } } : built;
  }, [brand.palette, scheme, reduceMotion]);
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

/** The system's Reduce Motion setting, live. */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => mounted && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
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

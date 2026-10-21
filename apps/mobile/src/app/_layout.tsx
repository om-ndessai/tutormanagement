import '@/polyfills/intl';
import '@/polyfills/intl-cache';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import {
  Nunito_600SemiBold_Italic,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppSwitcherProtection } from '@/components/privacy-cover';
import { forgetQuestLandings } from '@/features/quest/quest-model';
import { clearQuickActions } from '@/features/shell/quick-actions';
import { endLiveSurface } from '@/features/teaching/live-surface';
import { ToastProvider } from '@/components/toast';
import { BootScreen } from '@/features/auth/boot-screen';
import { navigationTheme } from '@/features/shell/navigation-theme';
import { loadHapticsPreference } from '@/lib/haptics';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { BrandProvider } from '@/providers/brand-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider, useAppTheme } from '@/providers/theme-provider';

void SplashScreen.preventAutoHideAsync();

/**
 * Who may open what, decided once here (the web app's RequireAuth / RequireOrg):
 * signed out → sign-in only; signed in → the organization picker, the organization's
 * screens once one is entered, and the console for platform admins. A route outside the
 * guards (the server picker, developer screens) is reachable from anywhere.
 */
function RootNavigator() {
  const { status, organization, platformAdmin } = useAuth();
  const theme = useAppTheme();
  // The heading face (UI upgrades U1). A failure to load falls back to the system font rather than
  // holding the splash.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold_Italic,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (status !== 'loading' && fontsReady) void SplashScreen.hideAsync();
  }, [status, fontsReady]);

  useEffect(() => {
    void loadHapticsPreference();
  }, []);

  const signedIn = status === 'authenticated';
  useAppSwitcherProtection(signedIn);
  // Signed out: the home-screen quick actions go with the person (#43). Entering an organization
  // sets them again, from the roles held there. Question Quest's landing (Phase 42) is once per
  // sign-in, so the next sign-in lands afresh.
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    clearQuickActions();
    forgetQuestLandings();
  }, [status]);
  // Outside an organization no lesson may show on the Lock Screen or in the notifications (#45):
  // signed out, on the picker, or a relaunch that inherited a surface from a killed run.
  const inOrganization = signedIn && organization !== null;
  useEffect(() => {
    if (status !== 'loading' && !inOrganization) void endLiveSurface();
  }, [status, inOrganization]);
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);

  if (status === 'loading' || status === 'error' || !fontsReady) return <BootScreen />;

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {/* First, so a guard flipping (signing in or out, entering or leaving an organization)
            falls back through the landing redirect rather than whichever screen comes next. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="select-organization" />
          <Stack.Protected guard={organization !== null}>
            <Stack.Screen name="(org)" />
          </Stack.Protected>
          <Stack.Protected guard={platformAdmin}>
            <Stack.Screen name="(platform)" />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Screen
          name="server"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true }}
        />
        {/* Developer-only previews of the surface kit (UI upgrades U2); they redirect home in
            production. A step flow is a full-screen modal, a quick sheet a form sheet fitted to its content. */}
        <Stack.Screen name="dev/kit" options={{ presentation: 'fullScreenModal' }} />
        {/* The production welcome screen, which a development build never reaches. */}
        <Stack.Screen name="dev/welcome" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="dev/kit-sheet"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <BrandProvider>
              <ThemeProvider>
                <ToastProvider>
                  <BottomSheetModalProvider>
                    <RootNavigator />
                  </BottomSheetModalProvider>
                </ToastProvider>
              </ThemeProvider>
            </BrandProvider>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

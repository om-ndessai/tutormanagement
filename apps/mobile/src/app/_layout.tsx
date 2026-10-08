import '@/polyfills/intl';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/toast';
import { BootScreen } from '@/features/auth/boot-screen';
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

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading' || status === 'error') return <BootScreen />;

  const signedIn = status === 'authenticated';
  return (
    <>
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
      </Stack>
    </>
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

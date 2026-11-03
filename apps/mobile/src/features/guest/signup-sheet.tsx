// Ported from apps/web/src/features/guest/signup-sheet.tsx @ 0e3ec7a (working tree). Phase 63 (P13):
// signing up without leaving the page. A provider's button (or, with sign-in off, a developer address),
// then the age question and the terms, then a short splash -- and the person is back on the screen they
// were on, now a member: no Welcome screen. Someone who already has an account is simply signed in.
//
// Mobile: a form-sheet route (`/sign-up-sheet`) outside both sign-in guards, over the Play home or a
// guest's quest, which stay mounted beneath it. The providers are the app's native ones (the sign-in
// screen's); the age and terms step is the app's own SignUpScreen (the same fields and testIDs as the
// sign-up route); with sign-in off, the developer path asks for the address here and the name there.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { AccessRefusedScreen } from '@/features/auth/access-refused-screen';
import { ProviderButtons, ProviderSignInButton } from '@/features/auth/provider-buttons';
import type { UsableProvider } from '@/features/auth/provider-model';
import { SignInError } from '@/features/auth/sign-in-error';
import { SignUpScreen } from '@/features/auth/sign-up-screen';
import { GoogleButton } from '@/lib/google-sign-in';
import { APP_VARIANT, DEV_TOOLS } from '@/lib/variant';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { countEvent, flushEvents } from './guest-api';

/**
 * How long the "You're in." splash shows before the sheet goes. Outside production builds (the
 * development and e2e builds the Maestro flows drive) it stays longer: on Android, reading the screen
 * after a tap takes about as long as the real splash lasts, so a flow could not reliably see it.
 */
export const SPLASH_MS = APP_VARIANT === 'production' ? 1100 : 4000;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function SignupSheet() {
  const theme = useAppTheme();
  const {
    config,
    status,
    pendingSignup,
    startDevSignup,
    cancelSignup,
    googleAvailable,
    signInWithGoogle,
    providers,
    signInWithProvider,
    error,
    clearError,
    accessRefusal,
    clearAccessRefusal,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // Reached the age question: a sign-in that follows is this sign-up finishing, so the splash shows
  // (from the moment the form is sent: the account is being made). Cancelling forgets it.
  const [signingUp, setSigningUp] = useState(false);
  if (pendingSignup && !signingUp) setSigningUp(true);
  const signedIn = status === 'authenticated';
  // Phase 65: a sign-up that waits for approval (or is refused) never shows the splash.
  const splash = !accessRefusal && signingUp && (signedIn || !pendingSignup);
  const devSignUp = DEV_TOOLS && config?.auth_enabled === false;

  // Signed up: the splash, then back to the screen beneath. Signed in to an existing account: back at once.
  useEffect(() => {
    if (!signedIn) return;
    if (!signingUp) {
      close();
      return;
    }
    countEvent({ name: 'signup_finished', source: 'sheet' });
    flushEvents();
    const timer = setTimeout(close, SPLASH_MS);
    return () => clearTimeout(timer);
    // Once, as the person becomes signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Closed half-way (swiped down at the age question): the sign-up is abandoned, as Cancel does.
  const pending = useRef(pendingSignup);
  useEffect(() => {
    pending.current = pendingSignup;
  }, [pendingSignup]);
  const cancel = useRef(cancelSignup);
  useEffect(() => {
    cancel.current = cancelSignup;
  }, [cancelSignup]);
  useEffect(
    () => () => {
      if (pending.current) void cancel.current();
    },
    [],
  );

  // Phase 65 (A4): waiting for approval, not approved, or not on the list -- the refusal screen, not
  // "You're in." (The root shows it too, over every screen; this keeps the sheet's own render honest.)
  if (accessRefusal) {
    return (
      <AccessRefusedScreen
        code={accessRefusal.code}
        message={accessRefusal.message}
        onBack={() => {
          clearAccessRefusal();
          close();
        }}
      />
    );
  }

  if (splash) {
    return (
      <Screen testID="screen-sign-up-sheet">
        <View testID="signup-splash" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <LogoMark size={72} />
          <Text variant="titleLarge" accessibilityRole="header" style={{ fontWeight: '700' }}>
            You’re in.
          </Text>
        </View>
      </Screen>
    );
  }

  // The age question and the terms: the sign-up screen's own step.
  if (pendingSignup) return <SignUpScreen onCancelled={() => setSigningUp(false)} />;

  async function google() {
    setBusy('google');
    clearError();
    await signInWithGoogle();
    setBusy(null);
  }
  async function other(provider: UsableProvider) {
    setBusy(provider.id);
    clearError();
    await signInWithProvider(provider);
    setBusy(null);
  }

  return (
    <Screen testID="screen-sign-up-sheet">
      <View testID="signup-sheet" style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header" style={{ fontWeight: '700' }}>
          {config?.signup_open ? 'Sign up free' : 'Sign in'}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Keep your scores, unlock every quest and play with your family.
        </Text>
      </View>
      {devSignUp ? (
        <View style={{ gap: space.sm }} accessibilityLabel="Developer sign-up">
          <TextInput
            testID="signup-sheet-email"
            mode="outlined"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => email.includes('@') && startDevSignup(email)}
          />
          <Button
            testID="signup-sheet-continue"
            mode="contained"
            disabled={!email.includes('@')}
            onPress={() => startDevSignup(email)}
          >
            Continue
          </Button>
        </View>
      ) : (
        <View style={{ gap: space.sm, alignItems: 'center' }}>
          {googleAvailable && GoogleButton ? (
            <ProviderSignInButton
              provider="google"
              label="Google"
              testID="signup-sheet-google"
              busy={busy === 'google'}
              disabled={busy !== null}
              onPress={() => void google()}
            />
          ) : null}
          <ProviderButtons providers={providers} busy={busy} onSignIn={(provider) => void other(provider)} />
        </View>
      )}
      {error ? <SignInError code={error.code} message={error.message} /> : null}
    </Screen>
  );
}

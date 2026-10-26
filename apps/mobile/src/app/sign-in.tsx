import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Chip, List, Surface, Text, TextInput } from 'react-native-paper';

import { ListItem } from '@/components/list-item';
import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { ReleasePhase } from '@/components/release-phase';
import { PERSONAS } from '@/dev/personas';
import { LegalLine } from '@/features/auth/legal-links';
import { ProviderButtons } from '@/features/auth/provider-buttons';
import { offersGoogle, signInHow, type UsableProvider } from '@/features/auth/provider-model';
import { SignInError } from '@/features/auth/sign-in-error';
import { Welcome } from '@/features/auth/welcome';
import { GoogleButton } from '@/lib/google-sign-in';
import { haptics } from '@/lib/haptics';
import { serverOrigin } from '@/lib/server';
import { DEV_TOOLS } from '@/lib/variant';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { CHIP_HIT_SLOP, radius, space } from '@/theme/tokens';

/**
 * Sign-in, decided by the server:
 * - sign-in on and this build configured for Google: Google's own button, through the same
 *   POST /auth/google the web uses (the server matches the account's email to a live person);
 * - sign-in off (the local Worker, the demo; development and e2e builds only): the developer
 *   sign-in, acting as a seeded person -- an email the server does not know is refused;
 * - otherwise a plain message saying why there is no way in from this build.
 */
export default function SignInScreen() {
  const {
    config,
    googleAvailable,
    signInWithGoogle,
    providers,
    signInWithProvider,
    signInAsDevUser,
    error,
    clearError,
    pendingSignup,
    startDevSignup,
  } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // The address last tried with developer sign-in: an unknown one may be signed up (Phase 52).
  const [tried, setTried] = useState<string | null>(null);
  const devSignIn = DEV_TOOLS && config?.auth_enabled === false;

  // A refusal is felt as well as read; a cancelled Google sheet sets no error, so says nothing. A
  // rate limit is not the person's fault: no error haptic (Phase 51).
  useEffect(() => {
    if (error && error.code !== 'rate_limited') haptics.error();
  }, [error]);

  // Phase 52: a newcomer answers the age question next.
  useEffect(() => {
    if (pendingSignup) router.replace('/sign-up');
  }, [pendingSignup]);

  const errorView = error ? (
    <SignInError
      code={error.code}
      message={error.message}
      signUpEmail={devSignIn ? tried : null}
      onSignUp={tried ? () => startDevSignup(tried) : undefined}
    />
  ) : null;

  async function signInGoogle() {
    setBusy('google');
    clearError();
    await signInWithGoogle();
    setBusy(null);
  }

  // Phase 55: Microsoft, Apple or Facebook, answered as Google is.
  async function signInOther(provider: UsableProvider) {
    setBusy(provider.id);
    clearError();
    await signInWithProvider(provider);
    setBusy(null);
  }

  const providerButtons = (
    <ProviderButtons providers={providers} busy={busy} onSignIn={(provider) => void signInOther(provider)} />
  );
  const anyWayIn = googleAvailable || providers.length > 0;

  async function signIn(address: string) {
    setBusy(address);
    setTried(address.trim());
    clearError();
    await signInAsDevUser(address);
    setBusy(null);
  }

  // The production app, signing in with Google: the welcome screen, and nothing a developer needs.
  if (!DEV_TOOLS && anyWayIn) {
    return (
      <Screen testID="screen-sign-in" edges={['top', 'bottom']} scroll={false}>
        <Welcome
          busy={busy === 'google'}
          onSignIn={() => void signInGoogle()}
          google={googleAvailable}
          others={providerButtons}
        />
        {errorView}
        <ReleasePhase />
      </Screen>
    );
  }

  return (
    <Screen testID="screen-sign-in" edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <LogoMark size={64} />
        <Text variant="headlineMedium" accessibilityRole="header">
          {brand.name}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          {brand.tagline}
        </Text>
        {/* Which server, and the way to another: a developer's tool. The production app says what the
            platform is instead, in the words the portal's sign-in page uses. */}
        {DEV_TOOLS ? (
          <Chip
            hitSlop={CHIP_HIT_SLOP}
            icon="server"
            compact
            onPress={() => router.push('/server')}
            testID="sign-in-server"
          >
            {serverOrigin().replace(/^https?:\/\//, '')}
          </Chip>
        ) : (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
            testID="sign-in-blurb"
          >
            {brand.blurb}
          </Text>
        )}
      </View>

      {devSignIn ? (
        <Surface style={{ borderRadius: radius.lg, paddingVertical: space.sm }} elevation={1}>
          <List.Subheader>Developer sign-in</List.Subheader>
          <Text
            variant="bodySmall"
            style={{
              paddingHorizontal: space.lg,
              paddingBottom: space.sm,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            This server has sign-in switched off. Choose a seeded person to act as.
          </Text>
          {PERSONAS.map((person) => (
            <ListItem
              key={person.email}
              testID={`sign-in-persona-${person.email}`}
              title={person.name}
              description={person.hint}
              left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
              right={(props) =>
                busy === person.email ? <List.Icon {...props} icon="dots-horizontal" /> : null
              }
              onPress={() => void signIn(person.email)}
              disabled={busy !== null}
            />
          ))}
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
            <TextInput
              testID="sign-in-email"
              mode="outlined"
              label="Another email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={() => email.includes('@') && void signIn(email)}
            />
            <Button
              testID="sign-in-email-submit"
              mode="contained"
              onPress={() => void signIn(email)}
              disabled={busy !== null || !email.includes('@')}
              loading={busy === email}
            >
              Sign in
            </Button>
          </View>
        </Surface>
      ) : anyWayIn && (GoogleButton || !googleAvailable) ? (
        <Surface style={{ borderRadius: radius.lg, padding: space.lg, gap: space.md }} elevation={1}>
          <Text variant="titleMedium" accessibilityRole="header">
            Staff portal
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {config?.signup_open
              ? `Sign in with ${signInHow(googleAvailable, providers)}. New here? You can join a space with its code, or make your own.`
              : providers.length > 0
                ? 'Sign in the way your administrator set you up, or with an account you have added.'
                : 'Sign in with the Google account your administrator added.'}
          </Text>
          {/* Google's own button: its "G" mark and "Sign in with Google", as its branding asks. */}
          {googleAvailable && GoogleButton ? (
          <View style={{ alignItems: 'center' }}>
            <GoogleButton
              testID="sign-in-google"
              accessibilityLabel="Sign in with Google"
              size={GoogleButton.Size.Wide}
              color={theme.dark ? GoogleButton.Color.Light : GoogleButton.Color.Dark}
              disabled={busy !== null}
              onPress={() => void signInGoogle()}
              style={{ width: 312, height: 48 }}
            />
          </View>
          ) : null}
          {providerButtons}
          <View style={{ minHeight: 20, alignItems: 'center' }}>
            {busy === 'google' ? (
              <View testID="sign-in-google-busy" style={{ flexDirection: 'row', gap: space.sm }}>
                <ActivityIndicator size={16} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Signing you in…
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            {offersGoogle(config) && providers.length === 0
              ? 'Already in a space? Use the Google address its administrators added.'
              : 'Already in a space? Use the address its administrators added.'}
          </Text>
          <LegalLine testID="sign-in-legal" ids={{ terms: 'sign-in-terms', privacy: 'sign-in-privacy' }} />
        </Surface>
      ) : config?.auth_enabled ? (
        <Surface
          testID="sign-in-not-configured"
          style={{ borderRadius: radius.lg, padding: space.lg, gap: space.sm }}
          elevation={1}
        >
          <Text variant="titleMedium">Google sign-in not configured for this build</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            This server requires Google sign-in, and this build has no Google client ID for this device. See
            docs/mobile/google-sign-in.md, or choose a server with developer sign-in.
          </Text>
        </Surface>
      ) : (
        <Surface
          testID="sign-in-unavailable"
          style={{ borderRadius: radius.lg, padding: space.lg, gap: space.sm }}
          elevation={1}
        >
          <Text variant="titleMedium">Sign-in is switched off on this server</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            This build signs in with Google only. Choose a server that has sign-in switched on.
          </Text>
        </Surface>
      )}

      {errorView}
      {devSignIn ? (
        <LegalLine testID="sign-in-legal" ids={{ terms: 'sign-in-terms', privacy: 'sign-in-privacy' }} />
      ) : null}
      <ReleasePhase />
    </Screen>
  );
}

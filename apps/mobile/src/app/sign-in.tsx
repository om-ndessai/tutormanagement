import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, HelperText, List, Surface, Text, TextInput } from 'react-native-paper';

import { LogoMark } from '@/components/logo';
import { Screen } from '@/components/screen';
import { PERSONAS } from '@/dev/personas';
import { serverOrigin } from '@/lib/server';
import { DEV_TOOLS } from '@/lib/variant';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * Sign-in. Until Phase 4 adds Google, the only way in is the developer sign-in: on a server
 * with sign-in switched off (the local Worker, the demo), act as a seeded person. The server
 * itself decides who that is -- an email it does not know is refused.
 */
export default function SignInScreen() {
  const { config, signInAsDevUser, error, clearError } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const devSignIn = DEV_TOOLS && config?.auth_enabled === false;

  async function signIn(address: string) {
    setBusy(address);
    clearError();
    await signInAsDevUser(address);
    setBusy(null);
  }

  return (
    <Screen testID="screen-sign-in" edges={['top', 'bottom']} contentStyle={{ paddingTop: space.xxl }}>
      <View style={{ alignItems: 'center', gap: space.md }}>
        <LogoMark size={64} />
        <Text variant="headlineMedium" accessibilityRole="header">
          {brand.name}
        </Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          {brand.tagline}
        </Text>
        <Chip icon="server" compact onPress={() => router.push('/server')} testID="sign-in-server">
          {serverOrigin().replace(/^https?:\/\//, '')}
        </Chip>
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
            <List.Item
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
      ) : (
        <Surface style={{ borderRadius: radius.lg, padding: space.lg, gap: space.sm }} elevation={1}>
          <Text variant="titleMedium">Sign in with Google</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            This server requires Google sign-in, which the app does not support yet. Choose a server with
            developer sign-in to continue.
          </Text>
        </Surface>
      )}

      <HelperText type="error" visible={error !== null} testID="sign-in-error">
        {error?.message ?? ''}
      </HelperText>
    </Screen>
  );
}

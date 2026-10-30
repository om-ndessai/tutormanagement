// Ported from apps/web/src/features/auth/provider-buttons.tsx @ 3279506
import type { AuthProvider } from '@tmi/shared';
import { Pressable, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Svg, { Path, Rect } from 'react-native-svg';

import { useAppTheme } from '@/providers/theme-provider';
import { GOOGLE_G, MICROSOFT_SQUARES, PROVIDER_BUTTONS } from '@/theme/brand-art';
import { radius, space } from '@/theme/tokens';
import type { UsableProvider } from './provider-model';

/** A provider's mark from the icon set, in the theme's colour (My profile's "Ways to sign in"). */
export const PROVIDER_ICONS: Record<AuthProvider, string> = {
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
  facebook: 'facebook',
};

/** Every sign-in button's size, so Google's and the others' line up as one stack. */
export const SIGN_IN_BUTTON = { width: 312, height: 48 } as const;

/** A provider's own logo, in its own colours (Facebook's "f" and Apple's mark take the button's text colour). */
export function ProviderLogo({ provider, color, size = 20 }: { provider: AuthProvider; color: string; size?: number }) {
  switch (provider) {
    case 'microsoft':
      return (
        <Svg width={size} height={size} viewBox="0 0 21 21">
          <Rect x={1} y={1} width={9} height={9} fill={MICROSOFT_SQUARES.red} />
          <Rect x={11} y={1} width={9} height={9} fill={MICROSOFT_SQUARES.green} />
          <Rect x={1} y={11} width={9} height={9} fill={MICROSOFT_SQUARES.blue} />
          <Rect x={11} y={11} width={9} height={9} fill={MICROSOFT_SQUARES.yellow} />
        </Svg>
      );
    case 'facebook':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            fill={color}
            d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z"
          />
        </Svg>
      );
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16">
          <Path
            fill={color}
            d="M11.2 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.4 4.8 3.3 5.5 2.7 6.6c-1.2 2.1-.3 5.2.9 6.9.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5 1.5-.8 2-1.7c.6-.9.9-1.8.9-1.9 0 0-1.8-.7-1.8-3.1ZM9.6 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.5-.4 2-1Z"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path
            fill={GOOGLE_G.red}
            d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"
          />
          <Path
            fill={GOOGLE_G.blue}
            d="M46.9 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.9c-.6 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 7.4-17.4z"
          />
          <Path
            fill={GOOGLE_G.yellow}
            d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z"
          />
          <Path
            fill={GOOGLE_G.green}
            d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2.1 1.4-4.9 2.3-8.6 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
          />
        </Svg>
      );
  }
}

/**
 * One provider's sign-in button, in that provider's own colours and logo: the same width, height and
 * pill shape for every provider, the logo at the left edge and "Continue with <label>" centred.
 */
export function ProviderSignInButton({
  provider,
  label,
  testID,
  busy = false,
  disabled = false,
  onPress,
}: {
  provider: AuthProvider;
  label: string;
  testID?: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const colors = PROVIDER_BUTTONS[provider][theme.dark ? 'dark' : 'light'];
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${label}`}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        width: SIGN_IN_BUTTON.width,
        maxWidth: '100%',
        height: SIGN_IN_BUTTON.height,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xl + space.lg,
        opacity: pressed ? 0.85 : disabled && !busy ? 0.6 : 1,
      })}
    >
      <View style={{ position: 'absolute', left: space.lg, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator size={18} color={colors.text} /> : <ProviderLogo provider={provider} color={colors.text} />}
      </View>
      <Text variant="labelLarge" numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
        {`Continue with ${label}`}
      </Text>
    </Pressable>
  );
}

/**
 * Phase 55: the sign-in screen's buttons for every provider but Google (drawn just above, the same
 * way), one "Continue with <label>" each, in the server's order. Nothing while there are none.
 */
export function ProviderButtons({
  providers,
  busy,
  onSignIn,
}: {
  providers: UsableProvider[];
  /** The provider signing in now, or another way in (`'google'`, a persona) that disables these. */
  busy: string | null;
  onSignIn: (provider: UsableProvider) => void;
}) {
  if (providers.length === 0) return null;
  return (
    <View testID="sign-in-providers" style={{ gap: space.sm, alignSelf: 'stretch', alignItems: 'center' }}>
      {providers.map((provider) => (
        <ProviderSignInButton
          key={provider.id}
          provider={provider.id}
          label={provider.label}
          testID={`sign-in-provider-${provider.id}`}
          busy={busy === provider.id}
          disabled={busy !== null}
          onPress={() => onSignIn(provider)}
        />
      ))}
    </View>
  );
}

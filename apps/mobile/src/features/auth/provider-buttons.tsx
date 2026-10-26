// Ported from apps/web/src/features/auth/provider-buttons.tsx @ 3279506
import type { AuthProvider } from '@tmi/shared';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { space } from '@/theme/tokens';
import type { UsableProvider } from './provider-model';

/** A provider's mark, from the icon set (in the theme's own colour, as the web's glyphs are). */
export const PROVIDER_ICONS: Record<AuthProvider, string> = {
  google: 'google',
  microsoft: 'microsoft',
  apple: 'apple',
  facebook: 'facebook',
};

/**
 * Phase 55: the sign-in screen's buttons for every provider but Google (which draws its own), one
 * "Continue with <label>" each, in the server's order. Nothing while there are none.
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
        <Button
          key={provider.id}
          testID={`sign-in-provider-${provider.id}`}
          mode="outlined"
          icon={PROVIDER_ICONS[provider.id]}
          disabled={busy !== null}
          loading={busy === provider.id}
          onPress={() => onSignIn(provider)}
          style={{ width: 312, maxWidth: '100%' }}
          contentStyle={{ minHeight: 48 }}
        >
          {`Continue with ${provider.label}`}
        </Button>
      ))}
    </View>
  );
}

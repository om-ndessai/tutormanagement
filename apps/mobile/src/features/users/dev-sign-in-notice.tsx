// Ported from the "Authentication is switched off" panel in apps/web/src/pages/profile-page.tsx @ 1132322.
// On the phone a server with sign-in off is always the developer sign-in, so the panel says so.
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';

/** Shown on My profile while the server has sign-in switched off; nothing otherwise. */
export function DevSignInNotice() {
  const { user, impersonated } = useAuth();
  const theme = useAppTheme();
  if (!impersonated || !user) return null;
  const ink = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <View
      testID="profile-dev-notice"
      accessible
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: withAlpha(theme.tokens.warning, 0.4),
        backgroundColor: withAlpha(theme.tokens.warning, 0.1),
      }}
    >
      <Icon source="alert-outline" size={18} color={ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall" style={{ color: theme.colors.onBackground }}>
          Developer sign-in
        </Text>
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {`This server has sign-in switched off, and the app is acting as ${user.full_name}. Only a development server should run this way.`}
        </Text>
      </View>
    </View>
  );
}

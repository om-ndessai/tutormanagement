// Ported from apps/web/src/features/platform/platform-shell.tsx @ 1132322 (the header's actions):
// back to My spaces for a platform admin who belongs to any, and Sign out. Phase 62: the gear opens
// the console's Settings (the sign-in switches), a pushed screen since the tabs are full.
import { router } from 'expo-router';
import { View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';

export function ConsoleHeaderButtons() {
  const { memberships, signOut } = useAuth();
  const theme = useAppTheme();
  const hasOrganizations = memberships.some((m) => m.status === 'active');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {hasOrganizations ? (
        <IconButton
          testID="platform-my-orgs"
          icon="swap-horizontal"
          iconColor={theme.colors.primary}
          accessibilityLabel="My spaces"
          onPress={() => {
            haptics.selection();
            router.replace('/spaces');
          }}
        />
      ) : null}
      <IconButton
        testID="platform-settings"
        icon="cog-outline"
        iconColor={theme.colors.primary}
        accessibilityLabel="Settings"
        onPress={() => {
          haptics.selection();
          router.push('/platform-settings');
        }}
      />
      <IconButton
        testID="platform-sign-out"
        icon="logout"
        iconColor={theme.colors.primary}
        accessibilityLabel="Sign out"
        onPress={() => {
          haptics.selection();
          void signOut();
        }}
      />
    </View>
  );
}

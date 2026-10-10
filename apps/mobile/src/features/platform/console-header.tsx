// Ported from apps/web/src/features/platform/platform-shell.tsx @ 1132322 (the header's actions):
// back to My organizations for a platform admin who belongs to any, and Sign out.
import { router } from 'expo-router';
import { View } from 'react-native';
import { IconButton } from 'react-native-paper';

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
          accessibilityLabel="My organizations"
          onPress={() => {
            haptics.selection();
            router.replace('/select-organization');
          }}
        />
      ) : null}
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

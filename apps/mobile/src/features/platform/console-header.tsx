// Ported from apps/web/src/features/platform/platform-shell.tsx @ 1132322 (the header's actions):
// back to My spaces for a platform admin who belongs to any, and Sign out. Phase 62: the gear opens
// the console's Settings (the sign-in switches), a pushed screen since the tabs are full. Phase 65: its badge
// counts the sign-ups waiting for approval. Phase 69: the chart beside it opens Stickiness (totals only).
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { useAccessConsole } from './api';

export function ConsoleHeaderButtons() {
  const { memberships, signOut } = useAuth();
  const theme = useAppTheme();
  // Phase 65 (A6): how many sign-ups wait for a platform admin, on the gear that opens them.
  const waiting = useAccessConsole().data?.data.waiting.length ?? 0;
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
        testID="platform-stickiness"
        icon="chart-bar"
        iconColor={theme.colors.primary}
        accessibilityLabel="Stickiness"
        onPress={() => {
          haptics.selection();
          router.push('/platform-stickiness');
        }}
      />
      <View>
        <IconButton
          testID="platform-settings"
          icon="cog-outline"
          iconColor={theme.colors.primary}
          accessibilityLabel={waiting > 0 ? `Settings, ${waiting} waiting for approval` : 'Settings'}
          onPress={() => {
            haptics.selection();
            router.push('/platform-settings');
          }}
        />
        {waiting > 0 ? (
          <Badge testID="platform-settings-waiting" size={16} style={{ position: 'absolute', top: 2, right: 2 }}>
            {waiting}
          </Badge>
        ) : null}
      </View>
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

import { useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/logo';
import { ServerPicker } from '@/features/auth/server-picker';
import { serverOrigin } from '@/lib/server';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/**
 * Shown while the app finds out who it is signed in as -- or why it cannot: the server's own
 * message (a misconfiguration, an unreachable Worker), and the way to another server.
 */
export function BootScreen() {
  const { status, statusMessage, reboot } = useAuth();
  const theme = useAppTheme();
  const [choosing, setChoosing] = useState(false);
  return (
    <SafeAreaView
      testID={status === 'error' ? 'screen-boot-error' : 'screen-boot'}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.lg,
        padding: space.xl,
        backgroundColor: theme.colors.background,
      }}
    >
      <LogoMark size={56} />
      {status === 'error' ? (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Text variant="titleMedium">Can’t reach the portal</Text>
          <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
            {statusMessage ?? 'The server did not respond.'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {serverOrigin()}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button mode="contained" onPress={() => void reboot()} testID="boot-retry">
              Try again
            </Button>
            <Button mode="outlined" onPress={() => setChoosing(true)} testID="boot-server">
              Change server
            </Button>
          </View>
          {choosing ? (
            <View style={{ alignSelf: 'stretch' }}>
              <ServerPicker onDone={() => setChoosing(false)} />
            </View>
          ) : null}
        </View>
      ) : (
        <ActivityIndicator accessibilityLabel="Loading your portal" />
      )}
    </SafeAreaView>
  );
}

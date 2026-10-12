// Offline and unreachable, said plainly (ux-audit F-16, immersive-design §15): a slim banner under
// the header with a way to try again, and Save held back while the phone has no network at all.
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { isServerUnreachable, subscribeReachability } from '@/lib/reachability';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export type Connectivity = 'online' | 'offline' | 'unreachable';

/**
 * How long "no network" must last before it is believed. The Android emulator's network state
 * flickers at launch (query-provider.tsx), and a banner that blinks is worse than none.
 */
export const OFFLINE_SETTLE_MS = 1500;

/**
 * `offline`: the phone reports no network connection. `unreachable`: it has one, but the last
 * request never reached the server. Queries are still not paused (query-provider.tsx): a request
 * made offline fails with its own plain message, and the banner says why.
 */
export function useConnectivity(): Connectivity {
  const network = useNetworkState();
  const unreachable = useSyncExternalStore(subscribeReachability, isServerUnreachable);
  const disconnected = network.isConnected === false;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!disconnected) return;
    const timer = setTimeout(() => setSettled(true), OFFLINE_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      setSettled(false);
    };
  }, [disconnected]);
  if (disconnected && settled) return 'offline';
  return unreachable ? 'unreachable' : 'online';
}

/** True while the phone has no network: a save would only fail, so it is held back. */
export function useOffline(): boolean {
  return useConnectivity() === 'offline';
}

/** The slim, non-modal banner: nothing while online. */
export function ConnectivityBanner() {
  const state = useConnectivity();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);
  if (state === 'online') return null;

  async function retry() {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRetrying(false);
    }
  }

  const offline = state === 'offline';
  return (
    <View
      testID={offline ? 'banner-offline' : 'banner-unreachable'}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.xs,
        paddingLeft: space.md,
        paddingRight: space.xs,
        borderRadius: radius.md,
        backgroundColor: theme.colors.surfaceVariant,
      }}
    >
      <Icon
        source={offline ? 'wifi-off' : 'cloud-off-outline'}
        size={18}
        color={theme.colors.onSurfaceVariant}
      />
      <Text variant="bodyMedium" style={{ flex: 1, minWidth: 160, color: theme.colors.onSurfaceVariant }}>
        {offline
          ? 'You are offline. What you see may be out of date, and nothing can be saved until you are back.'
          : 'Cannot reach the server. Check your connection, then try again.'}
      </Text>
      <Button
        testID="banner-retry"
        mode="text"
        compact
        loading={retrying}
        disabled={retrying}
        onPress={() => void retry()}
      >
        Try again
      </Button>
    </View>
  );
}

/** Under a held-back Save: why it cannot be pressed. */
export function OfflineSaveNote({ offline }: { offline: boolean }) {
  const theme = useAppTheme();
  if (!offline) return null;
  return (
    <Text
      testID="form-offline-note"
      variant="bodySmall"
      style={{ color: theme.tokens.mutedForeground, textAlign: 'center' }}
    >
      You are offline. Save once you are back online; what you have entered stays here.
    </Text>
  );
}

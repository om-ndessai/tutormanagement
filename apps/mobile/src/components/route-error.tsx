import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';

/**
 * A screen that threw while drawing (a route's `ErrorBoundary`): calm words, Try again, and a way home --
 * never a blank app with nothing to tap (UI audit J07A steps 14-17). The error itself is not shown.
 */
export function RouteError({ retry }: { retry: () => Promise<void> }) {
  const theme = useAppTheme();
  return (
    <View
      testID="screen-route-error"
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.md,
        padding: space.xl,
        backgroundColor: theme.colors.background,
      }}
    >
      <Icon source="alert-circle-outline" size={40} color={theme.colors.error} />
      <Text variant="titleMedium" style={{ textAlign: 'center' }}>
        This screen ran into a problem.
      </Text>
      <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
        Try again, or go back to Home.
      </Text>
      <Button testID="route-error-retry" mode="contained" onPress={() => void retry()}>
        Try again
      </Button>
      <Button
        testID="route-error-home"
        mode="outlined"
        onPress={() => {
          router.replace('/');
          void retry();
        }}
      >
        Go to Home
      </Button>
    </View>
  );
}

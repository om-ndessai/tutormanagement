import { router } from 'expo-router';
import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ServerPicker } from '@/features/auth/server-picker';

export default function ServerScreen() {
  return (
    <Screen testID="screen-server" edges={['bottom', 'top']}>
      <Text variant="titleLarge" accessibilityRole="header">
        Server
      </Text>
      <ServerPicker onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

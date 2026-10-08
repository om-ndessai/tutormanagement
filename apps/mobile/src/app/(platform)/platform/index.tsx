import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';

export default function PlatformHome() {
  return (
    <Screen testID="screen-platform" edges={['top', 'bottom']}>
      <Text variant="headlineSmall">Platform console</Text>
    </Screen>
  );
}

import { Text } from 'react-native-paper';

import { Screen } from '@/components/screen';

export default function SelectOrganization() {
  return (
    <Screen testID="screen-select-organization" edges={['top', 'bottom']}>
      <Text variant="headlineSmall">Choose an organization</Text>
    </Screen>
  );
}

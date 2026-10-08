import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function ProfileScreen() {
  return (
    <Screen testID="screen-profile">
      <Stack.Screen options={{ title: 'My profile' }} />
      <EmptyState icon="account-outline" title="My profile" body="Coming next on this branch." />
    </Screen>
  );
}

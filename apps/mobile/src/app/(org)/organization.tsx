import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function OrganizationScreen() {
  return (
    <Screen testID="screen-organization">
      <Stack.Screen options={{ title: 'Organization' }} />
      <EmptyState icon="domain" title="Organization" body="Coming next on this branch." />
    </Screen>
  );
}

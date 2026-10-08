import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function BillingScreen() {
  return (
    <Screen testID="screen-billing">
      <Stack.Screen options={{ title: 'Billing' }} />
      <EmptyState icon="wallet-outline" title="Billing" body="Coming next on this branch." />
    </Screen>
  );
}

import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function PairingsScreen() {
  return (
    <Screen testID="screen-pairings">
      <Stack.Screen options={{ title: 'Pairings' }} />
      <EmptyState icon="link-variant" title="Pairings" body="Coming next on this branch." />
    </Screen>
  );
}

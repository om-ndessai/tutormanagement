import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function ActivityScreen() {
  return (
    <Screen testID="screen-activity">
      <Stack.Screen options={{ title: 'Activity' }} />
      <EmptyState icon="history" title="Activity" body="Coming next on this branch." />
    </Screen>
  );
}

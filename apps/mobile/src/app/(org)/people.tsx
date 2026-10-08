import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function PeopleScreen() {
  return (
    <Screen testID="screen-people">
      <Stack.Screen options={{ title: 'Users' }} />
      <EmptyState icon="account-group-outline" title="Users" body="Coming next on this branch." />
    </Screen>
  );
}

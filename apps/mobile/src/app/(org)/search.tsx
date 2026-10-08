import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function SearchScreen() {
  return (
    <Screen testID="screen-search">
      <Stack.Screen options={{ title: 'Search' }} />
      <EmptyState icon="magnify" title="Search" body="Coming next on this branch." />
    </Screen>
  );
}

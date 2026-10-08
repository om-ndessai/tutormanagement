import { Stack } from 'expo-router';

import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function CommentsScreen() {
  return (
    <Screen testID="screen-comments">
      <Stack.Screen options={{ title: 'Comments' }} />
      <EmptyState icon="message-text-outline" title="Comments" body="Coming next on this branch." />
    </Screen>
  );
}

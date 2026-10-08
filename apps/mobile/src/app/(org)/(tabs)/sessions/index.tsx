import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function SessionsScreen() {
  return (
    <Screen testID="screen-sessions">
      <EmptyState icon="book-open-variant" title="Sessions" body="Coming next on this branch." />
    </Screen>
  );
}

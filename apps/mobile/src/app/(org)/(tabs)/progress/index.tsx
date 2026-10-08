import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function ProgressScreen() {
  return (
    <Screen testID="screen-progress">
      <EmptyState icon="trending-up" title="Progress" body="Coming next on this branch." />
    </Screen>
  );
}

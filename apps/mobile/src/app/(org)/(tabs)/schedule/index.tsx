import { EmptyState } from '@/components/state-views';
import { Screen } from '@/components/screen';

export default function ScheduleScreen() {
  return (
    <Screen testID="screen-schedule">
      <EmptyState icon="calendar-month-outline" title="Schedule" body="Coming next on this branch." />
    </Screen>
  );
}

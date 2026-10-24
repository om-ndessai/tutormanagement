import { useLocalSearchParams } from 'expo-router';

import { ScheduleFormSheet } from '@/features/schedules/schedule-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Schedule a standing weekly lesson, or edit one (`?id=<schedule>`), as a form sheet. */
function ScheduleFormRouteContent() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ScheduleFormSheet scheduleId={id} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ScheduleFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <ScheduleFormRouteContent />
    </FeatureGate>
  );
}

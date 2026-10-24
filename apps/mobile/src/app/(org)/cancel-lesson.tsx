import { useLocalSearchParams } from 'expo-router';

import { CancelLessonSheet } from '@/features/schedules/cancel-lesson-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Call off one lesson of a series (`?schedule=<id>[&date=<YYYY-MM-DD>]`), as a form sheet. */
function CancelLessonRouteContent() {
  const { schedule, date } = useLocalSearchParams<{ schedule?: string; date?: string }>();
  return <CancelLessonSheet scheduleId={schedule} date={date} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function CancelLessonRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <CancelLessonRouteContent />
    </FeatureGate>
  );
}

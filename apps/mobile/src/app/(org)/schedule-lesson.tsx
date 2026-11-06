import { useLocalSearchParams } from 'expo-router';

import { ScheduleLessonFlow } from '@/features/schedules/schedule-lesson-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Schedule a standing weekly lesson as a step flow (UI upgrades U5): Who, When, From when, Where,
 * then a Review said as a sentence. Editing one stays the sheet (`/schedule-form?id=`). `?assignment=` (Phase 76,
 * "Set a weekly lesson") opens on that pairing, at When.
 */
function ScheduleLessonRouteContent() {
  const { assignment } = useLocalSearchParams<{ assignment?: string }>();
  return <ScheduleLessonFlow assignmentId={assignment || undefined} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ScheduleLessonRoute() {
  return (
    <FeatureGate set="tutoring">
      <ScheduleLessonRouteContent />
    </FeatureGate>
  );
}

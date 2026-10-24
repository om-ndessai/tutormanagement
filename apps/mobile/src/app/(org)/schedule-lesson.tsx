import { ScheduleLessonFlow } from '@/features/schedules/schedule-lesson-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Schedule a standing weekly lesson as a step flow (UI upgrades U5): Who, When, From when, Where,
 * then a Review said as a sentence. Editing one stays the sheet (`/schedule-form?id=`).
 */
function ScheduleLessonRouteContent() {
  return <ScheduleLessonFlow />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ScheduleLessonRoute() {
  return (
    <FeatureGate set="tutoring">
      <ScheduleLessonRouteContent />
    </FeatureGate>
  );
}

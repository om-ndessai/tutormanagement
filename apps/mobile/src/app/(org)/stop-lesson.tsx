import { StopLessonSheet } from '@/features/teaching/stop-lesson-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** End the reader's live lesson and record it, with optional notes, as a form sheet. */
function StopLessonRouteContent() {
  return <StopLessonSheet />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function StopLessonRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <StopLessonRouteContent />
    </FeatureGate>
  );
}

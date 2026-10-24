import { ReviewAssessmentScreen } from '@/features/canvas-assessments/review-assessment-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** The tutor reviews a submitted assessment online (Phase 40): the student's tutors and the admins. */
function ReviewAssessmentRouteContent() {
  return <ReviewAssessmentScreen />;
}

/** Phase 50: only where Assessment is on here; otherwise the calm "Not part of this space". */
export default function ReviewAssessmentRoute() {
  return (
    <FeatureGate set="assessment">
      <ReviewAssessmentRouteContent />
    </FeatureGate>
  );
}

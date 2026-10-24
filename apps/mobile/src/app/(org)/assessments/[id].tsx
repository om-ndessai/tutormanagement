import { TakeAssessmentScreen } from '@/features/canvas-assessments/take-assessment-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Taking an assessment: one question per page, written by hand (Phase 38). */
function TakeAssessmentRouteContent() {
  return <TakeAssessmentScreen />;
}

/** Phase 50: only where Assessment is on here; otherwise the calm "Not part of this space". */
export default function TakeAssessmentRoute() {
  return (
    <FeatureGate set="assessment">
      <TakeAssessmentRouteContent />
    </FeatureGate>
  );
}

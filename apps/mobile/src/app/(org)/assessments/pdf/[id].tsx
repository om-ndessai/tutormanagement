import { AssessmentPdfScreen } from '@/features/canvas-assessments/assessment-pdf-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * An assessment's PDF, shown in the app: the submitted one for the student's tutors and the admins
 * (Phase 38), or with `?kind=reviewed` the reviewed one for the student's whole audience (Phase 40).
 */
function AssessmentPdfRouteContent() {
  return <AssessmentPdfScreen />;
}

/** Phase 50: only where Assessment is on here; otherwise the calm "Not part of this space". */
export default function AssessmentPdfRoute() {
  return (
    <FeatureGate set="assessment">
      <AssessmentPdfRouteContent />
    </FeatureGate>
  );
}

import { AssessmentsScreen } from '@/features/canvas-assessments/assessments-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** The Assessment menu (Phase 38, beta): start one, and the list. */
function AssessmentsRouteContent() {
  return <AssessmentsScreen />;
}

/** Phase 50: only where Assessment is on here; otherwise the calm "Not part of this space". */
export default function AssessmentsRoute() {
  return (
    <FeatureGate set="assessment">
      <AssessmentsRouteContent />
    </FeatureGate>
  );
}

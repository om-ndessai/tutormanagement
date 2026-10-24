import { AddTutorFlow } from '@/features/users/add-tutor-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Add a tutor (UI upgrades U3): a step flow. Admin only. */
function AddTutorRouteContent() {
  return <AddTutorFlow fromWizard={false} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AddTutorRoute() {
  return (
    <FeatureGate set="tutoring">
      <AddTutorRouteContent />
    </FeatureGate>
  );
}

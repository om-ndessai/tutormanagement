import { PairingsScreen } from '@/features/teaching/pairings-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Which tutor teaches which student (`?focus=<assignment>` narrows to one). */
function PairingsRouteContent() {
  return <PairingsScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function PairingsRoute() {
  return (
    <FeatureGate set="tutoring">
      <PairingsRouteContent />
    </FeatureGate>
  );
}

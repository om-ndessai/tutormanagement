import { SessionsScreen } from '@/features/teaching/sessions-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

function SessionsRouteContent() {
  return <SessionsScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function SessionsRoute() {
  return (
    <FeatureGate set="tutoring">
      <SessionsRouteContent />
    </FeatureGate>
  );
}

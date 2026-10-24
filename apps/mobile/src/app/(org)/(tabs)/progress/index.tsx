import { ProgressScreen } from '@/features/progress/progress-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Every student the reader may follow (`?student=`, `?tutor=` narrow it). */
function ProgressRouteContent() {
  return <ProgressScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ProgressRoute() {
  return (
    <FeatureGate set="tutoring">
      <ProgressRouteContent />
    </FeatureGate>
  );
}

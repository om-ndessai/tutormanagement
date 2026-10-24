import { useLocalSearchParams } from 'expo-router';

import { AssessSessionSheet } from '@/features/teaching/assess-session-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** The reader's own assessment of one lesson, as a form sheet (`?session=<id>`). */
function AssessSessionRouteContent() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <AssessSessionSheet sessionId={session} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AssessSessionRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <AssessSessionRouteContent />
    </FeatureGate>
  );
}

import { useLocalSearchParams } from 'expo-router';

import { ReflectionSheet } from '@/features/teaching/reflection-form';
import { FeatureGate } from '@/features/shell/feature-gate';

/** The student's reflection on one lesson, as a form sheet (`?session=<id>`). */
function ReflectionRouteContent() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <ReflectionSheet sessionId={session} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ReflectionRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <ReflectionRouteContent />
    </FeatureGate>
  );
}

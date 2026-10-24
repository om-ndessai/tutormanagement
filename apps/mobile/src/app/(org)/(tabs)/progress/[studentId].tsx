import { useLocalSearchParams } from 'expo-router';

import { StudentProgressScreen } from '@/features/progress/student-progress-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** One student's assessment, plan and progress. */
function StudentProgressRouteContent() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  return <StudentProgressScreen studentId={studentId} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function StudentProgressRoute() {
  return (
    <FeatureGate set="tutoring">
      <StudentProgressRouteContent />
    </FeatureGate>
  );
}

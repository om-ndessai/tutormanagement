import { useLocalSearchParams } from 'expo-router';

import { PlanFormSheet } from '@/features/progress/plan-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Set a student's learning plan (`?student=`), or edit one (`&id=`), as a form sheet. Admin only. */
function PlanFormRouteContent() {
  const { student, id } = useLocalSearchParams<{ student: string; id?: string }>();
  return <PlanFormSheet studentId={student} planId={id} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function PlanFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <PlanFormRouteContent />
    </FeatureGate>
  );
}

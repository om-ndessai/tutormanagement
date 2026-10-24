import { useLocalSearchParams } from 'expo-router';

import { AssessmentFormSheet } from '@/features/progress/assessment-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Assess a student (`?student=`), or edit an assessment (`&id=`), as a form sheet. Admin only. */
function AssessmentFormRouteContent() {
  const { student, id } = useLocalSearchParams<{ student: string; id?: string }>();
  return <AssessmentFormSheet studentId={student} assessmentId={id} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AssessmentFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <AssessmentFormRouteContent />
    </FeatureGate>
  );
}

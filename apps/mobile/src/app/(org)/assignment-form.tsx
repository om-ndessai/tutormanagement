import { useLocalSearchParams } from 'expo-router';

import { AssignmentFormSheet } from '@/features/teaching/assignment-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Pair a tutor with a student, or edit a pairing (`?id=<assignment>`), as a form sheet. `?student=`
 * or `?tutor=` preset one side of a new pairing (the welcome wizard). Admins only.
 */
function AssignmentFormRouteContent() {
  const { id, student, tutor } = useLocalSearchParams<{ id?: string; student?: string; tutor?: string }>();
  return (
    <AssignmentFormSheet
      assignmentId={id}
      preset={student || tutor ? { student_user_id: student, tutor_user_id: tutor } : undefined}
    />
  );
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AssignmentFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <AssignmentFormRouteContent />
    </FeatureGate>
  );
}

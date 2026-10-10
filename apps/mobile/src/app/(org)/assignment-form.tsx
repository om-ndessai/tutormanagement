import { useLocalSearchParams } from 'expo-router';

import { AssignmentFormSheet } from '@/features/teaching/assignment-form-sheet';

/**
 * Pair a tutor with a student, or edit a pairing (`?id=<assignment>`), as a form sheet. `?student=`
 * or `?tutor=` preset one side of a new pairing (the welcome wizard). Admins only.
 */
export default function AssignmentFormRoute() {
  const { id, student, tutor } = useLocalSearchParams<{ id?: string; student?: string; tutor?: string }>();
  return (
    <AssignmentFormSheet
      assignmentId={id}
      preset={student || tutor ? { student_user_id: student, tutor_user_id: tutor } : undefined}
    />
  );
}

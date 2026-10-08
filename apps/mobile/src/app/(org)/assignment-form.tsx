import { useLocalSearchParams } from 'expo-router';

import { AssignmentFormSheet } from '@/features/teaching/assignment-form-sheet';

/** Pair a tutor with a student, or edit a pairing (`?id=<assignment>`), as a form sheet. Admins only. */
export default function AssignmentFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AssignmentFormSheet assignmentId={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { AssessmentFormSheet } from '@/features/progress/assessment-form-sheet';

/** Assess a student (`?student=`), or edit an assessment (`&id=`), as a form sheet. Admin only. */
export default function AssessmentFormRoute() {
  const { student, id } = useLocalSearchParams<{ student: string; id?: string }>();
  return <AssessmentFormSheet studentId={student} assessmentId={id} />;
}

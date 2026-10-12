import { useLocalSearchParams } from 'expo-router';

import { PlanFormSheet } from '@/features/progress/plan-form-sheet';

/** Set a student's learning plan (`?student=`), or edit one (`&id=`), as a form sheet. Admin only. */
export default function PlanFormRoute() {
  const { student, id } = useLocalSearchParams<{ student: string; id?: string }>();
  return <PlanFormSheet studentId={student} planId={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { StudentProgressScreen } from '@/features/progress/student-progress-screen';

/** One student's assessment, plan and progress. */
export default function StudentProgressRoute() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  return <StudentProgressScreen studentId={studentId} />;
}

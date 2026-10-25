import { useLocalSearchParams } from 'expo-router';

import { AddStudentFlow } from '@/features/users/add-student-flow';

/** Add a student, family first (UI upgrades U3): a step flow. Admin only. */
export default function AddStudentRoute() {
  // `?guardian=me` (Phase 52): the reader is the family, chosen on the first step.
  const { guardian } = useLocalSearchParams<{ guardian?: string }>();
  return <AddStudentFlow fromWizard={false} guardian={guardian} />;
}

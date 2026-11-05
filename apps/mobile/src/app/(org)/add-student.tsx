import { useLocalSearchParams } from 'expo-router';

import { AddStudentFlow } from '@/features/users/add-student-flow';

/** Add a student, family first (UI upgrades U3): a step flow. Admin only. */
export default function AddStudentRoute() {
  // `?guardian=me` (Phase 52): the reader is the family, chosen on the first step. `?guardian=<id>&guardianName=`
  // (UI audit JF1): a parent just let in, from the Let in sheet.
  const { guardian, guardianName } = useLocalSearchParams<{ guardian?: string; guardianName?: string }>();
  return <AddStudentFlow fromWizard={false} guardian={guardian} guardianName={guardianName} />;
}

import { Stack, useLocalSearchParams } from 'expo-router';

import { AddStudentFlow } from '@/features/users/add-student-flow';

/**
 * The Add a student flow inside the welcome wizard's own stack (UI upgrades U3): pushed over the wizard
 * rather than beneath its full-screen modal, and closed back to the wizard on success.
 */
export default function OnboardingAddStudent() {
  // `?guardian=me` (Phase 52, "This is my child"): the reader is the family, chosen on the first step.
  const { guardian } = useLocalSearchParams<{ guardian?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <AddStudentFlow fromWizard guardian={guardian} />
    </>
  );
}

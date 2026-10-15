import { Stack } from 'expo-router';

import { AddStudentFlow } from '@/features/users/add-student-flow';

/**
 * The Add a student flow inside the welcome wizard's own stack (UI upgrades U3): pushed over the wizard
 * rather than beneath its full-screen modal, and closed back to the wizard on success.
 */
export default function OnboardingAddStudent() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <AddStudentFlow fromWizard />
    </>
  );
}

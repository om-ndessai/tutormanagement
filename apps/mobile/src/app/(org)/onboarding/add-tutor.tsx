import { Stack } from 'expo-router';

import { AddTutorFlow } from '@/features/users/add-tutor-flow';

/**
 * The Add a tutor flow inside the welcome wizard's own stack (UI upgrades U3): pushed over the wizard
 * rather than beneath its full-screen modal, and closed back to the wizard on success.
 */
export default function OnboardingAddTutor() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <AddTutorFlow fromWizard />
    </>
  );
}

import { Stack } from 'expo-router';

import { AddTutorFlow } from '@/features/users/add-tutor-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * The Add a tutor flow inside the welcome wizard's own stack (UI upgrades U3): pushed over the wizard
 * rather than beneath its full-screen modal, and closed back to the wizard on success.
 */
function OnboardingAddTutorContent() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <AddTutorFlow fromWizard />
    </>
  );
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function OnboardingAddTutor() {
  return (
    <FeatureGate set="tutoring">
      <OnboardingAddTutorContent />
    </FeatureGate>
  );
}

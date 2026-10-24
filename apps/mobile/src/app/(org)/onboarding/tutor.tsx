import { TutorFlow } from '@/features/onboarding/tutor-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function OnboardingTutorRoute() {
  return (
    <FeatureGate set="tutoring">
      <TutorFlow />
    </FeatureGate>
  );
}

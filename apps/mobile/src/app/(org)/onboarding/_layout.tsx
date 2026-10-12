import { WizardLayout } from '@/features/onboarding/wizard-layout';

/** The welcome wizard (#34): a full-screen modal with its own stack. Opened deep, Back reaches the start. */
export const unstable_settings = { initialRouteName: 'index' };

export default function OnboardingLayout() {
  return <WizardLayout />;
}

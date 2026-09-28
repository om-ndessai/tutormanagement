import { useMutation } from '@tanstack/react-query';
import type { ApiOk, OnboardingState, TourOutcome } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

/** Records that the person finished or skipped the wizard. The first outcome is kept. */
export function useFinishTour() {
  const { setOnboarding } = useAuth();

  return useMutation({
    mutationFn: (outcome: TourOutcome) =>
      apiClient.post<ApiOk<OnboardingState>>('/onboarding/tour', { outcome }),
    onSuccess: (response) => setOnboarding(response.data),
  });
}

/** The person says the office has their details right. */
export function useConfirmDetails() {
  const { setOnboarding } = useAuth();

  return useMutation({
    mutationFn: () => apiClient.post<ApiOk<OnboardingState>>('/onboarding/confirm-details'),
    onSuccess: (response) => setOnboarding(response.data),
  });
}

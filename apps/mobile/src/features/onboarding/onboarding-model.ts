// The welcome wizard's decisions, kept pure so they can be tested without a device.
import type { OnboardingState, UserRole } from '@tmi/shared';

/** The role whose dashboard someone sees first, when the dashboard has not said. */
export function primaryRole(roles: readonly UserRole[]): UserRole {
  for (const role of ['admin', 'tutor', 'parent', 'student'] as const) {
    if (roles.includes(role)) return role;
  }
  return 'student';
}

export type OnboardingDecision = 'wizard' | 'offer' | 'none';

/**
 * What to do once we know who this is (the web provider's first effect): the wizard opens by
 * itself for somebody who has never been through it; somebody who has, on a device that has not
 * shown it, is only offered the tour. Never while an admin is viewing somebody else's dashboard.
 */
export function decideOnboarding({
  onboarding,
  deviceSeen,
  viewingAs,
}: {
  onboarding: OnboardingState;
  deviceSeen: boolean;
  viewingAs: boolean;
}): OnboardingDecision {
  if (viewingAs) return 'none';
  if (!onboarding.tour_finished_at) return 'wizard';
  if (!deviceSeen) return 'offer';
  return 'none';
}

/** Where the wizard goes back to after the tour it started: an admin's start, anyone else's details. */
export function screenAfterTour(isAdmin: boolean): 'welcome' | 'confirm' {
  return isAdmin ? 'welcome' : 'confirm';
}

// The welcome wizard's decisions, kept pure so they can be tested without a device.
import type { OnboardingState, UserRole } from '@tmi/shared';

/**
 * The role whose dashboard someone sees first, when the dashboard has not said. A member (no role, Phase 79) counts as
 * a learner: their home is the learner's, and no tour is offered them (`tourOffered(org, [])`), so its steps never run.
 */
export function primaryRole(roles: readonly UserRole[]): UserRole {
  for (const role of ['admin', 'tutor', 'parent', 'student'] as const) {
    if (roles.includes(role)) return role;
  }
  return 'student';
}

export type OnboardingDecision = 'wizard' | 'none';

/**
 * What to do once we know who this is (the web provider's first effect): the wizard opens by
 * itself for somebody who has never been through it. Phase 74 (JF25): once per PERSON -- the server's
 * `tour_finished_at` decides, so a new device offers nothing to somebody who has. Never while an admin
 * is viewing somebody else's dashboard.
 */
export function decideOnboarding({
  onboarding,
  viewingAs,
}: {
  onboarding: Pick<OnboardingState, 'tour_finished_at'>;
  viewingAs: boolean;
}): OnboardingDecision {
  if (viewingAs) return 'none';
  return onboarding.tour_finished_at ? 'none' : 'wizard';
}

/** Where the wizard goes back to after the tour it started: an admin's start, anyone else's details. */
export function screenAfterTour(isAdmin: boolean): 'welcome' | 'confirm' {
  return isAdmin ? 'welcome' : 'confirm';
}

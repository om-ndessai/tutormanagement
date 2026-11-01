// Ported from apps/web/src/features/organizations/{org-switcher,invitation-banner}.tsx @ f96b984 (the
// working tree's Phase 60): the pure parts, so they can be tested.

/** "1 invitation waiting", "2 invitations waiting" (the web switcher's words). */
export function invitationsWaiting(count: number): string {
  return count === 1 ? '1 invitation waiting' : `${count} invitations waiting`;
}

/**
 * "Not now" on the invitation banner hides it for this app session only (S6): kept in memory, so a
 * relaunch -- or signing out and in -- shows it again. The web keeps it per tab in sessionStorage.
 */
let bannerDismissed = false;

export function invitationBannerDismissed(): boolean {
  return bannerDismissed;
}

export function dismissInvitationBanner(): void {
  bannerDismissed = true;
}

/** Signing out forgets "Not now" (the next person, or the next sign-in, sees the banner). */
export function resetInvitationBanner(): void {
  bannerDismissed = false;
}

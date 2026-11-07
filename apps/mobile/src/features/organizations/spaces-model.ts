// Ported from apps/web/src/features/organizations/{org-switcher,invitation-banner}.tsx @ f96b984 (the
// working tree's Phase 60): the pure parts, so they can be tested. Phase 72's words (UI audit JF12, JF33) from
// {org-switcher,invitation-banner,spaces-page}.tsx @ 98c40ab, working tree. Phase 79 (M6; spaces-page.tsx, working
// tree): roles read through shared `rolesLabel`, so a member's space says "Member", never an empty line.
import { rolesLabel, type Invitation, type Membership } from '@tmi/shared';

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

/** A space's line under its name: its roles there, or "Just you" for a space of one's own (UI audit JF33). */
export function membershipLine(m: Pick<Membership, 'roles' | 'personal'>): string {
  return m.personal ? 'Just you' : rolesLabel(m.roles);
}

/** The account sheet's line for a space: "You are here" on the current one, its roles on the others; "Just you" first on one's own. */
export function accountSpaceLine(m: Pick<Membership, 'roles' | 'personal'>, current: boolean): string {
  if (m.personal) return current ? 'Just you · You are here' : 'Just you';
  return current ? 'You are here' : membershipLine(m);
}

/** An invitation's line (JF12): "Invited as Parent by Ines", without "by" when nobody recorded invited them. */
export function invitedAsLine(invite: Pick<Invitation, 'roles' | 'invited_by_first_name'>): string {
  // An invitation with no role (Phase 79, M3) is to join as a member.
  const roles = invite.roles.length > 0 ? rolesLabel(invite.roles) : 'a member';
  return `Invited as ${roles}${invite.invited_by_first_name ? ` by ${invite.invited_by_first_name}` : ''}`;
}

/** The banner's words (JF12): "Ines invited you to <space>", else "You are invited to <space>". */
export function invitationBannerLine(invite: Pick<Invitation, 'name' | 'invited_by_first_name'>): string {
  return invite.invited_by_first_name
    ? `${invite.invited_by_first_name} invited you to ${invite.name}`
    : `You are invited to ${invite.name}`;
}

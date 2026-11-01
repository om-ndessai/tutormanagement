/**
 * Phase 61 (S12): a space just started in this tab opens on "Invite people", before the welcome
 * tour. The mark is the tab's own (sessionStorage), carried across the reload into the space, and
 * read once. Without storage (a private window) the step is simply skipped: the same rows are on
 * People -> Add person.
 */
const KEY = 'tmi_invite_step';

export function markInviteStep(slug: string): void {
  try {
    sessionStorage.setItem(KEY, slug);
  } catch {
    // No storage: no step.
  }
}

/**
 * Whether this tab just started `slug`. Read, not taken: the portal's frame may mount more than once
 * while a tab arrives, so the mark stays until the step is left (`clearInviteStep`).
 */
export function hasInviteStep(slug: string | null | undefined): boolean {
  if (!slug) return false;
  try {
    return sessionStorage.getItem(KEY) === slug;
  } catch {
    return false;
  }
}

/** The step was left -- Skip, Continue or closing the wizard: it never opens again in this tab. */
export function clearInviteStep(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // No storage: nothing to clear.
  }
}

// Ported from apps/web/src/features/organizations/invite-step.ts (Phase 61, working tree on f96b984).
//
// S12: a space just started on this device opens on "Invite people", before the welcome wizard's
// start. The web keeps the mark in the tab's sessionStorage; the app's equivalent of a tab is this
// run of the app, so the mark is held in memory: never persisted, gone on a restart (the same rows
// are on People -> Add person).
let pending: string | null = null;

export function markInviteStep(slug: string): void {
  pending = slug;
}

/** Whether this run just started `slug`. Read, not taken: cleared when the step is left. */
export function hasInviteStep(slug: string | null | undefined): boolean {
  return Boolean(slug) && pending === slug;
}

/** The step was left -- Skip, Continue or closing the wizard: it never opens again in this run. */
export function clearInviteStep(): void {
  pending = null;
}

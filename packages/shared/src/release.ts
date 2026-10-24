/**
 * The newest phase of `docs/plan.md` this build includes. The app shows it in small text on its
 * sign-in and Account screens (owner, 2026-10-24), so a phone's build can be matched to the plan.
 * Raised by every phase's release, with the phase's own code.
 */
export const RELEASE_PHASE = 49;

/** "Phase 49": what the app prints. */
export function releaseLabel(phase: number = RELEASE_PHASE): string {
  return `Phase ${phase}`;
}

import { z } from 'zod';

import { featureOn, type FeatureState } from './features.js';

// ---------------------------------------------------------------------------
// Onboarding (Phase 26)
// ---------------------------------------------------------------------------
// A welcome wizard and feature tour, opened by itself the first time a person
// signs in. The database remembers that they have been through it, per
// person; a cookie remembers the device, so a browser that has not seen it
// offers the tour rather than opening it.

/** Whether the signed-in person has been through the wizard. Their own only. */
export interface OnboardingState {
  /** When they first finished or skipped it; null until they have. */
  tour_finished_at: string | null;
  /** When they confirmed the office has their details right, if they have. */
  details_confirmed_at: string | null;
}

export const TOUR_OUTCOMES = ['completed', 'skipped'] as const;
export type TourOutcome = (typeof TOUR_OUTCOMES)[number];

export const finishTourSchema = z.object({ outcome: z.enum(TOUR_OUTCOMES) });
export type FinishTourPayload = z.output<typeof finishTourSchema>;

/**
 * The cookie a browser keeps once it has shown the wizard or its offer. Read
 * by the page itself, so not HttpOnly, and it carries nothing but "seen".
 */
export const TOUR_COOKIE = 'tmi_tour_seen';

/**
 * Whether a space offers the welcome wizard's tour and "Getting started" (owner, 2026-11-04): only where
 * Tutoring is on -- the tour walks through pairings, lessons and billing. Elsewhere the home itself is the
 * start. A just-started space's "Invite people" step is not the tour and is offered anyway.
 */
export function tourOffered(org: Partial<FeatureState> | null | undefined, roles?: readonly string[]): boolean {
  // Phase 79 (M6): a member (no role) is here to play; the tour walks the teaching pages their menu leaves out.
  // Older callers pass no roles.
  return featureOn(org, 'tutoring') && (roles === undefined || roles.length > 0);
}

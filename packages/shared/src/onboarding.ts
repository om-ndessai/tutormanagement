import { z } from 'zod';

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

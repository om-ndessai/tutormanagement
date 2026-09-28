import type { OnboardingState, TourOutcome } from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const NOT_YET: OnboardingState = { tour_finished_at: null, details_confirmed_at: null };

/** Whether this person has been through the welcome wizard. No row is "not yet". */
export async function getOnboarding(db: D1Database, userId: string): Promise<OnboardingState> {
  const row = await db
    .prepare('SELECT tour_finished_at, details_confirmed_at FROM user_onboarding WHERE user_id = ?')
    .bind(userId)
    .first<OnboardingState>();

  return row ?? NOT_YET;
}

/**
 * Records that the person has been through the wizard. The FIRST outcome is
 * kept: taking the tour again from the dashboard later is not a new fact.
 * Returns whether this was the first time.
 */
export async function finishTour(
  db: D1Database,
  userId: string,
  outcome: TourOutcome,
): Promise<{ first: boolean }> {
  const result = await db
    .prepare(
      `INSERT INTO user_onboarding (user_id, tour_finished_at, tour_outcome)
       VALUES (?, ${NOW}, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         tour_finished_at = COALESCE(user_onboarding.tour_finished_at, excluded.tour_finished_at),
         tour_outcome     = COALESCE(user_onboarding.tour_outcome, excluded.tour_outcome),
         updated_at       = ${NOW}
       WHERE user_onboarding.tour_finished_at IS NULL`,
    )
    .bind(userId, outcome)
    .run();

  return { first: Boolean(result.meta.changes) };
}

/** Records that the person confirmed the office has their details right. */
export async function confirmDetails(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_onboarding (user_id, details_confirmed_at) VALUES (?, ${NOW})
       ON CONFLICT (user_id) DO UPDATE SET details_confirmed_at = ${NOW}, updated_at = ${NOW}`,
    )
    .bind(userId)
    .run();
}

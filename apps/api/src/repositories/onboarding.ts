import type { OnboardingState, TourOutcome } from '@tmi/shared';
import type { OrgId } from '../lib/org.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const NOT_YET: OnboardingState = { tour_finished_at: null, details_confirmed_at: null };

/**
 * Whether this person has been through the welcome wizard (per person), and
 * whether they confirmed THIS organization has their details right (per
 * organization: each office keeps its own). No row is "not yet".
 */
export async function getOnboarding(
  db: D1Database,
  org: OrgId | null,
  userId: string,
): Promise<OnboardingState> {
  const [tour, member] = await db.batch<{ tour_finished_at?: string | null; details_confirmed_at?: string | null }>([
    db.prepare('SELECT tour_finished_at FROM user_onboarding WHERE user_id = ?').bind(userId),
    db
      .prepare('SELECT details_confirmed_at FROM org_members WHERE organization_id = ? AND user_id = ?')
      .bind(org ?? '', userId),
  ]);

  return {
    ...NOT_YET,
    tour_finished_at: tour?.results?.[0]?.tour_finished_at ?? null,
    details_confirmed_at: member?.results?.[0]?.details_confirmed_at ?? null,
  };
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

/** Records that the person confirmed this organization has their details right. */
export async function confirmDetails(db: D1Database, org: OrgId, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE org_members SET details_confirmed_at = ${NOW}, updated_at = ${NOW}
       WHERE organization_id = ? AND user_id = ?`,
    )
    .bind(org, userId)
    .run();
}

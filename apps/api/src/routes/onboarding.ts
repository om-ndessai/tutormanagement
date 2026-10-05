import { Hono } from 'hono';
import { finishTourSchema, type ApiOk, type OnboardingState } from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { zValidator } from '../lib/validate.js';
import { confirmDetails, finishTour, getOnboarding } from '../repositories/onboarding.js';

/**
 * The welcome wizard's own state (Phase 26). Every route acts on the signed-in
 * person and nobody else: there is no id to point at somebody else's.
 */
export const onboardingRoutes = new Hono<AppEnv>()

  /** Finished or skipped the wizard. Recorded once; later re-takes change nothing. */
  .post('/tour', zValidator('json', finishTourSchema), async (c) => {
    const viewer = c.get('user');
    const org = c.get('org').id;
    const { outcome } = c.req.valid('json');

    const { first } = await finishTour(c.env.DB, viewer.id, outcome);
    if (first) {
      await recordAudit(c.env.DB, viewer, org, {
        action: 'onboarding.tour_finished',
        description: outcome === 'completed' ? 'Completed the portal tour' : 'Skipped the portal tour',
        entity_type: 'user',
        entity_id: viewer.id,
      });
    }

    const body: ApiOk<OnboardingState> = { data: await getOnboarding(c.env.DB, org, viewer.id) };
    return c.json(body);
  })

  /**
   * The person looked at their record and says the office has it right. Only
   * an admin edits a record; a correction goes to the office as a comment.
   */
  .post('/confirm-details', async (c) => {
    const viewer = c.get('user');
    const org = c.get('org').id;

    await confirmDetails(c.env.DB, org, viewer.id);
    await recordAudit(c.env.DB, viewer, org, {
      action: 'user.details_confirmed',
      description: 'Confirmed their details are correct',
      subject: { id: viewer.id, full_name: viewer.full_name },
      entity_type: 'user',
      entity_id: viewer.id,
    });

    const body: ApiOk<OnboardingState> = { data: await getOnboarding(c.env.DB, org, viewer.id) };
    return c.json(body);
  });

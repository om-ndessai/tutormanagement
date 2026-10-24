import { createMiddleware } from 'hono/factory';
import { FEATURE_SET_LABELS, FEATURE_UNAVAILABLE, featureOn, type FeatureSet } from '@tmi/shared';

import { ApiError } from '../lib/errors.js';
import type { AppEnv } from '../types.js';

/**
 * Phase 50: a route group that belongs to a feature set answers 403
 * `feature_unavailable` wherever the set is off -- not allowed by the platform
 * or, for Assessment and Quest, switched off by the space's admins (R23).
 * Mounted after `requireOrg`, so `c.get('org')` is the space the request names.
 */
export function requireFeature(set: FeatureSet) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!featureOn(c.get('org'), set)) {
      throw new ApiError(403, FEATURE_UNAVAILABLE, `${FEATURE_SET_LABELS[set]} is not part of this space.`);
    }
    return next();
  });
}

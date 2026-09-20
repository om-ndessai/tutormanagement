import { createMiddleware } from 'hono/factory';
import { hasRole } from '@tmi/shared';
import { ApiError } from '../lib/errors.js';
import type { AppEnv } from '../types.js';

/**
 * "Only [admins] can add a new user into the system." -- docs/plan.md.
 *
 * Mounted after `requireAuth`, so `c.get('user')` is the live, re-read record:
 * demoting someone takes effect on their next request, not whenever their
 * cookie expires.
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');

  if (!hasRole(user, 'admin')) {
    throw new ApiError(403, 'forbidden', 'Only an administrator can make this change.');
  }

  return next();
});

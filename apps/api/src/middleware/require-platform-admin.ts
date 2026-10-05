import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors.js';
import type { AppEnv } from '../types.js';

/**
 * The platform console: creating organizations and their admins. Mounted
 * after `requireAuth`, which re-reads platform-admin standing on every
 * request. Nothing behind it reads an organization's teaching or money.
 */
export const requirePlatformAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('platformAdmin')) {
    throw new ApiError(403, 'forbidden', 'Only a platform administrator can do this.');
  }
  return next();
});

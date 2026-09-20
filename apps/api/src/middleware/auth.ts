import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors.js';
import { SESSION_COOKIE, readSessionToken } from '../lib/session.js';
import {
  createBootstrapAdmin,
  getFirstAdmin,
  getFirstLiveUser,
  getLiveUserByEmail,
  getLiveUserById,
} from '../repositories/users.js';
import { isAuthEnabled, type AppEnv } from '../types.js';

/**
 * Gate for every route that touches portal data.
 *
 * The session cookie carries only a user id, so the user row is re-read here on
 * each request. That is what makes deactivation and suspension take effect
 * immediately even though sessions are stateless.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!isAuthEnabled(c.env)) {
    // Lets the end-to-end suite act as each kind of user without redeploying
    // between roles. Only read while auth is off -- a deployment in that state
    // is already fully open, so this grants nothing that was not already
    // available.
    const requested = c.req.header(DEV_USER_HEADER)?.trim();
    const user = await resolveBypassUser(c.env, requested);
    c.set('user', user);
    c.set('impersonated', true);
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  }

  const { sub } = await readSessionToken(token, c.env.SESSION_SECRET);
  const user = await getLiveUserById(c.env.DB, sub);

  // Deleted between requests, or the row was rebuilt out from under the cookie.
  if (!user) {
    throw new ApiError(401, 'unauthenticated', 'Your account is no longer active.');
  }

  if (user.status === 'suspended') {
    throw new ApiError(403, 'account_suspended', 'Your account has been suspended.');
  }

  c.set('user', user);
  c.set('impersonated', false);
  return next();
});

/** Placeholder identity created when the directory is empty. */
const FALLBACK_DEV_EMAIL = 'portal-admin@trianglemathinstitute.com';

/**
 * Names the user to act as while AUTH_ENABLED is "false". Honoured only in
 * that state; ignored entirely on a deployment with sign-in switched on.
 */
export const DEV_USER_HEADER = 'X-Dev-User';

/**
 * Identity used while AUTH_ENABLED is "false", so later phases can be built and
 * tested without signing in.
 *
 * Resolution order: DEV_USER_EMAIL, then the first admin, then anyone at all,
 * and finally a placeholder admin created on the spot.
 *
 * That last step matters because this project rebuilds its database from
 * scratch by design (see docs/plan.md). Without it, every `db:rebuild` leaves
 * the portal with nobody to run as and the whole app dead on a 503 — which is
 * exactly what happened. Switching auth off must never be able to take the
 * portal down.
 *
 * Only reachable while AUTH_ENABLED is "false", so it cannot create an admin on
 * a secured deployment.
 */
async function resolveBypassUser(env: AppEnv['Bindings'], requestedEmail?: string) {
  // A per-request override beats the deployment-wide setting.
  if (requestedEmail) {
    const requested = await getLiveUserByEmail(env.DB, requestedEmail);

    if (!requested) {
      throw new ApiError(
        404,
        'not_found',
        `No live user matches the requested ${DEV_USER_HEADER} address (${requestedEmail}).`,
      );
    }

    return requested;
  }

  const configured = env.DEV_USER_EMAIL?.trim();

  if (configured) {
    const named = await getLiveUserByEmail(env.DB, configured);
    if (named) return named;
  }

  const admin = await getFirstAdmin(env.DB);
  if (admin) return admin;

  // An existing non-admin is still better than inventing someone.
  const anyone = await getFirstLiveUser(env.DB);
  if (anyone) return anyone;

  console.warn('AUTH_ENABLED=false and the users table is empty; creating a placeholder admin.');

  return createBootstrapAdmin(env.DB, {
    email: configured || FALLBACK_DEV_EMAIL,
    full_name: 'Portal Admin (auth disabled)',
    google_sub: null,
  });
}

import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors.js';
import { SESSION_COOKIE, readSessionToken } from '../lib/session.js';
import { getFirstAdmin, getLiveUserByEmail, getLiveUserById } from '../repositories/users.js';
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
    const user = await resolveBypassUser(c.env);
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

/**
 * Identity used while AUTH_ENABLED is "false", so later phases can be built and
 * tested without signing in. DEV_USER_EMAIL wins; otherwise the first admin.
 */
async function resolveBypassUser(env: AppEnv['Bindings']) {
  const configured = env.DEV_USER_EMAIL?.trim();

  const user = configured
    ? await getLiveUserByEmail(env.DB, configured)
    : await getFirstAdmin(env.DB);

  if (!user) {
    throw new ApiError(
      503,
      'internal_error',
      configured
        ? `AUTH_ENABLED is false but no live user matches DEV_USER_EMAIL (${configured}).`
        : 'AUTH_ENABLED is false but the users table has no admin to run as. Run `npm run db:seed`.',
    );
  }

  return user;
}

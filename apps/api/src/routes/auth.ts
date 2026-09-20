import { Hono } from 'hono';
import {
  googleSignInSchema,
  type ApiOk,
  type AuthConfig,
  type SessionResponse,
} from '@tmi/shared';

import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { verifyGoogleIdToken, type GoogleIdentity } from '../lib/google.js';
import {
  clearedSessionCookie,
  createSessionToken,
  sessionCookie,
} from '../lib/session.js';
import { zValidator } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  countAdmins,
  createBootstrapAdmin,
  getLiveUserByEmail,
  recordSignIn,
} from '../repositories/users.js';
import { isAuthEnabled, isProduction, type AppEnv, type Env } from '../types.js';

/** Parses the comma-separated BOOTSTRAP_ADMIN_EMAILS var. */
function bootstrapEmails(env: Env): string[] {
  return (env.BOOTSTRAP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export const authRoutes = new Hono<AppEnv>()

  /**
   * Public. The SPA calls this before rendering anything so it knows which
   * Google client id to use and whether to show a login screen at all. Keeping
   * it server-side means the client id is configured once, in wrangler.jsonc,
   * and changing it needs no rebuild.
   */
  .get('/config', (c) => {
    const enabled = isAuthEnabled(c.env);

    const body: ApiOk<AuthConfig> = {
      data: {
        google_client_id: enabled ? c.env.GOOGLE_CLIENT_ID : null,
        auth_enabled: enabled,
      },
    };
    return c.json(body);
  })

  /**
   * Public. Exchanges a Google ID token for a session cookie.
   *
   * The token is the only thing the browser supplies, and it is verified
   * against Google's public keys before any of its claims are believed.
   */
  .post('/google', zValidator('json', googleSignInSchema), async (c) => {
    if (!isAuthEnabled(c.env)) {
      throw ApiError.badRequest('Authentication is disabled on this deployment.');
    }

    const { credential } = c.req.valid('json');
    const identity = await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID);

    let user = await getLiveUserByEmail(c.env.DB, identity.email);

    if (!user) {
      user = await bootstrapOrReject(c.env, identity);
    } else {
      if (user.status === 'suspended') {
        throw new ApiError(
          403,
          'account_suspended',
          'Your account has been suspended. Contact an administrator.',
        );
      }

      try {
        user = (await recordSignIn(c.env.DB, user.id, identity.sub)) ?? user;
      } catch (error) {
        // The Google account is already pinned to a different live user row.
        if (isUniqueConstraintError(error)) {
          throw new ApiError(
            409,
            'conflict',
            'That Google account is already linked to another user.',
          );
        }
        throw error;
      }
    }

    const token = await createSessionToken(user.id, c.env.SESSION_SECRET);
    c.header('Set-Cookie', sessionCookie(token, isProduction(c.env)));

    const body: ApiOk<SessionResponse> = { data: { user, impersonated: false } };
    return c.json(body);
  })

  /** Who am I? The SPA calls this on load to restore an existing session. */
  .get('/session', requireAuth, (c) => {
    const body: ApiOk<SessionResponse> = {
      data: { user: c.get('user'), impersonated: c.get('impersonated') },
    };
    return c.json(body);
  })

  .post('/logout', (c) => {
    c.header('Set-Cookie', clearedSessionCookie(isProduction(c.env)));
    return c.body(null, 204);
  });

/**
 * A verified Google account with no matching user row. Normally that is a
 * rejection -- admins create users, people do not self-register.
 *
 * The one exception is the very first sign-in on a fresh database, when there
 * is no admin to create anyone. While that is true, an email listed in
 * BOOTSTRAP_ADMIN_EMAILS may create itself as admin. The window closes as soon
 * as one admin exists.
 */
async function bootstrapOrReject(env: Env, identity: GoogleIdentity) {
  const allowed = bootstrapEmails(env);

  if (allowed.includes(identity.email) && (await countAdmins(env.DB)) === 0) {
    return createBootstrapAdmin(env.DB, {
      email: identity.email,
      full_name: identity.name?.trim() || identity.email,
      google_sub: identity.sub,
    });
  }

  throw new ApiError(
    403,
    'no_account',
    'No portal account matches that Google address. Ask an administrator to add you.',
  );
}

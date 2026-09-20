import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from './errors.js';

export const SESSION_COOKIE = 'tmi_session';

/** How long a sign-in lasts before the user has to click the Google button again. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

const ISSUER = 'tmi-portal';

/**
 * The session is a stateless HMAC-signed token: there is no sessions table.
 *
 * It carries *identity only* — the user id. Role and status are deliberately
 * left out and re-read from D1 on every request, so deactivating or suspending
 * someone takes effect immediately instead of waiting out their cookie.
 */
interface SessionClaims {
  /** users.id */
  sub: string;
}

function keyFrom(secret: string): Uint8Array {
  if (!secret || secret.length < 32) {
    // A weak or missing secret means anyone could mint a session cookie, so
    // this is a hard failure rather than a warning. It is an ApiError, not a
    // bare Error, so it reaches the operator as an actionable message instead
    // of a generic 500 -- this exact misconfiguration is easy to ship and
    // otherwise gives no clue what is wrong.
    throw new ApiError(
      503,
      'not_configured',
      'Sign-in is unavailable: this deployment has no valid SESSION_SECRET. ' +
        'Set one with `wrangler secret put SESSION_SECRET` (32+ characters). ' +
        'See docs/google-oauth-setup.md.',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(keyFrom(secret));
}

export async function readSessionToken(token: string, secret: string): Promise<SessionClaims> {
  // Resolved before the try, so a missing secret surfaces as the configuration
  // error it is rather than being reported as an expired session.
  const key = keyFrom(secret);

  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER });

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('Session token has no subject.');
    }

    return { sub: payload.sub };
  } catch {
    throw new ApiError(401, 'unauthenticated', 'Your session has expired. Please sign in again.');
  }
}

/**
 * `Secure` is omitted outside production because the dev server runs on plain
 * http://localhost, where a Secure cookie would be silently dropped.
 */
export function sessionCookie(token: string, isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (isProduction) parts.push('Secure');

  return parts.join('; ');
}

export function clearedSessionCookie(isProduction: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];

  if (isProduction) parts.push('Secure');

  return parts.join('; ');
}

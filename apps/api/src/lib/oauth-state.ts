import { SignJWT, jwtVerify } from 'jose';
import type { AuthProvider } from '@tmi/shared';

import { ApiError } from './errors.js';

/**
 * Phase 55: the web's redirect sign-in (Microsoft, Apple, Facebook). `/start`
 * sends the browser to the provider with a random `state` and `nonce`, and
 * keeps them -- with whether the page can sign a newcomer up, and, when
 * linking, who is signed in -- in a short cookie signed with the session secret
 * under its own issuer (it can never pass for a session). The callback accepts
 * only a provider answer carrying that same state, from that same browser.
 *
 * SameSite=None: Microsoft and Apple answer with a cross-site POST (form_post),
 * on which a Lax cookie is not sent. Secure always (browsers allow it on
 * http://localhost). HttpOnly, ten minutes, one path.
 */
export const OAUTH_COOKIE = 'tmi_oauth';
const ISSUER = 'aimtrue-oauth';
const TTL_SECONDS = 10 * 60;

export interface OAuthState {
  provider: AuthProvider;
  state: string;
  nonce: string;
  /** The page can show sign-up (Phase 52). */
  signup: boolean;
  /** Linking another way in to the person signed in at /start; null for a sign-in. */
  linkUserId: string | null;
  /** Where to send the browser afterwards: a path on this site only. */
  returnTo: string;
}

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new ApiError(503, 'not_configured', 'Sign-in is unavailable on this deployment.');
  return new TextEncoder().encode(secret);
}

/** 32 random bytes, URL-safe. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Only a path on this site: never an absolute URL, never `//elsewhere`. */
export function safeReturnTo(value: string | undefined | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

export async function stateCookie(claims: OAuthState, secret: string, provider: AuthProvider): Promise<string> {
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key(secret));
  return `${OAUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=None; Path=/api/auth/${provider}; Max-Age=${TTL_SECONDS}`;
}

export function clearedStateCookie(provider: AuthProvider): string {
  return `${OAUTH_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/api/auth/${provider}; Max-Age=0`;
}

/** The kept state, if the cookie is genuine, fresh, for this provider and matches the answer's `state`. */
export async function readState(
  cookie: string | undefined,
  answeredState: string | undefined,
  provider: AuthProvider,
  secret: string,
): Promise<OAuthState> {
  const refuse = () => new ApiError(401, 'unauthenticated', 'That sign-in took too long or came from elsewhere. Try again.');
  if (!cookie || !answeredState) throw refuse();
  try {
    const { payload } = await jwtVerify(cookie, key(secret), { issuer: ISSUER });
    const claims = payload as unknown as OAuthState;
    if (claims.provider !== provider || claims.state !== answeredState) throw new Error('mismatch');
    return {
      provider: claims.provider,
      state: claims.state,
      nonce: claims.nonce,
      signup: Boolean(claims.signup),
      linkUserId: claims.linkUserId ?? null,
      returnTo: safeReturnTo(claims.returnTo),
    };
  } catch {
    throw refuse();
  }
}

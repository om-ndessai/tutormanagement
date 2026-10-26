import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { isAppleRelayEmail } from '@tmi/shared';

import { ApiError } from './errors.js';
import type { VerifiedIdentity } from './verified-identity.js';

/**
 * Phase 55: Sign in with Apple. Built, and off until the owner's paid Apple
 * Developer Program account exists (AUTH_PROVIDERS lists it only then; the app's
 * button is behind EXPO_PUBLIC_APPLE_SIGN_IN).
 *
 * The ID token is checked against Apple's keys; its audience is the Services ID
 * (the web) or one of the app's bundle ids (the native button). Apple sends the
 * email on every token but the name only the first time, from the client, so it
 * is stored then. A "Hide my email" relay address reaches the person but is no
 * evidence of who they are: it never matches an invitation or an account.
 */
/** The slice of the Worker's config Apple's flow reads (the Worker's Env satisfies it). */
interface Env {
  APPLE_SERVICES_ID?: string;
  APPLE_BUNDLE_IDS?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
}

const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'), { cacheMaxAge: 10 * 60 * 1000 });
const ISSUER = 'https://appleid.apple.com';

/** The audiences this Worker accepts: the Services ID and each bundle id. */
export function appleAudiences(env: Env): string[] {
  return [env.APPLE_SERVICES_ID, ...(env.APPLE_BUNDLE_IDS ?? '').split(',')]
    .map((value) => (value ?? '').trim())
    .filter(Boolean);
}

/** Apple writes booleans as strings in some tokens. */
function truthy(value: unknown): boolean {
  return value === true || value === 'true';
}

export async function verifyAppleIdToken(
  token: string,
  audiences: string[],
  options: { nonce?: string; name?: string | null; keys?: JWTVerifyGetKey } = {},
): Promise<VerifiedIdentity> {
  if (audiences.length === 0) throw new ApiError(503, 'not_configured', 'Sign in with Apple is not set up here.');
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, options.keys ?? JWKS, {
      issuer: ISSUER,
      audience: audiences,
      clockTolerance: 30,
    }));
    if (options.nonce !== undefined && payload.nonce !== options.nonce) throw new Error('nonce');
  } catch (error) {
    console.error('Apple ID token rejected', error);
    throw new ApiError(401, 'unauthenticated', 'That Apple sign-in could not be verified.');
  }
  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  if (!subject) throw new ApiError(401, 'unauthenticated', 'Apple did not say who signed in.');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() || null : null;
  const relay = truthy(payload.is_private_email) || isAppleRelayEmail(email);
  return {
    provider: 'apple',
    subject,
    email,
    // A relay address is deliverable (Apple verified it), so a newcomer may sign up with it; it is
    // never MATCHED to an account or an invitation (mayLinkByEmail, invitedMatch), being no
    // evidence of who the person is.
    emailVerified: Boolean(email) && (truthy(payload.email_verified) || relay),
    name: options.name?.trim() || null,
  };
}

/** The web's redirect flow: a code and an ID token posted back to our callback, with the name the first time. */
export function appleAuthorizeUrl(input: { servicesId: string; redirectUri: string; state: string; nonce: string }): string {
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id', input.servicesId);
  url.searchParams.set('response_type', 'code id_token');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  return url.toString();
}

/** The name Apple's form_post carries the first time, as JSON in `user`. Display only. */
export function appleNameFromForm(user: string | undefined): string | null {
  if (!user) return null;
  try {
    const parsed = JSON.parse(user) as { name?: { firstName?: string; lastName?: string } };
    const name = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ').trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Whether this Worker can talk to Apple's token endpoint (exchange and revoke): the paid team's key. */
export function appleSecretConfigured(env: Env): boolean {
  return Boolean(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
}

/** Apple's "client secret": an ES256 JWT signed with the team's key, good for a few minutes. */
async function clientSecret(env: Env, clientId: string): Promise<string> {
  const key = await importPKCS8(env.APPLE_PRIVATE_KEY!, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(clientId)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/**
 * Exchanges a sign-in's authorization code for Apple's refresh token, kept only
 * so it can be revoked when the person deletes their account (Apple's rule).
 * Null when the key is not configured or Apple refuses: sign-in does not depend on it.
 */
export async function exchangeAppleCode(env: Env, code: string, clientId: string, redirectUri?: string): Promise<string | null> {
  if (!appleSecretConfigured(env)) return null;
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: await clientSecret(env, clientId),
      code,
      grant_type: 'authorization_code',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    const response = await fetch(`${ISSUER}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { refresh_token?: string };
    return json.refresh_token ?? null;
  } catch (error) {
    console.error('Apple code exchange failed', error);
    return null;
  }
}

/** Revokes a refresh token at Apple, on account deletion. Best effort: a failure is logged, not thrown. */
export async function revokeAppleToken(env: Env, refreshToken: string, clientId: string): Promise<boolean> {
  if (!appleSecretConfigured(env)) return false;
  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: await clientSecret(env, clientId),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });
    const response = await fetch(`${ISSUER}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return response.ok;
  } catch (error) {
    console.error('Apple token revoke failed', error);
    return false;
  }
}

/**
 * Apple's server-to-server notice (consent withdrawn, account deleted, email
 * changes): a JWT signed by Apple in `payload`. Returns the account and the event.
 */
export async function verifyAppleNotification(
  payloadToken: string,
  audiences: string[],
  keys?: JWTVerifyGetKey,
): Promise<{ subject: string; type: string } | null> {
  try {
    const { payload } = await jwtVerify(payloadToken, keys ?? JWKS, { issuer: ISSUER, audience: audiences });
    const events = typeof payload.events === 'string' ? (JSON.parse(payload.events) as { type?: string; sub?: string }) : null;
    if (!events?.sub || !events.type) return null;
    return { subject: events.sub, type: events.type };
  } catch (error) {
    console.error('Apple notification rejected', error);
    return null;
  }
}

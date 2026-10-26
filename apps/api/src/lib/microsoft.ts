import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { ApiError } from './errors.js';
import type { VerifiedIdentity } from './verified-identity.js';

/**
 * Phase 55: Microsoft accounts -- personal (Outlook, Hotmail, Xbox) and work or
 * school (Entra ID), through one app registration for "personal and
 * work/school accounts" (the `common` endpoint).
 *
 * The ID token is checked against Microsoft's published keys, its audience
 * (our client id) and an issuer of the form
 * `https://login.microsoftonline.com/{tid}/v2.0`, where `tid` is the token's
 * own tenant. The person is `tid:oid` -- never the email, which a work or
 * school tenant's own admins can set to anything (the "nOAuth" class of bug).
 */
const JWKS = createRemoteJWKSet(new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'), {
  cacheMaxAge: 10 * 60 * 1000,
});

/** The tenant every personal Microsoft account signs in through. */
export const MICROSOFT_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

const TENANT_ID = /^[0-9a-f-]{36}$/i;

/**
 * Whether the token's email can be believed. Personal accounts: Microsoft
 * verified the address. Work or school: only where Microsoft says the tenant
 * owns the domain (`xms_edov`, an optional claim the app registration asks for).
 */
export function microsoftEmailVerified(payload: JWTPayload): boolean {
  if (payload.tid === MICROSOFT_CONSUMER_TENANT) return true;
  return payload.xms_edov === true || payload.xms_edov === 'true' || payload.xms_edov === 1;
}

/** Verifies a Microsoft ID token. `keys` is for tests (a local key pair standing in for Microsoft's). */
export async function verifyMicrosoftIdToken(
  token: string,
  clientId: string,
  options: { nonce?: string; keys?: JWTVerifyGetKey } = {},
): Promise<VerifiedIdentity> {
  let payload: JWTPayload;
  try {
    // The issuer names the token's own tenant, so read it first and then require exactly it.
    const unverified = decodeJwt(token);
    const tid = typeof unverified.tid === 'string' && TENANT_ID.test(unverified.tid) ? unverified.tid : null;
    if (!tid) throw new Error('no tenant');
    ({ payload } = await jwtVerify(token, options.keys ?? JWKS, {
      issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
      audience: clientId,
      clockTolerance: 30,
    }));
    if (payload.tid !== tid) throw new Error('tenant changed');
    if (options.nonce !== undefined && payload.nonce !== options.nonce) throw new Error('nonce');
  } catch (error) {
    console.error('Microsoft ID token rejected', error);
    throw new ApiError(401, 'unauthenticated', 'That Microsoft sign-in could not be verified.');
  }

  const oid = typeof payload.oid === 'string' ? payload.oid : '';
  if (!oid) throw new ApiError(401, 'unauthenticated', 'Microsoft did not say who signed in.');

  const raw =
    typeof payload.email === 'string'
      ? payload.email
      : typeof payload.preferred_username === 'string' && payload.preferred_username.includes('@')
        ? payload.preferred_username
        : '';
  const email = raw.trim().toLowerCase() || null;

  return {
    provider: 'microsoft',
    subject: `${payload.tid}:${oid}`,
    email,
    emailVerified: Boolean(email) && microsoftEmailVerified(payload),
    name: typeof payload.name === 'string' ? payload.name.trim() || null : null,
  };
}

/** The authorize URL for the web's redirect flow: an ID token posted back to our callback. */
export function microsoftAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; nonce: string }): string {
  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('response_type', 'id_token');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

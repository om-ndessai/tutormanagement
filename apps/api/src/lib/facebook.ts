import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { ApiError } from './errors.js';
import type { VerifiedIdentity } from './verified-identity.js';

/**
 * Phase 55: Facebook Login -- the one Meta sign-in (Instagram's consumer login,
 * the Basic Display API, was retired in December 2024).
 *
 * Classic login hands the client an ACCESS token, which says nothing on its
 * own: the Worker asks Graph's `debug_token` whether it is valid and was issued
 * to OUR app (a token for any other app must not sign anybody in), then reads
 * `/me` with it. On iOS, Limited Login returns an OpenID token instead, checked
 * against Meta's keys. Either way the person is the app-scoped id. Meta confirms
 * an address before it releases it, so a returned email counts as verified; it
 * may return none.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';
const LIMITED_JWKS = createRemoteJWKSet(new URL('https://limited.facebook.com/.well-known/oauth/openid/jwks/'), {
  cacheMaxAge: 10 * 60 * 1000,
});
const LIMITED_ISSUERS = ['https://www.facebook.com', 'https://limited.facebook.com'];

type Fetch = typeof fetch;

export async function verifyFacebookAccessToken(
  accessToken: string,
  appId: string,
  appSecret: string,
  fetcher: Fetch = fetch,
): Promise<VerifiedIdentity> {
  const refuse = () => new ApiError(401, 'unauthenticated', 'That Facebook sign-in could not be verified.');
  let userId: string;
  try {
    const debug = new URL(`${GRAPH}/debug_token`);
    debug.searchParams.set('input_token', accessToken);
    debug.searchParams.set('access_token', `${appId}|${appSecret}`);
    const checked = (await (await fetcher(debug.toString())).json()) as {
      data?: { app_id?: string; is_valid?: boolean; user_id?: string; expires_at?: number };
    };
    const data = checked.data;
    if (!data?.is_valid || data.app_id !== appId || !data.user_id) throw new Error('not ours, or not valid');
    if (data.expires_at && data.expires_at * 1000 < Date.now()) throw new Error('expired');
    userId = data.user_id;
  } catch (error) {
    console.error('Facebook access token rejected', error);
    throw refuse();
  }

  const me = new URL(`${GRAPH}/me`);
  me.searchParams.set('fields', 'id,name,email');
  me.searchParams.set('access_token', accessToken);
  const profile = (await (await fetcher(me.toString())).json()) as { id?: string; name?: string; email?: string };
  if (profile.id !== userId) throw refuse();
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() || null : null;
  return {
    provider: 'facebook',
    subject: userId,
    email,
    emailVerified: Boolean(email),
    name: profile.name?.trim() || null,
  };
}

/** iOS Limited Login's OpenID token. `keys` is for tests. */
export async function verifyFacebookLimitedToken(
  token: string,
  appId: string,
  options: { nonce?: string; keys?: JWTVerifyGetKey } = {},
): Promise<VerifiedIdentity> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, options.keys ?? LIMITED_JWKS, {
      issuer: LIMITED_ISSUERS,
      audience: appId,
      clockTolerance: 30,
    }));
    if (options.nonce !== undefined && payload.nonce !== options.nonce) throw new Error('nonce');
  } catch (error) {
    console.error('Facebook Limited Login token rejected', error);
    throw new ApiError(401, 'unauthenticated', 'That Facebook sign-in could not be verified.');
  }
  const subject = typeof payload.sub === 'string' ? payload.sub : '';
  if (!subject) throw new ApiError(401, 'unauthenticated', 'Facebook did not say who signed in.');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() || null : null;
  return {
    provider: 'facebook',
    subject,
    email,
    emailVerified: Boolean(email),
    name: typeof payload.name === 'string' ? payload.name.trim() || null : null,
  };
}

/** The web's redirect flow: a code, exchanged on the Worker with the app secret. */
export function facebookAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', input.appId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'public_profile,email');
  return url.toString();
}

/** Exchanges the web flow's code for an access token (needs the app secret, so only on the Worker). */
export async function exchangeFacebookCode(
  code: string,
  input: { appId: string; appSecret: string; redirectUri: string },
  fetcher: Fetch = fetch,
): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set('client_id', input.appId);
  url.searchParams.set('client_secret', input.appSecret);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('code', code);
  const json = (await (await fetcher(url.toString())).json()) as { access_token?: string };
  if (!json.access_token) throw new ApiError(401, 'unauthenticated', 'That Facebook sign-in could not be verified.');
  return json.access_token;
}

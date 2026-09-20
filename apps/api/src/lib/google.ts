import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from './errors.js';

/**
 * Google publishes the public keys for ID tokens here and rotates them
 * regularly. `createRemoteJWKSet` fetches, caches and re-fetches on an unknown
 * key id, so this is created once per isolate rather than per request.
 */
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  cacheMaxAge: 10 * 60 * 1000,
});

/** Both forms Google uses for the `iss` claim. */
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleIdentity {
  /** Google's permanent, unique id for the account. Never reused. */
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verifies an ID token issued by Google Identity Services in the browser.
 *
 * This is the whole security boundary of the sign-in flow: the browser is
 * untrusted, so the token's signature, issuer, audience and expiry are all
 * checked here against Google's published keys. Never trust an email address
 * that did not come out of this function.
 */
export async function verifyGoogleIdToken(
  credential: string,
  clientId: string,
): Promise<GoogleIdentity> {
  let payload;

  try {
    ({ payload } = await jwtVerify(credential, JWKS, {
      issuer: GOOGLE_ISSUERS,
      // Binds the token to THIS application. Without it, a token minted for any
      // other Google app would be accepted.
      audience: clientId,
      // Google ID tokens are short-lived; jose enforces `exp` by default.
      clockTolerance: 30,
    }));
  } catch (error) {
    console.error('Google ID token rejected', error);
    throw new ApiError(401, 'unauthenticated', 'That Google sign-in could not be verified.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';

  if (!sub || !email) {
    throw new ApiError(401, 'unauthenticated', 'Google did not return an email address.');
  }

  // An unverified address could belong to someone else, which would defeat
  // matching users by email.
  if (payload.email_verified !== true) {
    throw new ApiError(
      403,
      'email_unverified',
      'Your Google account’s email address is not verified.',
    );
  }

  return {
    sub,
    email,
    email_verified: true,
    ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
    ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
  };
}

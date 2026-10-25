import { SignJWT, jwtVerify } from 'jose';

import { ApiError } from './errors.js';

/**
 * Phase 52: who Google says a newcomer is, between their sign-in and their age question. Signed
 * with the session secret under its own issuer, so it can never pass for a session, and short:
 * nothing about the person is stored until they answer.
 */
const ISSUER = 'aimtrue-signup';
const TTL_SECONDS = 15 * 60;

export interface SignupClaims {
  sub: string;
  email: string;
  name: string;
}

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new ApiError(503, 'not_configured', 'Sign-up is unavailable on this deployment.');
  return new TextEncoder().encode(secret);
}

export async function createSignupToken(claims: SignupClaims, secret: string): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function readSignupToken(token: string, secret: string): Promise<SignupClaims> {
  const secretKey = key(secret);
  try {
    const { payload } = await jwtVerify(token, secretKey, { issuer: ISSUER });
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('incomplete');
    return { sub: payload.sub, email: payload.email, name: typeof payload.name === 'string' ? payload.name : payload.email };
  } catch {
    throw new ApiError(401, 'unauthenticated', 'That sign-up has expired. Sign in with Google again.');
  }
}

import {
  AUTH_PROVIDER_LABELS,
  parseAuthProviders,
  type AuthProvider,
  type AuthProviderInfo,
} from '@tmi/shared';

import { ApiError } from './errors.js';
import type { Env } from '../types.js';

export type { VerifiedIdentity } from './verified-identity.js';
import type { VerifiedIdentity } from './verified-identity.js';

/** Whether a provider has what it needs on this Worker. */
function configured(env: Env, provider: AuthProvider): boolean {
  switch (provider) {
    case 'google':
      return Boolean(env.GOOGLE_CLIENT_ID);
    case 'microsoft':
      return Boolean(env.MICROSOFT_CLIENT_ID);
    case 'apple':
      return Boolean(env.APPLE_SERVICES_ID || env.APPLE_BUNDLE_IDS);
    case 'facebook':
      return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
  }
}

/** The fake verifier (tests only): never in production, only when switched on. */
export function fakeProvidersOn(env: Env): boolean {
  return env.AUTH_FAKE_PROVIDERS === 'true' && env.ENVIRONMENT !== 'production';
}

/** The providers this Worker offers: listed in AUTH_PROVIDERS (default "google") and configured. */
export function offeredProviders(env: Env): AuthProvider[] {
  return parseAuthProviders(env.AUTH_PROVIDERS).filter(
    (provider) => configured(env, provider) || fakeProvidersOn(env),
  );
}

/** What /api/auth/config tells clients: one entry per offered provider, ids only. */
export function providerInfo(env: Env): AuthProviderInfo[] {
  return offeredProviders(env).map((id) => ({
    id,
    label: AUTH_PROVIDER_LABELS[id],
    client_id:
      id === 'google'
        ? env.GOOGLE_CLIENT_ID || null
        : id === 'microsoft'
          ? env.MICROSOFT_CLIENT_ID || null
          : id === 'facebook'
            ? env.FACEBOOK_APP_ID || null
            : null,
    ...(id === 'apple' ? { services_id: env.APPLE_SERVICES_ID || null } : {}),
  }));
}

/** Refuses a provider this Worker does not offer (404, as for a route that is not there). */
export function assertOffered(env: Env, provider: AuthProvider): void {
  if (!offeredProviders(env).includes(provider)) {
    throw ApiError.notFound(`Signing in with ${AUTH_PROVIDER_LABELS[provider]} is not available here.`);
  }
}

/**
 * The suite's stand-in for every provider (AUTH_FAKE_PROVIDERS, never in
 * production): `fake:<provider>:<subject>:<email or ->:<verified 1|0>[:<name>]`.
 * Lets the local suite walk sign-in, linking, refusal and sign-up for providers
 * it cannot reach.
 */
export function verifyFakeToken(env: Env, provider: AuthProvider, token: string): VerifiedIdentity | null {
  if (!fakeProvidersOn(env) || !token.startsWith('fake:')) return null;
  const [, named, subject, email, verified, ...name] = token.split(':');
  if (named !== provider || !subject) {
    throw new ApiError(401, 'unauthenticated', 'That sign-in could not be verified.');
  }
  return {
    provider,
    subject,
    email: email && email !== '-' ? email.trim().toLowerCase() : null,
    emailVerified: verified === '1',
    name: name.join(':') || null,
  };
}

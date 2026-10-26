import { z } from 'zod';

// ---------------------------------------------------------------------------
// More ways to sign in (Phase 55, docs/social-login-plan.md)
// ---------------------------------------------------------------------------
// Google, Microsoft, Apple and Facebook. Each Worker lists the ones it offers in
// AUTH_PROVIDERS (default "google"), and a provider is offered only while it is
// listed AND configured. One person may have several ways in: a
// `user_identities` row per provider account, never matched by email alone
// except under the three rules in `mayLinkByEmail`. No magic links (owner).

export const AUTH_PROVIDERS = ['google', 'microsoft', 'apple', 'facebook'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
  facebook: 'Facebook',
};

/** What a client needs to draw one provider's button. Ids are public; secrets never leave the Worker. */
export interface AuthProviderInfo {
  id: AuthProvider;
  label: string;
  /** The provider's public client id for this platform, where the client needs it (Google, Microsoft, Facebook). */
  client_id: string | null;
  /** Apple's app id for the native button (the bundle id is the app's own); null elsewhere. */
  services_id?: string | null;
}

/** "google, microsoft" -> the providers listed, in the canonical order, unknown names dropped. */
export function parseAuthProviders(value: string | undefined | null): AuthProvider[] {
  const listed = new Set(
    (value ?? 'google')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
  return AUTH_PROVIDERS.filter((provider) => listed.has(provider));
}

/**
 * A sign-in token from a provider's own SDK or flow, as a client sends it.
 * `id_token` for Google (as `credential` on the older route), Microsoft and
 * Apple, and Facebook's Limited Login on iOS; `access_token` for Facebook's
 * classic login. Apple gives a name only the first time, so the client passes
 * it along then.
 */
export const providerSignInSchema = z
  .object({
    id_token: z.string().min(1).max(8192).optional(),
    access_token: z.string().min(1).max(4096).optional(),
    /** Apple's first sign-in only: the name the person shared. Never trusted for anything but display. */
    name: z.string().trim().max(120).optional(),
    /** Apple's first sign-in only, from the native flow: the authorization code, for revoking later. */
    authorization_code: z.string().min(1).max(2048).optional(),
    /** Phase 52: this client can sign a newcomer up. */
    signup: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.id_token || value.access_token), {
    message: 'Missing the sign-in token.',
    path: ['id_token'],
  });
export type ProviderSignInInput = z.input<typeof providerSignInSchema>;

/** One of the reader's own ways in, as My profile lists it. Never the provider's id for them. */
export interface UserIdentity {
  provider: AuthProvider;
  /** The address the provider gave when it was linked; may be a relay address, or none. */
  email_at_link: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** An Apple "Hide my email" address: it reaches the person, but says nothing about who they are. */
export function isAppleRelayEmail(email: string | null | undefined): boolean {
  return Boolean(email && /@privaterelay\.appleid\.com$/i.test(email.trim()));
}

/**
 * The three rules for joining a new provider account to an existing person by
 * email (today's `pinnedToAnother` rule, for every provider): the provider says
 * the address is verified; it is not an Apple relay address; and that person
 * has no account from that provider yet.
 */
export function mayLinkByEmail(input: {
  emailVerified: boolean;
  email: string | null;
  personHasProvider: boolean;
}): boolean {
  return input.emailVerified && Boolean(input.email) && !isAppleRelayEmail(input.email) && !input.personHasProvider;
}

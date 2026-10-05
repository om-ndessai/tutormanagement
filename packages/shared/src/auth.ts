import { z } from 'zod';
import type { ApiErrorCode } from './api.js';
import type { Brand } from './brand.js';
import type { Invitation, Membership, Organization, OrganizationSettings } from './organizations.js';
import type { OnboardingState } from './onboarding.js';
import type { User } from './users.js';

/**
 * Public configuration the SPA needs before it can render a sign-in button.
 * Served by the Worker rather than baked in at build time, so the Google client
 * id and the auth switch live in exactly one place (wrangler.jsonc).
 */
export interface AuthConfig {
  /** Google OAuth web client id, or null when auth is switched off. */
  google_client_id: string | null;
  /** False while AUTH_ENABLED is "false"; the SPA then skips the login screen. */
  auth_enabled: boolean;
  /**
   * The identity the sign-in page wears: the organization this browser last
   * chose (the tmi_last_org cookie), or the neutral platform brand.
   */
  brand: Brand;
}

/** The signed-in user, plus how they got here. */
/** The user record as returned to the signed-in person about themselves. */
export type SessionUser = User;

export interface SessionResponse {
  user: SessionUser;
  /** True when this identity came from the AUTH_ENABLED=false bypass. */
  impersonated: boolean;
  /**
   * Whether this person has been through the welcome wizard (Phase 26). Only
   * ever their own, so the page can decide at once whether to open it.
   */
  onboarding: OnboardingState;
  /**
   * The organization this request named (X-Organization), when the person is
   * an active member of it; null while choosing, or on the platform console.
   * Payer details are included for its admins only.
   */
  organization: (Organization & { settings: OrganizationSettings | null }) | null;
  /** Every organization the person may enter. */
  memberships: Membership[];
  /** Organizations waiting for the person to accept or decline. */
  invitations: Invitation[];
  /** Whether the person may use the platform console. */
  platform_admin: boolean;
}

/** Body of POST /api/auth/google — the ID token from Google Identity Services. */
export const googleSignInSchema = z.object({
  credential: z.string().min(1, 'Missing Google credential.').max(4096),
});

export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

/**
 * Sign-in failures the UI renders differently from a generic error. They arrive
 * as the `code` on the standard error envelope.
 */
export const AUTH_ERROR_CODES = {
  /** Google account is valid, but no live user row has that email. */
  NO_ACCOUNT: 'no_account',
  /** Matching user exists but is suspended. */
  ACCOUNT_SUSPENDED: 'account_suspended',
  /** The request named no organization, or one the person may not enter. */
  ORGANIZATION_REQUIRED: 'organization_required',
  /** Google says the address is unverified. */
  EMAIL_UNVERIFIED: 'email_unverified',
  /** No session cookie, or it failed verification. */
  UNAUTHENTICATED: 'unauthenticated',
} as const satisfies Record<string, ApiErrorCode>;

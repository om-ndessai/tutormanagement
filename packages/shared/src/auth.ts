import { z } from 'zod';
import type { ApiErrorCode } from './api.js';
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
}

/** The signed-in user, plus how they got here. */
/** The user record as returned to the signed-in person about themselves. */
export type SessionUser = User;

export interface SessionResponse {
  user: SessionUser;
  /** True when this identity came from the AUTH_ENABLED=false bypass. */
  impersonated: boolean;
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
  /** Google says the address is unverified. */
  EMAIL_UNVERIFIED: 'email_unverified',
  /** No session cookie, or it failed verification. */
  UNAUTHENTICATED: 'unauthenticated',
} as const satisfies Record<string, ApiErrorCode>;

import type { User } from '@tmi/shared';

/**
 * Bindings declared in wrangler.jsonc, plus secrets set with `wrangler secret`.
 * Keep this in sync with that file -- `npm run cf-typegen` can regenerate a
 * fuller version if the bindings grow.
 */
export interface Env {
  /** D1 database holding the portal's data. */
  DB: D1Database;
  /** Static assets for the built React SPA. Bound in production deploys. */
  ASSETS: Fetcher;
  ENVIRONMENT: string;

  /** Google OAuth web client id. Public -- it is sent to the browser. */
  GOOGLE_CLIENT_ID: string;
  /** "true" | "false". See wrangler.jsonc. */
  AUTH_ENABLED: string;
  /** Identity used by every request while AUTH_ENABLED is "false". */
  DEV_USER_EMAIL: string;
  /** Comma-separated emails allowed to self-provision while no admin exists. */
  BOOTSTRAP_ADMIN_EMAILS: string;

  /**
   * SECRET. HMAC key for session cookies, >= 32 characters.
   * Set with `wrangler secret put SESSION_SECRET`; locally it comes from
   * apps/api/.dev.vars.
   */
  SESSION_SECRET: string;
}

export interface AppVariables {
  /**
   * The authenticated user. Set by the auth middleware, so it is always present
   * inside a guarded route and never present outside one.
   */
  user: User;
  /** True when `user` came from the AUTH_ENABLED=false bypass. */
  impersonated: boolean;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}

export function isProduction(env: Env): boolean {
  return env.ENVIRONMENT === 'production';
}

export function isAuthEnabled(env: Env): boolean {
  // Anything other than an explicit "false" leaves auth on, so a typo in the
  // config cannot silently open the API up.
  return env.AUTH_ENABLED !== 'false';
}

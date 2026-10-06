import type { User } from '@tmi/shared';
import type { OrgContext } from './lib/org.js';
import type { Person } from './repositories/people.js';

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
  /**
   * The organization this address is for (a slug, or ""): its sign-in page
   * wears it, and a member of it lands in it without choosing. It picks; the
   * membership check still decides.
   */
  DEFAULT_ORGANIZATION?: string;
  /** Identity used by every request while AUTH_ENABLED is "false". */
  DEV_USER_EMAIL: string;
  /** Comma-separated emails that become platform admins while there is none. */
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
   * The signed-in PERSON, across every organization: identity only. Set by
   * `requireAuth`.
   */
  person: Person;
  /** Whether the person may use the platform console. Set by `requireAuth`. */
  platformAdmin: boolean;
  /**
   * The person as a member of the request's organization: `roles` and
   * `status` are theirs IN THAT organization. Set by `requireOrg`, so it is
   * always present inside an organization route and never outside one.
   */
  user: User;
  /** The organization the request named and the person may enter. */
  org: OrgContext;
  /** True when the person came from the AUTH_ENABLED=false bypass. */
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

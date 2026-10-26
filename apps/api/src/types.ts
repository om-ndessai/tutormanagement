import type { User } from '@tmi/shared';
import type { OrgContext } from './lib/org.js';
import type { Person } from './repositories/people.js';
import type { QuestGame } from './durable/quest-game.js';
import type { RateLimiter } from './durable/rate-limiter.js';

/**
 * Bindings declared in wrangler.jsonc, plus secrets set with `wrangler secret`.
 * Keep this in sync with that file -- `npm run cf-typegen` can regenerate a
 * fuller version if the bindings grow.
 */
export interface Env {
  /** D1 database holding the portal's data. */
  DB: D1Database;
  /**
   * Phase 46: Quest Games, one Durable Object per game, named
   * `<organization>:<game id>` (durable/quest-game.ts). Bound on every Worker.
   */
  QUEST_GAMES: DurableObjectNamespace<QuestGame>;
  /** Phase 51: request limits, one object per key (durable/rate-limiter.ts). */
  RATE_LIMITS: DurableObjectNamespace<RateLimiter>;
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
  /** Phase 52: "false" keeps sign-up closed (production, until the owner approves the terms). */
  SIGNUP_OPEN?: string;
  /** Phase 53: "true" on the test Worker only -- sign-in admits only the people on invited_users. */
  SIGNIN_ALLOWLIST?: string;
  /**
   * Phase 53: a secret on the TEST Worker only. With sign-in on, a request carrying it in
   * X-Automation-Key may act as X-Dev-User -- the seed scripts' way in. Never set in production.
   */
  TEST_AUTOMATION_KEY?: string;
  /**
   * Phase 55 (docs/social-login-plan.md): the ways to sign in this Worker offers, a comma list of
   * google, microsoft, apple, facebook. Unset is "google". A provider is offered only while listed
   * AND configured (lib/identity.ts `offeredProviders`).
   */
  AUTH_PROVIDERS?: string;
  /** Phase 55: Microsoft's application (client) id: an Entra app for personal and work/school accounts. Public. */
  MICROSOFT_CLIENT_ID?: string;
  /** Phase 55: Apple's Services ID (the web's audience). Public. */
  APPLE_SERVICES_ID?: string;
  /** Phase 55: the app's bundle ids Apple's native sign-in may name as audience, comma-separated. Public. */
  APPLE_BUNDLE_IDS?: string;
  /** Phase 55: the paid Apple team id and the Sign in with Apple key's id, for the client secret. */
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  /** SECRET. Phase 55: the Sign in with Apple private key (PKCS#8 PEM), for exchanging and revoking tokens. */
  APPLE_PRIVATE_KEY?: string;
  /** Phase 55: the Meta app id with Facebook Login. Public. */
  FACEBOOK_APP_ID?: string;
  /** SECRET. Phase 55: the Meta app secret, for checking access tokens and exchanging codes. */
  FACEBOOK_APP_SECRET?: string;
  /**
   * Phase 55, LOCAL ONLY: "true" lets the suite sign in "with" any provider using a fake token
   * (`fake:<provider>:<subject>:<email>:<verified>`). Never honoured while ENVIRONMENT is production.
   */
  AUTH_FAKE_PROVIDERS?: string;
  /** Phase 56: Cloudflare Turnstile's site key for the public challenge page. Public. */
  TURNSTILE_SITE_KEY?: string;
  /** SECRET. Phase 56: Turnstile's secret, for Siteverify. Production refuses answers without it. */
  TURNSTILE_SECRET?: string;
  /** Phase 56: Workers Analytics Engine, counting public share views (never D1). Optional. */
  SHARE_VIEWS?: AnalyticsEngineDataset;
  /** Identity used by every request while AUTH_ENABLED is "false". */
  DEV_USER_EMAIL: string;
  /** Comma-separated emails that become platform admins while there is none. */
  BOOTSTRAP_ADMIN_EMAILS: string;

  /**
   * Phase 32: Cloudflare's send_email binding. Bound on the production pair
   * only; without it (local, the demo) every notification is logged `skipped`.
   */
  EMAIL?: SendEmail;
  /** The address notifications come from, on a domain with Email Routing. */
  EMAIL_FROM?: string;
  /** This Worker's own address, for the link in every notification. */
  PUBLIC_URL?: string;

  /**
   * Phase 36, the AI layer (lib/ai/run.ts). "false" stops every model call.
   */
  AI_ENABLED?: string;
  /** `anthropic` or `fake`. Unset: the task's own provider in production, `fake` anywhere else. */
  AI_PROVIDER?: string;
  /** Cloudflare AI Gateway's Anthropic base URL; unset, calls go straight to Anthropic. */
  AI_GATEWAY_URL?: string;
  /** Every task together, cents a month (default 5000). */
  AI_MONTHLY_CAP_CENTS?: string;
  /** SECRET. Anthropic's API key, `wrangler secret put ANTHROPIC_API_KEY`. */
  ANTHROPIC_API_KEY?: string;

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

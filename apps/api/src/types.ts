/**
 * Bindings declared in wrangler.jsonc. Keep this in sync with that file --
 * `npm run cf-typegen` can regenerate a fuller version if the bindings grow.
 */
export interface Env {
  /** D1 database holding the portal's data. */
  DB: D1Database;
  /** Static assets for the built React SPA. Bound in production deploys. */
  ASSETS: Fetcher;
  ENVIRONMENT: string;
}

export interface AppEnv {
  Bindings: Env;
}

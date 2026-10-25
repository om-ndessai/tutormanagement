// ---------------------------------------------------------------------------
// Request limits and daily caps (Phase 51, docs/open-signup-plan.md)
// ---------------------------------------------------------------------------
// Before strangers can sign in, the routes they reach are limited per minute
// (a Durable Object per key, `durable/rate-limiter.ts`) and capped per day (a
// count of the rows they wrote, read from D1). Never D1 for the per-minute
// count: every hit would be a row written against the free plan's daily limit.

/** A fixed window: how many hits it has seen and when it started. */
export interface LimitWindow {
  started: number;
  hits: number;
}

/**
 * One hit against a fixed window of `windowMs`: whether it is allowed, the window after it, and
 * how long until a refused caller may try again. Pure, so the Durable Object and its tests share it.
 */
export function limitHit(
  window: LimitWindow | null,
  now: number,
  limit: number,
  windowMs: number,
): { ok: boolean; window: LimitWindow; retryAfterMs: number } {
  const current = !window || now - window.started >= windowMs ? { started: now, hits: 0 } : window;
  if (current.hits >= limit) {
    return { ok: false, window: current, retryAfterMs: current.started + windowMs - now };
  }
  return { ok: true, window: { started: current.started, hits: current.hits + 1 }, retryAfterMs: 0 };
}

/** The per-minute limits, by what is being done. Keys add who (a person's id or an address). */
export const RATE_LIMITS = {
  /** Google sign-in attempts, per client address. */
  sign_in: { limit: 20, windowMs: 60_000 },
  /** Phase 52: looking a space code up, per person and per client address. */
  space_lookup: { limit: 10, windowMs: 60_000 },
  /** Phase 52: asking to join, making a space, signing up -- per person. */
  space_write: { limit: 5, windowMs: 60_000 },
  /** Adding people to a space, per admin. */
  add_person: { limit: 60, windowMs: 60_000 },
} as const;
export type RateLimitKind = keyof typeof RATE_LIMITS;

/** The daily caps, counted from D1 (indexed). */
export const DAILY_CAPS = {
  /** People added to one space in a day: a platform-made organization, and a self-serve space. */
  people_added_console: 100,
  people_added_self_serve: 20,
  /** Phase 52: spaces one person may make, ever while they live, and open requests to join. */
  spaces_per_person: 3,
  open_join_requests: 5,
} as const;

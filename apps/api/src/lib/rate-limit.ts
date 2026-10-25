import type { Context } from 'hono';
import { RATE_LIMITS, type RateLimitKind } from '@tmi/shared';

import { ApiError } from './errors.js';
import type { AppEnv } from '../types.js';

/** The caller's address as Cloudflare saw it; locally, one shared bucket. */
export function clientAddress(c: Context<AppEnv>): string {
  return c.req.header('CF-Connecting-IP') ?? 'local';
}

/**
 * Phase 51: refuses with 429 `rate_limited` once `who` has done `kind` too often this minute.
 * `who` is a person's id or a client address. Counted in a Durable Object, never in D1.
 */
export async function rateLimit(c: Context<AppEnv>, kind: RateLimitKind, who: string): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[kind];
  const stub = c.env.RATE_LIMITS.get(c.env.RATE_LIMITS.idFromName(`${kind}:${who}`));
  const result = await stub.hit(limit, windowMs);
  if (!result.ok) {
    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    c.header('Retry-After', String(seconds));
    throw new ApiError(429, 'rate_limited', `Too many tries. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`);
  }
}

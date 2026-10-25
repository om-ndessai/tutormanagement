import { DurableObject } from 'cloudflare:workers';
import { limitHit, type LimitWindow } from '@tmi/shared';

import type { Env } from '../types.js';

/**
 * Phase 51: one Durable Object per limited key (`sign_in:203.0.113.7`, `add_person:<user id>`),
 * counting hits in a fixed window in memory. Its one-request-at-a-time rule is what makes the
 * count exact. Memory only, on purpose: if the object is evicted the window starts again, which
 * errs towards letting a person through, and nothing is written to D1 or to storage.
 */
export class RateLimiter extends DurableObject<Env> {
  private window: LimitWindow | null = null;

  hit(limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
    const result = limitHit(this.window, Date.now(), limit, windowMs);
    this.window = result.window;
    return { ok: result.ok, retryAfterMs: result.retryAfterMs };
  }
}

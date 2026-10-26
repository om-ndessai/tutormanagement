import { ApiError } from './errors.js';
import { isProduction, type Env } from '../types.js';

/**
 * Phase 56: Cloudflare Turnstile before a public challenge's answer -- the
 * first page anyone can use signed out. The widget's token is checked with
 * Siteverify against TURNSTILE_SECRET. Away from production a Worker without
 * the secret skips the check (local, the suites); production without it
 * refuses (503), so a missing secret can never open the door.
 */
export async function assertHuman(env: Env, token: string | undefined, ip: string | null): Promise<void> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    if (isProduction(env)) throw new ApiError(503, 'not_configured', 'Answering is unavailable here for now.');
    return;
  }
  if (!token) throw new ApiError(403, 'forbidden', 'Please confirm you are not a robot, then answer.');
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  let ok = false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    ok = Boolean(((await response.json()) as { success?: boolean }).success);
  } catch (error) {
    console.error('Turnstile check failed', error);
  }
  if (!ok) throw new ApiError(403, 'forbidden', 'That check did not pass. Try again.');
}

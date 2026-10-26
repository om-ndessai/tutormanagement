import { NOT_INVITED_MESSAGE, invitedMatch, type InvitedEntry } from '@tmi/shared';

import { ApiError } from './errors.js';
import type { Env } from '../types.js';

/** Whether this Worker admits only invited people (the test portal). Production never is. */
export function allowlistOn(env: Env): boolean {
  return env.SIGNIN_ALLOWLIST === 'true' && env.ENVIRONMENT !== 'production';
}

/**
 * Phase 53: refuses (403 not_invited) a verified sign-in that is not on `invited_users` -- a table
 * only the test database has. The list is short, so it is read whole and matched in code
 * (patterns with `*` and `?`, case ignored). Called only while `allowlistOn`.
 */
export async function assertInvited(
  env: Env,
  who: { email: string | null; googleSub?: string | null; provider?: string | null; subject?: string | null },
): Promise<void> {
  const result = await env.DB.prepare('SELECT email, provider, subject FROM invited_users').all<InvitedEntry>();
  if (!invitedMatch(result.results ?? [], who)) {
    throw new ApiError(403, 'not_invited', NOT_INVITED_MESSAGE);
  }
}

/** Constant-time comparison of two secrets, so a guessed key leaks nothing through timing. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Phase 55: the per-request re-check on the test portal -- the person is still invited by their
 * email or by any of their provider accounts. Taking them off the list ends their access.
 */
export async function assertPersonInvited(
  env: Env,
  person: { id: string; email: string | null },
  accounts: { provider: string; subject: string }[],
): Promise<void> {
  const result = await env.DB.prepare('SELECT email, provider, subject FROM invited_users').all<InvitedEntry>();
  const entries = result.results ?? [];
  const ok =
    invitedMatch(entries, { email: person.email }) ||
    accounts.some((account) => invitedMatch(entries, { email: null, provider: account.provider, subject: account.subject }));
  if (!ok) throw new ApiError(403, 'not_invited', NOT_INVITED_MESSAGE);
}

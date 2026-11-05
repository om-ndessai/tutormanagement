import {
  ACCESS_DECLINED_MESSAGE,
  NOT_ON_LIST_MESSAGE,
  accessPendingMessage,
  invitedMatch,
} from '@tmi/shared';

import { ApiError } from './errors.js';
import { accessListEntries, getAccessSettings } from '../repositories/access.js';

/**
 * Phase 65 (docs/access-approval-plan.md): the two gates of sign-up access.
 *
 * - `assertMaySignUp`: while the mode is Pre-approved, a newcomer not on the platform's list is refused
 *   before anything is stored or logged under their name (A3).
 * - `assertAccess`: a self sign-up that waits, or was declined, is refused at sign-in, at sign-up and on
 *   every request (A4, A5). Everyone else (approved, or added by a space) passes.
 */
export async function assertMaySignUp(
  db: D1Database,
  who: { email: string | null; provider?: string | null; subject?: string | null },
): Promise<void> {
  if ((await getAccessSettings(db)).mode !== 'preapproved') return;
  if (!invitedMatch(await accessListEntries(db), who)) {
    // The account checked travels with the refusal, so the person sees which address was not on the list and
    // can ask for an invitation for it (UI audit JF8, J13).
    throw new ApiError(403, 'not_on_list', NOT_ON_LIST_MESSAGE, who.email ? { email: [who.email] } : undefined);
  }
}

/** Whether a new sign-up waits for approval now: the mode is Post-approved. */
export async function signUpWaits(db: D1Database): Promise<boolean> {
  return (await getAccessSettings(db)).mode === 'postapproved';
}

export function assertAccess(person: { access: string; full_name: string }): void {
  if (person.access === 'pending') throw new ApiError(403, 'access_pending', accessPendingMessage(person.full_name));
  if (person.access === 'declined') throw new ApiError(403, 'access_declined', ACCESS_DECLINED_MESSAGE);
}

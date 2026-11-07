import { DEFAULT_ORG_TIME_ZONE, type Organization } from '@tmi/shared';

import { createSpace } from '../repositories/organizations.js';

/**
 * A space of one's own, "<First name>'s space" (Phase 63, P13): made at sign-up, when an account is approved with
 * no place (Phase 80, A11), or when the person takes up the offer of one (A12). A teen's takes nobody by code.
 * Where they land and what the log says are the caller's.
 */
export async function makePersonalSpace(
  db: D1Database,
  person: { id: string; full_name: string },
  options: { requestUrl: string; teen: boolean },
): Promise<Organization> {
  const firstName = person.full_name.trim().split(/\s+/)[0] || 'My';
  return createSpace(db, {
    name: `${firstName}'s space`,
    timeZone: DEFAULT_ORG_TIME_ZONE,
    makerId: person.id,
    requestHost: new URL(options.requestUrl).hostname || 'aimtrue.invalid',
    personal: true,
    teen: options.teen,
  });
}

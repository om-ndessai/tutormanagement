import type { User } from '@tmi/shared';

import { recordAudit } from './audit.js';
import { ApiError } from './errors.js';
import type { OrgId } from './org.js';
import { forgetLastChoice } from '../repositories/organizations.js';
import { countAdmins, deactivateUser } from '../repositories/users.js';

/**
 * A person leaves a space: their own membership, nobody else's. Its last admin cannot (make
 * another admin first, or delete the space): 409 `last_admin`. Shared by `POST /api/organization/leave`
 * (inside the space, kept for older apps) and Phase 60's `POST /api/spaces/:slug/leave` (from
 * anywhere). Logged in the space left; the answer says nothing about it.
 */
export async function leaveSpace(
  db: D1Database,
  org: { id: OrgId; name: string },
  person: Pick<User, 'id' | 'full_name'>,
  membership: { roles: readonly string[]; status: string },
): Promise<void> {
  // Refused only to an ACTIVE admin when no other active admin remains. A suspended admin is not
  // among the space's live admins, so their leaving cannot take its last one away.
  if (
    membership.status === 'active' &&
    membership.roles.includes('admin') &&
    (await countAdmins(db, org.id, person.id)) === 0
  ) {
    throw new ApiError(
      409,
      'last_admin',
      `You are ${org.name}'s only administrator. Make someone else an administrator first, or delete the space.`,
    );
  }
  await deactivateUser(db, org.id, person.id);
  // A space they have left is nowhere to land.
  await forgetLastChoice(db, org.id, person.id);
  await recordAudit(db, person, org.id, {
    action: 'membership.left',
    description: `${person.full_name} left ${org.name}`,
    subject: { id: person.id, full_name: person.full_name },
    entity_type: 'user',
    entity_id: person.id,
  });
}

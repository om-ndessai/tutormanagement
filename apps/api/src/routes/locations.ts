import { Hono } from 'hono';
import { z } from 'zod';
import {
  LOCATION_KIND_LABELS,
  listLocationsQuerySchema,
  locationInputSchema,
  locationUpdateSchema,
  type ApiList,
  type ApiOk,
  type Location,
  type User,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import type { OrgId } from '../lib/org.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { familyStudentIds, isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import {
  createLocation,
  deleteLocation,
  getLocation,
  listOwnLocations,
  schedulesUsingLocation,
  updateLocation,
} from '../repositories/locations.js';
import { getLiveUserById } from '../repositories/users.js';

// ---------------------------------------------------------------------------
// Locations (Phase 33)
// ---------------------------------------------------------------------------
// A tutor's or a student's own places. Read and written here by the owner, a parent of the
// owner, and the organization's admins (R16); the other party of a pairing sees the ones
// attached to it through the pairing and its schedules, never through this list. An address is
// never written into an audit description.

const idParamSchema = z.object({ id: z.uuid({ message: 'Not a valid location id.' }) });

/** Whether the viewer may read and change this person's own locations. */
async function managesLocationsOf(db: D1Database, org: OrgId, viewer: User, ownerId: string): Promise<boolean> {
  if (isAdmin(viewer)) return true;
  if (viewer.id === ownerId) return viewer.roles.includes('tutor') || viewer.roles.includes('student');
  return (await familyStudentIds(db, org, viewer)).has(ownerId);
}

export const locationsRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', listLocationsQuerySchema), async (c) => {
    const org = c.get('org').id;
    const { user_id } = c.req.valid('query');
    // Somebody else's list reads as empty, never as forbidden: it says nothing about them.
    const data = (await managesLocationsOf(c.env.DB, org, c.get('user'), user_id))
      ? await listOwnLocations(c.env.DB, org, user_id)
      : [];
    const body: ApiList<Location> = { data, meta: { total: data.length, limit: data.length, offset: 0 } };
    return c.json(body);
  })

  .post('/', zValidator('json', locationInputSchema), async (c) => {
    const org = c.get('org').id;
    const viewer = c.get('user');
    const input = c.req.valid('json');

    const owner = await getLiveUserById(c.env.DB, org, input.owner_user_id);
    if (!owner || !(await managesLocationsOf(c.env.DB, org, viewer, owner.id))) {
      throw ApiError.notFound('That person does not exist.');
    }
    if (!owner.roles.includes('tutor') && !owner.roles.includes('student')) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        owner_user_id: [`Only tutors and students have tutoring locations; ${owner.full_name} is neither.`],
      });
    }

    const location = await createLocation(c.env.DB, org, input);
    await recordAudit(c.env.DB, viewer, org, {
      action: 'location.created',
      description: `Added the ${LOCATION_KIND_LABELS[location.kind].toLowerCase()} location "${location.name}" for ${owner.full_name}`,
      subject: { id: owner.id, full_name: owner.full_name },
      entity_type: 'location',
      entity_id: location.id,
    });

    const body: ApiOk<Location> = { data: location };
    return c.json(body, 201);
  })

  .patch('/:id', zValidator('param', idParamSchema), zValidator('json', locationUpdateSchema), async (c) => {
    const org = c.get('org').id;
    const viewer = c.get('user');
    const existing = await getLocation(c.env.DB, org, c.req.valid('param').id);
    if (!existing || !(await managesLocationsOf(c.env.DB, org, viewer, existing.owner_user_id))) {
      throw ApiError.notFound('That location does not exist.');
    }
    const input = c.req.valid('json');
    // A schedule holds at most one location of each kind, so a used location keeps its kind.
    if (input.kind && input.kind !== existing.kind && (await schedulesUsingLocation(c.env.DB, org, existing.id)) > 0) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        kind: ['A schedule uses this location, so it cannot change between in person and online.'],
      });
    }

    const updated = await updateLocation(c.env.DB, org, existing.id, input);
    if (!updated) throw ApiError.notFound('That location does not exist.');
    await recordAudit(c.env.DB, viewer, org, {
      action: 'location.updated',
      description: `Updated the location "${updated.name}" of ${updated.owner_name}`,
      subject: { id: updated.owner_user_id, full_name: updated.owner_name },
      entity_type: 'location',
      entity_id: updated.id,
    });
    const body: ApiOk<Location> = { data: updated };
    return c.json(body);
  })

  .delete('/:id', zValidator('param', idParamSchema), async (c) => {
    const org = c.get('org').id;
    const viewer = c.get('user');
    const existing = await getLocation(c.env.DB, org, c.req.valid('param').id);
    if (!existing || !(await managesLocationsOf(c.env.DB, org, viewer, existing.owner_user_id))) {
      throw ApiError.notFound('That location does not exist.');
    }
    // No schedule is ever left without a place: it has to move first.
    const using = await schedulesUsingLocation(c.env.DB, org, existing.id);
    if (using > 0) {
      throw new ApiError(
        409,
        'conflict',
        `${using === 1 ? 'A schedule uses' : `${using} schedules use`} this location. Choose another location for ${using === 1 ? 'it' : 'them'} first.`,
      );
    }
    await deleteLocation(c.env.DB, org, existing.id);
    await recordAudit(c.env.DB, viewer, org, {
      action: 'location.removed',
      description: `Removed the location "${existing.name}" of ${existing.owner_name}`,
      subject: { id: existing.owner_user_id, full_name: existing.owner_name },
      entity_type: 'location',
      entity_id: existing.id,
    });
    return c.body(null, 204);
  });

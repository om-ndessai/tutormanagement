import { Hono } from 'hono';
import { z } from 'zod';
import {
  LOGO_KINDS,
  MAX_LOGO_BYTES,
  addOrganizationAdminSchema,
  addPlatformAdminSchema,
  createOrganizationSchema,
  platformPersonLookupSchema,
  platformPersonUpdateSchema,
  updateOrganizationSchema,
  type ApiOk,
  type LogoContentType,
  type Organization,
  type OrganizationAdmin,
  type OrganizationListItem,
  type PlatformAdmin,
  type PlatformPerson,
} from '@tmi/shared';

import type { AppEnv, Env } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { orgIdFromRow } from '../lib/org.js';
import { zValidator } from '../lib/validate.js';
import {
  createOrganization,
  deleteLogo,
  ensureMembershipWithRoles,
  getOrganizationById,
  listOrganizationAdmins,
  listOrganizations,
  listPlatformAudit,
  putLogo,
  removeRole,
  setOrganizationArchived,
  updateOrganization,
} from '../repositories/organizations.js';
import {
  addPlatformAdmin,
  countMemberships,
  createPerson,
  getPersonByEmail,
  getPersonById,
  listPlatformAdmins,
  unpinGoogleSub,
  updatePersonFields,
} from '../repositories/people.js';

const orgParamSchema = z.object({ id: z.uuid({ message: 'Not a valid organization id.' }) });
const adminParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid organization id.' }),
  userId: z.uuid({ message: 'Not a valid user id.' }),
});
const logoParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid organization id.' }),
  kind: z.enum(LOGO_KINDS),
});
const personParamSchema = z.object({ id: z.uuid({ message: 'Not a valid user id.' }) });

const SLUG_TAKEN = 'Another organization already uses that address name.';

/**
 * Every calendar UID an organization ever issues carries this domain, so it is
 * chosen once, at creation, and never changed. Derived from the slug and the
 * address the platform is served from.
 */
function calendarDomainFor(slug: string, requestUrl: string): string {
  const host = new URL(requestUrl).hostname || 'tutor-portal.invalid';
  return `${slug}.${host}`;
}

/**
 * What the leading bytes say a file is. The declared Content-Type is not
 * trusted: an SVG (which can carry script, and would run as whoever opened it
 * from the portal's own address) declared as image/png is still an SVG.
 */
function sniffImage(bytes: Uint8Array): LogoContentType | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) return 'image/png';

  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';

  return null;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requireOrganization(env: Env, id: string): Promise<Organization> {
  const org = await getOrganizationById(env.DB, id);
  if (!org) throw ApiError.notFound('That organization does not exist.');
  return org;
}

/**
 * The platform console: organizations, their look, and their admins.
 *
 * Mounted behind requireAuth and requirePlatformAdmin, and deliberately
 * without requireOrg: nothing here reads an organization's people (beyond its
 * admins), lessons or money. A platform admin who needs to see inside an
 * organization becomes a member of it, which that organization's admins can
 * see in their own user list and log.
 *
 * Every change is written into the AFFECTED organization's log, so its admins
 * see what the platform did to them.
 */
export const platformRoutes = new Hono<AppEnv>()

  .get('/organizations', async (c) => {
    const body: ApiOk<OrganizationListItem[]> = { data: await listOrganizations(c.env.DB) };
    return c.json(body);
  })

  .post('/organizations', zValidator('json', createOrganizationSchema), async (c) => {
    const input = c.req.valid('json');
    let org: Organization;

    try {
      org = await createOrganization(c.env.DB, input, calendarDomainFor(input.slug, c.req.url));
    } catch (error) {
      if (isUniqueConstraintError(error)) throw ApiError.conflict(SLUG_TAKEN);
      throw error;
    }

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(org.id), {
      action: 'organization.created',
      description: `Created the organization ${org.name}`,
      entity_type: 'organization',
      entity_id: org.id,
    });

    const body: ApiOk<Organization> = { data: org };
    return c.json(body, 201);
  })

  .patch(
    '/organizations/:id',
    zValidator('param', orgParamSchema),
    zValidator('json', updateOrganizationSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const before = await requireOrganization(c.env, id);
      const input = c.req.valid('json');
      let org: Organization | null;

      try {
        org = await updateOrganization(c.env.DB, id, input);
      } catch (error) {
        if (isUniqueConstraintError(error)) throw ApiError.conflict(SLUG_TAKEN);
        throw error;
      }
      if (!org) throw ApiError.notFound('That organization does not exist.');

      await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
        action: 'organization.updated',
        description:
          `Updated the organization ${before.name}` +
          (input.email_notifications !== undefined && input.email_notifications !== before.email_notifications
            ? `; turned its email notifications ${input.email_notifications ? 'on' : 'off'}`
            : ''),
        entity_type: 'organization',
        entity_id: id,
      });

      const body: ApiOk<Organization> = { data: org };
      return c.json(body);
    },
  )

  .post('/organizations/:id/archive', zValidator('param', orgParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const before = await requireOrganization(c.env, id);
    const org = await setOrganizationArchived(c.env.DB, id, true);

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
      action: 'organization.archived',
      description: `Archived the organization ${before.name}`,
      entity_type: 'organization',
      entity_id: id,
    });

    const body: ApiOk<Organization> = { data: org! };
    return c.json(body);
  })

  .post('/organizations/:id/restore', zValidator('param', orgParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const before = await requireOrganization(c.env, id);
    const org = await setOrganizationArchived(c.env.DB, id, false);

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
      action: 'organization.restored',
      description: `Restored the organization ${before.name}`,
      entity_type: 'organization',
      entity_id: id,
    });

    const body: ApiOk<Organization> = { data: org! };
    return c.json(body);
  })

  /**
   * Uploads a logo: the raw image is the request body. PNG or WebP only, as
   * the bytes themselves say, and at most 256 KB.
   */
  .put('/organizations/:id/logo/:kind', zValidator('param', logoParamSchema), async (c) => {
    const { id, kind } = c.req.valid('param');
    const org = await requireOrganization(c.env, id);

    const declared = Number(c.req.header('Content-Length') ?? 0);
    if (declared > MAX_LOGO_BYTES) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        logo: ['A logo may be at most 256 KB.'],
      });
    }

    const bytes = await c.req.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        logo: [bytes.byteLength === 0 ? 'Choose an image.' : 'A logo may be at most 256 KB.'],
      });
    }

    const contentType = sniffImage(new Uint8Array(bytes));
    if (!contentType) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        logo: ['Upload a PNG or WebP image. SVG and other formats are not accepted.'],
      });
    }

    await putLogo(c.env.DB, id, kind, contentType, bytes, await sha256Hex(bytes));

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
      action: 'organization.logo_updated',
      description: `Updated the ${kind === 'mark' ? 'logo mark' : 'full logo'} of ${org.name}`,
      entity_type: 'organization',
      entity_id: id,
    });

    const body: ApiOk<Organization> = { data: (await getOrganizationById(c.env.DB, id))! };
    return c.json(body);
  })

  .delete('/organizations/:id/logo/:kind', zValidator('param', logoParamSchema), async (c) => {
    const { id, kind } = c.req.valid('param');
    const org = await requireOrganization(c.env, id);

    await deleteLogo(c.env.DB, id, kind);
    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
      action: 'organization.logo_updated',
      description: `Removed the ${kind === 'mark' ? 'logo mark' : 'full logo'} of ${org.name}`,
      entity_type: 'organization',
      entity_id: id,
    });

    const body: ApiOk<Organization> = { data: (await getOrganizationById(c.env.DB, id))! };
    return c.json(body);
  })

  .get('/organizations/:id/admins', zValidator('param', orgParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    await requireOrganization(c.env, id);
    const body: ApiOk<OrganizationAdmin[]> = { data: await listOrganizationAdmins(c.env.DB, id) };
    return c.json(body);
  })

  /**
   * Adds an admin by email. Someone new is created and invited; someone who
   * already has an account is invited and accepts when they next sign in.
   */
  .post(
    '/organizations/:id/admins',
    zValidator('param', orgParamSchema),
    zValidator('json', addOrganizationAdminSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { email, full_name } = c.req.valid('json');
      const org = await requireOrganization(c.env, id);

      const person =
        (await getPersonByEmail(c.env.DB, email)) ??
        (await createPerson(c.env.DB, { email, full_name }));

      await ensureMembershipWithRoles(c.env.DB, id, person.id, ['admin']);

      await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
        action: 'organization.admin_added',
        description: `Made ${person.full_name} an admin of ${org.name}`,
        subject: { id: person.id, full_name: person.full_name },
        entity_type: 'organization',
        entity_id: id,
      });

      const body: ApiOk<OrganizationAdmin[]> = { data: await listOrganizationAdmins(c.env.DB, id) };
      return c.json(body, 201);
    },
  )

  .delete(
    '/organizations/:id/admins/:userId',
    zValidator('param', adminParamSchema),
    async (c) => {
      const { id, userId } = c.req.valid('param');
      const org = await requireOrganization(c.env, id);
      const person = await getPersonById(c.env.DB, userId);

      if (!person || !(await removeRole(c.env.DB, id, userId, 'admin'))) {
        throw ApiError.notFound('That person is not an admin of this organization.');
      }

      await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
        action: 'organization.admin_removed',
        description: `Removed ${person.full_name} as an admin of ${org.name}`,
        subject: { id: person.id, full_name: person.full_name },
        entity_type: 'organization',
        entity_id: id,
      });

      const body: ApiOk<OrganizationAdmin[]> = { data: await listOrganizationAdmins(c.env.DB, id) };
      return c.json(body);
    },
  )

  .get('/admins', async (c) => {
    const body: ApiOk<PlatformAdmin[]> = { data: await listPlatformAdmins(c.env.DB) };
    return c.json(body);
  })

  .post('/admins', zValidator('json', addPlatformAdminSchema), async (c) => {
    const { email, full_name } = c.req.valid('json');
    const person =
      (await getPersonByEmail(c.env.DB, email)) ??
      (await createPerson(c.env.DB, { email, full_name }));

    await addPlatformAdmin(c.env.DB, person.id);
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform_admin.added',
      description: `Made ${person.full_name} a platform admin`,
      subject: { id: person.id, full_name: person.full_name },
      entity_type: 'user',
      entity_id: person.id,
    });

    const body: ApiOk<PlatformAdmin[]> = { data: await listPlatformAdmins(c.env.DB) };
    return c.json(body, 201);
  })

  /** A person's shared fields, looked up by email, for correcting them. */
  .get('/people', zValidator('query', platformPersonLookupSchema), async (c) => {
    const person = await getPersonByEmail(c.env.DB, c.req.valid('query').email);
    if (!person) throw ApiError.notFound('Nobody has that email address.');

    const body: ApiOk<PlatformPerson> = {
      data: {
        id: person.id,
        full_name: person.full_name,
        email: person.email,
        phone: person.phone,
        google_sub_pinned: person.google_sub_pinned,
        organization_count: await countMemberships(c.env.DB, person.id),
      },
    };
    return c.json(body);
  })

  /**
   * Corrects the shared fields of a person -- the change shows in every
   * organization they belong to, which is why organization admins cannot make
   * it for someone who belongs to more than one.
   */
  .patch(
    '/people/:id',
    zValidator('param', personParamSchema),
    zValidator('json', platformPersonUpdateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const person = await getPersonById(c.env.DB, id);
      if (!person) throw ApiError.notFound('That person does not exist.');

      try {
        await updatePersonFields(c.env.DB, id, c.req.valid('json'));
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict('Another person already has that email address.');
        }
        throw error;
      }

      await recordAudit(c.env.DB, c.get('person'), 'platform', {
        action: 'person.updated_by_platform',
        description: `Corrected ${person.full_name}'s shared details`,
        subject: { id: person.id, full_name: person.full_name },
        entity_type: 'user',
        entity_id: id,
      });

      const updated = (await getPersonById(c.env.DB, id))!;
      const body: ApiOk<PlatformPerson> = {
        data: {
          id: updated.id,
          full_name: updated.full_name,
          email: updated.email,
          phone: updated.phone,
          google_sub_pinned: updated.google_sub_pinned,
          organization_count: await countMemberships(c.env.DB, id),
        },
      };
      return c.json(body);
    },
  )

  /** Lets a recreated Google account sign in again with the same address. */
  .post('/people/:id/unpin', zValidator('param', personParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const person = await getPersonById(c.env.DB, id);
    if (!person || !(await unpinGoogleSub(c.env.DB, id))) {
      throw ApiError.notFound('That person does not exist.');
    }

    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'person.sign_in_unpinned',
      description: `Unpinned ${person.full_name}'s Google sign-in`,
      subject: { id: person.id, full_name: person.full_name },
      entity_type: 'user',
      entity_id: id,
    });

    return c.body(null, 204);
  })

  .get('/audit', async (c) => {
    const body: ApiOk<Record<string, unknown>[]> = { data: await listPlatformAudit(c.env.DB, 100) };
    return c.json(body);
  });

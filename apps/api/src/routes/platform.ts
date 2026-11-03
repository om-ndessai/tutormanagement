import { Hono } from 'hono';
import { z } from 'zod';
import {
  ACCESS_MODE_LABELS,
  accessDecisionSchema,
  accessListEntrySchema,
  accessSettingsSchema,
  type AccessConsoleResponse,
  LOGO_KINDS,
  MAX_LOGO_BYTES,
  addOrganizationAdminSchema,
  addPlatformAdminSchema,
  createBusinessSchema,
  createOrganizationSchema,
  describeFeatureChange,
  setSpaceBusinessSchema,
  spacePaymentModelSchema,
  SPACE_PAYER_FIELDS,
  type SpacePayerField,
  updateBusinessSchema,
  type Business,
  type BusinessListItem,
  organizationFeaturesSchema,
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
  EMPTY_SIGN_IN_SETTINGS,
  SIGN_IN_CLIENTS,
  SIGN_IN_CLIENT_LABELS,
  SWITCHABLE_PROVIDERS,
  describeProviders,
  effectiveSignIn,
  updateSignInSettingSchema,
  type SignInSettings,
  type SignInSettingsResponse,
  updatePlaySchema,
  GUEST_POOL_DEFAULT,
  GUEST_POOL_MAX,
  GUEST_POOL_MIN,
  QUESTION_BANK_LEVEL_IDS,
  guestPoolUpdateSchema,
  guestSettingsSchema,
  levelLabel,
  type GuestConsoleResponse,
  type GuestPoolConsoleResponse,
  type PlayConsoleResponse,
  type QuestTile,
} from '@tmi/shared';

import {
  addAccessListEntry,
  decideAccess,
  getAccessAccount,
  getAccessSettings,
  listAccessList,
  listDecidedAccounts,
  listWaitingAccounts,
  putAccessSettings,
  removeAccessListEntry,
} from '../repositories/access.js';
import type { AppEnv, Env } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { configuredProviders } from '../lib/identity.js';
import { signInDefaults } from '../lib/sign-in.js';
import {
  getGuestSettings,
  getPlay,
  getSignInSettings,
  putGuestSettings,
  putPlay,
  putSignInSettings,
  resetTiles,
} from '../repositories/platform-settings.js';
import {
  bumpVersion,
  guestPoolSizes,
  guestVersion,
  poolCandidates,
  poolIds,
  setGuestPool,
  suggestPoolFor,
} from '../repositories/guest.js';
import { fillOpenTilePools, forgetGuestSizes } from '../lib/guest.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { orgIdFromRow } from '../lib/org.js';
import { zValidator } from '../lib/validate.js';
import {
  createBusiness,
  createOrganization,
  deleteLogo,
  getBusiness,
  listBusinesses,
  setSpaceBusiness,
  linkOwnPayer,
  otherSpacesOfPayer,
  spacesOfBusiness,
  updateBusiness,
  updateSpacePayer,
  ensureMembershipWithRoles,
  getOrganizationById,
  listOrganizationAdmins,
  listOrganizations,
  listPlatformAudit,
  putLogo,
  removeRole,
  setOrganizationArchived,
  updateOrganization,
  updateOrganizationFeatures,
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

const orgParamSchema = z.object({ id: z.uuid({ message: 'Not a valid space id.' }) });
const adminParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid space id.' }),
  userId: z.uuid({ message: 'Not a valid user id.' }),
});
const logoParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid space id.' }),
  kind: z.enum(LOGO_KINDS),
});
const personParamSchema = z.object({ id: z.uuid({ message: 'Not a valid user id.' }) });
const businessParamSchema = z.object({ id: z.string().min(1).max(64) });

/**
 * Phase 54: a business a space may be linked to -- it exists, is not archived, and (Phase 59,
 * decision 5) is no other space's payer: a payer record is never shared by two spaces.
 */
async function requireLinkableBusiness(env: Env, id: string, spaceId: string | null): Promise<Business> {
  const business = await getBusiness(env.DB, id);
  if (!business) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      business_id: ['That payer record does not exist.'],
    });
  }
  if (business.archived_at) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      business_id: [`${business.name} is archived.`],
    });
  }
  if ((await otherSpacesOfPayer(env.DB, id, spaceId)).length > 0) {
    throw new ApiError(409, 'shared_payer', 'That payer record is another space’s. Each space has its own.');
  }
  return business;
}

const SLUG_TAKEN = 'Another space already uses that address name.';

/**
 * Every calendar UID an organization ever issues carries this domain, so it is
 * chosen once, at creation, and never changed. Derived from the slug and the
 * address the platform is served from.
 */
function calendarDomainFor(slug: string, requestUrl: string): string {
  const host = new URL(requestUrl).hostname || 'aimtrue.invalid';
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

/** "TIN, city": the payer fields a change touched, never their values. */
function describeBusinessFields(keys: string[]): string {
  return keys
    .map((key) =>
      key === 'tin' ? 'TIN' : key === 'payer_name' || key === 'name' ? 'name on the 1099' : key.replace(/^payer_/, '').replace(/_/g, ' '),
    )
    .join(', ');
}

/**
 * A business change goes in the platform's log and in the log of every space it
 * runs, so those spaces' admins see what changed their payer box.
 */
async function logBusinessChange(
  db: D1Database,
  actor: { id: string; full_name: string },
  business: Business,
  action: 'business.updated' | 'business.archived' | 'business.restored',
  description: string,
): Promise<void> {
  const spaces = (await listBusinesses(db)).find((b) => b.id === business.id)?.spaces ?? [];
  const entry = { action, description, entity_type: 'business', entity_id: business.id } as const;
  await recordAudit(db, actor, 'platform', entry);
  for (const space of spaces) await recordAudit(db, actor, orgIdFromRow(space.id), entry);
}

async function requireOrganization(env: Env, id: string): Promise<Organization> {
  const org = await getOrganizationById(env.DB, id);
  if (!org) throw ApiError.notFound('That space does not exist.');
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
    // Phase 63 (P13): newcomers' personal spaces only with ?personal=1.
    const body: ApiOk<OrganizationListItem[]> = {
      data: await listOrganizations(c.env.DB, { personal: c.req.query('personal') === '1' }),
    };
    return c.json(body);
  })

  .post('/organizations', zValidator('json', createOrganizationSchema), async (c) => {
    const input = c.req.valid('json');
    let org: Organization;
    // Phase 59: `payment_model` decides; an older app's `business_id` still links, but never a
    // payer record another space already has.
    if (input.payment_model === undefined && input.business_id) {
      await requireLinkableBusiness(c.env, input.business_id, null);
    }

    try {
      org = await createOrganization(c.env.DB, input, calendarDomainFor(input.slug, c.req.url));
    } catch (error) {
      if (isUniqueConstraintError(error)) throw ApiError.conflict(SLUG_TAKEN);
      throw error;
    }

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(org.id), {
      action: 'organization.created',
      description: org.business
        ? `Created the space ${org.name}; it collects its families’ payments`
        : `Created the space ${org.name}; families pay each tutor directly`,
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
      const body_ = c.req.valid('json');
      // Phase 59: the payer details travel on the space, and are written to its own payer record.
      const payer: Partial<Record<SpacePayerField, string | null>> = {};
      const input: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body_)) {
        if (value === undefined) continue;
        if ((SPACE_PAYER_FIELDS as readonly string[]).includes(key)) payer[key as SpacePayerField] = value as string | null;
        else input[key] = value;
      }
      const payerKeys = Object.keys(payer);
      if (payerKeys.length > 0) {
        if (!before.business) {
          throw new ApiError(409, 'paid_directly',
            'Families pay each tutor directly in this space, so it has no payer details to edit.');
        }
        if ((await spacesOfBusiness(c.env.DB, before.business.id)).length > 1) {
          throw new ApiError(409, 'shared_payer', 'This space’s payer record is shared with another space.');
        }
      }
      let org: Organization | null;

      try {
        org = Object.keys(input).length > 0
          ? await updateOrganization(c.env.DB, id, input as typeof body_)
          : before;
        if (payerKeys.length > 0) await updateSpacePayer(c.env.DB, id, payer, before.name);
      } catch (error) {
        if (isUniqueConstraintError(error)) throw ApiError.conflict(SLUG_TAKEN);
        throw error;
      }
      if (!org) throw ApiError.notFound('That space does not exist.');
      org = (await getOrganizationById(c.env.DB, id)) ?? org;

      await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
        action: 'organization.updated',
        description:
          `Updated the space ${before.name}` +
          // Names the payer fields changed, never their values: the log is read widely.
          (payerKeys.length > 0 ? `; its payer ${describeBusinessFields(payerKeys)}` : '') +
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

  /**
   * Phase 50: which feature sets an organization is allowed (Tutoring, Assessment, Quest). Only a
   * platform admin decides; logged in that organization's own log, and listed on the console's
   * activity with the other `organization.*` actions.
   */
  .put(
    '/organizations/:id/features',
    zValidator('param', orgParamSchema),
    zValidator('json', organizationFeaturesSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const before = await requireOrganization(c.env, id);
      const input = c.req.valid('json');
      const org = await updateOrganizationFeatures(c.env.DB, id, input);
      if (!org) throw ApiError.notFound('That space does not exist.');
      await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
        action: 'organization.features_updated',
        description:
          `Feature sets of ${before.name}: ${describeFeatureChange(before, input)}` +
          (input.quest_trusted === undefined || input.quest_trusted === before.quest_trusted
            ? ''
            : input.quest_trusted
              ? '; its Quest reviews now approve questions'
              : '; its Quest reviews now suggest approvals') +
          (input.checked_questions === undefined || input.checked_questions === before.checked_questions
            ? ''
            : input.checked_questions
              ? '; its games, tiles and assessments now draw checked questions'
              : '; its games, tiles and assessments now draw approved questions only'),
        entity_type: 'organization',
        entity_id: id,
      });
      const body: ApiOk<Organization> = { data: org };
      return c.json(body);
    },
  )

  /**
   * Phase 59: who families pay, from now on. 'space' links the space's OWN payer record (keyed
   * by its id; made if missing, restored if archived); 'direct' unlinks it, and families pay each
   * lesson's tutor. Recorded lessons and payments keep the model they were recorded under; only
   * what is recorded next follows the change. The payer record is kept, for a switch back.
   */
  .put(
    '/organizations/:id/payment-model',
    zValidator('param', orgParamSchema),
    zValidator('json', spacePaymentModelSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { model } = c.req.valid('json');
      const before = await requireOrganization(c.env, id);

      if (model === 'space' && !before.business) {
        // The space's own record, keyed by its id, is never another space's payer as well.
        if ((await spacesOfBusiness(c.env.DB, id)).some((space) => space !== id)) {
          throw new ApiError(409, 'shared_payer', 'That payer record is another space’s. Each space has its own.');
        }
        await linkOwnPayer(c.env.DB, before);
        await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
          action: 'organization.business_set',
          description: `Set ${before.name} to collect its families’ payments from now on`,
          entity_type: 'organization',
          entity_id: id,
        });
      } else if (model === 'direct' && before.business) {
        await setSpaceBusiness(c.env.DB, id, null);
        await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
          action: 'organization.business_cleared',
          description: `Set ${before.name} so families pay each tutor directly from now on`,
          entity_type: 'organization',
          entity_id: id,
        });
      }

      const body: ApiOk<Organization> = { data: (await getOrganizationById(c.env.DB, id))! };
      return c.json(body);
    },
  )

  /**
   * Phase 54: the business that collects a space's payments from now on, or none (paid
   * directly). Kept for app builds already on phones; the console no longer calls it
   * (Phase 59), and it never links a payer record another space has (409 shared_payer).
   */
  .put(
    '/organizations/:id/business',
    zValidator('param', orgParamSchema),
    zValidator('json', setSpaceBusinessSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { business_id } = c.req.valid('json');
      const before = await requireOrganization(c.env, id);
      const business = business_id ? await requireLinkableBusiness(c.env, business_id, id) : null;

      if ((before.business?.id ?? null) !== (business?.id ?? null)) {
        await setSpaceBusiness(c.env.DB, id, business?.id ?? null);
        await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), business
          ? {
              action: 'organization.business_set',
              description: `Set ${before.name} to collect its families’ payments from now on, as ${business.name}`,
              entity_type: 'organization',
              entity_id: id,
            }
          : {
              action: 'organization.business_cleared',
              description: `Set ${before.name} so families pay each tutor directly from now on`,
              entity_type: 'organization',
              entity_id: id,
            });
      }

      const body: ApiOk<Organization> = { data: (await getOrganizationById(c.env.DB, id))! };
      return c.json(body);
    },
  )

  // Phase 54's payer records, by themselves: kept for app builds already on phones (Phase 59).
  .get('/businesses', async (c) => {
    const body: ApiOk<BusinessListItem[]> = { data: await listBusinesses(c.env.DB) };
    return c.json(body);
  })

  .post('/businesses', zValidator('json', createBusinessSchema), async (c) => {
    const business = await createBusiness(c.env.DB, c.req.valid('json'));
    // Names the business, never its TIN: the log is read widely.
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'business.created',
      description: `Created the payer record ${business.name}`,
      entity_type: 'business',
      entity_id: business.id,
    });
    const body: ApiOk<Business> = { data: business };
    return c.json(body, 201);
  })

  .patch(
    '/businesses/:id',
    zValidator('param', businessParamSchema),
    zValidator('json', updateBusinessSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const updated = await updateBusiness(c.env.DB, id, input);
      if (!updated) throw ApiError.notFound('That payer record does not exist.');
      await logBusinessChange(c.env.DB, c.get('person'), updated, 'business.updated',
        `Updated ${updated.name}'s ${describeBusinessFields(Object.keys(input))}`);
      const body: ApiOk<Business> = { data: updated };
      return c.json(body);
    },
  )

  .post('/businesses/:id/archive', zValidator('param', businessParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const before = await getBusiness(c.env.DB, id);
    if (!before) throw ApiError.notFound('That payer record does not exist.');
    // A payer record a space still uses cannot be archived: the space would have
    // no payer, which is "paid directly" -- a choice made on the space.
    const runs = (await listBusinesses(c.env.DB)).find((b) => b.id === id)?.spaces ?? [];
    if (runs.length > 0) {
      throw ApiError.conflict(
        `${before.name} is still the payer of ${runs.map((space) => space.name).join(', ')}. Set it so families pay each tutor first.`,
      );
    }
    const updated = await updateBusiness(c.env.DB, id, { archived_at: new Date().toISOString() });
    await logBusinessChange(c.env.DB, c.get('person'), updated!, 'business.archived', `Archived the payer record ${before.name}`);
    const body: ApiOk<Business> = { data: updated! };
    return c.json(body);
  })

  .post('/businesses/:id/restore', zValidator('param', businessParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const updated = await updateBusiness(c.env.DB, id, { archived_at: null });
    if (!updated) throw ApiError.notFound('That payer record does not exist.');
    await logBusinessChange(c.env.DB, c.get('person'), updated, 'business.restored', `Restored the payer record ${updated.name}`);
    const body: ApiOk<Business> = { data: updated };
    return c.json(body);
  })

  .post('/organizations/:id/archive', zValidator('param', orgParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const before = await requireOrganization(c.env, id);
    const org = await setOrganizationArchived(c.env.DB, id, true);

    await recordAudit(c.env.DB, c.get('person'), orgIdFromRow(id), {
      action: 'organization.archived',
      description: `Archived the space ${before.name}`,
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
      description: `Restored the space ${before.name}`,
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
        throw ApiError.notFound('That person is not an admin of this space.');
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
  })

  /**
   * Phase 62 (P0): the sign-in switches -- which ways in, and whether newcomers may sign up, for the
   * web portal and for the app separately. Each client shows what is in force, the Worker's defaults
   * (its vars) and the stored setting; `configured` lists the providers this Worker has set up.
   */
  .get('/sign-in', async (c) => {
    const body: ApiOk<SignInSettingsResponse> = { data: await signInStatus(c.env) };
    return c.json(body);
  })

  /**
   * Phase 62 (P0): one client's switches, for a number of hours or until changed -- or `null`, back
   * to the Worker's defaults. Google is always on, and a provider not set up here is never offered,
   * whatever is stored. Logged as a platform line.
   */
  .put('/sign-in', zValidator('json', updateSignInSettingSchema), async (c) => {
    const { client, setting } = c.req.valid('json');
    const person = c.get('person');
    const now = new Date();
    const current = await getSignInSettings(c.env.DB, 0);
    const next: SignInSettings = {
      ...current,
      [client]: setting
        ? {
            providers: SWITCHABLE_PROVIDERS.filter((provider) => setting.providers.includes(provider)),
            signup_open: setting.signup_open,
            until: setting.hours === null ? null : new Date(now.getTime() + setting.hours * 3_600_000).toISOString(),
          }
        : null,
    };
    await putSignInSettings(c.env.DB, next, person.id);
    const where = SIGN_IN_CLIENT_LABELS[client].toLowerCase();
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'platform.sign_in_updated',
      description: setting
        ? `Set sign-in for the ${where}: ${describeProviders(['google', ...setting.providers])}, ` +
          `sign-up ${setting.signup_open ? 'open' : 'closed'}` +
          (setting.hours === null ? ', until changed.' : `, for ${setting.hours} hour${setting.hours === 1 ? '' : 's'}.`)
        : `Returned sign-in for the ${where} to this address's defaults.`,
      entity_type: 'platform',
      entity_id: `sign_in.${client}`,
    });
    const body: ApiOk<SignInSettingsResponse> = { data: await signInStatus(c.env) };
    return c.json(body);
  })

  /**
   * Phase 62 (P5): the tiles and the Play settings -- the Play home's switch, the members' minimum
   * depth, and the ordered list (each tile's code derived from its shape). `reset_tiles` puts the
   * default list back.
   */
  .get('/play', async (c) => {
    const play = await getPlay(c.env.DB, 0);
    const body: ApiOk<PlayConsoleResponse> = { data: play };
    return c.json(body);
  })
  .put('/play', zValidator('json', updatePlaySchema), async (c) => {
    const input = c.req.valid('json');
    const before = await getPlay(c.env.DB, 0);
    await putPlay(c.env.DB, input, c.get('person').id);
    const after = await getPlay(c.env.DB, 0);
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.play_updated',
      description: describePlayChange(before, after),
      entity_type: 'platform',
      entity_id: 'play',
    });
    await fillPoolsAndLog(c.env.DB, c.get('person'), after.tiles);
    const body: ApiOk<PlayConsoleResponse> = { data: after };
    return c.json(body);
  })
  .post('/play/reset-tiles', async (c) => {
    await resetTiles(c.env.DB);
    const after = await getPlay(c.env.DB, 0);
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.play_updated',
      description: `Put back the default tiles (${after.tiles.length}).`,
      entity_type: 'platform',
      entity_id: 'play',
    });
    await fillPoolsAndLog(c.env.DB, c.get('person'), after.tiles);
    const body: ApiOk<PlayConsoleResponse> = { data: after };
    return c.json(body);
  })

  /** Phase 63 (P16): guest play -- its settings, each level's pool size and the version. */
  // Phase 65 (docs/access-approval-plan.md): sign-up access -- the mode, the list, the decisions.
  .get('/access', async (c) => {
    const body: ApiOk<AccessConsoleResponse> = { data: await accessConsole(c.env.DB) };
    return c.json(body);
  })
  .put('/access', zValidator('json', accessSettingsSchema), async (c) => {
    const settings = c.req.valid('json');
    const before = await getAccessSettings(c.env.DB, 0);
    await putAccessSettings(c.env.DB, settings, c.get('person').id);
    if (before.mode !== settings.mode) {
      await recordAudit(c.env.DB, c.get('person'), 'platform', {
        action: 'platform.access_updated',
        description: `Sign-up access: ${ACCESS_MODE_LABELS[settings.mode]} (was ${ACCESS_MODE_LABELS[before.mode]}).`,
        entity_type: 'platform',
        entity_id: 'access',
      });
    }
    const body: ApiOk<AccessConsoleResponse> = { data: await accessConsole(c.env.DB) };
    return c.json(body);
  })
  .post('/access/list', zValidator('json', accessListEntrySchema), async (c) => {
    const entry = await addAccessListEntry(c.env.DB, c.req.valid('json'), c.get('person').id);
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.access_listed',
      description: `Added ${describeAccessEntry(entry)} to the sign-up list.`,
      entity_type: 'platform',
      entity_id: 'access',
    });
    const body: ApiOk<AccessConsoleResponse> = { data: await accessConsole(c.env.DB) };
    return c.json(body, 201);
  })
  .delete('/access/list/:id', async (c) => {
    const entry = await removeAccessListEntry(c.env.DB, c.req.param('id'));
    if (!entry) throw ApiError.notFound('That entry is not on the list.');
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.access_unlisted',
      description: `Removed ${describeAccessEntry(entry)} from the sign-up list.`,
      entity_type: 'platform',
      entity_id: 'access',
    });
    const body: ApiOk<AccessConsoleResponse> = { data: await accessConsole(c.env.DB) };
    return c.json(body);
  })
  .put('/access/accounts/:userId', zValidator('json', accessDecisionSchema), async (c) => {
    const account = await getAccessAccount(c.env.DB, c.req.param('userId'));
    if (!account) throw ApiError.notFound('No such sign-up.');
    const { access } = c.req.valid('json');
    if (account.access !== access) {
      await decideAccess(c.env.DB, account.user_id, access, c.get('person').id);
      await recordAudit(c.env.DB, c.get('person'), 'platform', {
        action: access === 'approved' ? 'platform.access_approved' : 'platform.access_declined',
        description:
          access === 'approved'
            ? `Approved ${account.full_name}'s access.`
            : account.access === 'approved'
              ? `Revoked ${account.full_name}'s access.`
              : `Declined ${account.full_name}'s access.`,
        entity_type: 'user',
        entity_id: account.user_id,
      });
    }
    const body: ApiOk<AccessConsoleResponse> = { data: await accessConsole(c.env.DB) };
    return c.json(body);
  })
  .get('/guest', async (c) => {
    const body: ApiOk<GuestConsoleResponse> = { data: await guestConsole(c.env) };
    return c.json(body);
  })
  .put('/guest', zValidator('json', guestSettingsSchema), async (c) => {
    const settings = c.req.valid('json');
    const before = await getGuestSettings(c.env.DB, 0);
    await putGuestSettings(c.env.DB, settings, c.get('person').id);
    await c.env.DB.batch([bumpVersion(c.env.DB)]);
    const filled = await fillOpenTilePools(c.env.DB, (await getPlay(c.env.DB, 0)).tiles, settings.enabled);
    const changes: string[] = [];
    if (before.enabled !== settings.enabled) changes.push(`guest play ${settings.enabled ? 'on' : 'off'}`);
    if (filled.length) changes.push(describeFilled(filled));
    if (before.assessment_enabled !== settings.assessment_enabled) changes.push(`guest assessment ${settings.assessment_enabled ? 'on' : 'off'}`);
    if (before.nudge_after !== settings.nudge_after) changes.push(`the sign-up offer after question ${settings.nudge_after}`);
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.guest_updated',
      description: changes.length ? `Guest play: ${changes.join('; ')}.` : 'Guest play: wording or timing changed.',
      entity_type: 'platform',
      entity_id: 'guest',
    });
    const body: ApiOk<GuestConsoleResponse> = { data: await guestConsole(c.env) };
    return c.json(body);
  })
  .get('/guest/pools/:level', async (c) => {
    const level = c.req.param('level');
    if (!(QUESTION_BANK_LEVEL_IDS as readonly string[]).includes(level)) throw ApiError.notFound('No such level.');
    const size = Number(c.req.query('size') ?? GUEST_POOL_DEFAULT);
    const current = await poolCandidates(c.env.DB, await poolIds(c.env.DB, level));
    const suggested = await suggestPoolFor(c.env.DB, level, Math.min(GUEST_POOL_MAX, Math.max(GUEST_POOL_MIN, size || GUEST_POOL_DEFAULT)));
    const body: ApiOk<GuestPoolConsoleResponse> = {
      data: { level_id: level, current, suggestion: await poolCandidates(c.env.DB, suggested.map((q) => q.id)) },
    };
    return c.json(body);
  })
  .put('/guest/pools/:level', zValidator('json', guestPoolUpdateSchema), async (c) => {
    const level = c.req.param('level');
    const input = c.req.valid('json');
    if (input.level_id !== level || !(QUESTION_BANK_LEVEL_IDS as readonly string[]).includes(level)) {
      throw ApiError.badRequest('The level does not match.');
    }
    await setGuestPool(c.env.DB, level, input.question_ids);
    forgetGuestSizes();
    const current = await poolCandidates(c.env.DB, await poolIds(c.env.DB, level));
    await recordAudit(c.env.DB, c.get('person'), 'platform', {
      action: 'platform.guest_updated',
      description: `Guest play: ${levelLabel(level)}'s free questions set (${current.length}).`,
      entity_type: 'platform',
      entity_id: `guest.${level}`,
    });
    const body: ApiOk<GuestPoolConsoleResponse> = { data: { level_id: level, current, suggestion: [] } };
    return c.json(body);
  });

/** After the tiles change: while guest play is on, a level newly open to guests gets free questions. */
async function fillPoolsAndLog(db: D1Database, person: Parameters<typeof recordAudit>[1], tiles: readonly QuestTile[]): Promise<void> {
  const filled = await fillOpenTilePools(db, tiles, (await getGuestSettings(db, 0)).enabled);
  if (filled.length === 0) return;
  await recordAudit(db, person, 'platform', {
    action: 'platform.guest_updated',
    description: `Guest play: ${describeFilled(filled)}.`,
    entity_type: 'platform',
    entity_id: 'guest',
  });
}

/** "free questions chosen for Grade 3, Grade 4, Grade 5 and 12 more" */
function describeFilled(levels: readonly string[]): string {
  const named = levels.slice(0, 3).map(levelLabel).join(', ');
  return `free questions chosen for ${named}${levels.length > 3 ? ` and ${levels.length - 3} more` : ''}`;
}

/** Phase 63 (P16): what the console shows for guest play. */
async function guestConsole(env: Env): Promise<GuestConsoleResponse> {
  const [settings, sizes, version] = await Promise.all([getGuestSettings(env.DB, 0), guestPoolSizes(env.DB), guestVersion(env.DB)]);
  return {
    settings,
    pools: QUESTION_BANK_LEVEL_IDS.map((level_id) => ({ level_id, size: sizes.get(level_id) ?? 0 })),
    version,
    address_allows: env.GUEST_PLAY === 'true',
  };
}

/** "Play home on; members need 50 questions; tiles: added G4T15, removed BA5T10, 3 changed." */
function describePlayChange(
  before: { settings: { play_home: boolean; min_depth: number; daily: boolean }; tiles: QuestTile[] },
  after: { settings: { play_home: boolean; min_depth: number; daily: boolean }; tiles: QuestTile[] },
): string {
  const parts: string[] = [];
  if (before.settings.play_home !== after.settings.play_home) parts.push(`Play home ${after.settings.play_home ? 'on' : 'off'}`);
  if (before.settings.daily !== after.settings.daily) parts.push(`the Daily set ${after.settings.daily ? 'on' : 'off'}`);
  if (before.settings.min_depth !== after.settings.min_depth) parts.push(`members' tiles need ${after.settings.min_depth} questions`);
  const was = new Map(before.tiles.map((tile) => [tile.code, tile]));
  const now = new Map(after.tiles.map((tile) => [tile.code, tile]));
  const added = after.tiles.filter((tile) => !was.has(tile.code)).map((tile) => tile.code);
  const removed = before.tiles.filter((tile) => !now.has(tile.code)).map((tile) => tile.code);
  const changed = after.tiles.filter((tile) => {
    const old = was.get(tile.code);
    return old && (old.guest !== tile.guest || old.members !== tile.members);
  }).length;
  const reordered = !added.length && !removed.length && before.tiles.map((t) => t.code).join() !== after.tiles.map((t) => t.code).join();
  if (added.length) parts.push(`added ${added.slice(0, 5).join(', ')}${added.length > 5 ? ` and ${added.length - 5} more` : ''}`);
  if (removed.length) parts.push(`removed ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? ` and ${removed.length - 5} more` : ''}`);
  if (changed) parts.push(`${changed} tile${changed === 1 ? '' : 's'} changed`);
  if (reordered) parts.push('tiles reordered');
  return parts.length ? `Play settings: ${parts.join('; ')}.` : 'Saved the Play settings unchanged.';
}

/** What the console shows for the sign-in switches, per client. */
async function signInStatus(env: Env): Promise<SignInSettingsResponse> {
  const now = new Date();
  const settings = await getSignInSettings(env.DB, now.getTime());
  const defaults = signInDefaults(env);
  return {
    configured: configuredProviders(env),
    clients: SIGN_IN_CLIENTS.map((client) => {
      const fallback = effectiveSignIn(defaults, EMPTY_SIGN_IN_SETTINGS, client, now);
      return {
        client,
        effective: effectiveSignIn(defaults, settings, client, now),
        defaults: { providers: fallback.providers, signup_open: fallback.signup_open },
        setting: settings[client],
      };
    }),
  };
}

/** Phase 65: what the console's Sign-up access section reads, all at once. */
async function accessConsole(db: D1Database): Promise<AccessConsoleResponse> {
  const [settings, list, waiting, decided] = await Promise.all([
    getAccessSettings(db, 0),
    listAccessList(db),
    listWaitingAccounts(db),
    listDecidedAccounts(db),
  ]);
  return { settings, list, waiting, decided };
}

function describeAccessEntry(entry: { email: string | null; provider: string | null }): string {
  return entry.email ?? `a ${entry.provider ?? 'provider'} account`;
}

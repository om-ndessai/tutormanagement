import { Hono } from 'hono';
import {
  LOGO_KINDS,
  curriculumOfferingSchema,
  updateOrganizationSettingsSchema,
  type ApiOk,
  type CurriculumOffering,
  type NotificationLogEntry,
  type OrganizationSettings,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { zValidator } from '../lib/validate.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
  getLogo,
  getOrganizationBySlug,
  getOrganizationSettings,
  updateOrganizationSettings,
} from '../repositories/organizations.js';
import { listNotifications } from '../repositories/notifications.js';
import { listCurriculumOfferings, setCurriculumOffering } from '../repositories/curricula.js';

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * The audit sentence for a change of offering, from the before and after: what
 * is newly offered, what was retired, and a new default. Null when nothing
 * changed, which writes no line.
 */
function describeOfferingChange(before: CurriculumOffering[], after: CurriculumOffering[]): string | null {
  const was = new Map(before.map((row) => [row.id, row]));
  const added = after.filter((row) => row.offered && !was.get(row.id)?.offered).map((row) => row.name);
  const retired = after.filter((row) => !row.offered && was.get(row.id)?.offered).map((row) => row.name);
  const newDefault = after.find((row) => row.is_default && !was.get(row.id)?.is_default);

  const parts = [
    added.length > 0 ? `started offering ${listNames(added)}` : null,
    retired.length > 0 ? `retired ${listNames(retired)}` : null,
    newDefault ? `made ${newDefault.name} the default curriculum` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  const sentence = parts.join('; ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * The organization's own settings: the payer box on every 1099 it issues. Its
 * admins only -- the TIN is the office's, and not a family's or a tutor's to
 * read. Branding is the platform's, and shown here read-only.
 */
export const organizationRoutes = new Hono<AppEnv>()

  .get('/settings', requireAdmin, async (c) => {
    const body: ApiOk<OrganizationSettings> = {
      data: await getOrganizationSettings(c.env.DB, c.get('org').id),
    };
    return c.json(body);
  })

  .patch(
    '/settings',
    requireAdmin,
    zValidator('json', updateOrganizationSettingsSchema),
    async (c) => {
      const org = c.get('org');
      const input = c.req.valid('json');
      const settings = await updateOrganizationSettings(c.env.DB, org.id, input);

      // Names what changed, never the TIN itself: the log is read widely.
      const { email_notifications: notifications, ...details } = input;
      const changes = Object.keys(details).map((key) =>
        key === 'tin' ? 'TIN' : key.replace(/^payer_/, '').replace(/_/g, ' '),
      );
      await recordAudit(c.env.DB, c.get('user'), org.id, {
        action: 'organization.settings_updated',
        description: [
          changes.length > 0 ? `Updated ${org.name}'s ${changes.join(', ')}` : null,
          notifications === undefined
            ? null
            : `Turned ${org.name}'s email notifications ${notifications ? 'on' : 'off'}`,
        ]
          .filter(Boolean)
          .join('; '),
        entity_type: 'organization',
        entity_id: org.id,
      });

      const body: ApiOk<OrganizationSettings> = { data: settings };
      return c.json(body);
    },
  )

  /**
   * Phase 35: every curriculum this organization may offer, with its standing
   * here (offered, retired, the default) and its size. Its admins only.
   */
  .get('/curricula', requireAdmin, async (c) => {
    const body: ApiOk<CurriculumOffering[]> = {
      data: await listCurriculumOfferings(c.env.DB, c.get('org').id),
    };
    return c.json(body);
  })

  /**
   * Phase 35: the whole choice at once -- which curricula are offered, and the
   * default. What is left out is retired, never deleted: everything written
   * against it keeps its names, and a write may still name it.
   */
  .put('/curricula', requireAdmin, zValidator('json', curriculumOfferingSchema), async (c) => {
    const org = c.get('org');
    const input = c.req.valid('json');
    const before = await listCurriculumOfferings(c.env.DB, org.id);

    // One answer for an id that is invented and one that is another
    // organization's own: neither is on the list of what this one may offer.
    const known = new Set(before.map((row) => row.id));
    const unknown = input.offered.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw ApiError.validation('Please correct the highlighted fields.', {
        offered: [`Not a curriculum this organization can offer: ${unknown.join(', ')}.`],
      });
    }

    await setCurriculumOffering(c.env.DB, org.id, input.offered, input.default_curriculum_id);
    const after = await listCurriculumOfferings(c.env.DB, org.id);

    const description = describeOfferingChange(before, after);
    if (description) {
      await recordAudit(c.env.DB, c.get('user'), org.id, {
        action: 'curriculum.offering_updated',
        description,
        entity_type: 'organization',
        entity_id: org.id,
      });
    }

    const body: ApiOk<CurriculumOffering[]> = { data: after };
    return c.json(body);
  })

  /**
   * Phase 32: the organization's recent notification attempts, for its
   * admins -- who was emailed about what, and whether it went. Names only:
   * the log holds no addresses and no message text.
   */
  .get('/notifications', requireAdmin, async (c) => {
    const body: ApiOk<NotificationLogEntry[]> = {
      data: await listNotifications(c.env.DB, c.get('org').id),
    };
    return c.json(body);
  });

/**
 * Public: an organization's logo, for the sign-in page as much as anywhere.
 * Versioned by its hash in the URL, so it is cached for good and still
 * changes the moment a new one is uploaded. Locked down as tightly as an
 * image can be: no sniffing, and nothing it could load or run.
 */
export const logoRoutes = new Hono<AppEnv>().get('/:slug/logo/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (!(LOGO_KINDS as readonly string[]).includes(kind)) throw ApiError.notFound('No such logo.');

  const slug = c.req.param('slug');
  const logo = await getLogo(c.env.DB, slug, kind as (typeof LOGO_KINDS)[number]);

  if (!logo) {
    // An organization wearing the institute's built-in artwork serves the
    // file the app ships, so the URL scheme is the same either way.
    const org = await getOrganizationBySlug(c.env.DB, slug);
    if (org?.builtin_logo === 'institute') {
      const file = kind === 'mark' ? '/logo-mark.png' : '/logo-full.png';
      return c.env.ASSETS.fetch(new URL(file, c.req.url));
    }
    throw ApiError.notFound('No such logo.');
  }

  return new Response(logo.bytes, {
    headers: {
      'Content-Type': logo.content_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});

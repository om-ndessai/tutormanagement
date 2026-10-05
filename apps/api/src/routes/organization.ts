import { Hono } from 'hono';
import {
  LOGO_KINDS,
  updateOrganizationSettingsSchema,
  type ApiOk,
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
      await recordAudit(c.env.DB, c.get('user'), org.id, {
        action: 'organization.settings_updated',
        description: `Updated ${org.name}'s ${Object.keys(input)
          .map((key) => (key === 'tin' ? 'TIN' : key.replace(/^payer_/, '').replace(/_/g, ' ')))
          .join(', ')}`,
        entity_type: 'organization',
        entity_id: org.id,
      });

      const body: ApiOk<OrganizationSettings> = { data: settings };
      return c.json(body);
    },
  );

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

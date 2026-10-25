import { Hono } from 'hono';
import {
  LOGO_KINDS,
  curriculumOfferingSchema,
  updateOrganizationSettingsSchema,
  type ApiOk,
  type CurriculumOffering,
  type NotificationLogEntry,
  type OrganizationSettings,
  deleteSpaceSchema,
  featureAllowed,
  formatSpaceCode,
  type JoinRequest,
  type SpaceCode,
} from '@tmi/shared';
import { z } from 'zod';

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
  answerJoinRequest,
  getSpaceCode,
  listJoinRequests,
  openJoinRequest,
  renewSpaceCode,
  setJoinByCode,
} from '../repositories/organizations.js';
import { listNotifications } from '../repositories/notifications.js';
import { purgeSpace } from '../repositories/purge.js';
import { countAdmins, deactivateUser } from '../repositories/users.js';
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
      // Phase 50: a set the platform does not allow here cannot be switched on by the space.
      const assessmentKeys = ['canvas_assessments', 'canvas_assessments_unreviewed', 'canvas_assessment_questions'] as const;
      if (!featureAllowed(org, 'assessment') && assessmentKeys.some((key) => input[key] !== undefined)) {
        throw new ApiError(403, 'feature_unavailable', 'Assessment is not part of this space.');
      }
      // Phase 51: a self-serve space cannot send email under the platform's sender; a platform
      // admin may switch it on from the console.
      if (org.created_via === 'self_serve' && input.email_notifications === true) {
        throw new ApiError(403, 'feature_unavailable', 'Email notifications are not available in this space.');
      }
      if (!featureAllowed(org, 'quest') && input.gamify_question_quest !== undefined) {
        throw new ApiError(403, 'feature_unavailable', 'Quest is not part of this space.');
      }
      const settings = await updateOrganizationSettings(c.env.DB, org.id, input);

      // Names what changed, never the TIN itself: the log is read widely.
      const {
        email_notifications: notifications,
        canvas_assessments: assessments,
        canvas_assessments_unreviewed: unreviewed,
        canvas_assessment_questions: questionCount,
        gamify_question_quest: quest,
        ...details
      } = input;
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
          assessments === undefined
            ? null
            : `Turned ${org.name}'s Assessment menu (beta) ${assessments ? 'on' : 'off'}`,
          unreviewed === undefined
            ? null
            : unreviewed
              ? `Let ${org.name}'s assessments use questions not yet reviewed`
              : `Limited ${org.name}'s assessments to approved questions`,
          questionCount === undefined
            ? null
            : `Set ${org.name}'s assessments to ${questionCount} question${questionCount === 1 ? '' : 's'}`,
          quest === undefined ? null : `Turned ${org.name}'s Question Quest ${quest ? 'on' : 'off'}`,
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
  })
  // -------------------------------------------------------------------------
  // Phase 52: a space's code, its requests to join, leaving and deleting it
  // -------------------------------------------------------------------------

  /** The space's code and whether joining by it is on. Its admins only (R21). */
  .get('/code', requireAdmin, async (c) => {
    const code = await getSpaceCode(c.env.DB, c.get('org').id);
    const body: ApiOk<SpaceCode> = {
      data: { code: code.code ? formatSpaceCode(code.code) : null, join_by_code: code.join_by_code },
    };
    return c.json(body);
  })

  /** A new code: the old one stops working at once. Also how an existing organization gets its first. */
  .post('/code', requireAdmin, async (c) => {
    const org = c.get('org');
    const fresh = await renewSpaceCode(c.env.DB, org.id);
    await recordAudit(c.env.DB, c.get('user'), org.id, {
      action: 'organization.code_changed',
      description: `Made a new space code for ${org.name}`,
      entity_type: 'organization',
      entity_id: org.id,
    });
    const now = await getSpaceCode(c.env.DB, org.id);
    const body: ApiOk<SpaceCode> = { data: { code: formatSpaceCode(fresh), join_by_code: now.join_by_code } };
    return c.json(body);
  })

  /** Joining by code on or off. Off, the code opens nothing (a lookup is 404). */
  .put('/code', requireAdmin, zValidator('json', z.object({ join_by_code: z.boolean() })), async (c) => {
    const org = c.get('org');
    const { join_by_code: on } = c.req.valid('json');
    let code = (await getSpaceCode(c.env.DB, org.id)).code;
    if (on && !code) code = await renewSpaceCode(c.env.DB, org.id);
    await setJoinByCode(c.env.DB, org.id, on);
    await recordAudit(c.env.DB, c.get('user'), org.id, {
      action: 'organization.joining_set',
      description: `Turned joining ${org.name} by code ${on ? 'on' : 'off'}`,
      entity_type: 'organization',
      entity_id: org.id,
    });
    const body: ApiOk<SpaceCode> = { data: { code: code ? formatSpaceCode(code) : null, join_by_code: on } };
    return c.json(body);
  })

  /** Open requests to join, oldest first, with who Google says each person is. Its admins only. */
  .get('/join-requests', requireAdmin, async (c) => {
    const body: ApiOk<JoinRequest[]> = { data: await listJoinRequests(c.env.DB, c.get('org').id) };
    return c.json(body);
  })

  /** Declines a request. Letting someone in is POST /api/users with their request's id. */
  .post('/join-requests/:userId/decline', requireAdmin, async (c) => {
    const org = c.get('org');
    const userId = c.req.param('userId');
    const who = await openJoinRequest(c.env.DB, org.id, userId);
    if (!who || !(await answerJoinRequest(c.env.DB, org.id, userId, 'declined', c.get('user').id))) {
      throw ApiError.notFound('Request not found.');
    }
    await recordAudit(c.env.DB, c.get('user'), org.id, {
      action: 'membership.request_declined',
      description: `Declined ${who.full_name}'s request to join ${org.name}`,
      subject: { id: userId, full_name: who.full_name },
      entity_type: 'user',
      entity_id: userId,
    });
    return c.json({ data: { declined: true } });
  })

  /** A member leaves the space. Its last admin cannot (delete the space, or make another admin first). */
  .post('/leave', async (c) => {
    const org = c.get('org');
    const user = c.get('user');
    if (user.roles.includes('admin') && (await countAdmins(c.env.DB, org.id)) <= 1) {
      throw ApiError.conflict(`You are ${org.name}'s only administrator. Make someone else an administrator first, or delete the space.`);
    }
    await deactivateUser(c.env.DB, org.id, user.id);
    await recordAudit(c.env.DB, user, org.id, {
      action: 'membership.left',
      description: `${user.full_name} left ${org.name}`,
      subject: { id: user.id, full_name: user.full_name },
      entity_type: 'user',
      entity_id: user.id,
    });
    return c.json({ data: { left: true } });
  })

  /**
   * Deletes a self-serve space and everything in it, at its maker's request: an admin of it types
   * its name. A platform-made organization is never deleted this way. The platform log keeps only
   * that a space was deleted.
   */
  .delete('/', requireAdmin, zValidator('json', deleteSpaceSchema), async (c) => {
    const org = c.get('org');
    if (org.created_via !== 'self_serve') {
      throw new ApiError(403, 'forbidden', 'Only a space made on Aimtrue by one of its members can be deleted here.');
    }
    if (c.req.valid('json').confirm_name.toLowerCase() !== org.name.trim().toLowerCase()) {
      throw ApiError.validation('Please correct the highlighted fields.', { confirm_name: ['Type the space’s name exactly.'] });
    }
    await purgeSpace(c.env.DB, org.id);
    await recordAudit(c.env.DB, null, 'platform', {
      action: 'space.deleted',
      description: 'A space was deleted by its owner',
      entity_type: 'organization',
      entity_id: org.id,
    });
    return c.body(null, 204);
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

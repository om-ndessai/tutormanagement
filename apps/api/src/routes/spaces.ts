import { Hono } from 'hono';
import {
  DAILY_CAPS,
  DEFAULT_ORG_TIME_ZONE,
  createSpaceSchema,
  spaceCodeSchema,
  spaceNameProblem,
  type ApiOk,
  type SpaceLookup,
} from '@tmi/shared';

import { recordAudit } from '../lib/audit.js';
import { ApiError } from '../lib/errors.js';
import { orgIdFromRow } from '../lib/org.js';
import { clientAddress, rateLimit } from '../lib/rate-limit.js';
import { zValidator } from '../lib/validate.js';
import {
  answerJoinRequest,
  consoleOrganizationNames,
  countOpenRequests,
  countSpacesMadeBy,
  createJoinRequest,
  createSpace,
  findSpaceByCode,
  getOrganizationBySlug,
  markDeclinesSeen,
  spaceStanding,
} from '../repositories/organizations.js';
import { getPlatformAccount } from '../repositories/people.js';
import type { AppEnv } from '../types.js';

/**
 * Phase 52 (docs/open-signup-plan.md): what a signed-in person does before they belong to a space,
 * or to join another -- outside `requireOrg`, like the invitation routes, since they are not a
 * member yet. A code is found only while its space has joining by code on; anything else is 404,
 * so a code says nothing about whether a space exists (R21).
 */
export const spacesRoutes = new Hono<AppEnv>()

  /** What a code opens: the space's public face, and whether the person already belongs or asked. */
  .post('/lookup', zValidator('json', spaceCodeSchema), async (c) => {
    const person = c.get('person');
    await rateLimit(c, 'space_lookup', person.id);
    await rateLimit(c, 'space_lookup', clientAddress(c));
    const org = await findSpaceByCode(c.env.DB, c.req.valid('json').code);
    if (!org) throw ApiError.notFound('No space has that code.');
    const body: ApiOk<SpaceLookup> = {
      data: {
        name: org.name,
        short_name: org.short_name,
        palette: org.palette,
        logo_mark_url: org.logo_mark_url,
        standing: await spaceStanding(c.env.DB, orgIdFromRow(org.id), person.id),
      },
    };
    return c.json(body);
  })

  /** Asks to join the space a code opens. The space's admins let the person in, or decline. */
  .post('/join-requests', zValidator('json', spaceCodeSchema), async (c) => {
    const person = c.get('person');
    await rateLimit(c, 'space_write', person.id);
    const org = await findSpaceByCode(c.env.DB, c.req.valid('json').code);
    if (!org) throw ApiError.notFound('No space has that code.');
    const orgId = orgIdFromRow(org.id);
    const standing = await spaceStanding(c.env.DB, orgId, person.id);
    if (standing === 'member') throw ApiError.conflict(`You already belong to ${org.name}.`);
    if (standing === 'requested') throw ApiError.conflict(`You have already asked to join ${org.name}.`);
    if ((await countOpenRequests(c.env.DB, person.id)) >= DAILY_CAPS.open_join_requests) {
      throw new ApiError(429, 'rate_limited', 'You have too many requests waiting. Wait for an answer, or withdraw one.');
    }
    await createJoinRequest(c.env.DB, orgId, person.id);
    // In the space's own log: who asked. Its admins read it; the code itself is never logged.
    await recordAudit(c.env.DB, person, orgId, {
      action: 'membership.requested',
      description: `${person.full_name} asked to join ${org.name}`,
      subject: { id: person.id, full_name: person.full_name },
      entity_type: 'user',
      entity_id: person.id,
    });
    return c.json({ data: { requested: true, slug: org.slug } }, 201);
  })

  /** Withdraws the person's own open request. */
  .delete('/join-requests/:slug', async (c) => {
    const person = c.get('person');
    const org = await getOrganizationBySlug(c.env.DB, c.req.param('slug'));
    const orgId = org ? orgIdFromRow(org.id) : null;
    if (!org || !orgId || !(await answerJoinRequest(c.env.DB, orgId, person.id, 'withdrawn', person.id))) {
      throw ApiError.notFound('Request not found.');
    }
    await recordAudit(c.env.DB, person, orgId, {
      action: 'membership.request_withdrawn',
      description: `${person.full_name} withdrew their request to join ${org.name}`,
      subject: { id: person.id, full_name: person.full_name },
      entity_type: 'user',
      entity_id: person.id,
    });
    return c.json({ data: { withdrawn: true } });
  })

  /** The person has seen their declined requests: they are not shown again. */
  .post('/join-requests/seen', async (c) => {
    await markDeclinesSeen(c.env.DB, c.get('person').id);
    return c.json({ data: { seen: true } });
  })

  /**
   * Makes a space: adults only, three per person. Assessment alone, its code made, joining by
   * code on, and its maker as its admin. Its name may repeat; its code and address never do.
   */
  .post('/', zValidator('json', createSpaceSchema), async (c) => {
    const person = c.get('person');
    await rateLimit(c, 'space_write', person.id);
    const account = await getPlatformAccount(c.env.DB, person.id);
    // A person a space added has no age band: their space vouched for them.
    if (account && account.age_band !== 'adult') {
      throw new ApiError(403, 'forbidden', 'You need to be 18 or older to make a space. Ask a parent or teacher to make one.');
    }
    if ((await countSpacesMadeBy(c.env.DB, person.id)) >= DAILY_CAPS.spaces_per_person) {
      throw new ApiError(429, 'rate_limited', `You have made ${DAILY_CAPS.spaces_per_person} spaces, the most one person may.`);
    }
    const input = c.req.valid('json');
    const problem = spaceNameProblem(input.name, await consoleOrganizationNames(c.env.DB));
    if (problem) throw ApiError.validation('Please correct the highlighted fields.', { name: [problem] });

    const org = await createSpace(c.env.DB, {
      name: input.name,
      timeZone: input.time_zone ?? DEFAULT_ORG_TIME_ZONE,
      makerId: person.id,
      requestHost: new URL(c.req.url).hostname || 'aimtrue.invalid',
    });
    await recordAudit(c.env.DB, person, orgIdFromRow(org.id), {
      action: 'organization.created',
      description: `${person.full_name} made the space ${org.name}`,
      entity_type: 'organization',
      entity_id: org.id,
    });
    return c.json({ data: { slug: org.slug, name: org.name } }, 201);
  });

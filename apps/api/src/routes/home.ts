import { Hono } from 'hono';
import type { ApiOk, MemberHome, TutorHome } from '@tmi/shared';

import type { AppEnv } from '../types.js';
import type { OrgId } from '../lib/org.js';
import { buildTutorHome } from '../repositories/home.js';
import { buildMemberHome } from '../repositories/member-home.js';

// The tutor's Home (Phase 43, docs/tutor-home-plan.md): one read for the "Now"
// card and the next lesson's brief. Anyone may ask; it holds only the reader's
// own pairings (as a tutor), so someone who teaches nobody gets an empty Home.
export const homeRoutes = new Hono<AppEnv>()
  /**
   * Phase 66 (docs/member-home-plan.md H11, R29): the member home -- every hat's part in one read.
   * It takes no person: each part is the reader's own, narrowed like its own route. Any member, in any
   * space (each part checks its feature set); no money.
   */
  .get('/', async (c) => {
    const body: ApiOk<MemberHome> = { data: await buildMemberHome(c.env.DB, c.get('org'), c.get('user')) };
    return c.json(body);
  })
  .get('/tutor', async (c) => {
    const org = c.get('org');
    const body: ApiOk<TutorHome> = {
      data: await buildTutorHome(c.env.DB, { id: org.id as OrgId, time_zone: org.time_zone }, c.get('user')),
    };
    return c.json(body);
  });

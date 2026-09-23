import { Hono } from 'hono';
import { listAuditQuerySchema, type ApiList, type ApiOk, type AuditEvent } from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin, visibleUserIds } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { listAuditActions, listAuditEvents } from '../repositories/audit.js';

export const auditRoutes = new Hono<AppEnv>()

  /**
   * The activity feed.
   *
   * An admin sees the whole system and may narrow to one person with
   * `?user_id=`. Everyone else sees only their own activity, whatever they
   * ask for -- the restriction is applied server-side rather than by omitting
   * a filter in the UI.
   */
  .get('/', zValidator('query', listAuditQuerySchema), async (c) => {
    const viewer = c.get('user');
    const params = c.req.valid('query');

    if (!isAdmin(viewer)) {
      // A non-admin asking about someone else gets an empty feed, not an error:
      // whether that person has activity is itself information.
      const visible = await visibleUserIds(c.env.DB, viewer);

      if (params.user_id && params.user_id !== viewer.id && !visible?.has(params.user_id)) {
        throw ApiError.notFound('That user does not exist.');
      }
    }

    const { events, total } = await listAuditEvents(
      c.env.DB,
      params,
      isAdmin(viewer) ? null : viewer.id,
    );

    const body: ApiList<AuditEvent> = {
      data: events,
      meta: { total, limit: params.limit, offset: params.offset },
    };
    return c.json(body);
  })

  /** Actions actually present in the log, for the filter dropdown. */
  .get('/actions', async (c) => {
    const viewer = c.get('user');
    const body: ApiOk<string[]> = {
      data: await listAuditActions(c.env.DB, isAdmin(viewer) ? null : viewer.id),
    };
    return c.json(body);
  });

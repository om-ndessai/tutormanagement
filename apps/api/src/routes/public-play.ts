import { Hono } from 'hono';
import { z } from 'zod';
import {
  CANVAS_ASSESSMENT_LEVEL_IDS,
  PLAY_EVENT_NAMES,
  type ApiOk,
  type GuestPool,
  type QuestionBankLevelId,
} from '@tmi/shared';

import { ApiError } from '../lib/errors.js';
import { guestPlayOn } from '../lib/guest.js';
import { zValidator } from '../lib/validate.js';
import { guestPool } from '../repositories/guest.js';
import type { AppEnv } from '../types.js';

/**
 * Phase 63 (P10, P15; docs/stickiness-plan.md): the two signed-out routes of guest play, in
 * `publicRoutes` -- a deliberate decision, not a default.
 *
 * - `GET /public/guest/:version/:level`: a level's guest pool, keys and solutions included (the pool
 *   is public by design, and reserved from every member draw). Versioned, so a browser and the app keep
 *   it (`immutable`); each isolate keeps it for a few minutes, so D1 is read only on a miss. The Cache
 *   API does nothing on workers.dev, so it is not used.
 * - `POST /public/events`: anonymous counts (Analytics Engine), batched by the client. No cookie, id
 *   or IP is read or written, and no Durable Object is touched (each would cost a request).
 *
 * R26: nothing here reaches any space or person.
 */
const POOL_MEMO_MS = 5 * 60_000;
const poolMemo = new Map<string, { pool: GuestPool; at: number }>();

const eventSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(PLAY_EVENT_NAMES),
        tile: z.string().max(12).regex(/^[A-Z0-9]*$/).optional(),
        variant: z.string().max(8).regex(/^[a-z0-9]*$/).optional(),
        source: z.string().max(16).regex(/^[a-z_]*$/).optional(),
        client: z.enum(['web', 'app']).optional(),
        value: z.number().finite().min(0).max(100_000).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const publicPlayRoutes = new Hono<AppEnv>()
  .get('/guest/:version/:level', async (c) => {
    if (!(await guestPlayOn(c.env))) throw ApiError.notFound('Not found.');
    const level = c.req.param('level') as QuestionBankLevelId;
    if (!(CANVAS_ASSESSMENT_LEVEL_IDS as readonly string[]).includes(level)) throw ApiError.notFound('Not found.');
    const version = c.req.param('version').slice(0, 32);
    const key = `${version}:${level}`;
    const now = Date.now();
    let entry = poolMemo.get(key);
    if (!entry || now - entry.at > POOL_MEMO_MS) {
      entry = { pool: { level_id: level, version, questions: await guestPool(c.env.DB, level) }, at: now };
      poolMemo.set(key, entry);
    }
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    const body: ApiOk<GuestPool> = { data: entry.pool };
    return c.json(body);
  })

  .post('/events', zValidator('json', eventSchema), async (c) => {
    const { events } = c.req.valid('json');
    const dataset = c.env.PLAY_EVENTS;
    if (dataset) {
      for (const event of events) {
        // Blobs: what happened, which tile, which variant, from where, on which client. No identifier.
        dataset.writeDataPoint({
          blobs: [event.name, event.tile ?? '', event.variant ?? '', event.source ?? '', event.client ?? ''],
          doubles: [event.value ?? 1],
        });
      }
    }
    return c.body(null, 204);
  });

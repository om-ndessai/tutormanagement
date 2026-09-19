import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './types.js';
import { onError, onNotFound } from './middleware/error.js';
import { usersRoutes } from './routes/users.js';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', secureHeaders());

/**
 * In production the SPA is served by this same Worker, so requests are
 * same-origin and CORS never applies. It exists for `vite dev` on :5173 talking
 * to `wrangler dev` on :8787.
 */
app.use(
  '/api/*',
  cors({
    origin: (origin, c) =>
      c.env.ENVIRONMENT === 'production' ? '' : (origin ?? ''),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 600,
  }),
);

const api = new Hono<AppEnv>()
  .get('/health', async (c) => {
    // Touching D1 makes this a real readiness check, not just "the Worker boots".
    const probe = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();

    return c.json({
      status: probe?.ok === 1 ? 'ok' : 'degraded',
      environment: c.env.ENVIRONMENT,
      time: new Date().toISOString(),
    });
  })
  .route('/users', usersRoutes);

app.route('/api', api);

app.notFound(onNotFound);
app.onError(onError);

/**
 * Exported for typed clients later; `AppType` is what Hono's RPC client consumes.
 */
export type AppType = typeof api;

export default app;

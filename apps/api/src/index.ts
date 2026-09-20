import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { isProduction, type AppEnv } from './types.js';
import { onError, onNotFound } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { assignmentsRoutes } from './routes/assignments.js';
import { auditRoutes } from './routes/audit.js';
import { sessionsRoutes } from './routes/sessions.js';
import { usersRoutes } from './routes/users.js';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', secureHeaders());

/**
 * The only origins allowed to make credentialed cross-origin calls, and only
 * outside production. In production the SPA is served by this same Worker, so
 * every request is same-origin and no origin is permitted.
 *
 * This is an allowlist rather than an echo of whatever `Origin` arrived:
 * reflecting an arbitrary origin alongside `credentials: true` lets any site
 * read the API as the signed-in user.
 */
const DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      if (isProduction(c.env)) return '';
      return DEV_ALLOWED_ORIGINS.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
    maxAge: 600,
  }),
);

/**
 * Health is the only unauthenticated data route: it reports liveness, not
 * portal data. Everything else goes through `requireAuth`.
 */
const publicRoutes = new Hono<AppEnv>()
  .get('/health', async (c) => {
    // Touching D1 makes this a real readiness check, not just "the Worker boots".
    const probe = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();

    return c.json({
      status: probe?.ok === 1 ? 'ok' : 'degraded',
      environment: c.env.ENVIRONMENT,
      time: new Date().toISOString(),
    });
  })
  // /auth guards itself: /config and /google must be reachable while signed
  // out, /session applies requireAuth on its own.
  .route('/auth', authRoutes);

/**
 * Everything below this line requires a verified Google identity. The guard is
 * mounted on the router rather than on individual handlers, so a new route is
 * protected by default -- forgetting to add it cannot leak data.
 */
const guardedRoutes = new Hono<AppEnv>()
  .use('*', requireAuth)
  .route('/users', usersRoutes)
  .route('/audit', auditRoutes)
  .route('/assignments', assignmentsRoutes)
  .route('/sessions', sessionsRoutes);

const api = new Hono<AppEnv>().route('/', publicRoutes).route('/', guardedRoutes);

app.route('/api', api);

app.notFound(onNotFound);
app.onError(onError);

/**
 * Exported for typed clients later; `AppType` is what Hono's RPC client consumes.
 */
export type AppType = typeof api;

export default app;

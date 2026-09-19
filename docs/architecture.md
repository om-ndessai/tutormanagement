# Architecture

## One Worker, one database, one origin

```
                    ┌──────────────────────────────────────────┐
  browser  ───────► │  Cloudflare Worker  (apps/api)           │
                    │                                          │
                    │   /api/*  ──► Hono ──► repositories ──┐  │
                    │                                       │  │
                    │   everything else ──► static assets   │  │
                    │        (apps/web/dist, SPA fallback)  │  │
                    └───────────────────────────────────────┼──┘
                                                            ▼
                                                   ┌─────────────────┐
                                                   │  D1  (SQLite)   │
                                                   └─────────────────┘
```

The Worker is configured with an `assets` binding pointing at `apps/web/dist`, plus
`run_worker_first: ["/api/*"]`. Cloudflare serves a matching static file directly; anything
under `/api/` reaches the Worker; anything else with no matching file falls back to
`index.html` so React Router can handle deep links such as `/users`.

Consequences worth knowing:

- **The API and the SPA share an origin in production**, so the client uses relative `/api`
  paths and there is no CORS in play. The CORS middleware in `apps/api/src/index.ts` exists
  purely for local development, where Vite (:5173) and Wrangler (:8787) are separate origins —
  and it is disabled when `ENVIRONMENT` is `production`.
- **One `wrangler deploy` ships both**, which is what keeps this inside the free tier.
- Local dev still runs two processes, because Vite's HMR is worth the split. `npm run dev`
  starts both and Vite proxies `/api`, so the browser only ever sees one origin.

## The shared contract

`packages/shared` is a TypeScript-source package (no build step) consumed by both apps through
a path alias. It holds the Zod schemas for users and the response envelope types.

This is the main structural decision in the repo: **a field is defined once.** The Worker
parses request bodies with `createUserSchema`; the React form validates with the same schema
before sending. A rename or a new constraint cannot reach production applied to only one side,
because both sides fail to typecheck together.

## Request flow

```
POST /api/users
  │
  ├─ hono/cors, logger, secureHeaders            apps/api/src/index.ts
  ├─ zValidator('json', createUserSchema)        apps/api/src/lib/validate.ts
  │     └─ on failure: throw ApiError(422, 'validation_failed', …)
  ├─ route handler                               apps/api/src/routes/users.ts
  │     └─ createUser(c.env.DB, input)           apps/api/src/repositories/users.ts
  │           └─ INSERT … RETURNING              one round trip to D1
  └─ app.onError                                 apps/api/src/middleware/error.ts
        └─ renders { error: { code, message, details? } }
```

Layers and their one job:

| Layer | Responsibility |
| --- | --- |
| `src/index.ts` | Middleware, route mounting, health check |
| `src/routes/` | HTTP shape: parse, call a repository, choose a status code |
| `src/repositories/` | All SQL. The only place that knows about columns |
| `src/lib/errors.ts` | `ApiError` — the one way to produce a client-visible failure |
| `src/middleware/error.ts` | Turns anything thrown into the error envelope |

Handlers never build SQL, and repositories never touch `Request`/`Response`. The only strings
interpolated into SQL are sort column and direction, and both come from Zod enums.

## Frontend structure

```
src/
  main.tsx                  Providers: theme → query client → router → toaster
  App.tsx                   Routes
  index.css                 ALL design tokens (see docs/branding.md)
  components/ui/            Vendored shadcn/ui — add via CLI, avoid hand-editing
  components/layout/        App shell, header, theme toggle, page header
  components/brand/         Logo lockups
  features/users/           api.ts (query hooks), users-page, users-table, form, badges
  lib/api-client.ts         fetch wrapper → ApiRequestError
  providers/theme-provider  Owns the single `dark` class on <html>
  hooks/                    Small reusable hooks
```

Code is grouped **by feature, not by file type**. Everything the users screen needs lives in
`features/users/`; the next feature gets its own folder rather than four new files spread
across `components/`, `hooks/`, `types/` and `api/`.

Server state lives in TanStack Query, keyed by `userKeys`. Mutations invalidate `userKeys.all`,
so the table, the filters and the dashboard counters all refresh from one source. Nothing
server-derived is mirrored into `useState`.

`ApiRequestError` carries the API's `code` and `details`, which is what lets the form map a
422 back onto individual fields and what lets the query client skip retries on 4xx.

## Why these choices

- **Hono** over a hand-rolled `fetch` handler: routing, typed middleware and a validator hook,
  in ~14 kB, with first-class Workers support.
- **D1** because it is the free-tier relational option and SQLite is a good fit for a roster of
  this size. Queries stay plain SQL — no ORM — because the schema is small and D1's batching
  and `RETURNING` support are easier to use directly.
- **Tailwind v4 with CSS-first tokens** so theming is a stylesheet, not a JS config object, and
  so dark mode is a token swap rather than per-component variants.
- **shadcn/ui** because the components are copied into the repo: they can be read and edited
  in place, which matters when agents are doing the editing.

## Deliberately absent

No auth (phase 1 is intentionally public), no tests or CI yet, no ESLint/Prettier config, no
rate limiting, no audit log. Add them when asked, not opportunistically.

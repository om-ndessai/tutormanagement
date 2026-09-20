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
  ├─ requireAuth                                 apps/api/src/middleware/auth.ts
  │     ├─ read signed session cookie -> user id
  │     ├─ re-read the user row from D1 (live? suspended?)
  │     └─ on failure: throw ApiError(401 | 403)
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
| `src/index.ts` | Middleware, route mounting, and the public/guarded split |
| `src/middleware/auth.ts` | `requireAuth` — the gate on every data route |
| `src/lib/google.ts` | Verifies Google ID tokens. The security boundary of sign-in |
| `src/lib/session.ts` | Signs and reads the stateless session cookie |
| `src/routes/` | HTTP shape: parse, call a repository, choose a status code |
| `src/repositories/` | All SQL. The only place that knows about columns |
| `src/lib/errors.ts` | `ApiError` — the one way to produce a client-visible failure |
| `src/middleware/error.ts` | Turns anything thrown into the error envelope |

Handlers never build SQL, and repositories never touch `Request`/`Response`. The only strings
interpolated into SQL are sort column and direction, and both come from Zod enums.

## Authentication

Sign-in is client-side Google Identity Services with a server-side trust boundary:

```
browser                          Worker                        Google
  │                                │                             │
  │ GET /api/auth/config ─────────►│                             │
  │◄──────── { google_client_id }  │                             │
  │                                │                             │
  │ renders Google's button, user clicks, Google returns an ID token
  │                                │                             │
  │ POST /api/auth/google ────────►│                             │
  │    { credential }              │ fetch JWKS ────────────────►│
  │                                │ verify sig / iss / aud / exp│
  │                                │ match users.email           │
  │◄─── Set-Cookie: tmi_session ───│                             │
```

Four things are worth knowing:

**The client id is served, not bundled.** `GET /api/auth/config` hands it to the SPA at
runtime, so it is configured once in `wrangler.jsonc` and changing it needs no frontend
rebuild. It is public by design — it is sent to every browser.

**The ID token is the only thing the browser supplies, and it is never trusted as-is.**
`verifyGoogleIdToken` checks the signature against Google's published keys plus the issuer,
the audience (binding the token to *this* app) and expiry. An email that did not come out of
that function is not an identity.

**Sessions are stateless, but revocation is not.** The cookie is an HMAC-signed token
carrying only a user id — there is no sessions table. Role and status are deliberately left
out and the user row is re-read on every request, so suspending or deactivating someone takes
effect on their next request rather than whenever their cookie happens to expire. That is one
indexed primary-key read per request, and it is the reason the stateless design is safe here.

**The guard is mounted on the router, not on handlers.** In `src/index.ts` the API splits into
`publicRoutes` (health, auth) and `guardedRoutes` (everything else, behind `requireAuth`). A
new route added under the guarded router is protected without anyone remembering to protect
it; exposing one publicly takes a deliberate move.

`AUTH_ENABLED: "false"` swaps the whole thing for a fixed identity (`DEV_USER_EMAIL`, or the
first admin) so later phases can be built without signing in. Only the exact string `"false"`
disables it, and the profile page shows a banner whenever it is off.

## Frontend structure

```
src/
  main.tsx                  Providers: theme → query client → router → toaster
  App.tsx                   Routes
  index.css                 ALL design tokens (see docs/branding.md)
  components/ui/            Vendored shadcn/ui — add via CLI, avoid hand-editing
  components/layout/        App shell, header, theme toggle, page header
  components/brand/         Logo lockups
  features/auth/            login page, Google button, RequireAuth route guard
  features/users/           api.ts (query hooks), users-page, users-table, form, badges
  lib/api-client.ts         fetch wrapper → ApiRequestError; broadcasts 401s
  providers/auth-provider   Session lifecycle: config, sign-in, sign-out
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
422 back onto individual fields, the login page give each sign-in failure its own next step,
and the query client skip retries on 4xx.

A 401 from *any* request — including one buried in a background refetch — dispatches a
`tmi:unauthenticated` window event that `AuthProvider` listens for. That is how an expired
session drops the whole app back to the login screen without every call site handling it.
`RequireAuth` is a UX convenience only; the Worker is what actually enforces access.

## Why these choices

- **Hono** over a hand-rolled `fetch` handler: routing, typed middleware and a validator hook,
  in ~14 kB, with first-class Workers support.
- **D1** because it is the free-tier relational option and SQLite is a good fit for a roster of
  this size. Queries stay plain SQL — no ORM — because the schema is small and D1's batching
  and `RETURNING` support are easier to use directly.
- **`jose`** for both Google token verification and session signing, rather than hand-rolling
  JWT/JWKS on Web Crypto. Key rotation, algorithm confusion and claim validation are exactly
  the places where hand-rolled crypto goes wrong.
- **Tailwind v4 with CSS-first tokens** so theming is a stylesheet, not a JS config object, and
  so dark mode is a token swap rather than per-component variants.
- **shadcn/ui** because the components are copied into the repo: they can be read and edited
  in place, which matters when agents are doing the editing.

## Deliberately absent

No authorization *within* the portal — any signed-in user can manage users; the plan puts
role-based permissions with the Phase 2 data model. No tests or CI yet, no ESLint/Prettier
config, no rate limiting on the sign-in route, no audit log. Add them when asked, not
opportunistically.

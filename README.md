# TMI Portal

Tutor management portal for the [Mathematics Institute of the Triangle](https://trianglemathinstitute.com/).

Runs on Cloudflare's free tier: a single Worker serves the JSON API **and** hosts the built
React SPA, backed by one D1 (SQLite) database.

Roadmap lives in [docs/plan.md](docs/plan.md).

- **Phase 1 (done):** Google sign-in. The only way in, and every API route that serves portal
  data requires a verified Google identity.
- **Phase 2 (done):** the data model — admins, tutors, students and parents, where one person
  can hold several roles at once, with role profiles, availability, payment handles and
  parent/guardian relationships. See [docs/data-model.md](docs/data-model.md).
- **Phase 3 (done):** an append-only audit log of every action.
- **Phase 4 (done):** tutor rates, student assignments, and session recording with billing.
- **Phase 5 (done):** payment tracking and balances for tutors and families.
- **Phase 6 (done):** Playwright end-to-end tests driving the deployed portal.

## Stack

| Layer | Choice |
| --- | --- |
| Database | Cloudflare D1 (SQLite), SQL migrations |
| API | Cloudflare Workers + [Hono](https://hono.dev) |
| Frontend | Vite, React 19, TypeScript, React Router, TanStack Query |
| Styling | Tailwind CSS v4 (CSS-first tokens) + [shadcn/ui](https://ui.shadcn.com) |
| Auth | Google Identity Services in the browser, ID token verified in the Worker with `jose` |
| Validation | Zod schemas shared by the Worker and the browser |

## Getting started

Requires Node 20.19+ (see `.nvmrc`) and a Cloudflare account for deploys.

```bash
npm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # then put a real secret in it
npm run db:reset                                    # create the local tables + sample staff
npm run dev                                         # Worker on :8787, Vite on :5173
```

Open **http://localhost:5173** — Vite proxies `/api` to the Worker, so the app uses the same
relative URLs it will use in production.

**Before you can sign in**, you need a Google OAuth client ID and a session secret. Follow
[docs/google-oauth-setup.md](docs/google-oauth-setup.md) — it covers the Google Cloud side, the
two config values, and bootstrapping the first admin.

To work on the app without signing in every time, set `"AUTH_ENABLED": "false"` in
`apps/api/wrangler.jsonc`. Every request then runs as `DEV_USER_EMAIL`, or the first admin if
that is empty — set it to a non-admin to exercise the authorization paths. That setting makes
the portal public, so keep it out of deploys.

## Layout

```
apps/api/          Worker: Hono routes, auth, D1 repositories, db/schema.sql + seed
apps/web/          React SPA: theme tokens, shadcn/ui components, feature folders
packages/shared/   Zod schemas + types imported by both sides
docs/              Architecture, database and branding references
```

## Common commands

```bash
npm run dev            # API + web together
npm run dev:api        # Worker only, http://127.0.0.1:8787
npm run dev:web        # SPA only, http://localhost:5173
npm run typecheck      # all three packages
npm run build          # build the SPA to apps/web/dist
npm run db:rebuild     # DROP and recreate local tables from apps/api/db/schema.sql
npm run db:seed        # reload sample data into local D1
npm run db:reset       # rebuild + seed
npm run db:studio      # dump the users table
npm run deploy         # build the SPA, then wrangler deploy
```

## First deploy

```bash
npm run db:create                    # prints a database_id
# paste that id into apps/api/wrangler.jsonc
npm run db:rebuild:remote            # create the schema in production
cd apps/api && npx wrangler secret put SESSION_SECRET && cd ../..
npm run deploy
```

`db:rebuild:remote` drops every table first, so it is a first-deploy / greenfield command,
not something to run against live data.

`wrangler deploy` uploads the Worker and `apps/web/dist` together, so the API and the portal
share one origin and one domain.

## Documentation

- [docs/plan.md](docs/plan.md) — the phased roadmap
- [docs/testing.md](docs/testing.md) — the end-to-end suite, and what running it destroys
- [docs/data-model.md](docs/data-model.md) — the Phase 2 model: why each table exists, and which rules the database cannot enforce
- [docs/architecture.md](docs/architecture.md) — how the pieces fit, request flow, conventions
- [docs/google-oauth-setup.md](docs/google-oauth-setup.md) — creating the Google client ID, secrets, first admin
- [docs/database.md](docs/database.md) — schema, migration workflow, D1 notes
- [docs/branding.md](docs/branding.md) — brand colors, typography, logo assets, theming
- [CLAUDE.md](CLAUDE.md) — working agreements for AI agents in this repo

## API

All routes are under `/api`. Responses are `{ data }`, `{ data, meta }` for lists, or
`{ error: { code, message, details? } }`.

Everything except `/api/health` and `/api/auth/config|google|logout` requires a session
cookie and returns `401 unauthenticated` without one.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Also probes D1 |
| `GET` | `/api/auth/config` | public | Google client id + whether auth is on |
| `POST` | `/api/auth/google` | public | Exchanges a Google ID token for a session cookie |
| `GET` | `/api/auth/session` | required | The signed-in user |
| `POST` | `/api/auth/logout` | public | Clears the cookie |
| `GET` | `/api/users` | required | `search`, `role` (holds it), `status`, `include_deleted`, `sort`, `order`, `limit`, `offset` |
| `POST` | `/api/users` | **admin** | User + roles + profiles + availability + guardians in one call |
| `GET` | `/api/users/:id` | required | The full graph: roles, role profiles, availability, payment, family |
| `PATCH` | `/api/users/:id` | **admin** | Partial; supplying a section replaces it wholesale |
| `DELETE` | `/api/users/:id` | **admin** | Soft delete; `?hard=true` removes the row and cascades |
| `POST` | `/api/users/:id/restore` | **admin** | Undo a soft delete |

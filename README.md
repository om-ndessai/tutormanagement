# TMI Portal

Tutor management portal for the [Mathematics Institute of the Triangle](https://trianglemathinstitute.com/).

Runs on Cloudflare's free tier: a single Worker serves the JSON API **and** hosts the built
React SPA, backed by one D1 (SQLite) database.

- **Phase 1 (this repo today):** staff directory — create, edit, deactivate and restore admins
  and tutors. No authentication; every endpoint is public.
- **Planned:** Google social login, then students, parents, classes and scheduling.

## Stack

| Layer | Choice |
| --- | --- |
| Database | Cloudflare D1 (SQLite), SQL migrations |
| API | Cloudflare Workers + [Hono](https://hono.dev) |
| Frontend | Vite, React 19, TypeScript, React Router, TanStack Query |
| Styling | Tailwind CSS v4 (CSS-first tokens) + [shadcn/ui](https://ui.shadcn.com) |
| Validation | Zod schemas shared by the Worker and the browser |

## Getting started

Requires Node 20.19+ (see `.nvmrc`) and a Cloudflare account for deploys.

```bash
npm install
npm run db:reset   # create the local D1 tables and load sample staff
npm run dev        # Worker on :8787, Vite on :5173
```

Open **http://localhost:5173** — Vite proxies `/api` to the Worker, so the app uses the same
relative URLs it will use in production.

## Layout

```
apps/api/          Worker: Hono routes, D1 repositories, SQL migrations, dev seed
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
npm run db:migrate     # apply migrations to local D1
npm run db:seed        # reload sample data into local D1
npm run db:reset       # migrate + seed
npm run db:studio      # dump the users table
npm run deploy         # build the SPA, then wrangler deploy
```

## First deploy

```bash
npm run db:create                # prints a database_id
# paste that id into apps/api/wrangler.jsonc
npm run db:migrate:remote        # create the schema in production
npm run deploy
```

`wrangler deploy` uploads the Worker and `apps/web/dist` together, so the API and the portal
share one origin and one domain.

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the pieces fit, request flow, conventions
- [docs/database.md](docs/database.md) — schema, migration workflow, D1 notes
- [docs/branding.md](docs/branding.md) — brand colors, typography, logo assets, theming
- [CLAUDE.md](CLAUDE.md) — working agreements for AI agents in this repo

## API

All routes are under `/api`. Responses are `{ data }`, `{ data, meta }` for lists, or
`{ error: { code, message, details? } }`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Also probes D1 |
| `GET` | `/api/users` | `search`, `role`, `status`, `include_deleted`, `sort`, `order`, `limit`, `offset` |
| `POST` | `/api/users` | 409 on duplicate email, 422 on validation failure |
| `GET` | `/api/users/:id` | |
| `PATCH` | `/api/users/:id` | Partial; omitted fields are left alone, `phone: null` clears |
| `DELETE` | `/api/users/:id` | Soft delete; `?hard=true` removes the row |
| `POST` | `/api/users/:id/restore` | Undo a soft delete |

# CLAUDE.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

The staff/tutor management portal for the **Mathematics Institute of the Triangle**
(trianglemathinstitute.com). It runs entirely on Cloudflare's free tier: one Worker serves
both a JSON API and the built React SPA, backed by one D1 (SQLite) database.

**Current phase: 1 — user management.** The portal manages staff (admins and tutors) only.
There is **no authentication yet**; every endpoint is public. Google social login is planned
for a later phase. Do not add auth, students, parents, classes or scheduling unless asked.

## Layout

```
apps/api/          Cloudflare Worker: Hono routes, D1 access, SQL migrations
apps/web/          Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
packages/shared/   Zod schemas and types imported by BOTH sides
docs/              Architecture, database and branding references
```

`packages/shared` is the contract. A field only exists once: define it there, and the Worker
and the React app both get validation and types from the same definition.

## Commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Worker on :8787 and Vite on :5173 together. **Use http://localhost:5173** — Vite proxies `/api` to the Worker. |
| `npm run db:migrate` | Apply migrations to the **local** D1 |
| `npm run db:seed` | Reset local data to `apps/api/seed/dev-seed.sql` |
| `npm run db:reset` | Migrate, then seed |
| `npm run db:studio` | Dump the users table from local D1 |
| `npm run typecheck` | Typecheck all three packages — run this before declaring work done |
| `npm run build` | Build the SPA into `apps/web/dist` |
| `npm run deploy` | Build the SPA, then `wrangler deploy` |

`npm run db:migrate:remote` is the only command that touches production data. Never run it,
or any `--remote` wrangler command, without being asked.

## Rules

**Schema changes go in a new migration.** Add `apps/api/migrations/NNNN_description.sql` with
the next number. Never edit an applied migration — `0001_create_users.sql` is already applied
locally and (once deployed) remotely. After adding one, run `npm run db:migrate`.

**Validation lives in `packages/shared`.** Do not write ad-hoc validation in a route handler
or a form. Add or change the Zod schema, then use it on both sides. Note the split between
`userFieldsSchema` (no defaults, the basis for PATCH) and `createUserSchema` (adds defaults) —
a `.default()` survives `.partial()`, which would make PATCH silently overwrite omitted fields.

**SQL lives in `apps/api/src/repositories/`.** Route handlers translate HTTP to repository
calls and back; they never build SQL. Always bind parameters — the only values interpolated
into SQL are ones that came from a Zod enum (sort column, sort direction).

**Deletes are soft.** `DELETE /api/users/:id` sets `deleted_at`. Hard delete needs an explicit
`?hard=true`. The unique email index covers live rows only, so restoring can conflict; that
case is already handled in `POST /api/users/:id/restore`.

**Every response uses the shared envelope**: `{ data }`, `{ data, meta }` for lists, or
`{ error: { code, message, details? } }`. Throw `ApiError` from a handler rather than building
an error response by hand.

**Colors come from tokens, never from literals.** `apps/web/src/index.css` holds a brand ramp
(`--brand-50` … `--brand-950`, sampled from the institute logo) and the semantic tokens
components consume (`--primary`, `--muted`, `--sidebar`, …). Use Tailwind classes that map to
them (`bg-primary`, `text-muted-foreground`, `bg-brand-100`). Never hardcode a hex value or a
palette utility like `bg-purple-700` in a component — it will not follow dark mode.

**`apps/web/src/components/ui/` is vendored shadcn/ui.** Add components with
`npm run ui:add --workspace @tmi/web -- <name>`, not by hand. The CLI writes
`import { cn } from "cn"` — correct it to `@/lib/utils`. Avoid editing these files otherwise;
app-specific components belong in `components/` or `features/`.

**Feature code is grouped by feature.** `apps/web/src/features/users/` holds that feature's
query hooks, table, form and badges. Follow that shape for the next feature rather than
splitting by file type.

## Verifying a change

There is no test suite yet, so verify by running things:

1. `npm run typecheck` — must be clean.
2. For API work: `npm run dev:api`, then curl the endpoint, including the failure paths
   (validation, duplicate email, missing id).
3. For UI work: `npm run dev` and load http://localhost:5173.

## Gotchas

- Wrangler needs `apps/web/dist` to exist; `npm run dev:api` creates it via a `predev` step.
- After changing `packages/shared`, restart `wrangler dev` — it does not always pick up
  changes in a linked workspace.
- `wrangler.jsonc` ships with a placeholder `database_id`. Local D1 ignores it; remote
  commands need the real id from `npm run db:create`.

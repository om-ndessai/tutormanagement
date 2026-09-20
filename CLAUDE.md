# CLAUDE.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

The staff/tutor management portal for the **Mathematics Institute of the Triangle**
(trianglemathinstitute.com). It runs entirely on Cloudflare's free tier: one Worker serves
both a JSON API and the built React SPA, backed by one D1 (SQLite) database.

`docs/plan.md` is the authoritative roadmap. **Phase 1 (done): Google sign-in.** It is the
only way in — every `/api` route except `/api/health` and `/api/auth/*` requires a verified
Google identity. The portal still manages staff (admins and tutors) only.

**Phase 2 (next): the real data model** — multi-role users covering admins, tutors, students
and parents. Do not build students, parents, classes or scheduling until then.

## Layout

```
apps/api/          Cloudflare Worker: Hono routes, auth, D1 access, db/schema.sql
apps/web/          Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
packages/shared/   Zod schemas and types imported by BOTH sides
docs/              plan.md (roadmap), architecture, database, branding, Google setup
```

`packages/shared` is the contract. A field only exists once: define it there, and the Worker
and the React app both get validation and types from the same definition.

## Commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Worker on :8787 and Vite on :5173 together. **Use http://localhost:5173** — Vite proxies `/api` to the Worker. |
| `npm run db:rebuild` | **Drops and recreates** every local table from `apps/api/db/schema.sql` |
| `npm run db:seed` | Reload local data from `apps/api/db/seed.sql` |
| `npm run db:reset` | Rebuild, then seed |
| `npm run db:studio` | Dump the users table from local D1 |
| `npm run typecheck` | Typecheck all three packages — run this before declaring work done |
| `npm run build` | Build the SPA into `apps/web/dist` |
| `npm run deploy` | Build the SPA, then `wrangler deploy` |

`npm run db:rebuild:remote` **destroys all production data**. Never run it, or any `--remote`
wrangler command, without being asked.

## Rules

**There are no migrations.** This is a greenfield project: `apps/api/db/schema.sql` is the
single source of truth, and `npm run db:rebuild` drops and recreates everything from it. To
change the data model, edit that file and re-run `npm run db:reset`. Do not add a migrations
folder or numbered migration files.

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

**New API routes are authenticated by default.** `requireAuth` is mounted on the guarded
router in `apps/api/src/index.ts`, not on individual handlers, so anything added under it
inherits the gate. A route that must be reachable signed-out goes in `publicRoutes` — and
that is a deliberate decision, not a default. Inside a guarded handler, `c.get('user')` is
always the live, re-checked user.

**Never trust an email that did not come out of `verifyGoogleIdToken`.** The browser supplies
an opaque Google ID token; `apps/api/src/lib/google.ts` is the only place it becomes an
identity, and it is the whole security boundary of sign-in.

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
   (validation, duplicate email, missing id). A new data route must return 401 without a
   session cookie — check that explicitly.
3. For UI work: `npm run dev` and load http://localhost:5173. To skip signing in, set
   `AUTH_ENABLED: "false"` in `apps/api/wrangler.jsonc`.

## Gotchas

- Wrangler needs `apps/web/dist` to exist; `npm run dev:api` creates it via a `predev` step.
- After changing `packages/shared`, restart `wrangler dev` — it does not always pick up
  changes in a linked workspace.
- Sessions are stateless (signed cookie, no sessions table) but the user row is re-read from
  D1 on every request, so suspending someone takes effect immediately. Do not "optimise" that
  lookup away.
- `SESSION_SECRET` comes from `apps/api/.dev.vars` locally (gitignored; copy
  `.dev.vars.example`) and `wrangler secret` in production. Without it, sign-in fails hard.
- `GOOGLE_CLIENT_ID` is public and lives in `wrangler.jsonc`. The SPA reads it from
  `/api/auth/config` at runtime, so changing it needs no frontend rebuild.
- See `docs/google-oauth-setup.md` for the Google Cloud side.

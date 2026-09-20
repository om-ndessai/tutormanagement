# CLAUDE.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

The staff/tutor management portal for the **Mathematics Institute of the Triangle**
(trianglemathinstitute.com). It runs entirely on Cloudflare's free tier: one Worker serves
both a JSON API and the built React SPA, backed by one D1 (SQLite) database.

`docs/plan.md` is the authoritative roadmap.

**Phase 1 (done): Google sign-in.** It is the only way in — every `/api` route except
`/api/health` and `/api/auth/*` requires a verified Google identity. `AUTH_ENABLED` is `"true"`
in the committed config; flipping it to `"false"` is a local convenience, not something to
deploy.

**Phase 2 (done): the data model.** Admins, tutors, students and parents, where one person can
hold several roles at once. Read `docs/data-model.md` before touching the schema — it explains
why each table is where it is, and which rules the database cannot enforce.

**Next: classes and scheduling.** Do not build `classes`, `enrollments`, `sessions` or
tutor-to-student assignment until asked.

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

**A person is one `users` row; what they do is `user_roles`.** Never add a `role` column, and
never add `is_tutor`-style booleans. Before putting an attribute on `tutor_profiles` or
`student_profiles`, ask whether two people holding different roles could sensibly disagree about
it — if not, it belongs to the person (like `payment_handles` and `availability_slots`, which
are keyed on `user_id` for exactly this reason).

**A profile row exists only while its role is held.** Dropping a role deletes its profile, in
the same batch as the role change (`profileCleanupStatements` in the users repository).

**Three rules live in the API because SQL cannot express them**, and they are easy to break by
accident: a student must have at least one guardian (which is why creating a student and naming
their parent is ONE request), only admins may mutate users (`requireAdmin`), and the profile
rule above. See `docs/data-model.md`.

**A person is one `users` row; what they do is `user_roles`.** Never add a `role` column, and
never add `is_tutor`-style booleans. Before putting an attribute on `tutor_profiles` or
`student_profiles`, ask whether two people holding different roles could sensibly disagree about
it — if not, it belongs to the person (like `payment_handles` and `availability_slots`, which
are keyed on `user_id` for exactly this reason).

**A profile row exists only while its role is held.** Dropping a role deletes its profile, in
the same batch as the role change. `profileCleanupStatements` in the users repository does this.

**Three rules live in the API because SQL cannot express them**, and they are easy to break by
accident: a student must have at least one guardian (which is why creating a student and naming
their parent is ONE request), only admins may mutate users (`requireAdmin`), and the profile
rule above. See `docs/data-model.md`.

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

**Money is integer cents, never floats.** `formatCents` / `parseCentsInput` in
`packages/shared/src/teaching.ts` are the only conversions. Amounts and durations are always
derived on the server: a client may send times, never a price.

**Every action a user takes gets an audit event.** Adding a route that changes data means
adding a `recordAudit` call and an entry in `AUDIT_ACTIONS` in `packages/shared/src/audit.ts`.
The action name is `<entity>.<verb>`; the description is a finished sentence naming the person,
because it is written once and never reconstructed. Never update or delete `audit_events` rows.

**Every response uses the shared envelope**: `{ data }`, `{ data, meta }` for lists, or
`{ error: { code, message, details? } }`. Throw `ApiError` from a handler rather than building
an error response by hand.

**Colors come from tokens, never from literals.** `apps/web/src/index.css` holds a brand ramp
(`--brand-50` … `--brand-950`, sampled from the institute logo) and the semantic tokens
components consume (`--primary`, `--muted`, `--sidebar`, …). Use Tailwind classes that map to
them (`bg-primary`, `text-muted-foreground`, `bg-brand-100`). Never hardcode a hex value or a
palette utility like `bg-purple-700` in a component — it will not follow dark mode.

**`apps/web/src/components/ui/` is vendored shadcn/ui.** Add components with
`npm run ui:add --workspace @tmi/web — <name>`, not by hand. The CLI writes
`import { cn } from "cn"` — correct it to `@/lib/utils`. Avoid editing these files otherwise;
app-specific components belong in `components/` or `features/`.

**Feature code is grouped by feature.** `apps/web/src/features/users/` holds that feature's
query hooks, table, form and badges. Follow that shape for the next feature rather than
splitting by file type.

## End-to-end tests

`npm run e2e` deploys and tests `tmi-portal-test`, a separate Worker with its own database
(`tmi-portal-test-db`) and authentication permanently off. It wipes that database every run.
**It never touches production.** `npm run e2e:test` runs the suite without deploying or wiping.

The test environment is a named `env` in `apps/api/wrangler.jsonc`. Named environments do not
inherit `assets`, `d1_databases` or `vars`, so all of them are restated there — deliberately,
so this environment cannot reach production's database. Do not "tidy" that duplication away.

The suite acts as different people with an `X-Dev-User` header, honoured only while
`AUTH_ENABLED` is `"false"`. Set it on the browser context, never per request — two values
make the header ambiguous.

## Verifying a change

There is no test suite yet, so verify by running things:

1. `npm run typecheck` — must be clean.
2. For API work: `npm run dev:api`, then curl the endpoint, including the failure paths
   (validation, duplicate email, missing id). A new data route must return 401 without a
   session cookie — check that explicitly.
3. For UI work: `npm run dev` and load http://localhost:5173. To skip signing in, set
   `AUTH_ENABLED` is already `"false"`; set `DEV_USER_EMAIL` to a non-admin from the seed to
   check authorization paths, and flip `AUTH_ENABLED` to `"true"` to test sign-in.
4. After a schema change, run the audit query in `docs/data-model.md` ("students missing a
   parent") — it catches invariant breaks the database cannot.

## Gotchas

- Wrangler needs `apps/web/dist` to exist; `npm run dev:api` creates it via a `predev` step.
- After changing `packages/shared`, restart `wrangler dev` — it does not always pick up
  changes in a linked workspace.
- Sessions are stateless (signed cookie, no sessions table) but the user row is re-read from
  D1 on every request, so suspending someone takes effect immediately. Do not "optimise" that
  lookup away.
- With `AUTH_ENABLED=false` the API still needs somebody to run as. It falls back through
  DEV_USER_EMAIL -> first admin -> any user -> a placeholder admin it creates. That last step
  exists because rebuilding the database empties it, and an empty directory used to take the
  whole portal down with a 503.
- `SESSION_SECRET` comes from `apps/api/.dev.vars` locally (gitignored; copy
  `.dev.vars.example`) and `wrangler secret put SESSION_SECRET` in production. Without it,
  every authenticated request returns 503 `not_configured`.
- **`vars` in `wrangler.jsonc` are what a DEPLOY ships with**, so they hold the *production*
  values (`ENVIRONMENT: "production"`). `.dev.vars` overrides them during `wrangler dev`.
  Do not "fix" `ENVIRONMENT` back to `development` in `wrangler.jsonc` — that shipped
  dev-mode CORS to production once already.
- Production's database is **not** rebuilt from `db/schema.sql`; it holds real data. Carry
  schema changes there by hand — see `docs/database.md`.
- `GOOGLE_CLIENT_ID` is public and lives in `wrangler.jsonc`. The SPA reads it from
  `/api/auth/config` at runtime, so changing it needs no frontend rebuild.
- See `docs/google-oauth-setup.md` for the Google Cloud side.

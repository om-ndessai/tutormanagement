# CLAUDE.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

The staff/tutor management portal for the **Mathematics Institute of the Triangle**
(trianglemathinstitute.com). It runs entirely on Cloudflare's free tier: one Worker serves
both a JSON API and the built React SPA, backed by one D1 (SQLite) database.

`docs/plan.md` is the authoritative roadmap.

**Phases 1 to 12 are built.** In short: Google sign-in (1), the people model (2), the audit
log (3), recorded sessions (4), payments and balances (5), the admin's view of anyone's
dashboard (6→8), live session timers (7), recurring schedules and calendar files (9), CSV
exports (10), the deployed test environment (11), and comments (12).

Two of those shape everything else. **Sign-in is the only way in** — every `/api` route except
`/api/health` and `/api/auth/*` requires a verified Google identity, and `AUTH_ENABLED` is
`"true"` in the committed config; flipping it to `"false"` is a local convenience, not
something to deploy. **The people model** is admins, tutors, students and parents, where one
person may hold several roles at once: read `docs/data-model.md` before touching the schema, as
it explains why each table is where it is and which rules the database cannot enforce.

**Ask before starting the next phase.** `docs/plan.md` is the roadmap, but it is a plan, not a
licence — do not build ahead of what has been asked for.

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

**A lesson has two rates, and conflating them erases the institute's margin.** The tutor is
paid `tutor_rate_cents` (from `tutor_profiles`, overridable per pairing on `assignments`); the
family is charged `charge_rate_cents` (from `student_profiles`, no override). Both are frozen
onto the session. The margin is always derived, never stored. Never make one column serve both
sides -- that is the bug these columns were split to fix. Each party sees only their own side:
`scopeSessionMoney` and `scopeStudentCharges` enforce that in the API, so do not return a
session or a student profile from a new route without them.

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

**Two rounding rules, deliberately different.** `roundToQuarterHour` rounds a DURATION — a
session typed in afterwards, and the measured length of a live one. `roundClockToQuarter` snaps
a wall-clock ENDPOINT, which the live timer does to the start. Do not collapse them. A live
lesson's length comes from the two instants and its end is derived from the start plus that
length: subtracting two separately snapped endpoints drifts a full quarter whenever they round
opposite ways, and that was a real billing bug.

**A comment is readable by fewer people than the thing it hangs off, never more.** On a
session, assignment or scheduled session the audience is that row's tutor, student, the
student's guardians and admins (`teachingScopeSql`). On a PERSON it is narrower — admins, the
author, that person and their guardians — which is what keeps one tutor's remark about a family
off another tutor's screen. Every route in `routes/comments.ts` resolves the TARGET and checks
it before touching a comment, and reports a target the viewer may not see as missing rather
than forbidden. The thread, the count badges and the global feed at `/comments` all build
their WHERE from the same two fragments (`personScopeSql`, `teachingScopeSql`) — never write a
fourth copy of the rule. Comments are never editable (no `updated_at`, no PATCH route) and only their
author may delete them — not admins. Never put comment text in an audit description: the log is
read by admins, and a comment is not theirs by default.

**A live lesson has a maximum length, and the API enforces it.**
`tutor_profiles.max_session_minutes` and `student_profiles.max_session_minutes` each hold the
longest lesson that person does; the SHORTER of the two applies, and `DEFAULT_MAX_SESSION_MINUTES`
covers a pairing where neither is set (`effectiveMaxSessionMinutes`). A running lesson that
reaches its limit is recorded at it and flagged `auto_stopped`, by `autoStopExpired` — from the
cron trigger in `wrangler.jsonc` and from every read of the live sessions. The cap applies to a
late manual stop too, so it cannot be sidestepped. It deliberately does NOT apply to a session
typed in afterwards or to an edit: a person vouching for what happened outranks the cap, and
correcting the times is how a wrongly cut session gets fixed (which clears the flag).

**An instant becomes a clock time only through `zonedClockParts`.** The Worker runs in UTC and a
browser runs wherever its owner is, so reading UTC parts off a live session shifted every lesson
by the institute's offset. `INSTITUTE_TIME_ZONE` in `packages/shared/src/teaching.ts` is the one
clock a lesson is recorded against.

**Exports and calendar files are plain links, not fetches.** The session cookie goes along and
the browser names the file from `Content-Disposition`. `lib/csv.ts` neutralises formula-leading
characters and writes a BOM; do not hand-roll a CSV writer next to it.

**Several screens ship two layouts**: cards below `md`/`sm` and a table above, both in the DOM.
A bare `getByText` in a test then matches twice and `.first()` can pick the hidden one — use
the `visible()` helper in `e2e/support/ui.ts`. Presence assertions target the rendered layout;
absence assertions stay on the full DOM, because a name must be in neither.

**Headers and filter rows must stack on phones, not shrink.** Flexbox shrinks items before it
wraps them, so a row of fixed-width controls pushes the document wider than the viewport and
every card on the page runs off the edge. `responsive.spec.ts` asserts zero horizontal overflow
on every page at 390px and 360px.

**`apps/api/db/seed.sql` is generated, not hand-edited.** Change `db/generate-seed.mjs` and run
`npm run db:seed:generate --workspace @tmi/api`. The generator owns the invariants the API
enforces (every student has a guardian, every session has an assignment, amount = rate x
minutes / 60), and pairs generated people only with each other so bulk data cannot change who
can see whom.

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

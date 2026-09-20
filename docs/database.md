# Database

Cloudflare D1 — SQLite at the edge. One database, `tmi-portal-db`, bound to the Worker as
`DB` in `apps/api/wrangler.jsonc`.

## Schema

### `users`

Phase 1 covers **staff only**: admins and tutors. Students, parents and guardians will get
their own tables alongside classes and scheduling.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID v4 from `crypto.randomUUID()` |
| `email` | TEXT NOT NULL | Stored lowercased and trimmed by the Zod schema |
| `full_name` | TEXT NOT NULL | Single field — names do not split reliably |
| `phone` | TEXT NULL | Free-form; only ever displayed back |
| `role` | TEXT NOT NULL | `admin` \| `tutor` (CHECK constraint) |
| `status` | TEXT NOT NULL | `active` \| `invited` \| `suspended`, default `active` |
| `google_sub` | TEXT NULL | Google's permanent id for the account, pinned on first sign-in. Matching is on **email** (admins create rows before anyone signs in), but `sub` survives a Google account changing address |
| `created_at` | TEXT NOT NULL | ISO-8601 UTC, ms precision |
| `updated_at` | TEXT NOT NULL | Same format; see the trigger below |
| `last_login_at` | TEXT NULL | Set on every successful Google sign-in |
| `deleted_at` | TEXT NULL | Soft delete marker; `NULL` means live |

Indexes:

| Index | Purpose |
| --- | --- |
| `users_email_unique` on `lower(email)` **where `deleted_at IS NULL`** | One live user per address, case-insensitively. Partial, so a deactivated person's address can be reused |
| `users_google_sub_unique` on `google_sub` where not null **and not deleted** | One live user per Google account. Scoped to live rows so deleting and re-adding the same person does not collide with their own retired row |
| `users_role_idx`, `users_status_idx`, `users_full_name_idx` | Partial indexes over live rows, matching how the list endpoint filters and sorts |

### Conventions and why

**Text timestamps.** SQLite has no date type. `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` gives
ISO-8601 UTC with milliseconds, which sorts lexicographically in the same order it sorts
chronologically, and which `new Date(...)` parses unchanged in the browser.

**Soft delete.** Staff records will be referenced by schedules, classes and attendance history.
Deleting one outright would orphan that history, so `DELETE /api/users/:id` sets `deleted_at`
and the record stays. List queries add `WHERE deleted_at IS NULL` unless asked for
`include_deleted=true`. Hard delete exists behind `?hard=true` for genuine mistakes.

One consequence to keep in mind: because the unique email index only covers live rows, a
soft-deleted user's email can be taken by someone new — and then **restoring fails with a 409**.
`POST /api/users/:id/restore` already handles and reports that.

**Case-insensitive email.** SQLite's default collation is case-sensitive, so the unique index
is on `lower(email)` and the Zod schema lowercases on the way in. Both are needed: the schema
normalizes what the app writes, the index protects against anything else.

**`updated_at` trigger.** `users_set_updated_at` fires only `WHEN NEW.updated_at = OLD.updated_at`
— that is, only when a writer did not set it. The API sets it explicitly in the same `UPDATE`
(saving a second write), so the trigger is really a safety net for manual
`wrangler d1 execute` edits and future services.

## No migrations — one rebuildable schema

This project is greenfield, so per `docs/plan.md` there are no migrations. **`apps/api/db/schema.sql`
is the single source of truth**, and it begins by dropping everything it is about to create.

```bash
# change the model
$EDITOR apps/api/db/schema.sql

# rebuild locally and reload sample data
npm run db:reset
npm run db:studio
```

This trades the ability to preserve data for the ability to change the model freely — which is
the right trade while there is no data worth preserving. It also sidesteps SQLite's inability
to drop or retype a column in place: there is no ALTER path to write, because the table is
simply recreated.

**`npm run db:rebuild:remote` destroys all production data.** It exists for the first deploy.
Once the institute is entering real records, this approach needs to be replaced with proper
migrations — that is a deliberate decision to make at the time, not something to drift into.

## Local development

Local D1 is a SQLite file under `apps/api/.wrangler/state/`, which is gitignored. It is
disposable:

```bash
npm run db:reset    # migrate, then load apps/api/seed/dev-seed.sql
```

The seed inserts six staff members covering every role and status, including one suspended
tutor, with fixed UUIDs so they are stable across resets. It begins with `DELETE FROM users`,
so it is safe to re-run — and must never be pointed at production.

Note the seeded addresses are `@trianglemathinstitute.com`. Unless those are real Google
accounts you control, you cannot sign in as them — use `BOOTSTRAP_ADMIN_EMAILS`, or set
`AUTH_ENABLED: "false"`. See [google-oauth-setup.md](google-oauth-setup.md).

Ad-hoc queries:

```bash
npx wrangler d1 execute tmi-portal-db --local --command="SELECT role, count(*) FROM users GROUP BY role"
```

Add `--remote` to hit production. Nothing else in this repo does that except
`npm run db:rebuild:remote`.

## Production setup

```bash
npm run db:create              # prints the database_id
# paste it into apps/api/wrangler.jsonc
npm run db:rebuild:remote      # drops and creates the schema
```

Free-tier D1 limits at time of writing: 5 GB total storage, 5 million rows read and 100,000
rows written per day. A staff roster and its schedules are orders of magnitude below that.

## Planned tables

Sketched here so migrations land in a consistent shape, not yet implemented:

- `students`, `guardians`, `student_guardians` — families, in the phase after login
- `classes`, `enrollments`, `sessions`, `attendance` — the scheduling phase
Phase 1 added no tables: sessions are stateless signed cookies, so there is no session table
to plan for.

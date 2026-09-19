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
| `google_sub` | TEXT NULL | **Reserved.** The `sub` claim from a Google ID token, for the planned social login. Nothing reads or writes it yet |
| `created_at` | TEXT NOT NULL | ISO-8601 UTC, ms precision |
| `updated_at` | TEXT NOT NULL | Same format; see the trigger below |
| `deleted_at` | TEXT NULL | Soft delete marker; `NULL` means live |

Indexes:

| Index | Purpose |
| --- | --- |
| `users_email_unique` on `lower(email)` **where `deleted_at IS NULL`** | One live user per address, case-insensitively. Partial, so a deactivated person's address can be reused |
| `users_google_sub_unique` on `google_sub` where not null | Ready for the login phase |
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

## Migrations

Files live in `apps/api/migrations/`, named `NNNN_description.sql` and applied in order.
Wrangler tracks which have run in a `d1_migrations` table inside the database.

**Never edit a migration that has been applied.** Add a new one.

```bash
# 1. create the file
#    apps/api/migrations/0002_add_classes.sql

# 2. apply locally and check it
npm run db:migrate
npm run db:studio

# 3. later, against production
npm run db:migrate:remote
```

D1 applies each file as one statement batch. Because SQLite cannot drop or retype a column in
place, a change to an existing column is the usual create-new-table / copy / drop / rename
dance — write it out explicitly in the migration.

## Local development

Local D1 is a SQLite file under `apps/api/.wrangler/state/`, which is gitignored. It is
disposable:

```bash
npm run db:reset    # migrate, then load apps/api/seed/dev-seed.sql
```

The seed inserts six staff members covering every role and status, including one suspended
tutor, with fixed UUIDs so they are stable across resets. It begins with `DELETE FROM users`,
so it is safe to re-run — and must never be pointed at production.

Ad-hoc queries:

```bash
npx wrangler d1 execute tmi-portal-db --local --command="SELECT role, count(*) FROM users GROUP BY role"
```

Add `--remote` to hit production. Nothing else in this repo does that except
`npm run db:migrate:remote`.

## Production setup

```bash
npm run db:create              # prints the database_id
# paste it into apps/api/wrangler.jsonc
npm run db:migrate:remote
```

Free-tier D1 limits at time of writing: 5 GB total storage, 5 million rows read and 100,000
rows written per day. A staff roster and its schedules are orders of magnitude below that.

## Planned tables

Sketched here so migrations land in a consistent shape, not yet implemented:

- `students`, `guardians`, `student_guardians` — families, in the phase after login
- `classes`, `enrollments`, `sessions`, `attendance` — the scheduling phase
- `sessions` (auth) or a Google-token verification path — the login phase; `users.google_sub`
  is already in place for it

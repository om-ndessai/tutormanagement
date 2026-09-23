# Database

Cloudflare D1 — SQLite at the edge. One database, `tmi-portal-db`, bound to the Worker as
`DB` in `apps/api/wrangler.jsonc`.

## Schema

Seven tables, all hanging off `users`. **[data-model.md](data-model.md) is the reference** --
it explains why each attribute sits where it does and which rules the database cannot enforce.
This file covers the operational side.

| Table | Rows per user | Holds |
| --- | --- | --- |
| `users` | 1 | The person: name, email, phone, status, sign-in state |
| `user_roles` | 1..4 | Which of admin / tutor / student / parent they hold |
| `tutor_profiles` | 0..1 | Education, school, area, availability notes, virtual flag |
| `student_profiles` | 0..1 | School, current course, year goal, virtual flag |
| `payment_handles` | 0..2 | One Zelle and/or one Venmo id |
| `availability_slots` | 0..n | One row per free hour block, `(day_of_week, hour)` |
| `guardianships` | 0..n | Which adult is responsible for which young person |

Every child table is `ON DELETE CASCADE`, so removing a person removes everything about them.
D1 enforces foreign keys, so this works without any pragma.

### Conventions

**Text timestamps.** SQLite has no date type. `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` gives
ISO-8601 UTC with milliseconds, which sorts lexicographically in the same order it sorts
chronologically, and which `new Date(...)` parses unchanged in the browser.

**Integer booleans.** SQLite has no boolean either, so `0`/`1` with a CHECK constraint.

**`day_of_week` is 0=Sunday..6=Saturday**, matching JavaScript's `Date#getDay()` so nothing has
to convert.

**Soft delete.** People are referenced by history, so `DELETE /api/users/:id` sets `deleted_at`
and the record stays. List queries add `WHERE deleted_at IS NULL` unless asked otherwise. This
is distinct from `status = 'suspended'`, which means "still ours, no access".

One consequence: because the unique email index only covers live rows, a soft-deleted person's
email can be taken by someone new — and then **restoring fails with a 409**. The restore route
handles and reports that.

**`updated_at` triggers** fire only `WHEN NEW.updated_at = OLD.updated_at`, so the API can set
the column inline (saving a second write) while manual `wrangler d1 execute` edits still get it
maintained.

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

### Keeping production in step

**`npm run db:rebuild:remote` destroys all production data. Do not run it.**

It was the intended way to apply a model change while the database held nothing worth keeping.
**That stopped being true on 2026-09-21**, when the institute began recording real families,
lessons and payments. Every schema change now goes over by hand, additively:

```bash
# after editing db/schema.sql and running db:reset locally
cd apps/api
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE users ADD COLUMN new_column TEXT"
```

SQLite can add a column and can add or drop an index, but it cannot drop or retype a column
in place. Anything beyond an additive change needs the create-new-table / copy / drop / rename
dance, written out explicitly.

The session-limit columns added with the auto-stop work are exactly this kind of additive
change:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE tutor_profiles ADD COLUMN max_session_minutes INTEGER"
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE student_profiles ADD COLUMN max_session_minutes INTEGER"
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE sessions ADD COLUMN auto_stopped INTEGER NOT NULL DEFAULT 0"
```

The admin TIN is a new table, taken from `schema.sql` verbatim:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="$(sed -n '/^CREATE TABLE admin_profiles/,/^);/p' apps/api/db/schema.sql)"
```

Its `updated_at` trigger is a second statement, copied the same way.

Phase 14's is one statement:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE tutor_profiles ADD COLUMN ssn_received_on TEXT"
```

Phase 13's is one statement:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE tutor_profiles ADD COLUMN topup_amount_cents INTEGER"
```

Phase 16 (progress tracking) adds eight whole tables and their reference data, so every
constraint and foreign key arrives intact. Both blocks are marked in `schema.sql` and go over
verbatim; the catalog block is a set of upserts, safe to re-run whenever a chapter name is
corrected or a chapter added:

```bash
cd apps/api
sed -n '/BEGIN PHASE 16 TABLES/,/END PHASE 16 TABLES/p' db/schema.sql > /tmp/phase16.sql
sed -n '/BEGIN CURRICULUM CATALOG/,/END CURRICULUM CATALOG/p' db/schema.sql >> /tmp/phase16.sql
npx wrangler d1 execute tmi-portal-db --remote --file=/tmp/phase16.sql
```

This was rehearsed against a local database built from the previous `schema.sql` and seed:
every session, payment, user and guardianship survived, and the catalog block re-ran cleanly.

SQLite will not attach the `CHECK` constraints in `schema.sql` to a column added this way, so
production accepts values the API and the Zod schema would reject. That is tolerable here
because every write goes through the API, but it is the reason the rebuilt schema is the
source of truth and not the live database.

Phase 12 adds a whole table rather than a column, so production takes the `CREATE TABLE
comments` block and its five indexes from `schema.sql` verbatim:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="$(sed -n '/^CREATE TABLE comments/,/^CREATE INDEX comments_author_idx/p' apps/api/db/schema.sql)"
```

A new table with its constraints intact is the one migration SQLite does properly — unlike the
added columns above, this one keeps every CHECK and foreign key.

### Rebuilding a table is not safe on D1

Some changes, like relaxing a `NOT NULL`, cannot be done with `ALTER TABLE`; SQLite's own
answer is to rebuild the table. **On D1 that destroys the child rows**, and it was proved
twice against the test database:

1. `DROP TABLE users` performs an implicit delete, and every child table references `users`
   with `ON DELETE CASCADE`. All 207 sessions, 92 roles, 68 guardianships, 60 payments and
   the rest went with it. `PRAGMA defer_foreign_keys = true` does **not** prevent this — it
   defers the violation check, not the cascade action.
2. Renaming the table out of the way first, under `PRAGMA legacy_alter_table = ON` so the
   children keep pointing at the name `users`, survives the rename — and still loses every
   child row on `DROP TABLE users_old`, although nothing names that table.

So: **never drop or rebuild a table that other tables reference.** The migration that made
`users.email` nullable was therefore NOT applied this way; see the note in `docs/data-model.md`
about how production came to hold that change. If a rebuild is ever unavoidable, take
`wrangler d1 export` first, note a Time Travel bookmark, and restore the whole database from
the dump rather than dropping one table inside a live schema.

To see what has drifted:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="SELECT sql FROM sqlite_master WHERE tbl_name='users'"
```

> This is the cost of skipping migrations, and it is now being paid manually. If the divergence
> keeps biting, the alternative is to re-adopt numbered migrations — a decision worth making
> deliberately rather than drifting into. Production has already gone out of step once: the
> Worker was deployed expecting `last_login_at` while the database predated it, and every
> sign-in failed with a 500.

## Local development

Local D1 is a SQLite file under `apps/api/.wrangler/state/`, which is gitignored. It is
disposable:

```bash
npm run db:reset    # migrate, then load apps/api/seed/dev-seed.sql
```

The seed inserts eleven people chosen to exercise every requirement in the plan rather than to
look like a plausible institute: an admin who tutors, a parent who tutors, a tutor who is also
a student and has a parent of his own, a student with two parents (one primary), a parent with
no children, plus one suspended and one never-signed-in account. Fixed UUIDs, so they are
stable across resets. It begins with `DELETE FROM users`,
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

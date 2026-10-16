# Database

Cloudflare D1 — SQLite at the edge. Since 2026-10-06 production is **`tutoring-db`**, bound as
`DB` to both the `tmi-portal` and `tutoring` Workers; the test Worker uses `tutoring-test-db`, which
lives in a separate TEST Cloudflare account so test runs cannot spend production's D1 quota. The
institute's old `tmi-portal-db` is no longer bound to anything: its records were migrated into
`tutoring-db` as the organization `tmi` (`docs/migration-tmi.md`). The phase-by-phase commands
below were run against `tmi-portal-db` and are kept as history; new changes go to `tutoring-db`.

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

SQLite can add a column and can add or drop an index. Since 3.35 it can also drop a column
(`ALTER TABLE ... DROP COLUMN`), rewriting rows in place with no implicit delete -- but not a
column that is a key, UNIQUE or indexed, or one a foreign key, trigger or view names (tested on
local SQLite, and on the local D1 in Phase 35's rehearsal; on D1 itself, rehearse it on the demo
first). Dropping an unreferenced column is NOT a table rebuild: no implicit delete, so no cascade. It cannot retype one. Anything beyond that
needs the create-new-table / copy / drop / rename dance, written out explicitly, and on D1 that
is not safe for a referenced table (below).

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

Phase 22's drafts table is taken from `schema.sql` verbatim, with its index and trigger as
separate statements:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="$(sed -n '/^CREATE TABLE session_drafts/,/^);/p' apps/api/db/schema.sql)"
```

Phase 23 adds two tables and two draft columns. **Run these before deploying the Worker**: every
session read now joins `session_write_ups` and `session_assessments`, so a Worker deployed ahead
of them fails on every lesson, not just on new ones. Both tables are marked in `schema.sql`, with
their triggers, and go over in one file:

```bash
cd apps/api
sed -n '/BEGIN PHASE 23 TABLES/,/END PHASE 23 TABLES/p' db/schema.sql > /tmp/phase23.sql
npx wrangler d1 execute tmi-portal-db --remote --file=/tmp/phase23.sql
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE session_drafts ADD COLUMN write_up_json TEXT"
npx wrangler d1 execute tmi-portal-db --remote \
  --command="ALTER TABLE session_drafts ADD COLUMN assessment_json TEXT"
```

If Phase 22's `session_drafts` has not reached production yet, create it from `schema.sql` as
above instead — it now carries both columns — and skip the two `ALTER`s.

Phase 26 adds one table and its trigger, marked in `schema.sql`. **Run it before deploying the
Worker**: the session endpoint reads it, so a Worker deployed ahead of it fails every sign-in and
every page load.

```bash
cd apps/api
sed -n '/BEGIN PHASE 26 TABLES/,/END PHASE 26 TABLES/p' db/schema.sql > /tmp/phase26.sql
npx wrangler d1 execute tmi-portal-db --remote --file=/tmp/phase26.sql
```

Phase 25 adds one table and its trigger, marked in `schema.sql`. **Run it before deploying the
Worker**: every session read joins it, so a Worker deployed ahead of it fails on every lesson.

```bash
cd apps/api
sed -n '/BEGIN PHASE 25 TABLES/,/END PHASE 25 TABLES/p' db/schema.sql > /tmp/phase25.sql
npx wrangler d1 execute tmi-portal-db --remote --file=/tmp/phase25.sql
```

Phase 24 adds one table, marked in `schema.sql`. **Run it before deploying the Worker**: the
upcoming lessons, the calendar files, progress and every dashboard read it, so a Worker deployed
ahead of it fails on all of them.

```bash
cd apps/api
sed -n '/BEGIN PHASE 24 TABLES/,/END PHASE 24 TABLES/p' db/schema.sql > /tmp/phase24.sql
npx wrangler d1 execute tmi-portal-db --remote --file=/tmp/phase24.sql
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

(Since Phase 35 the catalog block is no longer in `schema.sql`: it is `db/catalog.sql`, generated,
and runs on its own -- see Phase 35 below.)

Keeping a student's goal and their active plan's goal equal needs no schema change -- the API
does it on every write -- but rows written before that rule existed are brought into line once,
from the plan side. Safe to re-run; it changes nothing that already matches:

```bash
npx wrangler d1 execute tmi-portal-db --remote --command="UPDATE student_profiles SET academic_year_goal = (SELECT p.goal FROM learning_plans p WHERE p.student_user_id = student_profiles.user_id AND p.status = 'active') WHERE EXISTS (SELECT 1 FROM learning_plans p WHERE p.student_user_id = student_profiles.user_id AND p.status = 'active' AND p.goal IS NOT student_profiles.academic_year_goal)"
```

This was rehearsed against a local database built from the previous `schema.sql` and seed:
every session, payment, user and guardianship survived, and the catalog block re-ran cleanly.

SQLite will not attach the `CHECK` constraints in `schema.sql` to a column added this way, so
production accepts values the API and the Zod schema would reject. That is tolerable here
because every write goes through the API, but it is the reason the rebuilt schema is the
source of truth and not the live database.

The tutor mailing address (for the 1099) is five columns. The state's `CHECK` is written into
the `ADD COLUMN`, which SQLite accepts because every existing row holds NULL there:

```bash
cd apps/api
npx wrangler d1 execute tmi-portal-db --remote --command="ALTER TABLE tutor_profiles ADD COLUMN address_line1 TEXT"
npx wrangler d1 execute tmi-portal-db --remote --command="ALTER TABLE tutor_profiles ADD COLUMN address_line2 TEXT"
npx wrangler d1 execute tmi-portal-db --remote --command="ALTER TABLE tutor_profiles ADD COLUMN city TEXT"
npx wrangler d1 execute tmi-portal-db --remote --command="ALTER TABLE tutor_profiles ADD COLUMN state TEXT CHECK (state IS NULL OR (length(state) = 2 AND state = upper(state)))"
npx wrangler d1 execute tmi-portal-db --remote --command="ALTER TABLE tutor_profiles ADD COLUMN postal_code TEXT"
```

Phase 12 adds a whole table rather than a column, so production takes the `CREATE TABLE
comments` block and its five indexes from `schema.sql` verbatim:

```bash
npx wrangler d1 execute tmi-portal-db --remote \
  --command="$(sed -n '/^CREATE TABLE comments/,/^CREATE INDEX comments_author_idx/p' apps/api/db/schema.sql)"
```

A new table with its constraints intact is the one migration SQLite does properly — unlike the
added columns above, this one keeps every CHECK and foreign key.

The default organization (2026-10) is one column on `org_members` and a partial unique index,
so a person has at most one. Existing rows take `0`, which is "no default", so nobody's landing
changes until they choose. Both statements go to `tutoring-db` (and are in `schema.sql` for
`tutoring-test-db`, which is rebuilt):

```bash
cd apps/api
npx wrangler d1 execute tutoring-db --remote --command="ALTER TABLE org_members ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1))"
npx wrangler d1 execute tutoring-db --remote --command="CREATE UNIQUE INDEX org_members_one_default ON org_members (user_id) WHERE is_default = 1"
# read-only check: nobody has two
npx wrangler d1 execute tutoring-db --remote --command="SELECT user_id, COUNT(*) FROM org_members WHERE is_default = 1 GROUP BY user_id HAVING COUNT(*) > 1"
```

Phase 32 (email notifications, 2026-10-07) is one column and one new table, with its index and
its two triggers. The column defaults to `0`, so no organization emails anybody until an admin
turns it on:

```sql
ALTER TABLE organizations ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 0 CHECK (email_notifications IN (0, 1));

CREATE TABLE notification_log (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations (id),
  kind              TEXT NOT NULL CHECK (kind IN
                      ('user_added', 'plan_added', 'assessment_added', 'schedule_added', 'session_recorded')),
  -- Who the email was about (the person added, the student), when anybody.
  subject_user_id   TEXT REFERENCES users (id) ON DELETE SET NULL,
  recipient_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status            TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  -- Cloudflare's refusal, or why it was skipped. Never the message.
  detail            TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX notification_log_org_idx ON notification_log (organization_id, created_at);

CREATE TRIGGER notification_log_same_organization
BEFORE INSERT ON notification_log
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.recipient_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER notification_log_organization_fixed
BEFORE UPDATE OF organization_id ON notification_log
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;
```

Phase 33 (tutoring locations, 2026-10-14) is three new tables, their indexes and five triggers.
Nothing existing changes: a schedule made before it has no locations and stays valid until it is
next edited, when the API asks for one.

```sql
CREATE TABLE locations (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations (id),
  owner_user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  name              TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('physical', 'virtual')),
  address           TEXT,
  reminder_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (reminder_minutes BETWEEN 0 AND 1440),

  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX locations_owner_idx ON locations (organization_id, owner_user_id);

CREATE TABLE assignment_locations (
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  assignment_id    TEXT NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  location_id      TEXT NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (assignment_id, location_id)
);

CREATE INDEX assignment_locations_location_idx ON assignment_locations (location_id);

CREATE TABLE schedule_locations (
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  schedule_id      TEXT NOT NULL REFERENCES scheduled_sessions (id) ON DELETE CASCADE,
  location_id      TEXT NOT NULL REFERENCES locations (id),
  kind             TEXT NOT NULL CHECK (kind IN ('physical', 'virtual')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (schedule_id, location_id),
  UNIQUE (schedule_id, kind)
);

CREATE INDEX schedule_locations_location_idx ON schedule_locations (location_id);

CREATE TRIGGER locations_same_organization
BEFORE INSERT ON locations
WHEN NOT EXISTS (SELECT 1 FROM org_members m WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.owner_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER locations_organization_fixed
BEFORE UPDATE OF organization_id ON locations
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER locations_set_updated_at
AFTER UPDATE ON locations
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE locations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER assignment_locations_owner
BEFORE INSERT ON assignment_locations
WHEN NOT EXISTS (
  SELECT 1 FROM assignments a JOIN locations l ON l.id = NEW.location_id
  WHERE a.id = NEW.assignment_id
    AND a.organization_id = NEW.organization_id
    AND l.organization_id = NEW.organization_id
    AND l.owner_user_id IN (a.tutor_user_id, a.student_user_id)
)
BEGIN
  SELECT RAISE(ABORT, 'location_not_in_pairing');
END;

CREATE TRIGGER schedule_locations_in_pairing
BEFORE INSERT ON schedule_locations
WHEN NOT EXISTS (
  SELECT 1 FROM scheduled_sessions ss
  JOIN assignments a ON a.organization_id = ss.organization_id
                    AND a.tutor_user_id = ss.tutor_user_id
                    AND a.student_user_id = ss.student_user_id
  JOIN assignment_locations al ON al.assignment_id = a.id AND al.location_id = NEW.location_id
  JOIN locations l ON l.id = NEW.location_id AND l.kind = NEW.kind
  WHERE ss.id = NEW.schedule_id AND ss.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'location_not_in_pairing');
END;
```

Phase 34 (curricula, with Beast Academy alone, 2026-10-16) is two new tables, an index and three
triggers, marked in `schema.sql`, then three added columns, the `ba` row and each organization's
default. **Run it before deploying the Worker**: every catalog read and id check joins
`organization_curricula`, so a Worker deployed ahead of it fails on every progress screen and every
scored lesson. The running Worker keeps working throughout, because nothing it reads changes;
`program` stays, unread. `curriculum_id` is nullable here and NOT NULL in a rebuilt database, as
`ALTER` allows: a level without one is invisible to every organization, so it fails safe, and the
first check finds it.

```bash
cd apps/api
sed -n '/BEGIN PHASE 34 TABLES/,/END PHASE 34 TABLES/p' db/schema.sql > /tmp/phase34.sql
cat >> /tmp/phase34.sql <<'SQL'
INSERT INTO curricula (id, name, source, sort)
  VALUES ('ba', 'Beast Academy', 'Beast Academy and Art of Problem Solving', 1)
  ON CONFLICT (id) DO UPDATE SET name = excluded.name, source = excluded.source, sort = excluded.sort;
ALTER TABLE curriculum_levels ADD COLUMN curriculum_id TEXT REFERENCES curricula (id);
ALTER TABLE curriculum_levels ADD COLUMN code TEXT;
ALTER TABLE curriculum_topics ADD COLUMN code TEXT;
UPDATE curriculum_levels SET curriculum_id = 'ba' WHERE curriculum_id IS NULL;
CREATE INDEX curriculum_levels_curriculum_idx ON curriculum_levels (curriculum_id, stage);
INSERT INTO organization_curricula (organization_id, curriculum_id, is_default)
  SELECT id, 'ba', 1 FROM organizations WHERE true
  ON CONFLICT (organization_id, curriculum_id) DO NOTHING;
SQL
npx wrangler d1 execute tutoring-db --remote --file=/tmp/phase34.sql

# read-only checks: 0, nothing, nothing
npx wrangler d1 execute tutoring-db --remote --command="SELECT COUNT(*) FROM curriculum_levels WHERE curriculum_id IS NULL"
npx wrangler d1 execute tutoring-db --remote --command="SELECT o.slug FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM organization_curricula oc WHERE oc.organization_id = o.id AND oc.is_default = 1)"
npx wrangler d1 execute tutoring-db --remote --command="PRAGMA foreign_key_check"
```

The block, as it stands in `schema.sql`:

```sql
-- BEGIN PHASE 34 TABLES
-- ---------------------------------------------------------------------------
-- curricula / organization_curricula - which ladders an organization teaches
-- ---------------------------------------------------------------------------
-- The catalog (curriculum_levels, curriculum_topics, below) holds one or more
-- curricula. Today it holds one, Beast Academy ('ba'), which keeps the three
-- AoPS books as its upper levels. An organization reads and writes only the
-- curricula on its own list, organization_curricula: every catalog read and
-- every id check in the API goes through that list, so it is the one choke
-- point between an organization and the catalog.
--
--   curricula ──┬── curriculum_levels ── curriculum_topics ── (ratings, plan topics)
--               └── organization_curricula ── organizations
--
-- A platform curriculum (organization_id NULL) is reference data, written by
-- this file and never by the application. One with organization_id set is
-- that organization's own and nobody else's (R13); no row has one yet.
CREATE TABLE curricula (
  -- The platform's: a slug ('ba'). An organization's own: a UUID.
  id              TEXT PRIMARY KEY,
  -- NULL: the platform's, shared by every organization that offers it.
  -- Set: that organization's own, and nobody else's.
  organization_id TEXT REFERENCES organizations (id),
  name            TEXT NOT NULL,
  -- Where it comes from. No CHECK: a new source is never a table change.
  source          TEXT,
  -- '2017', '2026'; NULL when the source has none.
  edition         TEXT,
  description     TEXT,
  source_url      TEXT,
  -- Display order only.
  sort            INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- An organization's list. Exactly one default per organization: the index
-- allows at most one, and the API makes sure there is one (creating an
-- organization inserts it; docs/data-model.md has the audit query).
CREATE TABLE organization_curricula (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  curriculum_id   TEXT NOT NULL REFERENCES curricula (id),
  is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  -- Hidden from pickers; everything written against it still reads, and a
  -- write may still name it. Rows are never deleted.
  retired_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, curriculum_id),
  CHECK (is_default = 0 OR retired_at IS NULL)
);

CREATE UNIQUE INDEX organization_curricula_one_default
  ON organization_curricula (organization_id) WHERE is_default = 1;

-- A row may name the platform's curriculum or this organization's own, never
-- another organization's. The API repeats the same test in its SQL.
CREATE TRIGGER organization_curricula_same_organization
BEFORE INSERT ON organization_curricula
WHEN NOT EXISTS (SELECT 1 FROM curricula c WHERE c.id = NEW.curriculum_id
                 AND (c.organization_id IS NULL OR c.organization_id = NEW.organization_id))
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

-- The row's key never moves: neither to another organization nor, by an
-- update, onto a curriculum the insert trigger would have refused.
CREATE TRIGGER organization_curricula_organization_fixed
BEFORE UPDATE OF organization_id, curriculum_id ON organization_curricula
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.curriculum_id IS NOT OLD.curriculum_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;

CREATE TRIGGER curricula_organization_fixed
BEFORE UPDATE OF organization_id ON curricula
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;
-- END PHASE 34 TABLES
```

Rehearsed locally against a database built from the previous `schema.sql` and seed: the block
and the statements ran clean, the three checks answered 0, nothing and nothing, every rating
survived, and the catalog block (which now upserts `curricula` and names `curriculum_id` on each
level) re-ran on top. The catalog block now needs `curriculum_id` to exist, so it runs only
after this one.

Phase 35 (North Carolina Math, both editions, and choosing; 2026-10) moves the catalog out of
`schema.sql` into `db/catalog.sql`, generated from `db/catalog/*.json` by
`node db/generate-catalog.mjs` (never hand-edited; `npm run typecheck` fails while it is stale).
The release carries **the first non-additive statement on `tutoring-db`**, approved by the owner
on 2026-10-16: `ALTER TABLE curriculum_levels DROP COLUMN program`. Its CHECK allowed Beast
Academy and AoPS alone, so no other curriculum's level could be inserted while it stood, and an
upsert that omits a NOT NULL column fails before its `ON CONFLICT` is reached. It is not a table
rebuild -- rows are rewritten in place, with no implicit delete, so no cascade can fire -- and
the Phase 34 Worker never reads `program`, so it keeps working through the drop. Then one added
column, `curriculum_topics.description`, and the catalog. NC rows are inert until an
organization offers them.

Before the release, in this order:

1. **A copy of production.** Restore the latest export into a local D1
   (`wrangler d1 execute tutoring-db --local --persist-to=/tmp/prod-copy --file=<export>.sql`),
   run the block below against it with `--local --persist-to=/tmp/prod-copy` in place of
   `--remote`, start the new Worker on it (`wrangler dev --persist-to=/tmp/prod-copy`) and check a
   `tmi` member reads the eight Beast Academy levels and nothing else; then the local suite.
2. **D1 itself, on the demo.** In `tutoring-test-db` (TEST account, `--env tutoring-test`),
   create throwaway tables with the OLD DDL and child rows, and drop the column there -- rebuilding
   that database from `schema.sql` would not exercise the drop, as it already has the new shape:

   ```bash
   npx wrangler d1 execute tutoring-test-db --env tutoring-test --remote --command="CREATE TABLE zz_levels (id TEXT PRIMARY KEY, program TEXT NOT NULL CHECK (program IN ('a','b')), name TEXT NOT NULL, stage INTEGER NOT NULL UNIQUE); CREATE TABLE zz_topics (id TEXT PRIMARY KEY, level_id TEXT NOT NULL REFERENCES zz_levels (id)); INSERT INTO zz_levels VALUES ('L1','a','One',1); INSERT INTO zz_topics VALUES ('T1','L1')"
   npx wrangler d1 execute tutoring-test-db --env tutoring-test --remote --command="ALTER TABLE zz_levels DROP COLUMN program"
   npx wrangler d1 execute tutoring-test-db --env tutoring-test --remote --command="SELECT (SELECT COUNT(*) FROM zz_topics), (SELECT group_concat(name) FROM pragma_table_info('zz_levels'))"
   # 1, "id,name,stage" -- then:
   npx wrangler d1 execute tutoring-test-db --env tutoring-test --remote --command="DROP TABLE zz_topics; DROP TABLE zz_levels"
   ```
3. **A Time Travel bookmark** noted beside the export
   (`npx wrangler d1 time-travel info tutoring-db`).

If D1 refuses the drop, stop: the fallback is the whole-database restore named under "Rebuilding
a table is not safe on D1", and that is the owner's decision. Rolling the Worker back is safe to
the Phase 34 build; anything older needs `program` put back with an `ADD COLUMN` and an `UPDATE`.

Production, in the usual order -- the backup, this block, the catalog, the checks, then the
deploy:

```bash
cd apps/api
# D1 may answer "not authorized to use function: sqlite_version" (the local D1 does); DROP COLUMN
# needs 3.35 or later, which step 2 above proves on D1 itself.
npx wrangler d1 execute tutoring-db --remote --command="SELECT sqlite_version()"
npx wrangler d1 execute tutoring-db --remote --command="SELECT (SELECT COUNT(*) FROM assessment_topic_ratings), (SELECT COUNT(*) FROM learning_plan_topics), (SELECT COUNT(*) FROM session_topic_ratings), (SELECT COUNT(*) FROM curriculum_topics)"
# The one non-additive statement. Not a table rebuild: no implicit delete, so no cascade.
npx wrangler d1 execute tutoring-db --remote --command="ALTER TABLE curriculum_levels DROP COLUMN program"
npx wrangler d1 execute tutoring-db --remote --command="ALTER TABLE curriculum_topics ADD COLUMN description TEXT"
npx wrangler d1 execute tutoring-db --remote --file=./db/catalog.sql
```

Then, read-only:

```bash
# the first three counts unchanged; topics 116 plus the NC rows
npx wrangler d1 execute tutoring-db --remote --command="SELECT (SELECT COUNT(*) FROM assessment_topic_ratings), (SELECT COUNT(*) FROM learning_plan_topics), (SELECT COUNT(*) FROM session_topic_ratings), (SELECT COUNT(*) FROM curriculum_topics)"
# ba 8, nc-2017 14, nc-2026 14
npx wrangler d1 execute tutoring-db --remote --command="SELECT curriculum_id, COUNT(*) FROM curriculum_levels GROUP BY curriculum_id"
# per level, against the official documents
npx wrangler d1 execute tutoring-db --remote --command="SELECT l.id, COUNT(t.id) FROM curriculum_levels l LEFT JOIN curriculum_topics t ON t.level_id = l.id WHERE l.curriculum_id <> 'ba' GROUP BY l.id ORDER BY l.stage"
# empty
npx wrangler d1 execute tutoring-db --remote --command="PRAGMA foreign_key_check"
# nothing: every organization still has its default
npx wrangler d1 execute tutoring-db --remote --command="SELECT o.slug FROM organizations o WHERE NOT EXISTS (SELECT 1 FROM organization_curricula oc WHERE oc.organization_id = o.id AND oc.is_default = 1)"
# "id,name,stage,grade_band,description,curriculum_id,code"
npx wrangler d1 execute tutoring-db --remote --command="SELECT group_concat(name) FROM pragma_table_info('curriculum_levels')"
```

Every new database gets the same catalog from `db:rebuild`, `db:rebuild:test` and
`scripts/e2e.sh`, which run `catalog.sql` straight after `schema.sql`. Re-running `catalog.sql`
on production later -- a corrected name, a new standard -- is safe at any time: upserts of the
platform's rows only, never a DELETE.

**The generator's guard.** It compares the sources with the previous `catalog.sql` and refuses a
dropped curriculum, level or topic, a level whose stage changed or that moved curriculum, a topic
that moved level or changed number, a stage outside its curriculum's thousand or used twice, and
a code used twice within a curriculum. A curriculum never shipped to production may be replaced
wholesale, once, with `--unreleased=<id>` (repeatable): that is how the reviewed NC files replace
the placeholders the code was built against --
`node db/generate-catalog.mjs --unreleased=nc-2017 --unreleased=nc-2026`. Never use it for one
that is live.

Rehearsed locally (wrangler's local D1) on a database built from Phase 34's `schema.sql` (with its
catalog block) and seed: `DROP COLUMN program` and `ADD COLUMN description` ran clean, then
`catalog.sql` twice; the three rating counts were unchanged (290, 279, 311), topics went from 116
to 116 plus the NC rows, `PRAGMA foreign_key_check` was empty, every organization kept its
default, both tables' columns came out in the order a rebuilt database has, and the Beast Academy
rows (curricula, levels, topics) dumped identical to the Phase 34 database's.
`SELECT sqlite_version()` was refused there ("not authorized"), hence the note above.

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

## The tutoring databases

`tutoring-db` and `tutoring-test-db` were created empty on 2026-10-05 and built CLEAN from this
branch's `db/schema.sql` -- the organization-aware schema, with no migration from the
institute's data:

```sh
# tutoring-test-db (TEST account): schema, the two seeded organizations, the platform admin
npm run db:reset:test                  # or: npm run e2e, which also deploys and tests
```

`tutoring-db` was built once, on the empty database, from the schema and `db/platform-admin.sql`
(the `db:rebuild:tutoring` script that did it has since been removed, so it cannot be re-run).
The `tutoring-test-db` created on 2026-10-05 was deleted on 2026-10-07; today's lives in the
TEST account (`ad888b50…`) and is rebuilt by every `npm run e2e`. From now on
`tutoring-db` is treated like the institute's production -- back up first, and carry changes by
hand and additively.

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

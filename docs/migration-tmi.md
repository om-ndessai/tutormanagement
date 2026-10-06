# Migrating the institute into tutoring-db

**Status: run on 2026-10-05 (21:07 ET).** Backups were taken first:
- `~/tmi-portal-backups/prod-2026-10-05-2107-before-migration.sql`;
- `~/tmi-portal-backups/tutoring-2026-10-05-2107-before-migration.sql`;
- tutoring-db Time Travel bookmark `00000005-00000000-000050fc-e89e8291c0acdf73bc7c0ba7566c4dad`.

**What it carried:** 14 people, 16 roles, 9 lessons (87,375 cents), 1 payment (50,000 cents),
and 168 log lines with identical ids, text and timestamps, plus one line for the migration.

**Checks:** preflight was empty, and all 32 verify checks were ok. The staging tables and the
local export were removed afterwards. tmi-portal was not changed.

## What it does

Brings the Mathematics Institute of the Triangle's records from `tmi-portal-db` (the
single-organization production database) into `tutoring-db`, as one organization:

1. **Ensures the organization exists**, keyed on its slug `tmi`:
   - name "Mathematics Institute of the Triangle", short name "TMI", the institute's tagline,
     blurb and place;
   - **the same look as tmi-portal:** palette `plum` (the base palette `index.css` gives
     tmi-portal) and `builtin_logo: 'institute'` (the same `logo-mark.png` / `logo-full.png` /
     favicon);
   - time zone America/New_York;
   - calendar domain `trianglemathinstitute.com`, the domain in every calendar file the
     institute has issued, so subscribers' events update rather than double;
   - the payer TIN from production's admin record.
2. **Empties that organization in tutoring-db, and only that one:** its lessons, schedules,
   payments, plans, assessments, pairings, comments, drafts, live lessons, its log, and every
   membership (with each member's roles, profiles, handles, availability and guardianships).
   People who then belong to no organization and are production's own are removed too, so
   they come back exactly as production holds them. Other organizations are not touched.
3. **Copies every production row back in** -- every person, role, profile, guardianship,
   pairing, lesson and its write-up/assessments/reflection/progress, schedule and cancellation,
   payment, comment, assessment, plan, draft and live lesson, and **the whole audit log** --
   with the **same ids, the same text and the same `created_at` / `updated_at` /
   `last_login_at` instants**. Every member belongs to the institute.

It is re-runnable: running it again empties the organization and copies production again,
landing in the same state.

## The files (`scripts/migrate-tmi/`)

| File | What it is | Writes |
| --- | --- | --- |
| `build-stage.mjs` | Turns a production data export into `stage.sql`. Refuses an unknown table or column, so nothing is left behind silently. | a local file only |
| `stage.sql` (generated, in `out/`, never committed) | Production's rows, verbatim, into `mig_*` staging tables. | `mig_*` in tutoring-db |
| `preflight.sql` | Read-only checks. **Every row it returns is a reason to stop.** | `mig_preflight` only |
| `migrate.sql` | The migration itself: steps 1-3 above, in plain SQL. | tutoring-db: the `tmi` organization |
| `verify.sql` | 32 comparisons of production's rows with the organization's. `ok` must be 1 on every line. | `mig_verify` only |
| `cleanup.sql` | Drops the staging tables, which hold a copy of production's rows. | drops `mig_*` |

## How people are matched

People are global in tutoring-db. Each production person is:

- **matched to an existing person** -- same Google account, else same live email -- only when
  that person belongs to ANOTHER organization. They then keep their own shared name and phone,
  and gain the institute's membership.
- **otherwise production's own row**, with its id and timestamps.

That second rule is what happens to `ndessai@gmail.com`: tutoring-db holds a platform-admin
placeholder for that address, which belongs to no organization. The migration removes the
placeholder, brings in production's own record (id `56123c1d…`, created 2026-09-21), and makes
it a platform admin again. The platform's own log lines that named the placeholder keep the name
they recorded.

Production's `users.status` becomes the membership's status, and `users.deleted_at` ("no longer
part of the institute") becomes the membership's `removed_at`. `last_login_at` also becomes the
membership's first and last entry, so nobody who has used the portal is welcomed as new.

## Things to know before saying go

- **Step 2 deletes the organization's existing log in tutoring-db.** Production's log is copied
  in whole, so none of the institute's history is lost. Any lines tutoring-db wrote for the `tmi`
  organization before the run -- its creation from the console, for example -- are not kept. One
  new line records the migration itself.
- **The curriculum is not copied.** Both databases carry the same catalog; the preflight fails
  if a rating names a topic tutoring-db lacks.
- **People added to tmi-portal after the export are not in it.** Pause changes to tmi-portal
  while the job runs, or run it again afterwards; it is re-runnable.
- **tmi-portal is not changed in any way.** It keeps serving until the owner decides to move
  people over: a separate decision, which needs the institute's sign-in origin on the new
  address or a domain change.

## Rehearsal (done, local only)

Rehearsed against a throwaway local database built from:
- the tutoring schema;
- the seed's two test organizations;
- the platform-admin placeholder;
- the production export of 2026-10-04 (`~/tmi-portal-backups/prod-2026-10-04-before-signin-credit.sql`).

Results:
- **Preflight** returned nothing.
- **Migrate**: all 32 verify checks were OK. That covers 11 people, 8 lessons and 78,875 cents
  of lesson money, 1 payment of 50,000 cents, and the 141 log lines with identical ids, text and
  timestamps.
- **A second run** was also all OK.
- **The other organizations** were unchanged: 88 members and 214 lessons, and 8 members and 4
  lessons, before and after.
- **`ndessai@gmail.com`** came out as production's record, a platform admin and the
  institute's admin.
- **The app**, served from that database, showed the organization in palette `plum` with the
  institute's logo, 11 people, the whole log back to 2026-09-21, and calendar UIDs
  `@trianglemathinstitute.com`.

## The run (for when the owner says go)

```sh
# 0. The right account, and backups of BOTH databases first
npx wrangler whoami                                   # om.ndessai@gmail.com
cd apps/api
npx wrangler d1 export tmi-portal-db --remote --output ~/tmi-portal-backups/prod-<date>-before-migration.sql
npx wrangler d1 export tutoring-db  --remote --output ~/tmi-portal-backups/tutoring-<date>-before-migration.sql
npx wrangler d1 time-travel info tutoring-db          # note the bookmark

# 1. Production's data, read-only
mkdir -p ../../scripts/migrate-tmi/out
npx wrangler d1 export tmi-portal-db --remote --no-schema --output ../../scripts/migrate-tmi/out/tmi-data.sql
node ../../scripts/migrate-tmi/build-stage.mjs ../../scripts/migrate-tmi/out/tmi-data.sql ../../scripts/migrate-tmi/out/stage.sql

# 2. Stage, then preflight: STOP if it returns any row
npx wrangler d1 execute tutoring-db --remote --file=../../scripts/migrate-tmi/out/stage.sql
npx wrangler d1 execute tutoring-db --remote --file=../../scripts/migrate-tmi/preflight.sql

# 3. Migrate, then verify: every line ok = 1
npx wrangler d1 execute tutoring-db --remote --file=../../scripts/migrate-tmi/migrate.sql
npx wrangler d1 execute tutoring-db --remote --file=../../scripts/migrate-tmi/verify.sql

# 4. Drop the staging copy of production's rows, and the local files
npx wrangler d1 execute tutoring-db --remote --file=../../scripts/migrate-tmi/cleanup.sql
rm -rf ../../scripts/migrate-tmi/out
```

**If verify fails:**
- re-run steps 2-3; the job is idempotent;
- or restore tutoring-db to the Time Travel bookmark:
  `npx wrangler d1 time-travel restore tutoring-db --bookmark=<bookmark>`.

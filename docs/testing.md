# End-to-end testing (Phase 6)

Playwright drives a **dedicated test deployment**, wiping and rebuilding its database for each
run. Production is never deployed to, never queried and never wiped.

```bash
npm run e2e
```

That command:

1. builds the SPA
2. deploys it as `tmi-portal-test`, bound to `tmi-portal-test-db`
3. rebuilds that database from `apps/api/db/schema.sql` and `db/seed.sql`
4. runs the suite against `https://tmi-portal-test.om-ndessai.workers.dev`

## The seeded roster

The test database is rebuilt from `apps/api/db/seed.sql` on every run, at the scale
`docs/plan.md` asks for: **2 admins, 10 tutors, 30 parents, 50 students** {D} 88 people. The
totals overlap because a person may hold several roles, which is the point of the model.

That file is **generated**, not hand-written:

```bash
npm run db:seed:generate --workspace @tmi/api   # rewrites db/seed.sql
```

A thousand rows of SQL cannot be kept internally consistent by hand. Every student needs a
guardian, every session needs an assignment that authorises it, and every amount must equal
rate x minutes / 60. Those invariants live in `db/generate-seed.mjs` as code, so the seed
cannot drift into a state the API would have rejected. The generator is deterministic {D} fixed
PRNG seed, derived ids {D} so the file only changes when the script does, and a diff is
reviewable.

**The named cast at the top is fixed**, including every relationship between its members. The
suite asserts on them by name, and they cover the combinations the plan calls out: an admin who
tutors, a parent who tutors, a senior student who tutors younger children while being taught
himself. Generated people are only ever paired with **each other**, so adding bulk cannot
quietly change who can see whom {D} which is exactly what the scoping tests are checking.

One consequence of the scale: the directory now paginates, so a test cannot assume a name is on
the first page. Assertions search for people instead, which is also how an admin actually finds
somebody. Counts drift upward across runs too, because the specs create users of their own {D}
never assert an exact row count.

## The two deployments

| | Production | Test |
| --- | --- | --- |
| Worker | `tmi-portal` | `tmi-portal-test` |
| Database | `tmi-portal-db` | `tmi-portal-test-db` |
| Authentication | **on** — Google sign-in required | **off**, permanently |
| Data | real staff and families | 88 seeded people, wiped every run |
| Deployed by | `npm run deploy` | `npm run e2e`, or `npm run deploy:test` |

They are separate Workers with separate databases. The test environment is a named `env` in
`apps/api/wrangler.jsonc`, and wrangler does **not** let a named environment inherit `assets`,
`d1_databases` or `vars` — everything is restated there. That is deliberate: this environment
must not be able to reach production's database by inheriting its binding.

`scripts/e2e.sh` additionally refuses to run if either the database name or the target URL
stops looking like a test target, so editing one towards production stops the script rather
than wiping real records.

**The test Worker is publicly reachable and unauthenticated.** That is what makes the suite
possible. Never put anything real in it.

## Running against something else

```bash
# a local `wrangler dev` with AUTH_ENABLED=false
E2E_BASE_URL=http://127.0.0.1:8787 npm run e2e:test

# just the tests, against whatever is already deployed to the test Worker
npm run e2e:test
```

`npm run e2e:test` never deploys and never wipes anything.

## How the suite acts as different people

Google owns the sign-in flow, so it cannot be driven unattended. Instead the Worker honours an
`X-Dev-User` header naming the account to act as — **only while `AUTH_ENABLED` is `false`**. A
deployment in that state is already fully open, so the header grants nothing that was not
already available, and it is ignored entirely on production.

Each test gets a browser context carrying that header:

```ts
const page = await as('tutor');   // every request from this page is Alex Chen
await page.goto('/sessions');
```

The roster lives in `e2e/support/people.ts` and mirrors the seed, including the awkward cases:
a parent who also tutors, and a senior student who tutors younger children while being taught
himself.

**Do not add a second `X-Dev-User` header per request.** The context already carries one, and
two values made the header ambiguous — that cost a run which passed locally and failed
deployed.

## What is covered

`roles.spec.ts` — the plan's "launch portal as a different type of user and validate":

| Role | Asserted |
| --- | --- |
| Admin | Sees the whole institute, including families and tutors no scoped role would see |
| Tutor | Sees only their own students, sessions and earnings; another tutor's student is absent |
| Parent | Sees their child and that child's tutor; other families are absent |
| Student | Sees their own record; unrelated tutors are absent |
| Tutor + student | Both role sections appear on one profile |
| Non-admin | The write actions are hidden **and** the API returns 403 when called directly |

`admin-workflow.spec.ts` — the full path the plan describes, in order: a student cannot be
created before their parent; parent → student → assignment with a negotiated rate → the tutor
records a lesson → it is priced server-side (1 hr 52 min rounds to 1 hr 45 at $80/hr = $140) →
the family owes exactly that → the admin records payment → the balance clears → and every step
appears in the audit log.

`schedule-cancellations.spec.ts` (Phase 24) — one lesson of a series called off and put back:
who may (a student may not; nobody outside the schedule can find it), which dates (only ones the
series falls on; a parent only from today on), who may restore (the tutor anyone's, a parent
their own), a recorded lesson outranking a cancellation, progress no longer counting it as
missed, the note hidden from a progress reader outside the schedule, an edit clearing orphaned
dates, and the Schedule page, the dashboard carousel and the sessions page showing it. Each test
makes its own Wednesday slot and takes its dates from the API, so it does not depend on the day
the suite runs.

`session-reflections.spec.ts` (Phase 25) — the student's reflection on a lesson: the student
reflects and the lesson's audience reads it; a parent or the tutor may enter it for them, but
never overwrite what the student entered; the office reads but does not enter; a student no
longer gives a Phase 23 assessment; the student's and parent's dashboards prompt for it and the
tutor's lists it, flagged; and the card, the tutor's section and the parent's prompt in the
browser. Each test records its own lesson dated today, so the 21-day prompt finds it.

## Notes

- `workers: 1`, no parallelism. Every spec assumes the seeded roster against one shared
  database; parallel workers would write over each other.
- Assertions avoid exact row counts, because other specs add rows to the same database.
- Uses your installed Chrome rather than downloading a browser. Set `PLAYWRIGHT_CHANNEL=` to
  use Playwright's own build instead.

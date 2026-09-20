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

## The two deployments

| | Production | Test |
| --- | --- | --- |
| Worker | `tmi-portal` | `tmi-portal-test` |
| Database | `tmi-portal-db` | `tmi-portal-test-db` |
| Authentication | **on** — Google sign-in required | **off**, permanently |
| Data | real staff and families | seeded fiction, wiped every run |
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

## Notes

- `workers: 1`, no parallelism. Every spec assumes the seeded roster against one shared
  database; parallel workers would write over each other.
- Assertions avoid exact row counts, because other specs add rows to the same database.
- Uses your installed Chrome rather than downloading a browser. Set `PLAYWRIGHT_CHANNEL=` to
  use Playwright's own build instead.

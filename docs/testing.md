# End-to-end testing (Phase 6)

Playwright drives the **deployed** portal, wiping and rebuilding the remote database for each
run, with authentication switched off for the duration.

```bash
E2E_YES=1 npm run e2e
```

That single command does four things, in order:

1. deploys with `AUTH_ENABLED=false`
2. rebuilds the remote database from `apps/api/db/schema.sql` and `db/seed.sql`
3. runs the suite
4. switches authentication back on — **in a shell trap**, so a failed or interrupted run
   cannot leave the live portal open

## Read this before running it

`npm run e2e` **destroys every row in the production database** and leaves the live URL
unauthenticated while it runs. That is what `docs/plan.md` asks for, and it is only acceptable
while the portal holds nothing real. It refuses to start without `E2E_YES=1`.

Two consequences worth planning around:

- Your own accounts are replaced by the seeded roster. After a run, nobody at the institute can
  sign in until their records are re-added, because the seeded accounts are Google addresses
  you do not control.
- Anyone who loads the URL mid-run gets an open portal.

When the institute starts entering real records, point `E2E_BASE_URL` at a second Worker with
its own D1 instead. The suite needs no changes; only the target does.

## Running against something else

```bash
# a local `wrangler dev` with AUTH_ENABLED=false
E2E_BASE_URL=http://127.0.0.1:8787 npm run e2e:test

# just the tests, against whatever is currently deployed
npm run e2e:test
```

`npm run e2e:test` never deploys, never wipes anything, and assumes auth is already off.

## How the suite acts as different people

Google owns the sign-in flow, so it cannot be driven unattended. Instead, the Worker honours an
`X-Dev-User` header naming the account to act as — **only while `AUTH_ENABLED` is `false`**. A
deployment in that state is already fully open, so the header grants nothing that was not
already available, and it is ignored entirely once sign-in is on.

Each test gets a browser context carrying that header:

```ts
const page = await as('tutor');   // every request from this page is Alex Chen
await page.goto('/sessions');
```

The roster lives in `e2e/support/people.ts` and mirrors the seed, including the awkward cases:
a parent who also tutors, and a senior student who tutors younger children while being taught
himself.

**Do not add a second `X-Dev-User` header per request.** The context already carries one, and
two values made the header ambiguous — that cost a production run when it passed locally and
failed deployed.

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

- `workers: 1`, no parallelism. Every spec assumes the seeded roster against one shared remote
  database; parallel workers would write over each other.
- Assertions avoid exact row counts, because other specs add rows to the same database.
- Uses your installed Chrome rather than downloading a browser. Set `PLAYWRIGHT_CHANNEL=` to
  use Playwright's own build instead.

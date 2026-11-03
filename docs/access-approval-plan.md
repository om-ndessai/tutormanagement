# Phase 65: who may sign up, from the console (2026-11-03)

The owner: "The next phase work is to have platform admin whitelist ability. Currently the test app has a
whitelist ability through adding users in the db and only those emails are allowed to sign up. I want to
have this controlled through platform console screen." Three ways, one chosen at a time, in the console's
Settings > Guest play section, "Sign-up access":

- **Open**: anyone may sign up (for the real launch).
- **Pre-approved**: only people on a list the platform admins keep in the console may sign up.
- **Post-approved**: anyone may sign up, then waits; until a platform admin approves them they cannot use
  the app, and signing up or in again says "Your access is waiting for approval."

Post-approved is offered on the test and production platforms alike.

## Today

- The test Worker (`SIGNIN_ALLOWLIST` "true") checks every verified sign-in, every sign-up and every
  request against `invited_users`, a table that exists only in `tutoring-test-db` (`db/test-only.sql`),
  kept with SQL or `npm run test:invite`. Production has no list.
- Whether sign-up is open at all is the console's Sign-in setting per client (else `SIGNUP_OPEN`), and
  never at `tmi-portal` (`SIGNUP_ALLOWED` "false").
- A sign-up writes a `platform_accounts` row (age band, terms) and a personal space. People a space's
  admins add or invite have no such row.

## Requirements

- **A1. One setting, per platform.** `platform_settings` key `access`: `{ mode: 'open' | 'preapproved' |
  'postapproved' }`, the same for the web and the app, on each database (test and production decide
  separately). No row means Open, today's behaviour. Changing it is logged (`platform.access_updated`).
  It sits beside sign-up's open/closed switch, which still decides whether anyone may sign up at all;
  the mode decides who, once it is open.
- **A2. The list is the platform's, in both databases.** A new table `access_list` in `schema.sql` (email,
  or a pattern with `*` and `?`, or a provider's account id; a note; who added it and when), the shape of
  `invited_users`, matched by the same `invitedMatch`. Kept in the console (add, remove), logged.
- **A3. Pre-approved.** A sign-up whose verified identity is not on the list is refused before anything is
  stored: 403 `not_on_list`, "Sign-up is by invitation for now." Checked where the test allowlist is
  checked today (`completeSignIn`'s sign-up branch and `POST /api/auth/signup`).
- **A4. Post-approved.** A sign-up completes as today (the account, its personal space) with its access
  `pending`, and no session is issued. The person sees "Thanks, <first name>. Your access is waiting for
  approval." Signing in or up again answers 403 `access_pending` with the same words; a declined account
  answers 403 `access_declined`, "Your access wasn't approved," with Contact us.
- **A5. Access is a column on the account, checked on every request.** `platform_accounts.access`
  (`approved`, `pending`, `declined`; existing rows `approved`), with `access_decided_at` and
  `access_decided_by`. `requireAuth` already re-reads the person on every request; it reads this column in
  the same query, so approving or revoking takes effect on the next request, as suspending does. Only
  accounts that signed up themselves have the column. People added or invited by a space's admins are not
  gated: the space vouches for them. Existing accounts are approved, so switching a platform to
  Post-approved locks nobody out.
- **A6. The console's waiting list.** Under Post-approved: everyone waiting (name, email, age band, way in,
  when), oldest first, each with Approve and Decline, and a count on the Settings tab. Under every mode:
  the accounts decided recently, and Revoke on an approved one (it becomes declined). Each decision is
  logged on the platform log, naming the person.
- **A7. Both clients, both consoles.** The web portal and the app: the console's Sign-up access section
  (the three choices, the list editor, the waiting list), and the sign-up and sign-in screens' three new
  answers (not on the list, pending, declined), each a plain screen with Contact us, never a raw error.
  An older app build shows the server's message in its error line.
- **A8. The test Worker's own gate retires.** On release, the test database's `invited_users` rows are
  copied into `access_list`, both platforms' mode is set to Post-approved, and `SIGNIN_ALLOWLIST` goes
  "false": the console is the one control. `npm run test:invite` keeps working, on `access_list`.
  `invited_users` stays in `db/test-only.sql` as a record, unread, until a later clean-up.
- **A9. Unchanged:** `tmi-portal` never takes sign-ups; under-13s are refused; guest play needs no
  account; a space's own invitations and join codes work as before.

## The owner's decisions (2026-11-03)

1. **Only people who sign up themselves need approval.** People a space's admins add or invite get in
   through that space, and existing accounts stay approved.
2. **One list, in the database, read by the console.** Today's test list is the test-only table
   `invited_users`. It moves into `access_list`, a table in both databases that the console reads and
   edits (A2, A8), and the test-only gate retires.
3. **Both platforms start Post-approved.** The list moved over on test is kept for whenever test is
   switched to Pre-approved. Production's sign-up stays closed until it is opened in the console.
4. **A declined account is kept, blocked**, with the message and Contact us; it can be approved later.

## Work

Shared contract (`access.ts`: modes, the setting, list entries, the waiting list, error codes); schema
(`access_list`, three columns); repositories and routes (`GET/PUT /api/platform/access`, list add/remove,
`PUT /api/platform/access/accounts/:id`); the checks in `routes/auth.ts` and `middleware/auth.ts`; the
console section on web and app; the sign-up/sign-in screens on web and app; `test:invite` on the new
table; tests: a web spec (each mode, refusal before storage, pending to approved to revoked on the next
request, an existing account unaffected, logs) and app flows, the exposure crawl for the new route, smoke
on both clients. Release: additive SQL block `release=phase-65` in `docs/database.md`, then the test-side
move (A8).

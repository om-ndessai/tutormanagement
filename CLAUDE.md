# CLAUDE.md

Guidance for AI agents working in this repository. Read this before making changes.

## What this is

The staff/tutor management portal for the **Mathematics Institute of the Triangle**
(trianglemathinstitute.com). It runs entirely on Cloudflare's free tier: one Worker serves
both a JSON API and the built React SPA, backed by one D1 (SQLite) database.

`docs/plan.md` is the authoritative roadmap.

**The platform is called Aimtrue (since 2026-10-13; it was "Tutor Portal").** The name, tagline
and blurb are one constant, `PLATFORM_BRAND` in `packages/shared/src/brand.ts`; the mark is the
drawn "bullseye a" (a lowercase a with a target in its bowl) in each client's `logo.tsx`, which is
also what an organization wears until it uploads its own. The mobile app is `com.aimtrue.app` with the link scheme `aimtrue://`.
What did NOT change, and must not be "tidied": the Cloudflare Workers and their addresses
(`tmi-portal`, `tutoring`, `tutoring-test`), the databases, the `tmi_session` cookie and the
`@tmi/*` packages. `docs/naming/README.md` is the record of how the name was chosen.

**Phases 1 to 19, and 21 to 36, are built** (20 is planned, not built). In short: Google sign-in (1), the people model (2), the audit
log (3), recorded sessions (4), payments and balances (5), the admin's view of anyone's
dashboard (6→8), live session timers (7), recurring schedules and calendar files (9), CSV
exports (10), the deployed test environment (11), comments (12), tutor advances (13), SSN
receipts (14), the Tutoring/Finance dashboard and 1099s (15), progress tracking against a
curriculum (16), money labelled by whose side it is (17), the non-admin exposure review
and its crawling test (18), and the same Tutoring/Finance split on the sessions page, so
no money is on screen while a tutor reads notes beside a student (19), the Tutoring tab rebuilt
as Analytics, a sessions carousel, a progress spotlight and recent activity (21), session drafts
(22), a lesson's notes written up in parts, with an assessment from anyone it concerns (23),
one lesson of a standing schedule cancelled and restored, without touching the series (24), the
student's own reflection on each lesson (25), and a welcome wizard with a feature tour and guided
setup of a new student or tutor (26), multiple organizations (27-31), and per-organization email
notifications (32), tutoring locations with an in-app reminder (33), curricula, with
Beast Academy alone, read through each organization's own list (34), North Carolina's
standards in both editions, with each organization's admins choosing what it offers (35), and
the AI layer with the question bank it writes, in the platform console (36). Phase 38, the
Assessment menu (answers written on a canvas, a PDF for the tutor; in beta until Phase 78), and Phase 40, the tutor's
review of it online, are built ahead of 37.

Two of those shape everything else. **Sign-in is the only way in** — every `/api` route except
`/api/health` and `/api/auth/*` requires a verified Google identity, and `AUTH_ENABLED` is
`"true"` in the committed config; flipping it to `"false"` is a local convenience, not
something to deploy. **The people model** is admins, tutors, students and parents, where one
person may hold several roles at once: read `docs/data-model.md` before touching the schema, as
it explains why each table is where it is and which rules the database cannot enforce.

**Every organization runs on one code version (since 2026-10-06).** Multi-organization support
(Phases 27-31, `docs/multi-organization.md`) is on `main`; the institute is the organization `tmi`
in `tutoring-db`, migrated from the old `tmi-portal-db` on 2026-10-05/06
(`docs/migration-tmi.md`). Work on `main`.

**Ask before starting the next phase.** `docs/plan.md` is the roadmap, but it is a plan, not a
licence — do not build ahead of what has been asked for.

`docs/roadmap/` (2026-09-24) is an industry audit with a plan per candidate feature, Canvas
compatibility and future AI. **None of it is scheduled**: a feature is built only once the owner
has written it into `docs/plan.md` as a phase. Use its plan as the starting point for that
phase, and re-check its figures, which were researched on that date.

## Deployments

Three Workers, one code version, two databases, **two Cloudflare accounts**. The production pair share `tutoring-db` and are
deployed together; they differ only in address, the organization a visitor lands in and sees on
the sign-in page (`DEFAULT_ORGANIZATION`), and which one runs the lesson sweep. `tutoring-test`
is the one test Worker (`tmi-portal-test` was retired on 2026-10-06: not deployed, not tested).

| Worker | Account | Database | Sign-in | Lands in | Lesson sweep (cron) |
| --- | --- | --- | --- | --- | --- |
| `tmi-portal` (the institute's address) | production | `tutoring-db` | on | `tmi` | no |
| `tutoring` | production | `tutoring-db` | on | choose | yes |
| `tutoring-test` (`tutoring-test.tmi-api.workers.dev`) | TEST | `tutoring-test-db` | on, invited only | choose | yes |

**The test side lives in the TEST account, and must stay there.** D1's free limits (5 million rows
read a day) are per ACCOUNT, and one suite run reads about 2.3 million. While `tutoring-test-db`
sat beside `tutoring-db`, three runs used up the day and production stopped answering real users
(2026-10-06). `wrangler.jsonc` pins each side (`account_id` at the top level, inherited by
`tutoring`; restated on `tutoring-test`), every test command passes `--env tutoring-test`, and
`scripts/check-test-account.mjs` (run first by `npm run e2e`) refuses if the two accounts ever
match. Never point a test command at production's account; prefer the local suite for everyday
checks, which spends no quota at all.

- `npm run deploy` deploys BOTH production Workers.
- `npm run deploy:test` deploys `tutoring-test`.
- `npm run db:reset:test` rebuilds `tutoring-test-db` (schema, catalog, seed, platform admin, bank
  sample, then `db/test-only.sql`). The remote suite (`npm run e2e`) is retired since Phase 53.
- **Never deploy one production Worker alone:** the two would serve different code against one
  database.
- **Only one Worker per database may run the cron:** two sweeps of one database could close the
  same overrunning lesson twice and bill it twice.
- The production account holds `tmi-portal`, `tutoring`, `tutoring-db` and the old
  `tmi-portal-db`, unbound and kept as a record beside the backups in `~/tmi-portal-backups/`.
  The old test Workers (`tmi-portal-test`, and `tutoring-test` before its move to TEST) and the
  old `tutoring-test-db` there were deleted on 2026-10-07; `tmi-portal-test-db` no longer exists.

`tutoring-db` holds every organization's real records, the institute's included: never rebuild
it (`npm run db:rebuild:remote` refuses); carry schema changes by hand and additively
(`docs/database.md`).

## Mobile app

The native iOS/Android app (`apps/mobile`, Expo + React Native Paper) answers
`docs/mobileapp.md`. It was built on the branch `mobile-app`, which the owner merged into `main`
on 2026-10-12: it is worked on `main` now, like everything else. The owner asked for its phases
to run straight through, so they are not paused between phases. `docs/mobile/` holds the plan,
the resumable `progress.md`, the parity tracker and the build log; `apps/mobile/CLAUDE.md`
holds the app's rules and commands.

- **Feature parity is the default (owner, 2026-10-18).** Every feature is built, tested and released
  on the web app AND the mobile app together, unless the owner explicitly says one platform only. A
  phase is not done while its other half is missing; "web only" needs the owner's word, recorded in
  `docs/mobile/parity.md`. Installing on the physical phones is separate, and only when asked.
- **A second client of the same API.** A change to the Worker, the shared contract or the schema
  is smoke-tested on the web app AND the mobile app before it is done: `npm run smoke` (see
  "The Worker has two clients" under Rules).
- **Skills.** Use `mobile-architect`, `mobile-developer` and `mobile-tester`
  (`.claude/skills/`) for every feature.
- **Separate install.** `apps/mobile` is not an npm workspace: Expo pins its own React and
  TypeScript. Run `npm run mobile:install` after cloning.
- **Local only.** Its tests run only against the local Worker and seed, through
  `npm run e2e:mobile`.
- **Sign-in.** The app signs in through the same `POST /api/auth/google` (native Google
  Sign-In with the web client ID as audience, so `verifyGoogleIdToken` is unchanged) and carries
  the same `tmi_session` cookie, identity only; `X-Organization` still travels on every request.

## Layout

```
apps/api/          Cloudflare Worker: Hono routes, auth, D1 access, db/schema.sql
apps/web/          Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui
apps/mobile/       Expo + React Native Paper: the iOS/Android app (its own install and CLAUDE.md)
packages/shared/   Zod schemas and types imported by BOTH sides
docs/              plan.md (roadmap), architecture, database, branding, Google setup
docs/roadmap/      candidate features and their plans (unscheduled; see its README)
```

`packages/shared` is the contract. A field only exists once: define it there, and the Worker
and the React app both get validation and types from the same definition.

## Commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Worker on :8787 and Vite on :5173 together. **Use http://localhost:5173** — Vite proxies `/api` to the Worker. |
| `npm run db:rebuild` | **Drops and recreates** every local table from `apps/api/db/schema.sql`, then loads the curriculum catalog (`db/catalog.sql`) |
| `npm run db:seed` | Reload local data from `apps/api/db/seed.sql` |
| `npm run db:reset` | Rebuild, then seed, the platform admin and a SAMPLE of the question bank (`db/questions-sample.sql`, Phase 49: every approved question and 8 checked per standard, ~2,500) |
| `npm run db:reset:full` | The same with the whole bank (`db/questions.sql`, ~40,000), for work on the bank itself |
| `npm run seed:scenarios` | With the local Worker running: the newer features' seed, made through the API as the bulk families (assessments with PDFs, Quest answers and reviews, Quest Games). `-- --base=<demo> --demo` on the demo |
| `npm run test:compat` | The backward-compatibility test (Phase 49), local: the last release's database (`release-*` tag) with the pending SQL from `docs/database.md`, compared with `schema.sql`, then the last release's Worker and today's run on it |
| `npm run questions:export` | Copy production's APPROVED questions into `apps/api/db/questions/*.json` and regenerate `db/questions.sql` (one read-only SELECT on `tutoring-db`) |
| `npm run db:studio` | Dump the users table from local D1 |
| `npm run test:invite -- list\|add <email or pattern>\|add-google <sub>\|remove <…>` | The test platform's sign-up list (`access_list` in `tutoring-test-db`, TEST account only; the console edits the same list) |
| `npm run typecheck` | Typecheck all three packages — run this before declaring work done |
| `npm run smoke` | The smoke test on BOTH clients, locally: the web tests tagged `@smoke`, then the mobile flows tagged `smoke` on the iOS simulator and the Android emulator. `-- web\|mobile\|ios\|android` runs one side. **Run it after any change to the API, the shared contract or the schema** |
| `npm run build` | Build the SPA into `apps/web/dist` |
| `npm run deploy` | Build the SPA, then `wrangler deploy` |

`tutoring-db` holds **all production data** -- every organization's real records, the
institute's since 2026-10-06. **Never rebuild it.** Carry schema changes to production by hand and additively
(`ALTER TABLE ... ADD COLUMN`, `CREATE TABLE`), writing the statements into `docs/database.md`
as part of the change. Run `--remote` wrangler commands only as part of a release the owner has
approved: **approving a phase's plan is that approval**, for the whole release, with no further
asking —
1. the full **local** suite green (`npm run db:reset`, `npm run dev`, then
   `E2E_BASE_URL=http://localhost:5173 npm run e2e:test`) -- since 2026-10-07 the local suite is
   the gate: it spends no Cloudflare quota; and, when the release changes the API, the shared
   contract or the schema, `npm run smoke -- mobile` green on both platforms (the full web suite
   already holds the web half), and `npm run test:compat` green against the last `release-*` tag
   (Phase 49);
2. commit and push to `main`, and tag the release `release-YYYYMMDD` (`git push --tags`): the
   compatibility test's next base. Raise `RELEASE_PHASE` (`packages/shared/src/release.ts`) with the
   phase's code: the app prints it.

Then deploy in this order (owner, 2026-11-02): **tutoring test Worker, test app, tutoring prod Worker,
tmi-portal prod Worker, production app** -- each app goes out only after the Worker it talks to, so a
new app never meets an old server:

3. **the tutoring test Worker**, the demo: `npm run deploy:test`, and `npm run db:reset:test` when the
   schema changed. `tutoring-test` is an open **feature demo** now, not a test target: `npm run e2e`
   (which wipes it and reads ~2.3 M rows) runs only when the owner asks. `db:reset:test` refuses above a
   write budget of 40,000 rows (`scripts/seed-budget.mjs`; the free plan writes 100,000 a day), then
   `TEST_AUTOMATION_KEY="$(cat ~/.aimtrue/test-automation-key)" npm run seed:scenarios -- --base=https://tutoring-test.tmi-api.workers.dev --demo`;
4. **the test app**, "AimTrue-Test" (pointed at the demo): `npm run mobile:devices -- test` builds it once
   and installs it on every physical iPhone and iPad paired with this Mac, in parallel, one retry each.
   Report per device; a device that is locked or off the network is reported, not waited for;
5. back up production (`wrangler d1 export tutoring-db --remote`), unless the owner waives it, and apply
   the phase's additive schema block, checking the new queries read-only against production. Since
   Phase 49 every such block in `docs/database.md` is fenced ```` ```sql release=phase-NN ````: that
   label is how `test:compat` finds what production still owes;
6. **the tutoring prod Worker, then the tmi-portal prod Worker**: `npm run deploy` deploys `tutoring` and
   then `tmi-portal`, back to back (never one alone, as they share a database); then smoke-test both
   addresses;
7. **the production app**, "Aimtrue" (the personal variant, pointed at `tutoring`):
   `npm run mobile:devices -- personal`, the same way as step 4. Free-team installs expire after 7 days,
   so `npm run mobile:devices` (both apps) is also the weekly re-install (`docs/mobile/real-devices.md`).

Stop and report if any step fails. Outside an approved release, ask first.

**Every Worker restates its own bindings.** Named envs in `apps/api/wrangler.jsonc` do not
inherit `assets`, `d1_databases`, `vars` or `triggers`, so each restates all four: never let one
inherit another's database, and do not "tidy" that duplication away.

## Rules

**There are no migrations.** This is a greenfield project: `apps/api/db/schema.sql` is the
single source of truth, and `npm run db:rebuild` drops and recreates everything from it (then
loads `db/catalog.sql`, the generated curriculum catalog). To change the data model, edit that
file and re-run `npm run db:reset`. Do not add a migrations folder or numbered migration files.

**A person is one `users` row across every organization: their sign-in and how to reach them
(name, email, phone) -- nothing else.** Belonging to an organization is `org_members` (its
`status` and `removed_at` are per organization); what they do there is `user_roles`, keyed
`(organization_id, user_id, role)`. Everything an organization decides or records about a person
carries `organization_id` too: `tutor_profiles`, `student_profiles`, `guardianships`,
`payment_handles`, `availability_slots` -- the test is "could two organizations sensibly disagree
about this?". Never add a `role` column or an `is_tutor`-style boolean, and never put a
per-organization fact on `users`. Platform admins are a table (`platform_admins`), not a role.

**A profile row exists only while its role is held -- in that organization.** Dropping a role
deletes its profile there, in the same batch as the role change (`profileCleanupStatements` in
the users repository).

**Three rules live in the API because SQL cannot express them**, and they are easy to break by
accident: a student must have at least one guardian WHO IS A MEMBER OF THIS ORGANIZATION (which
is why creating a student and naming their parent is ONE request), only admins of the
organization may mutate its users (`requireAdmin`), and the profile rule above. See
`docs/data-model.md`.

**Every request names its organization, and is re-checked against membership.** The session
cookie is identity only. The organization travels per request -- the `X-Organization` header on
fetches, `?org=` on download and calendar links (`withOrg` in `apps/web/src/lib/organization.ts`)
-- and `requireOrg` (mounted after `requireAuth` on the guarded router) re-reads the membership and
the person's roles THERE on every request, so `c.get('user').roles` are the roles in that
organization and an admin of one is nobody special in another. Each tab keeps its own choice in
`sessionStorage`; the `tmi_last_org` cookie remembers it for the next visit (and, with sign-in
off only, stands in for the header). `/api/auth/*`, `/api/platform/*` and the public logo route
sit outside it.

**Every query on an organization's data names the organization.** Repositories take a branded
`OrgId` (only `requireOrg`, or a row's own column, mints one); scope helpers never return `null` --
an admin's scope is `alias.organization_id = ?`; a lookup by id adds the organization and answers
404 for a row elsewhere. `scripts/check-org-scope.mjs` (run by `npm run typecheck`) fails on a
`.prepare(` touching an organization table without it -- the four catalog tables (`curricula`,
`organization_curricula`, `curriculum_levels`, `curriculum_topics`) count, since an unjoined read
of them would hand out curricula the organization does not offer; a query that genuinely reads across
organizations (the cron's sweep, sign-in) says so with an `org-scope:` comment. The database
backs it up: every root table's `BEFORE INSERT` trigger refuses a person who is not a member of
the row's organization, and `BEFORE UPDATE OF organization_id` refuses any move.

**A person lands in the last space they opened** (Phase 60, `docs/spaces-plan.md` S4-S8).
`org_members.is_default`, at most one per person (`org_members_one_default`), is the last space
opened on any device: `POST /api/auth/enter` moves it (two writes when it moves, none when not, no
log line of its own) and leaving clears it. An ARRIVING tab or app (no space of its own in
`sessionStorage`, `getTabOrg`) lands by `decideLanding` in shared: a link's space (`?org=`), else
that last choice, else their only space when nothing is pending (no invitation, no request), else
the selector -- never by the `tmi_last_org` cookie or `DEFAULT_ORGANIZATION` (which brands the
sign-in page only); a tab that has chosen keeps its space. There is no star: `PUT
/api/auth/default-organization` stays for older apps and sets the same column. `/spaces` is the
person's own console (in the frame inside a space; the full-screen selector outside one;
`/select-organization` redirects there): their spaces with Open and Leave, invitations (Accept
enters at once), join with a code, start a space, the console link for platform admins, and
Delete my account while they belong nowhere -- all from `GET /api/auth/session`. Inside a space an
invitation is also a banner (Not now hides it for the tab) and a count on the switcher, which is
always shown with "All spaces". `POST /api/spaces/:slug/leave` (outside `requireOrg`) leaves from
anywhere, the last admin refused 409 `last_admin`; `POST /api/organization/leave` stays for older
apps (`lib/leave-space.ts` is both). The e2e fixture gives every tab its `org` as its own
(`sessionStorage`), so only `org: null` arrives.

**An email says what happened, to whom it concerns, and nothing more** (Phase 32, R15). While an
organization's `email_notifications` is on, four actions call `notify` (`lib/email.ts`): a person
added (`routes/users.ts`), a plan or assessment (`routes/progress.ts`), a schedule
(`routes/schedules.ts`) and a recorded lesson (`routes/sessions.ts` and `recordRunningSession`,
which covers the stop button and the cron). It runs after the response in `waitUntil` and never
throws. `recipientsFor` picks live members of THIS organization only -- a student AND their
guardians, the tutor(s), the admins for a new person -- drops the actor, and dedupes. A message
carries no money, notes, write-up, comment or assessment text, and no score; a new notifying
action extends `NotificationEvent` and `describe`, never adds a free-text field. Every attempt is
a `notification_log` row (ids and outcome, never an address or the text), readable by the
organization's admins on its Organization page. Only the production pair has the `send_email`
binding and `EMAIL_FROM`; anywhere else an attempt is logged `skipped`. On Cloudflare's free plan
only verified destination addresses receive mail -- the rest are logged `failed`.

**A lesson's place is a location, chosen from the pairing's, and a schedule always has one**
(Phase 33, R16). `locations` are a tutor's or a student's own (name, physical/virtual, address or
link, `reminder_minutes`), written by an admin, the person or their parent (`managesLocationsOf`);
admins also see every one on the Locations page (`/locations`, menu item admin-only); a pairing
allows some of its two people's (`assignment_locations`, admins only); a schedule picks
from those (`schedule_locations`): at least one, never two of one kind -- `scheduleLocationProblem`
in shared, the `UNIQUE (schedule_id, kind)` and triggers in the database. A location a schedule
uses cannot be deleted, re-kinded or dropped from its pairing. `reminder_minutes` > 0 raises the
in-app reminder sheet (`dueReminder` in shared; `LessonReminderSheet` on the web, the Home sheet
in the app); push is later (`docs/roadmap/push-notifications.md`). The log names a location, never
its address.

**The product is three feature sets, and a space may be allowed some of them** (Phase 50,
`docs/open-signup-plan.md`). **Tutoring** (pairings, sessions, schedules, locations, payments and
1099s, progress, comments, the tutor's Home, the dashboard, the tutor role), **Assessment** (the
Assessment menu) and **Quest** (Question Quest and Quest Games). Platform admins allow them per
organization (`feature_tutoring`, `feature_assessment`, `feature_quest`; `PUT
/api/platform/organizations/:id/features`); Assessment and Quest keep their admins' own switch, so a
set is on when it is allowed and switched on (`featureOn` in shared -- never read the columns
directly). A set that is off is gone for every reader there: its menu items, its dashboard sections,
and its routes, which answer 403 `feature_unavailable` (`requireFeature`, mounted per route group in
`index.ts`; a new route of a set goes under its group). Its data is kept, and reaches nobody until it
is allowed again -- a kept pairing gives a tutor nothing where Tutoring is not allowed
(`pairingInForce`). A space without Tutoring has the Assessment home, no tutor role and no tutoring
fields; an edit there leaves Tutoring's sections out of the request rather than sending them empty (R23).

**Before strangers can sign in, three things are closed** (Phase 51). An invitation shows the
inviting organization only the name it typed and no phone until the person accepts
(`org_members.invited_name`), and locks none of their shared details elsewhere; a first sign-in accepts
only a console organization's invitations by itself (`created_via`). A self-serve space's Quest approval
is a suggestion for the console (`quest_trusted`, `question_suggestions`), and only trusted spaces count
towards two right answers. Sign-in and adding people are rate-limited per minute by a Durable Object per
key (`RateLimiter`, `lib/rate-limit.ts` -- never D1, whose writes are metered) and capped per space per
day from the log (`DAILY_CAPS`). A self-serve space runs no AI task and sends no email. `/terms` and
`/privacy` are public pages (`packages/shared/src/legal.ts`): a wording change is a new version, and
`LEGAL_DRAFT` must be false before sign-up opens.
**Anyone with a Google account may sign up, and a space is how they take part** (Phase 52,
`docs/open-signup-plan.md`). "Space" is the word on screen; the code says organization. An unknown
Google account gets a signed 15-minute `signup` token (only from a client that sends `signup: true`, so
older apps keep the 403); `POST /api/auth/signup` takes the birth month and year and the accepted terms
-- under 13 is refused and nothing is stored; only the band is kept (`platform_accounts`). A newcomer
joins a space by asking with its code (`POST /api/spaces/join-requests`, since Phase 72 with the role they ask
for and a short note, `join_requests.role`/`note`, read by the space's admins only, R32; a teen asks only as a
learner, `joinAskRolesFor`; the space's admins let them in
-- since Phase 71 a short Let in sheet, starting on the asked role: the role, a parent by default, then "Which child is theirs?", a
student linked as their guardian or one added now; still the ordinary `POST /api/users` with
`join_request_user_id` -- or decline, asked first). The answer, let in or declined, stays on the person's home
until they dismiss it (`POST /api/spaces/join-requests/:slug/dismiss`, `join_requests.outcome_dismissed_at`,
30 days; a let-in only while they are still a member there; older apps' `/join-requests/seen` no longer hides
it). Or an adult makes one
(`POST /api/spaces`): self-serve, Assessment and Quest allowed and on (Phase 61, S10), no Tutoring,
untrusted, no email, its maker its admin, its slug from its code. Since Phase 61 (`docs/spaces-plan.md`
S10-S13) every space made -- in the console too -- starts with its admins' Assessment and Quest switches
on (existing spaces keep theirs); a newcomer's Welcome puts **Join with a code** and **Start a space**
(adults) side by side; and starting one opens the new space on **Invite people** (the wizard's `invite`
screen, `InvitePeople`, before the tour): rows of email and role (`inviteRolesFor`: Admin, Parent, Tutor
only where Tutoring is allowed), each the ordinary `POST /api/users` built by `inviteRowRequest`
(status `invited`, so even a new address accepts by hand), told by **Copy invitation** / **Share**
(`invitationText`) since such a space sends no email, with its code card; **Skip** goes on to the tour. Codes are 8 characters of `SPACE_CODE_ALPHABET`, unique, found only while joining by
code is on. A student added in a self-serve space needs the adult's consent (`parent_consent`, a
`consents` row). A self-serve space's admin may delete it -- `purgeSpace` removes every row it holds
(`scripts/check-purge.mjs` fails on a table the purge misses) -- and a person in no space may delete their
account. Routes before a space sit outside `requireOrg` (`routes/spaces.ts`), like the invitation routes (R21).
**Sign-up is behind a switch:** `SIGNUP_OPEN` in each Worker's `vars` -- "false" on the production pair
until the owner approves the terms and privacy wording (then `LEGAL_DRAFT` goes false too), "true" on
the demo and in `.dev.vars`. **`tmi-portal` never takes sign-ups and never offers guest play** (owner,
2026-11-02): its `SIGNUP_ALLOWED` and `GUEST_PLAY` are "false", which no console setting overrides
(`signInFor`, `guestPlayOn`). Everywhere else (`tutoring`, the demo, both apps) the console decides. Closed, an unknown Google account is refused as before and
`POST /api/auth/signup` answers 403; `/api/auth/config` reports `signup_open`.

**One word per thing on screen: lesson, person, quest, space** (Phase 59, `docs/spaces-plan.md` S1, for "space";
Phase 78, `docs/journey-fixes-plan.md` JF32, for the rest). The glossary is `packages/shared/src/words.ts` (`TERMS`,
`countOf`, `COMMON_COPY`, `SIGNED_OUT_MESSAGE`), and both clients read it -- with `QUICK_ACTION_LABELS` (shared
`home.ts`) -- rather than keeping copies. What a person reads -- the web, the app, the API's error messages, audit labels
and new audit descriptions, notification labels, PDFs, the brand blurb, the tour -- says **"lesson"**, never
"session" (the sign-in sense too: "You were signed out"); **"person"/"people"**, never "user(s)" (the web's Users page
is People, as in the app); **"quest"** for anything played on the board, named in words (`gameWords`: "Grade 7 Quick
5"), never "Quest game" or a tile code -- "game" stays only in "Play with" and in codes ("game code"), and "Question
Quest" is a proper name; **"space"**, never "organization" (nor "institute" as a generic word); and no "Beta" (checked
questions are served like any other). The CODE keeps its names (`organizations`, `OrgId`, `X-Organization`,
`/organization`, the `sessions` and `users` tables, `/api/sessions`, `tmi_session`, `user_id`, `useUsers`,
`X-Dev-User`, testIDs, query keys, audit KEYS such as `session.recorded`, API error CODES, the API's `beta` fields);
old audit lines are never rewritten; proper names stay. `scripts/check-ui-words.mjs`, run by `npm run typecheck`, is
a table of rules (organization -> space, session(s) -> lesson(s), user(s) -> person/people, Quest game -> the quest in
words, Beta -> nothing), each failing on its word in JSX text, in prose strings, and in strings given to labels,
titles, badges, messages, toasts, `ApiError`s, Zod messages and `*_LABELS` / `*_COPY` tables -- and, for the last
three, in any capitalised one-word string ("Sessions", "Users", "Beta") outside a type -- and saying the word to use;
log lines and the Worker's internal `new Error(...)` are not read. A `ui-words:` comment marks a deliberate exception
(the console's own Beta labels, the versioned terms). The terms and privacy reworded
the same way are version 2026-10-31, approved by the owner on 2026-11-01; version 2026-11-01 (guest play and
anonymous counts, Phase 63) was approved the same day, and version 2026-11-04 (the days a person opens a space and
how they first came, Phases 68-69) on 2026-11-04 and is the current one. A sign-up still accepts 2026-11-01, 2026-10-31
and 2026-10-29, which app builds on phones send (`ACCEPTED_LEGAL_VERSIONS`), and records the version sent.

**Platform admins run the platform, not organizations.** The console (`/platform`,
`routes/platform.ts` behind `requirePlatformAdmin`) creates, brands and archives organizations and
adds their admins by email; it never reads an organization's people, lessons or money. Its
actions are logged in the affected organization's own log. `ndessai@gmail.com` is the first
(`db/platform-admin.sql`).



**Shared fields of a person in two or more organizations are the platform's.** An organization
admin's PATCH that changes their name, email or phone is refused (409 `shared_fields_locked`):
one organization changing an email would hand over the account in every other. A platform admin
corrects them from the console.


**A student may have no email; everybody else must.** `users.email` is nullable because most
students are children who never sign in. Sign-in matches on email, so anyone holding a role
other than `student` needs one — `requiresEmail` in `packages/shared/src/users.ts` is the rule,
applied by `refineEmailForRoles` on the create schemas and `assertEmailPresentIfNeeded` on
update. Never invent a placeholder address to satisfy a form, and never render an absent one as
a `mailto:` — use `EmailOrNone`.

**The Worker has two clients, and a change to it is smoke-tested on both.** The web app and the
mobile app call the same routes, but they are built apart: `apps/mobile` is its own install, and
each feature's `api.ts` there is a COPY of the web's. `npm run typecheck` covers both and catches
a changed shared type; it does not catch a renamed route, a field dropped from a response, a
changed error code or a seed the other client's screens depend on. So whenever a change touches
`apps/api/src` (routes, repositories, auth, the envelope), `apps/api/db` (the schema, the seed
generator) or `packages/shared`, run **`npm run smoke`** before calling the work done, and before
committing it -- whichever client the change was made for:
- **Web:** the Playwright tests tagged `@smoke` (each role's portal, every read endpoint as every
  non-admin, the onboard-teach-bill-settle path, a live lesson).
- **Mobile:** the Maestro flows tagged `smoke` (developer sign-in, the shell's tabs and pages, the
  shared formatting on Hermes), on the iOS simulator AND the Android emulator.
- **Local only**, as every test here is: the local Worker and the local seeded D1, never
  production or the demo. It resets the local database.
- **Then the feature's own tests on both sides**, when the change is to one feature's routes or
  tables: its spec (`E2E_BASE_URL=http://localhost:5173 npx playwright test <spec>` from `e2e/`)
  and its flows (`npm run e2e:mobile -- both apps/mobile/.maestro/flows/<feature>`).
- **A red smoke is a failed step.** Fix the change, or carry it to the other client (the mobile
  `src/features/<feature>/api.ts`, and its row in `docs/mobile/parity.md`); never untag or loosen
  a test to get to green. Say in the report which platforms ran and what they returned; if a
  simulator or the emulator cannot run on this machine, say that rather than "smoke passed".
- **Keep it a smoke test:** a few minutes, the main path. A new screen or route on that path
  joins it by tag (`{ tag: '@smoke' }` on the test, `tags: [smoke]` on the flow); everything else
  stays in the full suites.

**Validation lives in `packages/shared`.** Do not write ad-hoc validation in a route handler
or a form. Add or change the Zod schema, then use it on both sides. Note the split between
`userFieldsSchema` (no defaults, the basis for PATCH) and `createUserSchema` (adds defaults) —
a `.default()` survives `.partial()`, which would make PATCH silently overwrite omitted fields.
For the same reason, `optionalText` on a PATCH schema needs `.optional()` (or `.partial()`): it is
a transform, which Zod runs on a MISSING key too, so an omitted field arrives as `null` — that
erased a lesson's notes on every edit that left them out, until Phase 23.

**SQL lives in `apps/api/src/repositories/`.** Route handlers translate HTTP to repository
calls and back; they never build SQL. Always bind parameters — the only values interpolated
into SQL are ones that came from a Zod enum (sort column, sort direction).

**An unposted write-up is a `session_drafts` row, never a `sessions` row.** A session is the
billing record; a draft is not billed, not counted and not readable by anyone but its author.
Keeping them in separate tables is what stops a draft reaching a total — do not "simplify" this
into a flag on `sessions`, which would put the burden on every one of the sixteen queries that
read them. Drafts scope on `author_user_id`, admins included, and are priced at posting.
The record form **autosaves** into the writer's own draft every `DRAFT_AUTOSAVE_INTERVAL_MS`
(3 s) when something changed, with `?autosave=true`, which writes **no audit line** — an explicit
Save draft, a discard and posting always do. Recording consumes that draft in the same request
(`from_draft_id`, the recorder's own only), so a write-up never becomes a session and a draft.

**A lesson's write-up is in parts, and an assessment is always the reader's own.** Beside
`sessions.notes` ("what was covered") sit `session_write_ups` (planned, previous-session review,
homework review and status, homework set), off the billing row for the same reason as
`session_progress`, and `session_assessments`, one per person per lesson. Both reach exactly the
lesson's audience and carry no money. `author_role` is decided by `sessionAssessorRole` from how
the reader relates to the lesson — never sent by the client — and the assessment routes take no
author, so nobody can write or withdraw anybody else's. On a draft both travel as JSON and are
published by posting. The log says an assessment was given, never its words or its score.

**A cancelled lesson is a `schedule_cancellations` row, never an edit to the schedule.** One
date of a series, keyed `(schedule_id, occurs_on)`; restoring deletes the row. The capacity
(`cancelled_as`) comes from `scheduleCancellerRole`, never the client; a student cannot cancel, a
parent acts only on today or later and restores only their own, the tutor and the office may also
mark a past date. A recorded lesson outranks a cancellation everywhere — every read goes through
`NOT_OVERTAKEN_SQL` — and progress nets cancellations out of "planned so far". The note reaches
the schedule's audience only, including through progress (R11), and never the audit log or the
calendar file.

**A student's reflection is theirs, whoever typed it.** `session_reflections` holds one per
lesson: four 1–5 answers (difficulty and pace are centred on 3 — never shade them
darker-is-better) and homework notes. It replaces the student's Phase 23 assessment, which the
API now refuses in that capacity. The student, a parent or the lesson's tutor may type it
(`sessionReflectorRole`; the office reads, does not enter), `entered_as` says which, and once
the student has entered it themselves no adult may change it. The lesson's audience reads it;
the log never carries an answer.

**The welcome wizard only ever opens the portal's own dialogs** (Phase 26). Adding a student or
a tutor through it uses `UserFormDialog` preset (`preset`) and scoped to a block of fields
(`sections`), then `AssessmentDialog`, `PlanDialog` and `AssignmentDialog` — never a second copy of
a form, so validation, the guardian rule and the audit stay in one place. A scoped edit saves the
whole record, so a step never clears another's fields. The tour points at `data-tour` attributes
(menu items, `DashboardSection`/`Panel` `tourId`s, the tabs, Getting started): keep them when
moving markup. Whether someone has been through it is `user_onboarding` (per person) alone since
Phase 74 (JF25): the `tmi_tour_seen` cookie no longer re-offers it on a new browser or device, and the
offer is a card on the home, not an overlay. Onboarding lines are left out of the dashboards'
Recent Activity, as payment lines are.

**Deletes are soft.** `DELETE /api/users/:id` sets `deleted_at`. Hard delete needs an explicit
`?hard=true`. The unique email index covers live rows only, so restoring can conflict; that
case is already handled in `POST /api/users/:id/restore`.

**New API routes are authenticated by default.** `requireAuth` is mounted on the guarded
router in `apps/api/src/index.ts`, not on individual handlers, so anything added under it
inherits the gate. A route that must be reachable signed-out goes in `publicRoutes` — and
that is a deliberate decision, not a default. Inside a guarded handler, `c.get('user')` is
always the live, re-checked user.

**Never trust an email that did not come out of a provider's verifier.** The browser (or the app)
supplies an opaque token; `lib/google.ts`, `lib/microsoft.ts`, `lib/apple.ts` and `lib/facebook.ts`
are the only places one becomes an identity (`VerifiedIdentity`), and they are the whole security
boundary of sign-in. Microsoft's person is `tid:oid`, never the email a tenant's admins can set;
Facebook's access token counts only once Graph's `debug_token` says it is ours.

**Several ways in, one person** (Phase 55, `docs/social-login-plan.md`, R25). Google, Microsoft, Apple
and Facebook; each Worker offers the ones listed in `AUTH_PROVIDERS` (default "google") AND configured
(`offeredProviders`), with setup in `docs/sign-in-providers-setup.md`. Apple is built and off until
the paid Apple account (the app's button behind `EXPO_PUBLIC_APPLE_SIGN_IN`). No magic links. Every
provider ends in `completeSignIn` (routes/auth.ts): sign-in looks up `user_identities (provider,
subject)` first, and joins a new account to an existing person by email only under `mayLinkByEmail`
(verified, not an Apple relay address, no account from that provider yet) -- never loosen it, it is
the account-takeover boundary. `users.google_sub` is still written beside the Google row for older
Workers. The web uses Google's button and redirect flows for the rest (`/api/auth/<p>/start` and
`/callback`, state in a signed SameSite=None cookie, the outcome in the URL fragment); the app posts
the provider's token to `POST /api/auth/<p>`. Locally `AUTH_FAKE_PROVIDERS` takes the suite's
`fake:<provider>:<subject>:<email>:<verified>` tokens -- never in production. My profile's "Ways to
sign in" adds and removes them (never the last); Apple's tokens are revoked when an account is deleted.

**One tap is the members' way into Quest** (Phase 62, `docs/stickiness-plan.md` P1-P8). Tiles are quests
named `<level tag><Q|T|A><n>` (`G4T10`, `BA3Q5`, `G4A5`; `TILE_LEVEL_TAGS`, `tileCode`/`parseTileCode` in
shared `quest-tiles.ts`), kept by platform admins in the console's Settings > Play (`platform_settings`
'tiles' and 'play'; no row is `DEFAULT_TILES`) and served to members by `GET /api/quest/tiles` (their space's
curricula, levels at the console's minimum depth). The Play home (Continue on the device, favorites, Waiting
for you, tiles, one code box) is the home of a space without Tutoring and of students anywhere; staff keep
their dashboard with a favorites row. A tile or favorite is the existing one-request `POST /quest/games`; a
multiplayer favorite sends `host_plays` (the host plays from the start) and its roster as `invite_user_ids`
(`quest_game_invites`, R27). Checked questions are a PLATFORM admin's per-space switch
(`organizations.checked_questions`, on everywhere for the soft launch; read through `checkedQuestionsOn`,
never the column; `canvas_assessments_unreviewed` now only reports it), each served with `beta` -- kept for older app
builds; since Phase 78 no client shows it (no pill, rules line or menu badge). Game answers
feed the two-right-answers rule: `quest_game_seen.correct` marks the answering player, and
`approveManyByConsensus` counts them beside Quest's attempts -- same threshold, same trusted spaces. Playable
counts are the platform's, cached (`platform_settings` 'level_counts', refreshed daily by the cron); a status
change marks its level dirty (`markQuestionLevelsDirty`) for a one-level recount -- never count the bank per
request. A single player's game is not polled (`gameRefetchDelay`: the countdown's end, a timed game's end,
and every 30 s).

**Anyone may play before signing up, and nothing about a guest is kept** (Phase 63, `docs/stickiness-plan.md`
P9-P16, R26). While a Worker allows it (`GUEST_PLAY`, "true" on `tutoring` and the demo, never `tmi-portal`)
AND platform admins switched it on (console Settings > Guest play, `platform_settings` 'guest'), a
signed-out visitor's home is the guest Play home and `/api/auth/config` carries `guest` (tiles, settings,
member counts, the pool version). A level's guest pool (`guest_questions`, a few per level, chosen in the
console) is public by design -- served with keys at `GET /api/public/guest/<version>/<level>`, versioned
and memoised, no D1 per play -- and RESERVED: every member draw (games, Assessments, Question Quest) and
every count leaves it out (`guestIdsFor`). Play, the guest Assessment and marking happen on the device;
the server gets only anonymous counts (`POST /api/public/events`, Analytics Engine, no id/cookie/IP). The
sign-up offer pauses the guest's clock. Signing up is a sheet over the page, and POST /api/auth/signup makes
the newcomer a personal space (`organizations.personal`; a teen's takes nobody by code and a teen adds
nobody; hidden from the console's list; purged with the account when they are its only member; not counted
in spaces_per_person; no wizard by itself) -- the Phase 61 Welcome remains only for someone in no space.
What the device kept as a guest carries over on that device only, read from its own storage and never sent: its
grade (else the level of the tile played last) leads the member's Play home until a quest starts there
(`guestLeadLevel`), and the tiles it played become favorites, once each (`useCarryGuestTiles`, web and app).

**The habit layer is derived, never stored as a total, and is the reader's own** (Phase 64, `docs/stickiness-plan.md`
P17-P20, R28). The weekly streak counts weeks with `STREAK_DAYS_PER_WEEK` (3) days played (`weeklyStreak` in shared
`habit.ts`), from `activity_days`: a game's end adds each answering player's `game_answers` for that day on the space's
clock, in the results batch, guarded by membership (never `answers`, which Question Quest's totals sum); a Daily adds one
too. Badges are `earnedBadges` over counts kept anyway -- no badge table. The Daily set (`GET /api/quest/daily/:level`)
is `DAILY_SET_SIZE` questions of a level, the same for everyone that day (`dailySeed`; approved first, checked only where
the space serves them, never the guest pool), memoised per isolate; its questions travel WITHOUT keys until the reader
has played, the answers are posted once and marked by the server (`checkAnswer`), and `daily_results` keeps the marks,
one play a day. It is the console's switch (Settings > Play, `PlaySettings.daily`). A tile's `best` and a single
player's `new_best` are read from finished games (`bestScores`, `isNewBest`), never stored. Games still award no points.

**Who may sign up is the console's, per platform** (Phase 65, `docs/access-approval-plan.md` A1-A9).
Settings > Guest play > Sign-up access (`platform_settings` 'access', no row = Open): **Open**; **Pre-approved**
-- a newcomer whose verified email, pattern or provider account is not on `access_list` is refused (403
`not_on_list`) before anything is stored (`assertMaySignUp`, in `completeSignIn`'s sign-up branch and `POST
/api/auth/signup`); **Post-approved** -- the account and its personal space are made with
`platform_accounts.access` 'pending' and no session (403 `access_pending`). `access` is read with the person
on every request (`SELECT_PERSON`) and `assertAccess` refuses a pending or declined account at sign-in, at
sign-up and in `requireAuth`, so approving or revoking takes effect on the next request. Only self sign-ups
are gated: a person a space adds or invites has no platform account and is approved, as is every account
from before. Decisions are `platform.access_*` on the platform log. Both platforms run Post-approved since the
release (owner, 2026-11-03); it sits beside the sign-up switch below, which still decides whether anyone may
sign up at all. Since Phase 70 (journey fixes, `docs/journey-fixes-plan.md`): the waiting words say a person
checks every new account, usually within a day (`accessPendingMessage`, owner 2026-11-04; no notice is sent
when it ends); `/api/auth/config` carries `signup_access`, so a sign-up says so before the provider's button
(`SIGNUP_ACCESS_NOTES`); a `not_on_list` refusal carries the checked address in `details.email`; every
refusal leads with Keep playing; and a device remembers an under-13 refusal as a one-way key of the address
(FNV-1a, never the address), so the age question is not offered to that account again there.

**One member home, one Next up** (Phase 66, `docs/member-home-plan.md` H1-H4, H9, H11). `/` (the app's Home tab)
is the same home for every member, built from the same blocks: the band (the guest band, slimmer: greeting,
space, one line for the hat that leads), ONE **Next up** card, at most three quick actions (`quickActionsFor`), and
a section per hat. Hats exist only with content -- tutor (a pairing in force), office (an admin of a space that is
not personal), parent (a live child here), learner (a student, or anyone who plays where there is no Tutoring) --
and someone with none gets the one their roles imply, empty; hats with something today come first
(`orderHats`). Next up is `chooseNextUp(nextUpCandidates(home, extras))` in shared `home.ts`, a fixed priority,
time-bound first (a lesson just ended and not recorded, a lesson starting within `START_LEAD_MINUTES`, a change
to a child's lesson, a game invite, reviews...); "Later" puts one off for the day on the device; nothing else on
the page moves. Everything comes from one read, `GET /api/home` (`repositories/member-home.ts`), which takes no
person and carries no money (R29); the office part is memoised 60 s per space; `/home/tutor` (Phase 43) stays,
gated to Tutoring. The role dashboards, with Tutoring and Finance, moved to `/dashboard` (web menu "Dashboard",
the app's More → Dashboard), and the tour now starts on the home's blocks. Lessons of the last
`UNRECORDED_LOOKBACK_DAYS` (7) scheduled and never recorded are flagged under "To record", for the tutor and the
office; Record opens `SessionFormDialog` prefilled from the schedule (`fromSchedule`).

**A tile wears its grade's hue, and a newcomer keeps the guest page's promise** (Phase 67, `docs/member-home-plan.md`
H5-H8). One hue per grade 1-8 (`--grade-N` / `--grade-N-foreground` in `index.css`, the Okabe-Ito colour-blind-safe
set, the same in every palette, regenerated into the app; `apps/mobile/scripts/check-contrast.mjs` checks each label
at 4.5:1 and every pair apart under three colour-blindness simulations). A harder track (Beast Academy, AoPS,
Kangaroo) takes its grade's hue with an "Adv" mark; a level off the row wears the brand's; the mode is an icon; a
card always says its level in words (`tileLook`, `levelGrade`, `memberBoard` in shared `tile-look.ts`) -- never
colour alone. Members read real curriculum names; the guest page masks them and keeps its mode colours. The guest
board's `QuestCard`, `TodayCard` and `GradeRow` live in `features/play/` and serve both homes. The member Play home
is the Quest board: Continue, today's Daily as five rings, My progress (this week's seven dots, a "Welcome back"
after a week away -- never a loss message -- and the next badge with how far along: `weekDots`, `welcomeBack`,
`nextBadge`, all derived), favorites, then a grade row led by the last quest's (or the guest's) grade, that
grade's cards and "More levels". A personal space starts with NC 2026 (default) and Beast Academy
(`PERSONAL_SPACE_CURRICULA`; existing ones backfilled by the `phase-67` block), and there "Show your work" -- the
guest's assessment tiles -- is for oneself (`POST /canvas-assessments` with one's own id, only where
`org.personal`). `QuestLanding` is gone: a student's waiting Question Quest is a Next up item (`question_quest`),
a tutor's answers to review already were.

**A home leads with what its person does, and a family plays together** (Phase 68, `docs/member-home-plan.md` H4,
H10). Each home has a focus (`HOME_FOCUSES`: Quest, Assessments, Teaching, My children, Running the space), chosen by
`deriveHomeFocus` in shared: the person's pin ("Make this my home", `org_members.home_pin`, `PUT /api/home/pin`, only a
choice in `focus_options`; a preference like the last space opened, so no log line), else what they did on at least
two of the last 14 days, else how they arrived (`platform_accounts.arrived_via`: the sign-up sends ONE word,
`arrivalFromGuest` of the device's played tiles -- never the tiles, grade or scores), else their hats. The pinned
hat's section always comes first; otherwise the focus leads within `orderHats`' today-first order; an
assessment-led home puts Assessments above the Quest board; with nothing else, Next up offers the focus's first step
(`focus_default`). A parent's child card shows in every space: where Quest is on, the child's days played this week
and today's Daily (counts only, R29) and **Play with <child>** (`playWithRequest`: a game of two, the parent playing,
the child invited), "Practise together before <day>'s lesson" when one is within `PRACTISE_BEFORE_DAYS`; a learner
with such a lesson who has not played today gets **Practise before <day>'s lesson** in Next up (`practise_before`).

**Whether people come back is counted, never watched** (Phase 69, `docs/member-home-plan.md` H12, R30). `visit_days`
holds one row per person, space and day they opened it (the day on the space's clock and the first client, nothing
else), written by `requireOrg` after the response, at most once a day per isolate (`recordVisit`), and only while the
console's visit recording is on (`platform_settings` 'visits') -- which `PUT /api/platform/visits` refuses (409
`privacy_pending`) until the published privacy notice is `VISITS_PRIVACY_VERSION` or later (`visitsMayRecord`):
never loosen that guard, publish the notice. The cron's daily rollup (`refreshStickinessIfDue`) reads the visits and
the days played (`activity_days`) across spaces into totals (`computeStickiness` in shared: weekly over monthly
actives, days per week, the 3-day rhythm kept, back after a missed week, the Daily, retention at weeks 1/4/8 by hat,
space kind and arrival), stored as `platform_settings` 'stickiness' and shown on the console's Stickiness page; groups
under `STICKINESS_MIN_GROUP` (5) are withheld; no route reads a person's rows. Visit rows are deleted after
`VISIT_KEEP_DAYS`, with the space and with the account.

**One "Have a code?" sheet, and a space says who it is** (Phase 72, `docs/journey-fixes-plan.md` JF4, JF7, JF9,
JF12, JF26, JF33). Every code door -- the guest page, the home's quick action, the Quest board's box, a shared game
link (`/?code=`) -- opens `CodeSheet`: six characters look a game up and open its join choices, eight look a space up
and NAME it before "Ask to join" (with the role and the note). Signed out, a code is kept on the device, and so is a
friend's quest link a guest cannot play (`guestMemory.keptCode`/`sentTile`, never sent); the first home offers either
once (`KeptForYou`). A new self-serve space takes the palette the maker's other spaces wear least
(`SPACE_PALETTE_ROTATION`, never plum); a personal space stays slate and reads "Just you" (`Membership.personal`). An
invitation names the admin who added the person by first name (`org_members.invited_by`, R32), and its text links to
`/spaces`. Someone a space added accepts the terms and the privacy notice once, at their first sign-in: a
`legal_acceptances` row is made due then (never for a self sign-up, who accepted at sign-up, nor for anyone who signed
in before Phase 72), the session says `legal_due`, and the portal waits behind a sheet until `POST /api/auth/legal`.
A trailing % counts as the number only where the question asks for a percent (`asksForPercent`, `checkAnswer`'s
`stem`); the bank's blind solve stays exact.

**Continue resumes the open game, and the board leads with the learner's grade** (Phase 73, `docs/journey-fixes-plan.md`
JF13, JF14, JF16, JF23, JF36). Continue (the board, Next up's `open_game`, the app's home-screen action) reads
`GET /api/quest/games/open`: the reader's newest game here through the player index, and for a running one a READ-ONLY
`progress` call on its Durable Object -- never `view`, which hands a question -- labelled in words (`openGameLabel`,
"Grade 7 Quick 5 · question 3 of 5 · 2 points"); with none open, `playAgain` ("Play Grade 7 Quick 5 again"). It is read
lazily where Continue shows, never polled. Nothing about the last quest is kept on the device any more. The board and the
Daily lead with `GET /api/quest/tiles`' `lead` (`questLeadGrade`: the grade picked on the row, `org_members.quest_grade`,
0 "Not in school"; else the level recorded for a student; else the last level played; else, for 13+, the top of the
row), and `ask_grade` asks once when nothing says; a pick is `PUT /api/quest/grade` (a preference, no log line). One
Daily rule (`dailyLevelFor`) and one name (`DAILY_NAME`, "Today's Daily"; "Today's 5" is the guest page's). A team that
answered nothing is not placed ("Nobody played"), and games, family games and best scores count only games the
person answered in (a skip is an answer: with negative marking, skipping is a choice).

**A first home leads with what its reader came for** (Phase 74, `docs/journey-fixes-plan.md` JF6, JF16, JF17, JF23-JF25,
JF31). Where Tutoring is off, the hats lead parent, then office, then learner (a parent's or the office's lead also beats
how they first arrived, in `deriveHomeFocus`); an office with nothing says so in one line, and counts its open
assessments (`HomeOffice.assessments_open`). A learner who never played here (`HabitSummary.played_before`) gets three
doors in the band -- Play, Join with a code, Start a space -- and never "0 of 3 days". When Next up shows the Daily or a
game, the board's own is quiet. Lesson lines name the place by name only (`HomeLesson.place`, R16). Practice before a
lesson opens the week before (`PRACTISE_BEFORE_DAYS` 7, strictly less than 7 days ahead). The Dashboard opens on the
home's hat (`dashboardRoleForHat`) unless a role was asked for or remembered for the space, under "Viewing as". The tour
is offered once per PERSON (`tour_finished_at`), inline on the home. Users, Pairings and Billing are in the menu only for
admins and tutors (`seesPeoplePages`); deep links still open.

**A lesson that cannot be priced is refused at Start, in its reader's words, and the lessons owed are one list**
(Phase 75, `docs/journey-fixes-plan.md` JF18, JF19, JF30, R34). `POST /api/sessions/active` runs `resolveSessionRates`
before anything starts (a mode switch on `PATCH /active` too); every pricing refusal (Start, Stop, Record, a correction,
posting a draft) keeps the 422 `validation_failed` with `details.mode`, and its MESSAGE is `missingRateMessage` -- a
tutor reads "Ask the office to set Yusuf's price." (or "...virtual price", "...your pay rate"), the office "Yusuf
Haddad's in-person price is not set." -- since older apps show only the message. No new fallback: each mode is priced
on its own, and a space paid directly reads no student price. The stop saves the typed note onto the running lesson
BEFORE pricing, so a refused stop loses nothing. A pairing, a schedule and a student's record carry `price_missing`
(`missingPriceModes`, computed in SQL beside the prices, never an amount) so "No price set" survives `scopeStudentCharges`.
`GET /api/sessions/to-record` (`listLessonsOwed`, `repositories/lessons-owed.ts`) is the scheduled lessons of the last
`UNRECORDED_LOOKBACK_DAYS` never recorded, cancelled or left running -- a tutor's own, an admin's every tutor's -- as
`LessonOwed` rows with the READER's own draft (`myDraftsByLesson`, matched by tutor, student and date); the member home's
"to record" uses the same occurrences and rule, and its rows carry the same `draft`. A running lesson leads Next up
(`lesson_running`, fed by the client's own `GET /api/sessions/active` through `NextUpExtras.running`). **Adding people is
one chooser** (Phase 76, JF21, JF37): `addChoices`, `nextStepsAfterAdd`, `USER_STATUS_DESCRIPTIONS` and `invitationText`
(with `spaceWhat`: "a space for practice and assessments") are shared; `POST /api/users` naming the signed-in adult as a
guardian gives them the parent role in the same batch (logged `user.roles_changed`), and their own address answers 409
"That's you: add your child, and you'll be their parent."; a personal space's home offers `add_person`.

**A child who does not sign in plays on the parent's device, and a guardian hands over the child's assessment**
(Phase 77, `docs/journey-fixes-plan.md` JF15, JF20, R35; this changes H10's "each on their own" and the canvas plan's
starter-only continue). "Play with <child>" is `playTogetherRequest`: a child who signs in (`HomeChild.signs_in`) keeps
the online invite (`playWithRequest`, whose lobby now lists `GameView.invited`, host and admins only); one who does not
is a SEAT -- `createGameSchema.seat_user_ids` (1-4), each a live dependent of the host here with no email (`checkSeats`:
anyone else 422 on `seat_user_ids`, a child with an email 409 `seat_signs_in`, "Ben signs in: invite them instead."). A
seated game is a solo team for the host and one per child, begun at once, `late_join` false, no invitation rows; its
code finds nothing and nobody joins it (`GAME_CODE_NOT_FOUND_MESSAGE`, the same words as no game). `EngineGame.seats`
(child -> host) is the Durable Object's check: the host's session answers for a child with `as_user_id` (anyone else's,
409), no D1 per answer, and the host's view carries `seats` (each child's hand, no key, R20) -- every team plays the
same series, the client alternates, the child first. Credit follows the answer's person (`activity_days`,
`quest_game_seen`), so the child's days and games are the child's, but a seat's answer never counts toward the
two-right-answers rule (`correctGameAnswers` drops them: a parent's device may be the parent answering).
`quest_game_players.seated_by_user_id` (`release=phase-77`) marks the seat: `family_games` counts a game the person
was seated in or seated someone in -- never through `quest_game_invites`, so no Waiting for you or Next up `game_invite`
ever shows it -- and `HomeChild.open_game_id` is the newest running game the READER seated that child in ("Continue
with Ben"), with `HomeChild.grade` (`childGrade`: picked > recorded level > the school course's "Grade N" > the last
level played) in the same one read. An assessment in progress is continued and submitted by its starter OR a guardian
of the student here (`guards_student`, `can_continue`), after the client's "Hand the device to Noor"; only its starter
or an admin discards it (`can_discard`); the submitted PDF stays the tutors' and the admins' (R17): the guardian gets
the row back, never the answers.

**Words rather than codes, one date formatter, and no Beta** (Phase 78, `docs/journey-fixes-plan.md` JF28, JF29, JF32,
JF34, JF35; owner 2026-11-05). The glossary above is shared (`words.ts`), and so are the quick actions' words
(`QUICK_ACTION_LABELS`, `quickActionLabel`: "Add my child" in a personal space). Dates go through ONE formatter,
`packages/shared/src/dates.ts`, in en-US: `formatDay(day, today, { weekday, relative, year })` reads a CALENDAR day as
the day it names wherever the reader is (composed from its digits, exactly as a Date at UTC noon prints it: "Nov 5",
"Tue, Nov 5", "Nov 5, 2025" in another year, "Today"/"Tomorrow"/"Yesterday"); `formatInstant(iso, timeZone, { time,
today, ... })` reads an INSTANT on the space's clock through `zonedClockParts` ("Nov 5, 4:05 PM", "Today, 4:05 PM");
`formatInstantTime`, `instantDay`, `todayIn`, `formatDaySpan` ("from Sep 1 to Dec 20" / "from Sep 1, ongoing") and
`readableDates` (a server sentence's ISO days made readable) sit beside them. `dayInWords`, `lessonWhen`,
`lessonDayWords` and `formatMonthShort` route through its tables and print what they did; `formatRelativeTime` stays in
`audit.ts`, given one `now` per screen so two lines agree. Checked questions are served like any other: the clients
show no Beta pill, rules line, menu badge or "In beta."; the API keeps its `beta` fields for older apps; the
assessment PDF is titled "Assessment", and the reviewer keeps its per-question "Not yet reviewed" mark and count. A
tile and a favorite are named in words, never by code (codes stay in the console and for support); the guest board and
the member board both wear the grade hues (`levelGrade`), amber is for action and for warnings, always with a word.

**The tour is Tutoring's, and a new space is asked what it may use first** (owner, 2026-11-04). The welcome
wizard's tour, its first-visit offer and "Getting started" appear only where Tutoring is on (`tourOffered` in
shared `onboarding.ts`); a just-started space's "Invite people" step is not the tour and still opens. The
console's space form asks Name, Short name, then the sets ("This space may use", Quest alone ticked for a new
space), and shows the clock ("Lessons are recorded on"), "Who families pay" and email notifications only while
Tutoring is ticked. An API create with no sets keeps its old defaults (older clients). On the member home, Next up
never offers a set the space has off, and a section with nothing to show says so in one line.

**Sign-in is switched per client at runtime, and Google cannot be switched off** (Phase 62 P0,
`docs/stickiness-plan.md`). The app sends `X-Client: app` (`CLIENT_HEADER`) on every request; anything
else is the web. Platform admins set, for the web portal and the app separately, which providers besides
Google and whether sign-up is open, for 1-24 hours or until changed (console Settings; `PUT
/api/platform/sign-in`, `platform_settings` key `sign_in`, logged `platform.sign_in_updated`). While a
setting is in force it replaces the Worker's vars (`AUTH_PROVIDERS`, `AUTH_PROVIDERS_APP` -- the app's own
default list -- and `SIGNUP_OPEN`); when it lapses they apply again (`effectiveSignIn` in shared,
`signInFor` in `lib/sign-in.ts` -- never read the vars directly). A provider is still offered only while
it is set up on that Worker. The redirect flows are the web's; a sign-up token carries its client, whose
switch decides `POST /api/auth/signup`. The header picks buttons, not rights: providers verify every
identity. The setting is memoised per isolate for 15 s, so `/api/auth/config` costs almost no reads.

**The dashboard and the sessions page are two tabs: Tutoring and Finance.**
`TutoringFinanceTabs` in `components/layout/tutoring-finance-tabs.tsx` holds both halves and
keeps the choice in `?tab=`, so a link to the finance view opens the finance view — a money
card links to `/sessions?tab=finance`. Money belongs on Finance, teaching on Tutoring — put a
new panel where its subject lives rather than at the bottom of whichever renders first.
Tutoring is the default and carries **no money at all**, including in the dialogs it opens
(`SessionFormDialog`'s `showMoney`): a tutor keeps the sessions page open during a lesson,
with the student looking at the same screen. The toast when a live timer stops gives the
length, not the pay, for the same reason.

**The admin and tutor Tutoring tabs are four sections, most important first**
(`DashboardSection` in `features/dashboard/stat-card.tsx`): Analytics (compact `StatCard`s
with no hint lines, so the row stays one height), Tutoring Sessions (`SessionsCarousel`: the
last 5 lessons, "now", then the next ones), Progress (`ProgressSpotlight`: 5 random students
with the compact `ProgressChart`), and Recent Activity (5 events, payment lines left out). The
tutor's has a fifth, Student Reflections (Phase 25), between Tutoring Sessions and Progress.
Upcoming lessons are never stored: `expandUpcoming` in `packages/shared/src/schedules.ts`
dates them from the schedules on the institute clock, skipping any already recorded, and
`GET /api/schedules/upcoming` serves them five at a time. A tutor's carousel passes their own
`tutor_user_id`, so a tutor who also parents does not see their child's lessons in it. A
cancelled date stays in the list, flagged (`cancellation`), and counts toward the page; the
highlighted "next" card is the first one that is not cancelled.

**Phase 43 changes the tutor's Home, the app first** (`docs/tutor-home-plan.md`, owner 2026-10-20): in the
app, Analytics and Recent Activity leave every Home (Analytics moves to More → Dashboard), and a tutor's
-- or an admin who tutors' -- Home leads with a "Now" card (a lesson just finished and unrecorded, with
Record it now prefilled from the schedule; else the next lesson, in words) and that lesson's brief, all
from `GET /api/home/tutor` (their own pairings only, no money, R19). The web dashboard keeps the four
sections above until its half follows.

**Dashboard cards are deliberately tight.** The vendored `Card` carries `py-6` of its own, so
`StatCard` and `Panel` pass `py-0` and supply their own padding — dropping that is how a card
silently grows by 48px. Stat grids use `items-start`: a grid row sizes every card to the
tallest, so one card with a hint line lifts empty space into all the others.

**A space's TIN is the space's own -- its `businesses` row -- and is not an SSN** (Phase 54, Phase 59).
With its payer address and the name on its 1099s, edited by the space's admins on the Space page
(`/organization`, `routes/organization.ts`, written to the business) and by platform admins in the
space's dialog in the console (`PATCH /api/platform/organizations/:id`, `payer_name`/`tin`/`payer_*`),
and prefilled into the 1099's payer box. It runs through `optionalText`, so the SSN guard applies — a
sole proprietor filing under their own number is exactly the case that must still be refused. The six
payer columns left on `organizations` are no longer read.

**Families pay the space, or each tutor directly** (Phase 54, `docs/tutor-spaces-plan.md`, R24; Phase 59,
`docs/spaces-plan.md`, S2). On screen a space has a payment model, "Who families pay": **The space** (it
collects payments, pays its tutors and files their 1099s) or **Each tutor, directly**. Underneath,
"the space" is a `businesses` row -- ONE PER SPACE, keyed by the space's id, never shared (409
`shared_payer`) -- linked by `organizations.business_id`; platform admins choose the model with
`PUT /api/platform/organizations/:id/payment-model { model }` (logged `organization.business_set` /
`business_cleared` in the space; the row is made if missing, restored if archived, and kept on a switch
back). The console has no Organizations tab; Phase 54's `/api/platform/businesses` routes and
`PUT .../business` stay for app builds already on phones, answer as before, and are no longer called.
With a payer, everything is as before. With none (`paidDirectly(org)`), families pay each lesson's tutor:
a lesson is recorded with ONE price -- the pairing's rate on both columns (`resolveSessionRates`; the
student's price is not read) -- and `sessions.paid_directly = 1`; a family's payment names the tutor it
went to (`payments.payee_user_id`), a tutor records the payments made to them (admins any, a family
none), and there are no `to_tutor` payments, advances, top-ups, margins or 1099s (409 `paid_directly`);
the tutor's year-end summary is `GET /payments/direct-summary.csv`. Both flags are frozen when written,
so a switch applies going forward -- never restate a recorded row. Balances keep a third ledger per
family and tutor (`BalancesResponse.direct`), out of the space's two. Triggers keep a direct lesson one
price and refuse a payment that does not fit the space's model at insert. Newcomer spaces have no payer.

**A tutor's mailing address is for their 1099, and only they and the office see it.** Five
columns on `tutor_profiles` (`address_line1` … `postal_code`), formatted by
`formatMailingAddress` in `packages/shared/src/profiles.ts`. It prefills the recipient box in
the 1099 dialog and fills the year-end CSV; `scopePersonalDetails` blanks it for every other
reader. `area` is still the neighbourhood, and is not the address.

**No Social Security number is ever stored, anywhere.** `tutor_profiles.ssn_received_on` is a
DATE recording that the office holds one — never the number. The one place a number is typed is the 1099 dialog, and it is
written into a printable window in the BROWSER — never sent to the server, so there is no
request body, no log line and no row that could carry it. Keep it that way: the moment the
document is generated server-side, the number is in a Worker log. `containsSsn` in
`packages/shared/src/tax.ts` rejects SSN-shaped text from every free-text field, which is why
the guard sits inside `optionalText` rather than on individual fields: a new note or comment
field inherits it. Never add a column, form field or API parameter that could carry the number,
and never widen the pattern so far that phone numbers and reference codes trip it.

**Tutors are paid in advance, and only the threshold is stored.**
`tutor_profiles.topup_amount_cents` is the level a tutor's advance is kept above; what they
actually hold is `paid - earned` and the shortfall is `topup - held`, both derived by
`tutorAdvanceCents` / `topupDueCents` in `packages/shared/src/payments.ts`. NULL means the
tutor is paid for work already done and no top-up is ever due. Only an admin and the tutor
themselves may see the arrangement — `scopeTutorTopup` blanks it for everyone else, and the
institute-wide total is admin-only. The day a tutor's next top-up falls due is projected from
their scheduled lessons on every read (`computeTutorPaymentOutlook`, `projectTopupDate`) and
shown only on the admin's Tutor payments panel, which leads the dashboard's Finance tab — never
store it, for the same reason upcoming lessons are not stored.

**Money is integer cents, never floats.** `formatCents` / `parseCentsInput` in
`packages/shared/src/teaching.ts` are the only conversions. Amounts and durations are always
derived on the server: a client may send times, never a price.

**A lesson has two rates, and conflating them erases the institute's margin.** The tutor is
paid `tutor_rate_cents` (from `tutor_profiles`, overridable per pairing on `assignments`); the
family is charged `charge_rate_cents` (from `student_profiles`, no override). Both are frozen
onto the session. The margin is always derived, never stored. Never make one column serve both
sides -- that is the bug these columns were split to fix. Each party sees only their own side, labelled:
`scopeSessionMoney` sets `money_view` (`admin` / `tutor` / `family` / `none`) per row and blanks
the other side, and the UI renders money only through `SessionMoney`, never a bare
`formatCents`. Pay rates go through `scopeTutorPay` / `scopeAssignmentRates`, prices through
`scopeStudentCharges` -- do not return a session, pairing or profile from a new route without
them, and never put an amount in an audit description (tutors read their own log).

**What a non-admin sees is written down, and crawled.** `docs/data-exposure.md` lists the
rules (R1-R16; R13 is "nothing crosses organizations", crawled by `exposure-organizations.spec.ts`) and who sees what on each screen; `e2e/tests/exposure.spec.ts` signs in as every
kind of non-admin, calls every read endpoint and checks every object returned against them. A
lookup by id goes through the list's own WHERE (`getVisibleSession`, `getVisiblePayment`) --
never "can they see anything related" -- and answers 404, not 403, for a row they cannot list.
A new read route belongs in that spec; a new rule belongs in both files. A role's dashboard shows
that role's data only: narrow it for someone who holds several.

**Every action a user takes gets an audit event.** Adding a route that changes data means
adding a `recordAudit` call and an entry in `AUDIT_ACTIONS` in `packages/shared/src/audit.ts`.
The action name is `<entity>.<verb>`; the description is a finished sentence naming the person,
because it is written once and never reconstructed. Never update or delete `audit_events` rows.

**Every response uses the shared envelope**: `{ data }`, `{ data, meta }` for lists, or
`{ error: { code, message, details? } }`. Throw `ApiError` from a handler rather than building
an error response by hand.

**The portal's identity is each organization's data, chosen at RUNTIME.** `BrandProvider` builds
the brand from the session's organization (`brandFromOrganization`) -- or, before one is chosen
and on the sign-in page, from `/api/auth/config`: the organization the ADDRESS is for
(`DEFAULT_ORGANIZATION`, so `tmi-portal` wears the institute), else `PLATFORM_BRAND`,
"Aimtrue". Never the browser's last organization (`tmi_last_org`): a shared address like `tutoring`
must not show one organization's logo and colours to everybody who once used it; the console always wears the platform's (`usePlatformBrand`).
It sets `<html data-palette>`, the title, the favicon and the theme colour, and `useBrand()`
supplies every name and mark. Palettes are `ORG_PALETTES` (shared) and one `:root[data-palette]`
block each in `index.css`, light and dark. Logos are uploaded PNG/WebP (checked by their bytes --
never SVG, which can carry script), at most 256 KB, served at a versioned public URL with
`nosniff` and `default-src 'none'`; `builtin_logo: 'institute'` (platform admins only) wears the
institute's shipped artwork. Never hardcode an organization's name: say `brand.short`.

**The test Worker behaves like production** (Phase 53, `docs/test-environment-plan.md`). `tutoring-test`
has Google sign-in on and the same sign-in and sign-up as production. Since Phase 65 who may sign up there
is the console's Sign-up access, as in production, and `SIGNIN_ALLOWLIST` is "false"; `invited_users` (the
Phase 53 list, still checked if that var is ever "true") now only keeps the console's `access_list` across
`db:reset:test` (`db/test-keep-list.sql` before, `db/test-only.sql` after). That table exists in `tutoring-test-db` ALONE: it lives in `db/test-only.sql`, never
in `schema.sql` or a production SQL block (`scripts/check-test-only.mjs` fails otherwise), and survives
`db:reset:test`. The list itself is kept in the console, or with `npm run test:invite`. The test Worker's seed
scripts act as seeded people with `X-Automation-Key`, a secret (`TEST_AUTOMATION_KEY`) set on the TEST
Worker only and never honoured in production. The app's `test` variant, "AimTrue-Test"
(`com.aimtrue.app.test`), is the production app pointed at it. Local development and the local suites
keep sign-in off; `tutoring-test-db` is seeded fiction.

**Motion explains a change, and the theme is the only view transition.** The ⌘K command palette
(`command-palette.tsx`) takes its pages from the sidebar's `NAV_ITEMS` and finds people through
`useUsers`, so it never offers what the reader cannot reach. `switchTheme` reveals a new theme with
the View Transitions API; page changes use the CSS `route-enter`, never a view transition, whose
snapshot overlay swallows clicks. Shadows are `--elevation-1`/`--elevation-2`, glass is the `glass`
utility, and all of it is stilled by the reduced-motion guard. See `docs/branding.md`.

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

**Progress is measured on one 1-5 scale against an organization's curricula.** The catalog
(`curricula` > `curriculum_levels` > `curriculum_topics`) is reference data GENERATED from
`apps/api/db/catalog/*.json` by `db/generate-catalog.mjs` into `db/catalog.sql`: upserts of
platform rows, one statement per level, run after `schema.sql` by every build path (`db:rebuild`,
`db:rebuild:test`, `scripts/e2e.sh`). Never hand-edit `catalog.sql`; `npm run typecheck` fails while
it is stale. The generator refuses a dropped id, a changed stage or topic number, a stage outside its
curriculum's thousand (Beast Academy 1-999, `nc-2017` 1001+, `nc-2026` 2001+) and a repeated code --
never delete a topic, ratings reference it (`--unreleased=<id>` waives that for a curriculum never
shipped to production, and only then). Three curricula: Beast Academy (`ba`: `BA1`-`BA5`, `PRE`,
`ALG`, `GEO`; topics `BA3.10`), and North Carolina's standards, `nc-2017` and `nc-2026` (a level is
a grade or course, `NC17.3`, `NC26.M1`; a topic one numbered standard, `NC17.3.OA.1` shown as
`NC.3.OA.1`, its `unit` the domain, its `description` the standard's summary). An organization reads
and writes only the curricula on its own list (`organization_curricula`, exactly one default -- rule
9 in `docs/data-model.md`), and every catalog query joins it (`listCurriculum`,
`findUnknownCurriculumIds`, `repositories/curricula.ts`). Its admins choose it on the Organization
page's Curricula card (`PUT /api/organization/curricula`, one batch; `curriculum.offering_updated`,
never `organization.*`, which the console lists): what is left out is RETIRED, never deleted --
hidden from pickers unless something chosen is in it (`pickerLevels`), still readable, and still
writable, because every edit resends its whole set of ids. Pickers group topics by `unit`, show the
description as a second line, and offer a curriculum switch only when two or more are offered, so
an organization on one sees none. Ids are keys, `code` is
what people read (the API answers `COALESCE(code, id)`): print `code`, take a topic's level from
its row, never the id's text, and sort by catalog position (`indexCurriculum`). The shared id
shape may only ever widen. Progress
figures are derived by `computeProgress` in `packages/shared/src/progress.ts`, never stored.
Assessments and plans are admin-written; a tutor scores a lesson through the session's
optional `progress` field, which lives in `session_progress`, not on the billing row.

**Every model call goes through `runAi`, and every AI feature is a task** (Phase 36,
`docs/ai-platform-plan.md`). `apps/api/src/lib/ai/run.ts` is the one place a provider is called
(`scripts/check-ai-gateway.mjs`, run by `npm run typecheck`, fails on a provider address, the key
or a Workers AI binding anywhere else). A feature registers a task in `AI_TASKS`
(`packages/shared/src/ai.ts`: provider, model, caps, `child_input`) and calls `runAi` with a Zod
schema the reply must match. `runAi` refuses a switched-off task, an exhausted cap, SSN-shaped text
in the prompt or the reply, and -- until parental consent (roadmap F7) exists -- any `child_input`
task; it redacts names, emails and phones; and it writes an `ai_runs` row for every attempt, refused
ones too, holding tokens, cost and outcome, never the prompt or the reply. The provider is `fake`
everywhere but production (no AI_PROVIDER in the production `vars`, on purpose: `wrangler dev`
would inherit it), so no test spends money; `ANTHROPIC_API_KEY` is a secret on the production pair.
Nothing a model writes reaches a family or a student without a person approving it.

**A question reaches a test only by passing every check and a person** (Phase 36). The bank
(`questions`, platform reference data on the NC 2026 standards -- grades 3-8 and Math 1, and since
2026-10-22 every other NC 2026 level too, `docs/question-bank-round-4.md`; since 2026-10-25 NC 2017 as well,
offered only where an organization offers NC 2017, `docs/question-bank-nc-2017.md` -- and since Phase 41 on Beast
Academy's chapters, one chapter a topic, `docs/question-bank-beast-academy.md`; since 2026-10-27 Math Kangaroo,
one level per pair of grades, built a level at a time, `docs/question-bank-kangaroo.md`) is written
by Claude Sonnet, checked by code (`lintQuestion` in shared: the form, four distinct choices with
exactly one matching the key, the `compute` expression evaluated EXACTLY -- `evaluateExact`, big
integer fractions, never floats -- equal to the key, no near-copy), then solved blind by Claude Opus
with the choices shuffled and no key (`checkAnswer` must match). Only `checked` may be approved, by
a platform admin; any edit clears the blind solve and the approval. The one exception is an organization's
own trial (Phase 38): while its `canvas_assessments_unreviewed` is on (its admins' switch, off by
default), its Assessments may also draw `checked` questions, and the tutor's PDF marks each one "not yet
reviewed". `draft`, `flagged` and `retired` never reach a student. Questions are retired, never
deleted. Never loosen a check to get a question through: fix the question. Production's console is
the bank's source; `db/questions.sql` (local and demo only) is generated from the exported JSON and
never hand-edited. Its first writing (2026-10-17) was done by Claude Code agents running the same
pipeline outside the Worker, and reached production as `checked` (`generate-questions.mjs
--production`), never approved: approving is a person's act. **Reviewing must not re-read the bank:**
its coverage and lists scan every question in D1, so an approval writes into the loaded caches and
the queue pages by `questions_status_idx` -- refetching after each approval would spend the
account's daily reads in one session (`docs/ai-platform-plan.md`, "Reads").

**An Assessment (Phase 38; out of beta since Phase 78) is written by hand, and its PDF is the tutor's.** While an
organization's `canvas_assessments` is on (its admins' switch; on in a space made since Phase 61), the Assessment menu
lets anyone who may follow a student's progress start one for them: up to 10 approved bank questions
of a level (an NC grade, or -- where the organization offers Beast Academy -- a Beast Academy or AoPS
level, Phase 41), one page each, answered on a canvas with nothing marked (`docs/canvas-assessment-plan.md`); a
multiple-choice question is answered by choosing, with the canvas for working, and code marks the choice
for the tutor (`checkAnswer`), never a model. Web and app alike; the PDF is shown in the portal and in the
app (pdf.js), never handed over as a download.
The work stays in the browser until it is submitted; the Worker then writes the PDF itself
(`lib/pdf.ts`, standard fonts and vector strokes, no library -- the free plan's 10 ms of CPU) and stores
it with the strokes in `canvas_assessment_files`, D1 for now, R2 later. Handwriting travels as strings
(`parseStroke`), never as arrays Zod would have to walk. The PDF carries the answers, so only the
student's current tutors and the admins open it (R17); everyone else in the student's audience sees
the row. **Reviewing (Phase 40) keeps the submitted PDF untouched:** the tutor's red ink (in the PDF page's own
points), notes and comment are a `canvas_assessment_reviews` row, and "Save as reviewed" rebuilds a
reviewed PDF from the stored strokes and the review -- same page layout, the note where the answer key
was -- which the student's whole audience then reads. No scoring yet. An organization's admins set how
many questions an assessment draws (`canvas_assessment_questions`, 1-25). Phase 39's AI evaluation
(delayed) needs consent first: it reads a child's handwriting.

**Question Quest (Phase 42) is gamification on the question bank, and its approvals are real.** While
an organization's `gamify_question_quest` is on (its admins' switch; on in a space made since Phase 61), a signed-in student
answers the bank's `checked` questions one at a time from their level (`student_profiles.quest_level_id`,
set by their tutor or an admin), with no going back; code marks each answer (`checkAnswer`); their
current tutor (or an admin) reviews it, and "Question is right" approves the question **for every
organization** (`approved_via = 'quest'`, owner, 2026-10-20) while a flag sends it, with its reason, to
the console. **Two right answers approve it too** (owner, 2026-10-24): once `QUEST_CONSENSUS_CORRECT` (2)
different people have answered a checked question correctly, marked by code, it is approved by itself
(`approved_via = 'quest_consensus'`, `recordQuestAnswer`); so a question waits with up to two students of
an organization at once, and a tutor's flag still takes such an approval back. A level used up moves the student to the next of its family by itself (`nextQuestLevel`).
A student's points are separate for the attempt and for correctness; a tutor earns one per review,
whatever its outcome, so approving never pays more than flagging (`QUEST_POINTS`): `points_ledger` is
append-only (a trigger refuses updates) and a balance is a sum, read from `activity_days`, the per-day
rollup written in the same batch -- never store a balance. Answers are `quest_attempts` rows, never
audit lines; reviews and level changes are logged. The next question is one seek on
`questions_quest_idx` from the student's last answer: keep it so, the bank is 40,000 rows and D1's
reads are metered. Quest runs full screen outside the portal's frame (`/quest/play`, `/quest/review`)
and lands a student or tutor there once per tab after sign-in (`QuestLanding`; the e2e fixture marks
every tab landed unless `questLanding: true`). Plan and later phases: `docs/gamification-plan.md`.

**Quest Games (Phase 46) run in a Durable Object, one per game; D1 is only the record.** Under Quest's
switch, any member starts a game (a bank level, a count or a time limit, negative marking, a team size)
and anyone joins with its code -- on their own, by starting a team (its own code), or by a team's code;
codes are found only in their own organization (`docs/quest-games-plan.md`), and a code from anywhere else gets
the same honest 404 as no game at all, "ask your friend to invite you there" (Phase 72, R13). `QuestGame`
(`durable/quest-game.ts`, bound `QUEST_GAMES` on all three Workers, SQLite-backed as the free plan
requires) is named `<organization>:<game id>`, so another organization's id reaches an empty object
(404). It holds the series WITH its keys, each team's queue and every player's hand in memory and in its
own storage, and its one-request-at-a-time rule is what makes "the next question no teammate has been
served" exact: keep serving and answering free of D1 (the series is drawn once, at the start: approved
questions, plus `checked` while `canvas_assessments_unreviewed` is on). The rules are pure, in shared
(`serveNext`, `answerQuestion`, `rankTeams`); every team plays the same series; the highest score wins.
D1 (`quest_games`, `quest_game_teams`, `quest_game_players`) is written on create, join, start and end
-- the end in two statements (one JSON UPDATE for every team), well inside the free plan's per-request
query limit. A route checks the person and passes the call by RPC; the object answers `GameReply`, never
throws an `ApiError`. Keys reach a client only on the results, after the game, for the reader's own team
(R20); names are first names; a game awards no Quest points; answers are never audit lines.

**Phase 47 adds the start wizard, and a game begins with a countdown** (`docs/quest-games-g2-plan.md`). The
wizard ("New Quest") has four steps since 2026-10-23: Select level (compact tiles, a level's name alone, or
Random: a level and those above it in its family, `gameLevelIds`), Score Setup (the game limit, then the
points for right and wrong plus Knockout), single player or multiplayer (the most teams, team size,
joining open once it runs), and the review with a named favorite (`quest_game_favorites`, the person's
own). Joining a game of teams is a tab bar, Join a team or New team, with one action, "Join the game"; the
host only starts a team, and a new team is named "Team <first name>" (`defaultTeamName`). The host's start sets `started_at` `GAME_COUNTDOWN_MS`
ahead. Nothing is served or answered before it, and every screen counts to it by the server's `now`. A
knockout game ends when one team's lowest possible score is above every other team's highest
(`knockoutDecided`). `end_reason` records why a game ended. A single player's game is made and begun
in one request. A create request without the new fields (an older app) means a Phase 46 game.

**Phase 48 curates a game's series against what its players have seen** (`docs/quest-games-g3-plan.md`).
`quest_game_seen` keeps one row per person and question in an organization. It is written once, when a game
ends, in the results' batch: what each team answered, skipped or held, for each of its players. It is never
written during play, which stays free of D1. The draw at the host's start takes, in order:
1. the game's own levels' questions that none of its players has seen;
2. then the same from each level above in the family (`gameClimbLevelIds`, kept on the game as
   `climb_level_ids`);
3. only then seen ones, the least recently seen first.

A count game's size is checked against the level and the levels it can climb into. No route reads the table.

**Sharing Quest is a public link to a card the server built** (Phase 56, `docs/sharing-plan.md`, R22).
`POST /api/shares` (behind Quest's set) makes a `shares` row from the maker's own result -- a finished
game's team (`game_result`), a level they moved on from (`level_finished`), or a question their team
got right that is approved (`challenge`) -- never from anything a client describes. `/s/<id>` is the
one page outside `/api` the Worker answers (`run_worker_first`): the SPA with `og:` tags written in by
HTMLRewriter (`lib/share-page.ts`) and a static picture per kind (`apps/web/public/og/`, regenerated
by `apps/web/og/make-og.mjs`). The public reads are `/api/public/shares/:id` (one primary-key read,
a minute at the edge) and `/api/public/challenge/:id/answer` (rate-limited, Turnstile in production --
no `TURNSTILE_SECRET` there refuses rather than opens). A card names nobody but an adult maker's
chosen first name; a child a space added cannot share; no points, no leaderboard; withdrawn, never
deleted; a year's life. Views go to Analytics Engine (`SHARE_VIEWS`, optional), never D1. The web
draws the posted picture on a canvas (`features/sharing/card-image.ts`); the app uses the share sheet.

**A live lesson has a maximum length, and the API enforces it.**
`tutor_profiles.max_session_minutes` and `student_profiles.max_session_minutes` each hold the
longest lesson that person does; the SHORTER of the two applies, and `DEFAULT_MAX_SESSION_MINUTES`
covers a pairing where neither is set (`effectiveMaxSessionMinutes`). A running lesson that
reaches its limit is recorded at it and flagged `auto_stopped`, by `autoStopExpired` — from the
cron trigger in `wrangler.jsonc` and from every read of the live sessions. The cap applies to a
late manual stop too, so it cannot be sidestepped. It deliberately does NOT apply to a session
typed in afterwards or to an edit: a person vouching for what happened outranks the cap, and
correcting the times is how a wrongly cut session gets fixed (which clears the flag).

**An instant becomes a clock time only through `zonedClockParts`, on the organization's clock.**
The Worker runs in UTC and a browser runs wherever its owner is, so reading UTC parts off a live
session shifted every lesson by the offset. Each organization records against its own
`organizations.time_zone` (`ORG_TIME_ZONES`): the API passes `c.get('org').time_zone` (the cron,
each row's own), the web app `useOrgTimeZone()`. `INSTITUTE_TIME_ZONE` is only the default.

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

The suites run locally (`npm run e2e:test` against `npm run dev`; `npm run smoke`): since Phase 53
the test Worker has sign-in on and is not a test target, and `npm run e2e` (the old remote suite) only
says so. **Nothing touches production.**

The suite acts as different people with an `X-Dev-User` header, honoured only while
`AUTH_ENABLED` is `"false"`. Set it on the browser context, never per request — two values
make the header ambiguous.

## Verifying a change

Verify by running things:

1. `npm run typecheck` — must be clean.
2. For API work: `npm run dev:api`, then curl the endpoint, including the failure paths
   (validation, duplicate email, missing id). A new data route must return 401 without a
   session cookie — check that explicitly.
3. For UI work: `npm run dev` and load http://localhost:5173. To skip signing in, set
   `AUTH_ENABLED` is already `"false"`; set `DEV_USER_EMAIL` to a non-admin from the seed to
   check authorization paths, and flip `AUTH_ENABLED` to `"true"` to test sign-in.
4. After a schema change, run the audit query in `docs/data-model.md` ("students missing a
   parent") — it catches invariant breaks the database cannot.
5. After any change to the Worker's API, the shared contract or the schema: `npm run smoke`,
   green on the web app and on the mobile app (iOS and Android). See "The Worker has two
   clients" under Rules.

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

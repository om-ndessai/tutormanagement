# Open sign-up: seeding, feature sets, groundwork and spaces (Phases 49-52)

Written 2026-10-24 from the owner's brief, which turned stages O0 and O1 of
[`roadmap/open-to-public.md`](roadmap/open-to-public.md) into phases, with these changes:

- **No Workers Paid yet.** The portal is not advertised, so traffic will stay small. The free plan's
  limits stay, and the caps below keep strangers' use small.
- **Three feature sets.** The product is split into **Tutoring**, **Assessment** and **Quest**.
- **Spaces.** An organization is called a **space** from now on. After signing in, a newcomer is
  asked for a **space code** to join. Without one, they name a new space. The name need not be
  unique; a unique space code is made for it, and that code is how people join it later.
- **Assessment only.** A space made this way is allowed the **Assessment** feature set and nothing
  else, for now.
- **Seeding.** The seed is out of the free plan's limits. It should lean towards the newer features,
  and come with a backward-compatibility test.

**Order.** The phases are built and released in order. Each ships on the web and the app together
(feature parity), and each is its own release under the rules in `CLAUDE.md`. Phase 49 comes first
because the other three change the schema, and its compatibility test is what checks each of their
hand-applied production changes before it is applied.

**Naming in the code.** "Space" is the word on screen. In the code, the API, the database and the
docs it stays `organization` (`organizations`, `X-Organization`, `requireOrg`, `/api/organization`),
as the Aimtrue rename left the Workers and packages alone. Renaming the code would touch every query
and every test for no change in behaviour.

---

## Phase 49: seeding for the newer features, and a backward-compatibility test

### Why

- **The demo cannot be reseeded within a day.** `db/questions.sql` loads 30,298 questions. With the
  primary key and the table's three indexes (`questions_topic_idx`, `questions_status_idx`,
  `questions_quest_idx`), that is about 150,000 rows written. The free plan allows 100,000 a day, so
  `npm run db:reset:test` cannot finish on the demo in one day. It is also 27 MB, which is most of the
  time `npm run db:reset` takes locally.
- **The seed is from before the newer features.** `db/seed.sql` was generated on 2026-10-18,
  before Quest (42), Quest Games (46-48), the review of Assessments (40) and the feature sets and
  spaces to come. On a fresh database those screens are empty: a demo shows nothing, and every test
  builds its own data.
- **Production is never rebuilt, and nothing tests the hand-applied changes.** Each release applies
  an additive SQL block by hand (`docs/database.md`). Nothing checks that:
  - the old schema plus that block equals today's `schema.sql`;
  - the new Worker runs on rows written before the change;
  - the old Worker keeps working in the minutes between the SQL and the deploy;
  - the phones' older app builds keep working against the new API.

  Phase 35's rehearsal did this once, by hand.

### 1. A sample of the bank instead of all of it

- **The sample.** `generate-questions.mjs --sample` writes `db/questions-sample.sql`: up to 8
  questions per topic (306 topics), spread over difficulties 1-3. It keeps both `approved` and
  `checked` questions, so Quest, unreviewed assessments and games all have something to draw, and
  makes sure every level holds at least 50. That is about 2,400 questions and 12,000 rows written,
  under a tenth of the full bank. It is deterministic (sorted by id), so the diff is reviewable.
- **Which builds use it.**
  - `npm run db:reset` and `db:reset:test` load the sample.
  - `npm run db:reset:full` loads the whole bank, for anyone checking the bank itself.
  - The question-bank tests keep working on the sample, or say what they need.
- **The sample covers the tests.** The suite's needs are listed in the generator, so a test that
  needs more questions fails the generator, not a run. For example: the 25-question maximum of an
  assessment, a count game that climbs levels, and Phase 48's curated series running out of unseen
  questions.

### 2. A write budget the demo can afford

`scripts/seed-budget.mjs` estimates the rows a reset writes: each INSERT's rows times one plus the
table's indexes, read from `schema.sql`.

- **The demo.** `db:reset:test` runs it first and refuses above **40,000** (under half the demo's
  daily 100,000).
- **Locally.** `db:reset` prints the figure.
- **The checks.** `npm run typecheck` fails while `seed.sql` or `questions-sample.sql` is stale, as
  it does for `catalog.sql`.

### 3. A seed that shows the newer features

The generated people stay exactly as they are: the named cast and the bulk families, every id and
relationship. The suite asserts on them. What changes is what is built on top of them.

**Structure stays in SQL.** `generate-seed.mjs` adds, deterministically:

- **Quest.** Starting levels for the cast's students, a few weeks of attempts, the points ledger
  and the `activity_days` that goes with it, and a review queue with some answers waiting. All of it
  follows Phase 42's rules (append-only ledger, balance = sum).
- **Quest Games.** Finished games with teams, players, results and `quest_game_seen`, so the games
  list, the results and Phase 48's curation have history.
- **The switches.** Assessment and Quest on in the institute's seeded organization, and off in the
  second organization, so both states are always present.
- **Later phases' rows.** Phases 50-52 extend the seed with feature sets, self-serve spaces, codes,
  join requests and a newcomer. Each phase's section below says what.

**Assessments go through the API.** `scripts/seed-scenarios.mjs` runs after the SQL seed against a
running Worker, with sign-in off. It acts as the cast (`X-Dev-User`) and makes, through the real
routes:

- Assessments in progress, submitted (with their PDFs), reviewed (the reviewed PDF) and reopened.
- One Quest Game played live through its Durable Object.

The Worker builds every PDF itself, so the seed cannot drift from `lib/pdf.ts`.

**Where each step runs.**

| Command | What it does now |
| --- | --- |
| `npm run db:reset` | Schema, catalog, seed, platform admin, the bank sample |
| `npm run seed:scenarios` | The API scenarios, against the running local Worker |
| `npm run db:reset:test` | The same on the demo, then the scenarios against the demo, refused above the write budget |

**Time.** The suite's fixtures run the scenarios once after the reset, so a fresh local run has them.
Seeded dates are relative to the day of the reset (as the lessons are today), so the demo always
looks current.

### 4. The backward-compatibility test

`npm run test:compat [base]` runs locally only, like every test here. `base` is the last release:
a new `release-YYYYMMDD` git tag, which every release from now on sets. The first tag is placed on
the commit production runs today, which the owner confirms.

1. **The old database.** A separate local D1 (`--persist-to .wrangler/compat`) is built from
   `base`'s own `schema.sql`, `catalog.sql`, seed and bank sample, all read with `git show`, never
   from today's files.
2. **The pending changes.** The SQL blocks in `docs/database.md` that `base`'s copy does not have
   are applied in order. Each block's fence gets a label so the test can find it
   (` ```sql release=phase-50 `). The docs stay the only record of production changes: there is
   still no migrations folder.
3. **Same schema both ways.** The migrated database is compared with a fresh one built from today's
   `schema.sql`:
   - tables and their columns (name, type, not-null, default), compared as sets, because
     `ADD COLUMN` appends;
   - indexes (columns, unique, partial `WHERE`);
   - triggers (name and normalised SQL).

   Any difference fails the test, unless it is listed with its reason in `scripts/compat-known.json`
   (for example, a CHECK that `ADD COLUMN` cannot carry).
4. **The new Worker on old rows.** Today's Worker runs on the migrated database (`wrangler dev
   --persist-to .wrangler/compat`, port 8788). Then two sets of tests run:
   - the web `@smoke` tests;
   - the new `@compat` tests, which check that rows written before the change still behave. For
     example, an organization made before feature sets has all three allowed (Phase 50), an
     invitation made before `invited_name` reads correctly (Phase 51), and an organization made
     before space codes has no code and joining off (Phase 52).
5. **The old Worker on the new schema.** `base`'s Worker, checked out in a git worktree under
   `.claude/worktrees/compat`, runs on the migrated database, and `base`'s own `@smoke` tests run
   against it. This is the window between applying the SQL and `npm run deploy`, and the reason every
   change must be additive. For example, a new NOT NULL column without a default would break the old
   Worker's INSERTs here.
6. **Old clients.** Requests shaped like the previous release's clients: the web tests in step 5,
   plus `e2e/tests/compat-clients.spec.ts`, which sends the shapes older app builds send. An example
   is Phase 47's "a create request without the new fields means a Phase 46 game"; Phase 52's sign-in
   answer is another (below).

**Where it fits in a release.** `test:compat` joins step 1 of every release that changes the
schema or the API: the local suite, the mobile smoke when the API changed, and now `test:compat`
against the last release tag. `docs/testing.md` and `CLAUDE.md` gain the command.

### Phase 49 tests

- The generators' own checks: the budget, staleness, every level ≥ 50, and the sample covering the
  suite's needs.
- The full local suite and `npm run smoke` (web and both mobile platforms) green on the sample bank.
- `test:compat` against the first release tag, with no pending blocks (the base is today): it must
  pass trivially, which proves the harness. Then a rehearsal against a tag two phases back (Phase 46),
  replaying 47 and 48's blocks.

### Phase 49 production

None. No schema change, no Worker change. The demo is reseeded within its budget, which is the point.

---

## Phase 50: feature sets (Tutoring, Assessment and Quest)

### What a feature set is

A space (organization) is **allowed** some of three feature sets. Platform admins decide which.

| Set | What it holds | Its own switch today (the space's admins) |
| --- | --- | --- |
| **Tutoring** | Pairings, sessions (recorded, live, drafts, write-ups, reflections), schedules and cancellations, locations, payments, balances, tutor advances and 1099s, progress (Phase 16's assessments, plans and lesson scores), comments, the tutor's Home, the dashboard's Tutoring and Finance tabs, the tutor role and its profile (rates, advance, address, payment handles) | None: allowed means on |
| **Assessment** | The Assessment menu (Phases 38-41): the canvas, the PDFs and the review | `canvas_assessments`, and its trial and question count |
| **Quest** | Question Quest (42) and Quest Games (46-48) | `gamify_question_quest` |

**Always present, whatever is allowed:** People, Activity, My profile, the Organization (Space)
page, curricula (Assessment needs its levels), the welcome wizard, the command palette and sign-in.

**Effective rule:** a set is on when it is allowed, and, for Assessment and Quest, also switched on
by the space's admins. A switch the space may not use is hidden.

### Data

```sql
-- Phase 50: which feature sets a space is ALLOWED, decided by platform admins.
-- Defaults of 1 keep every existing organization exactly as it is.
ALTER TABLE organizations ADD COLUMN feature_tutoring   INTEGER NOT NULL DEFAULT 1 CHECK (feature_tutoring IN (0, 1));
ALTER TABLE organizations ADD COLUMN feature_assessment INTEGER NOT NULL DEFAULT 1 CHECK (feature_assessment IN (0, 1));
ALTER TABLE organizations ADD COLUMN feature_quest      INTEGER NOT NULL DEFAULT 1 CHECK (feature_quest IN (0, 1));
```

- **`schema.sql`** gains the same three columns.
- **Disallowing keeps the data.** Disallowing a set hides it and refuses its routes; nothing is
  deleted, and allowing it again brings it back as it was.

### Shared contract

`packages/shared/src/features.ts` holds:

- `FEATURE_SETS = ['tutoring', 'assessment', 'quest']`;
- `featureAllowed(org, set)` and `featureOn(org, set)`;
- the menu items each set owns;
- `TUTORING_ROLES`: the tutor role exists only where Tutoring is allowed.

The organization type carries the three `feature_*` booleans. Both clients read only these helpers,
never the columns directly.

### API

- **`requireFeature(set)`.** New middleware, mounted per route group in `index.ts` after
  `requireOrg`:
  - Tutoring: `/assignments`, `/sessions`, `/schedules`, `/locations`, `/payments`, `/progress`,
    `/comments`, `/home`.
  - Assessment: `/canvas-assessments`.
  - Quest: `/quest` (games included).

  Off answers **403 `feature_unavailable`**, as the Assessment and Quest switches answer today.
  Their two hand-written checks move into it.
- **`/dashboard`** stays mounted: it builds only the sections whose sets are on. Its Tutoring and
  Finance halves are both Tutoring.
- **`/users`** refuses the tutor role (400 `feature_unavailable`) and the tutor sections where
  Tutoring is not allowed. Existing tutors in such a space keep their rows, hidden.
- **`/organization`** refuses a switch for a set the space is not allowed.
- **The console** (`routes/platform.ts`) gains `PUT /platform/organizations/:id/features`, logged
  `organization.features_updated` in that organization's log. The console's create form gets the
  three tick boxes, all ticked by default as today.
- **No new read of people or data.** The console still never reads inside an organization (R14).

### Web and app

- **The menu.**
  - Web: `NAV_ITEMS` takes a `set` per item, in place of the current two `feature` values.
  - App: `nav-items.ts` does the same.
  - The command palette follows the menu, as it does now.
- **Home and dashboard.**
  - A space with Tutoring keeps today's dashboard (web) and Home (app).
  - A space without it gets an **Assessment home**: its students, each with "Start an assessment"
    and their latest assessment's status; assessments waiting for review; and recent assessments.
    It is built from the existing assessment reads, with one new list route only if they do not
    cover it.
- **The welcome wizard and tour** skip the steps of sets that are off: adding a tutor, pairing and
  scheduling are Tutoring's. Its `data-tour` targets stay.
- **Forms.**
  - The user form hides the tutor role and its sections where Tutoring is not allowed.
  - The Organization page shows only allowed switches.
  - The console shows the three sets on each organization (web and app).

### Exposure and audit

- **R23 (new).** A feature set a space is not allowed is invisible to every reader there, admins
  included: no menu item, no dashboard section, and 403 `feature_unavailable` on its routes. Data
  kept while it is disallowed reaches nobody until it is allowed again. Crawled by
  `exposure-features.spec.ts`: an organization with each set disallowed in turn, every route of
  that set read as every role.
- **Audit.** `organization.features_updated` gets a description naming the sets, such as "Allowed
  Assessment; disallowed Tutoring and Quest".

### Seed

The second seeded organization is allowed Tutoring and Assessment, not Quest. One more small
organization is allowed Assessment alone: the shape every Phase 52 space will have.

### Phase 50 tests

- `features.spec.ts`: each set allowed and disallowed, menu and routes, as admin and non-admin.
  Also the console's toggles, and that a switch for a disallowed set is refused.
- The Maestro flows `features/`: the app's menu and Home for an Assessment-only space, on iOS and
  Android.
- `@compat`: an organization from before the phase has all three sets.
- The full suite, the mobile smoke, and `test:compat`.

### Phase 50 production

The three `ALTER TABLE` statements above. They are safe for the old Worker, which never reads
those columns.

---

## Phase 51: groundwork for open sign-in

Every fix here closes something that is safe today only because the platform creates every
organization itself. They ship before the door opens.

### 1. A first sign-in no longer joins self-serve spaces

- **Today.** `recordSignIn` makes a first-time person active in every organization that invited
  them.
- **The change.** That now applies only where `organizations.created_via = 'console'`. An invitation
  from a self-serve space is always answered on the picker, as an existing person's is today.

```sql
ALTER TABLE organizations ADD COLUMN created_via TEXT NOT NULL DEFAULT 'console'
  CHECK (created_via IN ('console', 'self_serve'));
```

### 2. An invitation no longer reveals who owns an address (every space)

- **Today.** Adding an email that already has an account answers with that person's stored name and
  phone (`createUser` returns `getUserById`). It also locks their shared fields in their other
  organizations.
- **The change, everywhere** (the institute included; the 2026-10-23 analysis's decision 10):
  - **The name.** While a membership is `invited`, every read of that person IN THAT SPACE shows the
    name the space typed (`org_members.invited_name`), the email the space typed, and no phone.
  - **On accepting**, the space sees their own record.
  - **The lock.** `shared_fields_locked` counts only `active` memberships, so an invitation never
    locks anybody's details.
  - **The reply.** `POST /api/users` answers the same for a new and an existing address, down to the
    fields.
  - **Caps.** At most 20 invitations per space per day: 429 `invitations_capped`, a count on an
    indexed `org_members.created_at`.

```sql
ALTER TABLE org_members ADD COLUMN invited_name TEXT;
```

### 3. Quest approvals from untrusted spaces become suggestions

- **The flag.** `organizations.quest_trusted` is set by platform admins. Every existing
  organization is trusted. A self-serve space starts untrusted; a trigger refuses inserting one as
  trusted, but a platform admin may trust it later.
- **In an untrusted space,** "Question is right" leaves the question `checked` and writes a
  `question_suggestions` row.
- **The console's review queue** shows suggested approvals first, with how many spaces suggested
  each one, for a platform admin to approve. Flags already go to the console and are unchanged.
- **Quest's points are unchanged.** A tutor earns one point per review, whatever the outcome.

```sql
ALTER TABLE organizations ADD COLUMN quest_trusted INTEGER NOT NULL DEFAULT 1
  CHECK (quest_trusted IN (0, 1));

CREATE TRIGGER organizations_self_serve_untrusted
BEFORE INSERT ON organizations
WHEN NEW.created_via = 'self_serve' AND NEW.quest_trusted = 1
BEGIN
  SELECT RAISE(ABORT, 'self_serve_untrusted');
END;

CREATE TABLE question_suggestions (
  question_id      TEXT NOT NULL REFERENCES questions (id),
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  reviewer_user_id TEXT NOT NULL REFERENCES users (id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (question_id, organization_id)
);
CREATE INDEX question_suggestions_created_idx ON question_suggestions (created_at);
-- plus the same-organization and organization-fixed triggers every root table has
```

### 4. Email and AI stay closed to self-serve spaces

- **Email.** A self-serve space cannot switch on email notifications: the switch is hidden, and the
  API refuses with 403 `feature_unavailable`. A platform admin may allow it later.
- **AI.** No AI task runs for a self-serve space. `runAi` refuses (`refused_disabled`) whenever the
  calling organization is self-serve. Today's tasks are console-only, so this is a guard for later.

### 5. Rate limits

- **The binding.** Cloudflare's rate-limiting binding (`ratelimits` in `wrangler.jsonc`, restated
  on all three Workers under the bindings rule).
- **What is limited, per IP and per person:**
  - `POST /api/auth/google`;
  - Phase 52's space-code lookup and join, and space creation;
  - invitations.

  Over a limit answers 429 `rate_limited`.
- **Daily caps** sit beside it, as indexed D1 counts: 3 spaces created per person, 5 open join
  requests per person, and 20 invitations per space.
- **First build step:** confirm the binding is available on the free plan. If it is not, a small
  Durable Object counter does the same job, never D1, which would spend the daily write limit.
- **Turnstile is left out for now.** Every action already needs a verified Google sign-in. It
  arrives with the first public page that needs no sign-in (the roadmap's sharing stage, O3).

### 6. Terms and privacy

- **Two public pages, `/terms` and `/privacy`** (web, outside the sign-in gate). Both are linked
  from the sign-in page ("By continuing you agree to…"), from the app's sign-in screen, which opens
  them in the browser, and from My profile.
- **The privacy page covers:**
  - what is kept: name, email, phone, and what a space records;
  - children's records, including handwriting in Assessments;
  - who processes it: Google for sign-in, Cloudflare for hosting;
  - that no child's data goes to an AI provider, and that the bank's AI writes no child data;
  - retention and deletion;
  - how to ask for deletion;
  - the support contact.
- **The children's notice** is a section of the privacy page.
- **Versions.** `TERMS_VERSION` and `PRIVACY_VERSION` live in shared. Phase 52 records which one a
  newcomer accepted.
- **Wording.** Claude drafts the text from what the code actually does. The owner, and ideally a
  lawyer, approves it before Phase 52 is released. Phase 51 can be released with it marked as a
  draft, since nobody new can sign in yet.

### Phase 51 exposure, seed and tests

- **R6 grows by one line:** an invited person's stored details reach a space only after they
  accept.
- **The seed** gains an invitation from the second organization to the institute's Alex, so the
  invited-name path is always present.
- **Tests.**
  - `invitations.spec.ts`: the same reply for a new and an existing address; the typed name until
    accepting; no lock while invited; the cap.
  - `quest.spec.ts` gains an untrusted space: the question stays `checked`, a suggestion reaches the
    console, and approving it there approves it.
  - `rate-limits.spec.ts`: a 429 past the limit, with the limit set low locally.
  - `legal.spec.ts`: the pages load signed out, and both clients link to them.
  - The Maestro flows `invitations/`.
  - `@compat`: memberships invited before `invited_name` existed read the stored name, since there
    is nothing else; this is noted in R6.
- **Then** the full suite, the mobile smoke and `test:compat`.

### Phase 51 production

The SQL blocks above. Every existing organization stays `console` and trusted, so nothing
changes for them.

---

## Phase 52: open sign-in and spaces

### The flow

```
Google sign-in
   │
   ├── known person ────────────────────────────────► today's picker or their space
   │
   └── unknown Google account
          │
          ▼
      About you: birth month and year, terms and privacy (nothing stored yet)
          │
          ├── under 13 → "Ask a parent to set up a space for you."  Nothing is stored.
          │
          ▼   (13 and over: the person is created)
      Welcome: "Do you have a space code?"
          │
          ├── yes → type the code → the space's name and mark → Ask to join
          │           → "Waiting for <space> to let you in"  (withdraw, or start a space anyway)
          │
          └── no  → "Name your space"  (adults only)
                      → the space is made: Assessment allowed and on, they are its admin
                      → its space code, with Copy and Share
                      → the welcome wizard: add a student, start an assessment
```

### Signing up, without storing anyone who does not finish

- **Unknown accounts are no longer refused.** For an unknown Google account (no person by `sub` or
  email, no invitation), `POST /api/auth/google` answers 200 with `{ signup: { token, name, email } }`
  instead of 403:
  - **`token`** is signed with `SESSION_SECRET`, lasts 15 minutes, and carries the verified `sub`,
    email and name.
  - **Nothing is written,** and there is no audit line naming the email.
- **Older apps.** The new answer goes only to clients that ask for it (`signup: true` in the request
  body). An older app build gets today's 403, so the phones keep working until they are reinstalled.
  `compat-clients.spec.ts` checks it.
- **`POST /api/auth/signup`** takes the `token`, the birth month and year, and the accepted terms
  and privacy versions.
  - **Under 13:** 403 `too_young`, and nothing is stored.
  - **13 and over:** it creates the `users` row (pinning `google_sub`) and the `platform_accounts`
    row, and sets the session cookie. It is logged `account.created` on the platform log.
  - **The age.** Only the band is kept, never the birth date.
- **Already known.** People already in a space, or invited to one, never see these steps: their
  space vouched for them.

```sql
CREATE TABLE platform_accounts (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  age_band          TEXT NOT NULL CHECK (age_band IN ('13-17', 'adult')),
  age_confirmed_at  TEXT NOT NULL,
  terms_version     TEXT NOT NULL,
  privacy_version   TEXT NOT NULL,
  accepted_at       TEXT NOT NULL
);
```

### Space codes

- **Format.** 8 characters from an alphabet without look-alikes (`23456789ABCDEFGHJKMNPQRSTVWXYZ`),
  shown as `K7QM-9XDA`. Typed in any case, with or without the dash.
- **Unique and random.** About 650 billion codes, read only through a rate-limited lookup, so they
  cannot be guessed.
- **Every space made in Phase 52 gets one at once.** Existing organizations get none until their
  admins press "Create a space code" on the Space page; joining by code stays off for them until
  then.
- **The admins' controls**, on the Space page (web and app): Copy, Share (the system share sheet,
  with "Join <space> on Aimtrue with code K7QM-9XDA"), Make a new code (the old one stops working),
  and Joining by code on or off.
- **The slug** of a self-serve space is made from its code (`s-k7qm9xda`): unique, and never
  derived from the name. The name may repeat; the code and slug never do.

```sql
ALTER TABLE organizations ADD COLUMN join_code TEXT;
ALTER TABLE organizations ADD COLUMN join_by_code INTEGER NOT NULL DEFAULT 0 CHECK (join_by_code IN (0, 1));
ALTER TABLE organizations ADD COLUMN created_by_user_id TEXT REFERENCES users (id);
CREATE UNIQUE INDEX organizations_join_code_unique ON organizations (join_code) WHERE join_code IS NOT NULL;
```

### Joining with a code

- **Asking to join.**
  - `POST /api/spaces/lookup { code }` answers the space's name and mark, while joining by code is
    on; otherwise 404, the same as an unknown code.
  - `POST /api/spaces/join-requests { code }` files a request, as the person: no free text.
  - Both are rate-limited, and sit outside `requireOrg` (the person is not a member yet), like the
    invitation routes.
- **What the space's admins see** (web and app): "Requests to join" on the People page, with a
  count badge. Each request carries what Google gave (name and email) and the date.
  - **Let in** opens the existing user form, prefilled, to choose roles. The existing rules apply
    unchanged: a student needs a guardian in the space, and the tutor role only where Tutoring is
    allowed. Saving makes them an active member: they asked, so no invitation is needed.
  - **Decline** closes the request. The person sees "<space> didn't accept your request".
- **The person** sees their open requests on the Welcome page, and may withdraw one.
- **Roles.** A join request is the one place a non-member's name sits beside a space, so
  `join_requests` is the deliberate exception to "every root table refuses a non-member". It says
  so in `schema.sql` and `docs/data-model.md`, and holds only the person's id. The name and email
  are read from `users` by the space's admins, and only while the request is open.

```sql
CREATE TABLE join_requests (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  requested_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  outcome         TEXT CHECK (outcome IN ('approved', 'declined', 'withdrawn')),
  answered_by     TEXT REFERENCES users (id),
  answered_at     TEXT,
  PRIMARY KEY (organization_id, user_id, requested_at)
);
CREATE INDEX join_requests_open_idx ON join_requests (organization_id, outcome, requested_at);
CREATE INDEX join_requests_person_idx ON join_requests (user_id, outcome);
-- plus the organization-fixed trigger (not the membership one: see above)
```

### Making a space

- **`POST /api/spaces { name }`** is open to adults only. It is rate-limited and capped at 3 spaces
  per person. In one batch it creates:
  - the organization: `created_via = 'self_serve'`, `quest_trusted = 0`, Tutoring and Quest not
    allowed, Assessment allowed and on, approved questions only, email off, the platform palette,
    the time zone from the browser (when it is in `ORG_TIME_ZONES`), the console's default curricula
    and a calendar domain;
  - its code, and joining by code on;
  - the creator as an active admin.

  It is logged `organization.created` in the new space's own log.
- **The name** goes through `optionalText` (so the SSN guard applies) and is refused if it is
  reserved: an existing console organization's name, or words such as "Aimtrue", "official" or
  "institute". Branding (palette, logo) is the space admins' own to change, as today; the built-in
  logo stays the platform's.
- **After creating it,** the person lands in the space with its code shown first. The welcome wizard
  follows, in its Assessment form:
  1. **Add a student.** The existing user form. "This is my child" also gives the creator the
     parent role and makes them the guardian, in the same request, so the guardian rule holds.
  2. **The parent's consent.** On adding a student, the admin confirms they are the student's parent
     or guardian, or have their permission, for the student to write answers on the canvas. It is
     recorded as a `consents` row, the first slice of roadmap F7, with the method
     `account_holder_attestation` and the privacy version.
  3. **Start an assessment.**
- **Assessment levels in a self-serve space** draw approved questions only (the trial switch is not
  offered). A level with fewer approved questions than the space's question count is left out of
  its picker. Before release, one read-only count per level against production confirms which
  levels qualify.

```sql
CREATE TABLE consents (
  organization_id  TEXT NOT NULL REFERENCES organizations (id),
  student_user_id  TEXT NOT NULL REFERENCES users (id),
  guardian_user_id TEXT NOT NULL REFERENCES users (id),
  purpose          TEXT NOT NULL CHECK (purpose IN ('child_account')),
  method           TEXT NOT NULL CHECK (method IN ('account_holder_attestation', 'signed_form')),
  version          TEXT NOT NULL,
  given_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  withdrawn_at     TEXT,
  PRIMARY KEY (organization_id, student_user_id, purpose, given_at)
);
-- plus the same-organization (all three people must be members) and organization-fixed triggers
```

### Leaving, deleting a space, deleting an account

- **Leave a space.** For any member who is not its last admin. It removes their membership, as an
  admin's removal does today, and is logged.
- **Delete a space.** For an admin of a self-serve space they made, who types its name to confirm.
  It purges every row of that space, in dependency order and in one batch (a small space is a few
  hundred rows at most), and archives nothing. The platform log keeps "A space was deleted by its
  owner", with no names. The audit lines inside the space go too: a space deleted at its owner's
  request is not tampering with a record someone else relies on.
  - **Not for institutes.** Console-made organizations cannot be deleted this way.
- **Delete my account.** For a person with no remaining membership and no open request. It scrubs
  the `users` row (name "Deleted account"; email, phone and Google id cleared) and sets
  `deleted_at`, logged `account.deleted` on the platform log without the name.
  - **Members of an institute** see "Ask <space> to remove you first".
  - **Apple.** The app's in-app deletion (Apple's rule) is this same route.

### The word "space"

Every screen that says "organization" says "space" (web and app):

- the sign-in and picker screens ("Choose a space"), the switcher, the Space page (was Organization,
  its address still `/organization`) and the error messages;
- the console ("Spaces", with a column for console or self-serve and its creator's name).

Docs keep "organization" for the code.

### The session payload

`SessionResponse` gains:

- `account`: the age band, or null for a person a space added;
- `join_requests`: their own open requests;
- per membership, whether they may leave.

The mobile `api.ts` copies change with it. `GET /api/auth/session` for a person with no space and
no request is the Welcome page's cue, on both clients.

### Phase 52 exposure

- **R21 (new).**
  - **A space's code** reaches only its admins.
  - **The lookup** gives only the name and mark, only while joining by code is on, and is otherwise
    404, as for an unknown code.
  - **A join request** reaches the person who made it and that space's admins, never another space.
    The requester's name and email reach those admins only while the request is open.
  - **A newcomer with no space** reads nothing but their own account and requests: every guarded
    route answers 403 `organization_required`.
  - **A consent row** reaches the space's admins and the guardian.
  - **The log.** An age, a birth date or a refused under-13's email never appears in any log or row.
- **Crawled by** `exposure-spaces.spec.ts`, with a newcomer, a requester, a self-serve space's admin
  and its child, and an institute admin who must see none of a self-serve space.

### Phase 52 seed

- **People:** a newcomer with no space; a person with an open request to the institute; a
  self-serve family space (two adults, two children, consents, assessments made by the scenario
  script); a 13-17 member.
- **The institute** gets a space code, with joining off.

### Phase 52 tests

- `signup.spec.ts`: under 13 stores nothing; 13-17 may join but not create; an adult creates.
  Rate limits and caps; the older-client 403.
- `spaces.spec.ts`: code lookup, request, let in, decline, withdraw; making a new code kills the
  old one; joining by code off; name rules; delete a space; leave; delete my account.
- `exposure-spaces.spec.ts` (R21), and `exposure-organizations.spec.ts` gains a self-serve space.
- The Maestro flows `spaces/`: sign-up steps, Welcome, join, create, the code card and Share,
  requests, deletion. Tagged `smoke` along the main path, on iOS and Android.
- The web `@smoke` gains create-a-space then start-an-assessment. Then the full suite, the mobile
  smoke and `test:compat` (with `@compat`: older organizations have no code and joining off).

### Phase 52 production

- **The SQL blocks above.**
- **Google's consent screen** now shows "Aimtrue" to the public. Brand verification can follow;
  the three basic scopes need no review.
- **The checks after deploying:** the sign-up of an unknown test account end to end on
  `tutoring`, then deleting it again, the space included.

---

## Quota without Workers Paid

The owner chose to stay on the free plan for now. What keeps that safe:

- **The caps above:** 3 spaces per person, invitations, requests and rate limits.
- **Approved questions only** in spaces; the bank's pickers stay as they are.
- **The same read discipline as before:** indexed seeks, no polling, no D1 writes per page view.
- **A check after each release,** and weekly while sign-up is new: `wrangler d1 info tutoring-db`
  (it reads analytics, not rows). If a day passes about **2.5 million rows read**, half the limit,
  the owner hears about it, because the institute shares the database and a day past 5 million
  fails every query until midnight UTC.

---

## Decisions (proposed defaults: the owner confirms or changes them)

1. **Joining by code** files a request that the space's admins answer. Recommended, because a code
   can be passed on. The alternative is joining at once as a member with no roles.
2. **"Space" everywhere on screen,** the institute included. The code keeps "organization".
3. **Existing organizations** keep all three feature sets and have no space code until their
   admins make one.
4. **Ages:** under 13 refused, 13-17 join only, adults create.
5. **Deleting a space** purges everything in it, its activity log included.
6. **Turnstile waits** for the first public page without sign-in.
7. **Terms and privacy:** Claude drafts them; the owner (and ideally a lawyer) approves them before
   Phase 52 is released.
8. **The invitation fix applies to every space,** the institute included.
9. **The tutor role** exists only where Tutoring is allowed.
10. **A parent's consent** in self-serve spaces is the account holder's confirmation, recorded per
    child. Stronger methods come with F7.
11. **Self-serve spaces draw approved questions only;** a level without enough is not offered.
12. **The first release tag** goes on the commit production runs today.

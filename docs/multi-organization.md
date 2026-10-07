# Multiple organizations — the plan (Phase 27)

Phase 27 was a planning phase. The owner asked for an audit of the data model, the services and
the UI, and for a detailed plan to extend the portal so that:
- **platform admins** create organizations and their admins;
- inside an organization, everything behaves **exactly as it does today**;
- each organization has its **own logo and colors**;
- a person may **belong to several organizations**, picks one after signing in, and can switch.

Nothing here is built. The build is proposed as a demo-protection step and then **Phases 28–31**
(§3). Each is built only once the owner writes it into `docs/plan.md`, as with any phase. Line
numbers in the appendix were checked on 2026-10-04 against commit `1e219f9`; re-check them before
building.

## Status: built on `orgsupport` (2026-10-05)

Phases 27-31 are built on the `orgsupport` branch and deployed to `tutoring` and
`tutoring-test` only. Where the build differs from the design below:

- **The per-person tables kept their names.** `user_roles`, `tutor_profiles`,
  `student_profiles`, `guardianships`, `payment_handles` and `availability_slots` gained
  `organization_id` in their keys rather than being renamed `org_*`: on a clean build the renames
  bought nothing, and kept names halved the churn. `org_members` is new.
- **No legacy tables, backfills or §5 release** -- the tutoring databases were built clean.
- **Invitations.** A person who already has an account is invited, and accepts at sign-in; a
  brand-new person takes the status the admin chose. The admin can therefore tell the two apart
  -- the price of asking an existing person's consent, rather than making every new person
  accept too.
- **The time zone is offered now** (Phase 31 was built with the rest): `ORG_TIME_ZONES`, the US
  zones.

## Where it is built (2026-10-05)

The owner chose not to migrate the institute's production in place. Multi-organization support is
built on a **new pipeline**:

| Deployment | Sign-in | Database | Deploy with |
| --- | --- | --- | --- |
| `tutoring` | on | `tutoring-db` | `npm run deploy` (with `tmi-portal`) |
| `tutoring-test` | off | `tutoring-test-db` (TEST account since 2026-10-07) | `npm run deploy:test`, or `npm run e2e` |

Both deployments wear the neutral `platform` brand ("Tutor Portal"). Both databases were created
empty, because their first schema is the one with organization support.

**What this changes in the plan below:**
- **The tutoring databases start with organization support.** `organization_id` is `NOT NULL`
  from day one. There are no `legacy_*` renames, no backfill and no re-backfill. §5 (releasing in
  place) applies only if the institute's records ever move onto the platform, as one organization.
- **The institute's production keeps running today's single-organization code.** Once
  organization-aware code is on `main`, `npm run deploy` must not ship it to `tmi-portal`, whose
  database has no organizations. Before Phase 28 starts, decide how the institute's fixes ship:
  - a long-lived branch for it, cut from the last single-organization commit; or
  - moving the institute onto the platform.

## Decisions

The owner decided these on 2026-10-04:

1. **One global person.** A person is one `users` row and one Google sign-in across every
   organization.
2. **One address, and a switcher.** Everyone uses the same portal URL. After signing in, a person
   in several organizations picks one, and the header switches between them.
3. **Platform admins manage organizations and their admins only.** They see no students, sessions
   or money in an organization unless they are also a member of it.
4. **Branding is an uploaded logo plus a choice of preset palettes** shipped in CSS.

---

## 1. What the audit found

The portal is single-tenant from top to bottom. The institute is assumed in more than 40 places.
Appendix A lists them with file and line.

- **Nothing knows about an organization.** There is no table, column, cookie claim or request
  variable for one. The session JWT carries only `sub`.
- **Admin rights come from one place.** `ROLES_CSV` (`repositories/users.ts`) fills `user.roles`
  on every request. Filter it to one organization and every `isAdmin` / `requireAdmin` check
  becomes per-organization with no other change. That is what keeps this plan affordable.
- **Admins skip all scoping.** `teachingScopeSql`, `studentScopeSql`, `visibleUserIds`, payments'
  `scopeFor` and comments' `personScopeSql` return `null` for an admin, and every caller reads
  `null` as "no WHERE". With two organizations, an admin of one would read both.
- **With a global person, non-admin queries cross organizations too.** Anything keyed on a user id
  does:
  - **balances:** the earned and charged subqueries, the guardian query, and both batch queries
    in `computeTutorPaymentOutlook`;
  - **dashboards:** the tutor and student dashboard counts, and `listRecentReflections`;
  - **audit feeds**, which are keyed on actor or subject;
  - **schedule matching:** `NOT_OVERTAKEN_SQL` and `hasLessonOn`, which match on tutor, student
    and date;
  - **pricing:** `getActiveAssignmentFor` and `getStudentChargeRates`;
  - **guardians:** `isGuardianOf`, `countGuardians` and `familyStudentIds`;
  - **user detail:** all eight queries in `getUserDetail`.

  The admin's "view as" turns any one of these into a leak from one organization to another
  organization's admin.
- **Lookups by id with no scope:**
  - `getSession`, `getAssignment`, `getPayment`, `getSchedule`;
  - `getAssessment`, `getPlan`;
  - `getComment`, `loadCommentTarget`;
  - `getUserDetail`, and `getLiveUserById` for "view as".
- **Queries with no viewer at all:**
  - tax: `listTutorTaxStatus`, `listTutorsMissingSsn`;
  - the admin dashboard: `buildAdmin`'s totals, `teachingActivity`, `progressSpotlight(db, null)`;
  - live lessons: `listActiveRows`;
  - finance: `computeMonthlyFinance`;
  - cancellations: `listCancellationsForSchedules`, `listCancellationsForStudents`;
  - progress: `buildStudentProgress`.
- **Sign-in trusts the email alone.** It matches on email. `recordSignIn` pins `google_sub` with
  `COALESCE` but never compares it, so whoever controls a row's email signs in as that person.
  With a shared person, an admin of organization A who edits Maria's email could take over her
  account in B.
- **These constraints are global and clash with organizations:**
  - one primary guardian per student;
  - one active plan per student;
  - one row per person for profiles, payment handles and availability;
  - `assignments UNIQUE (tutor, student)`. It is inline and referenced by comments with
    `ON DELETE CASCADE`, so it cannot be dropped in place. Its upsert re-reads by tutor and
    student, so it could hand back another organization's row.
- **Each deployment sets these once:**
  - the brand: the `BRAND` var, `BrandId` and `BRANDS`, plus the `index.css` blocks per brand, in
    which 48 tokens hard-code the institute's hue;
  - the institute's PNGs in `public/`, which every deployment serves;
  - "TMI Portal" in the phone header;
  - the calendar file's `UID@trianglemathinstitute.com` and `PRODID`;
  - `tmi-*` file names, and "Institute cut";
  - `INSTITUTE_TIME_ZONE`;
  - the TIN on `admin_profiles`, which the 1099 prefills from the signed-in admin;
  - `countAdmins` as the bootstrap gate, and `FALLBACK_DEV_EMAIL`.
- **Operations and tests:**
  - `npm run e2e` and `demo:reset` wipe the demo's database.
  - `db/demo-admin.sql` uses `INSERT OR REPLACE INTO users`. With foreign keys on, that deletes
    the row first and fires its cascades.
  - The exposure crawl never signs in as an admin, and every persona belongs to one institute.
  - Downloads are plain `<a href>` links, so they cannot carry a header.
- **Volume:** 29 tables and 172 `.prepare(` sites, about 90 of which read tenant data. The six
  per-person leaf tables are referenced 72 times across 11 API files, 39 of them in
  `repositories/users.ts`.

---

## 2. The model

### The principle

This replaces the rule "a person is one users row; what they do is user_roles":

> **The person is their sign-in identity and how to reach them. Everything else belongs to the
> organization that recorded it.**
>
> To decide where something goes, ask: *could two organizations sensibly disagree about it?* If
> they could, it is per-organization.

| Kind | Tables |
| --- | --- |
| **Global: the person** | `users` (name, email, phone, `google_sub`, `deleted_at` = account erased); `user_onboarding.tour_finished_at`; `platform_admins` (new) |
| **New: the organization** | `organizations`; `organization_logos` |
| **Per organization: membership** | `org_members`; `org_member_roles` |
| **Per organization: what it records about a person** | `org_tutor_profiles`, `org_student_profiles`, `org_guardianships`, `org_payment_handles`, `org_availability_slots` |
| **Per organization: root rows** (gain `organization_id`) | `assignments`, `sessions`, `scheduled_sessions`, `session_drafts`, `active_sessions`, `payments`, `comments`, `assessments`, `learning_plans`, `audit_events` |
| **Inherit through their parent** | `session_write_ups`, `session_assessments`, `session_reflections`, `session_progress`, `session_topic_ratings`, `schedule_cancellations`, `assessment_topic_ratings`, `learning_plan_topics` |
| **Global reference data** | `curriculum_levels`, `curriculum_topics` |

**Why each of these is per-organization:**
- **Pay rates, prices and the maximum lesson length** are each organization's business decision.
- **The SSN-received date and the 1099 address** belong to whichever organization files the 1099.
- **The guardian who is billed** is whoever that organization charges.
- **Payment handles.** If one shared payout handle were editable by any organization's admin, one
  organization could redirect another's payments.
- **Availability** is what the person offers that particular organization.
- **Membership status.** Suspending someone in A leaves B alone. `users.status` and
  `last_login_at` are no longer shown to anyone; `org_members.last_entered_at` replaces them.

### New tables (sketch)

```sql
CREATE TABLE organizations (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,      -- tmi; used in tmi_last_org, file names, logo URLs
  name            TEXT NOT NULL,             -- "Mathematics Institute of the Triangle"
  short_name      TEXT NOT NULL,             -- "TMI Portal"
  tagline         TEXT,
  blurb           TEXT,
  place           TEXT,
  palette         TEXT NOT NULL,             -- an ORG_PALETTES id; Zod validates, no CHECK, so
                                             -- adding a palette never needs a table change
  builtin_logo    TEXT CHECK (builtin_logo IN ('institute')),   -- platform admins only
  tin             TEXT,                      -- the payer TIN, through optionalText (SSN guard)
  payer_address_line1 TEXT, payer_address_line2 TEXT, payer_city TEXT,
  payer_region    TEXT, payer_postal_code TEXT,
  time_zone       TEXT NOT NULL DEFAULT 'America/New_York',   -- fixed until Phase 31
  calendar_domain TEXT NOT NULL,             -- never changes once set: it is in every UID
  archived_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE organization_logos (
  organization_id TEXT NOT NULL REFERENCES organizations (id),
  kind            TEXT NOT NULL CHECK (kind IN ('mark', 'full')),
  content_type    TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/webp')),
  bytes           BLOB NOT NULL,             -- at most 256 KB, bound as a parameter
  sha256          TEXT NOT NULL,             -- the ?v= in its URL
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (organization_id, kind)
);

CREATE TABLE platform_admins (
  user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE org_members (
  organization_id      TEXT NOT NULL REFERENCES organizations (id),
  user_id              TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'invited'
                       CHECK (status IN ('active', 'invited', 'suspended')),
  removed_at           TEXT,                 -- "no longer part of this organization"
  first_entered_at     TEXT,
  last_entered_at      TEXT,
  details_confirmed_at TEXT,                 -- moved from user_onboarding (Phase 26)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX org_members_user_idx ON org_members (user_id);

CREATE TABLE org_member_roles (
  organization_id TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'tutor', 'student', 'parent')),
  created_at      TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id, role),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES org_members (organization_id, user_id) ON DELETE CASCADE
);
```

**The other per-organization tables follow the same shape:**
- **`org_tutor_profiles` and `org_student_profiles`** have every column of today's table, keyed
  `(organization_id, user_id)` with the composite foreign key to `org_members`.
- **`org_payment_handles`** is keyed `(organization_id, user_id, method)`.
- **`org_availability_slots`** is keyed `(organization_id, user_id, day_of_week, hour)`.
- **`org_guardianships`** is keyed `(organization_id, guardian_user_id, dependent_user_id)`, with
  one composite foreign key per side. One primary guardian per student per organization is a
  partial unique index on `(organization_id, dependent_user_id) WHERE is_primary = 1`.
- **`admin_profiles`** retires. Its TIN becomes `organizations.tin`.

### The database keeps rows in their organization

This is enforced by the database, not left to discipline:
- **The new tables** use the composite foreign keys above.
- **Every root table** gets a `BEFORE INSERT` trigger. It refuses a NULL `organization_id`, and
  refuses any person the row names who is not a member of that organization.
- **Every root table** also gets a `BEFORE UPDATE OF organization_id` trigger that refuses the
  change, so a row can never move between organizations.
- **Foreign keys to `organizations` have no ON DELETE action.** Organizations are archived, never
  deleted.
- **The triggers are in `schema.sql` as well,** so local development and the tests run exactly
  what production runs.

The trigger on `sessions`, for example:

```sql
CREATE TRIGGER sessions_same_organization
BEFORE INSERT ON sessions
WHEN NEW.organization_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM org_members m
                 WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.tutor_user_id)
  OR NOT EXISTS (SELECT 1 FROM org_members m
                 WHERE m.organization_id = NEW.organization_id AND m.user_id = NEW.student_user_id)
BEGIN
  SELECT RAISE(ABORT, 'organization_mismatch');
END;

CREATE TRIGGER sessions_organization_fixed
BEFORE UPDATE OF organization_id ON sessions
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'organization_fixed');
END;
```

`audit_events` is the exception. Its `organization_id` is NULL for events that belong to no
organization: the sign-in itself and `platform_admin.*`. `recordAudit` takes the organization as a
**required** argument, and the platform passes `'platform'` explicitly. `recordAudit` swallows its
own errors, so a missing organization would otherwise fail silently.

### Production stays additive

Nothing in production is dropped:
- **New tables** under new names, then backfilled with `INSERT … SELECT`.
- **The six old leaf tables are renamed** (`ALTER TABLE user_roles RENAME TO legacy_user_roles`,
  and likewise for `tutor_profiles`, `student_profiles`, `admin_profiles`, `guardianships` and
  `payment_handles`). Nothing references them, and their `updated_at` triggers follow the rename.
  A code site that was missed then fails loudly instead of quietly reading stale data. `schema.sql`
  drops the old names, so fresh databases never have them. Dropping the legacy tables from
  production is a later, separate approval.
  - **`availability_slots`** has no foreign keys pointing at it either, so it is renamed the same
    way to `legacy_availability_slots`.
- **Root tables:**
  - `ALTER TABLE x ADD COLUMN organization_id TEXT REFERENCES organizations (id)`. SQLite requires
    a column with a foreign key to default to NULL. A `CHECK` would fail on existing rows, which is
    why the trigger does that job.
  - A backfill, then `(organization_id, …)` indexes.
  - `schema.sql` declares the column `NOT NULL`.
- **`learning_plans_one_active_idx`** is dropped and recreated on
  `(organization_id, student_user_id)`. That changes an index, not data. It is the one exception
  to "additive", and it is called out.
- **The audit backfill:** setting `audit_events.organization_id` on existing rows is a **one-time,
  documented exception** to "never update audit rows".
- **Status:**
  - Membership `status` is copied from `users.status`, and `removed_at` from `users.deleted_at`.
  - `users.deleted_at` is never again set for leaving an organization. The live-email index would
    otherwise allow a second row with the same address, which would be a duplicate person.
- **The TIN:** `organizations.tin` takes the most recently updated non-null `admin_profiles.tin`.

### Limitations, kept and written down

- **`assignments UNIQUE (tutor, student)` stays global in production,** so one pair can be paired
  in only one organization. `schema.sql` declares it per organization.
  - `upsertAssignment` re-reads by id and organization, never by the pair.
  - A collision across organizations gets a generic error that does not confirm the pair exists.
  - Rebuilding the table needs the export-and-restore route (§4) and its own approval.
- **`active_sessions` keeps its primary key on `tutor_user_id`.** That is correct: nobody teaches
  two lessons at once anywhere. The "already running" error names no other organization's student.
- **The curriculum stays global.** A curriculum per organization would be a separate roadmap item.

---

## 3. How a request carries its organization

The session cookie stays **identity-only**, exactly as today. The organization travels on each
request:
- an **`X-Organization`** header on fetches;
- **`?org=`** on download and calendar links, which are plain links and cannot carry a header.

**`requireOrg`** is mounted after `requireAuth` on the guarded router. On every request it:
- re-reads the membership and the organization's state, the same way `requireAuth` re-reads the
  user;
- loads the person's **roles in that organization**;
- sets `c.get('org')`.

A request that names no organization, or one the person is not an active member of, gets 403
`organization_required`. The platform routes and `/api/auth/*` sit outside it.

**Where the choice lives:**
- **Each tab** keeps its choice in `sessionStorage`, so two tabs can sit in two organizations
  without a stale tab ever acting in the wrong one.
- **A `tmi_last_org` cookie** remembers the choice for the next visit (not for the sign-in page). It
  holds the slug, lasts one year, and is not HttpOnly.

**Isolation rules.** These are what Phase 28 builds and what every later change must keep:
1. **A branded `OrgId` type** can only be obtained from `c.get('org')`. Every repository function
   that touches tenant data takes one, so a forgotten organization is a type error.
2. **Every read of a root table includes `alias.organization_id = ?`, for every reader.**
   - Admins get exactly that, and everyone else gets it AND their relationship.
   - Scope helpers never return `null`, and the roughly ten `if (scope)` branches become
     unconditional.
3. **A lookup by id adds the organization,** so a row from elsewhere is a 404, as R9 already
   requires.
4. **Writes stamp `organization_id`.** `assertOrgMembers(db, org, ids)` replaces
   `findMissingUserIds`, `assertRoles` and `assertParties`, so a person, pairing, schedule or plan
   from elsewhere answers as missing.
5. **A static check catches unscoped SQL.** `scripts/check-org-scope.mjs`, run by
   `npm run typecheck`, fails when an SQL string in `apps/api/src` names a root table without
   `organization_id`. Its allow-list is explicit: the cron's `listActiveRows`, sign-in and the
   platform routes.
6. **The cron (`autoStopExpired`)** handles each expired lesson in its row's own organization: the
   rates, the session it records and the audit line.
7. **Audit.** An admin's feed is their organization's. A non-admin's actor-or-subject feed is
   narrowed to the active organization. Filters are `organization_id = ?`, never `OR IS NULL`.
8. **With sign-in off,** the bypass honours `X-Organization` too. On an empty database it creates
   a local organization and a membership, as well as the placeholder admin. CORS
   (`apps/api/src/index.ts`) allows `X-Organization`.

### Sign-in, picking and switching

- **Google sign-in** looks up `google_sub` first, then email. It **refuses an email match whose
  pinned `sub` differs.** A platform admin can unpin a `sub` for a recreated Google account.
- **A person with no active membership who is not a platform admin** gets 403, exactly as an
  unknown email does today.
- **Picking an organization:**
  - **One membership** is chosen automatically.
  - **Several:** the `tmi_last_org` choice if it is still valid. Otherwise **`/select-organization`**,
    which lists each organization's logo and name and the person's roles there, plus any pending
    invitations to accept or decline.
  - **A platform admin with no membership** goes to `/platform`.
- **`GET /api/auth/session`** returns `{ user, impersonated, onboarding }` as today, where
  `user.roles` are the roles in the named organization. With the header it also returns:
  - `organization`: its public brand, plus the TIN and payer details for its admins;
  - `memberships[]`: slug, name, short name, palette, logo URL and roles;
  - `invitations[]`;
  - `platform_admin`.
- **`POST /api/auth/enter`** is called once per tab load, with the header. It updates
  `first_entered_at` / `last_entered_at` and records `auth.entered` in that organization's log, at
  most once per 12-hour sign-in. The sign-in itself is recorded with no organization, so one
  organization never learns when a person used another.
- **The switcher** appears only when there are two or more choices, and the platform console
  counts as one. It replaces the sidebar's logo lockup with a dropdown, and "Switch organization"
  is added to `UserMenu`. Switching sets `sessionStorage` and `tmi_last_org`, then does a **full
  reload**, so the query cache, brand, onboarding and dashboards all start clean.
- **The first visit to an organization** (`first_entered_at` is null) offers "Welcome to X — take
  the tour?", reusing the Phase 26 tour.

### People across organizations

- **An organization admin adds people by email.**
  - **Brand-new person:** they are created with an `invited` membership, which signing in accepts,
    as today.
  - **Already a member elsewhere:** they get an invitation, which they accept or decline when they
    sign in. Until then the organization sees only the email it typed.
  - **The answer looks the same either way,** so nobody can probe for accounts. `EMAIL_TAKEN` is
    returned only for an email that is already a member *here*.
- **Students without an email** are never matched across organizations. A child at two
  organizations is two records; merging them would be a later platform tool.
- **The shared fields are name, email and phone.**
  - **In one organization:** edited as today.
  - **In two or more:** organization admins see the fields read-only, with "Shared with other
    organizations — the platform admin changes these", and only a platform admin can edit them.
    This is what stops one organization taking over another's member by changing their email.
- **Deactivate, suspend and restore** act on the membership, not the person.
- **Hard delete** erases this organization's rows about the person, with explicit DELETEs by
  organization (never a cascade from `users`), and then the membership. The `users` row is purged
  only when no membership rows remain, removed ones included.
- **The guardian rule** becomes "a student has at least one guardian **who is a member of this
  organization**". It still lives in the API. The "students missing a parent" query in
  `docs/data-model.md` is rewritten per organization.

### Platform admins

- **`platform_admins` is a table, not a role.** Roles belong to organizations, and CLAUDE.md
  forbids flags on `users`.
- **Bootstrap.** While the table is empty, a sign-in listed in `BOOTSTRAP_ADMIN_EMAILS` becomes a
  platform admin, replacing the global `countAdmins` gate. The production release inserts the
  owner directly rather than relying on that window.
- **`/platform`** (`routes/platform.ts`, behind `requirePlatformAdmin`, with no organization)
  offers:
  - list organizations;
  - create, edit and archive an organization: name, short name, slug, tagline, blurb, place,
    palette and logos, plus `builtin_logo`;
  - add and remove its admins by email, through the invitation flow above;
  - unpin a Google `sub`;
  - edit the shared fields of a person in several organizations.

  Nothing else about an organization is visible there.
- **Audit.** A platform action is written into **the affected organization's** log, so its admins
  see what was done to them. It is also listed on `/platform`. `platform_admin.added` belongs to no
  organization.

### Branding

- **Palettes.** `organizations.palette` takes one of the ids in `ORG_PALETTES` (shared):
  - `plum`: the institute's ramp, exactly as it is today;
  - `indigo`: Chapel Hill's, exactly, including its teal accent and dark sidebar;
  - about four new ones.

  Each is a `:root[data-palette=…]` block, light and dark, contrast-checked when built: white on
  brand-700, the focus ring, and the dark-mode primary.
- **Before an organization is known, the palette is neutral,** so no organization flashes the
  institute's plum. The 48 tokens that hard-code its hue move into the palette blocks.
- **Logos** live in `organization_logos`, a mark and a full logo for each organization:
  - **PNG or WebP only,** checked by their magic bytes. **SVG is refused,** because served from the
    portal's own address it can carry script that runs as whoever opens it.
  - At most 256 KB, bound as a BLOB, so D1's 100 KB statement limit never applies.
  - Served publicly at `/api/organizations/:slug/logo/:kind?v=<sha256>`, with `immutable` caching,
    `nosniff` and `Content-Security-Policy: default-src 'none'`.
  - **Fallback:** an organization without a logo gets `MathMark` in its palette.
  - **The institute's PNGs** stay behind `builtin_logo = 'institute'` until they are uploaded, and
    then leave `public/`.
- **`BrandProvider`** reads the session's `organization` and sets `data-palette`, the title, the
  favicon and `theme-color`. `useBrand()` keeps its shape, so its seven callers do not change. The
  `BRAND` var, `BrandId` and `resolveBrand` retire.
- **The sign-in page** is branded by `/api/auth/config` with the organization the address is for
  (`DEFAULT_ORGANIZATION`), otherwise the neutral `PLATFORM_BRAND` ("Tutor Portal"). (Until
  2026-10-06 it read `tmi_last_org`, which put the last organization's look on the shared
  `tutoring` sign-in page; an organization's look now appears only after entering it.)
- **Branding is set by platform admins.** An organization's own admins get an **Organization
  settings** page for the TIN and the 1099 payer address, and see the branding read-only. Letting
  them edit branding later is a one-line policy change.
- **Calendar files.**
  - **The institute** keeps `calendar_domain = 'trianglemathinstitute.com'` **permanently**:
    changing a UID duplicates every event in every subscriber's calendar.
  - **Other organizations** use `<slug>.<portal host>`.
  - `PRODID` carries the organization's name.

---

## 4. Build phases (proposed)

Each phase ships on its own and leaves production consistent. **No real second organization
exists until Phase 30.** Only the platform console can create one, and it ships together with
branding, so a second organization never wears the institute's identity.

### Before Phase 28: protect the demo

This is a small step on its own.

- **Give the e2e suite its own Worker environment and database:** `env.e2e` and
  `tmi-portal-e2e-db`. The free tier allows 10 D1 databases. `npm run e2e` targets it.
- **Make `scripts/e2e.sh` and `demo:reset` refuse to run against the demo's database.**
- **Switch `db/demo-admin.sql` to `INSERT … ON CONFLICT DO UPDATE`.**
- **Export the demo's database** as a backup.

Until this ships, the suite runs locally and the demo is deployed code-only with
`npm run deploy:test`.

### Phase 28: organizations underneath (no visible change)

- **Schema** (a `BEGIN/END PHASE 28` block):
  - the new tables;
  - the per-organization tables;
  - `organization_id` on the root tables;
  - the plan-index swap;
  - the triggers.

  **One parameterised release SQL** (organization id, slug, name, palette, built-in logo, calendar
  domain) fills both production and the demo:

  | Database | Organization | Slug | Palette | Built-in logo |
  | --- | --- | --- | --- | --- |
  | Production | the institute | `tmi` | `plum` | `institute` |
  | Demo | Chapel Hill Math Institute | — | `indigo` | none |
- **API:**
  - everything in §3;
  - the `google_sub` check;
  - per-organization profiles, guardianships, handles and availability, with
    `profileCleanupStatements` working per organization.
- **The shared contract barely moves.** `User.status` and `admin_profile.tin` keep their shape,
  backed by the membership and the organization, so the UI and `tax.spec.ts` do not change yet.
  The "Institute TIN" field on an admin's form edits `organizations.tin`.
- **Branding:** `/api/auth/config` and the session serve the brand from the organization row, and
  the CSS blocks move from `data-brand` to `data-palette`.
- **Names taken from the organization:**
  - CSV files are named `<slug>-…`, so the institute keeps `tmi-…`;
  - the ICS UID and `PRODID`;
  - "Institute cut" becomes "`<short name>` cut";
  - the phone header uses `brand.short`.
- **The SPA's fetch wrapper** sends `X-Organization`. With one membership it is always chosen
  automatically.
- **Seed** (`generate-seed.mjs`):
  - organization A is today's cast, **byte-identical**;
  - organization B is a small cast with its own PRNG stream and id prefixes;
  - **shared people, inserted directly** so the crawl can see the person-keyed class of leak:
    - Alex tutors in A and is a parent in B;
    - Anita is a parent in both, with a different child in B;
    - one tutor–student pair exists in both;
  - a platform admin with no membership.
- **Tests:**
  - **The fixture.** `as(who, { org })` sets `tmi_last_org` through an init script, not a context
    header, which would double up with the SPA's own. API-level requests set `X-Organization`
    directly.
  - **R13, "nothing crosses organizations".** This rule goes into `docs/data-exposure.md` and the
    crawl:
    - Build organization B's universe of ids and names.
    - Crawl every read endpoint, every CSV and ICS body, and every audit action **as every
      persona in A, admins and "view as" included**. Fail on any of B's ids or names.
    - Fetch every one of B's ids by id and expect 404. Expect 404 from every write that references
      one.
    - Repeat with A and B swapped for the shared people.
  - **Update the assertions** on "Institute cut".

### Phase 29: people in several organizations

- **What it builds:**
  - the picker and the switcher;
  - `sessionStorage` plus `tmi_last_org`, and `?org=` on downloads;
  - `POST /api/auth/enter`;
  - invitations, accepted or declined;
  - membership status, removal, restore and purge per organization;
  - the shared-field lock;
  - the per-organization welcome;
  - `last_entered_at` on the users list.
- **Tests:**
  - A shared person sees only A's rows and roles, then only B's.
  - Their drafts, reflection prompts, balances and dashboards never mix.
  - Two tabs stay in two organizations.
  - An invitation reveals nothing about whether an account exists.
- **In production this is invisible** until Phase 30, because there is one organization.

### Phase 30: platform admins, new organizations and their look

- **What it builds:**
  - `platform_admins`, with the owner inserted by the release SQL;
  - the `/platform` console;
  - logo upload and serving;
  - the new palettes;
  - the branded sign-in page and the neutral default;
  - the Organization settings page (TIN, payer address). The TIN field leaves the user form, and
    the contract's `admin_profile.tin` retires.
  - The institute's PNGs are uploaded through the console, then removed from `public/`.
- **R14:**
  - Platform admins read organizations and their admins only.
  - An organization admin gets 403 on `/api/platform/*`.
  - A platform admin with no membership gets 403 `organization_required` everywhere else.

### Phase 31: an organization's own clock (optional)

Thread `organizations.time_zone` through:
- `zonedClockParts` and `expandUpcoming`;
- `resolveTimes` and `reflectionPromptSince`;
- the cron's cut-off;
- `instituteToday` and the CSV dates;
- the UI's uses of `INSTITUTE_TIME_ZONE`.

Until then every organization is on America/New_York, and the console does not offer the field.

---

## 5. Releasing Phase 28

Later phases release as ordinary additive changes.

1. **Rehearse.** Production's schema has drifted from `schema.sql`, so rehearse on a scratch
   local D1 imported from a fresh production export:
   - run the release SQL;
   - check row counts per table and per organization;
   - run the new read queries;
   - run the suite against it.
2. **Make every statement idempotent:** `IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, and
   backfills `WHERE organization_id IS NULL`. A partial run can then simply be re-run.
3. **The order on each database.** Do the demo first, then production. Back each up with
   `wrangler d1 export` and note its Time Travel bookmark. Run steps 1 and 2 back to back, at a
   quiet hour:
   1. create the tables and columns, then backfill;
   2. deploy the new Worker;
   3. run the backfill again, catching anything the old Worker or the cron wrote in between;
   4. rename the old tables to `legacy_*`;
   5. **then** create the triggers.
4. **Check, read-only:**
   - no NULL `organization_id`;
   - one membership per live user;
   - roles and profiles counted the same as in the legacy tables.

   Then smoke-test sign-in, the dashboard, the 1099 prefill, a CSV and a calendar file.
5. **Roll back with `rollback.sql`,** rehearsed in step 1. It drops the triggers, copies the
   `org_*` rows back into the legacy tables and renames them back. Then redeploy the previous
   Worker.

The demo is migrated in place with Chapel Hill's values. It is never wiped or reseeded, and its
users keep their `created_at`.

## 6. Risks, written down

- **Corrections to shared fields need a platform admin.** The name, email and phone of someone in
  several organizations are locked to platform admins: the price of a shared person that no single
  organization can hijack.
- **One pair can be paired in only one organization** until `assignments` is rebuilt.
- **A platform admin sees a name and an email when adding an admin.** That is inherent in adding
  someone by email.
- **The legacy tables stay in production** until a separately approved drop.
- **The six people-model rules in CLAUDE.md must be rewritten in Phase 28,** together with
  `docs/data-model.md`, `docs/data-exposure.md`, `docs/database.md`, `docs/branding.md` and
  `docs/testing.md`. That covers the person/role rule, the profile rule, the guardian rule, TIN on
  `admin_profiles`, the runtime brand and the demo.

---

## Appendix A — where the institute is assumed

Checked on 2026-10-04.

| Where | What |
| --- | --- |
| `apps/api/src/repositories/users.ts:40` | `ROLES_CSV`: roles with no organization |
| `apps/api/src/repositories/users.ts:149` | `getLiveUserById`: re-read every request; also "view as" |
| `apps/api/src/repositories/users.ts:181` | `getUserDetail`: eight unscoped queries |
| `apps/api/src/repositories/users.ts:306`, `:316` | `countGuardians`, `findMissingUserIds` |
| `apps/api/src/repositories/users.ts:343` | `profileCleanupStatements` |
| `apps/api/src/repositories/users.ts:650`, `:666` | `countAdmins` (bootstrap gate); `recordSignIn` (`COALESCE(google_sub, ?)`, never compared) |
| `apps/api/src/repositories/users.ts:717` | `getStudentChargeRates` |
| `apps/api/src/repositories/users.ts:773`, `:810` | `listTutorTaxStatus`, `listTutorsMissingSsn`: no viewer |
| `apps/api/src/lib/scope.ts:35`, `:81`, `:110`, `:133` | `visibleUserIds`, `teachingScopeSql`, `studentScopeSql` (null for admins); `familyStudentIds` |
| `apps/api/src/repositories/payments.ts:21`, `:112` | `scopeFor` (null for admins); `getPayment` unscoped |
| `apps/api/src/repositories/comments.ts:45`, `:142`, `:214`, `:295` | `loadCommentTarget`, `isGuardianOf`, `personScopeSql`, `getComment` |
| `apps/api/src/repositories/sessions.ts:330` | `getSession` unscoped |
| `apps/api/src/repositories/assignments.ts:94`, `:100`, `:120` | `getAssignment`, `getActiveAssignmentFor` (pricing gate), `upsertAssignment` (`ON CONFLICT (tutor_user_id, student_user_id)`, re-read by pair) |
| `apps/api/src/repositories/schedules.ts:72` | `getSchedule` unscoped |
| `apps/api/src/repositories/schedule-cancellations.ts:20`, `:112`, `:138`, `:210` | `NOT_OVERTAKEN_SQL`, `listCancellationsForSchedules`, `listCancellationsForStudents`, `hasLessonOn` |
| `apps/api/src/repositories/progress.ts:33`, `:147`, `:274`, `:526` | `instituteToday`, `getAssessment`, `getPlan`, `buildStudentProgress` |
| `apps/api/src/repositories/balances.ts:47`, `:191`, `:323` | `computeBalances` (guardian query unscoped), `computeTutorPaymentOutlook`, `computeMonthlyFinance` |
| `apps/api/src/repositories/dashboard.ts:28`, `:44`, `:69`, `:126`–`:314` | `reflectionPromptSince`, `teachingActivity`, `progressSpotlight`, `buildAdmin` / `buildTutor` / `buildParent` / `buildStudent` |
| `apps/api/src/repositories/session-reflections.ts:80` | `listRecentReflections`, keyed on the tutor alone |
| `apps/api/src/repositories/active-sessions.ts:87`, `:166` | `listActiveRows` (cron, admin), `resolveTimes` (institute clock) |
| `apps/api/src/lib/live-sessions.ts:88` | `autoStopExpired` |
| `apps/api/src/lib/audit.ts:25` | `recordAudit`: no organization; swallows its own errors |
| `apps/api/src/routes/assignments.ts:33`, `apps/api/src/routes/payments.ts:49` | `assertRoles`, `assertParties` |
| `apps/api/src/middleware/auth.ts:58`, `:82` | `FALLBACK_DEV_EMAIL` (institute domain), `resolveBypassUser` |
| `apps/api/src/index.ts:50` | CORS `allowHeaders: ['Content-Type', 'X-Dev-User']` |
| `apps/api/src/lib/session.ts` | the JWT carries `sub` only |
| `apps/api/src/lib/ics.ts:100`, `:135` | `UID:…@trianglemathinstitute.com`, the institute's `PRODID` |
| `apps/api/src/lib/csv.ts:61` | `datedFilename`; callers pass `tmi-sessions`, `tmi-payments`, `tmi-tax-summary-<year>` |
| `apps/api/src/routes/sessions.ts` | CSV column "Institute cut (USD)" |
| `apps/api/wrangler.jsonc` | `BRAND` (`institute` / `chapel_hill`), one D1 per environment |
| `apps/api/db/demo-admin.sql:10`–`:17` | `INSERT OR REPLACE` into `users`, `user_roles`, `admin_profiles` |
| `packages/shared/src/brand.ts:10`, `:55` | `BRAND_IDS`, `BRANDS`, `resolveBrand` |
| `packages/shared/src/teaching.ts:101`, `:128` | `INSTITUTE_TIME_ZONE`, `zonedClockParts` |
| `packages/shared/src/schedules.ts:249` | `expandUpcoming` on the institute clock |
| `apps/web/src/index.css` | the brand ramp and 48 tokens on the institute's hue; the `data-brand='chapel_hill'` blocks |
| `apps/web/src/components/brand/logo.tsx:16` | `MathMark`; the institute's PNGs chosen by brand id |
| `apps/web/src/components/layout/app-shell.tsx:137` | "TMI Portal" in the phone header |
| `apps/web/src/features/schedules/lesson-cancellation.tsx:45` | `instituteToday` in the UI |
| `apps/web/src/features/dashboard/year-end-panel.tsx`, `form-1099-dialog.tsx` | payer name from `brand.name`; TIN from the signed-in admin's profile |
| `apps/web/public/` | `logo-full.png` (109 KB), `logo-mark.png` (49 KB), `favicon.png`, served by every deployment |
| `scripts/e2e.sh`, `package.json` `demo:reset` | both rebuild the demo's database |
| `e2e/tests/exposure.spec.ts` | crawls the five non-admin personas only |

## Appendix B — what the design review changed

An independent review of the first draft against the code corrected it as follows. All of these
are adopted above.

1. **Scope every query keyed on a person, not just the admin's.** The first draft treated scoping
   as an admin problem. It added the static check and the shared people in the seed.
2. **The release recipe wiped the demo.** This led to the demo-protection step and the
   `demo-admin.sql` fix.
3. **Rollback is not "redeploy the old Worker".** Insert triggers would break it, and it would
   read stale roles. This led to the release order, the re-backfill, `rollback.sql` and the
   rehearsal on a copy of production.
4. **Rename the old tables to `legacy_*`,** so that a missed site fails loudly.
5. **Let the database enforce "same organization":** composite foreign keys, the membership
   triggers, and the update guard.
6. **The assignment upsert could return another organization's row.**
7. **Adding by email leaked accounts and edits across organizations.** This led to invitations
   with acceptance and the shared-field lock.
8. **Membership status and removal must never touch `users.deleted_at`.** The contract keeps its
   shape in Phase 28.
9. **`details_confirmed_at` is per organization;** the audit organization is a required argument;
   the audit backfill is a documented exception.
10. **Phase order.** The picker comes before the platform console. The time zone is fixed until
    Phase 31. The owner is inserted as a platform admin, not bootstrapped.
11. **Logos:** no SVG uploads, `builtin_logo` is set by platform admins only, and the institute's
    calendar domain is permanent.
12. **Carry the organization per request, not in the cookie.** This removes the cookie re-issue
    and the cross-tab problems.

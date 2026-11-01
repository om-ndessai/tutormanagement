# Spaces, one word and one way in (Phases 59-61, plan, 2026-10-30)

**Status: approved by the owner, 2026-10-31; released 2026-11-01, with the terms and privacy version 2026-10-31 the owner approved that day.** Decisions below as the owner answered them. Asked for by the owner on 2026-10-30, as the
clean-up before the AI work:

> The organizations and spaces should be merged. Remove organization references in the UI altogether.
> The math institute is a space and so is Dessai Family. The users join the spaces or they start their
> own new space. The product feature sets are enabled/disabled by space. Users could be part of multiple
> spaces. When they are, the default space selector screen is shown at start. Once the user chooses a
> space, that becomes the last selected space and the user is landed on that space on the next login.
> By default all new spaces are enabled for quest and assessment. When social logins and open joining is
> enabled, when the user logs in for the first time, the user is landed on a screen to either join a
> space by code or creates a new space and invites other users. If the logged in user was invited to a
> space, then the user has to accept it and then can navigate to that space. The user can go to platform
> console and see new invitations for the space or can join new spaces with a code. The user can also
> leave spaces.

Most of the machinery exists already. Phase 52 built space codes, join requests, making a space, leaving
and deleting. Phase 50 built feature sets per space, and Phase 54 built a space's payer record. These
three phases change what people **see**, where they **land**, and what a **new** space starts with.

**No schema change in any of the three.** The code keeps saying `organization`, as it does today.

| Phase | What changes | Requirements |
| --- | --- | --- |
| 59 | One word: spaces. "Organization" leaves every screen, and a space's payer details become the space's own. | S1-S3 |
| 60 | Arriving and choosing: land in the last space chosen, the selector when there is no choice yet, invitations accepted by hand, the Spaces page, leaving from anywhere. | S4-S9 |
| 61 | New spaces and newcomers: Assessment and Quest on from the start, the first sign-in's Welcome, inviting people after starting a space. | S10-S13 |

Each requirement (S1-S13) has acceptance checks below. The test workflow
(`.claude/workflows/spaces-phases.js`, see "How it is tested") verifies each one on the web and in the app.

---

## Phase 59: one word, spaces

### S1. "Organization" leaves every screen

Every visible string that says organization, or "institute" as a generic word, says space instead. That
covers the web, the app, the API's error messages, audit labels and new audit descriptions, the
notification labels, the brand blurb and the tour. The survey of 2026-10-30 found 59 strings and 6
search-keyword lists. Examples:

| Today | After |
| --- | --- |
| "Choose an organization to continue." | "Choose a space to continue." |
| "Someone in this organization already has that email address." | "Someone in this space already has that email address." |
| "The institute at a glance" (tour) | "Your space at a glance" |
| "(institute default)" | "(space default)" |
| "Owns the institute or has admin access." (role) | "Runs the space. Only admins can add people." |
| "Plans, lessons, progress and payments for organizations that teach" | "... for tutors, families and schools" |
| Audit label "Organization created" | "Space created" |

What stays:
- The **code**: `organizations`, `OrgId`, `X-Organization`, `/organization` and `/select-organization`
  (the latter now redirects, see S7), audit action keys such as `organization.created`, and
  `RESERVED_SPACE_WORDS`.
- **Old audit lines.** They were written once and are never rewritten. Only new lines say "space".
- **Proper names**, such as "Mathematics Institute of the Triangle".
- **The terms and privacy text is reworded too** (decision 1, owner): "space" where it means the product's
  space. That is a new version (`packages/shared/src/legal.ts`), drafted in this phase. The owner approves its
  wording before release. Until then the new version is marked draft and production keeps 2026-10-29.

A guard keeps the word from coming back: `scripts/check-ui-words.mjs`, run by `npm run typecheck`, fails
on `organization` or `organisation` in JSX text, in string literals passed to `label`, `title`,
`placeholder`, `message`, `description`, toasts and `ApiError`, and in `AUDIT_ACTIONS` labels. An
`ui-words:` comment marks a deliberate exception. It covers the web, the app, the API and shared.

**Checks:**
- the guard is green;
- a crawl of every web page and every app screen, as each role, finds no "organization" or
  "institute" outside proper names (`spaces-words.spec.ts`; Maestro `spaces/words.yaml`);
- the API's 403 `organization_required` message says "space".

### S2. A space's payer details are the space's own

In Phase 54, "Organization" on screen was a separate record (`businesses`) that a space pointed at.
Every space in production has its own, with the space's id (the backfill), and none is shared. The
seed is the same.

After this phase there is no separate record **on screen**. A space has a **payment model** and, when it
collects payments, its own **payer details**:

- **The console** loses its Organizations tab (web and app). A space's dialog gains **"Who families
  pay"**, with two choices:
  - **"The space"**: it collects payments, pays its tutors and files their 1099s;
  - **"Each tutor, directly"**: today's paid-directly model.

  It also holds the payer details (name on the 1099, TIN, address) while "The space" is chosen.
- **The Space page** (`/organization`) shows the same details to the space's admins, editable as today,
  or "Families pay each tutor directly".
- **Underneath**, `businesses` stays as the storage, one row per space, keyed by the space's id:
  - choosing "The space" links the space's own row (made if missing, restored if archived);
  - choosing "Each tutor, directly" unlinks it, which is the existing `business_cleared`.

  The rules of Phase 54 are unchanged: a switch applies going forward, and recorded rows keep their model.
- **The API:**
  - `PUT /api/platform/organizations/:id/payment-model { model: 'space' | 'direct' }` replaces choosing a
    business;
  - the payer details travel on the space: `PATCH /api/platform/organizations/:id`, and
    `PUT /api/organization/payer` for the space's admins, as today.
  - The old `/api/platform/businesses` routes and `PUT .../business` stay for app builds already on
    phones. They answer as before and are no longer called. A business shared by two spaces is refused
    there (409 `shared_payer`), so none can be made.
- **Audit:** `organization.business_set` / `business_cleared` keep their keys, labelled "Space collects
  payments" and "Families pay tutors directly".

**Checks:**
- the console makes a space either way;
- a switch is logged, and recorded lessons keep their model (the existing `tutor-spaces.spec.ts`, re-pointed);
- the Space page shows the space's own details;
- no screen says "organization";
- `GET /api/platform/businesses` still answers for an older app.

**Before release:** one read-only query against production confirms that no business is linked to two
spaces:
`SELECT business_id, COUNT(*) FROM organizations WHERE business_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1`.
It is expected to return nothing. If it returns a row, stop and report.

### S3. Feature sets are the space's

No change of model, only of words. Platform admins allow each set per space, and a space's admins switch
Assessment and Quest on and off (Phase 50). The console says "This space may use: Tutoring, Assessment,
Quest". The Space page's cards say "Assessment in this space" and "Quest in this space".

**Checks:** the existing `features.spec.ts` (re-worded), and the console's toggles in the app.

---

## Phase 60: arriving and choosing

### S4. Land in the last space chosen

**The landing rule**, for a tab or the app arriving with no space of its own, in this order:
1. **a link** naming a space (`?org=`, a calendar or share link): that space, if they may enter it;
2. **the last space they chose**, if they may still enter it. It is kept on the server, so it holds on
   every device, web and app alike;
3. **exactly one space** they may enter, and nothing pending: that space, which becomes their last choice;
4. **otherwise the selector** (S5).

The address's `DEFAULT_ORGANIZATION` brands the sign-in page only, as today. It no longer decides where a
known person lands (decision 2).

**"Last chosen" is `org_members.is_default`**, which already allows one per person
(`org_members_one_default`). Its meaning changes from "starred" to "the last space opened":
- `POST /api/auth/enter` (called whenever a tab or the app opens a space: the selector, the switcher, the
  Spaces page, a link) moves it to that space. That is two writes when it moves and none when it doesn't.
- **No separate audit line.** Opening a space is already logged once per sign-in (`auth.entered`), and
  the move is part of that act.
- **The star goes**, from the picker, the switcher and the app.
- **Older apps:** `PUT /api/auth/default-organization` keeps working and sets the same column, so an older
  build's star still means "land here".
- The `tmi_last_org` cookie and the app's `tmi.lastOrg` remain only as the tab's or app's own memory
  between reloads. The server's choice outranks them for an arriving tab.

**Checks:**
- in A and B, choose B; sign out; sign in: B. Then switch to A in the switcher, sign out, sign in: A;
- the same in the app;
- across clients: choose B on the web, then sign in on the app: B;
- the last space removed or suspended: the selector, or the single remaining space;
- a link to A while the last choice is B: A, and A becomes the last choice.

### S5. The selector

When rule 4 applies, a full-screen "Choose a space" lists:
- the spaces they may enter, each with its mark and the person's roles there;
- invitations waiting;
- requests sent.

Choosing a space enters it, and that space becomes the last choice. There is no star. It is the Spaces
page (S7) shown without the portal's frame.

**Checks:** shown with two or more spaces and no last choice; never shown with one space and nothing
pending; shown for a person with only an invitation.

### S6. An invitation is accepted by hand, then entered

**Today,** a first sign-in accepts a console space's invitations by itself (`recordSignIn`, Phase 51). **That
stays** (decision 3, owner): a person the institute (or any console space) adds walks straight in on their first
sign-in. Every other invitation waits for the person's Accept: a self-serve space's, and any invitation reaching
someone who has signed in before.

- **Accept** (`POST /api/auth/invitations/:slug/accept`, unchanged) enters that space at once. It becomes
  the last choice, and the welcome tour runs as for any first visit.
- **Decline** removes the invitation, as today.
- **Already in a space?** A person who is somewhere already still lands by S4. Meanwhile:
  - a banner across the top of the portal (web) and the Home screen (app) reads "<space> invited you",
    with **Accept** and **Not now**;
  - the switcher carries a count;
  - the Spaces page lists the invitation.

  "Not now" hides the banner for that tab or app session only.
- **Masking.** The inviting space still sees only the name it typed until acceptance (`invited_name`,
  Phase 51), unchanged.

**Checks:**
- a new tutor added by the institute signs in for the first time and lands in the institute, without an Accept;
- a newcomer invited to a self-serve space signs in for the first time: the selector, with the invitation and
  nothing entered; Accept lands them there;
- someone who has signed in before, invited by the institute: the invitation waits for Accept;
- someone in A, invited to B, signs in: A, with the banner; Accept enters B;
- Decline: gone, and B's admins see the invitation withdrawn;
- `requireOrg` still refuses an invited (unaccepted) member.

### S7. The Spaces page: the person's own console

`/spaces` on the web and **Spaces** in the app hold everything about the person's spaces, outside any one
space. It is reached from:
- the switcher ("All spaces"), always shown, even with one space;
- the user menu, and the app's Account screen;
- the selector, which is this page without the frame.

`/select-organization` redirects to it.

It has the following sections:
- **Your spaces:** Open, and Leave (S8).
- **Invitations:** Accept and Decline (S6).
- **Join with a code:** the Phase 52 lookup and request. The request appears under **Requests sent**,
  where it can be withdrawn.
- **Start a space:** the Phase 52 form (adults), then Phase 61's invite step.
- **Platform console:** a link, for platform admins only. The console itself stays platform admins'
  (decision 4).
- **Delete my account:** only when they belong nowhere and have nothing open, as today.

It reads `GET /api/auth/session` (memberships, invitations, requests), which is the person's own and
nothing else, so it needs no new read route.

**Checks:**
- reachable from inside a space with one membership (today's gap on the web);
- every section works on both clients;
- the exposure crawl calls it as every persona, and it shows only the person's own memberships.

### S8. Leaving a space, from anywhere

`POST /api/spaces/:slug/leave` sits outside `requireOrg`, beside the join routes. It acts on the person's
own membership in that space:
- **the last admin** is refused (409 `last_admin`, as today);
- **otherwise** it does what `POST /api/organization/leave` does (membership removed, profiles cleaned up,
  logged in that space), and that route stays for older apps;
- **leaving the space they are in** sends them to the landing rule: their other space, or the selector,
  or Welcome if none is left.

**Checks:**
- leave B from the Spaces page while inside A: A carries on, and B is gone from the switcher;
- leave the current space;
- the last admin is refused, with the reason on screen;
- leave the only space: Welcome, where they can delete their account.

### S9. What this phase does not change

- **Join requests:** still answered by the space's admins (Phase 52, decision 1). A code does not let
  anyone in by itself.
- **Per-tab spaces on the web:** two tabs may still sit in two spaces. The landing rule decides only an
  arriving tab. A reload or full navigation of a tab already in its space is not an opening: the web
  sends `POST /api/auth/enter` with `{ "opened": false }`, which logs and answers as ever but leaves the
  last choice where another tab put it. No body (older clients, the app) means an opening.
- **The cookie, `X-Organization` and `requireOrg`:** unchanged.

---

## Phase 61: new spaces and newcomers

### S10. A new space has Assessment and Quest on

Every space made from now on, whether by a newcomer (`POST /api/spaces`) or in the console, starts with:
- **Assessment allowed and switched on** (`feature_assessment = 1`, `canvas_assessments = 1`);
- **Quest allowed and switched on** (`feature_quest = 1`, `gamify_question_quest = 1`).

Tutoring is the console's to allow, as today (a newcomer's space has none). A self-serve space stays
**untrusted** for Quest: a tutor's "question is right" is a suggestion for the console, and its answers
don't count towards two right answers (Phase 51).

Existing spaces keep their switches; nothing is restated.

**Checks:**
- a newcomer's new space shows the Assessment menu and Quest;
- an admin of that space sets a student's Quest level, and the student plays;
- a console space made with defaults has both on;
- an existing space is unchanged.

### S11. The first sign-in: join or start

With sign-up open (`SIGNUP_OPEN`) and any of the offered providers (Google, Microsoft, Facebook; Apple
later), an unknown person:
1. **About you:** goes through it as today (age band, terms).
2. **Welcome**, with two choices side by side:
   - **Join with a code:** type it, see the space's name and mark, then Ask to join. They wait on Welcome,
     where they can withdraw.
   - **Start a space:** name it (adults only), then S12.
3. **An invited person** is not unknown: the invitation's email matches. They skip both steps and see the
   selector with their invitation (S6).

With sign-up closed, an unknown account is refused as today.

**Checks:**
- an adult with each fake provider (`AUTH_FAKE_PROVIDERS`) reaches Welcome, starts a space, and lands in it;
- a 13-17 sees only "Join with a code";
- with sign-up closed, they are refused;
- an invited person never sees About you or Welcome.

### S12. Start a space, then invite people

After naming the space, a step **"Invite people"** comes before the welcome tour:
- **Rows** of email and role:
  - Admin;
  - Parent;
  - Tutor, only where Tutoring is allowed, so not in a newcomer's space.

  Each row is the ordinary add-person request (`POST /api/users`). An existing person gets an
  invitation that they accept (S6). A new email makes the person, invited, who signs in later and finds
  it waiting.
- **Students:** added as today, in the welcome wizard's "Add a student", which keeps the guardian and
  consent rules (Phase 52).
- **Telling them:** a self-serve space sends no email (Phase 51). So the step offers **Copy invitation**
  and **Share** (the system share sheet in the app). The text: "<name> invited you to <space> on Aimtrue.
  Sign in at <address> with <email>." The space's code card is shown too.
- **Skip** goes on to the tour. The same rows are always available from People → Add person.
- **Limits:** the existing per-minute limit and the daily cap on adding people apply (`DAILY_CAPS`).

**Checks:**
- start a space and invite an adult by email;
- that person signs in, accepts, and lands there with their role;
- inviting someone who exists elsewhere shows only the typed name until they accept;
- the tutor role is not offered in a newcomer's space;
- skipping works.

### S13. Exposure and older clients

**Exposure** (R21, extended, `docs/data-exposure.md`):
- the Spaces page and the banner read only the person's own memberships, invitations and requests;
- leaving reveals nothing about the space left;
- an invitation still shows the inviter only the typed name.

These are crawled by `exposure-spaces.spec.ts`.

**Older clients** (`compat-clients.spec.ts`):
- an app built before Phase 60 still signs in, its star still sets the landing, and its leave route still
  works;
- `POST /api/auth/google` without `signup: true` still gets 403 for an unknown account.

---

## Seed

- **A person in two spaces with no last choice.** The seed sets `is_default` for nobody else who is in
  several.
- **An existing person invited to a second space**, and **a new person invited by email** who has never
  signed in.
- **A console space made after the change**, with Assessment and Quest on.
- **The seed's businesses:** one per space with the space's id, as today.

## Tests

| Requirement | Web (Playwright, `e2e/tests/`) | App (Maestro, `apps/mobile/.maestro/flows/spaces/`) |
| --- | --- | --- |
| S1 | `spaces-words.spec.ts` (crawl), the guard script | `words.yaml` |
| S2 | `tutor-spaces.spec.ts` (re-pointed), `platform.spec.ts` | `console-payment.yaml` |
| S3 | `features.spec.ts` | `platform/*` (re-worded) |
| S4 | `spaces-landing.spec.ts` | `landing.yaml` |
| S5 | `spaces-landing.spec.ts` | `selector.yaml` |
| S6 | `spaces-invitations.spec.ts` | `invitation.yaml` (moved from `organizations/`) |
| S7 | `spaces-page.spec.ts` | `spaces-page.yaml` |
| S8 | `spaces-leave.spec.ts` | `leave.yaml` |
| S10 | `spaces-defaults.spec.ts` | `new-space-quest.yaml` |
| S11 | `spaces-welcome.spec.ts` (each fake provider) | `sign-up.yaml`, `join.yaml` |
| S12 | `spaces-invite.spec.ts` | `invite.yaml` |
| S13 | `exposure-spaces.spec.ts`, `compat-clients.spec.ts` | n/a |

- **Changed by these phases:** `default-organization.spec.ts` (the star goes; its cases move to
  `spaces-landing.spec.ts`), `organizations.spec.ts`, `spaces.spec.ts:58`, `features.spec.ts:16`, and the
  Maestro flows `organizations/picker.yaml` and `invitation.yaml`.
- **Jest:** for the app's landing (`decideLanding`), the banner and the invite rows.
- **Smoke** joins the main path: sign in and land, the Spaces page, start a space then invite.
- **Gates:** the full local suite, `npm run smoke` on both platforms, `test:compat` against the last
  `release-*` tag, and `npm run typecheck` with the new guard.

## How it is tested: the workflow

`.claude/workflows/spaces-phases.js` builds and verifies the three phases. It runs locally only and never
deploys.
1. **Build:** for each phase in turn, an agent builds the API, shared and web half. Then a
   `mobile-developer` agent builds the app half, to parity. Each finishes with typecheck green and its own
   specs passing.
2. **Write tests:** one agent per requirement, in parallel, each into its own files (the table above), from
   the acceptance checks here.
3. **Run:** one agent runs everything serially, on one local Worker, one simulator and one emulator. It
   sorts each failure into "the test is wrong" or "the product is wrong".
4. **Fix:** one agent per failing requirement, one at a time, then a re-run. This repeats up to three
   rounds.
5. **Break it:** two adversarial agents per requirement try to find a case that fails: other personas,
   older clients, exposure, the edges of the landing rule. Every confirmed case becomes a test, then goes
   back to Fix.
6. **Gate:** a final agent runs the full local suite, smoke on both platforms, `test:compat` and typecheck,
   and checks every requirement S1-S13 against a passing test. Anything left uncovered is reported.

The release then follows `CLAUDE.md`, by hand:
- tag;
- the demo;
- the backup;
- the read-only shared-payer check (S2);
- both production Workers;
- the smoke of both addresses;
- the app on the phones when asked.

## Decisions (proposed: the owner confirms or changes them)

1. **The terms and privacy text is reworded** (owner): a new version, 2026-10-31, approved by the owner on 2026-11-01. A sign-up still accepts 2026-10-29, which app builds on phones send.
2. **`DEFAULT_ORGANIZATION` brands the sign-in page only** (owner). A known person signing in at the
   institute's address lands in their own last space.
3. **A console space's invitations stay automatic on a first sign-in** (owner). Every other invitation is
   accepted by hand.
4. **"Platform console" for everyone is the Spaces page.** The real console stays platform admins'.
5. **Payer records stay one per space**, never shared again. Phase 54's "several spaces may share one" is
   withdrawn; no space in production shares one.
6. **"Last space chosen" is the last one opened**, on any device. Opening a space in a second tab moves it.

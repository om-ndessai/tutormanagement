# Phases 79-80: members, and approved into a space (2026-11-06)

The owner (2026-11-06): "I am not satisfied as the amount of time and setup it takes to join a quest is quite high.
I think that is likely from the users and roles rules setup primarily when this platform was built for tutoring only.
Now that I want the users to be able to get faster in quest and/or assessment those roles need to be extended."
Approved with the decisions below on 2026-11-06; built on `main` after Phases 66-78 reached production
(`release-20261106`).

## Context

Joining a quest takes too long. The people model was built for tutoring: everyone in a space holds one of four roles
(admin, tutor, student, parent), and each role brings its own setup. Today a newcomer:
1. waits for approval, and meanwhile gets a personal space they may never use;
2. then has to ask to join the real space with its code, and wait again;
3. then the space's admin fills in a role form. A learner can't even be let in without a parent already in the space.

The owner asked for four changes (2026-11-06):
1. A person may be in a space with **no role: a member**. Every role keeps its rules: a student still needs a parent or
   guardian in the space, tutor only where Tutoring is allowed, and an email for anyone but a student-only.
2. The Pre-approved and Post-approved gate stays. But **the approver may place the person in a space** while approving.
   They land there, and are **offered** a personal space rather than given one.
3. **Adding anyone is one step: their email.** Phone comes later, with phone sign-in. Roles come later, under today's
   rules.
4. A space losing a feature set changes no roles.

**Owner's decisions (2026-11-06):**
- Teens (13-17 who signed up themselves) may be members, with no parent in the space.
- Members play Quest only. There is no self-assessment in shared spaces, and Question Quest stays student-only.
- Placement: a **console-made space takes the person at once**. A **self-started space gets a join request filed for
  them**, which its admins answer with one tap.
- **Start at once** when the other session ends.

**Already in place:**
- The database and `requireOrg` accept a member with zero roles. The console's remove-admin route already makes them.
- Quest Games, tiles, the Daily and the habit layer check only membership and the Quest set.
- The blockers are the shared `.min(1)` on roles (`packages/shared/src/users.ts:104-108`) and screens that assume a role.

## Way of working

- Started once the session that released Phases 66-78 had ended, on `main` synced with `origin/main`. Production was
  at `release-20261106`, the `test:compat` base.
- Web and app together (parity), with parallel agents on disjoint files; test runs one at a time (they share the local
  D1). The app half follows the `mobile-architect`, `mobile-developer` and `mobile-tester` skills.
- Hourly status to the owner.

## Phase 79: members (no schema change)

**M1. A member, in shared.** In `users.ts`:
- Drop `.min(1)`, but keep the dedupe.
- `requiresEmail` becomes `roles.length === 0 || roles.some(r => r !== 'student')`, because a member signs in.
- Add `MEMBER_LABEL` ("Member").
- Add `rolesLabel(roles)`: the labels, or "Member".
- Add `rolesInWords(roles)`: the codes exactly as today's audit lines print them, or "a member".
- Fix the comments that say "at least one role".
- `listUsersQuerySchema.role` also takes `'member'`.

**M2. API rules** (`apps/api/src/routes/users.ts`, `repositories/users.ts`):
- POST and PATCH accept `[]`. All existing rules are unchanged.
- **New guard:** PATCH refuses to take away the space's last active admin, by dropping the role or by suspending. It
  answers 409 `last_admin`, using `countAdmins` with the leave-space wording.
- Audit lines use `rolesInWords`. Emptying a person's roles reads "Made X a member, with no role".
- The dashboard's 409 stays, for deep links, reworded to "…is a member here".
- `listUsers` gains a member filter (no `user_roles` row).

**M3. One step: their email** (shared `add-people.ts`, `spaces.ts`):
- `addChoices`: "Invite by email" becomes **"Anyone, by email"** ("Just their email. They join as a member; give them
  a role whenever you like."). The full form becomes "Someone, with details".
- `SPACE_INVITE_ROLES` gains `'member'`, first and the default, with its own `SPACE_INVITE_ROLE_LABELS`.
  `inviteRowRequest` maps `'member'` to `roles: []`.
- The name stays optional. The status stays `invited`: the person accepts at sign-in, and the R21/R32 masking is
  unchanged.
- The same rows serve the start-a-space invite step: web and app `features/organizations/invite-people.tsx`, and the
  web `add-person.tsx` / app `add-chooser.tsx`.
- Phone joins this one field later. It is not built now.

**M4. Their own name, safely:**
- `createUser`'s new-address path also writes `invited_name` (it writes only `invited_by` today), so masking holds until
  the person accepts.
- At a first sign-in, when `users.full_name` still equals `nameFromEmail(email)` and the provider gave a name, take the
  provider's name. This applies only to people with no platform account.
- `completeSignIn` passes `identity.name` to `recordSignIn` (`repositories/people.ts:235`). No extra read.

**M5. Let in as a member** (web `features/users/let-in-sheet.tsx`, app `let-in-model.ts` / `let-in-sheet.tsx`):
- Member is a choice, and the default when the person asked as a learner or named no role. Parent, Admin and Tutor work
  as today.
- The line "A learner joins with their parent: use the full form" goes. The full form stays for a student with a parent.
- `JoinRequest` gains `teen`, read by admins only (R32 extended), so the sheet hides Admin.
- **The API refuses admin for a 13-17** in three places:
  - at let-in (`openJoinRequest` returns the band);
  - on a PATCH that adds admin in a non-personal space;
  - when a teen accepts an admin invitation: they join without admin, and the log says so.
- `JOIN_REQUEST_ROLES` and their database CHECK are unchanged.

**M6. What a member sees:**
- **Menu and tabs.** A new `seesTeachingPages(roles)` (roles non-empty) hides Dashboard, Lessons, Progress, Schedule,
  Comments and Assessment. This covers the web `app-shell.tsx` NAV_ITEMS (and through it the command palette), the app
  `shell/nav-items.ts`, and the app `app-tab-bar.tsx` `visibleTabs` with its callers.
- **Home.** The home is the learner hat (Quest board, Daily, games, Have a code), which needs no change. The home's
  Assessment section and an assessment-led focus now require `may_assess`, computed before `homeFocusOptions` in
  `repositories/member-home.ts`. This touches web `member-home.tsx` and app `home-sections.tsx` / `assessment-home.tsx`.
- **Assessment page.** Reached by a link, it says in one line: "Assessments here are for students."
- **Tour.** No wizard or tour for a member: `tourOffered(org, roles)` returns false for `[]`, in shared
  `onboarding.ts` and both onboarding providers.
- **Role lines fall back to `rolesLabel`:**
  - web: user-menu, org-switcher, spaces-page, command-palette, user-picker and user-badges;
  - app: account, spaces-model, search-screen, user-picker, user-badges and user-card.
- **Pickers.** The view-as picker leaves members out. People gets a "Members" filter.

**M7. Roles later, today's rules.**
- An admin gives roles in People: a student needs a guardian (plus consent in a self-serve space) and an email rule
  applies; tutor needs Tutoring.
- A space losing a set keeps its roles. This is already true, because `assertTutoringAllowed` refuses only a newly added
  tutor and `RoleSelector` shows a held role that is otherwise hidden. A test will pin it.
- A parent made a member keeps their guardianships, as today when the parent role is dropped.

**M8. Sharing names** (`routes/shares.ts:61`): a person with no platform account and no non-student role shares without
a name, which matches `mayMakeSpace` (unchanged: a member does not vouch for being an adult).

**M9. Exposure and docs:**
- `docs/data-exposure.md` gets **R36**: a member reads only their own games, Daily and habit, sees only themselves plus
  any guardianship links, and appears to others as a first name in games and rosters (R27). The who-sees-what table gets
  a Member column.
- `docs/data-model.md` (rule 4, `user_roles`) and CLAUDE.md's people-model and email paragraphs are updated.

## Phase 80: approved into a space (schema block `release=phase-80`)

**Schema** (in `schema.sql` and `docs/database.md`):

```sql
ALTER TABLE platform_accounts ADD COLUMN personal_offer TEXT CHECK (personal_offer IN ('open','declined','made'));
```

**A10.** Under Post-approved, `POST /api/auth/signup` makes **no** personal space (`auth.ts:951-976`). Open and
Pre-approved are unchanged. This ships with A11, never alone.

**A11. Approve with an optional place.** `accessDecisionSchema` (shared `access.ts`) gains
`space?: { organization_id, role: 'member' | 'admin' }`. The work is in `routes/platform.ts:917-937` plus a new
`approveAccount` in `repositories/access.ts`, run as one batch, with `org-scope:` comments.

- **A console-made space:**
  - An active membership at once, with no acceptance step. A membership the space removed is never revived (409, in
    words).
  - Admin only if chosen, never for a 13-17.
  - `is_default` moves to it.
  - Logged `organization.member_added` in that space's log (the console's log lists `organization.%`), and
    `platform.access_approved` names the space.
- **A self-started space:** a join request is filed for them (`createJoinRequest`, role NULL, so Let in starts on
  Member), logged `membership.requested` in that space's log ("put forward when their account was approved").
- **Either way:**
  - `personal_offer = 'open'`.
  - A personal space made at sign-up before this release is purged, but only while the account was still pending. It
    never had a session, so it was never used. This uses `soleMemberPersonalSpaces` + `purgeSpace`, and is logged.
- **No place:** if they belong to no space, their personal space is made then (`createSpace` personal, teen flag,
  default; `account.personal_space` "made when their account was approved").
- **When a place applies:** only on the change to approved. Otherwise 409, "Already approved: add them from the space's
  People."
- **The picker's query** is lean: live, non-personal spaces with id, name, how each was made, and its sets. It does not
  use `listOrganizations` and its per-space counts.

**A12. The offer.**
- **Session.** It gains `personal_space_offer`: true while the offer is 'open' and they have no personal space. One
  primary-key read; not added to `getPlatformAccount`.
- **Home card** (web `features/home/personal-offer-card.tsx` in `member-home.tsx`, and the app's in
  `member-home-screen.tsx`): "You're in <space>. Want a space of your own too?", with **Make my space** and **No thanks**.
- **Route.** `POST /api/spaces/personal { make }` lives in `routes/spaces.ts`, behind `requireAuth` and outside
  `requireOrg`, and is rate-limited.
  - `make: true`: a compare-and-set to 'made' (409 on a second try), then `createSpace` personal with the teen flag,
    logged.
  - `make: false`: sets 'declined', with no log line, since it is a preference.
- **Spaces page and Welcome** show "Make my own space" to any platform account without one. It is a teen's only door.

**A13. Landing.**
- Someone placed in a console space lands there.
- Someone with only a request lands on Spaces, with the request waiting and "Make my own space".
- `completeSignIn`'s 403 `no_account` (`auth.ts:388-396`) no longer refuses an approved self-signed-up account in no
  space where the Worker takes sign-ups. Those people reach Welcome. `tmi-portal` is unchanged.

**A14. A self-signed-up person's name, email and phone are their own.** A space's admins get 409
`shared_fields_locked` when editing them, as for someone in two spaces.

Placement makes self sign-ups single-space members. Today `belongsElsewhere` ignores the personal space, so an admin
there could change such a person's email, and with sign-in linking by email, take over the account. This closes that.

**A15. Console, both clients.**
- **Where:** web `features/platform/access-section.tsx` (Waiting and Decided) and app
  `features/platform/access-settings-section.tsx`.
- **The sheet:** Approve opens a sheet with an optional space picker and Member or Admin. Admin is offered only for a
  console space, and hidden for teens.
- **What the sheet says:** "joins at once" or "its admins are asked to let them in". It warns when Quest is off there.
- **Docs:** `docs/access-approval-plan.md` gets A10-A15. CLAUDE.md's Phase 63 and Phase 65 paragraphs are updated.

## Tests

**Phase 79**

*Web specs:*
- `user-form.spec.ts`: someone saved with no role becomes a member, and email is required.
- `journey-fixes-75-76*.spec.ts`: the chooser's new words.
- `spaces-invite.spec.ts`: Member is the default row; accepting with `[]`; a new address keeps the typed name until it
  accepts, then takes the provider's name (fake provider token).
- `spaces.spec.ts`: let in as a member; a teen's request refuses and hides Admin.
- `features.spec.ts`: a tutor keeps the role through edits after Tutoring is disallowed.
- `member-home.spec.ts`, `onboarding.spec.ts`, `canvas-assessments.spec.ts` (404 and the one line), `quest.spec.ts`
  (Question Quest 403), `sharing.spec.ts`, `roles.spec.ts` and `responsive.spec.ts`.
- `exposure.spec.ts` crawls an API-made member. It stays `@smoke`, and is compat-safe because it doesn't rely on a
  seeded row.
- A new `members.spec.ts`: `last_admin` on role and on suspension, "as a member" in the log, and the Members filter.
- `compat-clients.spec.ts`: older bodies with `roles: [role]`.

*Maestro:* `people/add-chooser`, `spaces/invite`, `spaces/let-in` (plus a teen variant), `shell/navigation`,
`exposure/narrow-audiences`, and a new `home/member-home-member`.

*Jest (`npm run mobile:test`, which also covers shared):* `shared-contract`, `let-in-sheet`, `add-chooser`,
`invite-people`, `app-tab-bar`, `create-actions`, `member-home-model` and `onboarding-model`.

**Phase 80**

*Web specs:*
- `access.spec.ts`:
  - a Post-approved sign-up has no space;
  - approving with no place makes exactly one personal space;
  - approving into a console space gives an active membership, the default and the offer;
  - approving into a self-started space files a request and lands on Spaces;
  - teen-as-admin is refused;
  - a second approval is refused;
  - the sheet.
- A new `personal-offer.spec.ts`: make, no thanks, then "Make my own space"; a double make gets 409; a teen's space has no
  code.
- `spaces-landing.spec.ts`, `platform.spec.ts` (the picker leaves out personal and archived spaces),
  `exposure-spaces.spec.ts` (the offer acts only on one's own account) and `users` (A14's lock).
- `compat-clients.spec.ts`: an older console's `{ access }` still makes a personal space.
- The purge path uses a seeded pending account and stays out of `@smoke`.

*Maestro:* `platform/access`, `spaces/sign-up`, `spaces/spaces-page`, and a home flow for the offer card.

*Jest:* the approve-sheet model and when the offer card shows.

## Release (approval of this plan covers it, per the rulebook)

**Per phase:**
1. `npm run typecheck` (with the words, scope and purge checks), `npm run mobile:test`, the touched specs and flows.
2. `npm run smoke` on web, iOS and Android.
3. Commit and push to `main`.

**Then, once both phases are built:**
1. The full local suite: `db:reset`, `dev`, `E2E_BASE_URL=http://localhost:5173 npm run e2e:test`.
2. `npm run smoke -- mobile`, then `npm run test:compat` against `release-20261106`.
3. `RELEASE_PHASE` becomes 80. Commit, push and tag `release-YYYYMMDD`.
4. **The test side:**
   - **Apply the phase-80 block to `tutoring-test-db` by hand, BEFORE `npm run deploy:test`.** The new Worker reads the
     column on every session. Doing it by hand keeps the demo's data.
   - Run `seed:scenarios` only if a new flow needs it.
   - `npm run mobile:devices -- test`.
5. **Production:**
   - Back up `tutoring-db` to `~/tmi-portal-backups/`.
   - Apply the phase-80 block (`--file … --yes`) and check the new queries read-only.
   - `npm run deploy`, then smoke-test both addresses.
   - `npm run mobile:devices -- personal`. The last run failed because Xcode had no Apple account signed in; if it fails
     again, I report it rather than retry.
6. Stop and report if any step fails.

**Older app builds degrade, but nothing crashes.** They can't save a member's edits (their bundle keeps `.min(1)`), they
have no Member in Let in, and to a member they still show Lessons and Progress plus a 409 Dashboard. This is noted in
`parity.md`.

## Not in this plan

- A Pre-approved list entry naming a space (same code path; an easy follow-up).
- Phone sign-in.
- Self-assessment for members (the owner chose Quest only).
- A last-admin guard on the console's remove-admin route (an existing power of platform admins).
- Changes to whether a teen may hold the parent or tutor role.

## Verification (end to end, locally)

1. **One-step add and let-in.** A self-serve admin adds `x@example.com` with "Anyone, by email", tapping only Invite.
   The person signs in (fake provider), accepts and lands on the Quest board, with no Lessons, Assessment or Dashboard in
   the menu. They join a game by code. The admin then makes them a student: refused without a guardian. A parent: saved.
   A teen's request: Let in as Member in one tap, and Admin is not offered.
2. **Approval into a console space.** In the console, under Post-approved, sign up a new account: no space is made.
   Approve it into CHMI as a member. At sign-in they land in CHMI and see the offer card. "No thanks" means no personal
   space; "Make my own space" on Spaces makes exactly one.
3. **Approval into a self-started space.** Approving into a self-started space files a request that its admin answers
   with Let in (Member by default). Approving with no place makes the personal space, as today.
4. **Each phase is green** on `npm run typecheck`, `npm run smoke` (web, iOS, Android) and the docs/data-model "students
   missing a parent" audit query.

# Phases 81-82: fewer, deliberate spaces -- a per-person limit, the console's People, and curricula set per space (2026-11-07)

The owner (2026-11-07): "This phase is about limiting number of spaces or avoiding unnecessary spaces. By default non
platform admin is only allowed to create one space. When approving new users to the platform, the platform admin will
set ability for the user to create their personal space. By default it will be enabled. The people screen at the
platform console needs upgrade. Show latest 20 users on the screen with number of spaces they are part of. The platform
admin can set how many total spaces the user is allowed to create. In platform console in spaces section the platform
admin can specify what the curriculum are offered and what they are labeled in that space. By default only nc 2026
math is offered in each space. By default any new spaces that get created beast academy is referred to as advanced
math, and drop AOPS from the curriculum name. When a user creates a new space these are the curriculum names the users
in that space see."

Approved with the decisions below on 2026-11-07; built on `main` after Phases 79-80 reached production
(`release-20261107`). The plan was reviewed against the code before approval (the race-free limit, the offer and the
limit, the admins' save never undoing a withdrawal, NC 2026 locked on, the three name sources).

## Context

The owner wants fewer spaces that nobody uses, and the platform deciding what a new space teaches and calls it
(2026-11-07). Today:
- any adult may make up to 3 shared spaces (`DAILY_CAPS.spaces_per_person`, checked only by `POST /api/spaces`), plus a
  personal space that never counts;
- the console cannot see who has joined the platform: its People tab only finds one person by exact email;
- a new space starts on Beast Academy (`DEFAULT_CURRICULUM_ID = 'ba'`), its own admins may offer any curriculum, and
  Beast Academy's levels read "Beast Academy Level 3" and "AoPS Prealgebra" everywhere.

**Owner's decisions (2026-11-07):**
- **One space in total** by default, for anyone who is not a platform admin: the personal space counts.
- **At approval** the platform admin says whether the person may make a space of their own; on by default.
- **The console's People** lists the latest 20 people **with an email** (never a child with none) and the spaces each is
  part of; the platform admin sets how many spaces each person may make.
- **Curricula: the console allows, the space's admins narrow.** The console sets which curricula a space may use and
  what each is called there; the space's admins may switch off any of those and pick the default, but not add one.
- **New spaces only** (personal ones included) get the new defaults: NC Math 2026 alone; Beast Academy, once allowed,
  called "Advanced Math", with "AoPS" dropped from its level names. Existing spaces keep theirs.

## Way of working

1. Copy this plan into `docs/space-limits-plan.md` (N1-N8, C1-C8, R37); `docs/plan.md` gets Phases 81-82
   ("requested 2026-11-07"); `docs/mobile/parity.md` gets their rows. Commit.
2. Shared contract first (me), then three agents in parallel per phase: API, web, app (`mobile-architect`,
   `mobile-developer`, `mobile-tester` skills). Tests serialized (Playwright, then Maestro: Maestro resets the DB).
3. Hourly status as before.

## Phase 81: one space each, and the console's People (schema block `release=phase-81`)

**N1. The rule, in shared** (`packages/shared/src/limits.ts`, `spaces.ts`):
- `DEFAULT_SPACE_ALLOWANCE = 1` replaces `DAILY_CAPS.spaces_per_person` (3).
- A person's spaces made = live, non-archived `organizations` with `created_by_user_id` = them, **personal included**
  (`countSpacesMadeBy` drops `AND personal = 0`). Deleting one frees its place, as today. Joining, being invited or being
  placed never counts. Console-made spaces have no maker and never count.
- `SpaceAllowance { allowed: number | null; made: number; personal_space: boolean }` (`allowed` null = no limit, for
  platform admins). `spacesLeft(allowance)`; `mayMakeSpace` and `mayMakeOwnSpace` take it (adult rule unchanged).
- `SessionResponse.space_allowance?` (absent from older Workers: the clients behave as today and the server refuses).

**N2. Schema** (`schema.sql` + `docs/database.md`):
```sql
ALTER TABLE platform_accounts ADD COLUMN personal_space_allowed INTEGER CHECK (personal_space_allowed IN (0, 1));
CREATE TABLE space_allowances (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  spaces_allowed INTEGER NOT NULL CHECK (spaces_allowed BETWEEN 0 AND 50),
  set_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  set_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX users_recent_idx ON users (created_at DESC, id DESC) WHERE deleted_at IS NULL AND email IS NOT NULL;
```
NULL `personal_space_allowed` = allowed (every account from before). A missing `space_allowances` row = the default.
The table holds the platform's decision about a person, for self sign-ups and people a space added alike (the latter have
no `platform_accounts` row); `deleteOwnAccount` clears it.

**N3. Enforced on every path a person makes a space, race-free:**
- **The guard lives in `createSpace`'s batch** (`repositories/organizations.ts`), which every self-made space goes
  through, personal ones included (console spaces use `createOrganization` and never count). Its first statement becomes
  `INSERT INTO organizations (...) SELECT ... WHERE <maker is a platform admin> OR (spaces made by the maker) <
  COALESCE(their space_allowances row, 1)` (and, for a personal space, `personal_space_allowed IS NOT 0`); the batch's
  other inserts are `INSERT ... SELECT ... WHERE EXISTS (the new organization)`. D1 runs a batch as one transaction, so two
  requests cannot both pass. No row inserted -> the 429 (never a 500: not through the slug-retry loop).
- The bypass tests the **maker**, not the caller (at approval the caller is a platform admin).
- `assertMayMakeSpace(db, maker, { personal })` runs first only to pick the words: 403 when their own space is switched
  off, else **429 `rate_limited`** as today (both clients show its message calmly), worded with `countOf`: "You can make
  1 space, and you have. The platform can allow more."
- Paths: `POST /api/spaces`; `POST /api/spaces/personal` (`releasePersonalSpace` already puts the offer back on a
  throw); sign-up's personal space (Open, Pre-approved); approval's no-place personal space (only when the switch is on
  and there is room; otherwise none, and the person reaches Welcome).
- Existing people over the new limit keep every space; they just cannot make another.

**N4. Approval says whether they may make their own space** (`accessDecisionSchema.personal_space?: boolean`, default
true, so an older console's `{ access }` behaves as today):
- Stored as `platform_accounts.personal_space_allowed` in the decision's own UPDATE (`decideAccess`, `approveAccount`),
  on approval only.
- Off: no personal space at a no-place approval, no offer when placed, and Spaces/Welcome hide "Make my own space".
- **The offer respects the limit everywhere:** at approval `offer = personal_space && (made - unused pre-Phase-80
  spaces about to go) < allowed`; `personalSpaceOffered` (the session's `personal_space_offer`, which older apps read
  alone) adds `personal_space_allowed IS NOT 0 AND made < allowed`, so someone who used their one on Start a space stops
  seeing the card; `claimPersonalSpace` adds `personal_space_allowed IS NOT 0`.
- Switching it back on later (People, N5) brings back the "Make my own space" door on Spaces/Welcome, not the home card.
- The approve sheet (web `platform/approve-sheet.tsx`, app `approve-sheet.tsx` / `approve-model.ts`) gains a switch
  "May make a space of their own", on, with one hint line. `platform.access_approved`'s line says so when off.

**N5. The console's People screen** (web `platform-people-page.tsx`, app `platform-people-screen.tsx`):
- **Newest 20 people with an email**, newest first: `GET /api/platform/people/recent` (new; `GET /people?email=` stays for
  older apps). One read through `users_recent_idx`, the counts in an outer query over the 20 (about 100 rows a view).
- Each row: name, email, "Since <date>" (`users.created_at`: the sign-up, or the day a space added them), **spaces they
  are part of** (as `listMemberships` counts them: active or suspended, not removed, not archived; personal included),
  **spaces made / allowed**, "Signed up themselves" for a self sign-up. Never roles, space names, last sign-in (R6) or a
  child without an email. Waiting sign-ups appear too, so a limit can be set before approval. The count's `.prepare(`
  carries an `org-scope:` comment; the index terms stay literal (`IS NULL`, `IS NOT NULL`) so the partial index is used
  (checked: `SCAN users USING INDEX users_recent_idx`, no sort); ties order by `id DESC`.
- Tap a row: the existing card (shared name, email, phone; Unpin Google), now also **"Spaces they may make"** (a number,
  0-50, "Default (1)" to clear) and, for a self sign-up, **"May make a space of their own"**:
  `PATCH /api/platform/people/:id/spaces { spaces_allowed?: number | null, personal_space?: boolean }`, logged
  `person.spaces_set` on the platform log ("Allowed Ana Lee 2 spaces"; the console's Activity lists `person.*`).
- The find-by-email box stays above the list. The app keeps its five tabs; People is already one.

**N6. What the person sees:** the session's `space_allowance` comes from ONE statement of scalar subqueries that
replaces `personalSpaceOffered`'s read (offer, `personal_space_allowed`, `spaces_allowed`, made via
`organizations_created_by_idx`; no FROM, so it answers for people a space added too): no extra round trip per session.
It hides **Start a space** and **Make my own space** (web welcome, org-switcher, member-home doors; app space-welcome,
account, create-actions, member-home doors) once none is left, and Spaces says one line: "You have made your space. Ask
the platform if you need another." Older apps keep the doors and get the 429/403 words (noted in `parity.md`).

**N7. Exposure** (`docs/data-exposure.md`): **R37** amends R14: the console reads, for people with an email (invitees
who never signed in included), their name, email, the date they came and the three counts; nothing about their roles,
spaces' names or activity, and nobody without an email. `exposure-organizations.spec.ts` keeps "no seeded child without
an email in the console", and the new `/platform/*` routes refuse anyone but platform admins.

**N7b. Deletion:** `deleteOwnAccount` soft-deletes, so its batch deletes the `space_allowances` row explicitly (the
`platform_accounts` row, with its switch, already goes); `set_by_user_id` is `ON DELETE SET NULL` so a hard-deleted
former platform admin never fails a purge. `person.spaces_set` and `organization.curricula_set` join `AUDIT_ACTIONS`.

**N8. Docs:** CLAUDE.md (the Phase 52/63/80 paragraphs: the limit, personal included), `docs/data-model.md`
(`space_allowances`), `docs/open-signup-plan.md` / `docs/stickiness-plan.md` notes where they say "3 spaces per person".

## Phase 82: curricula set per space by the console (schema block `release=phase-82`)

**C1. New defaults** (shared `progress.ts`, `spaces.ts`; `repositories/organizations.ts`):
`DEFAULT_CURRICULUM_ID = 'nc-2026'`; `createOrganization` (console) and `createSpace` (self-serve) offer NC Math 2026
alone; `PERSONAL_SPACE_CURRICULA = ['nc-2026']`. Existing spaces and the seed keep theirs.

**C2. Schema:**
```sql
ALTER TABLE organization_curricula ADD COLUMN allowed INTEGER NOT NULL DEFAULT 1
  CHECK (allowed IN (0, 1) AND (allowed = 1 OR retired_at IS NOT NULL));
ALTER TABLE organization_curricula ADD COLUMN label TEXT CHECK (label IS NULL OR length(label) BETWEEN 1 AND 60);
```
A row is a curriculum the console allows there (`allowed = 1`), offered or switched off by the space (`retired_at`); a
withdrawn row (`allowed = 0`) is retired (the column CHECK), so never the default (the table's existing CHECK), and keeps
its history readable like any retired one. No row: never allowed. Every existing row is allowed, so nothing changes for
existing spaces. In `schema.sql` the columns go after `created_at`, before the table constraints, with the CHECK text
identical in both files (`test:compat` compares columns as sets but not CHECKs, so a drift would go unseen).

**C3. The console sets them** (web `organization-dialog.tsx`, app `organization-form-sheet.tsx` /
`organization-detail-screen.tsx`, a "Curricula" section):
- Each catalog curriculum: a tick (may use), its name here (placeholder: the catalog name), and which is the default.
- Ticking Beast Academy where it was never allowed prefills **"Advanced Math"** (`NEW_CURRICULUM_LABELS` in shared), so
  every space newly given it starts with the new name; the label can be edited or cleared.
- **NC Math 2026's tick is locked on** (renameable): the bank serves NC 2026 grades to Quest and Assessments in every
  space whatever the list says (`assessmentLevelCurriculum`), so withdrawing it would only half-work; one line says so.
- `GET`/`PUT /api/platform/organizations/:id/curricula { curricula: [{ curriculum_id, label }], default_id }`, shared Zod
  (labels through `optionalText`, so the SSN guard applies; no two with the same visible name; the default among the
  allowed; never empty). One batch, in this order: clear the default; withdraw (`allowed = 0`, retired); insert newly
  allowed rows as offered, or re-allow (a row the space switched off stays off); labels; set the default (un-retiring it).
  Logged `organization.curricula_set` in the space's log ("The platform set the curricula: NC Math 2026, Advanced
  Math").

**C4. The space's admins narrow** (`routes/organization.ts` `PUT /api/organization/curricula`, both Curricula cards):
`listCurriculumOfferings` becomes an inner join on `allowed = 1`, so the card lists only allowed curricula, under their
names here; `setCurriculumOffering` never inserts and only un-retires `WHERE allowed = 1` (today's
`ON CONFLICT ... retired_at = NULL` would undo a withdrawal); switching off and the default work as today; any other id
is refused by the existing unknown-id check (422 on `offered`, which older apps already show).

**C5. Names in a space.** One shared prefix rule (`curriculum-names.ts`, `nameInSpace(text, labels)`), applied to all
three name sources -- the catalog ("Beast Academy Level 3", "AoPS Introduction to Algebra"), `TILE_LEVEL_WORDS`
("Beast Academy 3", "AoPS Algebra") and `QUESTION_BANK_LEVEL_LABELS` ("AoPS Prealgebra"): a leading "Beast Academy"
becomes the label, and a leading "AoPS " goes, whenever Beast Academy carries a label there ("Advanced Math Level 3",
"Advanced Math 3", "Prealgebra", "Introduction to Algebra"). A labelled curriculum's `source` line ("Beast Academy and
Art of Problem Solving") is not shown, and PRE's description ("After Beast Academy 5.") gets the same rule. Applied:
- **On the server**, in every per-space read and sentence: `GET /api/curricula`, `/api/curriculum`,
  `/api/organization/curricula`, `/canvas-assessments/levels`, `/quest/games/levels`, `/quest/tiles` (`words`), Continue
  and Play again labels (`questInWords`), the 409 messages naming a level (`canvas-assessments.ts`, `quest-games.ts`),
  the progress-report and assessment PDFs, a share card at the moment it is made (frozen), and new log lines.
- **On the clients**, through the session's `organization.curriculum_labels` (read only for the chosen space, never in
  `SELECT_ORG`, retired and withdrawn rows' labels included so old work reads the same): `level-words.ts` becomes a hook
  (`useLevelWords`), and the shared `tileLook`, `memberBoard`, `gameWords`, `openGameLabel`, `playAgain`, `tileWords`,
  `levelLabel` and `questLevelLabel` take the labels. Every call site moves: the Assessment pages and screens, Question
  Quest, the game wizard, lobby (its invite text) and game pages, games card, the Daily, Next up, favorites, habit, the
  board -- on both clients.
- Not renamed, all outside a space: codes (BA3, BA3.10, BA3Q5, shown beside names in pickers), the guest page (it masks
  names), the public `/play/<code>` preview, and the console's question bank and Play settings (platform-wide).

**C6.** Older app builds show a mix in a space that renames: the server's words (tiles, levels lists, pickers, Continue)
say "Advanced Math", their own say "Beast Academy". Noted in `parity.md`. They never see a curriculum that is not
allowed, so their Curricula card keeps working.

**C7. Docs:** CLAUDE.md's curricula paragraph and Phase 67's `PERSONAL_SPACE_CURRICULA`, `docs/data-model.md` rule 9
(two create paths; `allowed`, `label`), `docs/curricula-plan.md`.

**C8.** The "students missing a parent" audit query and a new one: "a default that is not allowed" (must return none).

## Tests

**Existing tests that now meet the limit.** "Sign up (which makes a personal space), then Start a space" is a common
setup: about 15 web specs (two of them `@smoke`: `spaces.spec.ts`, `spaces-invite.spec.ts`) and about 10 Maestro flows
(two smoke: `spaces/invite`, `spaces/join`), and the seeded Ines already made space C. They get a helper that raises the
person's limit through the console's new PATCH (`e2e/support` and a `spaces.js` action `allow-spaces`), or assert the
429 where the limit is the point. Never loosened: each still checks what it checked.

**Phase 81:**
- Web: `spaces-welcome.spec.ts` (the cap: 1, personal counts; replaces the 3-spaces test); a new `space-limits.spec.ts`
  (Start a space hidden after one; 429 on a second; the console raises the limit and it opens; personal off at approval:
  no space, no offer, 403 on `/spaces/personal`; platform admin unlimited; a deleted space frees its place; two
  concurrent Start a space, and Start a space beside Make my own space: exactly one succeeds; placed by approval, then
  Start a space: the offer goes; 0 allowed before approval: no space, no offer; the PATCH's 0-50, null, 404 and its
  refusal of the switch for someone a space added);
  `access.spec.ts` (the switch in the sheet); a new `platform-people.spec.ts` (newest 20 with an email, counts, set the
  limit, logged; no child without an email); `exposure-organizations.spec.ts`; `compat-clients.spec.ts` (an older
  console's `{ access }` still makes the personal space).
- Maestro: `platform/admins-people` (the list, set a limit), `platform/access` (the switch), `spaces/spaces-page`,
  `spaces/sign-up` (smoke).
- Jest: `space-model`, `approve-model`, the People screen, `create-actions`, `member-home-model`.

**Phase 82:**
- Web: `curricula.spec.ts` (a new console space and a new self-serve space start on NC 2026 alone; the console allows
  Beast Academy, prefilled "Advanced Math"; the space's admins can switch it off but not add Math Kangaroo, 422);
  `member-board.spec.ts`, `play-tiles.spec.ts` and any spec or flow expecting Beast Academy in a new or personal space
  (the Phase 67 "Adv" row: grep `'ba'` / "Beast Academy"); a new `curriculum-names.spec.ts` (tiles, game words,
  assessment levels, pickers and the PDF read "Advanced Math" and "Prealgebra" in a labelled space, and the catalog
  names in an unlabelled one; a share card keeps the label it was made with; `/play/<code>` unchanged); the console
  withdrawing a space's default (the default moves, old plans still read under the label, the admins' PUT of it gets
  422 on `offered`); `@compat`: an older Curricula-card body still saves where a curriculum was withdrawn.
- Maestro: `spaces/console` (the Curricula section), `organization/curricula`, a quest-board flow in a labelled space.
- Jest: `curriculum-names` (shared: all three sources, "AoPS Introduction to Algebra" included), the console form,
  the Curricula card.

## Release (approval of this plan covers it, per the rulebook)

Per phase: typecheck, `mobile:test`, the touched specs and flows, `npm run smoke` (web, iOS, Android), commit and push.
Then: the full local suite, `smoke -- mobile`, `test:compat` against `release-20261107`; `RELEASE_PHASE` 82, commit,
push, tag. Test side: the phase-81 and phase-82 blocks on `tutoring-test-db` by hand, then `deploy:test`, then
`mobile:devices -- test`. Production: back up `tutoring-db`, apply both blocks, check the new queries read-only (and
that every `users.created_at` is ISO, so the People list orders right: the institute's migrated rows kept their dates),
`npm run deploy`, smoke-test both addresses, `mobile:devices -- personal`. Stop and report if a step fails.

## Not in this plan

- Raising or lowering the default (1) from the console: it is a constant; per-person overrides cover the need.
- A space's own curriculum (curricula.organization_id) or renaming topics.
- Changing curricula or names of existing spaces (the console does that one space at a time).
- Withdrawing NC Math 2026 from a space: the question bank serves it everywhere; changing that would change every
  existing space.
- Paging the People list beyond 20, or searching by name.

## Verification (locally)

1. A new adult signs up (Open): their personal space is their one; Start a space is gone and the API says 429. The
   console's People lists them first with "1 made / 1 allowed"; set 2; Start a space returns and works.
2. Post-approved: approve with "May make a space of their own" off and no place: no space, Welcome offers Join with a
   code and Start a space; "Make my own space" is absent and the route says 403.
3. Console: a new space offers NC Math 2026 alone; allow Beast Academy ("Advanced Math" prefilled); the board shows
   "Advanced Math 3" and "Prealgebra" tiles, the Assessment levels and pickers say the same; the space's admins switch it
   off and cannot add Math Kangaroo. An existing space still reads "Beast Academy".
4. `npm run typecheck`, `npm run smoke` green on web, iOS and Android, and the two audit queries return no rows.

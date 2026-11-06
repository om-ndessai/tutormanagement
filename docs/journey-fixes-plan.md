# Journey fixes: the plan for the UI audit's recommendations

> Status (2026-11-04): approved by the owner, all phases at once (the fix-up and Phases 70-78), built straight
> through on `member-home-stickiness`, each phase's own decisions asked before it starts. No deploy to the test
> Worker until the owner asks; then the last committed phase is deployed. Hourly status per phase with an ETA.
>
> Progress: the fix-up `8173a2a`; Phase 70 web `2b78590` and app `023ba00`; Phase 71 web `ab71793`; the 70+71
> contract `98c40ab` (smoke green on the web, iOS and Android; `test:compat` green); Phase 72 (smoke green on all
> three, `test:compat` green); Phases 73 and 74 (one smoke and one commit, as planned); Phases 75 and 76 (one smoke
> and one commit; smoke green on the web, iOS and Android, `test:compat` green). Phase 77 next.

The UI journey audit ([docs/userjourney/](userjourney/README.md)) played 24 journeys at commit `2d6e7d3` and merged
its findings into 37 recommendations ([recommendations.md](userjourney/recommendations.md)). This plan fixes each
of them once, in the phase that owns its component, so that a P0 and a P1 on one screen are one piece of work. The
items are numbered JF1-JF37 in the order of the recommendations page; `docs/plan.md` cites them.

## The issues

| | Count |
| --- | --- |
| Recommendations | 37: 3 P0, 14 P1 (plus one P1-worthy part of a P2), 17 P2, 3 P3 |
| Findings behind them | 227: the 24 journeys 184 (sev4 2, sev3 34, sev2 105, sev1 43), the two audits 43 (sev4 2, sev3 16, sev2 21, sev1 4) |
| By layer | **Schema:** 2 items, both on `join_requests`. **Worker or shared contract:** about 21. **UI only:** about 16 (the 2026-11-04 decisions moved the approval notice out) |

## The items

Hours are effort including tests. Layers: **DB** schema, **W** Worker or shared contract (a change here means the
full smoke before its commit), **web**, **app**.

| ID | Rank | Item ([recommendations](userjourney/recommendations.md)) | Phase | Layers | Hours |
| --- | --- | --- | --- | --- | --- |
| JF1 | P0 | [A parent let in by code cannot reach her child](userjourney/recommendations.md#p0-a-parent-let-in-by-code-cannot-reach-her-child) | 71 | W web app | 14 |
| JF2 | P0 | [Say what the approval wait means](userjourney/recommendations.md#p0-say-what-the-approval-wait-means-and-tell-people-when-it-ends) | 70 | W (words) web app | 8 |
| JF3 | P0 | [The app's Have a code button crashes](userjourney/recommendations.md#p0-the-apps-have-a-code-button-crashes) | Fix-up | app | 3 |
| JF4 | P1 | [One Have a code door, from the guest page on](userjourney/recommendations.md#p1-one-have-a-code-door-from-the-guest-page-on) | 72 | W web app | 14 (+4 kept through approval) |
| JF5 | P1 | [Tell people the space's answer to their request](userjourney/recommendations.md#p1-tell-people-the-spaces-answer-to-their-request) | 71 | DB W web app | 14 |
| JF6 | P1 | [Lead the first home with what the person came for](userjourney/recommendations.md#p1-lead-the-first-home-with-what-the-person-came-for) | 74 | W web app | 13 |
| JF7 | P1 | [Put Start a space where a teacher looks](userjourney/recommendations.md#p1-put-start-a-space-where-a-teacher-looks) | 72 | web app | 6 |
| JF8 | P1 | [Refusals give a next step and never reopen unasked](userjourney/recommendations.md#p1-refusals-give-a-next-step-and-never-reopen-unasked) | Fix-up (reopen) + 70 | web app | 7 |
| JF9 | P1 | [A friend's game code and tile link reach the friend's game](userjourney/recommendations.md#p1-a-friends-game-code-and-tile-link-reach-the-friends-game) | 72 | W web app | 6 |
| JF10 | P2 | [The guest page speaks to every visitor](userjourney/recommendations.md#p2-the-guest-page-speaks-to-every-visitor-and-keeps-its-promises) | 70 | W web app | 7 (+ percent marking 2) |
| JF11 | P2 | [Sign in opens a sheet titled Sign up free](userjourney/recommendations.md#p2-sign-in-opens-a-sheet-titled-sign-up-free) | 70 | web | 2 |
| JF12 | P2 | [An invitation link opens on the invitation](userjourney/recommendations.md#p2-an-invitation-link-opens-on-the-invitation) | 72 | W web app | 3 |
| JF13 | P1 | [Continue resumes the open game](userjourney/recommendations.md#p1-continue-resumes-the-open-game) | 73 | W web app | 13 |
| JF14 | P1 | [Start the board at the learner's grade](userjourney/recommendations.md#p1-start-the-board-at-the-learners-grade-and-remember-it) | 73 | (DB) W web app | 12 |
| JF15 | P1 | [Play with a child on one device](userjourney/recommendations.md#p1-play-with-a-child-on-one-device-credited-to-the-child) | 77 | (DB) W web app | ~35 |
| JF16 | P2 | [My progress shows one state](userjourney/recommendations.md#p2-my-progress-shows-one-state-and-never-a-zero-first) | 73 (band in 74) | W web app | 8 |
| JF17 | P3 | [Lesson cards say where](userjourney/recommendations.md#p3-lesson-cards-say-where-and-lead-to-practice) | 74 | W web app | 4 |
| JF18 | P1 | [A missing price hides behind 95.00](userjourney/recommendations.md#p1-a-missing-price-hides-behind-9500-until-a-live-lesson-cannot-end) | 75 | W web app | 9 |
| JF19 | P1 | [A saved draft disappears from the home](userjourney/recommendations.md#p1-a-saved-draft-disappears-from-the-home) | 75 | web app | 10 |
| JF20 | P1 | [A guardian cannot open her child's assessment](userjourney/recommendations.md#p1-a-guardian-cannot-open-her-childs-assessment) | 77 | W web app | 10 |
| JF21 | P1 | [One Add chooser, led by A family](userjourney/recommendations.md#p1-one-add-chooser-led-by-a-family) | 76 | web app | 19 |
| JF22 | P1 | [Offer adding people only to those who may add](userjourney/recommendations.md#p1-offer-adding-people-only-to-those-who-may-add) | 71 | W web app | 8 |
| JF23 | P2 | [The home repeats its own Next up](userjourney/recommendations.md#p2-the-home-repeats-its-own-next-up) | 73 (one Daily rule) + 74 | W web app | 8 |
| JF24 | P2 | [The Dashboard opens on the wrong hat](userjourney/recommendations.md#p2-the-dashboard-opens-on-the-wrong-hat) | Fix-up ("Done") + 74 | W web app | 6 |
| JF25 | P2 | [The tour covers what it introduces](userjourney/recommendations.md#p2-the-tour-covers-what-it-introduces-and-appears-without-tutoring) | Fix-up (gating) + 74 | web app | 5 |
| JF26 | P2 | [Join requests say who is asking, and Decline can be undone](userjourney/recommendations.md#p2-join-requests-say-who-is-asking-and-decline-can-be-undone) | 71 (admin side) + 72 (role, note) | DB W web app | 7 |
| JF27 | P2 | [A pairing that keeps the tutor's rates is saved as custom](userjourney/recommendations.md#p2-a-pairing-that-keeps-the-tutors-rates-is-saved-as-custom) | 75 | web app | 3 |
| JF28 | P2 | [Phone-width layouts break on a dozen screens](userjourney/recommendations.md#p2-phone-width-layouts-break-on-a-dozen-screens) | Fix-up (the app's hidden answer) + 78 | web app | 8 |
| JF29 | P2 | [Contrast and accessibility gaps](userjourney/recommendations.md#p2-contrast-and-accessibility-gaps) | 78 | web app | 4 |
| JF30 | P2 | [Record and start a lesson one way](userjourney/recommendations.md#p2-record-and-start-a-lesson-one-way-on-both-clients) | 75, if the owner adopts the app's model | (W) web app | ~29 |
| JF31 | P2 | [Tutoring words and the office menu](userjourney/recommendations.md#p2-tutoring-words-and-the-office-menu-reach-readers-who-have-neither) | 74 | W web app | 13 |
| JF32 | P2 | [One word per thing, and words rather than codes](userjourney/recommendations.md#p2-one-word-per-thing-and-words-rather-than-codes) | 73 (games with progress) + 78 | W web app | 11 |
| JF33 | P2 | [Each space looks like itself](userjourney/recommendations.md#p2-each-space-looks-like-itself) | 72 | W web app | 5 |
| JF34 | P3 | [Amber does one job](userjourney/recommendations.md#p3-amber-does-one-job) | 78 | web app | 4 |
| JF35 | P3 | [Small type, all-caps labels, year lists and dates](userjourney/recommendations.md#p3-small-type-all-caps-labels-year-lists-and-dates) | 70 (year list) + 78 | W web app | 11 |
| JF36 | P2 | [Leaving a game works the same on both clients](userjourney/recommendations.md#p2-leaving-a-game-works-the-same-on-both-clients) | 70 (the app's waiting Back) + 73 | web app | 6 |
| JF37 | P2 | [Invite people at any time, with Copy and Share](userjourney/recommendations.md#p2-invite-people-at-any-time-with-copy-and-share-on-both) | 76 | web app | 5 |

## The phases

Each phase lists its items and what was decided. A phase's **decisions** are asked before it starts.

### Fix-up (UI only), about 12 h
JF3 (the app's "Have a code?" quick action crashes: its dialog renders outside the toast provider; plus an error
screen with a way home, and a Maestro flow that taps it); the app's hidden fourth answer choice (JF28's P1 part:
`take-assessment-screen.tsx` caps the question card at a third of the screen); the welcome wizard's tour offered only
where Tutoring is on, and its last button reading "Done" (JF25, JF24: bugs against the owner's 2026-11-04 rule); the
web's sign-up sheet reopening by itself after a refusal (JF8's bug), with J05's repro as a spec; and the audit's
finding count corrected (184, not 194).

### Phase 70: the wait and the front door, about 30 h
JF2, JF8, JF10, JF11, JF35's year list, JF36's app waiting-screen Back. **Decided (owner, 2026-11-04):**
- the waiting screen says a person at Aimtrue checks every new account, usually within a day, with "Keep playing"
  as its main button; one heading;
- **no "your account is ready" notice for now**: words and buttons only (no status route, no email);
- "Contact us" keeps `om.ndessai@gmail.com` for now, shown in full (`PLATFORM_CONTACT_EMAIL`, one place);
- marking accepts "30%" for a number key -- checked on the bank first, as asked: 835 numeric questions mention a
  percent and about 373 ask for a non-percent amount ("What is 10% of 70?"), so the owner chose (2026-11-04) to
  accept a trailing % only when the question asks for a percent. It needs the question's text at marking time,
  so it moves to Phase 72's contract;
- Post-approved stays the production mode;
- the device remembers an under-13 refusal, so the age form is not offered again on that device;
- no stored "Ask for an invitation": a mail with the person's address prefilled.

### Phase 71: let in, and hear back, about 42 h
JF1, JF5, JF22, JF26's admin side. **Decided (owner, 2026-11-04):**
- **Let in is a short sheet** (a change to Phase 52's design): the role, and for a parent "Which child is theirs?",
  a student here or one added now; the button says "Let in";
- **outcomes stay until dismissed**: let in and declined show on the home and Next up with the date, "Ask again"
  and a dismiss, in a column of their own (`join_requests.seen_at` is not reused: older builds mark it on view);
  asking again says the space declined before;
- **an empty student picker says who adds children** ("Ines Ferreira adds them"): admins' names shown to members,
  with an exposure rule; no stored ask, and only admins add people.

### Phase 72: codes and the spaces menu, about 46 h
JF4, JF26's role and note (schema), JF9, JF7, JF12, JF33, and Phase 70's percent marking. **Decided (owner,
2026-11-04):**
- a code typed signed out is **kept on the device** through sign-up and approval, and offered once on the first
  home ("You have a code for Ferreira Family Practice: Ask to join"); one "Have a code?" box from the guest page on;
- a join request carries **the role the person asks for and a short note** (two `join_requests` columns); the
  Let in sheet preselects the role;
- a friend's game code from another space gets an **honest refusal that reveals nothing**: "No game in your spaces
  has that code. Games are joined inside their own space: ask your friend to invite you there, or start your own
  game." (R13 kept);
- each new self-serve space **takes the next palette automatically** (never the institute's plum); personal
  spaces keep slate and read "Just you";
- an **invited person sees and accepts the terms and the privacy notice once**, at their first sign-in (the
  version recorded for them);
- a trailing % is accepted only when the question asks for a percent.

### Phase 73: coming back to play, about 44 h
JF13 with games listed with their progress (from JF32), JF14 and one Daily rule (from JF23), JF16, JF36.
**Decided (owner, 2026-11-05):**
- **Continue resumes the open game**, running or in its lobby, read from the server and labelled in words with its
  progress ("Grade 7 Quick 5 · question 3 of 5 · 2 points"); with none open, "Play Grade 7 Quick 5 again". A New
  Quest game gets a Continue too. This reverses the stickiness plan's "the last settings, kept on the device";
- **the grade is derived, and asked only when unknown**: the grade the space records for a student, else the last
  level played (from the server), else for 13+ the top of the row; only when none exists, one question on first
  Play ("Which grade?", with "Not in school");
- **a grade picked on the row is remembered on the server, per space**: `org_members.quest_grade` (one additive
  column, a `release=phase-73` block), read by nobody else;
- **the members' Daily is "Today's Daily"** in Next up and on the board alike; "Today's 5" stays the guest page's
  free set.

**How (Phase 73 design, 2026-11-05):**
- **Continue.** `GET /api/quest/games/open` reads, in one D1 query, the reader's newest game in its lobby or running
  (else their newest finished one, for "again"), and makes at most one call to the game's Durable Object, through a new
  read-only `progress` call that serves nothing and saves nothing, and only for a running game. The board, Next up and
  the app's home-screen action open that game, or start its settings again. Labels come from shared `openGameLabel`, in
  words, never codes. The device's "last quest" goes.
- **The lead grade.** `GET /api/quest/tiles` carries `lead` (grade, level, where it came from) and `ask_grade`, from
  shared `questLeadGrade`, in this order:
  1. the grade picked on the row (`org_members.quest_grade`; 0 is "Not in school", which leads with the top of the row);
  2. the level the space records for a student (`student_profiles.quest_level_id`);
  3. the last level played (games, then Dailies);
  4. for 13+, the top of the row.

  `ask_grade` is set only when none of these exists. The device's guest grade is carried into `quest_grade` once.
  `PUT /api/quest/grade` saves a pick (a preference, so no audit line, like `/home/pin`). One Daily rule on both
  clients: the lead grade's first standard tile.
- **An empty game earns nothing.** No place and no "wins!" for a team with no answers; games and family badges count
  only games the person answered in; a best score skips empty games. A badge once earned is kept, and My progress
  shows one headline from the current run.
- **Leaving.** Exit returns to where the game was opened (home or Quest) on both clients; Cancel and End ask first on
  the web, as in the app; the Daily page gets a close; results refresh the home.

### Phase 74: the first home, about 40 h
JF6 (led from the person's hats: new arrival kinds would need a new privacy version), the band (JF16), JF23's
twins, JF24, JF25, JF31, JF17. **Decided (owner, 2026-11-05):**
- **the reader's hat leads the first home where Tutoring is off**: a parent with a child here gets the family section
  first (the child's card); the maker or an admin of a space that is not personal gets the office section first
  (needs you, invitations not yet accepted, open assessments); the board follows. Built from hats, so no new
  arrival kind and no new privacy version. An adult who has not played gets three doors in the band (Play · Join
  with a code · Start a space), never "0 of 3 days";
- **students and parents never see Users** (nor Pairings or Billing); a parent reaches their child from the home's
  child card (and Progress where Tutoring is on); admins and tutors keep their menus;
- **Practise before a lesson opens 7 days ahead** (`PRACTISE_BEFORE_DAYS` 3 -> 7), once a day until played;
- **a guest's play day does not count** as a member's first day: nothing about a guest is sent (R26); the band leads
  with "Start a streak" in words that never read as a zero.

### Phase 75: the tutor's record, about 22 h (about 50 h with JF30)
JF18, JF19, JF27, and JF30 (adopted). **Decided (owner, 2026-11-05):**
- **a price stays optional, but is flagged and checked at Start**: the field is visibly empty with helper text ("For
  example 95.00"); a missing price reads "No price set" on the student, the pairing and the schedule; Start refuses up
  front in a tutor's words ("Ask the office to set Yusuf's price"); the stop dialog shows every field error as text and
  keeps the note;
- **the app's record model is adopted on the web (JF30)**: a known lesson opens "Record a lesson" prefilled ("It ran as
  planned" / "Write up the lesson"); the quick action and the Sessions button open the list of lessons still owed, with
  "Another lesson"; no form defaults to today at 4:00-5:00 PM; To record sits at the top of Sessions; every Start opens
  the Start sheet in place; a running lesson leads Next up with Stop; one noun and one verb, "lesson" and "Record". Phase
  75 becomes about 50 h.

### Phase 76: adding people one way, about 32 h
JF21, JF37. **Decided (owner, 2026-11-05):**
- **one "Add" chooser on both clients** -- "A family (parent and child)", "A tutor" (where Tutoring is on), "Someone
  else", "Invite by email" -- opened by the home's quick action, the Users (People) header and the app's (+); "A family"
  is the guided flow; after each save, the next step ("Pair Yusuf with a tutor", "Set a weekly lesson"); the student's
  details show the tutor and the lessons (the app's model, `docs/mobile/parity.md` U2);
- **"This is my child" in a personal space**: there the family flow asks only for the child and the signed-in adult is
  the parent (a teen's personal space still adds nobody);
- **the invitation says how and what**: "Ines invited you to Ferreira Family Practice on Aimtrue, a space for practice
  and assessments. Open <address>/spaces and sign in with Google using ana@example.com: your invitation is waiting
  there." ("lessons" named only where Tutoring is on).

### Phase 77: families at home, about 48 h
JF15, JF20. **Decided (owner, 2026-11-05):**
- **"Play with <child>" for a child who does not sign in is a game on the parent's device**, side by side at the
  child's grade, and the child's answers are credited to the child (days played, counts), never shown outside the
  child's audience (changes H10's "each on their own"; a line in R29). A child who signs in keeps the online invite;
- **a guardian may open a child's in-progress assessment on her own device to hand it over** ("Hand the device to
  Leo"); the submitted PDF stays the tutor's and the admins' (R17 unchanged for answers); Start warns when one is in
  progress.

**How (Phase 77 design, 2026-11-05):** a "seat": the parent's game carries the child (a live dependent here with no
email -- the server refuses otherwise, "Leo signs in: invite him instead.") as a second solo team, begun at once with no
lobby or code; the parent's session answers for the seat (`as_user_id`, checked against the game's seats in the Durable
Object, no D1 per answer), the child first on each question; credit already follows the answer's person, so the child's
days and counts are the child's; seat answers do not count toward the two-right-answers rule; `quest_game_players.
seated_by_user_id` (a `release=phase-77` block) lets the parent's home offer "Continue with Leo". A child who signs in
keeps the online invite, and the lobby lists who was invited. For assessments: a guardian of the student may continue
and submit an in-progress one (`can_continue`), after a "Hand the device to Leo" screen; only the starter or an admin
discards (`can_discard`); Start warns on the client when one is in progress.

### Phase 78: the look, about 30 h
JF32's rest, JF34, JF29, JF28's rest (with `responsive.spec.ts` additions), JF35's rest. **Decided (owner,
2026-11-05):**
- **"Beta" goes altogether**: checked questions are served like any other and are curated over time by the server's
  two-right-answers rule (Phase 42's consensus); no pill, line or mark a player or family sees. (The tutor's own
  per-question "not yet reviewed" mark on the assessment PDF is the reviewer's, and is kept unless the owner says
  otherwise.);
- **one word per thing**, in a glossary in shared code both clients read: "lesson" (never "session" on screen),
  "quest" for anything played on the board ("game" only in "Play with" and codes), "person/people" (the web's Users page
  becomes People, as in the app), "space"; API and code names unchanged;
- **grade hues on both boards, amber for action only**: the guest page takes the grade hues (mode shown by its icon),
  reversing the member-home plan's Decision 1; the Daily's button takes the space's primary.

Carried here from Phase 75 (found by its flows): in the app, the office's lessons owed can be longer than the screen,
and the sheet then scrolls with "Another lesson" at its end -- QuickSheet's documented fallback, but not the thumb zone
it promises. The phone-width pass decides whether to pin the action (QuickSheet's root must stay a ScrollView on iOS)
or to show the newest few rows with "Show all".

## How it is committed

- **Per phase:** UI-only commits first (typecheck, Jest, the touched specs and Maestro folders on iOS), each pushed;
  then ONE contract commit holding the schema (with its ```` ```sql release=phase-NN ```` block in
  `docs/database.md`), the Worker, shared, seeds, `RELEASE_PHASE` and both clients' consumers, gated by the full
  `npm run smoke` (web, iOS, Android; about 55 minutes), the touched specs and flows on both platforms, and
  `test:compat` when a schema or response shape changed. Pushed.
- **Phases that share files share one contract commit and one smoke:** 70+71, 72, 73+74, 75+76, 77, 78.
- **Older app builds:** new fields optional, error codes kept, new refusals readable from their message alone.
- **No test deploy** until the owner asks; then the release checks (full suite, mobile smoke, compat) and
  `deploy:test` of the last committed phase, schema blocks applied by hand.
- **Acceptance:** each failing journey step becomes a permanent spec or flow; after each pair the journeys it closes
  are replayed locally with `e2e/journeys/driver.mjs`; all 24 before production. Each item is marked "Done in Phase
  NN" on the recommendations page.

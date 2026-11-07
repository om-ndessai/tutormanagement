# Mobile app progress

This file is the resumable state of the build (see "Resumable orchestration" in [plan.md](plan.md)).
`[ ]` todo · `[~]` in progress (with a note) · `[x]` done (with the commit's short SHA).
`git log main..mobile-app` is the ground truth: an item is done when its commit exists.

**To resume:** read this file, `git status` and `git log --oneline main..mobile-app`; finish
the `[~]` item, then carry on down the list.

## Phase 1 — foundation and parity

- [x] 1. Docs: mobile plan, setup, progress and parity tracker (0de7cfc)
- [x] 1b. Docs: immersive design research
- [x] 2. Workflow: mobile architect, developer and tester skills
- [x] 3. Mobile: Expo app scaffold beside the monorepo
- [x] 4. Workflow: lint, format and unit tests for the mobile app
- [x] 5. Mobile: shared contract on Hermes — resolution, Intl, diagnostics
- [x] 6. Mobile: brand palettes and Paper theme from the web tokens
- [x] 7. Mobile: API client, server picker and per-request organization
- [x] 8. Mobile: developer sign-in and session restore
- [x] 9. Mobile tests: Maestro harness and local seeded runner
- [x] 10. Workflow: CI for typecheck, lint, unit tests and bundling
- [x] 11. Mobile: organization picker, invitations and default organization
- [x] 12. Mobile: app shell — role tabs, org switcher, user menu, live lesson banner
- [x] 13. Mobile: Dashboard — Tutoring tab
- [x] 14. Mobile: Dashboard — Finance tab
- [x] 15. Mobile: Dashboard — parent and student views, reflection prompts (926a924)
- [x] 16. Mobile: Dashboard — admin view-as and role selector
- [x] 17. Mobile: Sessions — Tutoring/Finance list, filters and focus (701258a)
- [x] 18. Mobile: Sessions — record a lesson
- [x] 19. Mobile: Sessions — drafts and 3-second autosave (fa56a01)
- [x] 20. Mobile: Sessions — live lesson: start, timer, stop, cancel (9fbba20)
- [x] 21. Mobile: Sessions — notes, assessments and student reflections (a29e31a)
- [x] 22. Mobile: Pairings — assignments and rate overrides (5278c65)
- [x] 23. Mobile: Schedule — weekly view, editor, cancel/restore, calendar files
- [x] 24. Mobile: Progress — list, chart, assessments, plans
- [x] 25. Mobile: People — directory, detail, delete/restore, profile (the person's comment thread lands with #29) (60621e2)
- [x] 26. Mobile: People — person form
- [x] 27. Mobile: Billing — balances, payments, CSV and tax summary (d5d7fad)
- [x] 28. Mobile: Year-end — 1099 printed on device, SSN receipts
- [x] 29. Mobile: Comments — feed and threads (b2c2615)
- [x] 30. Mobile: Activity — audit log (2040a85)
- [x] 31. Mobile: Organization — TIN, payer address, notifications (add087e)
- [x] 32. Mobile: Profile and appearance (0973394)
- [x] 33. Mobile: Search — pages, people and actions (f83ae35)
- [x] 33b. Mobile tests: self-cleaning, stable Sessions flows (094670c)
- [x] 34. Mobile: Welcome wizard, guided setup and tour (f4e828a)
- [x] 35. Mobile: Platform console — organizations, branding, logo upload, admins, people, activity (d71b763)
- [x] 36. Mobile tests: exposure across personas

**Phase 1 gate (2026-10-10):** full suite, 74 flows, fresh DB and a rebooted 4-core emulator. iOS 72/74, Android 73/74. The three failures (`sessions/list-tutor` and `people/delete-restore` on iOS, `people/edit` on Android) passed when re-run alone: intermittent, listed for the Phase 2 stability pass. The web app, API and shared package are untouched (`git diff main -- apps/web apps/api packages/shared` is empty).

## Phase 2 — UX audit and immersive design

- [x] 37. Docs: mobile UX audit (findings and batches in [ux-audit.md](ux-audit.md))
- [x] 38. Mobile UX: privacy cover and secure screens (B1, S) (3d7cedf)
- [x] 39. Mobile tests: the three intermittent flows (B2, S) (2b48448)
- [x] 40. Mobile UX: toasts above the tab bar, contrast and target sizes (B3, M) (a32d1a6)
- [x] 41. Mobile UX: large text, skeletons, pull-to-refresh and empty states (B4, M-L) (1eb2a88)
- [x] 42. Mobile UX: forms that keep your work — unsaved-changes guard, errors in view, offline (B5, M) (ab20a32)
- [x] 43. Mobile UX: start from Home — Next-up Start, quick actions and native calendar (B6, M-L, native rebuild)
  > Deferred from B6: F-23's chip row and "default to the last unrecorded lesson" (no tap saved; the
  > latter needs an API read of past unrecorded dates); the audit's "Schedule" quick action (owner:
  > teaching roles only); Android `schedule/calendar` (by hand, see build-log); dark and large-text
  > re-shots of the Next up card. `expo-quick-actions` carries a patch-package patch for iOS cold
  > starts under the scene life cycle.
- [x] 44. Mobile UX: swipe actions, context menus and undo (B7, L)
  > Deferred from B7: iOS `Link.Menu`/`Link.Preview`/`Link.AppleZoom` (F-29; one Paper menu serves
  > both platforms now); the once-per-device swipe peek; F-9's optimistic cancel/restore/star/comment
  > (Undo already exists on cancel and deactivate); F-27's FlashList for the payment log, ledgers and
  > Progress (each screen needs a list root); dark and large-text re-shots of the swipe and menu.
- [x] 45. Mobile UX: live lesson on the lock screen — Live Activity and Android ongoing notification (B8, L, native rebuild)
  > Deferred from B8: an iOS Stop button inside the Live Activity (needs App Intents in the extension; the
  > tap opens the app, whose banner has Stop); ending the iOS activity in the background after an auto-stop
  > or a stop on another device (needs push updates and a paid Apple team; the clock stops at the limit);
  > not reposting an ongoing notification the user swiped away on Android 14+; Android dark and
  > large-text shots; a device build (the extension's bundle ID, App Group and `aps-environment` need the
  > team — testflight.md T2).

**Phase 2 gate (2026-10-10), after B1–B5:** full suite, 76 flows, fresh DB, rebooted 4-core
emulator. iOS 75/76, Android 73/76.
- `exposure/live-surfaces` and `progress/list-admin` (Android) passed when re-run alone:
  intermittent.
- Two flow faults, fixed:
  - `progress/assess-plan` (iOS): the Delete-plan button, merely "visible" under the floating
    tab bar, gave its tap to the tab bar. The flow now centres it.
  - `activity/admin` (Android): the action list shows its search field only when long, and a
    fresh DB has a handful of actions. The search step is now conditional.
- Both fixed flows green on iOS and Android.

**Phase 2 final gate (2026-10-11, after B1–B8):** full suite, 83 flows, fresh DB, rebooted
4-core emulator. iOS 82/83, Android 80/83.
- The three Android failures (`year-end/form-1099`, `activity/admin`, `sessions/drafts`) passed
  when re-run alone: intermittent.
- `forms/unsaved-guard` (iOS) was a flow fault, now fixed. Its swipe began on the sheet's
  content, which B6's expanded picker made scrollable, so it scrolled instead of pulling the
  sheet. `subflows/dismiss-sheet.yaml` now swipes from the grabber. It and `forms/errors-in-view`
  (which uses the same subflow) are green on iOS.
- **Phase 2 is complete.**

> **Order from the owner (2026-10-10, after review).** The pause is over. Next come Phase 2
> B6–B8 (items 43–45), then Phase 3. **Deferred:** TestFlight (T2: no paid Apple account yet)
> and Phase 5 (real devices). Google sign-in (Phase 4's core) is done on iOS; Android sign-in
> waits on the owner's Android OAuth client check.

## Next priority — Google sign-in, then TestFlight (owner, 2026-10-10)

Ahead of Phase 2 B6–B8 and Phase 3. The checklists are in [google-sign-in.md](google-sign-in.md)
(first) and [testflight.md](testflight.md) (after it).

- [x] G1. Mobile sign-in: Google, through the existing `/auth/google` and its session cookie (no
  API change); placeholders until the owner's iOS client IDs arrive
- [~] G2. *(iOS done; Android open — see note)* Hand check with a real Google account on the iOS simulator and the Android emulator
  (local Worker with sign-in on); then against production with the owner's approval
  > **G2 note (2026-10-10):**
  > - The owner reached Google's sign-in on the device, but no `POST /api/auth/google` ever
  >   reached the Worker. Google's own step returned an error. On Android that is almost always
  >   `DEVELOPER_ERROR`: no Android OAuth client matches `com.tutorportal.app.dev` and the debug
  >   SHA-1 `5E:8F:16:06:…:F6:25` in the web client's project 866980945062.
  > - Development builds now show Google's code in the error, to confirm it.
  > - **iOS: done (2026-10-10).** The owner signed in with Google on the iPhone 17 simulator
  >   against the local Worker with sign-in on (`POST /api/auth/google` reached the Worker, then
  >   a session), end to end.
  > - Android: still to do, after the Android OAuth client is checked.
- [x] T1. Mobile release: icon, splash, Info.plist, privacy manifest, eas.json, a Release build
  check (`mobile:export` and the Maestro run beyond `smoke/*` skipped when the owner asked to wrap up)
- [ ] T2. *(deferred — owner has no paid Apple account yet)* Ship: the first TestFlight build to internal testers, a smoke test on a real iPhone

## Phase 3 — dictation

Design: [build-log.md](build-log.md), "P3. Dictation — design" (2026-10-11). Each item needs a
native rebuild of both dev builds, so build only while the devices are free.

- [x] P3a. Mobile dictation: engine, permissions and on-device policy
  - `expo-speech-recognition` 57.1.x, with its config plugin and neutral microphone/speech copy.
  - `expo-image-picker` no longer blocks `RECORD_AUDIO`; only the two plist strings and
    `RECORD_AUDIO` are re-added.
  - `src/lib/speech.ts`:
    - on-device only by default, refusing to start without on-device support (the library fails
      open to the network on iOS);
    - asks for the microphone only on the on-device path;
    - offers the Android model download.
  - Network consent dialog, plus the Profile Dictation control (device-local, off by default).
  - Permission dialogs: rationale, Open Settings, restricted.
  - A `patch-package` patch removing transcripts from the Android `Log.d` lines.
  - Fake engine with `tutorportal://dev/dictate`.
  - Lint rules: the only importer, no `persist`/`recordingOptions`, no DictationField in
    finance/tax/person forms.
  - Rebuild both dev builds.
  - First verify by hand whether iOS on-device needs the speech authorization.
  > Done 2026-10-11: both dev builds rebuilt; smoke green on both. iOS 27 simulator: an on-device start
  > reached audio capture with the microphone permission alone (no speech prompt, no `not-allowed`);
  > words need a microphone (P3c). Dialogs became native alerts (see the build log).
- [x] P3b. Mobile dictation: speak a lesson's write-up
  - DictationField (interim overlay; final-only commits; append spacing; SSN and length refusal;
    one session app-wide; stop on post, close, background and navigate; haptics; reduce motion;
    screen-reader labels and announcements) on the five write-up fields and the own assessment.
  - Record/Post/Save draft flush the last words first.
  - Maths vocabulary and spoken topic codes.
  - Jest: speech, append, topic codes, field, autosave and record integration, Profile control.
  - Maestro `dictation/{dictate-notes,dictate-ssn,dictate-permission}` plus a re-run of
    `sessions/{record,autosave,drafts}` and `smoke/*` on both platforms.
- [ ] P3c. Dictation hand checks with a real recognizer
  > Open (owner, 2026-10-11): by hand later. Needs a USB/Bluetooth headset on the Mac mini (or a
  > loopback input such as BlackHole playing a WAV), and the Android emulator started with
  > `-allow-host-audio` (or Extended Controls → Microphone → "Virtual microphone uses host audio
  > input"). Use Diagnostics' "Probe on-device dictation" first, then the record sheet. The emulator
  > has no en-US on-device model installed: the mic offers the download.
  - The Mac mini has no microphone: use a headset or a loopback input.
  - iOS simulator, if its recognizer works on iOS 27.
  - Android emulator with `-allow-host-audio`: on-device, the model download, logcat clean,
    airplane mode.
  - The store privacy answers for T2/Phase 5.
  - Real devices at Phase 5.
- [ ] P3d. *(deferred — owner, 2026-10-11)* *(optional, unscheduled — owner's call)* Dictation in comments, the lesson-assessment
  sheet and reflections

> **Owner decisions (2026-10-11):**
> - No organization-level switch for network speech recognition, so no API change. On-device is the default, and network recognition runs only with the person's own consent.
> - Dictation goes in the record-a-lesson sheet only. P3d (comments, reflections, the assessment sheet) is deferred.

## Portal Phase 33 — tutoring locations

- [x] 46. Mobile: Tutoring locations — a person's locations, a pairing's, a schedule's places, and the
  reminder sheet on Home *(built 2026-10-14: typecheck, lint, jest, export green; tested 2026-10-14:
  `locations/*` (person-locations, parent-child-locations, pairing-locations, schedule-locations,
  reminder) green on iOS and Android; `schedule/*`, `pairings/*`, `people/*`, `home/*` re-run on both
  (flow fixes: pairings/admin scrolls to Save, schedule/browse centres "Show all", seed-next-up.js sends
  `location_ids`); `npm run smoke -- mobile` green on both)*

## UI upgrades — warmth and short tasks (docs/ui-upgrades-spec.md)

- [x] U2. Mobile: the surface kit and the create button — `StepFlow`, `QuickSheet`, `SearchPicker`
  (`src/components/`), the app-drawn tab bar with a "+" between Schedule and Progress and its sheet of
  the reader's own actions; the top-right "+" on Sessions, Users, Billing and Schedule removed *(built
  2026-10-14: typecheck, lint, jest (79 suites, 416 tests), export green; tested 2026-10-14/15:
  `shell/*` (navigation, new `create` and `surface-kit`) and every flow that tapped a removed "+"
  (`people/create-student`, `create-student-new-parent`, `create-tutor`, `sessions/record`, `drafts`,
  `autosave`, `record-finance`, `dictation/*`, `exposure/student-controls`, `exposure/money-tutoring`,
  `billing/parent`, `billing/tutor`) green on iOS and Android; `sessions/live`, `onboarding/tour`,
  `locations/reminder` (the bar's new height and the tour's tab targets) green on iOS, tour and reminder
  on Android, live on Android green up to the notification shade, where another app's "$" notification
  trips the money check; `npm run smoke -- mobile` green on both. Design entry #47)*
- [x] U3. Mobile: Add a student, family first, and Add a tutor as step flows — the Family step leads,
  with a parent search (rows name their children) and "New parent" as a quick sheet inside the flow;
  then the student, school and goal, a week of Morning / After school / Evening bands with the exact
  grid behind "Fine-tune hours", their lessons, the price, Review and Add (one request with the
  guardians); a tutor's Basics, Background, Teaching, Availability, Pay; what next after adding; a
  "Finish tax setup" card on a tutor's record (admins, until the 1099 address and the SSN fact are
  set); the create button, People's empty state and the welcome wizard open the flows; the flows and
  the wizard rise as pushed screens (a sheet over a full-screen modal is invisible to VoiceOver on iOS)
  *(built and tested 2026-10-15: typecheck, lint, jest (82 suites, 432 tests), export green;
  `people/*`, `onboarding/*`, `shell/*` green on Android (15/15) and on iOS but for `people/tutor-view`
  and `shell/surface-kit`, which fail on iOS on the committed code too; `npm run smoke -- mobile` green
  on both. Design entry #48)*
- [x] U4. Mobile: Record a lesson and the student's reflection — from Next up, a quick sheet filled
  with the student, today, the times and the place ("It ran as planned", or "Different times"), then
  "Write up the lesson"; from the create button (and Sessions' Tutoring button, the quick action, a
  draft's Continue) a step flow: Student, When, then the write-up as four optional cards (Planned,
  Covered, Homework, Progress) with a large Dictate button, autosaved as a draft as before; Finance
  and editing a lesson keep the record sheet; the reflection as one question per card with five
  faces and words, progress dots, the homework note and a thank-you; and the two iOS reds U3 left
  (Maestro's reports inside Metro's watched folder) *(built and tested 2026-10-15: typecheck, lint,
  jest (84 suites, 449 tests), export green; `sessions/*`, `home/*`, `dictation/*`, `shell/*`,
  `dashboard/reflection`, `exposure/money-tutoring` green on iOS and Android (Android
  `dictate-permission` once intermittent at its Profile step, green on re-run); `people/tutor-view`
  and `shell/surface-kit` green on iOS; `npm run smoke -- mobile` green on both. Design entry #49)*
- [x] U5. Mobile: Schedule a lesson, Record a payment, Assessment and Section editing — scheduling as a
  step flow (Who, When, From when, Where as place cards with one of each kind at most, a Review said as
  a sentence) from the create button, Schedule's button and the carousel's "Nothing scheduled",
  editing kept on the sheet; the payment as a fitted quick sheet (the amount large, who filled from a
  Billing row or the person's record with Change, method chips, More details); the assessment's
  topics planned-first with a five-step pill that shows its word, the levels closed until opened; a
  person's record in sections (Contact, Background or School and goal, Availability, Teaching or
  Lessons and price, Pay and tax or Payment, Family), each with its own Edit opening only that section,
  the whole form in the record's menu *(built and tested 2026-10-15: typecheck, lint, jest (88
  suites, 474 tests), export green; `schedule/*`, `locations/schedule-locations`, `people/*`,
  `billing/*`, `progress/*`, `forms/*`, `shell/create`, `exposure/student-controls`,
  `exposure/narrow-audiences` green on iOS and Android (30 each, after the flow fixes in #50);
  `npm run smoke -- mobile` green on both. Design entry #50)*
- [x] U6. Mobile: the homes — every Home opens on a greeting on the organization's clock and Today
  ("2 lessons today", "Next at 4:00 PM with Sofia", or a calm line; a cancelled lesson never next),
  then one compact row of figures in sentence case (above the Tutoring/Finance tabs for the office
  and tutors); a parent gets a card per child and a student their own (the next lesson, this month in
  words with a small bar, a coral celebration for a topic mastered lately, once per topic on the
  phone, stilled by reduce motion); a tutor gets "Finish write-up" for their draft from today, after
  Next up; the role chips moved into the account sheet ("Home shows"); a small Home title. Also the
  jest suite's blank renders (RNTL 14's async `fireEvent`/`unmount` left un-awaited) *(built and tested 2026-10-15: typecheck, lint, jest (90 suites, 512 tests), export green;
  `home/*`, `dashboard/*`, `exposure/*`, `onboarding/{tour,wizard-admin}` and the other flows that read
  Home's header (29) green on iOS and Android; `npm run smoke -- mobile` green on both. Design entry
  #51)*
- [x] U2 revised. Mobile: the tab bar, option B (owner, 2026-10-15) — Home, Sessions · **+** ·
  Progress, More: the "+" an amber disc in a hump that rises from the bar's centre (react-native-svg,
  computed from the bar's width), a flat bar of four for parents and students; Schedule leaves the
  bar and lives inside Sessions behind a Lessons | Schedule switch heading both screens (its route,
  stack and links unchanged; Sessions lit while it is in front); the banner, toasts, the reminder and
  the screens' foot clear the hump; the tour's Schedule step lights Sessions *(built 2026-10-15:
  typecheck, lint, jest (93 suites, 523 tests), export green; flows updated (`shell/{navigation,create}`,
  `schedule/*`, `locations/{reminder,schedule-locations}`, `sessions/live`, `exposure/live-surfaces`,
  `onboarding/tour`, new `subflows/open-schedule`) but **unrun: device testing paused by the owner,
  still owed**, with the screenshots. Design entry #52)* *(device-tested 2026-10-16 in b812f93:
  the 13 flows the hump broke fixed, full Maestro suite and `npm run smoke -- mobile` green on iOS and
  Android; released with Phase 35)*

## Portal Phase 35 — North Carolina Math, and choosing curricula

- [x] 53. Mobile: the Curricula card on the Organization screen, and the pickers' curriculum switch,
  unit groups, descriptions and retired-level rule *(built 2026-10-16 with the web, on branch
  `phase35-code`: typecheck, lint, jest green; flow `organization/curricula` written. Still owed:
  `mobile:export`, the flow and `progress/*` on iOS and Android, and `npm run smoke -- mobile`. Merged onto the UI upgrades 2026-10-16: the switch, unit groups and
  descriptions now sit inside U5's planned-first, collapsed-level assessment editor)* *(ab40973,
  2026-10-16: `mobile:export`, `organization/curricula`, `progress/*` and `npm run smoke -- mobile`
  green on iOS and Android; released to production with Phase 35)*

## Portal Phase 36 — the question bank on the phone

- [x] 54. Mobile: the question bank in the console. Covers:
  - the coverage: totals, levels, standards and "Review N checked";
  - the review queue, one question at a time: Approve, Retire, Skip and "N left";
  - a standard's questions by status: Approve, Retire and Restore;
  - maths by KaTeX, run on Hermes and shown in one `react-native-webview` per card. This needs a
    native rebuild of both dev builds and the personal build;
  - caches updated from each answer instead of refetched, to save D1 reads.

  Writing, editing, checking and the AI page stay on the web. *(owner, 2026-10-17; design
  entry #54. Built 2026-10-17: typecheck, lint, jest (614) and `mobile:export` green; flows
  `question-bank/{coverage,review,standard-actions}`, `platform/org-admin-denied`,
  `exposure/platform-boundary` and `smoke/diagnostics` (`diag-katex` "ok" on Hermes) green on iOS 27
  (iPhone 17) and Android 37 (Medium Phone); `npm run smoke -- mobile` green on both. Both dev
  builds carry react-native-webview; the e2e variant and the personal device build still need
  their rebuild.)*

## Portal Phase 38 — the Assessment menu (beta)

- [x] 55. Mobile: the Assessment menu (beta), at parity with the web — the menu entry with its Beta
  badge (only while the organization has it on), the Organization screen's two switches, starting
  one and the list, taking one (KaTeX question, lettered choices, a canvas with pen, eraser, undo
  and clear, the work kept on the device until submitted) and the reviewer's PDF drawn in the app by
  pdf.js. Built 2026-10-18 (design 55); jest, typecheck, lint and export green; the flows
  `canvas-assessments/{take,review,menu,open}` green on iOS and Android.

## Portal Phase 40 — the tutor reviews it online, and the organization sets its length

- [x] 56. Mobile: reviewing an assessment online, at parity with the web — the submitted pages with
  the tutor's red ink, a note per question and an overall comment, a self-saving draft, "Save as
  reviewed" and "Reopen review"; the reviewed PDF for the student's whole audience; the list's new
  states and buttons; the Organization card's question count. Built 2026-10-18 (design 56); jest,
  typecheck, lint and export green; the flows `canvas-assessments/{review-online,review-reopen,
  question-count}` (and Phase 38's four) green on iOS and Android; `smoke -- mobile` green.

## Portal Phase 42 — Question Quest (gamification)

- [x] 57. Mobile: Question Quest, at parity with the web — the Organization screen's Gamification
  switch; Quest in More and Search while it is on; the Quest page (Your Quest, Answers to review,
  the students' levels); a student's Quest and a reviewer's queue full screen outside the tabs (KaTeX
  question, large choices, a number keypad, Submit with no going back, points; the key, the
  student's answer and mark, the solution, Question is right / has a problem with a reason); the
  iPad layout; the once-per-sign-in landing. Built 2026-10-20 (design 57); jest, typecheck, lint and
  export green; the flows `quest/{play,play-number,review,level,menu,finished}` green on iOS and
  Android; `canvas-assessments/*` and `smoke -- mobile` green on both; the six quest flows also green on the iPad Pro
  13-inch simulator (side-by-side layout seen in its screenshots). Committed with Phase 42. Left for
  the owner: the status bar on iOS (needs `UIViewControllerBasedStatusBarAppearance`) and keeping the
  screen awake (needs `expo-keep-awake` as the app's own dependency).

## Portal Phase 43 — the tutor's Home (app-first, the owner's word, 2026-10-20; the web is owed)

- [x] 58. Mobile: the tutor's Home — the Now card (a finished lesson celebrated with confetti once
  per phone, Record it now with the schedule and last time's homework filled in, Later; else the next
  lesson whenever it is, with Directions / Open the link and Start lesson or See the plan) and the
  brief (homework, where, next on the plan, assessment notes hidden until tapped), for tutors and
  admins who tutor; Analytics moved to More → Dashboard; Recent Activity off every Home. Built
  2026-10-20 (design 58). jest, typecheck, lint and export green; the flows
  `home/*` (the five new ones and the five moved), `dashboard/*` and `locations/reminder` green on iOS
  and Android; `smoke -- mobile` green on both. The web half is owed.

## Portal Phase 46 — Quest Games (parity: the web half is built)

- [x] 60. Mobile: Quest Games, at parity with the web — the Games panel on the Quest page for every
  role (a parent's only panel): Start a game (a form sheet: level with its count, questions or minutes,
  marking, team size), Join with a code (a sheet that looks the code up: on my own, start a team, a
  team's code, or the named team), the recent games; one full-screen game route
  `quest/games/[gameId]` (lobby with the code and Share, the host's Begin / Cancel; play with Submit /
  Skip, right or wrong at once, the server-set clock, the scoreboard under the question or beside it on
  an iPad; results with the winner and the team's questions one at a time with the answers), polled
  every 2 s only while focused and not finished; first names only (R20). Designed 2026-10-21
  (design 60). Flows to write: `quest/{game-start,game-join,game-play,game-team}` with the scripts
  `quest-games-start.js`, `quest-game-act.js`, `quest-games-end.js`. Built 2026-10-21 (build notes under
  design 60): typecheck, lint, Jest (`game-model`, `game-html`, `games-api` tests) and the export
  green. Tested 2026-10-22: `quest/{game-start,game-join,game-play,game-team}` and the six Phase 42
  `quest/*` flows green on iOS and Android (20/20), the four game flows on the iPad (dark); `smoke --
  mobile` green on both; jest 770. Three app fixes from the flows (the amount's keypad, `OptionPicker`'s
  first tap, the hub's stale game status): build log, design 60.

## Portal Phase 47 — Quest Games, round two (parity: the web half is built)

- [x] 61. Mobile: Quest Games, round two, at parity with the web (`docs/quest-games-g2-plan.md`) —
  Start a game as a five-step wizard on `StepFlow` (the `quest/new-game` route, now a card rising from
  the bottom): favorites first (a tap goes to the Review; the × asks, then deletes), level tiles with
  their counts and Random with "Starting at"; count or timed on a − / + stepper; points for right and
  wrong and Knockout; Single player or Multiplayer (most teams, on their own or teams of 2-6, joining
  closed or open); the Review with Save as a favorite and Generate game code / Start game, which replaces
  the wizard. Joining: "Join the game" alone in a game of one-player teams, no "on my own" in a game of
  teams, the single-player and late-joining lookups. The game status page: "Start the Quest", the doors
  countdown (5 s, the server's clock, Reanimated, words only under reduce motion), the "Game status"
  waiting card, the results with the end reason, confetti for winners, the K.O. stamp and the
  encouragement. Beta on Quest (More, Search, the Quest screen). Designed 2026-10-22 (design 61). New
  pieces: `start-game-flow.tsx`, `game-wizard-model.ts`, `game-tile.tsx`, `game-effects.tsx`,
  `components/number-stepper.tsx`; `StepFlow` gains `submitTestID` and `review.trail`; `new-game-sheet.tsx`
  goes. Flows to change: `quest/{game-start,game-join,game-play,game-team,menu}`; to write:
  `quest/{game-late-join,game-single,game-favorites,game-knockout}`; scripts: `waitForStart`, setups
  `late` / `single` / `knockout`, `answer-wrong`, favorites cleared at the end. Built 2026-10-22 (build notes under
  design 61): typecheck, lint (0 errors), Jest (119 suites, 822 tests; new `game-wizard-model`,
  `number-stepper`, `game-effects`, `start-game-flow`, `game-join-choices` tests) and the export green; the
  flows and scripts written (the scripts' setups checked against the local Worker). Tested 2026-10-22
  (test notes and Verified under design 61): every `quest/*` flow green on iOS and Android (seven flow
  faults fixed in the flows, no app defect), `smoke -- mobile` green on both, the game flows on the iPad
  in dark mode 8/9 -- `game-join` red there at the lower-case code, Phase 46's known keystroke race in
  `games-panel.tsx` (design 60); fixed the same day (`typedGameCode`: a code field is no longer
  rewritten as it is typed), `game-join` then green on both phones and 3/3 on the iPad.

## Portal Phase 50 — feature sets (parity: the web half is built by the lead)

- [x] 62. Mobile: feature sets (Tutoring, Assessment, Quest), at parity with the web
  (`docs/open-signup-plan.md`, R23) — the menu, Search, the tab bar (Home and More without Tutoring, the
  "+" centred), the create sheet (Start an assessment for an admin without Tutoring), the quick actions
  and the tour follow `featureOn`; Home without Tutoring is the space home (the Assessment home, a Quest
  card, a switched-off or empty state), never reading `/dashboard`; every route of a set is wrapped in
  `FeatureGate` ("Not part of this space"; `GATED_ROUTES`, checked by a test); a 403
  `feature_unavailable` re-reads the session (at most once in 10 s) and `ErrorState` shows the calm words;
  the wizard, the person form (the tutor role and Tutoring's fields hidden and omitted from the request),
  the record and the Organization screen follow the allowed sets; the console shows and toggles them and
  creates with them. Built and tested 2026-10-24 (build note under design 62): typecheck, lint, Jest
  (124 suites, 890 tests) and the export green; `features/*` (nine flows, `assess-home` tagged smoke) and
  the other smoke flows green on iOS and Android against the e2e Release build.

## Portal Phases 51 and 52 — groundwork for open sign-in, and spaces (parity: the web half is built by the lead)

- [x] 63. Mobile: signing up and spaces, at parity with the web (`docs/open-signup-plan.md`, R6, R21) —
  Google sign-in sends `signup: true` and a newcomer answers About you (birth month and year, the terms;
  under 13 nothing is kept); with sign-in off, an unknown address offers "Sign up as …". The Welcome (a
  person in no space): join with a code, requests waiting with Withdraw, a decline shown once, make a space
  (adults), Delete my account; "Join or make another space" from the picker and the account sheet. The
  Space screen (was Organization): the code with Share (the portal's address in the message), Make a new
  code, joining on/off; Leave; Delete the space (a self-serve admin, typing its name); no email card in a
  self-serve space. People: Requests to join (Let in opens the person form prefilled, Decline); the
  parent's consent for a student in a self-serve space; "This is my child" in the wizard. Phase 51: the
  terms and privacy links, the calm rate limit, the untrusted Quest toast, the console's "Suggested by
  spaces" and its Quest trust switch. "Space" for "organization" on screen, guarded by
  `src/test/wording.test.ts`. Built and tested 2026-10-24 (build note under design 63): typecheck, lint (0 errors) and Jest (135 suites, 978 tests) green, the export bundles; `spaces/*` (7 flows) green on the iOS simulator and the Android emulator; the changed `organization/*`, `organizations/*`, `platform/{organizations,admins-people,org-admin-denied}`, `exposure/student-controls`, `shell/navigation`, `canvas-assessments/{menu,question-count}`, `features/{organization,person-form}`, `people/create-student`, `onboarding/wizard-admin` and `search/admin` green on both; `features/console` green on Android and red on iOS (the console row's label is the name alone, so the flow's `.*Tutoring, Assessment` is not found; the row is unchanged), `people/directory-admin` green on iOS and red on Android (a guardian below the fold; the person detail is unchanged); `npm run smoke -- mobile` green on both (7/7 each), on the development build.

## Portal Phase 54 — tutor spaces and organizations (parity: the web half is built by the lead)

- [x] 64. Mobile: a space run by an organization or paid directly, at parity with the web
  (`docs/tutor-spaces-plan.md`, R24) — lesson money labels with no cut on a lesson paid directly; Billing's
  "Families and tutors", a tutor recording payments they received (the payee), an admin choosing the tutor,
  the Year-end summary; the dashboard's Finance (admin, tutor) and the parent's "What you owe each tutor";
  the Space screen's paid-directly card or "Run by <organization>"; the console's Organizations (list,
  form, archive) and a space's Organization choice. Built and tested 2026-10-26 (build note under design 64): the e2e Release build from this worktree, local Worker only; `tutor-spaces/*` (4) green on the iOS simulator and the Android emulator; the touched `billing/*`, `dashboard/{finance-admin,finance-tutor,finance-ssn-receipt,parent}`, `platform/{organizations,admins-people,org-admin-denied,logo}`, `organization/*` and `quest/play-number` (fixed: `UNTIL_NUMBER`) green on both; `features/console` green on Android, red on iOS (after a toast or a native alert in the console, the next form sheet does not present on iOS: not this phase's code; reported); the smoke flows 7/7 on both (iOS `spaces/sign-up` flaky on Maestro's hideKeyboard: 2 of 4 runs); typecheck, lint (0 errors), Jest 138 suites / 1010 tests, export green

## Portal Phases 55 and 56 — more ways to sign in, sharing Quest (parity: the web half is built by the lead)

- [x] 65. Mobile: Microsoft, Apple (off, behind `EXPO_PUBLIC_APPLE_SIGN_IN`) and Facebook sign-in beside
  Google, and My profile's "Ways to sign in" (`docs/social-login-plan.md`); Share on Quest's game results,
  "Challenge a friend", the level-finished banner, and Your shares (`docs/sharing-plan.md`, R22). New native
  modules: `expo-auth-session` (with `expo-crypto`, `expo-web-browser`), `expo-apple-authentication`,
  `react-native-view-shot` -- the development, e2e, personal and test builds are rebuilt. Built 2026-10-26
  (build note under design 65).

## Portal Phase 58 — the progress report (parity: the web half is built by the lead)

- [x] 66. Mobile: the "Progress report" panel last on a student's progress page (From, To, Include original
  assessment, Generate Progress; `progressReportRangeProblem` inline, the button disabled while it holds)
  and `/progress/report/[studentId]`, the Worker's PDF in the assessment PDF's pdf.js viewer (bytes in memory,
  never on disk, no share sheet; the server's message for a 400 or 404) (`docs/progress-report-plan.md`).
  Built 2026-10-29: typecheck, lint (0 errors), Jest 146 suites / 1046 tests green; `progress/progress-report`
  written, not yet run on either platform.

## Portal Phase 59 — one word, spaces (parity: the web half is built by the lead)

- [x] 67. Mobile: S1-S3 of `docs/spaces-plan.md` — no screen says "organization" (`wording.test.ts` with no
  exceptions left, and `apps/mobile/src` in `scripts/check-ui-words.mjs`); the console's Organizations gone,
  a space's form choosing **Who families pay** ("The space" with its payer details, or "Each tutor,
  directly"; `PUT …/payment-model`); the list rows "families pay the space" / "families pay each tutor";
  "This space may use", "Assessment in this space", "Quest in this space", and the Space screen's payer
  sentence. Built 2026-10-31 (build note under design 67): typecheck (root, with `ui-words` now over `apps/mobile/src`), lint (0 errors), Jest 145 suites / 1047 tests, export green; on the development build through Metro, local Worker and seed only: `tutor-spaces/console-payment`, `features/organization`, `platform/organizations`, `organization/*`, `tutor-spaces/admin-finance` green on the iOS simulator and the Android emulator; `features/console` green on Android, and on iOS red once then green (the known Phase 54 iOS issue: after a native alert the next form sheet may not present), `quest/menu` green on Android and red on iOS three times at its second `scrollUntilVisible org-quest-switch` -- also red with this phase's title reverted, so it predates this change (reported); `organization/notifications` red once on Android (a "just now" timing assertion), green on rerun.

## Portal Phase 60 — arriving and choosing (parity: the web half is built by the lead)

- [x] 68. Mobile: S4-S9 of `docs/spaces-plan.md` — the landing rule (`landingFor` on the shared `decideLanding`;
  the server's last choice over `tmi.lastOrg`), Spaces (`app/spaces.tsx`: the selector and the in-frame page,
  Invitations, Your spaces with Here now and Leave, the console link, the Welcome with "Requests sent"), no
  star anywhere, Home's invitation banner, the account sheet's "All spaces" and invitation count, leaving
  through `POST /spaces/:slug/leave`. Built 2026-10-31 (build note under design 68): typecheck, lint, Jest 146 / 1070, export green; the changed flows and `spaces/*`, `shell/navigation` green on iOS and Android.

## Portal Phase 61 — new spaces and newcomers (parity: the web half is built by the lead)

- [x] 69. Mobile: S11-S12 of `docs/spaces-plan.md` (S10, S13 are the server's) — the Welcome's "Join with a code" and
  "Start a space" (a 13-17 sees only the first), and the new space's "Invite people" step before the wizard's start
  (`app/(org)/onboarding/invite.tsx`, `InvitePeople`: rows on the shared `spaceInviteRowSchema` / `inviteRowRequest`,
  Share with `invitationText`, the code card, Skip / Continue). Built 2026-10-31 (build note under design 69): typecheck, lint (0 errors), Jest 148 suites / 1076 tests, export green; `spaces/{make-space,sign-up,decline}` green on iOS and Android (development build through Metro).

## Portal Phase 62, P0 — sign-in switches (parity: the web half is built by the lead)

- [x] 70. Mobile: `X-Client: app` on every request; the console's Settings (gear in the header) with the Sign-in
  section, one card per client on `GET`/`PUT /api/platform/sign-in`. Built 2026-11-01 (build-log 70): typecheck,
  lint (0 errors), Jest 149 suites / 1091 tests, export green; `platform/sign-in-settings` green on iOS and Android.

## Portal Phase 62, P1 — checked questions, per space (parity: the web half is built by the lead)

- [ ] 71. Mobile: the console's space form gains "Checked questions (Beta)" (`checked_questions` in the features
  PUT); the Space page's Assessment card shows a read-only note in place of "Include questions not yet reviewed".
  Built 2026-11-01 (build-log 71): typecheck, lint (0 errors), Jest 149 suites / 1097 tests green; the console
  flow (`spaces/console`) not yet run (waiting on the lead's web suite).

## Portal Phase 62, P3-P8 — one tap (parity: the web half is built by the lead)

- [x] 72. Mobile: P3's Beta chip test; P5's console Play section (Settings screen: Play home switch, depth, tiles
  with guest state, members switch, order, add and remove, Default tiles; `GET`/`PUT /api/platform/play`,
  `POST /api/platform/play/reset-tiles`); P6's Play home leading Home (space without Tutoring, students anywhere;
  staff and parents in Tutoring spaces get the favorites row and Waiting for you); P7's one-tap favorites (a
  multiplayer one with `host_plays`) and the lobby's QR code and Share; P8's roster dialog and Waiting for you;
  the "Play <tile>" quick action. P4 needed nothing (`gameRefetchInterval`). Built 2026-11-01 (build-log 72):
  typecheck, lint (0 errors), Jest 156 suites / 1140 tests, export green; `play/{play-home,favorites,family}`
  green on the iOS simulator and the Android emulator (2026-11-01).

## Portal Phase 63 — open door (parity: the web half is built by the lead)

- [ ] 73. Mobile: P10-P16 of `docs/stickiness-plan.md` (P9 and P15's dataset are the Worker's) — the guest Play
  home as the first screen while `config.guest` is present (outside both guards, with `play/[code]` and the
  `sign-up-sheet` form sheet), a guest's quest and Assessment played and marked on the phone, the offer and its
  paused clock, sign-up as a sheet landing in the personal space (no Welcome), `aimtrue://play/<CODE>` and a member's
  tile start, anonymous counts, and the console's Guest play section. The spaces flows rewritten for sign-up's new
  landing. Built 2026-11-01 (build-log 73): typecheck, lint, Jest and export green (see the report); the
  `guest/*` and rewritten `spaces/*` flows written, not yet run (waiting on the lead's web suite).

## Portal Phase 64 — habit (parity: the web half is built by the lead)

- [x] 74. Mobile: P17-P20 of `docs/stickiness-plan.md` — My progress on the Play home (streak, today's ring, badges),
  Today's Daily (`(org)/quest/daily/[level]`: five questions without keys, the answers posted once, the result with
  the grid, the keys and Share), a tile's Best, New best! on a single player's results, and the console's Daily set
  switch; and Phase 63's grade carry-over (P13), found missing by the gate. Built 2026-11-01, gate run 2026-11-02
  (build-log 74): typecheck, lint (0 errors), Jest 165 suites / 1204 tests green; `play/*` (4) and `spaces/*`
  (18) green on iOS and Android, `guest/*` (3) green on both (Android `guest-signup`'s one-second splash missed
  by Maestro once in four runs); `npm run smoke -- mobile` 9/9 on both.

## The guest home redesign — direction C, Quest board (parity: the web half is built by the lead)

- [x] 75. Mobile: the signed-out Play home as the Quest board (`docs/landing-page-proposal.md`, "The owner's
  decisions (2026-11-02)"): the band, Today's 5 (`app/play/today.tsx`, kept on the phone as the day's hits), the
  grade row 1-8, game cards from `guestBoard` with Advanced, the grown-ups' panels, three answers and the footer
  (Contact us from `PLATFORM_CONTACT_EMAIL`, welcome.tsx too); every level and tile a guest reads masked
  (`guestTileName` / `guestLevelWords`). Built 2026-11-02: typecheck, lint (0 errors), Jest 165 suites / 1213 tests;
  `guest/*` (4, `guest-today` new) on the iOS simulator and the Android emulator (see parity.md).


## Portal Phase 65 — who may sign up (parity: the web half is built by the lead)

- [x] 76. Mobile: A6-A7 of `docs/access-approval-plan.md` -- the console's Sign-up access inside Guest play (the
  three modes, the Pre-approved list, Waiting for approval with Approve / Decline, Recently decided with Revoke /
  Approve, the waiting count on the console's gear) on `GET`/`PUT /api/platform/access` and its list and account
  routes; and the refusal screen (`screen-access-refused`: Waiting for approval / Access not approved / Sign-up is
  by invitation, the server's words, Contact us, Back) for any 403 `access_pending` / `access_declined` /
  `not_on_list` -- the sign-up sheet shows it instead of the splash. Built 2026-11-03: typecheck, lint (0 errors), Jest 167 suites / 1232 tests, export
  green; `platform/access` green on iOS and Android once Xcode's first launch was run; a row at the top of
  Settings (mode, who waits, Review) jumps past the tiles to the block.

## Portal Phase 66 — one home, one Next up (parity: the web half is built by the lead)

- [x] 77. Mobile: H1-H4, H9, H11 of `docs/member-home-plan.md` (build-log entry 75) -- the member home for every
  space on `GET /api/home`: the band (`home-band`, `home-greeting`, `home-strip`), ONE Next up (`next-up`,
  `next-up-<kind>`, `next-up-action`, `next-up-later`; Later for the day on this phone, `tmi.homeLater`), quick
  actions (`quick-<action>`), a section per hat (`home-section-<hat>`: To record, Needs you, the children's cards
  or `home-children-empty`, Practice with the Play and Assessment homes); no money on Home. The role dashboards
  moved to More → Dashboard (`/analytics`, every role where Tutoring is on, role chips on the page, the eye);
  `AnalyticsScreen` and `SpaceHomeScreen` removed; `QuestLanding` kept until Phase 67; `TodayCard` →
  `ScheduleTodayCard`; one start lead (shared `START_LEAD_MINUTES`, 15). Built 2026-11-03: typecheck, lint
  (0 errors), Jest and export green; flows `home/member-home-*` and the dashboard flows through
  `subflows/open-dashboard.yaml`. `npm run smoke -- mobile`: Android 10/10; iOS 9/10, `play/play-home` red
  on a section taller than the screen (scroll fixed, then green on iOS and Android in the reset run of
  `flows/home` + `play/play-home`). `flows/home` (16 flows, resets): green on both but `next-up-cancel`
  (both) -- run 15:50-16:30 ET on a Tuesday, when the seed's own Sofia-with-Alex lesson (4-5 PM) is the next
  card with Start; a clock collision of the seed, wider under the old 60-minute lead; to rerun after 5 PM.

## Portal Phase 67 — coloured tiles and a newcomer's continuity (parity: the web half is built by the lead)

- [x] 78. Mobile: H5-H8 of `docs/member-home-plan.md` (build-log entry 76) -- the shared QuestCard / TodayCard / grade
  row (`features/play/quest-card.tsx`) on the guest home and the member Play home; the Quest board (`play-board`,
  `play-grade-<n>`, grade hues from the `grade1..8` tokens, ADV, "Advanced", "More levels", "Show your work" for
  oneself); the Daily as rings (`play-daily`); the week strip, welcome back and the next badge in My progress; Next up's
  `question_quest` and `welcome_back`; QuestLanding retired. Built 2026-11-03: typecheck, lint (0 errors),
  Jest 169 suites / 1262 tests, export green; the Phase 67 flows green on iOS and Android; `npm run smoke -- mobile` 10/10
  on both.

## Portal Phase 68 — focus and families (parity: the web half is built by the lead)

- [x] 79. Mobile: H4/H10 of `docs/member-home-plan.md` (build-log entry 77) -- "Make this my home" (`home/pin-home.tsx`,
  `PUT /home/pin`), the focus-led learner section, the parent card's days played and "Play with <child>" /
  "Practise together before <day>'s lesson", Next up's `practise_before` and `focus_default`, and sign-up's
  `arrived_via` from the phone's guest play. Built 2026-11-03: typecheck, lint (0 errors), Jest, export green;
  `flows/home` + `flows/play` green on iOS and Android (iOS `dashboard-analytics` green on rerun); `npm run smoke --
  mobile` 10/10 on iOS and on Android.

## Portal Phase 69 — stickiness, measured (parity: the web half is built by the lead)

- [x] 80. Mobile: H12 of `docs/member-home-plan.md` (build-log entry 78) -- the console's Stickiness
  (`(platform)/platform-stickiness`, from the chart beside the Settings gear): the visit switch held until the privacy
  notice covers visits, Recompute, six tiles, two charts, retention by week 1/4/8 (`GET`/`PUT /platform/visits`, `GET
  /platform/stickiness`, `POST /platform/stickiness/refresh`). Built 2026-11-04: typecheck, lint (0 errors), Jest, export green;
  `flows/platform` (8, `stickiness` new) green on iOS and Android; `npm run smoke -- mobile` 10/10 on iOS and on Android.
- [x] 81. Mobile: member-home fixes across feature sets (build-log entry 79) -- "Your learning" (was "Practice"), its next
  lesson left out while Next up shows it, one muted line when it would be empty, the Play home's heading a "Quest"
  sub-label, a child's card with Tutoring and Quest off (Assessments, else "Lessons and quests are off"). 2026-11-04.
- [x] 82. Mobile: the tour is Tutoring's (`tourOffered`: no wizard or tour offer by itself, no "Take the tour" in the
  account sheet or Search where Tutoring is off; "Invite people" still opens) and the console's space form (name, short
  name, then what it may use; Quest alone ticked for a new space; clock, who families pay and email notifications only
  with Tutoring) (build-log entry 80). 2026-11-04.
- [x] 83. Mobile: the tour on the member home (build-log entry 81) -- the web's Phase 66 steps (the band, Next up, To
  record, the children, then Dashboard under More and the menu), the home's blocks registered as tour targets. 2026-11-04.

## Journey fixes, the fix-up and Phases 70-71 (`docs/journey-fixes-plan.md`; parity: the web half is built by the lead)

- [x] 84. Mobile: the fix-up (2026-11-04, `8173a2a`) -- the home's "Have a code?" quick action no longer crashes
  (`ToastBridge`), an error screen with a way home (`RouteError`, the `(org)` layout's `ErrorBoundary`), every answer
  choice in view, the tour only where Tutoring is on and the wizard's "Done". `home/quick-code` new; `canvas-assessments`,
  `onboarding` green on iOS.
- [x] 85. Mobile: Phase 70 UI (2026-11-04, `023ba00`) -- refusals over the app with Keep playing back to the question,
  the address in full, Ask for an invitation, Use another account; an under-13 refusal remembered as a one-way key; the
  months as a grid; the guest page's audience line and FAQ. `platform/access`, `spaces/sign-up`, `guest/*` green on iOS.
- [x] 86. Mobile: Phase 71 and the 70+71 contract (2026-11-04) -- the Let in sheet (role, then the child: link, add now,
  later), the empty student picker naming the space's admins, one `mayAddPeople` rule, the requests card on the home
  until dismissed with the account button's badge, the access note before sign-up, the checked address on a not-on-the-list
  refusal. Jest 1384/1384; 39 touched flows on iOS (`spaces/*`, `people/*`, `home/*`, `features/*`, `shell/create`);
  the touched set on Android; `npm run smoke` on both.
- [x] 87. Mobile: Phase 72's app half (2026-11-05, build-log entry 82) -- the one "Have a code?" sheet (`/have-a-code`:
  a space's name, then the role and a note, then Ask; a game's code to its join sheet), the code and a friend's quest
  kept on the device signed out and offered once on the first home, the guest page's door and its example drawn as an
  illustration; Join with a code and Start a space in the account sheet and the (+), "Space settings", the 13-17 card;
  the invitation's who and where, "Just you", the terms once for someone a space added; Let in on the asked role with
  the note. Typecheck, lint, Jest and export green; the flows written (`home/quick-code`, `spaces/let-in`,
  `spaces/legal`, `spaces/start-a-space`, `guest/have-code` and the touched ones), 13 in all, green on the iOS
  simulator and the Android emulator. Found on the way: the guest page's code dialog lost fast-typed letters (its state
  sat outside the Paper portal; it now lives inside), the join note is one line whose Return puts the keyboard away,
  and Spaces opened from "Start a space" puts that card first (Android left the focused field under the keyboard).
- [x] 88. Mobile: Phase 73's app half (2026-11-05, build-log entry 83) -- Continue from the server's open game (the
  board, Next up's `open_game`, the iPhone home-screen action and its screen), "Play … again" with none open, the
  device's last quest removed; the board's grade from the server's lead, saved when tapped, "Which grade?" once (the
  guest grade carried once instead, also over the age guess); one Daily rule and "Today's Daily" everywhere a member
  reads it; games and Waiting for you in words; My progress's one state; an empty game is "Nobody played"; New Quest
  and Join keep `from`, results refresh Home. Typecheck, lint, Jest and export green; flows written (`play/continue`,
  `play/grade` new; `play/play-home`, `play/habit`, `play/family`, `quest/game-start`, `quest/game-single`,
  `guest/guest-signup`, `journeys/j01a-24-continue` updated), not yet run on the iOS simulator or the Android emulator. The 8 Phase 73 flows (`play/continue`, `play/grade`, and the updated `play/*`, `quest/game-start`, `quest/game-single`,
  `guest/guest-signup`) green on the iOS simulator and the Android emulator.
- [x] 89. Mobile: Phase 74's app half (2026-11-05, build-log entry 84) -- the first home: the server's hat order kept
  (a parent's child, then the office, then playing where Tutoring is off), the office's non-zero counts (open
  assessments too) or "Nothing needs you right now.", a child's card that opens the child; the band's three doors and
  "Start a streak" for a learner who has not played here, never a zero, never what Next up says, nothing of lessons
  where Tutoring is off; the board's Daily and Continue quiet beside Next up's, no New Quest or "Have a code?" twins;
  the Dashboard on the home's hat (else the role last chosen in the space), "Viewing as"; the tour once per person, its
  offer a card in the home, never back after the wizard, no parent Billing step; Users, Pairings and Billing for admins
  and tutors only, the words of a space that bills nobody; lesson lines with their place, practice from the learner's
  lesson line, Practise before the week ahead. Typecheck, lint, Jest and export green; flows written (`home/first-home`
  new; `home/member-home-space`, `home/member-home-student`, `home/member-home-parent`, `home/member-home-multirole`,
  `home/quick-code`, `home/dashboard-analytics`, `dashboard/role-selector`, `onboarding/tour`,
  `onboarding/confirm-details`, `onboarding/wizard-admin`, `features/wizard`, `spaces/make-space`,
  `spaces/new-space-quest`, `shell/navigation`, the office's dashboard flows and `subflows/open-dashboard` updated), not
  yet run on the iOS simulator or the Android emulator. The 22 Phase 74 flows (`home/first-home` and the updated home, dashboard, onboarding, spaces and finance flows)
  green on the iOS simulator and the Android emulator; found on the way: a role chosen on the Dashboard did not stick
  after "Back to mine" (fixed in `dashboard-role.ts`).
- [x] 90. Mobile: Phases 75 and 76's app half (2026-11-05, build-log entry 85) -- the tutor's record (JF18, JF19, JF27,
  JF30): every "Record a lesson" door opens the lessons still owed (`GET /sessions/to-record`) with "Another lesson",
  a blank record with no day or times filled in; To record leads Sessions' Tutoring tab; a known lesson opens "Record a
  lesson" ("It ran as planned" / "Write up the lesson"), or the reader's draft of it ("Draft saved 12:43 PM",
  Continue) from Home, Next up, Sessions and the owed list; a running lesson leads Next up with Stop; Start and Stop
  say a price refusal once, in the reader's words, and Keep going keeps the note; "No price set" on the student, the
  pairing and the schedule; the price fields' example is helper text; the pairing form never copies the tutor's
  default and an override equal to it reads as the default; "lesson" and "Record" on these surfaces. Adding people one
  way (JF21, JF37): the Add chooser (`/add`) from the home's quick action ("Add my child" in a personal space), the
  (+)'s "Add people", People's header and empty state; "My child"; the next steps after each save (`nextStepsAfterAdd`,
  "Set a weekly lesson" on the schedule flow's `?assignment=`); Invite by email at any time; Share invitation on invited
  rows with a confirmation; the status words; the student's tutors and weekly lessons. Typecheck, lint, Jest and export
  green; flows written (`sessions/lessons-owed`, `people/add-chooser`, `subflows/record-choose-when` new; the session,
  home, pairings, people, shell, spaces and exposure flows listed in entry 85 updated). The 24 flows (and
  `exposure/money-tutoring`, `dictation/dictate-ssn`, `dictation/dictate-permission`) green on the iOS simulator and the
  Android emulator; found on the way: on Android a fitted quick sheet took its content's whole height and never
  scrolled, so the office's long owed list hid "Another lesson" (fixed: `quickSheetMaxHeight` caps it under the status
  bar, with a Jest test); `subflows/record-choose-when` overrode its caller's length (fixed, and `sessions/record` now
  checks the end time).
- [x] 91. Mobile: Phase 77's app half (2026-11-05, build-log entry 86) -- families at home (JF15, JF20). Play with, on
  one device: a child who does not sign in (`HomeChild.signs_in === false`) gets "Play with Ben on this device" (or
  "Practise together before Saturday's lesson" with "Ben plays beside you, on this device." under it) -- one request
  (`playTogetherRequest`, `seat_user_ids`), begun at once at the child's grade (`childPlayLevel`: `grade` through the
  board's rules, else the last level, else the first tile), no lobby, no code; the game screen takes turns
  (`SeatedPlay`): "Ben's turn" / "Pass the device to Ben." (answered with `as_user_id`), then "Your turn" / "Ben has
  answered: take the device back.", the child first on each question, both scores by first name, "Ben: Right! +1",
  each player's own result ("You: 0 right, 0 points · 2nd"); "Continue with Ben" (`open_game_id`) reopens it on the
  same turn; a child who signs in keeps the online invite, and the lobby says "Invited: Sanjay" ("(joined)" once in).
  A guardian continues the child's assessment: Continue for a guardian (`can_continue`), Discard only where
  `can_discard` (older Worker: `can_continue`); "Hand the device to Noor" before the questions ("Noor is ready", "Not
  now"); after a submit "Noor's tutor gets a PDF…" / "The space's admins get a PDF of Noor's answers.", no PDF link;
  Start warns "Noor already has a Grade 4 assessment in progress (started 8 minutes ago)." with Continue it, Start
  another and Not now. Typecheck, lint, Jest (191 suites, 1585 tests) and export green; flows written, not yet run on
  the iOS simulator or the Android emulator (`play/play-on-device`, `canvas-assessments/hand-over` new;
  `play/play-with-child`, `play/family`, `canvas-assessments/take`, `features/assess-start` updated).
- [x] 92. Mobile: Phase 78's app half (2026-11-06, build-log entry 87) -- the look (JF28's rest, JF29, JF32's rest,
  JF34, JF35's rest; Phase 75's and 77's carried notes). No Beta a player, family or member reads (the console keeps
  its own, marked `ui-words:`); the glossary's words (the tab "Lessons", "People", "Add a person", quests, lessons),
  the (+) and the home's quick actions from `quickActionLabel`; levels, quests and favorites in words, tile codes off
  the cards (a favorite keeps its code as its key, said by `favoriteWords`, as on the web); the Daily's button and hit
  rings in the space's primary, the guest tiles in the grade hues; the chosen grade chip's 2pt ring, the 12pt "Adv"
  pill, named picker rows that look like their role, the regenerated palettes with the drawer's accent restated and
  `check-contrast.mjs`'s new pairs; a 12pt floor and sentence-case eyebrows; names that wrap, the grade row's edge
  fade and scroll-into-view, the (+)'s inset; the year list near an adult's year, Single player first, "Leave" in
  words; one shared date formatter; the office's owed lessons as the newest five and "Show all"; the results at the
  top when a quest ends, and one `now` on Assessments. Typecheck, lint, Jest (192 suites, 1599 tests) and export
  green; the words check has no app failures. Flows edited, not yet run on the iOS simulator or the Android
  emulator: `activity/admin`, `activity/tutor`, `canvas-assessments/menu`, `open`, `question-count`, `take`,
  `comments/feed`, `dashboard/parent`, `dashboard/student`, `dictation/dictate-notes`, `dictate-permission`,
  `dictate-ssn`, `exposure/narrow-audiences`, `platform-boundary`, `student-controls`, `guest/guest-signup`,
  `have-code`, `home/next-up-start`, `quick-code`, `locations/schedule-locations`, `onboarding/tour`,
  `organization/notifications`, `people/add-chooser`, `edit`, `tutor-view`, `play/continue`, `favorites`,
  `play-home`, `play-on-device`, `quest/game-favorites`, `game-join`, `game-knockout`, `game-late-join`,
  `game-single`, `game-start`, `game-team`, `level`, `menu`, `play`, `schedule/cancel-restore`, `editor`,
  `schedule-lesson`, `sessions/assess`, `autosave`, `drafts`, `lessons-owed`, `list-admin`, `list-parent`,
  `list-tutor`, `live`, `record-finance`, `record`, `row-menu`, `shell/navigation`, `spaces/new-space-quest`, and the
  journeys `j04a-19`, `j07a-31`, `j15a-17`, `j15a-20`, `j15a-21`.
- [x] 93. Mobile: Phase 79's app half (2026-11-06, build-log entry 88) -- members (M1-M6): a person in a space with no
  role. Their tab bar is Home and More with no (+); More and search leave out Dashboard, Lessons, Schedule, Progress,
  Comments and Assessment (`NavItem.teaching`, shared `seesTeachingPages`); no wizard or tour (`tourOffered(org,
  roles)`); Home is the learner's board, the Assessment section only with `may_assess`; a link to Assessment says
  "Assessments here are for students." and reads nothing. "Member" wherever a person holds no role (a quiet badge,
  `rolesLabel` on the account sheet, Spaces, search, the card's screen-reader line; view-as leaves members out), the
  role selector's member line, People's "Members" filter. Adding: the chooser's shared words ("Anyone, by email",
  "Someone, with details"), the invite rows on Member by default (a radio row that fits at 360pt); Let in starts on
  Member for a learner or no role, offers a teen no Admin, and asks about a child after Parent only. Typecheck, lint
  (0 errors), Jest (193 suites, 1634 tests) and export green. Flows written, not yet run on the iOS simulator or the
  Android emulator: `home/member-home-member` and `spaces/let-in-teen` (new); `people/add-chooser`, `spaces/invite`,
  `spaces/let-in`, `shell/navigation` updated. They need the Phase 79 Worker (`POST /users` with `roles: []`,
  `role=member`, `JoinRequest.teen`, `may_assess` for a member). Run 2026-11-06/07: green on both (see 94).
- [x] 94. Mobile: Phase 80's app half (2026-11-06, build-log entry 89) -- approved into a space (A11-A13, A15). The
  console's Approve (waiting, or declined lately) opens a sheet, `/approve-account`: "Place them in a space (optional)"
  over the spaces (`GET /platform/access/spaces`, read only while it is open), Nowhere by default; once chosen, Member,
  or Admin for a console-made space and an adult, the `placementWords` sentence and `PLACEMENT_QUEST_OFF` where Quest
  is off; Approve sends `space`, a refusal stays in the sheet; Recently decided says "Joined <space>" / "Asked to join
  <space>". Home leads with the one-time offer while `personal_space_offer` ("Want a space of your own too?", Make my
  space / No thanks, `POST /spaces/personal`, then "Your own space is ready." with Open it). Spaces and Welcome offer
  "Make my own space" to any self sign-up without one, teens too. Typecheck, lint (0 errors), Jest (196 suites, 1667
  tests) and export green. Flows written, not yet run on the iOS simulator or the Android emulator: `home/personal-offer`
  (new); `platform/access`, `spaces/sign-up` (smoke), `spaces/spaces-page`, `spaces/decline` updated; `access.js` gains
  `mode`, `pending`, `approve` and `count`. They need the Phase 80 Worker (the phase-80 column, `personal_space_offer`,
  the placement routes). Run 2026-11-06/07 with Phase 79's: the twelve flows green on the iOS simulator and the
  Android emulator. iOS needed two fixes: the approve sheet is a page sheet there (in an iOS form sheet the spaces'
  list was stretched over the title and the search field), and `spaces/spaces-page` waits for the page to settle and
  scrolls Withdraw into view before tapping (assertions unchanged). Jest 196 suites, 1669 tests; `smoke -- mobile`
  10/10 on both.

## Phase 4 — Google sign-in

> Status (2026-10-16): the core is done another way. G1 signs in through `POST /api/auth/google`
> and its cookie, so no bearer sessions were needed; the app signs in with Google on real iPhones
> against production. Left: the Android OAuth client (G2). The items below are kept as the
> original plan and are not owed unless the owner asks for bearer sessions.


- [ ] API: bearer sessions for the mobile app
- [ ] Mobile sign-in: Google, as on the portal
- [ ] Docs: Google OAuth clients for iOS and Android

## Phase 5 — real devices

> Status (2026-10-16): iOS on the owner's family phones is done with the free Personal Team
> (`real-devices.md`: Nav, Shradha and Om, reinstalled every 7 days). Android devices, EAS profiles
> and the store builds wait on the paid Apple account and Play Console (T2).


- [ ] Mobile devices: LAN server, signing and EAS profiles
- [ ] Docs: running on real devices and what the stores need

## Blocked / notes

- ~~For #23 (from #17): the cancelled lessons panel on the Sessions Tutoring tab~~ — done in #23 (folded to one line on the phone, so the lessons stay on the first screen).

- ~~For the owner (#15): a student sees "You pay" on the web dashboard, the app hides it~~ — owner (2026-10-16): match; the web's student dashboard now hides money too (prices stay on Sessions' Finance tab on both).

- ~~Android launch stall~~ — fixed (2026-10-08): Hermes on Android builds and runs Intl formatters 30–45x slower than iOS, and screens re-rendering each second kept the JS thread saturated. `src/polyfills/intl-cache.ts` reuses one formatter per (locale, options) and memoizes results; 9/9 repeat runs green where 3/9 failed.
  Seen again in #21's final run, eight dashboard/session flows at once on a long-running emulator; it happens with the live lesson banner's host removed too, so it predates #20.
  Seen again in #23's final run on an emulator up 21 hours (memory full, 500 MB in swap): six dashboard/session flows timed out on "Loading your dashboard…" and the Pairings list sat on its skeletons for over 45 s. After `adb reboot` every one of them passed. A long-running emulator is the likeliest cause; rebooting it before a full run is worth making a habit.
  Found in #24 (2026-10-09): the AVD is configured with **one CPU core** (`hw.cpu.ncore=1` in `~/.android/avd/Medium_Phone.avd/config.ini`). Freshly rebooted, it took 90 s+ to show Priya's dashboard with or without new code. Restarted with `emulator -avd Medium_Phone_API_37.0 -no-snapshot-save -no-boot-anim -cores 4 -memory 4096`, every flow ran green. Setting `hw.cpu.ncore=4` in the AVD config (the owner's call) would make it stick.
- ~~For the owner (#19, #21): the web's drafts panel opened a stale autosaved draft~~ — fixed 2026-10-16: the web's `useAutosaveDraft` keeps the cached list in step and recording from a draft refreshes it; `session-autosave.spec.ts` now opens Edit after a second autosave.
- For the owner: the SSN chase list (`/dashboard` `tutors_missing_ssn`) and the year-end list (`/payments/tax-status`) disagree for a tutor with no activity (Johan). Each screen shows what its endpoint sends; it's a web/API question, not a mobile one.

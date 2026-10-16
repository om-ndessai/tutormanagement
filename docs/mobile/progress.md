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
- [ ] U2 revised. Mobile: the tab bar, option B (owner, 2026-10-15) — Home, Sessions · **+** ·
  Progress, More: the "+" an amber disc in a hump that rises from the bar's centre (react-native-svg,
  computed from the bar's width), a flat bar of four for parents and students; Schedule leaves the
  bar and lives inside Sessions behind a Lessons | Schedule switch heading both screens (its route,
  stack and links unchanged; Sessions lit while it is in front); the banner, toasts, the reminder and
  the screens' foot clear the hump; the tour's Schedule step lights Sessions *(built 2026-10-15:
  typecheck, lint, jest (93 suites, 523 tests), export green; flows updated (`shell/{navigation,create}`,
  `schedule/*`, `locations/{reminder,schedule-locations}`, `sessions/live`, `exposure/live-surfaces`,
  `onboarding/tour`, new `subflows/open-schedule`) but **unrun: device testing paused by the owner,
  still owed**, with the screenshots. Design entry #52)*

## Phase 4 — Google sign-in

- [ ] API: bearer sessions for the mobile app
- [ ] Mobile sign-in: Google, as on the portal
- [ ] Docs: Google OAuth clients for iOS and Android

## Phase 5 — real devices

- [ ] Mobile devices: LAN server, signing and EAS profiles
- [ ] Docs: running on real devices and what the stores need

## Blocked / notes

- ~~For #23 (from #17): the cancelled lessons panel on the Sessions Tutoring tab~~ — done in #23 (folded to one line on the phone, so the lessons stay on the first screen).

- For the owner (#15): the server sends a student their own lessons with `money_view: 'family'`, and the web's StudentView renders them through SessionMoney, so a student sees "You pay" on the web. The app hides money on the student dashboard; should the web match?

- ~~Android launch stall~~ — fixed (2026-10-08): Hermes on Android builds and runs Intl formatters 30–45x slower than iOS, and screens re-rendering each second kept the JS thread saturated. `src/polyfills/intl-cache.ts` reuses one formatter per (locale, options) and memoizes results; 9/9 repeat runs green where 3/9 failed.
  Seen again in #21's final run, eight dashboard/session flows at once on a long-running emulator; it happens with the live lesson banner's host removed too, so it predates #20.
  Seen again in #23's final run on an emulator up 21 hours (memory full, 500 MB in swap): six dashboard/session flows timed out on "Loading your dashboard…" and the Pairings list sat on its skeletons for over 45 s. After `adb reboot` every one of them passed. A long-running emulator is the likeliest cause; rebooting it before a full run is worth making a habit.
  Found in #24 (2026-10-09): the AVD is configured with **one CPU core** (`hw.cpu.ncore=1` in `~/.android/avd/Medium_Phone.avd/config.ini`). Freshly rebooted, it took 90 s+ to show Priya's dashboard with or without new code. Restarted with `emulator -avd Medium_Phone_API_37.0 -no-snapshot-save -no-boot-anim -cores 4 -memory 4096`, every flow ran green. Setting `hw.cpu.ncore=4` in the AVD config (the owner's call) would make it stick.
- For the owner (#19, #21): the web's drafts panel reads the drafts cache, which `useAutosaveDraft` refreshes only when a draft first appears, so "Edit" can open a stale copy of an autosaved draft and posting it writes the stale text back. The app keeps its cache in step (`withDraft`); the web may want the same. Its `useRecordSession` also leaves a consumed draft in the panel until the next refetch.
- For the owner: the SSN chase list (`/dashboard` `tutors_missing_ssn`) and the year-end list (`/payments/tax-status`) disagree for a tutor with no activity (Johan). Each screen shows what its endpoint sends; it's a web/API question, not a mobile one.

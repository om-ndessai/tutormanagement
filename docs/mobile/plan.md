# Mobile app — execution plan for docs/mobileapp.md (Phases 1–5)

## Context

The web portal (Phases 1–32) is complete. `docs/mobileapp.md` asks for a native iOS + Android app built
with React Native that covers every feature of the multi-organization **tutoring** portal. The work
happens on its own branch, which the owner reviews and merges. It must be developed agentically with
developer, architect and tester skills, and tested end to end against a local seeded database (no
Cloudflare quota). Then come a UX pass (2), speech-to-text in record-session (3), Google sign-in (4)
and real devices (5).

**Owner's decisions (2026-10-07):**
- Expo + React Native Paper (MD3) plus a motion stack.
- The platform console is in scope.
- Android Studio is installed (SDK, emulator, AVD), and the owner has built and run an Android and an iOS app. A few shell-level tools remain; see the checklist.
- Run Phases 1–5 straight through, then hand over for review.

**What exploration established:**
- The API reads identity only from the `tmi_session` cookie. There is no Bearer support.
- Locally `AUTH_ENABLED=false`, so `X-Dev-User: <email>` picks the person, and `X-Organization` names the organization on every request.
- `@tmi/shared` is raw TypeScript with `.js` import suffixes and depends only on zod. It uses `Intl.DateTimeFormat` with `timeZone`, `RelativeTimeFormat` and currency formatting.
- Web uses React 19.3 and TypeScript 7.
- Palettes exist only as OKLCH in `apps/web/src/index.css`.
- There are no unit tests, no lint, no CI, and no project skills or agents.
- This Mac has Xcode 27 with the iOS 27 simulators, and Android Studio with its SDK, an AVD and a bundled Java 25. CocoaPods, watchman, Maestro and Homebrew are not installed, and `JAVA_HOME` and `ANDROID_HOME` are not exported.
- Locally `DEFAULT_ORGANIZATION` is `tmi`, which the seed lacks, so the API brands with `PLATFORM_BRAND` and the app lands on the picker. That is the "tutoring" behaviour wanted.

## Ground rules for the whole run

- **This plan lives in the repo.** The first execution step, right after creating the branch, copies this plan verbatim into `docs/mobile/plan.md` (beside `docs/mobileapp.md`, which it answers). It is updated as decisions change and lands in commit 1.
- **Branch.** `mobile-app`, cut from `main` (`1132322`). Never commit to `main`, merge, rebase or force-push. If `main` moves, merge `main` in.
- **Pushing.** Push `mobile-app` to origin at each phase end (the git push prompt applies). Open a **draft PR** "Mobile app (do not merge — owner review)" at handover.
- **Nothing remote.** No `deploy`, no `deploy:test` (the demo keeps running `main`), no `--remote` D1, no `npm run e2e`. Everything runs against `wrangler dev` with local D1 and `npm run db:reset`.
- **Web is untouched.** `git diff main --stat -- apps/web` stays empty. Only Phase 4 touches `apps/api` and `packages/shared`, additively, with no schema change.
- **Commits, one per feature.** Format: `Mobile: <Feature> — <what>`. Other prefixes: `Workflow:`, `Docs:`, `Mobile tests:`, `Mobile UX:`, `Mobile dictation:`, `API:`, `Mobile sign-in:`, `Mobile devices:`. The body lists the web sources ported, the endpoints, the exposure rules touched and the flows added. It ends with the session trailers.
- **CLAUDE.md rules carry over verbatim:**
  - money only from the reader's side (`SessionMoney`)
  - no money anywhere on Tutoring, failing closed
  - SSN never leaves the device or touches storage
  - the organization on every request
  - `brand.short`, never a hardcoded organization name
  - colours from tokens only
  - comment, reflection and cancellation audience rules come from the server
  - nothing crosses organizations: `queryClient.clear()` on switch and sign-out, and **no on-disk query cache**

## Toolchain checklist (the owner runs this; written into `docs/mobile/setup.md`)

**✅ Toolchain complete (verified 2026-10-07, login shell).**
- `xcode-select -p` points at `/Applications/Xcode.app/Contents/Developer`: Xcode 27.0 (27A266a), iOS 27.0 runtime, iPhone 17 booted.
- `sdkmanager` 1.0.16500706 and `avdmanager` are on the PATH; AVD `Medium_Phone_API_37.0` (Google Play image).
- Java: OpenJDK 25.0.3 from Android Studio.
- CocoaPods, watchman, Maestro, `adb` and `emulator` all resolve.

Items A and B below are done and kept for the record.

**Status, re-checked 2026-10-07 in a login shell.**

In place:
- `JAVA_HOME` points at Android Studio's bundled runtime (OpenJDK 25.0.3).
- `ANDROID_HOME` is `~/Library/Android/sdk`, with platform `android-37.0`, build-tools 36.0.0, a 37.0 system image and the AVD `Medium_Phone_API_37.0`.
- `adb` 1.0.41 and `emulator` are on the PATH.
- Homebrew 7.0.8, CocoaPods 1.17.0, watchman 2026.10.05.00 and Maestro 2.11.0 are installed.

**Still to do:**

A. **Point the active developer directory back at Xcode.** Installing Homebrew installed the standalone Command Line Tools and made them active (`xcode-select -p` prints `/Library/Developer/CommandLineTools`). `xcodebuild`, `xcrun simctl` and `npx expo run:ios` refuse until this is switched back:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -runFirstLaunch
   ```
   Verify: `xcode-select -p` prints `/Applications/Xcode.app/Contents/Developer`, `xcodebuild -version` prints Xcode 27, and `xcrun simctl list runtimes` lists iOS 27.

B. **Android SDK Command-line Tools (recommended).** These provide `sdkmanager` and `avdmanager`, which the scripts use to accept licenses and create or inspect AVDs.
   1. In Android Studio, go to Settings → Languages & Frameworks → Android SDK → SDK Tools, tick "Android SDK Command-line Tools (latest)", and Apply.
   2. Add this to `~/.zprofile`:
      ```sh
      export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
      ```
   Verify: `sdkmanager --version`. Gradle downloads any other build-tools or platform version the Expo SDK pins, because the licenses are already accepted.

Earlier notes on the original checklist, kept for reference:

**Already in place (checked 2026-10-07).**
- Xcode 27 and the iOS 27 simulators.
- Android Studio with the SDK in `~/Library/Android/sdk` (build-tools, platform-tools, emulator, platforms, system images) and the AVD `Medium_Phone_API_37.0`.
- Android Studio's bundled Java runtime: OpenJDK 25.0.3 at `/Applications/Android Studio.app/Contents/jbr/Contents/Home`.

**Zulu is not needed.** Point `JAVA_HOME` at that bundled runtime. Gradle, the command-line Android builds (`npx expo run:android`) and Maestro all use it. Fallback: if the chosen Expo SDK's Gradle refuses Java 25, install `zulu@17` then, and only then.

**What remains.** None of these are on the shell `PATH` yet: `adb`, `emulator`, `pod`, `watchman`, `maestro`, `brew`. `/usr/bin/java` is only the macOS stub.

1. Add to `~/.zprofile`, then open a new terminal:
   ```sh
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$HOME/.maestro/bin:$PATH"
   ```
2. Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`. It is needed for CocoaPods, because the system Ruby 2.6 is too old for `gem install cocoapods`.
3. `brew install cocoapods watchman`.
   - CocoaPods is required: `npx expo run:ios` runs `pod install` on the generated `ios/`.
   - watchman is recommended: Metro works without it, but its file watching is faster and steadier with it.
4. `curl -fsSL "https://get.maestro.mobile.dev" | bash` installs the end-to-end runner.
5. Verify: `java -version` (25), `adb version`, `emulator -list-avds`, `pod --version`, `watchman --version`, `maestro --version`.

Every feature is checked on both the iOS simulator and the Android emulator from the start.

## Architecture

**Location and install**
- The app lives in `apps/mobile` (`@tmi/mobile`). It uses Expo at the **latest stable SDK at execution time**, checked with `npm view expo dist-tags`, and must support Xcode 27 / iOS 27. If it doesn't, use the beta or install an iOS 26 runtime.
- **React version gate (first step).**
  - If Expo's pinned `react` equals web's 19.3.x, use it as a plain workspace.
  - Otherwise use an **isolated install**:
    - root `workspaces` becomes `["apps/api","apps/web","packages/*","e2e"]`
    - `apps/mobile` gets its own lockfile, plus `"@tmi/shared": "file:../../packages/shared"`, and its own zod and TypeScript
    - Metro `disableHierarchicalLookup` is set
    - root `npm run mobile:install`
    - root `typecheck` appends `scripts/typecheck-mobile.mjs`, which skips politely if mobile dependencies aren't installed
    - This never changes what web installs and avoids a TS 7 vs Expo types clash.
  - Verify with `npm ls react` (one copy), `npx expo-doctor` clean, and `npx expo export` for both platforms.

**Native projects, Metro and Hermes**
- Continuous Native Generation: `ios/` and `android/` are gitignored and generated by `expo prebuild`. Dev builds use expo-dev-client.
- `app.config.ts` has variants `development | e2e | production` (bundle id suffixes and scheme `tutorportal`).
- Metro: `watchFolders` includes `packages/shared`. Add a `resolveRequest` that maps `.js` to `.ts` for `packages/shared/src`, only if bundling fails without it.
- Hermes:
  - `src/polyfills/intl.ts` adds the `@formatjs` RelativeTimeFormat, PluralRules and Locale polyfills, with `en` data and `shouldPolyfill` guards.
  - `z.config({ jitless: true })` if zod misbehaves.
  - Add a hand-written `toQueryString`, because RN's `URLSearchParams` is incomplete.
  - A dev-only `app/(dev)/diagnostics.tsx` and a Maestro flow assert `formatCents`, `zonedClockParts` for each `ORG_TIME_ZONES` entry, `formatRelativeTime` and `containsSsn` on both platforms. Add `@formatjs/intl-datetimeformat` only if one platform fails.

**Libraries**
- expo-router (typed routes)
- react-native-paper v5
- Reanimated, Gesture Handler
- native `formSheet` with detents for forms; `@gorhom/bottom-sheet` for in-screen sheets
- react-native-svg, FlashList, expo-image
- expo-secure-store (Phase 4 token only), AsyncStorage (preferences)
- expo-file-system, expo-sharing, expo-print
- expo-image-picker, expo-image-manipulator
- expo-haptics, expo-screen-capture
- TanStack Query v5

**Layout**
- `app/` holds thin expo-router routes that mirror the web routes:
  - `sign-in`, `server`, `select-organization`
  - `(platform)/…`
  - `(org)/(tabs)/…`: index (dashboard with `?tab`, `?as`, `?role`), sessions, schedule, progress, people, more
  - stack screens: pairings, billing, comments, activity, organization, profile, search
  - sheet routes for every form: record-session, person-form, payment-form, schedule-form, assignment-form, assessment-form, plan-form, form-1099, onboarding/*
  - `(dev)/…`, left out of production builds
- `src/` holds:
  - `lib/`: api-client, events, server, storage, download, query-string
  - `providers/`: auth, brand, theme, query
  - `theme/`: generated palettes, the Paper theme, tokens
  - `components/`: Screen, Section, StatCard, Panel, TutoringFinanceTabs, Skeleton, OrgAvatar and others
  - `features/<feature>/`, the same grouping as web, each with an `api.ts`
  - `dev/personas.ts`

**Tabs by role** (the union, in a fixed order, for someone who holds several roles):
- Admin: Home, Sessions, Schedule, People, More
- Tutor: Home, Sessions, Schedule, Progress, More
- Parent: Home, Schedule, Progress, Billing, More
- Student: Home, Schedule, Progress, More

"More" is a port of `NAV_ITEMS`, filtered by role as on the web.

**API client** (`src/lib/api-client.ts`, ported from `apps/web/src/lib/api-client.ts`)
- The same `ApiRequestError` / `fieldErrors` and envelope handling as web.
- The base URL is absolute and comes from a server store:
  - Local: `localhost:8787` on iOS; on Android, `adb reverse` or `10.0.2.2`
  - LAN (Phase 5)
  - Demo: manual browsing only, never tests
  - Production: from Phase 4
- Headers: `X-Organization` always, `X-Dev-User` while the server reports `auth_enabled:false`, and from Phase 4 `Authorization: Bearer` with `credentials:'omit'`.
- `window` events become a typed emitter (`unauthenticated`, `organization-required`).
- `focusManager` is wired to AppState and `onlineManager` to expo-network.

**Feature hooks.** Each `apps/web/src/features/*/api.ts` is **copied, not moved**, with identical query keys and invalidation, and a `Ported from … @ <sha>` header. `docs/mobile/parity.md` tracks web file → mobile file → flow → status. Extracting a shared `packages/client` is a post-merge follow-up.

**Auth and landing.** Port `applySession` as a pure `chooseLandingOrg`, unit-tested. Order: a deep-linked org, then the starred default (web parity), then the last org (if still enterable), then a single membership, then the picker. `POST /auth/enter` follows. Before an organization is chosen, the brand is always `PLATFORM_BRAND`.

**Phase 1 sign-in**
- A developer sign-in screen (seed personas mirroring `e2e/support/people.ts`, plus a free email field) is shown only when the server reports auth off and the variant isn't production.
- Maestro signs in via `tutorportal://dev/link?as=&org=&server=local`, available in dev and e2e variants only.

**Brand and theme.** `apps/mobile/scripts/generate-palettes.mjs` parses the `index.css` palette blocks (light and dark) and converts OKLCH to hex into `src/theme/palettes.generated.ts`. Its `--check` mode runs inside typecheck, so `index.css` stays the single source and web is untouched. `paper-theme.ts` maps the tokens to MD3 roles. Light, dark and system modes follow `Appearance` plus a stored preference.

**Web-only replacements**
- **1099**
  - The SSN lives only in sheet state (`secureTextEntry`, no autofill or autocorrect) and is cleared on close or background.
  - `usePreventScreenCapture` while the sheet is open.
  - The HTML is built on the device and printed with `Print.printAsync({html})`.
  - **`printToFileAsync` is banned** by lint and the rules script, because it would write a PDF containing the SSN into the cache.
  - The SSN never goes in route params, logs or the query cache.
- **CSV and ICS.** `download.ts` fetches with the same headers into the cache, then `Sharing.shareAsync`, then **deletes the file**.
- **Progress chart.** Port the 533-line SVG to react-native-svg.
- **⌘K.** Becomes a Search screen with role-filtered nav, `useUsers` people search and actions.
- **Tour.** A custom spotlight overlay over registered `tourId` refs, steps ported from `tour-steps.ts`. The wizard opens the app's real form routes with `preset`/`sections`, never second copies of forms.
- **Logo upload.** Image picker, then convert to PNG/WebP, then a client-side 256 KB check, then a raw `PUT`.
- **Live session.** A persistent banner above the tabs with stopwatch, Stop and Cancel. The stop toast shows the length, never the pay.

## Resumable orchestration (quota-safe)

The run is unattended (auto mode, Phases 1–5 straight through), so it must survive Claude Code usage limits.

- **The state lives in git, not in conversation.**
  - `docs/mobile/progress.md` is a checklist of every commit in the sequence below (`[ ]` todo, `[~]` in progress with notes, `[x]` done plus SHA). It is updated and committed with each feature.
  - `git log main..mobile-app` is the ground truth: a feature is done when its commit exists.
  - Uncommitted work-in-progress is committed as `WIP: <feature>` before any risky long step, and squashed into the feature commit with `git reset --soft` on resume. This never rewrites anything already pushed.
- **Resume procedure, the same every time.**
  1. Read `progress.md` and `git status`/`git log`.
  2. Finish or redo the `[~]` item.
  3. Continue down the list.
  Any session, or a fresh agent, can pick up from those two sources alone.
- **When a subagent fails on a quota or rate limit:**
  - Record the item as `[~] blocked: quota at <time>`.
  - Schedule a check every 5 minutes (CronCreate `*/5 * * * *`, or a ScheduleWakeup of 300 s) whose prompt is "resume docs/mobile/progress.md".
  - Each check makes one cheap probe, a tiny subagent call.
    - If it still fails, wait for the next check.
    - If it succeeds, delete the cron, re-dispatch the blocked item, and continue.
  - If the main loop itself hits the limit, the cron fires once the quota is back and resumes from `progress.md`.
- **Subagents get self-contained prompts.** Each prompt names the item, its design entry in `build-log.md`, its files and its definition of done, so re-running one after a reset is idempotent. Check the tree before re-dispatching: if the commit already landed, skip it.
- **Wall-clock work runs in the background.** Simulator, emulator and Maestro runs use background Bash or Monitor, so a pause loses no build output; logs go to `apps/mobile/.maestro/out/`.

## Agentic development setup

- **Skills**
  - `.claude/skills/mobile-architect/SKILL.md`: per feature, read the web sources and endpoints, check `docs/data-exposure.md` and the CLAUDE.md rules, choose routes, sheets, testIDs and immersive patterns, and plan flows and tests. Writes a design entry in `docs/mobile/build-log.md`. It has an audit mode for Phase 2.
  - `.claude/skills/mobile-developer/SKILL.md`: conventions, port-with-provenance, theme and money rules, fail-closed `showMoney`, SSN rules, testIDs and accessibility labels, commands, and the definition of done.
  - `.claude/skills/mobile-tester/SKILL.md`: Maestro conventions, a persona matrix (admin, tutor, parent, student, parent+tutor, student+tutor, org-B admin, platform admin), exposure assertions, simulator and emulator screenshots read back visually in light and dark, Jest patterns, flake triage, and never against the demo or production.
- **Agents.** Thin `.claude/agents/mobile-{architect,developer,tester}.md` that invoke their skill first. The tester gets Bash, Read and Grep only, and runs Android passes in parallel.
- **Loop per feature.** Architect design entry → developer implements → tester writes and runs flows and Jest on iOS (and Android) → fix → commit. `build-log.md` is the evidence the skills were used.
- **Docs.**
  - `apps/mobile/CLAUDE.md` holds the mobile rules and commands.
  - Root `CLAUDE.md` gets a short "Mobile app (branch `mobile-app`)" section that records the branch exception and points to `docs/mobile/`.
- **`.claude/settings.json`**
  - Allow: `npx expo`, `maestro`, `xcrun simctl`, `adb`, `emulator`, `pod install`, `git switch` / `git branch`, and mobile npm scripts.
  - Ask: `eas` and `gh pr create`.
  - Deny: `eas submit`.

## Testing

- **Maestro** (`apps/mobile/.maestro/`)
  - A `sign-in-as` subflow (deep link with clearState).
  - Flows per feature, tagged `smoke`, `feature` and `exposure`.
  - `extendedWaitUntil`, never sleeps.
  - The e2e variant uses a Release bundle with reduced motion and LogBox off.
  - testIDs: `screen-<route>`, `<feature>-<element>[-<id>]`. `SessionMoney`'s root is always `session-money`.
- **Exposure flows**
  - No `session-money` and no `$` on any Tutoring tab, for every persona.
  - A parent sees only "You pay"; a tutor sees only "Your pay".
  - Priya in `riverside` sees no `chmi` student.
  - A student cannot cancel.
  - A person's comments are hidden from another tutor.
- **Runner.** `scripts/e2e-mobile.sh` (root `npm run e2e:mobile [ios|android|both] [--tags]`):
  1. Refuses unless the URL is localhost, 127.0.0.1 or 10.0.2.2, and unless auth is off.
  2. Runs `npm run db:reset` and starts `dev:api` if it isn't running.
  3. Builds or installs the e2e variant.
  4. Boots the simulator or emulator (`adb reverse tcp:8787 tcp:8787`).
  5. Runs `maestro test` with JUnit output, resetting the database between platforms.
- **Jest** (jest-expo + RNTL):
  - palette conversion and staleness
  - api-client headers and errors
  - `toQueryString`
  - `chooseLandingOrg`
  - `SessionMoney` for each `money_view`
  - Tutoring components given admin-money fixtures render no `$`
  - the 1099 builder escapes and makes no fetch
  - `download.ts` deletes the file after sharing
  - dictation (Phase 3)

## Workflow improvements

- ESLint (`eslint-config-expo`) and Prettier, scoped to `apps/mobile`.
- Restricted patterns: `printToFileAsync`, hex literals outside `src/theme`, `formatCents` outside the finance and `session-money` files, and storage near "ssn".
- `apps/mobile/scripts/check-mobile-rules.mjs` (no seeded organization names in `src/` or `app/`) runs inside typecheck.
- **CI** (`.github/workflows/ci.yml`, the repo's first), on Ubuntu:
  - Job 1: `npm ci`, typecheck, web build.
  - Job 2: mobile install, lint, jest, expo-doctor, `expo export` for both platforms.
  - No macOS or emulator jobs, because of cost. Running Playwright in CI is a documented follow-up.
- `.github/pull_request_template.md` with the CLAUDE.md rules checklist.
- No husky or lint-staged.
- `eas.json` profiles (development, e2e, preview, production) in Phase 5.

## Commit sequence

**Phase 1**
1. Docs: mobile plan, toolchain checklist, immersive design research (`docs/mobile/{plan,README,setup,immersive-design,parity}.md`)
2. Workflow: mobile architect, developer and tester skills (and agents, settings, CLAUDE.md)
3. Mobile: Expo app scaffold in the monorepo (React gate, Metro, tsconfig, variants)
4. Workflow: lint, format and unit tests for the mobile app
5. Mobile: shared contract on Hermes: resolution, Intl polyfills, diagnostics
6. Mobile: brand palettes and Paper theme generated from the web tokens
7. Mobile: API client, server picker and per-request organization
8. Mobile: developer sign-in and session restore
9. Mobile tests: Maestro harness and local seeded runner
10. Workflow: CI for typecheck, lint, unit tests and bundling
11. Mobile: organization picker, invitations, default organization
12. Mobile: app shell: role tabs, org switcher, user menu, live lesson banner
13. Mobile: Dashboard, Tutoring tab: analytics, sessions carousel, reflections, progress spotlight, recent activity
14. Mobile: Dashboard, Finance tab: admin money, tutor payments, monthly finance, tutor earnings
15. Mobile: Dashboard, parent and student views, reflection prompts
16. Mobile: Dashboard, admin view-as and role selector
17. Mobile: Sessions, Tutoring/Finance list, filters, focus
18. Mobile: Sessions, record a lesson: write-up parts, ratings, own assessment, previous lesson
19. Mobile: Sessions, drafts and 3-second autosave
20. Mobile: Sessions, live lesson: start, timer, stop, cancel
21. Mobile: Sessions, notes, assessments and student reflections
22. Mobile: Pairings, assignments and rate overrides
23. Mobile: Schedule, weekly view, editor, cancel/restore a date, cancelled lessons, calendar files
24. Mobile: Progress, list, student chart, assessments, plans, topic ratings
25. Mobile: People, directory, search, filters, detail, comments, delete/restore
26. Mobile: People, person form (all sections, availability grid, guardians, payment handles)
27. Mobile: Billing, balances, payment log, record payment, CSV and tax summary
28. Mobile: Year-end, 1099 printed on device, SSN receipts
29. Mobile: Comments, feed and threads
30. Mobile: Activity, audit log
31. Mobile: Organization, TIN, payer address, email notifications and log
32. Mobile: Profile and appearance
33. Mobile: Search, pages, people and actions
34. Mobile: Welcome wizard, guided setup and tour
35. Mobile: Platform console, organizations, branding, logo upload, admins, people, activity
36. Mobile tests: exposure across personas

**Phase 2: UX audit and immersive changes**

`docs/mobile/ux-audit.md` uses Nielsen heuristics, the Human Interface Guidelines and Material checklists, and per-screen, per-persona screenshots in light and dark. It measures tap counts, target sizes, contrast, cold start and list jank, and ranks findings by severity. Then one `Mobile UX:` commit per change. Expected changes:
- form sheets with detents and haptics
- large titles, pull-to-refresh, skeletons
- swipe actions with undo snackbars
- optimistic updates
- shared-element session cards
- animated, scrubbable progress chart
- iOS Live Activity / Dynamic Island and an Android ongoing notification for a live lesson, showing "Lesson in progress · 0:42" only
- quick actions (Start/Record lesson)
- a privacy cover in the app switcher
- a native calendar export (expo-calendar)
- Dynamic Type, reduced motion, screen-reader labels, 44pt/48dp targets

Add a mobile-surfaces section to `docs/data-exposure.md` covering the lock screen, notifications, share files, print spool, speech and app-switcher snapshots.

**Immersive design research** (`docs/mobile/immersive-design.md`, written in commit 1 with WebSearch, every source dated):
- Apple Human Interface Guidelines 2025–26 / Liquid Glass (expo-glass-effect, native tabs)
- Material 3 Expressive
- edge-to-edge and predictive back
- large titles and collapsing headers
- sheets and detents
- motion tokens and shared elements
- haptics map
- gestures and swipe actions
- skeletons, optimistic UI
- context menus and previews
- Live Activities and Android live updates
- widgets and quick actions
- accessibility
- privacy-aware immersion

It closes with a per-feature mapping table. Principle: motion explains a change, everything is stilled by reduce-motion, and no money, notes or student names appear on any system surface.

**Phase 3: dictation.** `Mobile dictation: speak a lesson's write-up` (optionally also comments and reflections).
- `expo-speech-recognition` (config plugin). Prefer on-device (`requiresOnDeviceRecognition`, Android offline). Network recognition is off by default behind a one-time consent in Profile. Audio is never stored.
- A `DictationField` wraps notes and the four write-up parts. It shows interim text as an overlay and commits only final text, so the 3-second autosave never posts partial text. It stops on post, close or background.
- `containsSsn` runs on each final transcript; a match is refused inline with `SSN_REJECTED_MESSAGE`.
- `safeParse(sessionDraftInputSchema)` runs before autosave, so the app never loops on 400s.
- Permission strings contain no organization names.
- Tests: Jest mocks the recognizer; the e2e variant has a scriptable fake recognizer for Maestro; real-microphone checks are done by hand.

**Phase 4: Google sign-in.**

API changes, additive and branch-only:
- `apps/api/src/lib/session.ts` gets `sessionTokenFrom(c)`: Bearer first, then the cookie.
- `requireAuth`, plus `/enter` and `/logout` in `routes/auth.ts`, use it.
- Extract `signInWithGoogle` and add `POST /api/auth/google/native`. It reuses `googleSignInSchema` and returns `{token, expires_at, session}`, typed in `packages/shared/src/auth.ts`. It **sets no cookie** and is audited as `auth.signed_in` "…on the mobile app".
- CORS adds `Authorization`.
- The ID token is still verified only by `verifyGoogleIdToken`. `@react-native-google-signin/google-signin` with `webClientId` makes `aud` the existing web client id, so the audience check is unchanged.

App side:
- The token is kept in SecureStore. On a 401 the app retries a silent sign-in.
- Placeholders in `app.config.ts` and `.env.example`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME`, `EXPO_PUBLIC_PRODUCTION_API_URL` (the `tutoring` address, never `tmi-portal`). The Google button is hidden while they are missing.
- Docs: a mobile section in `docs/google-oauth-setup.md`, the owner's checklist in `docs/mobile/google-sign-in.md` (iOS/Android OAuth clients, SHA-1s), and a CLAUDE.md line. Going live is the owner's normal release after merging.

**Phase 5: real devices.**

What gets built:
- `npm run dev:api:lan` (`wrangler dev --ip 0.0.0.0`, with a trusted-network warning) and the LAN server option.
- Android over USB: `adb reverse`, `expo run:android --device`, a debug APK. Cleartext traffic in non-production variants only.
- iOS: free personal-team signing (`expo run:ios --device`), `NSAllowsLocalNetworking`.
- `eas.json` profiles.

`docs/mobile/real-devices.md` lists what the owner must provide:
- Apple Developer Program and Team ID, bundle ids, App Store Connect, privacy labels / `PrivacyInfo.xcprivacy`
- a reviewer demo Google account
- Play Console, package name, keystore / Play App Signing, Data safety
- Google OAuth native clients
- production deploy of the Phase 4 API, the production URL
- final icon and splash art, privacy policy and support URLs
- children's-data obligations
- optional universal links

## Critical files

- **Port from:**
  - `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/organization.ts`
  - `apps/web/src/providers/{auth,brand,theme}-provider.tsx`
  - `apps/web/src/features/*/api.ts`
  - `apps/web/src/features/teaching/{session-form-dialog,session-money,live-session-bar}.tsx`
  - `apps/web/src/features/progress/progress-chart.tsx`
  - `apps/web/src/features/dashboard/form-1099-dialog.tsx`
  - `apps/web/src/features/onboarding/tour-steps.ts`
  - `apps/web/src/components/layout/app-shell.tsx` (`NAV_ITEMS`)
- **Read as source of truth:** `apps/web/src/index.css` (palettes), `packages/shared/src/*`, `e2e/support/people.ts`, `docs/data-exposure.md`
- **Modify:**
  - root `package.json` (workspaces/scripts)
  - `.claude/settings.json`
  - `CLAUDE.md`
  - Phase 4 only: `apps/api/src/{lib/session.ts,middleware/auth.ts,routes/auth.ts,index.ts}`, `packages/shared/src/auth.ts`, `docs/google-oauth-setup.md`
- **New:** `apps/mobile/**`, `.claude/skills/mobile-*/`, `.claude/agents/mobile-*.md`, `docs/mobile/*`, `scripts/e2e-mobile.sh`, `scripts/typecheck-mobile.mjs`, `.github/workflows/ci.yml`

## Verification

- **Per commit**
  - Root `npm run typecheck`, which includes mobile, the palette `--check` and the rules script.
  - Mobile lint and jest, then `npx expo export`.
  - The feature's Maestro flows on the iOS simulator, and on the Android emulator once installed.
  - Screenshots read back in light and dark.
- **Per phase**
  - `npm run e2e:mobile both` green after a fresh `db:reset`.
  - `npx expo-doctor` clean and a single `react` copy.
  - `git diff main --stat -- apps/web` empty.
  - `parity.md` complete.
- **After Phase 4**
  - Temporarily set `AUTH_ENABLED=true` in the uncommitted `.dev.vars` and mint a JWT with jose and `SESSION_SECRET`.
  - curl `/api/auth/session` with Bearer (200), without (401) and with a bad token (401); also `/enter` and `/logout`.
  - Restore `.dev.vars`, then run the full **local** Playwright suite (`npm run db:reset`, `npm run dev`, `E2E_BASE_URL=http://localhost:5173 npm run e2e:test`) to prove web is unchanged.
- **Handover**
  - `git log main..mobile-app --oneline` shows only feature-named commits.
  - Push the branch and open the draft PR.
  - Summarize with emulator screenshots, open items, and the owner checklists (toolchain, Google clients, devices).

## Risks

| Risk | Mitigation |
| --- | --- |
| Xcode 27 is newer than Expo/RN/Maestro support | Use the latest SDK or beta, or an iOS 26 runtime; Detox as fallback |
| Duplicate React, TS 7 | Isolated install |
| Hermes Intl gaps | Polyfills and the diagnostics flow |
| Scope (about 24k lines of web) | Parity tracker and strict order |
| Gradle vs the bundled Java 25 | Check on the first `expo run:android`; if it fails, install `zulu@17` and point `JAVA_HOME` at it |
| Maestro flakiness | testIDs, waits, Release e2e build, reduced motion |
| Money or SSN leaks on new surfaces | Fail-closed tabs, lint bans, exposure flows |
| Dev sign-in in a store build | Compiled out, and the server ignores `X-Dev-User` when auth is on |

# Agent brief: building one mobile feature

Read this whole file before starting. It carries what the skills assume you already know about
this machine and this app. You build **one** item from [progress.md](progress.md), end to end,
and finish with **one commit**.

## The loop (use all three skills, in order)

Invoke each skill with the Skill tool. If the tool doesn't list it (skills added during a
session register on the next one), read `.claude/skills/<name>/SKILL.md` and follow it exactly.
It's the same instructions.

1. **Design.** Invoke the `mobile-architect` skill. Read the web sources for your item (the
   parity row in [parity.md](parity.md) names them) and append the design entry to
   [build-log.md](build-log.md).
2. **Build.** Invoke the `mobile-developer` skill and build exactly what the entry says.
3. **Test.** Invoke the `mobile-tester` skill. Write the Maestro flows and Jest tests and run
   them on **both** the iOS simulator and the Android emulator. Look at the screenshots, then
   append the "Verified" line under your entry.
4. **Wrap up.** Tick the item in progress.md (`[x]`, plus the commit's short SHA in a follow-up
   edit, or leave the SHA off), set the parity rows to `tested`, then make **one commit** on
   branch `mobile-app` (see "Commit" below).

If you stop part-way, mark the item `[~]` in progress.md with a one-line note saying where
you are, so the next agent can resume.

## Machine and environment

- **Toolchain on PATH.** Every Bash command that uses `adb`, `emulator`, `maestro`, `pod`,
  `xcrun` or a native build must start with `source ~/.zprofile;`. The tool shell does not
  load it.
- **Devices:**
  - iOS simulator "iPhone 17", UDID `328F7D61-436F-476E-8380-3B69E6F9F5A1` (iOS 27).
  - Android emulator `emulator-5554` (AVD `Medium_Phone_API_37.0`). If `adb devices` doesn't
    list it, boot it in the background:
    `nohup emulator -avd Medium_Phone_API_37.0 -cores 4 -memory 4096 -no-snapshot-save -no-boot-anim &`
    (the AVD's own config has one core, which makes the app crawl), then wait
    for `sys.boot_completed` to be 1. After any boot, run
    `adb reverse tcp:8787 tcp:8787; adb reverse tcp:8081 tcp:8081`.
- **Local Worker** on `http://localhost:8787`, with sign-in off and the local seeded D1.
  - Check it with `curl -s localhost:8787/api/health`.
  - If it isn't running, start it from the repo root in the background with
    `npm run dev:api`.
  - Reset the data with `npm run db:reset` (repo root). Do this after any flow that changes
    data, and before you finish.
  - **Never** run anything with `--remote`, `npm run deploy*`, `npm run e2e` (that's the web
    suite's remote cycle) or `deploy:test`.
- **Metro** on `:8081`, watch mode, serving the development build
  (`com.tutorportal.app.dev`, installed on both devices). JS changes need no rebuild.
  - Check it with `curl -s localhost:8081/status`.
  - If it's down, start it in the background:
    `cd apps/mobile && npx expo start --dev-client --port 8081`.
  - Don't kill it, the Worker or the emulator when you finish.
- **Native dependency added?** Add it with `npx expo install <pkg>`. Then, in `apps/mobile`:
  1. `npx expo prebuild --no-install`
  2. `CI=1 npx expo run:ios --device "iPhone 17" --no-bundler`
  3. `CI=1 scripts/android-env.sh npx expo run:android --no-bundler`

  An `osascript` error at the end of the iOS run is harmless. Prefer pure-JS solutions where
  they serve.

## Running flows

- **One flow:**
  `source ~/.zprofile; cd apps/mobile && maestro --device <UDID|emulator-5554> test -e APP_ID=com.tutorportal.app.dev --test-output-dir <scratch>/shots <flow.yaml>`
- **Everything** (resets the DB before and after):
  `npm run e2e:mobile -- ios|android|both [flow…]`
- **Subflows** in `.maestro/subflows/`:
  - `sign-in-as.yaml` (env `PERSONA` = email, `ORG` = slug or `""`): fresh launch plus the
    dev deep link.
  - `go-back.yaml`: cross-platform back.
  - `open-link.yaml` (env `LINK`).
- **Rules for flows:**
  - Put flows under `.maestro/flows/<feature>/`, tagged `smoke`, `feature` or `exposure`.
  - Wait with `extendedWaitUntil`, never sleeps. Select by `id:` first.
  - `takeScreenshot: <name>` (a plain name) lands in the output dir. Read the PNGs.
  - Switch to dark mode with `xcrun simctl ui booted appearance dark` (iOS) and
    `adb shell cmd uimode night yes` (Android). Set both back to light afterwards.
- **Personas** (org `chmi` unless noted):

  | Who | Email | Holds |
  | --- | --- | --- |
  | Priya | priya.raghavan@gmail.com | admin+tutor (tutor in `riverside` too) |
  | Alex | alex.chen.math@gmail.com | tutor (parent in riverside) |
  | Maria | maria.okafor@gmail.com | tutor + parent of Sofia |
  | Anita | anita.patel.nc@gmail.com | parent of Sanjay |
  | Sofia | sofia.okafor@gmail.com | student |
  | Sanjay | sanjay.patel.nc@gmail.com | tutor + student |
  | Rosa | rosa.delgado.tutoring@gmail.com | admin of `riverside` |
  | Kwame | kwame.mensah.math@gmail.com | tutor of `riverside` |
  | Nav | ndessai@gmail.com | platform admin, no org |

  Never assert exact counts: the seed has bulk data.

## The app's conventions (apps/mobile, read `apps/mobile/CLAUDE.md` too)

- **Routes.** These live in `src/app/`, kept thin:
  - Tabs: `(org)/(tabs)/{dashboard,sessions,schedule,progress,more}/`, each with its own
    `Stack` (`_layout.tsx`, `useStackOptions()` from `@/features/shell/stack-options`). Put
    detail screens inside the tab's folder, e.g. `sessions/[id].tsx`.
  - Pages under More: `(org)/<name>.tsx`. They're placeholders now; replace yours.
  - Forms: `(org)/<form>.tsx`, registered in `(org)/_layout.tsx` with
    `presentation: 'formSheet'`, `sheetAllowedDetents`, `sheetGrabberVisible`.
  - Set a screen's title inside it: `<Stack.Screen options={{ title }} />`.
- **Feature code** goes in `src/features/<feature>/`, mirroring the web.
  - `api.ts` is **copied** from `apps/web/src/features/<feature>/api.ts`. Start it with
    `// Ported from apps/web/src/... @ 1132322`, swap the client import to
    `@/lib/api-client`, and keep the query keys and invalidations identical.
  - Import the cross-feature hooks the web imports from their own feature folders. Port
    them if they're missing.
- **Building blocks:**
  - `Screen` (`testID`, `edges`, `onRefresh`/`refreshing` for pull-to-refresh)
  - `LoadingState`, `ErrorState` (404 says "not found"), `EmptyState`
  - `useToast()` (success, error, info, with optional `{label, onPress}` action)
  - `haptics` (selection, success, error, warning, impact)
  - `LogoMark`, `OrgAvatar`
  - `useAuth()` (user with roles in this org, organization, `useOrgTimeZone()`), `useBrand()`
  - `useAppTheme()` (Paper MD3 colours plus `.tokens`: the web's token names such as
    `tokens.mutedForeground`, `tokens.rating3`, `tokens.success`, `tokens.warning`,
    `tokens.brand100`)
  - `radius`, `space`, `motion`, `MIN_TARGET` from `@/theme/tokens`
  - Paper components (Card, List, Button, Chip, TextInput, SegmentedButtons, Dialog with
    Portal, Menu, Searchbar, FAB, Snackbar via toast, ProgressBar)
  - `@expo/vector-icons` Material Community names for icons
  - FlashList for long lists. Reanimated for motion, always stilled by `useReducedMotion()`.
- **Rules** (typecheck and lint enforce some of these):
  - **Money:**
    - Render it only through `SessionMoney` and the finance components. `formatCents` is
      only allowed in files whose path matches the money pattern in
      `scripts/check-mobile-rules.mjs`.
    - **No money anywhere on a Tutoring tab** or in anything it opens. `showMoney` defaults
      to false.
  - **SSN:** never in params, storage, logs or files. `printToFileAsync` is banned.
  - **Colours:** no hex or `rgb(` outside `src/theme`.
  - **Names:** no organization name in code. Use `useBrand().short` and data.
  - **Visibility:** what the server decides (`can_delete`, `can_restore`, `mayCancelOn`,
    `mayChangeReflection`, money_view…) stays the server's. The app only hides what the
    server would refuse.
  - **Clock:** dates and times on the organization's clock (`useOrgTimeZone()` +
    `zonedClockParts` from `@tmi/shared`). Never read UTC parts.
  - **Shared code:** import every schema, label and helper from `@tmi/shared`. Validate forms
    with the shared Zod schema (`safeParse`) and show the server's `fieldErrors` under
    fields.
- **testIDs:** `screen-<route>` on each screen root (the `Screen` testID),
  `<feature>-<element>[-<id>]` elsewhere, `session-money` on `SessionMoney`'s root.
  Icon-only buttons get an `accessibilityLabel`.
- **Do not edit** `apps/web`, `apps/api` or `packages/shared` in Phase 1. If the API seems to
  need a change, write it in your design entry's risks and work around it.

## Performance note

Hermes on Android formats with Intl 30–45x slower than iOS. `src/polyfills/intl-cache.ts`
caches formatters and their results, but don't format dates or money in a render that ticks
every second. Keep a ticking clock in its own small component.

## How much to test (keeps an item to about an hour)

- **Per item:** run only your feature's flows plus `smoke/*`, on both platforms, one platform
  at a time (two devices against one local DB delete each other's data). Re-run a failure once
  to tell a flake from a real fault, then fix the cause.
- **Don't run the full 60-flow suite.** It belongs to the phase gate and takes about 3 hours.
  The orchestrator runs it at the end of each phase.
- Every flow that changes data cleans up after itself, before and after it runs, even when it
  fails part-way (see `.maestro/scripts/clean-*.js`).

## Checks before committing (in apps/mobile)

```sh
npx prettier --write src .maestro && npm run typecheck && npm run lint && npx jest
```

All must pass (lint warnings are fine, errors are not). Your feature's flows must be green on
both devices.

## Commit

Run `git add` on your files only (apps/mobile and docs/mobile), then commit on `mobile-app`:

```
Mobile: <Feature> — <what it does>

<what was ported from where; endpoints used; exposure rules kept; flows added and the
platforms they passed on>

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TC46Rj4kfDwRwniJMBAA5i
```

Never commit to `main`, push, merge, rebase or amend someone else's commit. Your final
reply: the commit SHA, the flows and their results per platform, anything you could not do,
and any API gap you found.

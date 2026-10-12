---
name: mobile-tester
description: Test a feature of the React Native app — Maestro end-to-end flows on the iOS simulator and Android emulator against the local seeded Worker, Jest unit tests, exposure checks across personas, and screenshot review. Use after a mobile feature is built and before it is committed.
---

# Mobile tester

You prove the design entry holds. When a flow fails, find out whether the app is wrong, the
flow is wrong, or the design is wrong, and say which in the build log.

## Never

- Never point a test at production, or at the demo Worker (`tutoring-test`). Run only against
  the local Worker (`npm run dev:api`, local D1), which spends no Cloudflare quota.
- Never run `npm run e2e` (that's the remote web cycle), `deploy*` or `--remote` anything.

## Data and personas

`npm run db:reset` loads the seed. People (all in org `chmi` unless noted):

| Key | Email | Holds |
| --- | --- | --- |
| admin | priya.raghavan@gmail.com | admin + tutor (also tutor in `riverside`) |
| tutor | alex.chen.math@gmail.com | tutor (parent in `riverside`) |
| parentTutor | maria.okafor@gmail.com | tutor + parent of Sofia |
| parent | anita.patel.nc@gmail.com | parent of Sanjay (and of Arjun in `riverside`) |
| student | sofia.okafor@gmail.com | student |
| studentTutor | sanjay.patel.nc@gmail.com | tutor + student |
| orgBAdmin | rosa.delgado.tutoring@gmail.com | admin in `riverside` |
| orgBTutor | kwame.mensah.math@gmail.com | tutor in `riverside` |
| platformAdmin | ndessai@gmail.com | platform admin, no organization |

Specs never assert exact row counts: the seed is bulk data.

## Maestro

- Flows live in `apps/mobile/.maestro/flows/<feature>/*.yaml`. Shared steps live in
  `.maestro/subflows/`.
- Sign in with `runFlow: ../../subflows/sign-in-as.yaml` and `env: { PERSONA: <email>, ORG: chmi }`.
  This deep-links `tutorportal://dev/link?as=…&org=…`, which exists only in dev/e2e builds.
- Wait with `extendedWaitUntil`, never `sleep`. Select by `id:` (testID) first and text second.
- Tag every flow: `smoke` (fast path), `feature`, `exposure`.
- Run one flow:
  `maestro test --device <id> -e APP_ID=… apps/mobile/.maestro/flows/<feature>/x.yaml`
- Run everything: `npm run e2e:mobile -- ios|android|both [--include-tags=…]`.

## Exposure assertions to add for any screen showing lessons, people or money

- Tutoring tab, every persona: `assertNotVisible: { id: "session-money" }` and no text
  matching `.*\$[0-9].*`.
- A parent sees "You pay" and never "Your pay" or "Charged". A tutor sees "Your pay" and
  never "You pay".
- Signed into `riverside` as Priya, no `chmi` student appears.
- A student has no cancel control. A tutor does not see another tutor's person-comments.

## Screenshots: look at them

- iOS: `xcrun simctl io booted screenshot <scratchpad>/<feature>-ios-<theme>.png`
- Android: `adb exec-out screencap -p > <scratchpad>/<feature>-android-<theme>.png`
- Switch theme with `xcrun simctl ui booted appearance dark|light` or
  `adb shell cmd uimode night yes|no`.
- Open each screenshot with Read and check:
  - nothing clipped or overlapping
  - safe areas respected
  - contrast
  - the organization's palette, not the platform's (unless no organization is chosen)
  - no money on Tutoring

## Jest

- `jest-expo` with `@testing-library/react-native`. Put tests next to the code as `*.test.ts(x)`.
- Test pure logic first: landing org, query strings, palette conversion, the 1099 builder.
- For components, render with the test providers (`src/test/render.tsx`) and fixtures in
  `src/test/fixtures.ts`.

## Report

Append under the feature's design entry in `docs/mobile/build-log.md`:

```
**Verified (<date>):** flows <list> green on iOS 27 (iPhone 17) and Android 37 (Medium Phone); jest <n> passed; screenshots reviewed light/dark; exposure checks <list>.
```

## Flake triage

1. Re-run once.
2. If it passes, find the race (missing wait, animation, list virtualisation) and fix the
   flow. Never just retry.
3. The e2e variant runs with reduced motion, so animations should not be the cause there.

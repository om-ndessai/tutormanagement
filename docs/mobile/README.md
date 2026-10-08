# The mobile app

A native iOS and Android app for the tutoring portal, built with Expo and React Native on the
branch `mobile-app`. It answers `docs/mobileapp.md`, the owner's five-phase brief. The owner
reviews the branch and merges it; nobody else does.

| Document | What it holds |
| --- | --- |
| [plan.md](plan.md) | The approved execution plan for Phases 1–5 |
| [progress.md](progress.md) | The resumable checklist: one line per commit, ticked with its SHA |
| [setup.md](setup.md) | The toolchain on this Mac, and how to run the app and its tests |
| [parity.md](parity.md) | Each web screen and hook, the mobile file that ports it, and its test flow |
| [immersive-design.md](immersive-design.md) | Research on immersive mobile design, mapped to each feature |
| [build-log.md](build-log.md) | The architect's design entry for each feature, written before it is built |

## Decisions

- **Expo SDK 57** (React Native 0.86, React 19.2.3, expo-router 57). This was the latest
  stable release on 2026-10-07.
- **An isolated install.** Expo pins React 19.2.3 and TypeScript 6, while the web app is on
  React 19.3 and TypeScript 7. A plain workspace would hoist two Reacts into one tree, so
  `apps/mobile` is not an npm workspace. It has its own `package-lock.json` and takes
  `@tmi/shared` as `file:../../packages/shared`, and Metro resolves only from
  `apps/mobile/node_modules`. Nothing the web app installs changes. Run
  `npm run mobile:install` once after cloning.
- **React Native Paper (Material 3)**, themed per organization from the web app's own
  palettes, with Reanimated, Gesture Handler, native form sheets and `@gorhom/bottom-sheet`
  for motion.
- **Same API, same rules.** The app talks to the same Worker as the web app, names its
  organization on every request (`X-Organization`), and keeps every rule in `CLAUDE.md`:
  - money only from the reader's side
  - none on Tutoring
  - no SSN stored or sent
  - `brand.short`, never an organization's name
  - colours from tokens
- **Sign-in.** Until Phase 4 the app signs in only against a server with sign-in switched
  off, the local Worker or the demo, as a seeded person (`X-Dev-User`). Phase 4 adds
  Google.

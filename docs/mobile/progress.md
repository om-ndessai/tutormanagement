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
- [x] 31. Mobile: Organization — TIN, payer address, notifications
- [ ] 32. Mobile: Profile and appearance
- [ ] 33. Mobile: Search — pages, people and actions
- [ ] 34. Mobile: Welcome wizard, guided setup and tour
- [ ] 35. Mobile: Platform console
- [ ] 36. Mobile tests: exposure across personas

## Phase 2 — UX audit and immersive design

- [ ] 37. Docs: mobile UX audit
- [ ] 38+. Mobile UX: one commit per audit finding (listed in ux-audit.md)

## Phase 3 — dictation

- [ ] Mobile dictation: speak a lesson's write-up

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

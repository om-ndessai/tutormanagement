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
- [ ] 9. Mobile tests: Maestro harness and local seeded runner
- [ ] 10. Workflow: CI for typecheck, lint, unit tests and bundling
- [ ] 11. Mobile: organization picker, invitations and default organization
- [ ] 12. Mobile: app shell — role tabs, org switcher, user menu, live lesson banner
- [ ] 13. Mobile: Dashboard — Tutoring tab
- [ ] 14. Mobile: Dashboard — Finance tab
- [ ] 15. Mobile: Dashboard — parent and student views, reflection prompts
- [ ] 16. Mobile: Dashboard — admin view-as and role selector
- [ ] 17. Mobile: Sessions — Tutoring/Finance list, filters and focus
- [ ] 18. Mobile: Sessions — record a lesson
- [ ] 19. Mobile: Sessions — drafts and 3-second autosave
- [ ] 20. Mobile: Sessions — live lesson: start, timer, stop, cancel
- [ ] 21. Mobile: Sessions — notes, assessments and student reflections
- [ ] 22. Mobile: Pairings — assignments and rate overrides
- [ ] 23. Mobile: Schedule — weekly view, editor, cancel/restore, calendar files
- [ ] 24. Mobile: Progress — list, chart, assessments, plans
- [ ] 25. Mobile: People — directory, detail, comments, delete/restore
- [ ] 26. Mobile: People — person form
- [ ] 27. Mobile: Billing — balances, payments, CSV and tax summary
- [ ] 28. Mobile: Year-end — 1099 printed on device, SSN receipts
- [ ] 29. Mobile: Comments — feed and threads
- [ ] 30. Mobile: Activity — audit log
- [ ] 31. Mobile: Organization — TIN, payer address, notifications
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

(none)

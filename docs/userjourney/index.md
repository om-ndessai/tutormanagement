# Audit index

The UI journey audit of Aimtrue at commit `2d6e7d3` (branch `member-home-stickiness`), 2026-11-04: 24 journeys (19 on the web, 5 in the iOS app), a design audit and a workflow audit. Start with the [recommendations](recommendations.md). The plan, how the run was set up and the journey index are in the [README](README.md).

| Date (UTC) | Auditor | Scope | Sev4 | Sev3 | Sev2 | Sev1 | Report |
|------------|---------|-------|------|------|------|------|--------|
| 2026-11-04T17:42:02Z | cuj | J01: adult player signs up from the guest page, approved | 0 | 1 | 4 | 2 | [report](J01-adult-player.md) |
| 2026-11-04T18:41:05Z | cuj | J01A: adult player signs up from the guest offer in the app, approved, starts a quest | 0 | 1 | 2 | 3 | [report](J01A-adult-player-app.md) |
| 2026-11-04T17:43:38Z | cuj | J02: adult player signs up from the guest page, declined | 0 | 2 | 3 | 2 | [report](J02-adult-declined.md) |
| 2026-11-04T18:06:37Z | cuj | J03: parent plays a tile as a guest, signs up, starts practice for their child | 0 | 2 | 6 | 1 | [report](J03-parent-after-guest-play.md) |
| 2026-11-04T17:45:02Z | cuj | J04: teen (13-17) signs up, tries a space and a code, plays | 0 | 0 | 5 | 4 | [report](J04-teen.md) |
| 2026-11-04T19:26:56Z | cuj | J04A: teen (13-17) signs up in the app, tries a space and a code, plays | 0 | 0 | 6 | 4 | [report](J04A-teen-app.md) |
| 2026-11-04T17:36:35Z | cuj | J05: under 13 tries to sign up and is refused | 0 | 1 | 3 | 0 | [report](J05-under-13.md) |
| 2026-11-04T17:44:33Z | cuj | J06: teacher signs up from the sign-in link, starts a space, invites, starts an assessment | 0 | 2 | 6 | 3 | [report](J06-start-a-space.md) |
| 2026-11-04T19:56:43Z | cuj | J06A: teacher signs up in the app from Sign in, starts a space, invites, starts an assessment | 0 | 2 | 6 | 4 | [report](J06A-start-a-space-app.md) |
| 2026-11-04T17:53:21Z | cuj | J07: adult given a space code is approved, asks to join, is let in, tries Assessment | 1 | 3 | 3 | 1 | [report](J07-space-code-let-in.md) |
| 2026-11-04T20:23:18Z | cuj | J07A: adult given a space code signs up in the app, asks to join, is let in, tries Assessment | 1 | 3 | 3 | 1 | [report](J07A-space-code-let-in-app.md) |
| 2026-11-04T17:43:24Z | cuj | J08: friend sent a game code and a tile link; does the code still work after the wait | 0 | 4 | 3 | 1 | [report](J08-friend-game-code.md) |
| 2026-11-04T17:55:08Z | cuj | J09: parent invited by a new self-serve space accepts and lands | 0 | 3 | 5 | 0 | [report](J09-invited-by-space.md) |
| 2026-11-04T17:51:47Z | cuj | J10: adult given a space code is approved, asks to join, is declined by the space | 0 | 1 | 7 | 4 | [report](J10-space-code-declined.md) |
| 2026-11-04T17:45:26Z | cuj | J11: space admin lets one newcomer in and declines another | 0 | 0 | 5 | 1 | [report](J11-space-admin-decides.md) |
| 2026-11-04T18:14:17Z | cuj | J12: under Pre-approved, a person on the list signs up and plays | 0 | 0 | 3 | 2 | [report](J12-preapproved-on-list.md) |
| 2026-11-04T18:16:57Z | cuj | J13: under Pre-approved, a person not on the list is refused | 0 | 1 | 3 | 0 | [report](J13-preapproved-not-on-list.md) |
| 2026-11-04T17:37:34Z | cuj | J14: tutoring office admin adds a new family | 0 | 1 | 7 | 1 | [report](J14-office-adds-family.md) |
| 2026-11-04T17:47:33Z | cuj | J15: new tutoring parent signs in for the first time | 0 | 1 | 5 | 2 | [report](J15-tutoring-parent-first-sign-in.md) |
| 2026-11-04T20:44:06Z | cuj | J15A: new tutoring parent signs in to the app for the first time | 0 | 1 | 2 | 4 | [report](J15A-tutoring-parent-first-sign-in-app.md) |
| 2026-11-04T17:53:35Z | cuj | J16: tutor opens the record-a-lesson form from every entry point | 0 | 2 | 4 | 1 | [report](J16-tutor-record-entry-points.md) |
| 2026-11-04T17:43:22Z | cuj | J17: tutored student practises before the lesson | 0 | 1 | 5 | 1 | [report](J17-tutored-student-practice.md) |
| 2026-11-04T17:43:33Z | cuj | J18: parent who is also a tutor: which hat leads, the switcher, All spaces, the dashboard | 0 | 1 | 4 | 1 | [report](J18-several-hats.md) |
| 2026-11-04T17:43:17Z | cuj | J19: returning player after ten days away | 0 | 1 | 5 | 0 | [report](J19-returning-player.md) |
| 2026-11-04T21:02:44Z | design | Design audit: consistency, colour themes and usability across the 24 journeys | 1 | 5 | 14 | 3 | [report](audit-design.md) |
| 2026-11-04T20:58:03Z | workflows | Workflow audit: redundant and inconsistent paths, and web against app | 1 | 11 | 7 | 1 | [report](audit-workflows.md) |

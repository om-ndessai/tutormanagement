> Status (2026-11-04): plan approved by the owner. Gate 1 cleared: the other session committed and pushed `2d6e7d3` ("Owner's review fixes: member home, tour only with Tutoring, space form asks sets first") and deployed it to the test Worker at 16:41 UTC; `2d6e7d3` is the audited commit. Gate 2 cleared: ux-agent-skills 0.6.0 (with its dependency web-quality-skills 2.0.0) and frontend-design 1.1.1 are installed; the three scripts the agents run are identical to the reviewed copies, and no plugin has hooks or MCP servers. Gate 3 cleared: the owner said go on 2026-11-04 (after a restart of the
Mac; the scripts were re-read in the new session, unchanged in kind: they read the report and its images, write the
`.html` beside it, and run only `git`). **Done 2026-11-04:** 24 journeys (19 web, 5 iOS app), the design and
workflow audits, and the recommendations, checked. The audit stack was then stopped and its worktree removed.

**Start here:** [recommendations.md](recommendations.md) (37 items: 3 P0, 14 P1, 17 P2, 3 P3; every P0 and P1
checked against its screenshots and the audited code), then [audit-design.md](audit-design.md) (23 findings),
[audit-workflows.md](audit-workflows.md) (20 findings) and the journeys below. Each `.md` has an `.html` beside
it (open `index.html` in a browser for the walkthrough flipbooks). The pages are rendered with the plugin's
`render_report_html.py`. Its images are then pointed at `./assets/` instead of inlined, so the repo carries
each screenshot once. The screenshots are reduced to 256 colours (31 MB for 827 images, no visible change).

# UI journey audit (docs/roadmap/ui-audit-plan.md)

## The run (2026-11-04)

- **Audited commit:** `2d6e7d3` on `member-home-stickiness`, frozen in the worktree `.claude/worktrees/ux-audit`.
- **Stack:** the worktree's own Worker on `http://localhost:8797` with `AUTH_ENABLED:true`, serving the built SPA
  itself (one origin, real cookies), its own local D1. Fake provider tokens on (never in production); Google's
  script is the stand-in described below. `DEFAULT_ORGANIZATION` is blank in the worktree's `.dev.vars`, as on
  `tutoring`, so signed-out pages wear Aimtrue, not the institute.
- **Data:** `npm run db:reset`, then `npm run seed:scenarios` (3 assessments, 20 Quest answers, 4 reviews, 2 games).
- **Settings (console API, as the platform admin), as in production:**
  - sign-in, web: Google only, sign-up open, until changed; app: Google, Microsoft, Facebook, sign-up open;
  - sign-up access: **Post-approved**;
  - guest play on, guest assessment on (sign-up offer after question 1, 24 h before it shows again);
  - Play home on, the Daily on, the default 64 tiles, 50 questions a level;
  - visit recording on.
- **Preconditions made before the journeys (the only writes outside the UI):**
  - Assessment and Quest switched on in `chmi` and `riverside` by each space's admin, with the same request
    `seed:scenarios --demo` makes on the demo (locally the seed puts them back off). `assess` keeps Quest off.
  - J08's friend's game: Sanjay Patel (Riverside) opened a game of teams, Grade 4, 10 questions, joining open,
    code **TVFEJK**, left in the lobby. The tile link J08 is sent is `/play/G4Q10`.
  - J19's history: twelve play days for Leila Eriksen (`chmi` student), three a week from 2026-09-29 to 2026-10-25,
    inserted into the local database. The seed makes only today's play, so without it no one could show a
    streak or "Welcome back". **Not in the approved plan; added on the day, local only.**
- **Dry run:** passed end to end (guest page signed out, sign-up, the real "Waiting for approval", the admin's
  approval in the console, signing in again, the personal space). `/api/auth/session` answered 401 signed out
  and 200 after sign-in; `validate_report.py` passed on a sample report.
- **The app part:** the same worktree and database, the Worker restarted on :8787 with sign-in off, the
  development build on the iPhone 17 simulator (Metro on :8081), flows in `apps/mobile/.maestro/journeys/`. The
  approvals and Ines's let-in for the app journeys were made in the web console on :8787 (not audited). J15A's
  family (Hana and Ken Mori) was added by the office the same way, as its precondition.
- **Harness:** `e2e/journeys/driver.mjs` (usage in its header). Reports are checked with the plugin's
  `validate_report.py` and rendered with `render_report_html.py` (ux-agent-skills 0.6.0). Its `audit_safety.py`
  checks a `.ux/audits/` layout this audit does not use, so the footprint is checked with `git status`.

## Journey index

Findings are counted by severity: 4 blocks the journey, 3 major, 2 minor, 1 cosmetic. Every report passes the
plugin's `validate_report.py` and `e2e/journeys/check-report.mjs`. Seeded people keep their seed addresses;
everyone else is invented, at `@example.com`.

| Journey | Who (cohort) | Outcome | 4 / 3 / 2 / 1 |
| --- | --- | --- | --- |
| [J01](J01-adult-player.md) | Jordan Avery, adult player, from the guest offer (C6) | approved; quest started in own space | 0 / 1 / 4 / 2 |
| [J02](J02-adult-declined.md) | Casey Morgan, adult player (C6) | declined; refusal seen twice | 0 / 2 / 3 / 2 |
| [J03](J03-parent-after-guest-play.md) | Renee Shah, parent after guest play (C4) | approved; carry-over checked; assessment started for her child | 0 / 2 / 6 / 1 |
| [J04](J04-teen.md) | Theo Brooks, 15 (C6) | approved; space refused, code asked; quest started | 0 / 0 / 5 / 4 |
| [J05](J05-under-13.md) | Mia Lopez, 11 (C6) | refused, nothing kept | 0 / 1 / 3 / 0 |
| [J06](J06-start-a-space.md) | Sam Rivera, teacher, from the sign-in link (C1/C7) | approved; space started, Ana invited; assessment started | 0 / 2 / 6 / 3 |
| [J07](J07-space-code-let-in.md) | Lena Fischer, given the code FMXY2345 (C7) | approved, let in; **blocked**: no child, no assessment | 1 / 3 / 3 / 1 |
| [J08](J08-friend-game-code.md) | Kai Turner, sent a game code and a tile link (C6) | approved; the code does not reach the friend's game; quest started | 0 / 4 / 3 / 1 |
| [J09](J09-invited-by-space.md) | Ana Costa, invited by Rivera Math Club (C4/C7) | accepted and landed | 0 / 3 / 5 / 0 |
| [J10](J10-space-code-declined.md) | Marcus Webb, given the same code (C7) | approved, declined by the space; decline seen | 0 / 1 / 7 / 4 |
| [J11](J11-space-admin-decides.md) | Ines Ferreira, space admin (C1) | let Lena in, declined Marcus | 0 / 0 / 5 / 1 |
| [J12](J12-preapproved-on-list.md) | Grace Liu, on the list, Pre-approved (C6) | straight in; quest started | 0 / 0 / 3 / 2 |
| [J13](J13-preapproved-not-on-list.md) | Ben Carter, not on the list, Pre-approved (C6) | refused at the Google step | 0 / 1 / 3 / 0 |
| [J14](J14-office-adds-family.md) | Priya Raghavan, tutoring office admin (C1) | family added, paired, weekly lesson set | 0 / 1 / 7 / 1 |
| [J15](J15-tutoring-parent-first-sign-in.md) | Nadia Hassan, new tutoring parent (C3) | tour, My children, the lesson; Play with started | 0 / 1 / 5 / 2 |
| [J16](J16-tutor-record-entry-points.md) | Alex Chen, tutor (C2) | record form opened from every entry point | 0 / 2 / 4 / 1 |
| [J17](J17-tutored-student-practice.md) | Sofia Okafor, tutored student (C5) | the Daily started from Next up | 0 / 1 / 5 / 1 |
| [J18](J18-several-hats.md) | Maria Okafor, parent and tutor (C8) | home, switcher, All spaces, dashboard | 0 / 1 / 4 / 1 |
| [J19](J19-returning-player.md) | Leila Eriksen, back after ten days (C6/C5) | Welcome back seen; resumed only from the Quest page | 0 / 1 / 5 / 0 |
| [J01A](J01A-adult-player-app.md) | Morgan Lee, adult player, app (C6) | approved; quest started | 0 / 1 / 2 / 3 |
| [J04A](J04A-teen-app.md) | Ava Grant, 16, app (C6) | approved; space refused, code asked; quest started | 0 / 0 / 6 / 4 |
| [J06A](J06A-start-a-space-app.md) | Pat Quinn, teacher, app (C1/C7) | approved; space started, Jo invited; assessment started | 0 / 2 / 6 / 4 |
| [J07A](J07A-space-code-let-in-app.md) | Elena Ruiz, given the code, app (C7) | approved, let in; **blocked** as in J07 | 1 / 3 / 3 / 1 |
| [J15A](J15A-tutoring-parent-first-sign-in-app.md) | Hana Mori, new tutoring parent, app (C3) | tour, Ken's lesson; Play with started | 0 / 1 / 2 / 4 |

In all: 24 journeys, 22 reached their end, 2 blocked (the same dead end on web and app), 184 findings (sev4 2, sev3 34, sev2 105, sev1 43).

# The plan

## Context

The platform has been built over 69 phases. The owner wants to see it the way an outside newcomer does,
judged on three things:
- **usability**: can they do it;
- **conversion**: do they get from the guest page into a space and to a feature;
- **stickiness**: is there a reason to come back.

The method is a fleet of agents. Each one plays one user cohort through one path, screenshots every step, and
writes a journey document in `docs/userjourney/`. A platform-admin agent approves or declines their sign-ups, so
both outcomes are recorded. Once every journey is in, a design agent (the frontend-design skill) audits all of
them for consistency, colour and usability. It also checks for redundant workflows that built up across phases,
such as the eight ways a tutor records a lesson, and writes the recommendations.

Scope comes from the brief:
- The platform console is not audited. The admin agent only does the approvals.
- Journeys stop once the person lands in a space and starts a feature (a quest, an assessment, the record form).
- The guest's own "today's questions" journey is not recorded.

Decided with the owner:
- Every journey is recorded on the web, at phone width and desktop width.
- Five key sign-up journeys are also replayed in the iOS app.
- The owner installs both plugins (below).

## Nothing starts until three gates clear

1. **The other session is done.** Its review follow-ups are committed and pushed on `member-home-stickiness`,
   and it has deployed to the test Worker. Today 45 files are uncommitted. A background check runs every 5
   minutes and clears when:
   - no tracked file is modified;
   - `HEAD` is past `9aa5bc0` and equals `origin/member-home-stickiness`;
   - `npx wrangler deployments list --env tutoring-test` (read-only) shows a deployment newer than that commit.

   The audited commit SHA is recorded. When the gate clears I send a push notification and do NOT start.
2. **The skills are installed.** The owner runs:
   - `/plugin marketplace add carlsz/ux-agent-skills`
   - `/plugin install ux-agent-skills@ux-agent-skills` (render-report, plus its sibling cuj and usability skills;
     third-party, not reviewed by Anthropic; it pulls in `web-quality-skills`)
   - `/plugin install frontend-design@claude-plugins-official`

   Before any agent runs the plugin's Python scripts, I read `render_report_html.py`, `validate_report.py` and
   `audit_safety.py`.

3. **The owner says go (owner, 2026-11-04).** Once gates 1 and 2 have cleared, I report that and wait for the
   owner's explicit approval. Nothing from the setup onwards happens before it: the worktree, the servers, the
   agents and the status job. Preparing the harness in the scratchpad is the only work done while waiting.

The first file I write on approval is this plan, copied to `docs/userjourney/README.md`. Plan mode blocks that
copy now.

## Setup (Phase 0, done by me, about 45 min)

**The local stack has to change: today's dev setup does not show what a stranger sees.** It runs with sign-in
off:
- a browser with no header is silently the first admin;
- signed-out pages exist only by faking a 401;
- the sign-up sheet shows a "Developer sign-up" form;
- a person waiting for approval sees "The portal can't start" instead of the real "Waiting for approval" screen.

So the audit gets its own stack:
- **A frozen, isolated copy.** A git worktree of the audited commit at `.claude/worktrees/ux-audit` (already
  gitignored), with `npm ci`, `npm run build` and `apps/api/.dev.vars` copied in. It has its own local D1, so
  nothing touches the main checkout's database or the other session. All later edits elsewhere are invisible
  to it.
- **Seeding, with sign-in still off.** `npm run db:reset` in the worktree, then the Worker on **:8797**
  (`--inspector-port 9239`), then `npm run seed:scenarios -- --base=http://localhost:8797`. That gives the
  personas a history and gives returning players something to come back to.
- **Production's settings,** made through the API as the platform admin `ndessai@gmail.com`, then recorded in
  the README:
  - sign-up open on web and app, until changed;
  - Google only on the web (as on `tutoring`);
  - **Post-approved**;
  - guest play on, the Daily on, the default tiles;
  - visit recording on.
- **Restart with sign-in on.** `npx wrangler dev --port 8797 --var AUTH_ENABLED:true`, with the fake providers
  still on. The Worker serves the built SPA itself, as production does: one origin, real cookies, real sign-in
  and sign-up screens, and the real "Waiting for approval", "Sign-up is by invitation" and "Access not approved"
  screens.
- **Google's button is the one stand-in.** Each browser loads a small stand-in for Google's sign-in script,
  served at `accounts.google.com/gsi/client`. Its button hands the app a `fake:google:<sub>:<email>:1:<name>`
  token, so the app's own code path runs from that click on. Each report's Appendix says this ("Access:
  provider step simulated").
- **The driver, `e2e/journeys/driver.mjs`.** One long-lived headless Chrome per journey (the installed Chrome,
  `channel: 'chrome'`, as the e2e config uses), each with its own profile in `docs/userjourney/_run/<id>/`.
  - An agent sends one action at a time (`goto`, `click`, `fill`, `shot`, `eval`), looks at the screenshot,
    and decides the next step, as a person would. Nothing is replayed, and the tab's sessionStorage (its
    space) survives between steps.
  - `shot` saves a phone-width (390×844) PNG. At landing screens it also saves desktop (1280×800) and dark
    mode.
  - `sheet <id>` makes a contact sheet: one image of a journey's phone steps, for the auditor.
  - `status <id> <msg>` appends to `_run/status.log`.
  - It reuses the e2e helpers (`visible()`, the test ids the explorers listed).
- **A dry run before any agent starts.** A throwaway persona goes the whole path:
  1. the guest page, signed out;
  2. sign up;
  3. "Waiting for approval";
  4. the admin approves in the console;
  5. sign in again;
  6. the personal space.

  `validate_report.py` must pass on a sample report. If the cookie or the Google stand-in fails here, the
  fallback is sign-in off with the developer forms, flagged in every Appendix. The owner is told before going
  on.

## Cohorts and journeys

Every persona is invented, at `@example.com`, and exists on the local stack only. The cohorts follow
`docs/member-home-plan.md` (C1-C8), so findings link back to that research.

| # | Who and how they arrive | Approval | Ends when they… |
| --- | --- | --- | --- |
| J01 | Adult player, from the guest page's sign-up offer | platform: **approved** | start a quest in their own space |
| J02 | Same entry | platform: **declined** | see the refusal, then try again later |
| J03 | Parent who played a tile as a guest (not recorded), then signs up | approved | start "Show your work" or an assessment for their child (carry-over checked) |
| J04 | Teen, 13-17 | approved | try Start a space or a code, then play |
| J05 | Under 13 | refused, nothing kept | read "Ask a parent", and what is left to do |
| J06 | Adult who wants their own space (tutor or teacher), from the sign-in link | approved | start a space, invite people, start an assessment |
| J07 | Adult given a space code (`assess`, FMXY2345) | approved, then **let in** by the space's admin | land in that space and try Quest or Assessment |
| J10 | Same as J07 | approved, then **declined** by the space's admin | see the decline |
| J08 | Friend sent a code (a game code and a tile link) | approved | find out whether the code still works after the wait |
| J09 | Invited by J06's new space: an invitation text, then Google | none (the space vouches) | accept and land in the space |
| J11 | Space admin (Ines, `assess`) answering J07 and J10 | — | let in and decline (the space owner's view) |
| J12 | Under **Pre-approved**: on the list | — | go straight in and play |
| J13 | Under Pre-approved: not on the list | refused | read "By invitation" and Contact us |
| J14 | Tutoring office admin (Priya, `chmi`) adds a new family | — | finish adding the family (the parent becomes J15) |
| J15 | New tutoring parent: first sign-in, tour | — | reach My children, the next lesson, Play with child |
| J16 | Tutor (Alex) | — | open the record form **from every entry point**: Next up, To record, quick action, sessions page, timer stop, draft |
| J17 | Tutored student (Sofia) | — | start "Practise before" the lesson, the Daily, or an assessment |
| J18 | Several hats (Maria: parent and tutor) | — | see which hat leads, the switcher, All spaces, /dashboard |
| J19 | Returning player with a history (from seed:scenarios) | — | read My progress, the streak, Welcome back, and Continue |

**In the app (iOS simulator):** J01, J04, J06, J07 and J15 again, as `JxxA`.
- New personas, signed in through the app's developer sign-in (the native Google step cannot be driven).
- Maestro flows are written to `apps/mobile/.maestro/journeys/` and run one at a time with
  `maestro test --device <udid>` (never `e2e:mobile`, which resets the database).
- For this part the worktree's Worker restarts on **:8787** with sign-in off, on the same data. The app is
  wired to that port; I check it is free first.
- Uses `MAESTRO_DRIVER_STARTUP_TIMEOUT` and cleared sessions, the workaround for the slow iOS driver.

Not covered, and said so in the README: Microsoft, Apple and Facebook sign-in (not offered on the production
web), Android, the console, and the quest and assessment themselves.

## How the agents run

Three Workflow runs, with me in between to switch the Worker. The user asked for as many agents as needed: about
30 agent calls in all, at most about 10 at once. The Mac has 18 cores and 64 GB.

**Workflow 1: web journeys.**
1. **Sign up** (in parallel):
   - J01-J08 and J10 go as far as "waiting" (J05 runs to its end);
   - J14 and J16-J19 run whole, since they need no approval;
   - J08's game is set up first by a seeded player.
2. **Approve:** one platform-admin agent, signed in to the console. It finds each waiting person by email and
   approves J01, J03, J04 and J06-J08 and declines J02. It screenshots the waiting list for the record, which
   is not audited. The pause between signing up and returning stands for "the next day".
3. **Come back** (a pipeline, so each journey moves as soon as it can):
   - each waiting journey's second stage starts from the signed-out guest page;
   - J07 and J10 ask to join `assess`, then J11 lets J07 in and declines J10, then both finish;
   - J06's invite step hands J09 the invitation text, then J09 runs;
   - J14 hands J15 the parent's email, then J15 runs.
4. **Pre-approved:**
   - the admin agent switches the mode and adds J12's email to the list;
   - J12 and J13 run;
   - the admin switches back to Post-approved.

A journey's second stage is a new agent. It continues the first stage's notes, browser profile and document,
so the persona stays one person.

**Workflow 2: the app.** One mobile agent, using the `mobile-tester` skill:
1. writes and runs the five flows, one at a time;
2. pauses after the sign-ups so the platform-admin agent can approve them (through the web console on :8787);
3. reviews the screenshots and writes the five `JxxA` reports.

**Workflow 3: audit, then recommendations.** Two agents work in parallel, then a third combines their results:
- **Design auditor**, using `frontend-design` plus the design plugin's critique and accessibility skills. It
  works from:
  - every report and contact sheet;
  - the tokens in `index.css` (palettes, dark mode, grade hues);
  - `docs/branding.md`, `docs/ui-upgrades-spec.md`;
  - the earlier audits (`docs/mobile/ux-audit.md` and the member-home plan's "ten problems"). It marks those
    fixed or still present rather than reporting them again.

  It covers consistency across spaces, palettes, web and app, colour themes and usability. It writes
  `audit-design.md`.
- **Workflow auditor.** It checks for redundant and inconsistent paths, from the journeys plus the entry-point
  map:
  - recording a lesson: 8 entry points on the web, and two separate forms in the app;
  - adding a person: the wizard, People, Let in, Invite people;
  - starting a quest: tiles, favorites, New Quest, two code boxes, the Daily, Next up.

  It also checks web-versus-app differences. It writes `audit-workflows.md`.
- **Recommendations:** `recommendations.md`, ranked P0-P3 and grouped by conversion, stickiness, usability and
  consistency. Each item has its evidence, its rough size, and whether the owner must decide. These are input
  for the owner, not scheduled work: a feature is built only once it is in `docs/plan.md`.

After that I render the reports to HTML, refresh the index, and commit.

## What every journey document holds

The plugin's report format (Schema 2, auditor `cuj`), so render-report can turn it into a walkthrough flipbook:
- frontmatter: the nine keys, `version` read from the plugin's `plugin.json`, `mode: live`;
- Executive summary:
  - who the persona is and what they wanted;
  - the outcome;
  - the conversion figures: screens, taps and typed fields from the entry point to the feature, waits, dead ends;
  - **the 3 screens this cohort would notice most**;
- Prioritized fixes, then Findings as `### [sevN]` with the five fields;
- Walkthrough, one `### Step n — action` per step, each with:
  - expected versus what happened;
  - **"What <persona> notices"**;
  - the phone screenshot, plus desktop and dark mode at landing screens;
- Appendix: mode, coverage and what was not inspected, the Access line.

Screenshots are named `cuj-<id>-step-<n>.png` and saved in `docs/userjourney/assets/`.

## Layout of `docs/userjourney/`

- **`README.md`:** this plan, the audited commit, the settings, the personas, and the journey index.
- **`J01-…md` to `J19-…md`, `J01A-…md` and the other app reports:** one per journey, each with its `.html`
  beside it.
- **`audit-design.md`, `audit-workflows.md`, `recommendations.md`:** the audit and its recommendations.
- **`index.md` / `index.html`:** the render-report index.
- **`assets/`:** screenshots and contact sheets. Kept to about 25-40 MB: 1× PNGs, desktop and dark mode only at
  landing screens.
- **`_run/`:** the status log, browser profiles and handoffs. Gitignored, never committed.

## Status every 15 minutes

- A recurring job (`CronCreate`, at minutes 7, 22, 37 and 52) has me read `_run/status.log` and post a short
  checklist. It runs from the start of Workflow 1 until the commit, then is deleted.
- The checklist always has the same order: the journey being recorded now and its step, what finished since
  last time, and what is left with estimates and a total.
- Push notifications only for things that need the owner: a gate cleared, the dry run failed, or a journey
  blocked by a bug.

## Rules for every agent

- Audit only: no change to app code, the schema or the seed.
- Commands only against the worktree's local stack:
  - no `--remote` and no deploys;
  - nothing against production or the demo;
  - no `db:reset` in the main checkout.
- No API shortcuts during a journey. The only exceptions are the preconditions this plan names: the J08 game,
  and the settings changes the admin agent makes.
- A bug that blocks a journey is a finding, with its severity and screenshot; the journey stops there.
  Observations are never invented. A step not checked is listed under coverage.

## Verification

- **Setup:** the dry run passes end to end, and its "Waiting for approval" screenshot is the real screen.
  `/api/auth/session` answers 401 when signed out and 200 after a sign-in.
- **Each journey:**
  - `validate_report.py` passes;
  - every embedded image exists (a check script over `./assets/`);
  - the step count matches the screenshots;
  - J02, J05, J10 and J13 show their refusal screens;
  - J01, J04, J07 and J12 show a started feature.
- **At the end:**
  - render-report produces the HTML and `index.html`;
  - `git status` shows changes only in `docs/userjourney/`, `e2e/journeys/`,
    `apps/mobile/.maestro/journeys/` and one `.gitignore` line;
  - the cron job is deleted;
  - the worktree's Worker is stopped and the worktree removed;
  - `npm run typecheck` still passes (the driver sits in `e2e/`).
- **Commit:** pushed to `member-home-stickiness` (documents and harness only, no deploy). I can also publish the
  rendered index as a private page to share if the owner wants.

## Time and risks

**Time: about 5-6 hours after the gates.**

| Step | Estimate |
| --- | --- |
| Setup | 45 min |
| Sign-ups | 20 min |
| Approvals | 10 min |
| Coming back, and the tutoring journeys | 50 min |
| Pre-approved | 15 min |
| iOS | about 90 min (the iOS driver can take 30 min to start) |
| Audit and recommendations | 60 min |
| Render and commit | 15 min |

**Risks, and what happens if they hit:**
- Sign-in with the stand-in: checked in the code. Fake tokens are accepted whenever the environment is not
  production (`lib/identity.ts`). The session cookie drops `Secure` outside production (`lib/session.ts`). The
  sign-up sheet passes Google's credential to `signInWithGoogle` and shows the About-you form in place. If the
  dry run still fails, fall back as set out there.
- The iOS driver hangs: the web journeys and the audit still finish, and the app part is reported as not run.
- A daily cap (3 spaces per person, 20 people added per self-serve space): each journey has its own persona.
- The seeded `assess` space's join code is off: J07 and J10 switch to `riverside` (RVRS2345).

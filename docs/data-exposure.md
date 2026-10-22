# What each person sees

Phase 18. The reference for what a signed-in person who is **not** an admin may see, the
review of the API and UI against it, and the test that keeps it true.

Read this before adding a route or a screen that returns people, lessons or money.

---

## The rules

Admins see everything, except another person's draft (R10). For everyone else there are the rules below. A person may hold several roles,
so each rule applies **per row**: Sanjay reads the lessons he teaches as a tutor and his own
lessons as a student, in one list.

| # | Rule | Enforced by |
| --- | --- | --- |
| R1 | A tutor's pay for a lesson (`tutor_rate_cents`, `tutor_amount_cents`) reaches only the tutor who taught it. | `scopeSessionMoney` |
| R2 | The family's price for a lesson (`charge_*`) reaches only that student and their guardians, and never the lesson's own tutor. | `scopeSessionMoney` |
| R3 | Every lesson says whose money the reader is seeing (`money_view`: `tutor`, `family` or `none`), and screens label amounts only from that. | `scopeSessionMoney`, `SessionMoney` |
| R4 | A student's price per hour reaches only that student's own family. | `scopeStudentCharges` |
| R5 | A tutor's pay rates, both their defaults and their per-pairing rates, reach only that tutor. | `scopeTutorPay`, `scopeAssignmentRates` |
| R6 | Some things stay on a person's own record: a tutor's advance level, their mailing address, their payment handles, whether the office holds their SSN, and when they last signed in. | `scopeTutorTopup`, `scopePersonalDetails`, the users list |
| R7 | A response names nobody the reader could not already see (`visibleUserIds`). The only exception is whoever *acted*: an audit actor, a comment author, an assessor. | the scope helpers in `lib/scope.ts` |
| R8 | The activity log never carries an amount of money. | the audit descriptions (lessons since Phase 17, payments since Phase 21); the repository rewords older lines for non-admin readers, and the dashboard's Tutoring tab leaves payment lines out altogether |
| R9 | A lesson, payment, schedule or comment the reader cannot list is "not found" when fetched by id, and never "forbidden", because a 403 confirms it exists. | `getVisibleSession`, `getVisiblePayment`, `canSeeSchedule` |
| R10 | An unposted write-up (Phase 22) — its notes, its parts and its author's assessment (Phase 23) — reaches only its author, whoever else it names. Admins included. | `listMyDrafts`, `assertMyDraft` |
| R11 | A cancelled lesson (Phase 24) is listed only from a schedule the reader can list. Through progress, which more people read, its date and tutor may reach any reader of the student's progress, but its note and who cancelled it only the schedule's own audience. | `listScheduleCancellations`, `toProgressCancellation` |
| R12 | A student's reflection (Phase 25) reaches its lesson's audience only. The tutor dashboard's digest of reflections covers lessons that tutor taught, and a student's or parent's prompt for one names only their own or their children's lessons, with no money. | `SELECT_SESSION`, `listRecentReflections`, `listAwaitingReflection` |
| R13 | Nothing crosses organizations. Every read, file and "view as" inside one organization returns no row, id or name that belongs only to another -- for every reader, admins included. A row from another organization is "not found" by id, and a write naming one answers as missing. People shared by two organizations are visible in both, as each organization's own record of them. | `requireOrg`, every repository's `organization_id = ?`, the database's same-organization triggers; the curriculum catalog only through the organization's own list (`organization_curricula`, Phase 34), so a curriculum it does not offer is neither listed nor writable; crawled by `e2e/tests/exposure-organizations.spec.ts` (which reads `/api/curriculum` and, since Phase 35, `/api/curricula` too, and holds the North Carolina catalog's ids and names among A's forbidden words while A offers Beast Academy alone). The admins' `GET /api/organization/curricula` lists every PLATFORM curriculum an organization may offer -- reference data shared by all, not another organization's -- and, from Phase D, its own: never another's |
| R14 | The platform console reaches organizations and their admins only: never an organization's people, lessons, money or progress. A platform admin who belongs to no organization is refused by every organization route, and an organization admin by the console. An organization's choice of curricula is logged as `curriculum.offering_updated`, deliberately outside the `organization.*` actions the console lists, because from Phase D it may name an organization's own curriculum. Its question bank and AI page (Phase 36) are platform admins' only: the bank is reference data, not an organization's, and the AI log holds outcomes and costs, never a prompt, a reply or a question's text. | `requirePlatformAdmin`, `routes/platform.ts`, `routes/question-bank.ts`, `routes/ai.ts`; `question-bank.spec.ts`, `exposure-organizations.spec.ts`, `curricula.spec.ts` |
| R15 | A notification email (Phase 32) says no more than its recipient can already read in the portal: who, what kind of thing (a person added, a plan, an assessment, a schedule, a recorded lesson), when, and a link -- never money, notes, a write-up, comment or assessment text, or a score. It goes only to live members of the organization the action happened in who are concerned by it (the student and their guardians, the lesson's or schedule's tutor, a student's paired tutors, the admins when a person is added), once each, and never to the person who acted. The organization's log of attempts holds names and outcomes, never an address or a message, and only its admins read it. | `lib/email.ts` (`describe`, `compose`), `recipientsFor`, `listNotifications`; `e2e/tests/notifications.spec.ts` |
| R16 | A person's own list of tutoring locations (Phase 33) is read and written only by them (while they hold the tutor or student role), their guardians, and the organization's admins; anybody else asking for it gets an empty list, and a location of theirs reads as missing (404). The whole organization's list (`GET /api/locations` with no person, the Locations page) is the admins' alone; anybody else gets an empty list. A pairing's allowed locations and a schedule's chosen ones travel with the pairing and the schedule, so they reach exactly that row's audience. Only admins set a pairing's locations. The log names the location, never its address. | `routes/locations.ts` (`managesLocationsOf`), `routes/assignments.ts` (`PUT /:id/locations`); `e2e/tests/locations.spec.ts`, `e2e/tests/exposure.spec.ts` |
| R17 | An Assessment (Phase 38, in beta: answers written by hand on a canvas) reaches the student's audience as a row -- the student, their guardians, their current tutors and the organization's admins (`studentScopeSql`) -- with its grade, status and how many questions have writing. Its multiple-choice score (marked by code) and how many questions were still unreviewed in the bank reach only the student's current tutors and the admins, like the PDF; everyone else gets null. Who started it is named only to the student's current tutors, the admins and that person. Its questions go only to the person who started it, while it is in progress, and never with an answer or a worked solution. Its PDF, which carries the answers and worked solutions (shown inside the portal and the app, never as a download that leaves a copy behind), opens only for the student's current tutors and the admins; for anybody else it is "not found" (404), like a row they cannot list. The log names the student and the grade and how many questions were written, never a question or anything written. While an organization has the menu switched off, every route answers 403. Phase 40: a review (the tutor's red ink, a note per question and an overall comment) is written only by the student's current tutors and the admins, and while it is a draft only they read it; once saved as reviewed, the reviewed PDF -- which carries the tutor's notes and never the answer key -- is read by the student's whole audience (the student, their guardians, their current tutors, the admins). Reopening it takes it back from them until it is saved again. The log says an assessment was reviewed or reopened, never a note or the comment. | `routes/canvas-assessments.ts`, `repositories/canvas-assessments.ts` (`toCanvasAssessment`); `e2e/tests/canvas-assessments.spec.ts`, `e2e/tests/exposure.spec.ts` |
| R18 | Question Quest (Phase 42, gamification, behind the organization's `gamify_question_quest`; every route answers 403 while it is off). A student reads only their own Quest: their level, the question to answer now -- never its key, worked solution or checks -- and their own points and count. Answers, points and levels are read only by the student's current tutors (their own students) and the organization's admins; an answer outside a tutor's students is "not found" (404). A parent reads none of it yet (Phase 44's progress card). The review screen shows the reviewer the key, the solution and the blind solver's verdict. The log says a question was approved or flagged and names the student and the level, never the answer or a flag's reason (the reason goes to the platform console with the question). No leaderboard: nobody sees another student's points. | `routes/quest.ts`, `repositories/quest.ts`; `e2e/tests/quest.spec.ts` |
| R19 | The tutor's Home (Phase 43, `GET /api/home/tutor`) holds only the reader's own pairings as a tutor (`tutor_user_id` = them): an admin who also tutors sees their own lessons there, not everyone's; someone who teaches nobody gets an empty Home. It names the student and the lesson's place (as the schedule already does, R16), the homework set at the pairing's last lesson, the next topic on the student's plan and the assessments on that last lesson that the reader may read on the lesson itself (the lesson's audience, Phase 23) -- the app hides the notes until tapped, since a student may be beside the tutor. It carries no money (the Tutoring tab rule). | `routes/home.ts`, `repositories/home.ts`; `e2e/tests/home.spec.ts` |
| R20 | A Quest game (Phase 46, behind Quest's switch: every route answers 403 while it is off) is one organization's: its code is found only there (R13), and a game id from elsewhere reaches an empty Durable Object and is 404. A game -- its settings, its teams, its players by FIRST NAME only, the scores, the clock -- is read by its host, its players and the organization's admins; to anyone else it is 404, though anyone in the organization with the code may look it up (`POST /quest/games/lookup`: the level, the rules, the host's first name and the teams' names and sizes) to join it. A team's code is shown to that team's players, the host and the admins only. The question in a player's hand carries no key; the keys and solutions come only with the results (`GET /quest/games/:id/results`), after the game, for a player's own team -- the host and admins may read any team's. `GET /quest/games` lists the games a person hosts or plays (an admin's: every game here). A game awards no Quest points, and the audit log names who made, joined, began and ended a game -- never an answer or a score. | `routes/quest-games.ts`, `durable/quest-game.ts`; `e2e/tests/quest-games.spec.ts` |

## Who sees what, by screen

| Screen / endpoint | Tutor | Parent | Student |
| --- | --- | --- | --- |
| Sessions list, `GET /sessions` | Lessons they taught, with their pay. | Their children's lessons, with the price. | Their own lessons, with the price. |
| Sessions page, Tutoring tab (the default) | The same lessons and notes, and no money at all: no totals, amounts, export or pay preview in the record form. A tutor has this open with the student beside them (Phase 19). | Same. | Same. |
| Sessions page, Finance tab | The list above, with the money and the CSV. | Same. | Same. |
| Session by id | The same set; anything else is 404. | Same. | Same. |
| A lesson's write-up and assessments (Phase 23), on every session returned | Everything written on the lessons they may see: the plan, the review, the homework, the notes, and every assessment with who gave it. No money. | Same, for their children's lessons. | Same, for their own. |
| Assessing a lesson, `PUT`/`DELETE /sessions/:id/assessment` | Their own assessment only, as the tutor. Any other lesson is 404. | Their own, as a parent. | Their own, as the student. |
| Drafts, `GET /sessions/drafts` | Their own drafts only. | Same. | Same. |
| Cancelled lessons, `GET /schedules/cancellations` (Phase 24) | Those of schedules they teach, with the note and who cancelled. No money. | Their children's. | Their own. |
| A lesson's reflection (Phase 25), `PUT`/`DELETE /sessions/:id/reflection` | Enter one for their own students' lessons, and revise one an adult typed; never the student's own. Their Tutoring tab lists the latest on lessons they taught. | Enter one with their child; the dashboard prompts for recent lessons without one. Never overwrite the child's own. | Their own, always theirs to change. The dashboard prompts for recent lessons. |
| Cancelling or restoring a lesson, `POST`/`DELETE /schedules/:id/cancellations` | Their own schedules: any date with no lesson recorded; restore any. | Their children's: today or later; restore only their own. | 403: a student may not cancel. |
| Session totals | "Earned" | "Charged" | "Charged" |
| Sessions CSV | Only their "Your pay" columns. | Only their "Charged to you" columns. | Same as parent. |
| Pairings, `GET /assignments` | Their pairings, with their rates. | Who teaches their children, without rates. | Their own tutors, without rates. |
| A person's record, `GET /users/:id` | Their own record in full. For others: no pay rates, advance, mailing address, SSN, handles or last sign-in, and family links cut to people they can see. | Same, but a child's price per hour is shown. | Same, and their own price is shown. |
| Payments | Payments made to them. | Payments for their children. | Payments for themselves. |
| Balances | Their own tutor balance. | Their children's balances. | Their own balance. |
| Monthly rundown | What they taught and were paid. | Not offered. | Not offered. |
| Dashboard, tutor tab | Only lessons they taught, payments to them, and the students they teach. | n/a | n/a |
| Upcoming lessons, `GET /schedules/upcoming` | Dated lessons from schedules they can list; the dashboard asks for their own teaching only. No money. | Their children's. | Their own. |
| Dashboard, parent tab | n/a | Only their children's lessons (not ones they taught) and family payments. | n/a |
| Dashboard, student tab | n/a | n/a | Only their own lessons. |
| Progress (Phase 16) | Students currently assigned to them. Cancelled lessons on another tutor's schedule show without the note or who cancelled (R11). | Their children. | Themselves. |
| Curricula (Phase 35), `GET /curricula` and the catalog, `GET /curriculum` | The curricula their organization offers or has retired, and their levels and topics: reference data, no people. | Same. | Same. |
| Choosing curricula, `GET`/`PUT /organization/curricula` | 403: the organization's admins choose. | 403. | 403. |
| Activity log | Events they acted in or were the subject of, with no amounts. | Same. | Same. |
| Comments | See `docs/data-model.md`. | Same. | Same. |

Onboarding state (Phase 26) — whether someone has been through the welcome wizard and confirmed
their details — is only ever the reader's own: it arrives in their session response, and the
`/api/onboarding` routes take no id.

An admin's "view as" shows exactly this. The dashboard and the monthly rundown are built for the
person being viewed, not for the admin.

---

## Findings of the Phase 18 review

Every route in `apps/api/src/routes`, every repository, and every feature in `apps/web/src` was
read against the rules above. The money findings were fixed in Phase 17, and the rest here.

### Fixed in Phase 17 (money)

| Severity | Finding | Fix |
| --- | --- | --- |
| High | The log line for a recorded lesson ended with the **family's price**, and the tutor who recorded it reads their own activity: on /activity, on their dashboard, and on the student's record. | New lines carry no amount. Older lines are append-only, so the amount is removed on every non-admin read. |
| High | Pairings showed parents and students the **tutor's pay rate**. | `scopeAssignmentRates`. The UI hides the columns, or shows "—", rather than "No rate set". |
| High | A tutor's record showed families their **default pay rates**. | `scopeTutorPay`. The rows are left out of the UI. |
| Medium | The same "$95.00" meant the price to one reader and the pay to another, and someone on both sides saw both meanings in one list. Their "Earned" total showed $0.00. | `money_view` on every lesson, per-side totals, and one `SessionMoney` component. |
| Low | The sessions CSV carried the other side's column headers, empty. The delete dialog called a tutor's pay a "charge". | Columns follow the reader; the dialog wording now follows the reader's side. |
| — | Families could not see their own child's price per hour, which was stricter than the rule. | Guardians and the student themselves now see it. |

### Fixed in Phase 18

| Severity | Finding | Fix |
| --- | --- | --- |
| High | `GET /sessions/:id` checked access to the *student*, not to the lesson. A tutor who had ever taught a student could open another tutor's lesson with that student, and was shown its **price** because they were not its tutor. | `getVisibleSession` runs the list's own WHERE clause on the one row. A reader who is neither the tutor nor the family now sees no money at all (`money_view: 'none'`). |
| Medium | `GET /payments/:id` checked the *payer*. A guardian who shares one child with another adult could read that adult's payments for a different child. | `getVisiblePayment` checks the row itself. |
| Medium | A person's record listed *all* their children and guardians, so a tutor opening a student's parent learned about that parent's other children. | Family links are cut to the reader's visible set. |
| Medium | A tutor's Zelle or Venmo id, and an amber "SSN: Not received" badge, were shown to families. | Blanked by `scopePersonalDetails`, and hidden in the UI. |
| Medium | Dashboards mixed roles. A tutor who is also a parent saw their child's lessons, priced, under "Your recent sessions", and that child was counted as a student they teach. The parent tab listed lessons the parent had taught and payments made to them as a tutor. | Each role's dashboard is narrowed to that role's data. |
| Low | In an admin's "view as" a tutor, the monthly rundown was the *institute's*. | `/payments/monthly?user_id=` (admin only) builds it for the person viewed. |
| Low | `include_deleted=true` listed retired people to non-admins. The audit filter listed every action in the institute. Everyone's last sign-in was visible. | Admin only, scoped to the reader's own events, and blanked respectively. |
| Low | Editing or deleting a lesson, schedule or comment out of scope returned 403, which confirms the id exists. | 404 unless the reader can see the row. |

### Checked and correct

- **Balances**: each reader gets only their own rows, and the institute-wide totals are admin-only.
- **Live sessions**: a reader sees their own lesson only, with their pay and never the price.
- **Tax screens**: the tax status, 1099 and year-end screens are admin-only.
- **Recording money**: payments can only be recorded by an admin.
- **Schedules and calendar files**: the list, the `.ics` files and edits are all scoped to the reader.
- **Comments**: the thread, the counts and the feed all build their WHERE from the same two fragments.
- **The admin's view of someone else's dashboard**: only an admin may name another user, and only for a role that person holds.

---

## Keeping it true: `e2e/tests/exposure.spec.ts`

Phase 17's leaks were missed because every test looked only at the screen it was about. The
exposure spec works the other way round. It signs in as each kind of non-admin: a tutor, a
parent, a student, a parent who tutors, and a student who tutors. For each of them it calls
every read endpoint:

- lists
- records by id, for every person the reader can see
- each dashboard role
- progress
- the activity log
- comments
- balances
- the monthly rundown
- their drafts, after the office has saved one naming a lesson they can see (R10)
- cancelled lessons, and each schedule's own dates (R11)

It then walks **every object in every response** against R1–R8, whichever endpoint returned it.
An assessment names its author (`author_user_id`), who is exempt from R7 as whoever acted, as a
comment author is.
For R9 it fetches every lesson and every payment in the institute by id, and expects either the
row or a 404.

A new route that forgets to scope fails this spec without anyone writing a test for it. The
guard was checked by putting two of the old leaks back, the pairing pay rate and the lesson
lookup by id: both failed the spec for every persona.

When adding a rule, add it to the table above **and** to `check()` in the spec.

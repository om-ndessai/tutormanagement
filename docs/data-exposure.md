# What each person sees

Phase 18. The reference for what a signed-in person who is **not** an admin may see, the
review of the API and UI against it, and the test that keeps it true.

Read this before adding a route or a screen that returns people, lessons or money.

---

## The rules

Admins see everything, except another person's draft (R10). For everyone else there are eleven rules. A person may hold several roles,
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
| Activity log | Events they acted in or were the subject of, with no amounts. | Same. | Same. |
| Comments | See `docs/data-model.md`. | Same. | Same. |

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

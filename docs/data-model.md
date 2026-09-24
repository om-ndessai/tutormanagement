# Data model (Phase 2)

How the requirements in [plan.md](plan.md) became the schema in
[`apps/api/db/schema.sql`](../apps/api/db/schema.sql), and why it is shaped this way.

---

## The three decisions that shaped everything

### 1. Roles are a set, so they are a table

> "A user can have multiple roles. A parent can be a tutor, admin can be a tutor. A tutor could
> also be a student tutoring lower grades."

This single sentence rules out `users.role`. It also rules out the common shortcut of four
booleans (`is_admin`, `is_tutor`, …), which makes "list every tutor" a full scan and "add a role"
a schema change. Roles go in `user_roles`, one row per role held, with `(user_id, role)` as the
primary key so the same role cannot be granted twice.

Everything else follows from this. Once one person can be several things at once, every
attribute has to answer a new question: *is this true of the person, or only of one of their
roles?*

### 2. Role attributes live in role tables; person attributes live on the person

The plan gives tutors and students their own distinct fields. Those go in `tutor_profiles` and
`student_profiles`, one row per user, present only while the role is held. Putting them on
`users` as nullable columns would mean a student row carrying an empty `highest_education` and
a tutor row carrying an empty `academic_year_goal`, with nothing but convention saying which
applies.

But two requirements look role-specific and are not:

| Requirement | Where it would naively go | Where it actually belongs |
| --- | --- | --- |
| "Tutor also must have zelle or venmo id for payments" | `tutor_profiles` | `payment_handles` (per user) |
| "Parents: Support recording zelle or venmo id for requesting payment" | a parent profile | the same table |
| "General availability … days of the week and hour" (tutor) | `tutor_profiles` | `availability_slots` (per user) |
| "Day of the week availability" (student) | `student_profiles` | the same table |

Maria Okafor in the seed is a tutor **and** a parent. Had payment handles hung off the role
profiles, she would have two Zelle records that could disagree — and nothing to say which one is
right when the institute pays her versus bills her. She is one person with one Zelle id.

The same argument applies to availability: Sanjay Patel both tutors and studies here, and he is
free when he is free. One set of hours, not two.

**The rule:** an attribute belongs to the role only if two people holding different roles could
sensibly disagree about it. Money and time are facts about a human being.

### 3. One relationship table, not a students-only one

The plan needs parent links twice:

> "A student must have atleast one parent relationship."
> "A tutor can also have a parent relationship."

The second is easy to miss. It exists because of the third multi-role example — a senior student
who tutors younger children is still somebody's child. A `student_parents` table would not cover
it. `guardianships(guardian_user_id, dependent_user_id)` covers both, because both are the same
fact: one user is responsible for another.

---

## The tables

```
                        ┌───────────────────────────┐
                        │          users            │
                        │  one row per PERSON       │
                        │  email · name · phone     │
                        │  status · google_sub      │
                        └─────────────┬─────────────┘
                                      │ id
        ┌───────────────┬─────────────┼──────────────┬─────────────────┐
        │               │             │              │                 │
┌───────▼───────┐ ┌─────▼─────────┐ ┌─▼────────────┐ ┌▼──────────────┐ │
│  user_roles   │ │tutor_profiles │ │payment_      │ │availability_  │ │
│  N per user   │ │  0..1 per user│ │handles       │ │slots          │ │
│ admin/tutor/  │ ├───────────────┤ │ 0..2 per user│ │ N per user    │ │
│ student/parent│ │student_       │ │ zelle/venmo  │ │ day + hour    │ │
│               │ │profiles       │ │              │ │               │ │
│               │ │  0..1 per user│ │              │ │               │ │
└───────────────┘ └───────────────┘ └──────────────┘ └───────────────┘ │
                                                                       │
                          ┌────────────────────────────────────────────▼──┐
                          │              guardianships                    │
                          │  guardian_user_id ──► users.id                │
                          │  dependent_user_id ─► users.id                │
                          │  relationship · is_primary                    │
                          └───────────────────────────────────────────────┘
```

Every child table cascades on delete, so removing a person takes their roles, profiles,
availability, payment handles and family links with them.

### `users`

One row per person. `Full Name, Email, Phone, Active` from the plan, plus what sign-in needs.

`status` is three-state rather than a bare `active` boolean, because the portal needs to tell
"added by an admin, has never signed in" (`invited`) apart from "access revoked" (`suspended`).
Sign-in flips `invited` → `active` automatically, which is the moment the distinction stops
being true. `deleted_at` is separate again: suspension keeps someone in the directory, soft
delete retires them.

Email is unique **among live rows only** (`WHERE deleted_at IS NULL`) and compared lowercased,
because SQLite's default collation is case-sensitive. Any Google-backed address is accepted —
the plan's "gmail based userids" is satisfied by Google sign-in itself, and hard-coding
`@gmail.com` would shut out the institute's own Workspace addresses later.

### `user_roles`

`(user_id, role)` primary key. `admin`, `tutor`, `student`, `parent`, enforced by a CHECK.
Indexed by `(role, user_id)` so "every tutor" is an index scan.

### `tutor_profiles` / `student_profiles`

One optional row per user, primary-keyed on `user_id`.

`tutor_profiles.highest_education` is free text because the plan says it doubles as "currently
enrolled grade or math course" — for Sanjay it reads *Grade 12 - AP Calculus BC*. `area` is a
neighbourhood, for matching tutors to families. The tutor's mailing address is separate
(`address_line1`, `address_line2`, `city`, `state`, `postal_code`) and exists for one purpose:
the recipient's address on their year-end 1099-NEC. It is on `tutor_profiles` rather than
`users` because the 1099 is the only reason the institute records a street address, and only
tutors receive one; it goes when the tutor role does. Only admins and the tutor themselves can
read it (`scopePersonalDetails`).

`virtual_available` appears on both. This is not duplication: a tutor offering online sessions
and a student accepting them are different facts, and a tutor-student like Sanjay can differ on
each.

### `payment_handles`

`(user_id, method)` primary key, so at most one Zelle and one Venmo per person, never two of
either. Whether a handle is used to pay someone or bill them depends on the role they are acting
in, which is why the table does not record a direction.

### `availability_slots`

`(user_id, day_of_week, hour)` primary key. One row is one hour block: `(2, 16)` means Tuesday
16:00–17:00. `day_of_week` is 0=Sunday..6=Saturday, matching JavaScript's `Date#getDay()` so no
conversion is needed anywhere.

Discrete hours rather than start/end ranges: the plan says "select days of the week and hour",
and a checkbox grid maps one-to-one onto rows. The API groups consecutive hours back into
ranges for display, so the UI still reads *Tuesday 16:00–18:00*.

### `guardianships`

`(guardian_user_id, dependent_user_id)` primary key. `relationship` is mother / father /
guardian / other. A partial unique index allows **at most one primary contact per dependent**;
a CHECK stops anyone being their own guardian.

---

### `assignments` and `sessions`

Phase 4. An assignment pairs a tutor with a student and prices that pairing; a session is a
lesson that actually happened.

**There are two rates on every lesson, and they are not the same number.** The institute buys
tutoring at one price and sells it at another, and keeps the difference:

| | Set on | Resolved by | Frozen onto the session as |
| --- | --- | --- | --- |
| What the **tutor is paid** | `tutor_profiles` default, overridden per pairing on `assignments` | `resolveRateCents` | `tutor_rate_cents`, `tutor_amount_cents` |
| What the **family is charged** | `student_profiles` | `resolveChargeRateCents` | `charge_rate_cents`, `charge_amount_cents` |

The charge is priced on the STUDENT, with no per-pairing override: a family's price should not
change according to which tutor happens to be free that week. The pay keeps its override,
because what a tutor is worth for a particular student genuinely does vary.

**The margin is never stored.** It is `charge_amount_cents - tutor_amount_cents`, derived
wherever it is shown (`marginCents`), so it cannot drift out of step with the two numbers it
comes from. Storing one amount for both sides is what made the margin structurally zero before
these columns were split.

**Each party sees only their own side, and is told which side it is** (Phase 17). The API
decides per ROW, not per person, and labels the result `money_view`:

| Reader of a lesson | `money_view` | Sees |
| --- | --- | --- |
| an admin | `admin` | the family's charge, the tutor's pay, and the institute's cut between them |
| the lesson's tutor | `tutor` | their pay and rate; the price is blanked |
| the student, or a guardian of theirs | `family` | the price and rate they pay; the pay is blanked |
| anybody else | `none` | no money at all |

`scopeSessionMoney` applies it, with the reader's family (themselves plus their dependents,
`familyStudentIds`) read once per request. The tutor test comes first, so a tutor teaching their
own child sees their pay. Screens label every amount from `money_view` through one component
(`SessionMoney`) -- "Your pay", "You pay", or "Charged · Tutor · Institute" -- because a bare
figure meant the price to one reader and the pay to another, and a person who both tutors and
is taught (or parents) saw both meanings in one list. List totals follow the same rule side by
side: `total_tutor_amount_cents` is summed over the rows the reader was paid for,
`total_charge_amount_cents` over the rows that are their family's, each null when there are
none, so such a person sees both "Earned" and "Charged".

The same rule reaches every other place a rate appears. A pairing's rates are the tutor's pay
(`scopeAssignmentRates`); a tutor's default rates are theirs and the office's
(`scopeTutorPay`); a student's price is shown to admins and to that student's own family, who
pay it, but never to a tutor (`scopeStudentCharges`). The sessions spreadsheet carries only the
columns the reader has. The activity log carries no amount at all: the `session.recorded` line
used to end with the family's price, and the tutor who recorded it reads their own activity --
older lines keep it on disk (the log is append-only) and have it removed on every non-admin
read.

**No schema change was needed for this.** Both rates and both amounts were already frozen onto
every session when the price was split from the pay; what was missing was saying, for each
reader, which of them is theirs. The margin stays derived.

**A session cannot be recorded until both rates exist.** A missing tutor rate and a missing
student price each fail validation on the way in, rather than billing zero quietly.

**`sessions` deliberately has no foreign key to `assignments`.** The assignment authorises and
prices a session, but the session records what happened. Unassigning a student later must not
delete the lessons already taught.

**All four money columns are frozen snapshots.** Changing a rate tomorrow must not restate
lessons already taught, so whatever applied is copied onto the session at the moment it is
saved. `duration_minutes` is stored for the same reason: a later change to the rounding rule
cannot silently re-bill history.

**Durations round to the nearest quarter hour, with a floor of 15 minutes.** Nearest rather
than up or down, because rounding up systematically overcharges families and rounding down
systematically underpays tutors. The client never sends a duration or an amount — both are
derived server-side from the times and the assignment.

### `scheduled_sessions`

Phase 9. A standing weekly lesson, and what the calendar invite is generated from. Distinct
from `sessions`, which records lessons that actually happened: a schedule says "every Tuesday
at four", and whether any particular Tuesday went ahead is a separate fact.

Weekly on one weekday is the only recurrence offered. It is what tutoring actually looks like,
and it maps onto a single `RRULE` without needing a recurrence engine.

**The generated .ics uses floating local times** — no trailing `Z`, no `TZID`. A lesson is
"Tuesday at four" wherever the reader is, which is why the portal stores wall-clock times in
the first place. Attaching a timezone would mean shipping a `VTIMEZONE` block and getting DST
transitions right, to express something the institute does not actually mean. The `UID` is
derived from the schedule id, so re-downloading updates the event rather than duplicating it.

### `active_sessions`

Phase 7. A lesson being taught right now: the tutor presses start, teaches, presses stop, and a
`sessions` row is written while this one is removed.

Deliberately **not** a half-filled `sessions` row. A session is the billing record and every
column it carries must be true of it; a lesson in progress has no end, no duration and no
amount. Making those nullable would weaken the constraints protecting every completed session.

The primary key is `tutor_user_id`, which is what enforces one live lesson per tutor. Keeping
it in the database rather than the browser means a tutor can start on a phone and stop on a
laptop, and a refresh loses nothing.

**Rounding.** A live session snaps its *start* to the nearest quarter as it is pressed
(`roundClockToQuarter`), and is then billed for the time that actually elapsed between the
start and stop instants, rounded to a quarter (`roundToQuarterHour`); the end is the start plus
that length. The two functions stay separate because they round different things — an endpoint
and a duration — but the length always comes from the instants. Subtracting two separately
snapped endpoints, which is what the code did first, is wrong by a full quarter whenever the
two round opposite ways: 4:53 to 5:52 is 59 minutes, and 5:00 to 5:45 is 45.

**A lesson has a maximum length, and it enforces itself.** `tutor_profiles.max_session_minutes`
and `student_profiles.max_session_minutes` each hold the longest single lesson that person
does; the **shorter** of the two applies, and `DEFAULT_MAX_SESSION_MINUTES` (4 hr) covers a
pairing where neither is set. Both are on profiles rather than on the person because they are
genuinely different facts: a tutor who will teach for three hours and a nine-year-old who
cannot sit for more than one are both telling the truth.

A running lesson that reaches its limit is recorded at the limit and flagged `auto_stopped`,
because the alternative — a timer left on overnight — bills a family for a lesson nobody
taught. The sweep that does this (`autoStopExpired`) runs from a cron trigger every fifteen
minutes and again whenever anybody reads the live sessions, so a portal nobody has open still
settles up. The same cap applies when a tutor presses stop hours late, so the limit cannot be
sidestepped by leaving the timer running and stopping it by hand.

The limit deliberately does **not** apply to a session typed in afterwards, or to an edit. A
person asserting what happened is better evidence than a cap, and a lesson that really did run
five hours has to be correctable after the sweep cut it to four.

### Tutor advances

Phase 13. The institute pays most tutors **before** they teach: the office hands over, say,
$100 and the tutor works it off. `tutor_profiles.topup_amount_cents` is the level that advance
is kept above — when what the tutor still holds falls below it, another payment is due.

**Only the threshold is stored.** What the tutor holds is `paid - earned`, the mirror of the
`balance_cents` the ledger already derives, and the shortfall is `topup - held`. Both are
computed wherever they are shown (`tutorAdvanceCents`, `topupDueCents`, `needsTopup` in
`packages/shared/src/payments.ts`), for the same reason balances are: storing them would mean
two sources of truth that drift the first time a session is corrected.

**NULL means the tutor is not on an advance** and no top-up is ever due — they are paid for
work already done, and their row shows the ordinary owed figure instead. The two arrangements
coexist in one ledger.

A tutor in arrears has a *negative* advance, and the shortfall formula still holds: paying it
settles what they are owed and restores the float in one payment, which is what "keep the
balance above the top-up amount" means.

**Who may see it**: admins, and the tutor themselves. A parent or student can open the record
of the tutor teaching them, and what the office advances that tutor is no business of theirs —
`scopeTutorTopup` blanks it, the same way `scopeStudentCharges` blanks a family's price. The
institute-wide "top-ups due" total is admin-only for the same reason.

### Progress tracking: curriculum, assessments, plans

Phase 16. The institute teaches from one ladder -- Beast Academy levels 1-5, then the Art of
Problem Solving books -- and every student is measured against it three times over: where they
started (an **assessment**), where they are going (a **learning plan**), and how each lesson
moved them (**session progress**).

```
curriculum_levels ─┬─ curriculum_topics ──┬── assessment_topic_ratings ── assessments ───┐
                   │                      ├── learning_plan_topics ────── learning_plans ─┤── users (student)
                   │                      └── session_topic_ratings ───── sessions ───────┘
                   └── recommended / target level     session_progress (1:1 with sessions)
```

**Naming convention.** Level and topic ids are the codes the office speaks in, not UUIDs:

| Code | Level | Topics |
| --- | --- | --- |
| `BA1` … `BA5` | Beast Academy Level 1 … 5 | 12 each: guide books A-D × 3 chapters, numbered straight through (`BA3.01`-`03` are 3A, `BA3.10`-`12` are 3D) |
| `PRE` | AoPS Prealgebra | 15, one per chapter |
| `ALG` | AoPS Introduction to Algebra | 22, one per chapter |
| `GEO` | AoPS Introduction to Geometry | 19, one per chapter |

A topic is `<level>.<nn>`, so "topic 10 from level 3" is `BA3.10` and nothing else. The chapter
lists were taken from beastacademy.com and the AoPS tables of contents (current editions). The
catalog is reference data, inserted by an idempotent upsert block at the end of `schema.sql`;
topics are never deleted, because every rating references one without a cascade.

**One rating scale, 1-5, everywhere.** 1 means the student performs poorly or needs help, 5 that
they have it cold (`TOPIC_RATING_LABELS`). The assessment, each lesson's topic scores and the
lesson's step towards the goal (`GOAL_RATING_LABELS`, 1 = no progress … 5 = a big step) all use
it, which is what lets a lesson's 4 be read against the assessment's 1 on the same topic. An
unrated topic has no row: silence is not a 1.

**Assessments** keep the long-form write-up, what the student was enrolled in at the time, the
recommended level, and any topic scores. A reassessment is a new row, so the starting point is
never overwritten.

**Learning plans** hold the goal, the goal timeline (`starts_on` → `target_on`), the recommended
cadence (`sessions_per_week` × `session_minutes`), the prose recommendation, and the topics to
cover in teaching order -- which may reach into a lower level. A partial unique index allows
**one active plan per student**, so "the plan" a lesson is scored against is never ambiguous;
finished plans stay as `achieved` or `closed` history.

**A student has one goal.** It is stored twice -- `student_profiles.academic_year_goal`, which
the user dialog edits, and the active plan's `goal` -- because it exists before any plan does.
While a plan is active the API keeps the two equal on every write, from either side, in the same
batch: saving the plan writes its goal onto the profile (`planGoalSyncStatement`), and saving the
profile writes its goal onto the plan (`goalSyncFromProfile`). A plan cannot be without a goal,
so clearing it in the user dialog puts the plan's back. A new plan starts from the goal on the
record, and both forms say that editing one edits the other. Finished plans keep their own goal
as history.

**Session progress** sits beside `sessions` rather than in it: the session is the billing
record, and how a lesson moved the goal is an optional teaching judgement. `session_progress`
freezes the plan that was active when the lesson was first scored, so a later plan never
re-files old lessons.

**Progress is derived, never stored** (`computeProgress` in `packages/shared/src/progress.ts`,
used by both the API and the dashboards). A plan topic counts as mastered when its *latest*
score reaches 4; the share mastered is compared with a straight pace line from 0% at the start
to 100% at the goal date, and a student within ten points of it is on track.

**Who may see it.** Admins; the student; their guardians; and every tutor *currently* assigned
to them (`studentScopeSql`) -- wider than a lesson's own audience, because a plan is shared work
and a tutor taking over needs to know where the last one left off. Only admins write
assessments and plans ("the owner assesses the student"); tutors score progress through the
lessons they record. None of it carries money.

### `admin_profiles`

Role data for an admin, which today is one field: `tin`, the taxpayer identification number the
institute files its 1099s under. It sits beside `tutor_profiles` and `student_profiles` rather
than in a settings table because it obeys the same rule they do — the row exists while the role
does, and `profileCleanupStatements` removes it when the role is dropped. An institute with two
admins records it twice; that is the price of the model being one rule rather than two, and the
1099 prefills from whichever admin is signed in.

**It is not a Social Security number.** A sole proprietor may well file under theirs, and the
API refuses that here as firmly as anywhere else: the field runs through `optionalText`, so
`containsSsn` guards it. The promise that the portal never stores an SSN cannot have an
exception for the field named after tax. Only an admin may read it (`scopeAdminTin`) — a family
can open an admin's record, and the institute's tax identity is not part of what they may see.

### Tax documents, and the SSN that is not here

Phase 14. The institute files a tax document for each tutor at year end, which needs their
Social Security number. **The number is never stored in this database, never sent through this
portal, and never asked for by any screen in it.** `tutor_profiles.ssn_received_on` is a
receipt, not a record: a date saying the office confirmed it holds what it needs, or NULL
saying it does not. That is the only question the portal has to answer all year — "may we file
for this tutor yet" — and a date answers it without the institute becoming a place where
identity numbers are kept.

"We do not store SSNs" is enforced, not merely intended. `containsSsn` in
`packages/shared/src/tax.ts` rejects SSN-shaped text from **every free-text field** — every one
is built from `optionalText`, which is where the guard lives, plus the comment body, which is
required and so has it applied directly. The pattern is deliberately narrow: `123-45-6789` and
`123 45 6789` are unmistakable, and nine bare digits are only refused when nearby words say
"SSN" or "social security", so a phone number, invoice reference or student id still goes
through. A validator that cries wolf gets worked around.

**A 1099 can be produced for any tutor, at any time.** Nothing gates it: the number is typed
into the dialog when the form is printed, so `ssn_received_on` is a note to the office about its
own paperwork rather than a precondition -- gating on it meant an admin with the number in front
of them could not use it. The tax year is chosen rather than assumed, because the work happens
in January for the year that just ended; pinning it to today's year made the forms that were
actually due unreachable. Tutors paid nothing in the chosen year stay on the list too, below
those who were paid.

The year-end 1099 is prepared in the browser. The admin types the number into a dialog, which
writes a printable sheet into a new window and hands it to the print dialog; **nothing is sent
to the server**, so the number never reaches a request body, a log line or a row. What prints
is the recipient's copy and the payer's record — Copy A, the red scannable sheet, is filed
electronically or on official stock and cannot come off any printer. Box 1 is the total PAID in
the calendar year, which is why the figures come from `payments` rather than from what the
lessons earned.

Both sides are told when it is missing: the tutor's own dashboard asks them to hand it to the
office **and says not to send it through the portal**, and the admin's lists who is outstanding.
Recording receipt is a one-field admin endpoint (`POST /api/users/:id/ssn-receipt`) whose body
is a single boolean — there is no shape of request that could carry a number. The year-end
summary (`GET /api/payments/tax-summary.csv?year=`) pairs what each tutor was PAID in the
calendar year with whether the office can file for them; payments rather than earnings, because
a tax document reports money that moved.

### `session_drafts`

Phase 22. A lesson a tutor has written up but not posted.

**Deliberately not a `sessions` row with a flag on it**, for the same reason `active_sessions`
is not. A session is the billing record, and every figure that reads it — balances, the monthly
rundown, the dashboards, the exports, a student's progress — would then have to remember to
exclude drafts. That is sixteen query sites, and one forgotten `WHERE` bills a family for notes
a tutor was still drafting. In its own table, no query can see a draft by accident.

A draft carries **no money at all**: it is priced when it is posted, at whatever rates apply
then, so one left sitting over a rate change cannot post at yesterday's price. Posting creates
the session and deletes the draft in the same request — one write-up must not become two records.

**It belongs to its author, not to the tutor it names and not to admins.** `author_user_id` is
what every draft route scopes on, and a draft somebody else asks for is reported as missing
rather than forbidden: that a colleague has an unfinished write-up is itself theirs to know.
The point of the feature is notes that are not ready to be read.

`progress_json` holds the ratings the form was holding, as the form held them — unposted working
state rather than a record. Nothing reads it but the form it came from, and posting turns it
into real progress rows.

### `payments`

Phase 5. A ledger of money that moved **outside** the portal, so the institute can answer two
questions: what a family still owes, and what a tutor is still owed. Those are opposite
directions of the same table, which is why `direction` exists rather than two near-identical
tables.

**A family payment must name a student**, enforced by a CHECK. Charges arise from a student's
lessons and a student may have two guardians who both pay, so a payment with no student would
belong to no balance at all. Payments to a tutor carry no student, because they settle the
tutor's whole ledger rather than one child's.

Balances are derived, never stored:

```
tutor   balance = sum(sessions they taught)        - sum(payments to_tutor)
student balance = sum(sessions for that student)   - sum(payments from_parent for them)
```

Storing them would mean two sources of truth that drift the first time a session is corrected.
The headline totals sum only *positive* balances, so one overpaid tutor cannot mask another's
unpaid one.

### `comments`

Phase 12. A remark somebody wants on the record, against a person, a lesson, a pairing or a
recurring slot: "parent asked to move Thursdays", "finished the fractions unit".

Three tables now hold prose, and they are not interchangeable. `audit_events` is what the
**system** did, written by code and never by hand. `sessions.notes` is the **tutor's account of
one lesson**, part of the billing record. A comment is **one person addressing the people who
share the thing it hangs off** — and it is the only one of the three anybody can delete.

**The target is four nullable foreign keys, not a `(target_type, target_id)` pair.** The pair is
the usual shape and it is the wrong one here: it cannot be a foreign key, so the database would
no longer know the target exists, and deleting a lesson would leave its comments behind pointing
at nothing. A `CHECK` that exactly one of the four is set makes them behave as one field, and
the API still speaks `target_type` / `target_id` at its edge.

**Who may read one is the whole feature, and it differs by target.** A comment on a lesson, a
pairing or a slot goes to everyone that row concerns — its tutor, its student, that student's
guardians, and admins — the same rule as `teachingScopeSql`, because a comment should not be
readable by fewer or more people than the thing it is about. A comment on a **person** is
narrower: admins, its author, that person, and that person's guardians. That is what keeps one
tutor's remark about a family off another tutor's screen, while making sure nothing is written
about somebody behind their back.

**One set of visibility fragments, three readers.** The thread, the per-row count badges and
the global feed at `/comments` all build their WHERE from `personScopeSql` and
`teachingScopeSql` in the comments repository. That matters because they are easy to drift
apart, and a drift shows somebody a comment they cannot open, or hides one they are entitled
to. The feed is a different view of the same comments, never a wider one — a parent's feed is
their own family's, an admin's is the institute's.

**Never edited, and deleted only by whoever wrote it** — not by an admin, which is unusual in
this codebase and is what the plan asks for. There is no `updated_at` and no trigger, so the
schema itself says a comment cannot change: a remark somebody has already read must not be
rewritten under them. Deleting is soft, and hides it from everyone including its author.

### `audit_events`

Append-only activity log, added in Phase 3. Never updated, never deleted by the application
— an audit trail that can be edited is not an audit trail.

| Column | Notes |
| --- | --- |
| `actor_user_id` / `actor_name` | Who acted. The id goes NULL if they are purged; the **name is a snapshot** so the line still reads |
| `subject_user_id` / `subject_name` | Who it was done to, when that differs from the actor |
| `action` | Always `<entity>.<verb>`, e.g. `user.created`. Grouped so the UI can filter by entity without a second column |
| `description` | The human-readable line, written at the moment of the action — only the code performing it knows what it meant |
| `entity_type` / `entity_id` | The record acted upon when it is not a user |

Two decisions worth keeping:

**The foreign keys are `ON DELETE SET NULL`, not `CASCADE`.** Purging a user must not erase the
record of what they did. That is the whole reason the name columns exist.

**A person's feed matches them as actor *or* subject.** An admin editing your record is part of
your activity, not just theirs, so `?user_id=` filters on both.

Writes are best-effort: `recordAudit` swallows its own errors so a logging failure can never turn
a successful action into a failed request. It is awaited rather than backgrounded, because both
the UI and the Phase 6 tests read the log immediately after acting.

## What the database enforces, and what it cannot

The schema carries every rule it is capable of carrying:

| Rule | Enforced by |
| --- | --- |
| Role must be one of the four | `CHECK` on `user_roles.role` |
| A role cannot be granted twice | `PRIMARY KEY (user_id, role)` |
| One Zelle and one Venmo per person, max | `PRIMARY KEY (user_id, method)` |
| An availability hour cannot be listed twice | `PRIMARY KEY (user_id, day_of_week, hour)` |
| `day_of_week` 0–6, `hour` 0–23 | `CHECK` constraints |
| Nobody is their own guardian | `CHECK (guardian_user_id <> dependent_user_id)` |
| At most one primary guardian per dependent | partial `UNIQUE INDEX` |
| One live user per email address | partial `UNIQUE INDEX` on `lower(email)`, over rows that have one |
| Deleting a person removes everything hanging off them | `ON DELETE CASCADE` |
| A session limit is a positive multiple of 15 minutes | `CHECK` on `max_session_minutes` |
| A top-up level cannot be negative | `CHECK (topup_amount_cents >= 0)` |
| A comment is about exactly one thing | `CHECK` over the four target columns |
| A comment cannot be empty | `CHECK (length(trim(body)) > 0)` |
| Deleting a lesson removes its comments | `ON DELETE CASCADE` on each target |

Three rules **cannot** be constraints, and live in the API instead. They are called out here
because "the database guarantees it" would be wrong:

1. **"A student must have at least one parent relationship."** A cross-row invariant: the
   student row must exist before any guardianship can reference it, so no CHECK or foreign key
   can express it. Enforced in `apps/api/src/routes/users.ts`, which is why creating a student
   and naming their parent is a **single** request — separate calls would leave the student
   parentless in between. It is re-checked on every update that could break it, including
   removing the last guardian and adding the student role to an existing user.

2. **"Only admins can add a new user into the system."** Authorization, not data. Enforced by
   `requireAdmin` on every mutating user route.

3. **A profile row exists only while its role is held.** Dropping the tutor role deletes the
   tutor profile, in the same batch as the role change.

4. **"Only a student who holds no other role may be without an email."** The address is on
   `users` and the roles are rows in `user_roles`, so no CHECK can see both. `users.email` is
   nullable because most students are children who have no address and never sign in — their
   parents read their dashboard from their own login — and requiring one forced invented
   addresses like `child-no-email@noemail.com` into the directory, which look like contact
   details and are not. Everyone else signs in, and sign-in matches on email, so an admin,
   tutor or parent without one could never get in. Enforced by `refineEmailForRoles` on the
   create schemas and `assertEmailPresentIfNeeded` on update, which resolves both sides to
   their post-update values: taking somebody's address away *and* making them a tutor in one
   request fails as surely as doing it in two.

5. **Who may read a comment.** The rule depends on the kind of target and, for a person, on
   guardianship — a join the row itself cannot express. It lives in
   `apps/api/src/repositories/comments.ts`, and every route there resolves the TARGET before it
   touches a comment, so a thread can never be reached through an id the viewer would not have
   been allowed to see in the first place.

Rules the plan deliberately does **not** impose, and the schema therefore does not either:
a parent may have no dependents ("Parent may or may not have a student assigned"), and a tutor's
parent link is optional.

---

## Reading the model

```sql
-- Everyone who tutors, including people who are also something else
SELECT u.full_name FROM users u
JOIN user_roles r ON r.user_id = u.id AND r.role = 'tutor'
WHERE u.deleted_at IS NULL;

-- People wearing more than one hat
SELECT u.full_name, GROUP_CONCAT(r.role, ' + ') AS roles
FROM users u JOIN user_roles r ON r.user_id = u.id
GROUP BY u.id HAVING COUNT(*) > 1;

-- Who is free on Tuesday at 16:00 and will teach online
SELECT u.full_name FROM users u
JOIN availability_slots a ON a.user_id = u.id AND a.day_of_week = 2 AND a.hour = 16
JOIN tutor_profiles t ON t.user_id = u.id
WHERE t.virtual_available = 1 AND u.deleted_at IS NULL;

-- Students missing a parent: the invariant the database cannot enforce
SELECT u.full_name FROM users u
JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
WHERE NOT EXISTS (SELECT 1 FROM guardianships g WHERE g.dependent_user_id = u.id);
```

That last query is worth running after any bulk change — it is the audit for rule 1 above.

---

## Deliberately absent

The plan puts classes, schedules and homework in later phases, so there are no `classes`,
`enrollments`, `sessions` or `attendance` tables, and no tutor↔student assignment. When
scheduling arrives it will join `availability_slots` on both sides; that is the seam the hour
blocks were designed for.

There is no `parent_profiles` table. Parents get no attributes of their own in the plan beyond
a payment handle, and that belongs to the person. Being a parent is a role plus a set of
guardianship links — an empty profile table would carry no information and invite someone to
start putting person-level data in it.

There is no role-based *read* restriction yet. Any signed-in user can view the directory; only
admins can change it. Narrowing reads (a parent seeing only their own children) needs the
scheduling model to be meaningful, so it belongs with that phase.

---

## Rebuilding

The schema is greenfield per the plan: no migrations. `apps/api/db/schema.sql` drops and
recreates everything, and `apps/api/db/seed.sql` loads a roster chosen to exercise each
requirement — an admin who tutors, a parent who tutors, a tutor who is also a student and has a
parent of his own, a student with two parents one of whom is primary, and a parent with no
children.

```bash
npm run db:reset          # local: rebuild + seed
npm run db:rebuild:remote # production: DESTROYS ALL DATA
```

See [database.md](database.md) for the operational side.

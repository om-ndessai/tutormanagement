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
neighbourhood, not an address: *"We are not recording real address yet."*

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

**Each party sees only their own side.** `scopeSessionMoney` blanks the charge for a tutor and
the pay for a family, and `scopeStudentCharges` hides a student's price from anyone but an
admin. Both run in the API, not the UI: a tutor who knows their own rate would otherwise be one
API call away from the institute's markup. Only an admin sees both, which is what makes the
margin visible to them alone -- and why the money fields on `TutoringSession` are nullable.

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

**Rounding differs from Phase 4 on purpose.** A typed-in session rounds its *elapsed time* to
the nearest quarter. A live session snaps *each endpoint* as it is pressed — "the start time
will be nearest 15 min ... it will again record session end to nearest 15 min" — so the
duration falls out as a multiple of 15 rather than being rounded itself. `roundClockToQuarter`
and `roundToQuarterHour` are separate functions for that reason.

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
| One live user per email address | partial `UNIQUE INDEX` on `lower(email)` |
| Deleting a person removes everything hanging off them | `ON DELETE CASCADE` |

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

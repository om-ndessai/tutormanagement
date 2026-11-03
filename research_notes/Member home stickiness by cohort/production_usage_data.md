# Production usage data (tutoring-db, read-only, 2026-11-03)

Aggregates only, read with the owner's permission. The owner noted: "the issue is with volume to do any
meaningful analysis. As of now the student and parent don't have any login attempts. Only the tutor/admins
have logged in." The few student/parent sign-ins below are the owner's own test personas (people who are
admin+student or admin+parent in a space).

## Spaces (live)
| Kind | Tutoring | Assessment | Quest | Spaces | Members |
| --- | --- | --- | --- | --- | --- |
| console-made | on | off | off | 2 | 19 |
| console-made | off | on | on | 1 | 4 |
No personal (self sign-up) spaces yet: sign-up only opened today, now under Post-approved.

## People by role (a person with two roles counts in both)
| Role | People | Ever signed in | Signed in 7 d | 30 d | Entered a space 30 d |
| --- | --- | --- | --- | --- | --- |
| admin | 5 | 4 | 3 | 4 | 3 |
| parent | 8 | 2 | 2 | 2 | 2 |
| student | 6 | 2 | 2 | 2 | 2 |
| tutor | 3 | 3 | 1 | 3 | 3 |

Sign-ins per week (all people): W38 23 (2 people), W39 30 (3), W40 36 (5), W41 42 (4), W42 28 (4), W43 28 (4),
W44 14 (3).

## What people did, last 60 days (audit log, by the actor's roles in that space)
Top actions:
- **Tutor (one real tutor, the main user):** auth.signed_in 42 on 15 days; auth.entered 41 on 19 days;
  **session.recorded 22 on 19 days**; **session.assessed 17 on 12 days** (an assessment on a lesson);
  session.updated 16; session.drafted 6; schedule.occurrence_cancelled 5; schedule.created/updated 8;
  comment.added 4; quest.game_joined 6. The tutor's loop is: open the app, record the lesson just taught,
  assess it, sometimes fix it or cancel/move a date.
- **Admin who is also a parent (the owner):** auth.entered 68 on 25 days; user.created 14; user.updated 11;
  locations, assignments, plans, schedule updates, payments recorded, features switched.
- **Admin (others):** auth.entered 16; admins added; organization updated; payment.recorded 3.
- **Admin who is also a student (the owner testing Quest/Assessment):** quest.game_created 8, joined 13,
  started 4; canvas_assessment.started 3; quest.level_set 4.
- **Student (test persona):** quest.game_created 9, started 9, joined 13, ended 2; favorite saved 2;
  canvas_assessment.started 2.
- **Parent (test persona):** quest.game_joined 4.

## Lessons recorded per week (sessions)
W35-W38: 1 a week; W39-W41: 4 a week (1 tutor, 3-4 students); W42: 2; W43: 4. Almost all recorded by the
tutor themselves.

## Quest / Assessment / Daily totals (all time)
- Quest games: 10, by 2 hosts (2026-10-23 to 2026-10-31). Game players by role: student 9, admin+student 9,
  tutor 5, parent 4 (one person each).
- Question Quest answers (quest_attempts): 0. Daily results: 0. activity_days: 0 (streak inputs).
- Canvas assessments: 1 started, 0 reviewed. Favorites: 1.

## What this supports
- A real behavioural signal exists only for the TUTOR (record + assess the lesson, several days a week) and
  the ADMIN (people setup, payments, settings). Student, parent, Quest-only and Assessment-only cohorts have
  no real usage yet: their homes must be designed from the product's jobs and the market research, and
  instrumented so the next analysis has data.

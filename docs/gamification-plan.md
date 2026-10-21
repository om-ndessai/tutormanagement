# Gamification: Question Quest and points (Phases 42, 44 and 45)

The owner's brief is `docs/gamification.md` (2026-10-19/20): make the platform sticky, especially the
app on phones and iPads, starting with **students answering the question bank's unapproved questions
and tutors confirming them**, with points for both, streaks and other metrics, proposals for rewards
and badges, and the workflows full screen. This document reviews the brief against the platform's
rules, then plans it in three phases. Nothing here is built until the owner settles the decisions in
"Decisions" below.

## Review of the brief

What fits the platform as it stands:

- **The bank is ready for it.** About 18,500 `checked` questions wait for approval (9,700 on NC 2026,
  8,859 on Beast Academy, `docs/question-bank-beast-academy.md`); a platform admin approving them one by
  one is the bottleneck this turns into a game.
- **Answers are marked by code, exactly.** Every bank question is multiple choice or a number, and
  `checkAnswer` already marks both. The student's answer needs no tutor to tell right from wrong.
- **Organization switches** are an established pattern (`canvas_assessments`,
  `canvas_assessments_unreviewed`); a set of gamification flags follows it.
- **Full screen** suits the app: the Assessment canvas is already a focused screen; the immersive
  research (`docs/mobile/immersive-design.md`) covers it.

Where the brief meets a rule, and what this plan recommends:

1. **Who may approve a platform question.** Today only a platform admin approves (`CLAUDE.md`, "A
   question reaches a test only by passing every check and a person"), because one approval puts a
   question into every organization's tests. The brief has a tutor's "correct" approve it.
   *Recommended:* a tutor's confirmation approves the question (as the owner asks), recorded with the
   tutor as reviewer and `approved_via = 'quest'`, and the console lists quest approvals so a platform
   admin can retire a bad one. An alternative, stricter option is two independent confirmations
   (two tutors, or two students' correct answers plus one tutor). See Decision 1.
2. **A correct answer is not a sound question.** A student can choose the key of a flawed question; a
   tutor rewarded per approval has a reason to click quickly. *Recommended:* code marks the answer;
   the tutor judges **the question**, seeing the stem, the student's answer, the key, the worked
   solution and the blind solver's notes, and chooses one of: **Question is right** (approve),
   **Question has a problem** (flag, with a reason), **Not sure** (skip, back to the queue). Points go
   for a review done, not only for an approval, so there is no reason to approve rather than flag.
3. **Most students cannot sign in.** Students are usually children with no email, and sign-in is
   Google only. *Recommended:* a student with a sign-in lands in Question Quest as the brief says; for
   everyone else, an adult who may follow the student's progress (a parent, their tutor, an admin)
   starts **"Quest for Sofia"** on the iPad or phone, hands it over, and the session runs full screen
   as that student until the adult ends it. The answers and points are the student's either way.
4. **No going back.** Kept: one question at a time, submitted on its own, no previous button. A
   question already shown to the student is never shown to them again.
5. **The audit log.** Every action is audited, but logging each answer would bury the log.
   *Recommended:* answers are their own records (`quest_attempts`), never audit lines; a tutor's
   review, a level change, a reward redeemed and a flag switched are logged.
6. **Points are about children.** A public leaderboard of children's names conflicts with
   `docs/data-exposure.md`. *Recommended:* a student's points and badges are seen by the student, their
   guardians, their current tutors and the admins (the progress audience, R-new); no leaderboard in
   Phases 42 and 44; an opt-in, first-names-or-nicknames leaderboard is a Phase 45 proposal behind its own
   flag.
7. **The beginning grade.** A per-organization fact about a student, so it is a `student_profiles`
   column (the people-model rule), chosen from the bank's levels (G3-G8, Math 1, BA1-BA5, AoPS).

## The workflow (Phase 42)

**Student: Question Quest.**
- Opens full screen: on the app as a full-screen route outside the tabs (no tab bar, status bar
  hidden, screen kept awake, iPad layout with the question and the answer side by side); on the web
  with the browser's Fullscreen API and a distraction-free layout.
- Serves the next `checked` question of the student's current level, chapter by chapter and easier
  first, from just after the last one they answered (one seek on `questions_quest_idx`, never a read
  of the whole level), skipping standards marked "needs a figure"; a question waiting for a review in
  the same organization is not served to a second student there (so one question is not answered
  twenty times). A question skipped that way is not offered to that student again.
- The student answers: choices as buttons, a number in a keypad field, with an optional scratch canvas
  for working (the Assessment canvas, not stored). Submit marks it by code at once and shows a small
  "Saved" (not right or wrong: the tutor has not looked yet, and an unreviewed key could be wrong).
- Moves on. When the level runs out of unapproved questions it says so and offers the next level.

**Tutor: the review queue.**
- On signing in (when the flag is on) the tutor lands on "Questions to review" for their own students'
  submitted answers, oldest first; admins see all of the organization's.
- One at a time, full screen: the student's first name, the question, their answer and the code's
  mark, the key, the solution, and the blind solver's verdict. Buttons: Question is right / Question
  has a problem (reason required) / Not sure.
- **Question is right:** the question becomes `approved` (reviewer the tutor, `approved_via = 'quest'`);
  if the student's answer was correct, both earn a point (the brief); the tutor earns a review point
  either way.
- **Question has a problem:** the question becomes `flagged` with the tutor's reason in its checks; it
  goes to the platform console's queue. The student keeps a point if their answer matched the key
  (they did nothing wrong).

## Data model (additive)

- `organizations`: `gamify_question_quest INTEGER NOT NULL DEFAULT 0` (the first flag; later flags are
  further columns, as with the Assessment switches).
- `student_profiles`: `quest_level_id TEXT` (the beginning level; NULL until an admin, tutor or parent
  sets it).
- `questions`: `approved_via TEXT CHECK (approved_via IN ('console', 'quest'))`.
- `quest_attempts`: id, organization_id, student_user_id, question_id, answer (text), correct (0/1 by
  `checkAnswer`), entered_by_user_id (the adult who ran the session, or the student), submitted_at,
  reviewed_by_user_id, reviewed_at, review (`approved` | `flagged` | NULL), review_note. Unique
  (organization_id, student_user_id, question_id): never served twice. Indexed for the tutor's queue
  (organization_id, reviewed_at, submitted_at).
- `points_ledger`: id, organization_id, user_id, points (integer, may be negative for a redemption),
  reason (`answer_confirmed`, `review_done`, `streak_bonus`, `badge`, `redeemed`), ref_id, created_at.
  Append-only, never updated (like `audit_events`); a balance is always a SUM, never stored, the way
  money and progress are derived.
- `activity_days`: organization_id, user_id, day (on the organization's clock, `zonedClockParts`),
  answers, reviews; one row per person per day, upserted. Streaks and "days active" are derived from
  it cheaply (a current streak reads at most a few dozen rows).
- `user_badges` (Phase 44): organization_id, user_id, badge, earned_at; unique per badge.
- Every table carries `organization_id`, with the same-organization triggers; every query names the
  organization (`check-org-scope.mjs`).

## Metrics kept (Phase 44)

Per person per organization, derived from the tables above: points (total, this week), questions
answered and confirmed correct, reviews done, approvals and flags (tutors), current streak and longest
streak (consecutive days with at least one answer or review), days active this month, levels
completed. Shown on a "My progress" card (student: in Quest; tutor: on the Tutoring tab, no money),
and to the audience in item 6.

## Proposals: earning and redeeming

Earning (Phases 42 and 44):
- A student: 1 point for each answer, and 1 more when the answer was right and the question is
  approved. A tutor: 1 point for every review, approve or flag alike (owner, 2026-10-20).
- Streak bonuses: +2 at 3 days, +5 at 7, +10 at 30 (once each per streak).
- Badges: First approval; 10 / 50 / 100 / 500 questions confirmed; 7-day and 30-day streaks; Level
  cleared (every unapproved question of a level answered); Sharp eye (a tutor's flag the platform admin
  upholds); Helper (a tutor's 100 reviews).

Redeeming (Phase 45, its own flag):
- **A rewards shelf each organization writes**: its admins list rewards with a points price ("choose
  the next lesson's game", "a sticker", "5 minutes of puzzle time", "a certificate"). A student (or
  their parent) asks to redeem; a tutor or admin marks it given; the ledger takes the points off. No
  money, gift cards or anything cash-like, so points never become a billing matter.
- **Certificates**: a printable PDF for a badge or a cleared level (the Assessment PDF writer).
- **Tutor recognition**: the admins see each tutor's reviews and approvals; the organization decides
  any reward offline.
- **Leaderboard (opt-in)**: weekly, first names or a chosen nickname, within one organization, off by
  default.

## Phases

- **Phase 42 — Question Quest and points.** The flag; the beginning level on the student's profile
  (set from the Quest page's student list, web and app); the signed-in student's full-screen Quest; the tutor's full-screen review queue and landing; approvals and flags into the bank;
  `quest_attempts`, `points_ledger`, `activity_days`; points shown on Quest and the queue; exposure
  rule and its crawl; audit actions; web and app together (parity), iPad layout.
- **Phase 44 — Streaks, metrics and badges.** The metrics above, the "My progress" card, streak
  bonuses, `user_badges` and the badge set, a gentle in-app nudge on the Home screen ("2-day streak:
  one question keeps it going"); push reminders wait for the push roadmap item.
- **Phase 45 — Rewards.** The rewards shelf, redemption requests and their approval, certificates, the
  opt-in leaderboard.

## Decisions (owner, 2026-10-20)

1. **One tutor approves.** "Question is right" approves the question for the whole platform, recorded
   as a quest approval (`approved_via = 'quest'`, the tutor as reviewer) so a platform admin can find
   and retire a bad one.
2. **A level moves up when it is used up.** When the student has answered every unapproved question
   of their level, Quest moves them to the next level of the same family (G3 ... G8, Math 1; BA1 ...
   BA5, AoPS Prealgebra, Algebra, Geometry) by itself. An adult may still set the level.
3. **Signed-in students only.** Quest is for students with their own sign-in; no adult-run sessions.
4. **Points (owner, 2026-10-20).** A student earns a point for each question answered, and another
   when the answer was right and the question is approved. A tutor earns a point for each review,
   whether it approves or flags, and nothing more: approving never pays more than an honest flag.
   The values are one shared table (`QUEST_POINTS`), so they can be tuned without a schema change.

Phase 42's workflow above is read with these: item 3 of the review drops the adult-run session, and
points follow decision 4.

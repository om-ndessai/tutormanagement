This document details the phased development of the portal.

Phase 1: 
The goal of this phase is to enable google social login. This would be the only way for users to login. The main page will have Google social login option. Upon clicking it will trigger gmail login. Upon successful authentication, it will bring a page with details from the users table matching the email id of the google login. 

Build it in a way so that it can be disabled for next phases - to enable testing without any authentication. In the later phases, I will reenable the social login.

Another output expected is a document on setting this up in google.

Phase 2:
The goal of this phase is to finalize the data model for users, build the RD1 database and run the necessary scripts to build the database. In all these phases, there is no need to do any migration since this is a greenfield project. If any data model needs to be updated, delete all tables and recreate.

The portal will be used by following types of users. 
Admins - these are owners of the institute or people with admin access. Only this user can add a new user into the system.
Tutors - users who offer tutoring services. 
Students - users who are enrolled for tutoring. 
Parents - users who are responsible for costs and communicating and monitoring the classes and schedule.

At this point, we will only allow gmail based userids since in the later phase google based social login will be the only way of login into this portal.

A user can have multiple roles. A parent can be a tutor, admin can be a tutor. A tutor could also be a student tutoring lower grades.

All these entities are users in the system.
Users must have following attributes: Full Name, Email, Phone, Active
Tutors must have following data: Highest education, it could also be currently enrolled grade or math course. 
School, Location - area. We are not recording real address yet. General availability - can select days of the week and hour at which available. Notes - where tutors can enter availability note. Availability for virtual tutoring. Tutor also must have zelle or venmo id for payments. A tutor can also have a parent relationship.
Stuents must support following data: School. Currently enrolled math course/grade. Goal for the current academic year. Day of the week availability as well availability for virtual tutoring. 
Parents: Support recording zelle or venmo id for requesting payment. A student must have atleast one parent relationship. Parent may or may not have a student assigned. 

Phase 3:
This phase is about building user audit. Each user activity needs to be recorded in a user audit system. This needs to have a timestamp, the userid and brief description of what action was performed. Within each profile, a run down of the activity should be visible. Admin should have ability to see the user activity within the entire system as well as for inidividual user.

Phase 4:
Portal enhancement for Tutors. This phase will make enhancements for tutors. Only admins can add another user. A parent must be created before a student can be created. And admin can assign student to tutors.

A tutor will have a default hourly rate. The rate can be different for in person vs virtual. The system should also allow variable rate for each student/tutor relation. Admin, when assigning a student to the tutor can specify the hourly rate.

After each session, the tutor will record that session was held. Will specify the start / end time. Come up with intuitive way of recording start/end time and calculate the session time by rounding to 15 min interval. Eg- session times will be like 1hr, 1hr 15 mins, 1hr 30 mins and so on. The tutor will also need ability to enter notes of the session - could include feedback, track towards the goal, session assessment, home work etc. 

After the session details are saved, the amount for the session will be calculated and saved. This will drive the billables for the session and will help the admin to keep track of amount the tutor has earned.

Phase 5: 
Payment enhancements. No actual payments will be made through the portal. Its only to keep track of what a tutor owns and let admin record when the payment was received from the parent and when the payment was made tot he tutor. The payments should allow recording date time, amount, for which student if the payment is coming from parent etc. Balances need to be supported for parents as well as tutors. The payment form need to be supported are venmo, zelle, cash, check. 

Phase 6:
This phase is about thourough end-to-end testing. For each testing session, wipe out the database and rebuild through automation testing. Iterate through to make changes to the data model, api, ui etc till the goals described in above phases are achieved.
I want to use playwright for testing. Use the production site/url, DB for testing. Disable authentication during the testing. 
The goal for this phase is to confirm end-to-end workflows for different types of users. Launch portal as a different type of user and validate. 

Phase 7:
This phase allows the tutor to record session start and end real time. When the session is to start, the tutor could click the start session button and select student. The start time will be nearest 15 min, when the session ends, it will again record session end to nearest 15 min. The tutor can record session details at that time or can edit those later.

Phase 8:
This is dashboard phase. The goal of this phase is to provide a dashboard for individual user types. 
Admin will see cards for how many students are actively enrolled, how many parents, how many tutors etc. The admin should also see balances on each tutor, parent etc. The cards should be clickable to get more details. The admin should also see audit of last few entries throughout the system. 
A tutors dashboard will have student cards, applicable payment cards etc. A log of activity in reverse chronological order. Conducted sessions log in reverse chronological order etc.
Parent dashboard will have payment card, session log in reverse chonological order. 
Handle cases where a single user could have multiple roles and so dashboard should have ability to select the role for that user.

Admin will have ability see the dashboard as seen by inidvidual user. On the main dashboard, the admin should be able to see all users and can then select a user to see the dashboard as shown to that user.

This is the place for you to build industry standard intuitive and exciting dashboard with animation etc.

Phase 9: 
Ability to download a calendar file for scheduled tutoring sessions. A tutor should be able to schedule a recurring tutoring session for his/her students. And all applicable users (parents, tutors, admins, students) should be able to download the calendar invite for those session.

Phase 10: 
Ability to download csv for payments and tutoring session log. Allow applicable users to see a grid of session and/or payments and download that in csv format to open in excel sheet.

Phase 11:
This phase is about bringing up test environment. Create new database test instance, worker test instance and test portal. 
Playwright will no longer use the production instance and the test database will be seeded with a couple of admin accounts, 10 tutors, 30 parents and 50 students.
Run all playwright tests on this instance and verify. Disable authentication on the test portal

Phase 12: 
Allow ability to record a comment. The comment will include the timestamp, the user and target. The target could be a user, a scheduled session, an assignment of the tutor/student relationship or a session itself.
Comments are only shown to the related parties. Comments are not editable. They can only be deleted by the user who entered it.

Build a reverse chronological view which depicts applicable comments for any entity. 

Do a detailed industry standard best practice for this ask and come up with a plan to implement and execute.

Phase 13:
This phase is to build a feature which allows admin to record a topup amount per tutor. This is amount say 100$, that admin will set per tutor. The admin mostly pays the tutors in advance. If the total amount with the tutor (total paid - earned or owed amount) is less than the topup amount, then the admin will make another payment to the tutor to keep the balance above the topup amount. 

Build the data model to support it and also show this on the dashboards accordingly.

Phase 14:
This phase is about financial management. At the end of the year, the admin would have to generate tax documents for the tutor. We do not intend to record the SSN in this database. But I would like the database to be extended to confirm that admin has received the SSN from tutor. The field on tutors should indicate that. Other wise it should show up dashboard both for tutor and admin that tutor's SSN has not been shared and an action is needed. Ensure, no SSN is ever persisted in this database or portal.

Phase 15:
This phase is about cleaning the dashboard for admins and tutors. There are two major parts of this application. Finance and Tracking tutoring progress. I would like to evaluate creating these two tabs and see how we can made dashboard little more crisp and effective. Currently the cards are too big and waste a lot of white space.
In finance tab - I want a monthly run down of the current financial year, which will show how many sessions, how many hours, billed for that month, received in that month, Net in that month etc. I want to also have ability for admin to create 1099 year end for the tutor. This will open up a dialog to accept SSN on the UI. The SSN as agreed will not be persisted anywhere and 1099 will be created for that tutor. 
Other metrics will move into Tutoring progress tab and we will work on that in the next phase.

Phase 16: 
This math tutoring coursework is based on beast academy, level 1-5 and AOPS beyond level 5 - prealgebra, algebra and geometry. At the beginning of enrollment, the owner assesses the student based on what they are currently enrolled in and then recommends the level. Sometimes he will even recommned adding some topics from other levels - likely a lower one.
In this phase we will first start with addint the levels and topics from each level. Dig into Beast academy and AOPS and create a db model to store them and store them in the DB.
Then extend the sttudent data model to record the initial assessment. The intial assessment would be a long prose but I also want a way of recording say 1-5 levels against topics at a level. The assessor could pick say topic 10 from level 3 and mark as 1. Marking 1 on a topic means the studnet perform poorly or needs help. Recommend a good naming convention for levels.
Once the assessor records the assessment, then he will recommend the course of tutoring against the goal. For example - goal could be get ready for prealgebra by next academic year and then record what topics/levels need to be included, how often to schedule the sessions like twice a week 1 hour sessions. The data model clearly supports the goal. Now I want to extend the data model to retain the assessment, levels on each topic and tutoring session recommendation to achieve that goal.
When the tutor records the session, the tutor will record the assessment of the tutoring session against the recommended goal and track the progress.
The dashboard will include the timeline of the beginning of tutoring, the goal timeline and how each session is tracking towards the goal. Use some charting option to build a best and most intuitive UI.

Phase 17.
The amount recorded in the session should be curated based on the user. The parent/or student should see the amount they have to pay. The tutor should see the amount that is paid to the tutor. Admin should see the amount that parent/student is charged and also see the amount or cut for the institution.
Ensure the data model changes, if any are needed for this. Make the data/api/UI changes as needed and deploy them

Phase 18.
Do a detailed analysis of UI/api code and ensure the data that is shown to the logged in user (other than admin) is relevant and as expected so the issues like in Phase 17 do not slip through.

Phase 19:
I want to address another data visibility concern shared from the user feedback. In the sessions page, tutor is expected to use this during the tutoring session to refer to the previous session notes  and or notes for this session. Now it also shows money received by the tutor and paid by parents. The issue is one student can see get a view of the charges since tutor could be on that page infront of the student.  Just line dashboard for admin has finance and tutoring tab, create similar tabs in sessions page and on tutoring tab (selected by default) exclude all financial information

Phase 20: (planned -- do not build until asked)
Email session notes to the people who can already read them, and send calendar invites in addition to the calendar download.

Sending: use a transactional email provider (Resend or similar) called from the Worker over HTTPS, with its API key as a Worker secret. This keeps the portal on Cloudflare's free tier (Cloudflare's own Email Service needs Workers Paid and the domain's DNS moved to Cloudflare). The domain's DNS is at GoDaddy and its mail is Microsoft 365, so send from a subdomain such as notes@portal.trianglemathinstitute.com and add the provider's SPF/DKIM records for that subdomain only -- the root domain's SPF ("-all") and M365 records stay untouched. Replies go to the tutor or the office via Reply-To. Free tier is about 3,000 emails a month and 100 a day; check that against lessons per day.

Session notes by email:
- An "Email notes" button on a session for its tutor and admins, showing who will receive it before sending. Automatic sending when a lesson is recorded can come later as a setting.
- Recipients are the note's existing audience and no wider: the student's guardians, the student if they have an email, admins, and a copy to the tutor. Each person can opt out; the preference belongs to the person (users), not a profile.
- The email carries the date, length, notes and progress -- never an amount (the Phase 19 concern). The SSN guard on notes already applies.
- An audit event per send naming the recipients, never the note text. A small send log records delivered/failed so a failed send is visible and can be retried. Never log the body.

Calendar invites:
- When a schedule is created, email an invite to the tutor, the student and their guardians; when it is edited, an update; when it is removed, a cancellation.
- The .ics becomes an invitation (METHOD:REQUEST with ORGANIZER and ATTENDEE, METHOD:CANCEL on removal) with times in the institute's time zone (TZID plus VTIMEZONE) instead of floating times, keeping the existing stable UID. Store a per-schedule sequence number, bumped on every edit, so clients replace the event rather than duplicate it.
- Downloading the calendar file stays as it is.

Alternatives considered: Cloudflare Email Service (needs Workers Paid and a DNS move off GoDaddy), Gmail/Google Calendar APIs through an admin's one-time grant (sends from a personal Gmail, needs Google's sensitive-scope verification, and stops working if the token is revoked), and mailto / "Add to Google Calendar" links (no setup, but nothing is actually sent by the portal).

Phase 21: (built)
The dashboard still needs cleanup.
There is no point in showing admin card with number of admins.
Compress the card sized and align then completely. Create a section called analytics and add those cards. No need to mention "none in progress" in running sessions card. That messes up alignment.
Then section below that should Tutoring Sessions. Make this very aesthetic carousel. Combine the data from the schedules to create a card for upcming 5 sessions. There could be a right arrow indicator to pull the next 5 sessions. Combine the data from past 5 sessions and create cards on the left. The next upcming session card should have size and color indicator to highlight it as the most important.
The next section under should be "Progress".  This will show a random 5 user cards and will have "All Progress" that will take to the "Progress" to see progress of all students. That page will have filter for student or all students for a specific tutor etc. The card on the dashboard will have a compressed timeline graph that we show on the progresses page.
The lowest session will be the least important "Recent Activity". This will only show last 5 items in reverse chronological order

Phase 22:
As a tutor while recording session I would like the ability to save a rough draft of the Session Notes before posting them. In addition to Record Session and Cancel, give the user the ability to Save Draft. This session in draft will also be shown in sessions and tutor can edit it and then save. Upon save that session will be visible to other relevant users

Phase 23:
Session notes extensions.
The current scheme allows tutor to draft notes on the session and then later save it. Lets build an extensive session notes so eventually it can auto build summary.
The session capture should allow tracking - what was originally planned, previous session review, homework review from previous session, homework given in this session, optionally tutor, student, admin, parent can record an assessment of this session. Same as prior phase allow this to be in "draft" state - visuble only to the tutor and then saved state - visuble to all relevant parties

Phase 24:
Support overriding or canceling sessions. The current calendar scheduling is driven by the recurring schedule. Sometimes the scheduled sessions need to be canceled without affecting the entire scheduled series. Allow either a parent/tutor or admin to cancel a session within the series that could fall on a vacation day or so on. Allow the party cancelling the session within a series to record a note for cancellation. Allow a feature to cancel the cancellation so it starts showing up in the series of sessions. Cancelled session or future cancellations should show up in the progress tracker.

Phase 25:
This phase is about student interacting with session after the tutor entered it in the system.
Its should capture below. 
Did you learn anything new? 1-5
Difficulty level of the topic 1-5
Has the topic understnading improved in the session 1-5
How is the pace of learning 1-5
Homeowrk notes

Phase 26:
This is about building onboarding wizard or a walk through of feature set. The wizard will be auto launched on the first launch for a given user or first time app is launched on the browser (so use cookie as well as db state for wizard shown for a given logged in user.)
The wizard can also be launched from dashboard. 
The wizard wil have following functionality.
1. A walk through of the feature set. It will highlight relevant sections of the portal as it mentions what it does.
2. Allows adding a new student user type. The admin will first have to either create a parent/family account in this flow or select an existing parent account. After adding the user, the admin will be show ability to enter assessment and plan. The wizard can be skipped at any time and the admin can continue the workflow going through regular sections. 
3. Allow adding a new tutor type. The admin should be able to setup a new tutor in the system by creating a tutor user type. This will also be followed by relevant sections such as financials and avaiability and so on.
Admin will have access to do all of the above.
Other users will only be able to do step 1 and on the following pages confirm their own user attributes. Non admins cannot edit their details.

Phase 27:
I want to support multiple organizations. The current portal is built for the Triangle Math Institute. So every user is associated with this organization. I want to audit and analyze the current data model/services and portal UI to plan out supporting multiple organizations. This will be super admin users who have ability to add organizations and add users who are admins of that organization. From there on, the current feature set of portal will behave exactly as it is now. 
Each organization could have its onw logo / color scheme.
An user could be part of multiple organizations. In that case, user would be allowed to select an organization post login and can use the portal in the context of that organization. The user owuld be allowed to switch organizations.
This phase is a plan mode phase. The outcome of the phase is a detailed plan on how to extend the current portal.

Plan (2026-10-04): docs/multi-organization.md. Proposed build: protect the demo first, then Phases 28-31.

Phases 28-31 (built 2026-10-05, on the `orgsupport` branch only, deployed to `tutoring` and
`tutoring-test`; the institute's `tmi-portal` is untouched until the owner asks to migrate it):
28 organizations underneath -- every row and request in one organization; 29 people in several
organizations -- picker, switcher, invitations, shared-field lock; 30 the platform console --
organizations, their admins, palettes and logos, with `ndessai@gmail.com` the first platform
admin; 31 each organization's own clock.

Phase 32.
Each organization will have a flag to support email notifications. If this flag is true following actions will send email notifications:
1. When an user is added. Email is sent to user and to org admins.
2. When a plan or assessment is added to the user. Email sent to tutor/student.
3. When a schedule is added - email sent to student and tutor.
4. When a session is recorded - email sent to student and tutor.
All emails will include link to the tutoring portal.

Built 2026-10-07: `organizations.email_notifications` (switched by platform admins in the console
and by the organization's own admins on its Organization page), `lib/email.ts` and
`notification_log`. A student's emails also go to their parents; nobody is emailed about their
own action; an email carries no money, notes or scores (R15). Sent through Cloudflare's
`send_email` binding on the production pair -- on the free plan, verified destination addresses
only.
Phase 33.
Record preferred tutoring locations for tutors and students. A location has a friendly name, an
address and a physical/virtual type, and a reminder time: more than 0 means the app and the portal
remind about a lesson there that many minutes ahead (in-app now, a push notification later). Each
pairing can have one or many locations, chosen from the tutor's and the student's own. Each
schedule has locations from its pairing: at least one, and no more than one of each type.

Decided with the owner (2026-10-14):
- A schedule must have at least one location, and at most one physical and one virtual.
- Admins manage anyone's locations, a tutor their own, a parent their child's. A pairing's
  locations are set by admins (who manage pairings); a schedule's by admins and its tutor.
- The in-app reminder is a bottom sheet, on the portal's dashboard and the app's Home.
- Build and test locally, commit and push; no production deploy until the owner approves it.

Design:
- `locations` (owned by one person in one organization), `assignment_locations` (a pairing's
  allowed set) and `schedule_locations` (a schedule's, with `kind` copied so the database itself
  refuses two of one type: UNIQUE (schedule_id, kind)). The existing free-text
  `scheduled_sessions.location` stays as a note.
- A location is read by its owner, the owner's guardians, the organization's admins, and the
  audience of a pairing or schedule it is attached to (R16 in docs/data-exposure.md). Its address
  never goes into an audit description or a notification.
- A location in use by a schedule cannot be deleted or removed from its pairing; the schedule has
  to move first, so no schedule is ever left with none.
- Existing schedules (which have none) stay valid until edited; creating a schedule, or changing a
  schedule's locations, must meet the rule.

**Added 2026-10-14: an organization-wide Locations page.** At the owner's request, admins get a
Locations menu item (portal sidebar, app's More) listing every tutor's and student's places grouped
by person, with add (choosing the person first), edit and remove. Still one owner per location:
`GET /api/locations` without `user_id` returns the organization's list to admins and an empty list
to anybody else (R16). No schema change.

Phase 34.
Curricula, with Beast Academy alone: Phase A of the multi-curriculum plan
(`docs/curricula-plan.md`, approved by the owner). The catalog
can hold more than one curriculum, and each organization reads and writes only the ones on its own
list. Additive, and no visible change: every organization offers Beast Academy alone, as its default.

Built 2026-10-16:
- `curricula` and `organization_curricula` (one default per organization; a trigger keeps another
  organization's own curriculum off a list); `curriculum_id` and `code` on `curriculum_levels`,
  `code` on `curriculum_topics`. `program` stays, unread, until a second curriculum arrives.
- The catalog read and the id checks join the organization's list (`/api/curriculum` answers
  `code` and `curriculum_id`, no longer `program` or `stage`). Creating an organization inserts its
  default in the same batch. Posting a draft checks its topics before the lesson is created.
- The shared id shape widens to `/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/`, inside the SSN guard.
- The web app and the mobile app print `code`, take a topic's level from its row, and sort by the
  catalog's position (`indexCurriculum` in shared).
- No new route, mutation or audit action. Production SQL: `docs/database.md`, Phase 34.

Phase 35.
Part 2: North Carolina Math, the 2017 and 2026 editions, and an organization choosing which it
offers (a Curricula card on the Organization page). The plan's "Phase B".

Decided with the owner (2026-10-16), the plan's open points 1-5 as recommended:
- A 2026 topic is one state standard; its objectives go in the description.
- Courses: NC Math 1-4 and Precalculus (2017); Math 1, Math 2 and the three state electives (2026).
  AP is not part of it.
- Short topic names are drafted from the NCDPI documents and reviewed by the owner before the
  production release; the full official statements are stored only if NCDPI's terms allow,
  otherwise linked.
- Ids as planned (`nc-2017`, `nc-2026`, `NC17.3.OA.1`, `NC26.3.ANR.3`); people see the official code.
- `ALTER TABLE curriculum_levels DROP COLUMN program` on `tutoring-db` is approved: the first
  non-additive statement there, rehearsed on a copy of production and on the demo first, after the
  backup.

Built 2026-10-16 (551 NC topics: 2017 361 in 14 levels, 2026 190 in 14 levels; names await the
owner's review before the production release; the official statements are linked, not shown,
as NCDPI's terms grant non-commercial use only -- `docs/curricula/sources.md`):
- The catalog is generated: `apps/api/db/catalog/{ba,nc-2017,nc-2026}.json` ->
  `db/generate-catalog.mjs` -> `db/catalog.sql`, run after `schema.sql` by every build path and
  checked by `npm run typecheck`; it refuses a dropped id, a changed stage or number, a stage
  outside its thousand and a repeated code. Beast Academy's rows came out identical.
- `curriculum_levels.program` dropped (approved), `curriculum_topics.description` added; no
  statement column.
- `GET /api/curricula` (any member), `GET`/`PUT /api/organization/curricula` (admins; one batch;
  `curriculum.offering_updated`, no line when nothing changed). Retired, never deleted.
- Web and app: the Curricula card on the Organization page; pickers group topics by unit, show
  the description, hide a retired curriculum unless something chosen is in it, and offer a
  curriculum switch only with two or more; ties sort by catalog position; the plan's example goal
  no longer names AoPS.
- Seed: Riverside offers nc-2017 (default) and nc-2026, Beast Academy retired. Production SQL:
  `docs/database.md`, Phase 35.

The owner reviewed the NC topic names (`docs/curricula/nc-topic-names.md`) on 2026-10-16 and
approved them as drafted.

Later, unscheduled: the 2017-to-2026 crosswalk (the plan's "Phase C", needed by fall 2028) and an
organization's own curriculum ("Phase D").

Phase 36: (approved 2026-10-17: Claude as the provider, the free plan for now, grades 3-8 and
Math 1; "the goal here is to build a reliable question bank")
The AI layer (roadmap F11), and the question bank it writes. Plan: `docs/ai-platform-plan.md`.
One gateway, `runAi`, through which every model call passes: an allowlist of providers (Anthropic
and Workers AI through Cloudflare AI Gateway, and a fake for tests), consent refusal for anything a
child produced until F7 exists, redaction, the SSN guard on prompts and replies, cost caps, and a
log of runs that never holds content. Its first use writes maths questions for each NC 2026
standard, checked by a second independent solve, and approved one by one by a platform admin in
the console. No person's data goes through it in this phase. Each question passes code checks
(an exact computed answer among them), a blind solve by a second model, and a person's approval.

Built 2026-10-17 (`docs/ai-platform-plan.md`):
- `runAi` (`apps/api/src/lib/ai/run.ts`), the only way to a model, with `scripts/check-ai-gateway.mjs`
  in the typecheck; tasks in `AI_TASKS` (shared): `question_bank.draft` (Claude Sonnet 5.5) and
  `question_bank.check` (Claude Opus 5.5). Switches, daily and monthly caps per task plus a platform
  cap, consent refusal for `child_input` tasks, redaction, the SSN guard both ways, one retry, and
  `ai_runs` without content. Anthropic directly, or through AI Gateway when `AI_GATEWAY_URL` is set;
  the fake everywhere but production.
- The bank: `questions` and `question_bank_topics`; code checks (`lintQuestion`, exact
  `evaluateExact`, `checkAnswer`), the blind solve, approval only from `checked`, edits clearing it,
  retire and restore, "needs a figure" per standard. Console: Question bank (coverage against 6 per
  standard, a standard's questions, a keyboard review queue, writing for a whole grade) and AI.
- `db/questions/*.json` -> `db/questions.sql` (12 hand-written questions for 4.ANR.1-2, plus the
  first writing), loaded by every local and demo build; `npm run questions:export`.
- The first writing, 2026-10-17, without the API key: Claude Code ran the same pipeline (Sonnet
  writes, `lintQuestion`, Opus solves blind) over all 98 standards, 9 questions each; what passed
  is `checked` in the repository and in production's bank, waiting for a platform admin's review.
- The second writing, 2026-10-17/18, the same way: 90 more per standard, so the bank holds 9,700
  `checked` (98 to 105 per standard) plus the 12 approved fixtures (`docs/ai-platform-plan.md`).
- Not built: Workers AI as a provider (its local binding needs a Cloudflare login); a test of the
  consent refusal through a real task (no `child_input` task exists yet -- the first one adds it).
- Production SQL: `docs/database.md`, Phase 36. Writing questions needs `ANTHROPIC_API_KEY` set on
  both production Workers.

Phase 37: (planned -- awaiting the owner's approval; do not build until approved; needs Phase 36)
A free online maths assessment that brings in families (roadmap G1 with L4). Plan:
`docs/online-assessment-plan.md`. A public page per organization (off until its admins turn it on):
a parent starts it, the child answers an adaptive test (a staircase per strand, grades 3-8 and
Math 1 on NC 2026, about 25 questions, no AI during the test), and the family sees strand levels,
strengths and gaps at once. The organization gets a lead (New → Contacted → Consultation booked →
Enrolled / Lost) with the full result, and Enrol prefills the existing student form, then a draft
assessment where NC 2026 is offered. Open for the owner: decisions 1-6 in the plan, including no
emailed report until a sender exists, and counsel on the children's-privacy notice.

Phase 38: (requested 2026-10-18 by the owner, who asked for it to be built; local build first, release
after the owner approves)
The Assessment menu, in beta: answers written on a canvas, and a PDF for the tutor. Plan:
`docs/canvas-assessment-plan.md`. Each organization's admins switch it on (off by default). Anyone who
may follow a student's progress starts an assessment for them: up to 10 approved bank questions of a
grade, one page each, answered by hand on a canvas, with no feedback while working. Pages can be
revisited and edited, and the work can be submitted at any time. On submit, the Worker writes a PDF
(the questions, the handwriting as vector strokes, the answer and worked solution for the tutor),
stored in D1 for now (R2 later). Only the student's tutors and the admins open the PDF (R17); the
student's audience sees that it was submitted. Web and the app alike (parity, owner 2026-10-18).
The first, smaller step toward the think-aloud canvas (roadmap AI-13).

Added 2026-10-18 at the owner's request: feature parity on web and the app (now the default rule for
every phase), multiple-choice questions answered by choosing (with the canvas for working; code marks
the choice for the tutor), the PDF shown inside the portal and the app (pdf.js) rather than
downloaded, and an organization flag to try questions not yet reviewed (`canvas_assessments_unreviewed`,
off by default; the PDF marks them).

Released 2026-10-18 (commit 37bdad1; production backed up to
`~/tmi-portal-backups/tutoring-db-20261018-102402-pre-phase38.sql`, Phase 38 SQL applied, both Workers
deployed; both switches off in every organization until its admins turn them on):
- Shared `canvas-assessments.ts` (the stroke wire format, `parseStroke`, LaTeX to plain text, the
  limits); `organizations.canvas_assessments` and the admins' switch on the Organization page.
- API `routes/canvas-assessments.ts` (levels, list, start, detail, submit, discard, PDF), its
  repository, and `lib/pdf.ts`, a hand-written PDF writer (standard fonts, vector strokes, deflated
  pages) with `lib/canvas-assessment-pdf.ts` for the layout. Files in `canvas_assessment_files`.
- Web `features/canvas-assessments/` (the list and start card, taking it, the canvas); the menu item
  with its Beta badge. Seed: on in organization A, off in B.
- R17 in `docs/data-exposure.md`; production SQL in `docs/database.md`, Phase 38. Tests:
  `canvas-assessments.spec.ts` and the R17 crawl in `exposure.spec.ts`. The full local suite (228)
  and `npm run smoke -- mobile` (iOS and Android) passed.

Phase 39: (planned 2026-10-18; DELAYED by the owner on 2026-10-18, after Phase 40; needs the owner's
decisions on consent, plan section "The consent it needs")
A second PDF for the tutor, with an AI evaluation. Plan: `docs/canvas-assessment-plan.md`. A new task,
`canvas_assessment.evaluate` (Claude, `child_input`), reads a name-free PDF redrawn from the stored
strokes, with each question's key and worked solution; it returns a verdict per question, which code
overrides wherever the answer it read can be checked exactly. It is drawn into "Answers with AI
evaluation", which only the student's tutors and the admins read. Because the child's handwriting goes
to a model, it brings the smallest slice of F7: a `consents` table (an admin records a guardian's signed
form; a guardian can withdraw), checked by `runAi` for every `child_input` task.

Phase 40: (requested 2026-10-18; released 2026-10-18; web and the app)
The tutor reviews an assessment online, and organizations set how many questions one has. Plan:
`docs/canvas-assessment-plan.md`, "Phase 40". On a submitted assessment the student's tutor (or an
admin) opens a review screen showing the submitted PDF's pages and marks it up in place: a red pen over
any page, a note per question and an overall comment; no scoring for now (owner, 2026-10-18 -- a later
phase). A draft saves as they go; "Save as reviewed" writes a third PDF, the reviewed assessment (the
comment, then the submitted pages with the tutor's ink and notes; no answer key), marks the assessment
reviewed, and lets the student, their parents, their tutors and the admins all read it in the portal
and the app. Organizations' admins also set the number of questions an assessment draws (1-25, default
10).

Released 2026-10-18 (commit d6c4bd0; production backed up to
`~/tmi-portal-backups/tutoring-db-20261018-123036-pre-phase40.sql`, Phase 40 SQL applied, both Workers
deployed; every organization at 10 questions, the Assessment switch still off everywhere):
- Shared: `saveCanvasReviewSchema`, `REVIEW_PAGE`, `CanvasReview`; `canvas_assessment_questions` on
  the organization settings. API: the review routes (`GET`/`PUT .../review`, `.../review/finish`,
  `.../review/reopen`), `pdf?kind=reviewed`, and the reviewed PDF built by `buildAssessmentPdf`.
- Web: the review editor (`review-assessment-page.tsx`), the PDF page for both PDFs, the question
  count on the Organization page. App: the same screens and the question-count stepper.
- R17 extended in `docs/data-exposure.md`; production SQL in `docs/database.md`, Phase 40. Tests: the
  full local suite (231), the canvas-assessments flows (7) and `npm run smoke -- mobile` on iOS and
  Android, Jest 670.

Phase 41: (requested 2026-10-18 by the owner; generation paused the same night, 90 of 116 chapters written; offered in the Assessment menu on the owner's word, 2026-10-19; web and the app)
The question bank on Beast Academy's chapters. Plan: `docs/question-bank-beast-academy.md`. The bank
grows from the NC 2026 standards to every chapter of the catalog's Beast Academy curriculum: Levels 1-5
and the three AoPS books it carries (Prealgebra, Introduction to Algebra, Introduction to Geometry),
116 chapters, about 100 questions each (owner, 2026-10-18), written and checked the way the NC
writings were (Sonnet writers, `lintQuestion`, Opus solving blind) and loaded as `checked`, for a
platform admin to approve. The questions are original: written from our own summary of each chapter,
never from the books. The console (web and app) shows the new levels after the NC ones; the Assessment
menu keeps drawing on NC 2026 alone (`CANVAS_ASSESSMENT_LEVEL_IDS`) until the owner asks otherwise. No
schema change: a question's topic is already any catalog topic.

Where it stands (2026-10-19): 8,859 `checked` questions on 90 chapters (Beast Academy 1-5, Prealgebra,
Introduction to Algebra 1-13 and 16-17), 51 flagged and left out until a repair round. Not yet in the
bank: Algebra 14, 15 and 18-22 (14, 15, 18-21 written but not solved blind; 22 not written) and all of
Introduction to Geometry; generation stopped when the owner paused it and the account's usage limit was
reached. The owner then asked for what was built to be saved and offered for assessment: the Assessment
menu now offers every bank level, a Beast Academy one only to an organization whose curriculum list
includes Beast Academy (`assessmentLevelCurriculum`); its questions are `checked`, so they are drawn
only while the organization includes questions not yet reviewed, until a platform admin approves them.
The writing's workspace (briefs, tooling, drafts, the flagged questions) is kept in
`~/aimtrue-question-bank/qb3`.

Released 2026-10-19 (commit d68bcd9; production backed up to
`~/tmi-portal-backups/tutoring-db-20261019-061757-pre-phase41.sql`, the 8,859 `checked` questions
loaded as INSERTs, both Workers deployed). Every production organization offers Beast Academy, so each
sees its levels once its Assessment menu is on; the questions are drawn only while "include questions
not yet reviewed" is on, until they are approved in the console.

Completed 2026-10-22, with the rest of NC 2026 (owner: "continue generating for the standards or topics not
yet generated"): Algebra 14, 15 and 18-22 solved and kept, all 19 chapters of Introduction to Geometry
written, and NC 2026's Kindergarten, grades 1-2, Math 2 and its three fourth-year courses (92 standards)
added to the bank -- breadth first, then depth, so every topic had questions before any got more. The
bank's level list, labels and Quest's level order widen to match (web and the app). Plan and results:
`docs/question-bank-round-4.md`.

Phases 42, 44 and 45: (requested 2026-10-20 by the owner, `docs/gamification.md`; decisions settled the same
day; Phase 42 released 2026-10-20, web and the app; 44 and 45 not started -- renumbered from 43 and 44
when the owner put the tutor's Home first, 2026-10-20)
Gamification, starting with the question bank. Plan: `docs/gamification-plan.md`.
- **Phase 42 — Question Quest and points.** An organization flag; each student's beginning level; the
  student answers the bank's unapproved questions one at a time, full screen (no going back), marked by
  code; their tutor reviews each in a full-screen queue and confirms the question (approved into the
  bank) or flags it; points to both, kept in an append-only ledger; daily activity kept for streaks.
- **Phase 44 — Streaks, metrics and badges.**
- **Phase 45 — Rewards** (an organization's own rewards shelf, certificates, an opt-in leaderboard).

Phase 42 released 2026-10-20 (commit acfc8a2; production backed up to
`~/tmi-portal-backups/tutoring-db-20261020-210749-pre-phase42.sql`, the Phase 42 SQL applied, both
Workers deployed). Question Quest is off in every organization until its admins turn it on (Organization
page, Gamification). Owed: the phones carry an older app build until they are reinstalled; on iOS the
status bar still shows over Quest (needs `UIViewControllerBasedStatusBarAppearance` and a native
rebuild) and the screen may sleep (needs `expo-keep-awake` as the app's own dependency) -- the
owner's call.

Phase 43: (requested 2026-10-20 by the owner; decisions settled the same day; building, the app first by
the owner's word -- the web dashboard follows)
The tutor's Home: make it the screen a tutor opens before and after a lesson. Plan and mockups:
`docs/tutor-home-plan.md` (`docs/tutor-home/`). Recent Activity leaves everyone's Home (every role, web
and app; the Activity page stays). At the top of a tutor's Home, a "Now" card that changes with the
day: a lesson ended and not recorded -> "Yay, you completed one more lesson with Sofia", confetti, and
Record it now, which opens the record sheet filled in from the schedule; a lesson in the next 12 hours
-> a personal message about it, with Directions or the meeting link and Start; otherwise the next
lesson and anything waiting. Under it, for that lesson: the homework set last time, where it is (Open in
Google Maps, or the link), the next topic on the student's plan, and the assessment notes from the
previous lesson (hidden until tapped, since the student may see the screen). One new read route for the
tutor's own lessons; no schema change.

Phase 46: (requested 2026-10-21 by the owner; building, web and the app)
Quest Games: the question bank played together with a code. Plan: `docs/quest-games-plan.md`. Under
Quest, anyone signed in to the organization starts a game -- a level of the bank, a number of
questions or a time limit, negative marking on or off, a team size -- and anyone joins it with its
code, on their own or in a team with its own code. Every team plays the same series, drawn once at the
start from approved questions (and checked ones while the organization includes questions not yet
reviewed); a team's members are each served the next question no teammate has had. The most points
wins. One Durable Object per game holds the series and the queues in memory (the free plan's in-memory
state), so the next question reads nothing from D1; D1 keeps the game, the teams and the results.

Phase 47: (requested 2026-10-22 by the owner, "Phase G2" in `docs/gamification.md`; released 2026-10-22, web and the app)
Quest Games, round two. Plan: `docs/quest-games-g2-plan.md`. Starting a game becomes a five-step
wizard: level tiles (and Random, from a starting level upward), the length, the scoring (points for
right and for wrong on − / + counters, and Knockout), the players (single player, or multiplayer with
the most teams, everyone on their own or teams of a set size, and joining closed or open once it
starts), and a review that saves the settings as a named favorite. Multiplayer ends in "Generate game
code"; single player in "Start game". Teammates type the game's code, then their team's. "Start the
Quest" counts every screen down together (doors opening), a finished player waits on the status page,
a knockout game ends as soon as one team cannot be caught, winners get confetti and the others
encouragement. The Quest menu wears a Beta badge. Additive schema: settings columns on `quest_games`,
and `quest_game_favorites`. The test account's D1 was out of reads for the day, so the release goes to
production after the local suite, and the demo follows when its limit resets.

Phase 48: (requested 2026-10-22 by the owner, "Phase G3" in `docs/gamification.md`; the Worker only, both
clients unchanged) Quest Games, round three: a curated series. Plan: `docs/quest-games-g3-plan.md`. The
series is still drawn when the host starts the game, and now leaves out every question any of its players
has seen in this organization's games (`quest_game_seen`, written once at each game's end). When the
game's own level runs out of unseen questions, it climbs into the levels above it in the family, in order.
Only when the whole family is used up does it reuse seen questions, the least recently seen first. A
count game may ask for more than its level holds, counting the levels it can climb into. Additive schema:
`quest_game_seen`. Released like Phase 47, straight to production after the local suite. The demo
follows when the test account's limit resets.

Phases 49-52: (requested 2026-10-24 by the owner: stages O0 and O1 of `docs/roadmap/open-to-public.md`,
changed as below; plan approved and release requested 2026-10-24; built and released in order, web
and the app) Opening sign-in to anyone. Plan: `docs/open-signup-plan.md`. No Workers Paid for now (the
portal is not advertised). From now on an organization is called a **space** on screen; the code keeps
`organization`.

Phase 49: seeding for the newer features, and a backward-compatibility test. The demo and local builds
load a sample of the question bank (about 8 questions per topic, every level at least 50) instead of all
30,298, whose ~150,000 rows written exceed the demo's daily 100,000; a write budget refuses a demo reset
over 40,000. The seed gains Quest (levels, attempts, points, a review queue) and Quest Games history in
SQL, and assessments (submitted, reviewed, with their PDFs) and a live game through the API
(`seed:scenarios`), on top of the unchanged cast. `npm run test:compat` builds the last release's
database (a `release-*` tag), applies the pending SQL blocks from `docs/database.md`, checks it matches
today's `schema.sql`, and runs today's Worker on it (`@smoke`, `@compat`), the last release's Worker on
it (its own `@smoke`), and older clients' request shapes. It joins every release that changes the schema
or the API. No production change.

Phase 50: feature sets. The product is three sets, Tutoring, Assessment and Quest, which platform admins
allow per space (three columns on `organizations`, every existing one allowed all three). A set that is
not allowed is gone for every reader there: no menu item, no dashboard section, 403 `feature_unavailable`
on its routes (`requireFeature`), its data kept (R23). Assessment and Quest keep their own switches for
the space's admins; Tutoring has none. A space without Tutoring gets an Assessment home and no tutor
role. The console sets them (web and the app).

Phase 51: groundwork for open sign-in. A first sign-in no longer joins a self-serve space by itself
(`created_via`); an invitation shows the inviting space only what it typed until the person accepts, and
never locks their details (every space); Quest approvals from an untrusted space become suggestions for
the console (`quest_trusted`, `question_suggestions`); self-serve spaces get no email and no AI; rate
limits and daily caps on sign-in, invitations and the Phase 52 routes; public Terms and Privacy pages
(drafted, approved by the owner before Phase 52's release).

Phase 52: open sign-in and spaces. An unknown Google account is no longer refused: it gives its birth
month and year and accepts the terms (nothing is stored for an under-13), then is asked for a space
code. With one, it asks to join, and the space's admins let it in (choosing roles in the existing form)
or decline. Without one, an adult names a new space -- names may repeat -- and gets a unique space code
(`K7QM-9XDA`) to share; the space is allowed Assessment only, with approved questions, and its maker is
its admin, adding a student with the parent's consent recorded (`consents`, F7's first slice). Admins
copy, share, renew or switch off their code; members leave; a self-serve space's maker deletes it; a
person with no space left deletes their account. Older app builds keep today's answer until reinstalled.
New rule R21.

Added to the release by the owner, 2026-10-24:
- **The app shows its phase.** Small text on the app's sign-in screen and its Account screen says
  which phase the build includes ("Phase 52"), from one shared constant bumped by each phase. The
  app only, on the owner's word (recorded in `docs/mobile/parity.md`).
- **Two right answers approve a question.** Once two or more different people have answered a
  `checked` question correctly in Question Quest (marked by code, `checkAnswer`), the question becomes
  `approved` for every organization by itself (`approved_via = 'quest_consensus'`), with no review
  needed; a tutor's review still approves or flags it as before. Answers count only from trusted
  organizations (Phase 51's `quest_trusted`), so a self-serve space cannot approve the bank.

Phase 49 released 2026-10-24 (commit 2471d84, tag `release-20261024`; production backed up to
`~/tmi-portal-backups/tutoring-db-20261024-113725-pre-phase49.sql`, no schema change, both Workers
deployed; the demo reseeded within its new budget, 22,025 rows written, and seeded through the API).

Phase 50 released 2026-10-24 (tag `release-20261024-p50`): feature sets on the web and in the app; the
Phase 50 SQL applied to production after the backup; both Workers deployed. Every existing organization
keeps all three sets. The compatibility test now refuses to start when one of its ports is taken (an old
dev server on its port had stood in for "today's Worker" in Phase 49's run; the schema check and the old
Worker's run were sound).

Phases 51 and 52 released together 2026-10-24 (tags `release-20261024-p51` and `release-20261024-p52`;
production backed up first, both SQL blocks applied, both Workers deployed), web and the app. Sign-up
itself stays CLOSED in production (`SIGNUP_OPEN` "false" on the production pair): the owner approves
the terms and privacy wording first, then `SIGNUP_OPEN` goes "true" and `LEGAL_DRAFT` false. Until
then an unknown Google account is refused as before; existing members may make and join spaces with
codes, and everything else in both phases is live. Rate limits use a Durable Object per key (the
rate-limiting binding's free-plan availability is undocumented) and are twenty times looser away from
production. The app shows its phase ("Phase 52").

Phase 53: (requested 2026-10-25 by the owner, decisions the same day: email or Google id with wildcards, a script and direct SQL, a test-only automation key, the test app on the owner's devices too; building)
A test environment that behaves like production. Plan: `docs/test-environment-plan.md`. `tutoring-test`
turns Google sign-in on, with the same sign-in experience as production, and lets in only the people on
an `invited_users` list (an email or a Google login) -- a table that exists in the test database alone,
never in `schema.sql` or production. The app gains a test variant, "AimTrue-Test"
(`com.aimtrue.app.test`), production in every way but its server, which is `tutoring-test`. Local
development and the local suites keep sign-in off.

Phase 53 built 2026-10-25 (web suite 265 passed; mobile smoke 7/7 on iOS and Android): the test Worker
deployed with sign-in on and the invited list; production unchanged (it carries the code, switched off,
at its next release). Owed by the owner: the test origin on the Google web client, and an iOS OAuth
client for `com.aimtrue.app.test` before AimTrue-Test can sign in on a phone.

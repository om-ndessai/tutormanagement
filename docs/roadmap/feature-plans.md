# Feature plans

Part 1 of the enhancement roadmap (see [README.md](README.md)). An industry audit of what
comparable products do, and a plan for every feature worth considering. Nothing here is
scheduled: pick features by ID, and they become phases in [`docs/plan.md`](../plan.md).

---

## What the survey found

Research on 24 September 2026 covered three groups of products:
- **16 tutoring and learning-centre products.**
  - Business platforms: TutorBird, My Music Staff, Teachworks, TutorCruncher, Oases Online,
    Wise, Jackrabbit Class, TutorOcean.
  - Online classrooms: Pencil Spaces, Lessonspace.
  - Franchise systems: Mathnasium, Kumon, Russian School of Mathematics, Sylvan, Club Z,
    Varsity Tutors.
- **14 maths learning products.** Beast Academy Online, AoPS Alcumus and Academy, Khan Academy
  and Khanmigo, IXL, Math Academy, DeltaMath, Mathspace, Amplify/Desmos, Brilliant, Prodigy,
  Zearn, Thinkster and others.
- **The AI tutoring tools from Google, OpenAI, Anthropic and Snorkl.**

Sources are listed at the end of this document.

### How common each feature is among the eight business platforms

A feature seen on at least six of the eight vendors' own pages is **table stakes**, on three to
five **common**, and on fewer a **differentiator**. Counts are lower bounds: "not seen" means
not found, not absent.

| Feature | Seen in | Tier | This portal | Plan |
| --- | --- | --- | --- | --- |
| Recurring scheduling, family portal, tutor pay | 8 of 8 | table stakes | Has | — |
| Invoices and statements | 8 | table stakes | Ledger and balances only | B2 |
| Online card or bank payments | 8 | table stakes | No | B1 |
| Attendance on every scheduled lesson | 8 | table stakes | No: only lessons that happened exist | S1 |
| Email or text reminders | 7 | table stakes | No | S2 |
| Families book or cancel online | 6 | table stakes | No | S4 |
| Lead and enquiry capture | 6 | table stakes | No | G1 |
| Messages to many families at once | 6 | table stakes | Comments only | M2 |
| Lesson notes sent to families | 6 | table stakes | Visible in the portal; email planned (Phase 20) | L7, M3 |
| Video or whiteboard | 6 | table stakes | A pasted link | S7, V1, V2 |
| Autopay, card on file | 5 | common | No | B3 |
| Prepaid packages or family credit | 5 | common | No (the threshold exists for tutors only) | B4 |
| Progress reports and skill tracking | 5 | common | **Strong tracker**, no shareable report | L5 |
| Calendar feed or two-way sync | 4 | common | One-off `.ics` download | S6 |
| File and resource library | 4 | common | No | F2, L2 |
| Overdue reminders | 4 | common | No | B3 |
| Margin, retention and utilisation analytics | 4 | common | Monthly rundown and stat cards | A1 |
| Chargeable late cancellation, make-up credits | 3 | common | No | S1 |
| Homework or practice tracking | 3 | common | Free text in notes | L1 |
| Accounting sync (QuickBooks, Xero) | 2 | differentiator | CSV export | B7 |
| Policy acceptance, e-signature | 2 | differentiator | No | G3 |
| Branded native app | 2 | differentiator | Web only, like most | F5 |
| AI lesson summaries | 2, and spreading fast | differentiator | No | [AI-2](future-ai.md#ai-2--lesson-notes-assistant) |
| Surveys and reviews; tutor matching | 2 each | differentiator | No; availability stored but unused | G4, T3 |
| Assessment that produces a learning plan | 1, plus every franchise | differentiator | **Has** | — |
| 1099 generation; tutor advance threshold | 0 | — | **Has** | — |

### Where the portal already leads

- **Tax and advances.** No product reviewed generates 1099s or manages tutor advances against a
  threshold.
- **Assessment to plan to scores.** Only Oases and the franchise systems (Mathnasium, Sylvan,
  Kumon) tie an assessment to a curriculum-based plan and per-lesson scores. That is exactly
  what Phase 16 built.
- **Who sees what.** The written, crawled visibility rules (R1–R9, `docs/data-exposure.md`), and
  the split between price and pay, have no equivalent in the products reviewed.

### Where it is behind

Measured against the business platforms, almost every **table-stakes** feature above is
missing. The portal records lessons and money superbly, but does not yet *run* the week:
- reminders
- cancellations
- payments
- messages

Measured against the maths learning products, the gap is everything a student does *between*
lessons. The leading products measure and drive progress in ways the portal's 1–5 ratings
cannot yet:
- practice with instant feedback
- diagnostics
- review of mastered topics
- a projected finish date
- a regular parent roll-up

### The research on what helps students learn maths

| Technique | Evidence | Used by | Plans |
| --- | --- | --- | --- |
| Mastery learning | A meta-analysis of 108 controlled studies; the largest gains for weaker students | Khan Academy, AoPS, Mathnasium | Phase 16, L3 |
| Knowledge tracing and item-response models | Bayesian Knowledge Tracing; deep knowledge tracing; the Rasch model | Alcumus, IXL, Math Academy | L12, AI-4 |
| Spaced practice, worked examples, quizzing | The US Institute of Education Sciences practice guide, recommendations 1, 2 and 5 | Math Academy, Brilliant | L8, L3 |
| Interleaving | A grade-7 randomised trial in 54 classes, effect size d = 0.83 | Math Academy, spiral review | L3, AI-4 |
| Hint ladders | General hint → next step → worked example → answer; students tend to skip to the answer | Zearn, Mathspace | L3, AI-7 |
| Naming misconceptions | Each wrong answer mapped to a named misconception | Eedi, Snorkl | AI-6 |
| Homework with feedback | A randomised trial of 2,850 students (ASSISTments), g = 0.18 | DeltaMath, IXL | L1 |
| AI supporting the tutor | Human tutoring averages 0.37 SD. In the Tutor CoPilot trial, an AI assistant raised mastery 4 points, and 9 points for less experienced tutors. Evidence thins as the human is removed | — | [AI-12](future-ai.md#ai-12--pre-lesson-brief) |

The last row is the most important for this institute: **the strongest evidence is for AI
that makes the human tutor better, not for AI that replaces them.** The AI plans in
[future-ai.md](future-ai.md) are ordered accordingly.

### Local context

AoPS Academy runs a campus in **Morrisville, NC**. It teaches classes of 10–16 with Beast
Academy Online included in tuition, placement tests at entry, and weekly parent emails. It
is the closest like-for-like alternative for this institute's families.

Its features argue for making one-to-one attention *visible*:
- the pace chart and plan the portal already has
- reports (L5)
- digests (M3)
- homework feedback (L1)

Small groups (S9) could still be offered alongside one-to-one for price-sensitive families.

### What the business platforms cost, for comparison

| Platform | Price |
| --- | --- |
| TutorBird | $16.95 a month, plus $4.95 per extra tutor |
| Teachworks | $16.49 a month, plus $0.32 per student-lesson |
| TutorCruncher | $30–240 a month, plus card fees |
| Oases | $99–699 a month |
| Jackrabbit | from $49 a month |

These are the alternatives to building. They are not recommended: moving would lose this
portal's progress tracking, visibility rules and 1099s, and none of them does all of them.
The table is useful as a yardstick of what "table stakes" costs to rent.

---

## How each plan is written

Every feature has the same fields, so they can be compared side by side:

| Field | Meaning |
| --- | --- |
| **Why** | The problem, and the evidence from comparable products |
| **Build** | What the first version does: the smallest useful slice |
| **Later** | What can wait for a second pass |
| **Data** | New tables or columns. Production changes are additive only (`docs/database.md`) |
| **Screens / API** | Where it lives in the portal |
| **Guard rails** | The existing rules it touches: exposure R1–R9, the money-free Tutoring tab, audit events, the SSN guard, COPPA |
| **Needs** | Other features that must come first |
| **Cost** | Running cost beyond today's $0 |
| **Size** | **S**: under a phase. **M**: about one phase, like Phase 17. **L**: two or three phases. **XL**: a programme of several phases |

"A phase" means one build of the size of the phases in `docs/plan.md`, including tests and docs.

---

## 0. Foundations

These are not features anyone asks for by name, but most of the features below stand on them.
They are listed first because choosing any feature that needs one means building it too.

### F1 · Students who have no email can still take part

**Why.** Sign-in is Google-only and matches on email, and most students are children with no
address (`users.email` is nullable for exactly this reason). Today that is fine, because
students only read. Every student-facing feature below breaks without a way in:

- homework upload
- practice
- the whiteboard
- a diagnostic test

Industry practice is a class or family code, or student logins created under a parent's
account (Beast Academy Online and Khan Academy both work this way), or the parent's device
acting for the child. The maths-learning research flagged this as the constraint behind every
student-facing idea: *most students cannot sign in*.

**Build.**
- **Child mode on a guardian's session.** A guardian signs in as usual and picks "Continue as
  Sofia". The Worker issues a signed cookie that acts as the student, and records
  `acting_guardian_id` for the audit log.
- **In-lesson code.** At the start of a lesson the tutor shows a six-digit code or QR code.
  The student enters it on whatever device they are using, such as a family tablet or an
  institute laptop. That device is signed in as the student for this lesson only, and the
  code expires when the lesson stops.

**Later.** Per-student PIN on a family's shared tablet; a student Google account linked
when one exists.

**Data.** `student_access_grants` (student, issued by, kind `guardian`|`lesson_code`, expires
at, revoked at). The code is stored hashed, never plain.

**Screens / API.** `POST /api/auth/child` (guardian → child), `POST /api/auth/lesson-code`
(tutor issues), `POST /api/auth/lesson-code/redeem` (public, Turnstile-protected,
rate-limited). A "Switch to…" item in the user menu.

**Guard rails.**
- The child's view is the student's view: the crawl in `exposure.spec.ts` gets a persona for it.
- An audit event on every switch.
- No child session can reach Finance. Students who sign in today see their own price,
  balance and payments; a child session should see no money at all.

**Needs.** F7: a child account is collecting data online from a child, so a guardian's
verifiable consent comes first. **Cost.** $0. **Size.** M.

### F2 · Files: uploads and downloads

**Why.** The portal stores no files. Homework photos, worksheets, report cards and signed
policies all need storage. Four of the eight business platforms surveyed have a file or
resource library (TutorBird and My Music Staff share homework files; Lessonspace has a resource
library), and Canvas's Files tool is central to it.

**Build.**
- **Storage.** A private Cloudflare R2 bucket bound to the Worker.
- **Uploads.** The browser asks the API for a short-lived upload URL, then sends the file
  straight to R2 with it. Files never pass through the Worker, so its 10 ms CPU budget and
  memory are untouched.
- **Downloads.** Each download is authorised through the same scoping as the record the file
  hangs off (a session, a homework, a person), so a file is never readable by more people
  than its parent record.
- **Limits.** Images and PDFs only, up to 20 MB each.
- **Never tax forms.** A scanned W-9 carries an SSN, and the SSN guard can only check text.
  The upload screen says tax forms are never uploaded, and T1 records only the date a form was
  received.

**Later.**
- Image downscaling in the browser before upload.
- Deletion on the retention schedule (A3), e.g. homework photos after 12 months.
- Virus scanning through a third-party API.

**Data.** `files` with these columns:
- `id`, `r2_key`, `owner_user_id`
- one target column per kind of thing it hangs off, the same pattern as `comments`
- `content_type`, `bytes`, `sha256`, `created_at`, `deleted_at`

**Screens / API.** `POST /api/files/upload-url`, `GET /api/files/:id` (a redirect to a
signed URL). A reusable `<FileDrop>` component.

**Guard rails.** R7 and R9 extend to files (404 for a file whose parent the reader cannot see),
and `exposure.spec.ts` fetches every file by id as every persona. An audit event is recorded
for an upload and a delete, but never for a download.

**Needs.** None. Turning R2 on asks for a card on file, even for the free tier. **Cost.** R2's
free tier (10 GB, 1 M writes and 10 M reads a month, no egress
fees) covers years of homework photos at this size. **Size.** M.

### F3 · Notification centre

**Why.** Phase 20 plans email for session notes and calendar invites. Every later feature needs
to tell somebody something:

- homework is due
- a payment was received
- a lesson moved
- a report is ready

Each feature would otherwise reinvent sending, opt-outs and logging.

**Build.**
- **One function.** A single `notify(recipients, kind, payload)` in the Worker with a
  per-person preferences table (email on/off per kind).
- **In-app inbox.** A bell icon listing the last 30 notifications.
- **Email.** Through the Phase 20 provider.
- **Send log.** The log from Phase 20 generalised to every kind of notification.

**Later.**
- Web push (F5).
- SMS through Twilio (needs 10DLC registration; see [future-ai.md](future-ai.md#compliance-notes)).
- A daily digest mode instead of one email per event.

**Data.** `notifications` (recipient, kind, payload JSON, created, read_at),
`notification_preferences` (user, kind, channel, enabled), `deliveries` (notification,
channel, status, provider id, error).

**Guard rails.**
- A notification's payload is built by the same scoped read as its screen. A notification is a
  read, and the exposure crawl covers `GET /api/notifications`.
- Never an amount on a Tutoring-kind notification (the Phase 19 rule).

**Needs.** Phase 20's email provider. **Cost.** The email provider's free tier (about 3,000 a
month). **Size.** M.

### F4 · Background jobs

**Why.** Today the only scheduled work is the 15-minute cron that stops forgotten timers. Many
features need work to happen later or in bulk:

- reminders
- monthly statements
- digests
- AI grading
- retries of failed emails

The free Workers plan allows 10 ms of CPU per request and per cron run.

**Build.**
- **Queue table.** A `jobs` table (kind, run_at, payload, attempts, last_error, done_at)
  drained by the existing cron. Each run takes a few jobs, as many as fit the budget.
- **Idempotency.** Every job has a key, so a retry never sends two reminders.

**Later.** Move to Cloudflare Queues or Workflows. Both are now on the free plan: Queues has
10,000 operations a day, about 3,300 messages; Workflows has 3,000 steps a day. They give
retries and fan-out without the table, but each step still gets 10 ms of CPU on the free
plan.

**Data.** `jobs`. **Needs.** None. **Cost.** $0. **Size.** S–M.

> **A recurring decision: stay on the free plan, or pay $5/month?** Most features below fit
> the free plan. Workers Paid ($5/month, with generous included usage) is needed for:
>
> - CPU beyond 10 ms per request (30 s by default, up to 5 minutes)
> - Cloudflare's own email sending to any address
> - Containers
> - AI models Cloudflare now reserves for paid accounts
> - a D1 database over 500 MB
>
> It also turns every free daily cap into billed overage. That last point may matter most:
> on the free plan a busy day makes calls **fail until midnight UTC**.
>
> The recommendation is to adopt it the first time a chosen feature needs it, rather than
> engineer around a limit. Each plan says when that point is reached, and
> [future-ai.md](future-ai.md#running-it-on-cloudflare) has the full table.

### F5 · Installable app and push notifications

**Why.**
- **Phones are where parents read.** Most business platforms surveyed are actually web-only
  (TutorBird, My Music Staff). Wise and Jackrabbit ship branded native apps as a premium
  feature, and Canvas ships three apps (Student, Teacher, Parent). Parents and tutors mostly
  read schedules and notes on phones either way.
- **Web push works on iPhones.** Since iOS 16.4, a web app added to the home screen can
  receive push notifications. An installable web app gets most of what a native app gives,
  without app-store accounts, reviews or two more codebases.

**Build.**
- **Installable.** A web app manifest, icons, and a service worker that caches the app shell.
  The app opens instantly and shows the last-loaded schedule offline.
- **Push.** Web Push, with VAPID keys stored as Worker secrets and one subscription per device
  kept in `push_subscriptions`.
- **A new channel.** Push is added as a channel to F3.

**Later.** Offline capture of session notes, synced when back online; badge counts.

**Needs.** F3. **Cost.** $0 (push delivery is free). **Size.** M.

### F6 · Maths in text: rendering and input

**Why.** This is a maths institute, yet every note, comment, assessment write-up and plan is
plain text. Canvas, Desmos, DeltaMath and every maths platform in the survey render
LaTeX-style maths and offer an equation editor.

**Build.**
- **Rendering.** KaTeX for `$…$` and `$$…$$` in notes, comments, assessment summaries and plans.
  It is a small bundle and renders in the browser.
- **Input.** A "∑" button in text areas that opens MathLive, a visual equation editor that
  produces LaTeX.

**Later.** Maths in emails, rendered as images or MathML.

**Guard rails.** Rendered maths is sanitised. KaTeX's `trust` option stays off, so a note can
never smuggle HTML or links into another person's screen.

**Needs.** None. **Cost.** $0. **Size.** S.

### F7 · Consent and privacy centre

**Why.** Most students are under 13. The FTC's amended COPPA Rule took effect on 23 June 2025.
Its **compliance deadline, 22 April 2026, has passed**. What it asks of this institute depends
on whether data is collected online *from* a child:
- **What doesn't trigger it.** Adults typing notes about children who never sign in is low
  risk. That is the portal today.
- **What does trigger it.** Every student-facing feature brings COPPA in fully:
  - homework photos
  - the whiteboard
  - voice
  - video
  - a child signing in (F1)
- **What it then requires:**
  - **Parental consent.** Verifiable parental consent before collecting from a child. A
    parent's card payment through Stripe now counts as a verification method.
  - **Separate consent for third parties.** A *separate* consent before a child's data is
    disclosed to a third party, unless the disclosure is integral to the service. The FTC
    says training or developing AI is never integral.
  - **Retention policy.** A written retention policy, published in the notice, that states
    purposes and deletion timeframes. Keeping data indefinitely is prohibited.
  - **Security programme.** A written information-security programme, with a named
    coordinator, an annual risk assessment and written assurances from service providers.
  - **A notice to parents.** It names the third parties, or their categories.
- **Vendors.** A vendor that processes data only on the institute's behalf counts as part of
  the institute's own collection; it still needs written security assurances and a mention in
  the notice. A vendor that keeps or trains on the data is a third party, needing separate
  consent.
- **Worth confirming with counsel** before any child-facing AI feature. This is not legal
  advice.

**Build.**
- **Consent records.** A `consents` table (guardian, student, purpose, version, given_at,
  withdrawn_at, method). Purposes include:
  - `child_account`: F1
  - `photo_upload`: L1, AI-1
  - `ai_processing`, which names the provider category
  - `voice`
  - `video_recording`
  - `email_contact`
- **Consent screen.** A page on the parent's profile listing each purpose in plain language,
  with on/off.
- **Enforced by the API.** Each feature checks consent in the API before acting, for example
  the upload-for-AI-grading route refuses without `ai_processing`.
- **Published pages.** The direct notice to parents, the retention policy, and the security
  programme summary.
- **Age check.** When a student account is enabled, their date of birth is stored, so the
  rules apply exactly to those under 13.

**Later.** Data export ("download everything about my child") and verified deletion
requests (A3).

**Needs.** None. **Cost.** $0. **Size.** M. **Must come before:**
- F1
- any upload by a student
- every feature that sends a child's own work (a photo, handwriting, voice, typed answers)
  to an outside provider, as listed in [future-ai.md](future-ai.md)
- V1–V3 and M4

### F8 · Self-service profile editing

**Why.** Only admins may change a user today (`requireAdmin`). A parent who moves house, or a
tutor whose free hours change, has to ask the office. Every platform surveyed lets families and
tutors keep their own details current.

**Build.**
- **Parents** can edit their own phone, email and payment handles, and their children's
  school, current course and availability.
- **Tutors** can edit their own availability, availability notes, education and area.
- **Office stays in control.** Each field is on an allowlist per role. The office can
  require approval for chosen fields, and a change waits in a queue until approved.
- **Kept with the office.** Rates, roles, status, charge rates, top-up level and SSN receipt.

**Data.** `profile_change_requests` (user, field, old, new, requested_by, decided_by, status).

**Guard rails.**
- **Audit.** Every change is audited, naming who changed what.
- **The existing API rules stay.** The Worker still owns the "who may have no email" and
  "a student must have a guardian" rules, and self-service goes through the same shared
  schemas.
- **Rates, roles and money stay admin-only.** `requireAdmin` remains on every route that
  changes them.

**Needs.** None. **Cost.** $0. **Size.** M.

### F9 · Institute settings

**Why.** Policies are hard-coded or live in people's heads:

- the default session limit
- the cancellation notice period
- holidays
- the email sender name
- which features are switched on

Several features below need a place to keep them.

**Build.**
- **Where it's stored.** A key-value `settings` table, with each key's value validated by a
  Zod schema in `packages/shared`.
- **Where it's edited.** An admin "Institute settings" page, grouped by topic.

**Later.** Per-location settings (A6).

**Needs.** None. **Cost.** $0. **Size.** S.

### F10 · Backups, monitoring and hardening

**Why.** Production has held real family records since 2026-09-21, and backups have been
taken by hand before schema changes. D1's Time Travel restores to a point in the recent past
(30 days on the paid plan, 7 days on free), but that restores the whole database, not one
family's record.

**Build.**
- **Backups.** A scheduled CI job (a GitHub Action, holding a Cloudflare API token limited to
  D1 and R2 as a secret) runs `wrangler d1 export` weekly into a private R2 bucket, and keeps
  12 weeks. The export holds real family data, so the bucket is its own, never public, and
  never the one homework photos live in.
- **Health alert.** A health check pings `/api/health` and emails the admin if it fails.
- **Rate limit.** A rate-limit rule on `/api/auth/*`.
- **Dependency updates.** Weekly pull requests from Renovate or Dependabot.
- **Content Security Policy.** Tightened, since `secureHeaders` is already on.

**Later.**
- Error tracking (Sentry has a free tier).
- An admin "security" page listing recent sign-ins and sign-in denials, which the audit log
  already records.

**Needs.** None: an R2 bucket is created for it alone. **Cost.** $0 (a few MB a week against
R2's free 10 GB). **Size.** S.

### F11 · AI platform layer

**Why.** Every AI feature needs the same controls. Building them once keeps each AI feature
small and keeps children's data under one policy:

- which provider is used
- what may be sent to it
- consent (F7)
- redaction
- cost caps
- logging without contents
- human review

**Build.**
- **One gateway.** A single `ai.run(task, input, { student })` in the Worker, through
  Cloudflare AI Gateway (free) for caching, rate limits and per-provider cost logs.
- **Before anything is sent.**
  - It checks consent (F7).
  - It strips names, emails and phone numbers from text, replacing them with tokens.
  - It applies the SSN guard to prompts too.
- **Where results go.** They are stored as drafts that a tutor accepts, never shown straight to
  a family in the first version.

**Details.** See [future-ai.md § AI governance](future-ai.md#ai-governance).

**Needs.** F4. F7 must exist before anything a child produced (a photo, handwriting, voice)
flows through it; tutor-written records can go first. **Cost.** Per provider; see future-ai.md.
**Size.** M.

### F12 · More ways to sign in

**Why.**
- **Google only.** Sign-in is Google-only, so a parent whose address is at iCloud, Outlook or
  Yahoo must first create a Google account for that address. For some families that is the
  single biggest barrier to using the portal at all.
- **What others offer.** Canvas supports many sign-in providers, and the tutoring platforms in
  the survey offer email and password or a magic link.

**Build.**
- **Emailed sign-in link.** A one-time link to the address already on the person's record.
  It is valid for 15 minutes, single use and stored hashed, and it arrives through the
  Phase 20 email provider.
- **What stays the same.**
  - It matches on the stored email, exactly as Google sign-in does, so the rule "admins create
    people, sign-in only finds them" is unchanged.
  - `verifyGoogleIdToken` stays the only way a *Google* identity becomes a user.
  - The link is a second, separately audited door.

**Later.** Sign in with Apple and with Microsoft, each through its own verified ID-token
check.

**Data.** `sign_in_links` (user, token hash, expires_at, used_at, ip).

**Guard rails.**
- **Rate limits.** Per address and per IP, and each request is Turnstile-checked.
- **No account enumeration.** "If that address is on file, a link is on its way" is shown
  whether or not it is.
- **Audit.** Every link sent and used is audited.

**Needs.** Phase 20's email provider. **Cost.** $0. **Size.** S.

---

## 1. Scheduling and attendance

Today a standing weekly slot is stored (`scheduled_sessions`). Upcoming lessons are *derived*
from it (`expandUpcoming`), and a lesson exists once somebody records it. What is missing is
everything that happens *between* the plan and the record: a lesson that is cancelled, moved,
missed or made up.

### S1 · Cancellations, reschedules, make-ups and attendance

**Why.** Attendance on every *scheduled* lesson is table stakes: all eight business platforms
surveyed have it. TutorCruncher, TutorBird and Jackrabbit apply a cancellation policy
("cancelled but chargeable", in TutorCruncher's words) that decides whether a missed lesson
is:

- charged
- credited
- turned into a make-up

A policy can equally be *no make-ups*: the Russian School of Mathematics offers a few free
homework-help sessions a semester instead. The settings (F9) decide which applies here.

Today a cancelled Tuesday simply never gets recorded. Nobody can tell it apart from a lesson
somebody forgot to record, and "sessions held vs planned" on the progress page counts it as
missed.

**Build.**
- **A decision for each dated occurrence.** `expandUpcoming` already dates every occurrence.
  The office, the tutor or a guardian can mark one of them:
  - cancelled by the family
  - cancelled by the institute
  - moved to another date and time
  - no-show
- **The policy decides the consequence.** A notice period, stored in F9, decides whether a
  cancellation is charged at the family's rate, credited as a make-up, or free.
- **Make-up credits.** A make-up credit is spent when a lesson is recorded against it.
- **Attendance rate.** The rate per student and per tutor appears on Analytics.

**Later.**
- A make-up expiry date.
- A limit on free cancellations per term.
- A no-show charge that pays the tutor too, per the institute's policy.

**Data.**
- `schedule_exceptions`: schedule, `occurs_on`, kind, `moved_to_on` and `moved_to_time`,
  reason, `decided_by`, `created_at`.
- `makeup_credits`: student, earned from exception, spent on session, `expires_on`.

**Screens / API.**
- An occurrence menu on the dashboard carousel and on the Schedule page: Cancel, Move,
  Mark no-show.
- `POST /api/schedules/:id/exceptions`.
- `expandUpcoming` skips cancelled occurrences and shows moved ones at their new time.

**Guard rails.**
- A charged cancellation is a money row and shows only on Finance (the Phase 19 rule).
- An audit event is recorded for every exception.
- Guardians may cancel only their own children's lessons, and only before the notice period.

**Needs.** F9, for the policy. **Cost.** $0. **Size.** M.

### S2 · Lesson reminders

**Why.** Seven of the eight business platforms send automated reminders (TutorBird even
includes texts in its flat price, and puts the meeting link in each one). They are the single
cheapest way to cut no-shows.

**Build.**
- **Email reminders.** Sent the day before, to the tutor, the student if they have an email,
  and the guardians.
- **What it carries.** The time, the location or meeting link, and a one-tap "Can't make it"
  link that opens the S1 cancel flow.
- **How it runs.** A daily job (F4) walks `expandUpcoming` for tomorrow.

**Later.**
- Web push (F5).
- SMS (needs 10DLC registration and consent).
- Tutor reminders to record lessons not yet recorded by the evening.

**Guard rails.**
- Recipients are the lesson's tutor, the student if they have an email, and the student's
  guardians. These are the people who can read the lesson, apart from admins.
- No money in the reminder.
- A person's opt-out, held in F3, is respected.

**Needs.** F3, F4, and S1 for the cancel link. **Cost.** Within the email free tier (roughly
two reminders a lesson). **Size.** S.

### S3 · Scheduling assistant

**Why.** The portal already holds every person's free hours (`availability_slots`, hour by
hour, for tutors and students alike). It is shown and edited on each person's record, but
nothing uses it for scheduling. Matching availability is how
Teachworks and TutorCruncher help an office place a new student. It is the feature
`docs/data-model.md` said the hour blocks were designed for.

**Build.**
- **Where it appears.** In the schedule dialog.
- **Suggestions.** For the chosen tutor and student, it lists the weekly slots where both are
  free.
- **Hidden slots.** Slots where the tutor is already booked, or where either is outside
  their stated hours, are left out.
- **Conflict warning.** It warns about any clash before saving: the tutor double-booked, the
  student double-booked, or the room taken (S8).

**Later.**
- **Which tutor?** "Which tutor could take this student on Tuesdays?" That feeds T3
  matching.
- **Group classes.** Suggestions for small groups (S9).

**Data.** None: it reads `availability_slots`, `scheduled_sessions` and `schedule_exceptions`.

**Guard rails.** Suggestions are offered only to people who may create schedules: admins,
and a tutor for their own students. The suggestion list shows times, never why another
person is busy.

**Needs.** None. **Cost.** $0. **Size.** S.

### S4 · Family requests: change, cancel, extra lesson

**Why.** Only the office, or the lesson's own tutor, can change a schedule today, so every
family request becomes a phone call or a text. Six of the eight business platforms let families book or cancel
online: Jackrabbit's parent portal books make-ups and reports future absences, and Teachworks
lets families cancel within policy. Mathnasium's new myMathnasium app (September 2026) does
scheduling at some centres.

**Build.** A guardian can ask to:
- move one lesson
- change the standing slot
- book an extra lesson
- cancel inside the notice period

An on-time cancellation needs no request: the guardian simply cancels, under S1.

Each request goes to the office, and to the tutor for a move. Approving it applies the S1
exception or edits the schedule. Every request, and its answer, is notified (F3).

**Data.** `schedule_requests` (requester, schedule or occurrence, kind, proposed time, status,
decided_by, note).

**Guard rails.**
- A guardian can request only for their own children.
- Approval stays with the office or the tutor, never the family.
- An audit event is recorded for the request and its decision.

**Needs.** S1, F3. **Cost.** $0. **Size.** M.

### S5 · Closures and holidays

**Why.** The weekly schedule assumes every week happens. Two examples of weeks that don't:
- Thanksgiving: `expandUpcoming` would still offer the Thursday lesson.
- Spring break: reminders (S2) would go out for lessons that aren't happening.

**Build.** An institute calendar of closure dates, held in F9. Each closure removes that day's
occurrences, tagged as institute closures so they are neither charged nor counted as missed.

**Later.** Closures that apply to one tutor only, such as holidays or leave. That becomes T2.

**Needs.** S1, which provides the exception mechanism. **Cost.** $0. **Size.** S.

### S6 · Calendar subscription feeds, then two-way sync

**Why.**
- **What exists now.** Today's `.ics` is a one-off download: a moved lesson never updates in
  anyone's phone calendar.
- **What Phase 20 adds.** Emailed invitations fix that for the schedule itself, but not for
  single-date changes.
- **The standard fix.** Canvas gives every user a private calendar feed URL, and Teachworks
  offers iCal feeds and, since 2025, two-way Google sync; Wise has two-way sync too. Phone
  calendars poll a feed URL and stay current by themselves.

**Build.**
- **The feed.** A secret, revocable feed URL per person, such as
  `/api/calendar/<token>.ics`. It carries that person's upcoming lessons, with moves and
  cancellations (S1) applied.
- **Why under `/api`.** The feed must sit under `/api`, because only `/api/*` reaches the
  Worker (`run_worker_first`); anything else is served the app.
- **A deliberate public route.** Like the payment webhook (B1) and the enquiry form (G1), it
  is added to `publicRoutes` on purpose. The token is its authentication.
- **Why a token.** Calendar apps cannot send the session cookie. The token is scoped to
  exactly what `GET /api/schedules/upcoming` would show that person.

**Later.** Two-way Google Calendar sync for tutors, which needs Google's sensitive-scope
verification. It blocks booking lessons when a tutor is busy in their own calendar.

**Data.** `calendar_feed_tokens` (user, token hash, created, revoked_at).

**Guard rails.**
- The feed is a read endpoint, so the exposure crawl fetches every persona's feed.
- The token is stored hashed.
- A leaked token is revoked from the profile page.

**Needs.** S1, to make the feed worth having. **Cost.** $0. **Size.** S.

### S7 · Meeting links for virtual lessons

**Why.** Virtual lessons already exist (`mode = 'virtual'`), and a schedule has a free-text
`location` where people paste a Google Meet or Zoom link. Links go stale and aren't clickable
in a reminder.

**Build.**
- **Structured link.** A structured `meeting_url` on a schedule, validated as a URL on an
  allowlist of meeting hosts.
- **Where it's shown.** On the carousel, in reminders (S2) and in the calendar feed (S6).
- **Join button.** A "Join" button appears 10 minutes before the lesson.

**Later.** V1 (the portal's own lesson room) replaces pasted links.

**Needs.** None. **Cost.** $0. **Size.** S.

### S8 · Rooms and resources

**Why.** An in-person institute has a limited number of rooms. The seed already writes
"Institute, room 2" into free-text locations, and a comment in the seed notes a double
booking. Jackrabbit and Teachworks treat rooms as bookable resources.

**Build.**
- **Rooms.** A `rooms` list, chosen on a schedule.
- **Clash check.** The assistant (S3) refuses a clash.
- **Room view.** The Schedule page gets a per-room view.

**Needs.** S3. **Cost.** $0. **Size.** S.

### S9 · Group classes, camps and competition circles

**Why.** Every lesson today is one tutor with one student. Institutes like this one grow
through group products: small-group BA levels, summer camps, and MATHCOUNTS or AMC circles.
Jackrabbit, Wise and Canvas are built around classes with rosters, and this is also the basis
for Canvas parity ([canvas-gap-analysis.md](canvas-gap-analysis.md)).

**Build.**
- **Classes.** A `classes` entity has a name, a level, tutors, a schedule, a capacity and a
  price per student per lesson.
- **One lesson, several students.** A class lesson records one session with several
  students.
- **Billing.** Each student's family is charged its own row.
- **Progress.** Scores are recorded per student.

**Later.**
- Registration and a waitlist (G1), and paying online at sign-up (B1).
- Class announcements (M2).

**Data.**
- `classes`, `class_tutors`, `class_enrollments`.
- A change in how a lesson is billed, and this is the hard part. A `sessions` row is one
  tutor with one student today. Group lessons need either:
  - one row per student (simplest: the billing rules keep working, and the rows share a
    `class_session_id`), or
  - a `session_attendees` table.
- The first option keeps R1–R3 and every total unchanged, and is recommended.

**Guard rails.**
- A class roster is visible to its tutors and admins, and to each family only for their own
  child. One family never sees another family's child in a group.
- This must be added to the R7 crawl.

**Needs.** S1 (attendance per student). **Cost.** $0. **Size.** L.

---

## 2. Billing and payments

**Where the portal is today.**
- **Money is a ledger.** Lessons create charges and tutor pay. Payments are typed in by the
  office after the money has moved by Zelle, Venmo, cash or check.
- **Balances are derived.** Balances and 1099s come from that ledger.

**What the survey found.** Every business-management product surveyed goes further in one
direction: **money moves inside the product**.
- **Invoices.** They are generated and sent.
- **Online payment.** Families pay by card or bank transfer online.
- **Recording.** Payments record themselves.
- **Autopay.** Autopay removes chasing altogether.

**A constraint for every plan here.** `payments.method` is limited by a database CHECK to
`zelle`, `venmo`, `cash` and `check`. Recording `card` or `ach` means rebuilding that one
table in production. That is safe, because nothing references `payments`, unlike `users`
(`docs/database.md`). But it is a deliberate step: an export first, then the rebuild dance
rehearsed on a copy.

### B1 · Online payments (card and bank transfer)

**A decision first.** Phase 5 set the rule that "no actual payments will be made through the
portal": it only keeps track. This feature reverses that deliberately, and should be chosen as
a change of policy, not as a small addition.

**Why.** All eight business platforms surveyed take online payments, usually through Stripe
(TutorBird also offers PayPal; Wise takes no cut of payments). Typing Zelle payments in by
hand is the office's largest recurring chore, and the source of every "did you get my payment?"
message. The trade is about 3% in card fees against the time spent reconciling.

**Build.**
- **"Pay now" button.** On the parent's Finance tab, beside a balance. It opens a hosted
  Stripe Checkout page for card, Apple Pay or Google Pay, or US bank account (ACH).
- **The ledger records itself.** Stripe's webhook, verified in the Worker with Web Crypto,
  writes the `from_parent` payment row. Method is `card` or `ach`, with the Stripe payment id
  as its reference, and the balance updates by itself.
- **Card data never touches the portal.** The PCI scope stays at the lightest level (SAQ A).

**Later.**
- Saved payment methods and autopay (B3).
- Passing the card fee on to the family as a surcharge. This is allowed in NC with rules.
- Refunds from the portal (B9).

**Data.**
- `payments.method` gains `card` and `ach`, which needs the table rebuild above.
- `stripe_events` for idempotency, holding event ids already processed.

**Guard rails.**
- The webhook is a deliberate addition to `publicRoutes`. It is signature-checked and idempotent, and it
  writes an audit event with no amount (R8).
- Money shows only on Finance.
- The Stripe secret is a Worker secret.

**Needs.** None. **Cost.**
- **Stripe fees.** Cards are 2.9% + 30¢; ACH is 0.8%, capped at $5.
- **Absorbing ACH.** At $80 a lesson that is 64¢ a lesson, which the institute could absorb to
  steer families to ACH.
- **Cloudflare.** Nothing on the Cloudflare side.

**Size.** M.

### B2 · Monthly statements and invoices

**Why.** Families see a running balance but never a statement, and receive nothing. All eight
business platforms issue invoices or statements; automatic invoicing is a headline feature of
Teachworks and My Music Staff, and Oases produces them in bulk.

**Help with manual payments too.** Until B1 is live, a statement can still make Zelle and Venmo
easier to reconcile. It shows the institute's handle and a short **memo reference** unique to the
family. The office can then match a transfer to a family at a glance.

**Build.**
- **What a statement shows.** One statement per family per month: every lesson, at its
  charge, with the date, length and tutor. It also shows payments received, and the balance
  carried forward.
- **How it's made.** A statement is a page in the portal, built from its frozen snapshot.
  Families print it or save it as a PDF from the browser, as the 1099 is printed today.
- **Delivery.** On the first of the month, families are emailed a link to it (F3, F4), with a
  "Pay now" link once B1 exists.
- **Attachments later.** A PDF attached to the email needs it made on the server: Browser Run
  fits the free plan at this size (see L5).

**Later.**
- A statement number sequence and "paid" stamps.
- The institute's letterhead, held in F9.

**Data.** `statements` (family, period, totals snapshot, sent_at). A statement snapshots its
figures so it never changes after sending, like a lesson freezes its rates.

**Guard rails.**
- A statement carries the family side only (R2).
- A guardian of two children sees both on one statement.
- Separated parents who each pay for the same child each see that child's lessons, which
  matches today's rule.

**Needs.** F3, F4, and B1 for the pay link. **Cost.** $0. **Size.** M.

### B3 · Autopay and payment reminders

**Why.** Autopay is how learning centres get paid on time: five of the eight platforms keep a
card or bank account on file and charge it on a schedule (Jackrabbit adds proration and
buy-now-pay-later; My Music Staff and Teachworks call it Auto-Pay and AutoPay). Overdue
reminders, found on four of the eight, are the other half. Like statements, a reminder can
carry the Zelle handle and memo reference for families who don't pay online.

**Build.**
- **Autopay.** An opt-in on the parent's Finance tab that saves a payment method through
  Stripe. The statement balance (B2) is charged on a set day.
- **Receipts.** Every payment is followed by an email receipt.
- **Reminders.** Balances over 30 days old get a friendly reminder, then an office task.

**Later.** Late fees, held in F9, if the institute wants them.

**Data.** `autopay_mandates` (family, Stripe customer and payment method ids, day, active).

**Guard rails.** Consent to autopay is recorded (F7) with its terms version. An audit event is
recorded for enrolling and cancelling.

**Needs.** B1, B2. **Cost.** Stripe fees only. **Size.** M.

### B4 · Lesson packages and prepaid credit

**Why.** Five of the eight platforms sell prepaid packages or hold family credit, such as ten
lessons at a discount paid up front. The institute gets cash earlier, and the family gets a lower
price. Teachworks adds a **low-balance alert** when a package runs down. It is the family-side
mirror of the tutor advance this portal already has (Phase 13).

**Build.**
- **A package.** It has a number of hours, a price and an expiry.
- **Buying it.** The purchase is a payment.
- **Using it up.** Each lesson recorded for that student draws the package down.
- **What it charges.** The lesson's `charge_rate_cents` is the package's effective hourly
  rate, frozen onto the session as today, so every existing rule still holds.

**Later.** Monthly memberships, meaning a fixed fee for a fixed number of lessons.

**Data.** `packages` (student, hours bought, rate, paid by payment, expires_on);
`package_draws` (package, session, minutes).

**Guard rails.**
- The price a lesson is charged at is still derived on the server, never sent by a client.
- A package is family-side money: never shown to the tutor (R2, R4).

**Needs.** B1 helps; not required. **Cost.** $0. **Size.** M.

### B5 · Discounts, sibling pricing and scholarships

**Why.** Sibling discounts and need-based scholarships are common and are currently done by
hand, by setting a lower charge rate.

**Build.**
- **How it's set.** A discount is a named percentage or fixed amount per hour on a student:
  "Sibling 10%" or "Scholarship $20/hr".
- **When it applies.** It applies when a lesson is priced. The lesson freezes both the list
  rate and the discount, so the statement can show them.

**Data.** `student_discounts` (student, name, kind, amount, from, to). `sessions` gains
`charge_discount_cents` (additive).

**Needs.** None. **Cost.** $0. **Size.** S.

### B6 · Tutor pay runs and pay statements

**Why.** Paying tutors means reading each balance and top-up, then typing one payment per
tutor. TutorCruncher and Teachworks run payroll as a batch: pick a period, review, approve,
export.

**Build.**
- **A pay run.** The admin picks a period. Each tutor gets a line: earned in the period, what
  they already hold as an advance, the top-up due, and a suggested payment.
- **Approval.** Approving writes all the `to_tutor` payment rows at once.
- **Export and statements.** It exports a CSV for the bank or Zelle, and each tutor gets a pay
  statement on their Finance tab.

**Later.** Paying tutors through Stripe Connect or ACH payouts.

**Data.** `pay_runs` (period, approved_by, approved_at); `payments.pay_run_id` (additive).

**Guard rails.**
- A tutor sees only their own line (R1, R5).
- The run and its approval are audited, with no amounts in the description (R8).

**Needs.** None. **Cost.** $0. **Size.** M.

### B7 · Accounting export

**Why.** The institute's books live outside the portal. QuickBooks and Xero integrations are
standard in the survey.

**Build.**
- **The export.** A monthly CSV journal: revenue by lesson (charge), cost by lesson (tutor
  pay), payments in and payments out.
- **Format.** Mapped to the account names in F9, in QuickBooks Online's import format.

**Later.** QuickBooks Online API sync with OAuth, which needs a Worker secret and token
refresh.

**Needs.** None. **Cost.** $0. **Size.** S.

### B8 · 1099 electronic filing

**Why.** The portal prints 1099-NEC copies for recipients. Since 2024 the IRS requires e-filing
for 10 or more information returns of all types combined.

**Build.**
- **Stay under the threshold.** With under 10 returns, keep printing.
- **At 10 or more.** Add an export in the layout accepted by a filing service (Track1099, Tax1099),
  who file with the IRS.

**Later.** The office files directly on the IRS's own IRIS portal. The portal exports
everything on the form except the tutor's number, which the office types into IRIS itself.
The portal never files, because filing through the Worker would put the SSN in a request.

**Guard rails.** No SSN is ever stored or sent through the Worker. That rule is absolute
(`CLAUDE.md`), and it is why filing goes through a service the office logs into directly.

**Needs.** None. **Cost.** A filing service is a few dollars per form. **Size.** S.

### B9 · Adjustments, credits and refunds

**Why.** Real ledgers need corrections: a goodwill credit, a refund, a write-off. Today the only
tool is editing or deleting a lesson or payment, which changes history.

**Build.**
- **The entry.** An `adjustment` ledger entry is a credit or debit to a family or a tutor, with
  a reason.
- **Why an entry.** Balances include it. Nothing that already happened is edited.

**Data.** `ledger_adjustments` (party, student, amount_cents signed, reason, created_by).

**Guard rails.** It is an admin-only write, audited without the amount.

**Needs.** None. **Cost.** $0. **Size.** S.

---

## 3. Enrollment and growth

Today a family exists only once an admin creates it. Everything before that happens outside
the portal, in email, the phone and the website:
- the first enquiry
- the assessment appointment
- the policies a family agrees to

### G1 · Enquiry form and lead pipeline

**Why.** Six of the eight business platforms capture leads. TutorCruncher's whole front end
is a sales pipeline fed by web enquiry forms, and Oases and My Music Staff track leads,
trials and a waitlist. A public enquiry form feeds a pipeline, so no enquiry is lost in an
inbox, and conversion can finally be measured.

**Build.**
- **The public form.** An enquiry form lives at `/enquire`, and can also be embedded on
  trianglemathinstitute.com. It collects:
  - the parent's name, email and phone
  - the child's grade and school
  - what they are looking for
  - their free times
- **The pipeline.** Each enquiry is a *lead*, not a user: only admins create users, and that
  stays. Leads move through: New → Contacted → Assessment booked → Enrolled, or Lost with a
  reason.
- **Enrolment.** "Enrol" pre-fills the existing create-a-student-with-parent request, so the
  guardian rule still holds.

**Later.**
- A second form for group class registration (S9).
- Source tracking: website, referral or ad.

**Data.** `leads` with columns:
- contact details
- child details
- status
- source
- notes
- `converted_user_id`

**Guard rails.**
- **Admin-only reads.** The form is a public route: Turnstile-protected and rate-limited. It
  writes a lead, never a user. Leads are admin-only reads.
- **Children's data.** A lead holds a child's details before any consent exists, so the form
  asks only for what is needed and old leads are purged (A3).

**Needs.** None. **Cost.** Turnstile is free. **Size.** M.

### G2 · Assessment booking and onboarding checklist

**Why.** Phase 16 records the initial assessment, but booking it is informal.
- **Assessment booking.** Mathnasium's model is an assessment appointment → learning plan →
  enrolment.
- **Onboarding checklist.** Onboarding checklists (policies signed, payment method on file,
  schedule set) keep new families from falling through gaps.

**Build.**
- **Self-booking.** A lead or a new family books an assessment slot from the admin's published
  free times (`availability_slots`).
- **Checklist.** A new family's record shows a checklist:
  - assessment done
  - plan set
  - policies accepted (G3)
  - payment method saved (B3)
  - first lesson scheduled

**Needs.** G1, G3. **Cost.** $0. **Size.** M.

### G3 · Policies and e-signature acknowledgements

**Why.** Families agree to policies: tuition, cancellation, media or photo consent, and
behaviour. That agreement is currently on paper or implied. A dated, versioned acknowledgement
is legally sufficient under the ESIGN Act for policy acceptance. Jackrabbit takes policy
agreements at registration, Oases has e-signature, and RSM has families sign releases and a
written refund schedule.

**An enrolment packet.** The same mechanism can carry everything a new family agrees to:
- the tuition agreement
- the cancellation policy
- recording consent (F7)
- who may collect a child from an in-person lesson

It should avoid health information. If allergies must be known for in-person safety, record
them on the student, readable by admins and that student's tutors only.

**Build.**
- **Policy documents.** Stored with versions: markdown, plus a content hash.
- **Acceptance.** A guardian accepts a policy by typing their name. That records who, when,
  which version, and the IP address.
- **Re-acceptance.** A new version asks again at next sign-in.

**Data.** `policies` (slug, version, body, published_at); `policy_acceptances` (user, policy
version, typed_name, at, ip).

**Guard rails.** Acceptances are append-only, like the audit log.

**Needs.** None. **Cost.** $0. **Size.** S.

### G4 · Surveys, NPS and reviews

**Why.** Retention is the economics of tutoring. A short satisfaction survey after the first
month and each term, and an NPS score per tutor, are standard (TutorCruncher and Oases build
them in). A good score is also the moment to ask for a Google review.

**Build.**
- **Surveys.** Short surveys go to guardians by email (F3): score, what's going well, what
  could be better.
- **Results.** Results are admin-only, per tutor and per term.
- **Review request.** A score of 9 or 10 shows a "Leave us a Google review" link.

**Data.** `surveys`, `survey_responses`.

**Guard rails.** Tutors see aggregate scores for themselves, never an individual family's
comment unless the office shares it.

**Needs.** F3. **Cost.** $0. **Size.** S.

### G5 · Referral programme

**Why.** Word of mouth is the main growth channel for local tutoring. A referral credit ("give
a friend's first lesson free, get one free") is common in the survey.

**Build.**
- **Referral link.** Each family gets a referral link that tags a lead (G1).
- **Credit.** When that lead enrols, the office is prompted to apply a credit (B9).

**Needs.** G1, B9. **Cost.** $0. **Size.** S.

### G6 · At-risk students and re-enrolment

**Why.** A student who has not had a lesson in three weeks is usually about to leave. The
portal already knows who has not had a lesson in a while, whose plan is behind, and whose
balance is growing.

**Build.**
- **Where it shows.** An "At risk" panel on the admin's Tutoring tab.
- **Flags.** It lists students with:
  - no lesson in 21 days while a schedule exists
  - a plan more than 20 points behind pace
  - three cancellations in a month
- **Re-enrolment.** A term-end re-enrolment prompt goes to families whose plan finished.

**Needs.** S1 makes the signal sharper. **Cost.** $0. **Size.** S.

---

## 4. Communication

### M1 · Messaging, with safeguarding built in

**Why.** Families and tutors message each other today by text and WhatsApp, outside any
record. Every platform surveyed has in-app messaging (Wise, TutorBird, Teachworks, Canvas
Inbox). For a business teaching children there is a second reason: **no private adult–child
channel**. Child-safety guidance for youth-serving organisations recommends that messages
between an adult tutor and a minor are visible to the child's guardians.

**Build.**
- **Threads.** A thread is between a tutor, a student's guardians, and the office.
  - Its audience is the lesson's audience (`teachingScopeSql`): tutor, student, guardians
    and admins.
  - A thread can never exclude the guardians.
- **Notifications.** New messages are notified (F3).
- **Message type.** Text only at first. Attachments come later (F2).

**Later.**
- Read receipts.
- Office-hours auto-replies.
- Messages from the office to a whole class (M2).

**Data.** `message_threads` (student, tutor, subject); `messages` (thread, author, body,
created_at, deleted_at).
- Not editable, like comments.
- The author may withdraw a message.

**Guard rails.**
- **Scope.** The thread scope reuses the comments scope fragments. No fourth copy of the rule
  (the comments rule in `CLAUDE.md`).
- **Guards.** The SSN guard applies to the body, which goes through `optionalText`.
- **Audit.** An audit event is written per thread created, never with message text.
- **Crawl.** The exposure crawl reads every thread as every persona.

**Needs.** F3. **Cost.** $0. **Size.** M.

### M2 · Announcements

**Why.** The office tells every family about closures, new classes and policy changes, today
by group email outside the portal. Canvas Announcements and every parent app have it.

**Build.**
- **Posting.** An admin posts an announcement to everyone, all parents, all tutors, one
  class (S9) or one level.
- **Display.** It shows on the recipients' dashboards until dismissed.
- **Email.** It is optionally emailed (F3).

**Data.** `announcements` (audience, title, body, starts, ends, created_by);
`announcement_reads`.

**Needs.** F3. **Cost.** $0. **Size.** S.

### M3 · Weekly family digest

**Why.** The portal holds exactly what a parent wants to know each week:
- last week's lessons and notes
- progress on the plan
- next week's lessons
- any balance

Parents do not log in to find it. A regular roll-up is how the maths products keep parents
engaged: AoPS Online and Khan Academy send weekly parent emails, Thinkster sends a weekly
tutor report, and Mathnasium sends monthly progress reports.

**Build.** A Sunday-evening email per family (F3, F4) that assembles, from the scoped reads,
that family's:
- lessons
- progress summary
- upcoming lessons
- balance (Finance only, clearly separated)

The family can opt out.

**Later.** An AI-written summary paragraph ([future-ai.md](future-ai.md#ai-3--family-digests-and-progress-narratives)).

**Guard rails.**
- The digest is built from the same repository functions as the parent's dashboard, so it can
  never contain more than the dashboard does.
- The exposure crawl covers the digest-building endpoint.

**Needs.** F3, F4. **Cost.** Within the email free tier (one per family per week).
**Size.** S.

### M4 · Translation for families

**Why.** Some families in the Triangle speak another language at home. Automatic translation
of notes, messages and digests helps them follow their child's progress.

**Build.**
- **Translate a note.** A "Translate" action on notes, messages and digests, through Workers
  AI (m2m100) or a commercial API.
- **Preferred language.** It is set per person.

**Guard rails.** Translation sends text to a model: consent F7 and F11 rules apply.

**Needs.** F7, F11. **Cost.** Workers AI's free daily allowance covers it. **Size.** S.

---

## 5. Tutor workforce

### T1 · Tutor onboarding and compliance records

**Why.** Businesses that put adults one-to-one with children are expected to keep:
- background checks
- training
- signed policies
- tax forms

TutorCruncher runs tutor applications with background checks, and Club Z advertises
background-checked tutors. Today the portal records one thing: that the SSN was received.

**Build.** A checklist per tutor, and items can expire:
- background check: provider, date, expiry, result "clear" (never the report itself)
- child-safety training date
- policies accepted (G3)
- W-9 received: a date, never the form or the number, exactly like `ssn_received_on`
- a contract on file (F2)

The admin dashboard gets an "expiring soon" list.

**Data.** `tutor_compliance_items` (tutor, kind, completed_on, expires_on, reference note).

**Guard rails.**
- **What is never stored.** No background report contents and no SSN or TIN of a tutor.
  Records say "done on", as `ssn_received_on` does.
- **Who sees it.** Only the admin and the tutor themselves (R6).

**Needs.** None. **Cost.** $0. **Size.** S.

### T2 · Tutor self-service: availability and time off

**Why.** Tutors cannot update their own free hours or book time off. Every scheduling product
lets them, with the office seeing the effect.

**Build.**
- **Availability.** Tutors edit their own availability (F8).
- **Time off.** A tutor requests time off for a date range. Once approved, it cancels their
  occurrences as institute cancellations (S1) and offers the office a substitute (T5).

**Needs.** F8, S1. **Cost.** $0. **Size.** S.

### T3 · Tutor–student matching

**Why.** Placing a new student means guessing which tutor fits. TutorCruncher and Wyzant-style
marketplaces rank tutors by fit.

**Build.** For a student with a plan, rank tutors by:
- levels taught, from past pairings at that curriculum level
- overlapping availability (S3)
- current load
- in person or virtual

The office sees the reasons for each match; the admin still decides.

**Later.** Outcome-aware matching: which tutor's students progress fastest at this level (T4).

**Guard rails.** Admin-only.

**Needs.** S3. **Cost.** $0. **Size.** S.

### T4 · Tutor insight: load, retention and progress

**Why.** The portal can measure what matters in a tutor, and currently shows none of it:
- students kept
- lessons cancelled
- how fast their students master plan topics

**Build.**
- **Per tutor, per term.** The admin sees:
  - students taught
  - retention
  - attendance
  - average progress velocity (topics mastered per ten lessons)
  - survey scores (G4)
- **Tutor's own view.** Each tutor sees their own figures, never other tutors'.

**Guard rails.**
- **Fairness.** Velocity is presented with the student count and level mix beside it, so a
  tutor of struggling students is not ranked below one with fast learners.
- **Who sees what.** Admin-only for comparisons.

**Needs.** None; S1 and G4 enrich it. **Cost.** $0. **Size.** S.

### T5 · Substitute cover

**Why.** When a tutor is ill, the office phones around. A cover request that goes to tutors
free at that time, first to accept wins, is common in learning-centre software.

**Build.**
- **Cover request.** For a cancelled occurrence, the office offers cover to tutors who are:
  - free at that time (S3)
  - qualified at that level
- **Accepting.** The first to accept gets a one-off pairing for that date, and the family is
  told.

**Guard rails.**
- **Assignment.** A substitute needs an assignment to record the lesson. The cover creates a
  one-off, date-bounded pairing, so the pay rules still apply.

**Needs.** S1, S3, F3. **Cost.** $0. **Size.** M.

---

## 6. Administration, analytics and data

### A1 · Business analytics

**Why.** Retention, utilisation and revenue per hour are the numbers learning-centre
operators run on. Four of the eight platforms report them: TutorCruncher has utilisation and
retention dashboards, Teachworks gross-margin reports, and Oases more than 75 reports. The
Finance tab has a monthly rundown; nothing shows trends or unit economics.

**Build.** An admin "Business" view, on the Finance tab, with monthly trends:
- active students
- new and lost students
- hours taught
- tutor utilisation (hours taught ÷ hours available)
- revenue, tutor cost and institute cut per hour
- average balance age
- cohort retention (still active after 3, 6 and 12 months)

**Guard rails.** Admin-only. Every figure is derived from the ledger, never stored.

**Needs.** None; S1 and B-series enrich it. **Cost.** $0. **Size.** M.

### A2 · Reports and exports

**Why.** Every question the dashboards do not answer today becomes a manual CSV exercise.

**Build.**
- **Saved reports.** A small set of saved reports (e.g. lessons by tutor by month, balances
  by family), each as a scoped CSV.
- **Google Sheets.** A Google Sheets `IMPORTDATA` link, using a per-report token like S6's.

**Later.** A natural-language question box ([future-ai.md](future-ai.md#ai-8--ask-the-portal)).

**Needs.** None. **Cost.** $0. **Size.** S.

### A3 · Data retention and deletion

**Why.** The amended COPPA Rule requires a written retention policy and deleting children's
data when it is no longer needed. Today a soft-deleted person stays for ever, and there is no
way to answer "delete everything about my child" beyond a hard delete that the audit log
outlives by design.

**Build.**
- **A retention schedule in settings (F9).** For example:
  - leads purged after 12 months
  - homework images after 12 months
  - retired families' personal details anonymised after 7 years
  - money rows kept for tax purposes
- **A monthly job (F4) that applies it.**
- **A "data request" tool.** An admin can export or erase one person. Erasure anonymises the
  audit snapshot names but keeps the events.

**Guard rails.**
- The audit log stays append-only. Anonymising a *name snapshot* is the documented exception.
- This must be written into `docs/data-model.md` before it is built.

**Needs.** F7, F4. **Cost.** $0. **Size.** M.

### A4 · Staff roles: front desk and bookkeeper

**Why.** Everyone who helps run the institute today must be a full admin, which means seeing
every margin, TIN and balance. Canvas has custom roles; business tools separate front desk from
finance.

**Build.** Two new roles:

- **`office`**. Can:
  - schedule
  - manage families and leads
  - see lessons and notes

  Cannot see any money or pay.
- **`bookkeeper`**. Can:
  - see Finance
  - record payments

  Cannot see notes or progress.

**Data.**
- `user_roles.role` gains values.
- **Warning:** the role list is a CHECK constraint, so production needs a rebuild of
  `user_roles`.
- This is safe because nothing references that table, but it must be rehearsed like the
  Phase 16 change.

**Guard rails.**
- This is the largest change to the exposure rules since Phase 18.
- Every scope helper gains the new roles.
- `exposure.spec.ts` gets two new personas before anything ships.

**Needs.** None. **Cost.** $0. **Size.** L.

### A5 · Audit review and alerts

**Why.** The audit log is complete but nobody watches it.

**Build.**
- **Admin alerts.** Admins get a notification (F3) for sensitive events:
  - a role change
  - a rate change
  - a payment deleted
  - a sign-in denied more than three times
  - a user purged
- **Weekly summary.** A weekly "what changed" summary for the owner.

**Needs.** F3. **Cost.** $0. **Size.** S.

### A6 · A second location

**Why.** A growing institute opens a second site, or partners with a school. Multi-location is
a standard tier in Teachworks and Jackrabbit.

**Build.** A `locations` table. Rooms, schedules and classes belong to a location. An admin can
filter every view by location, and settings (F9) can differ per location.

**Needs.** S8, F9. **Cost.** $0. **Size.** M. Worth doing only when a second site is real.

---

## 7. Quality

### Q1 · Accessibility audit (WCAG 2.2 AA)

**Why.** Instructure publishes conformance reports for Canvas and claims WCAG 2.2 AA; WCAG
2.1/2.2 AA is also the benchmark courts apply to private places of education under ADA Title
III. Families include people using screen readers, keyboard-only navigation and high zoom.

**Build.**
- **Automated checks.** axe-core assertions in the end-to-end suite on every page, in both
  themes.
- **Chart accessibility.** The charts already carry table views.

**Later.**
- A manual screen-reader pass.
- An accessibility statement page.

**Cost.** $0. **Size.** S.

### Q2 · Languages in the interface

**Why.** This is not needed yet. Worth doing only if the families served need it; M4
translates content, which may be enough.

**Size.** M.

### Q3 · Performance budget

**Why.** The app is one bundle. Adding charts, KaTeX and MathLive (F6), the whiteboard (V2)
and AI screens will grow it.

**Build.**
- **Split by route.** Route-level code splitting, with maths and ink libraries loaded on
  demand.
- **Size budget.** A bundle-size budget check in CI.
- **Cloudflare.** Cloudflare's own Web Analytics, which is free and cookieless.

**Cost.** $0. **Size.** S.

---

## 8. Teaching and learning

Phase 16 gave the portal a curriculum, assessments, plans and per-lesson scores. What the
leading maths products add on top is the **work between lessons**:
- homework
- practice
- diagnostics
- review

They also add **what the family receives**: reports.

### L1 · Homework: set, submit, review

**Why.** Homework is how tutoring hours turn into progress, and the portal has no homework at
all. It lives in the free-text notes ("Homework: worksheet 3a"). Here is how others handle it:
- **Learning centres.** RSM runs online homework with instant feedback. Kumon Connect grades
  stylus worksheets within about a day, and lets instructors replay the work.
- **Software.** DeltaMath and IXL track assigned work, and Canvas is built around assignments.
- **The evidence.** Homework *with feedback* raised maths achievement in a randomised trial of
  2,850 students (ASSISTments, effect size g = 0.18).

It is also the thing parents most want to see.

**Build.**
- **Setting it.** At the end of a lesson (or from L6), the tutor sets homework:
  - a description
  - the plan topics it practises
  - an optional reference: book and pages ("BA 4C, pp. 34–41, problems 1–12"), a Beast
    Academy Online lesson, or an Alcumus topic
  - a due date
- **Status.** Families and the student see it and mark it done. A photo or PDF of the finished
  work can be attached (F2).
- **Review.** At the next lesson the tutor marks it: completed, partly, not done, with the
  score and minutes the family reports. They can also score the topics it practised, which
  feeds the same 1–5 topic ratings as lesson scoring.
- **Accountability.** Missing homework shows on the parent dashboard and in the digest (M3).

**Later.**
- Automatic checking of answers (L3).
- AI feedback on handwritten work ([future-ai.md](future-ai.md#ai-1--automated-homework-evaluation)).

**Data.**
- `homework`: student, set_by, session it was set in, description, reference, due_on, status,
  completed_at.
- `homework_topics`: homework, topic.
- `homework_reviews`: homework, reviewer, outcome, topic ratings through
  `session_topic_ratings`-shaped rows.

**Screens / API.**
- A "Homework" panel in the lesson form and on the student's progress page.
- A "This week" list on the parent and student dashboards.
- Routes under `/api/homework`.

**Guard rails.**
- **Who sees it.** The audience is the lesson's audience (`teachingScopeSql`).
- **Crawl.** New read routes are added to the exposure crawl.
- **Money.** None anywhere (the Phase 19 rule).
- **Book content.** Only references to AoPS/Beast Academy problems are stored, never their
  text. Their content is copyrighted.

**Needs.** F1 for the student to mark and upload, and F2 for photos. Both are optional for a
first cut, where a parent does it. **Cost.** $0. **Size.** M.

### L2 · Resource library mapped to the curriculum

**Why.** Tutors re-find the same worksheets and diagrams every week. A shared library tagged by
curriculum topic is standard in TutorBird, Wise and Canvas Files/Pages. It makes the
curriculum tree (116 topics) useful day to day.

**Build.**
- **What an item is.** Uploaded files (F2) or links: worksheets, answer keys, notes. Each is
  tagged to topics (`BA3.10`).
- **Using it.** From a plan topic, a tutor opens its resources, and can attach one to homework
  (L1).
- **Who sees answer keys.** Tutor-only, unless shared.

**Data.** `resources` (title, kind, file or url, visibility `tutors`|`families`), `resource_topics`.

**Guard rails.**
- **Copyright.** The library stores the institute's own worksheets, and links to published
  material. It never copies AoPS or Beast Academy pages.
- **Answer keys.** They never reach a student.

**Needs.** F2. **Cost.** R2 free tier. **Size.** S.

### L3 · Practice sets with automatic checking

**Why.** What does most for maths mastery between lessons, according to the research the
leading platforms build on, is practice with immediate feedback:
- **The platforms.**
  - IXL's SmartScore (80 is proficient, 100 is mastery).
  - Khan Academy's mastery levels.
  - AoPS Alcumus: over 13,000 free problems, rating each topic by the chance of solving an
    average problem in it.
  - DeltaMath.
- **The research.** Quizzing, spacing and worked examples are recommendations 1, 2 and 5 of
  the US Institute of Education Sciences' practice guide. Mixing topics (interleaving) had an
  effect size of 0.83 in a 54-class grade-7 trial. Hints work best as a ladder, from a general
  nudge to the next step, then a worked example, and only then the answer.

The portal knows exactly which topics each student needs (plan topics rated below 4), but
cannot give them anything to do.

**Build.**
- **An item bank of the institute's own problems.** Each item is tagged to a topic, with an
  answer checker:
  - **Number.** A number within a tolerance.
  - **Expression.** Equivalent expressions, checked by a JavaScript maths engine in the Worker
    (see [future-ai.md](future-ai.md#checking-the-maths) for the choice).
  - **Multiple choice.**
  - **Short text.**
- **Practice sets.** A tutor builds a set by choosing topics, and the portal draws items from
  the bank.
- **Doing a set.** The student answers on screen and is checked instantly. Two hints are
  available before a worked solution.
- **What results feed.** Results update the topic's rating as a *suggestion* the tutor
  confirms, keeping ratings human-owned as in Phase 16.
- **Formula items.** Parameterised "formula" items (Canvas New Quizzes has this type) make
  endless variants of one problem.
- **Where items come from.** Items are written by the institute's tutors. OpenStax Prealgebra
  2e and Illustrative Mathematics grades 6–8 are CC BY 4.0, so they can be adapted with
  attribution. AoPS and Beast Academy problems cannot be copied. AMC problems may be copied
  free only for non-profit use; a paid institute needs the MAA's written permission.

**Later.**
- Adaptive sequencing: pick the next item by estimated mastery (knowledge tracing).
- AI-generated items verified by the maths engine ([future-ai.md](future-ai.md#ai-4--adaptive-practice-and-generated-problems)).
- Timed quizzes.

**Data.**
- `items`: topic, stem (KaTeX), answer spec as JSON, hints, solution, author, status.
- `item_sets`, `set_items`.
- `attempts`: student, item, answer, correct, hints_used, seconds, at.

**Screens / API.**
- An item editor for tutors, with a live preview.
- A practice player for students (F1).
- Results on the progress page.

**Guard rails.**
- **The answer never reaches the student's browser.** A student must not be able to read
  answers from the network tab, and the free plan's 10 ms of CPU rules out running a full
  maths engine in the Worker.
  - **Numbers and choices.** Compared in the Worker, which takes microseconds.
  - **Expressions: fingerprints, not the answer.** When a tutor saves an item, their browser
    evaluates the correct expression at a set of random points. The *values* are stored as
    the item's fingerprint, never sent to students.
  - **Checking a student's expression.** The student's browser evaluates their expression at
    the same points, which are not secret, and posts the values. The Worker compares numbers.
  - **The verdict.** It comes back with the next hint if the student asked for one. The
    method is described in [future-ai.md](future-ai.md#checking-the-maths).
- **Crawl.** Attempts are student data, scoped like session progress.

**Needs.** F1, F6. **Cost.** $0. Checking a number or sampling an expression takes a
millisecond or two, well inside the free plan's CPU budget. Heavier symbolic work is the
point at which the $5 plan pays for itself (see F4). **Size.** L.

### L4 · Diagnostic placement test

**Why.** Today the initial assessment is the assessor's judgement, typed in. Structured
placement exists everywhere in the category:
- **Beast Academy and AoPS.** Beast Academy publishes a free printable placement test for each
  book. AoPS publishes "Are you ready?" diagnostics with cut scores (23 of 28 for
  Prealgebra 1).
- **IXL.** It runs an adaptive diagnostic of about 45 minutes, and since 2026 15-minute
  Snapshots.
- **Math Academy.** Its diagnostic finds the student's "knowledge frontier" and projects
  completion dates.
- **Mathnasium, Sylvan and Oases.** Mathnasium builds plans from a spoken and written
  assessment. Sylvan re-assesses every 24 sessions. Oases generates learning plans from tests
  automatically.

A structured diagnostic makes the Phase 16 assessment faster and comparable between students.

**Build.**
- **The test.** A diagnostic is a practice set (L3) that walks the ladder. It starts at the
  student's school grade, moves down a level after misses and up after successes, two or three
  items per topic.
- **The result.** It produces a draft assessment: topic ratings, a recommended level, and a
  summary of evidence. The assessor edits and saves it through the existing assessment
  dialog, so Phase 16's model is unchanged.
- **Where it runs.** In the office, at the assessment appointment (G2), or at home before it.

**Later.**
- **Readiness checks.** A short check of 10–15 questions on prerequisites before a student
  starts a new level, as Mathspace and Prodigy do. Its results are saved as another
  assessment.
- **Scheduled re-assessment.** "Check-up due" after a set number of lessons (Sylvan uses 24)
  or each term.
- **Growth.** Two assessments shown side by side.

**Data.** `diagnostic_runs` (student, started, finished, draft_assessment_id).

**Guard rails.** The published BA and AoPS placement tests are *referenced* (links), never
copied. The diagnostic uses the institute's own items (L3).

**Needs.** L3. **Cost.** $0. **Size.** M.

### L5 · Progress reports and report cards

**Why.** Families pay for results and want them written down.
- **What others send.** Mathnasium, Kumon and Beast Academy Online all send periodic progress
  reports.
- **The portal already has the data.**
  - plan
  - timeline chart
  - topics mastered
  - attendance
  - the tutor's notes

**Build.**
- **What's in a report.** A term or monthly report per student:
  - goal and status
  - the chart
  - topics mastered this period
  - lessons held vs planned
  - homework completion (L1)
  - a tutor's comment written for the report
- **Delivery.** A report is a page in the portal, built from its frozen snapshot. The
  guardians are emailed a link to it (F3); they can print it or save it as a PDF from the
  browser, the way the 1099 is printed today.
- **Attachments later.** A PDF *attached* to the email needs the PDF made on the server,
  with Cloudflare Browser Run (formerly Browser Rendering). Its free allowance of 10
  browser-minutes a day makes roughly a hundred short PDFs, which is enough for monthly
  reports at this size.

**Later.**
- An AI first draft of the tutor's comment ([future-ai.md](future-ai.md#ai-3--family-digests-and-progress-narratives)).
- A parent–tutor conference booking from the report.

**Data.** `progress_reports` (student, period, snapshot JSON, comment, published_at). A
report snapshots its figures, so it never changes after it is sent.

**Guard rails.**
- **Money.** None; it is a Tutoring-side document.
- **Who sees it.** The audience is the student's progress audience (`studentScopeSql`).

**Needs.** F3. **Cost.** $0. **Size.** M.

### L6 · The lesson cockpit

**Why.** Phase 19 exists because tutors keep the sessions page open *during* a lesson, with the
student beside them. The screen they need then is not a list of sessions. It is one page for
this lesson with this student:
- the running timer
- the last lesson's notes
- homework to check
- the plan's next topics
- the whiteboard
- the scores to record

No product in the survey does this well for one-to-one tutoring. Lessonspace and Pencil Spaces
come closest for online lessons.

**Build.** A full-screen lesson view that opens when a tutor presses Start. It shows:
- the live timer from Phase 7, with no money anywhere
- last lesson's notes and homework set, each with a "reviewed" tick (L1)
- plan topics in order, current ratings shown as chips, one tap to score
- a notes box that saves as you type
- "Set homework" and "End lesson"

Ending the lesson records the session with its progress in one step.

**Later.**
- The whiteboard (V2) embedded.
- The practice player (L3) on a second screen for the student.

**Guard rails.** Money-free by construction: this page reads only Tutoring-side fields, and an
e2e test asserts that no currency appears on it.

**Needs.** L1 makes it richer. **Cost.** $0. **Size.** M.

### L7 · Structured lesson notes and templates

**Why.** Session notes are one free-text box. Reports (L5), digests (M3) and any AI summary
work far better from structure:
- **TutorBird.** It has note templates with separate student, parent and **private**
  sections.
- **TutorCruncher.** It can make lesson reports mandatory.
- **myMathnasium.** It sends families session summaries.

**Build.**
- **The note's parts.** A note has optional parts:
  - covered
  - went well
  - to work on
  - homework (becomes an L1 item)
  - next time
- **Templates.** Per level, set by the office.
- **Staff-only part.** Each part is either family-visible or staff-only. Candid notes ("mum
  says he's anxious about tests") can then be written without reaching the family, while the
  rest goes into the digest and reports.
- **Required notes.** Optionally, the office can require a note before a lesson can be
  recorded.
- **Compatibility.** Old notes stay as free text.

**Data.** `sessions.notes` stays. A `session_note_parts` table (session, part, body) is added,
so production needs no change to `sessions`.

**Needs.** None. **Cost.** $0. **Size.** S.

### L8 · Spaced review of mastered topics

**Why.** A topic rated 4 in October can slip by March, and today a slip shows only if someone
happens to re-rate the topic. Spaced practice is the first recommendation of the US Institute
of Education Sciences' practice guide, and the leading products build it in:
- Khan Academy's Mastery Challenges re-test mastered skills.
- Alcumus mixes review problems in.
- Math Academy's spaced-repetition system gives partial review credit to prerequisites.

The portal already stores when each topic was last rated (`last_rated_on`), which is
everything a review queue needs.

**Build.**
- **Due for review.** Each mastered topic gets a "review due" date that grows with each
  successful review: 2 weeks, 1 month, 2 months.
- **Where tutors see it.** The cockpit (L6) and the progress page list topics due for a quick
  check.
- **Slipping.** A review score below 4 un-masters the topic.

**Data.** Derived from existing ratings plus a small `topic_reviews` table.

**Guard rails.** Keep `computeProgress` the single source of mastery. Review changes the
inputs, not the rule.

**Needs.** None; L3 makes reviews self-serve. **Cost.** $0. **Size.** S.

### L9 · Class-wide mastery heatmap

**Why.** The office sees one student at a time. A grid of students × topics coloured by rating
shows at a glance:
- which topics are hard across the institute
- which tutor's students are stuck where

It is the equivalent of Canvas's Learning Mastery Gradebook and of IXL's analytics.

**Build.**
- **The grid.** An admin grid on the Progress page, per level. Rows are students, columns are
  topics, and cells are the current rating on the Phase 16 rating ramp.
- **Filters.** By tutor and by plan status.
- **Tutor's view.** A tutor sees the same grid for their own students.

**Guard rails.** It uses `studentScopeSql`, so a tutor sees only their current students.

**Needs.** None. **Cost.** $0. **Size.** S.

### L10 · Bringing in outside learning platforms

**Why.** Many students also use Beast Academy Online, Alcumus or Khan Academy at home. Tutors
currently ask "what did you do this week?". Seeing that activity beside the plan would close
the loop.

**Build.**
- **First version: record it by hand.** A lesson note can log outside work ("BA Online: 4C
  chapter 2, 80%"), tagged to topics.
- **Import.** Parent-uploaded exports are parsed where a platform offers them. Of the
  platforms these families are likely to use, only IXL exports CSV (on every report).
- **Beast Academy Online.** Its lessons are scored with 1–3 stars and its parent reports can
  only be printed. Record the stars per chapter by hand; they map naturally onto the portal's
  1–5 scale.

**Later.** API integration where a platform offers one. Beast Academy Online and Alcumus
publish none, and Khan Academy removed its public API in 2020. This stays manual for the
foreseeable future.

**Needs.** None. **Cost.** $0. **Size.** S.

### L11 · A student's own space

**Why.** Students old enough to sign in see a thin dashboard. Beast Academy Online, Khan
Academy and Prodigy show students their own path, goals and wins, which the research links to
persistence.

**Build.**
- **A student home.**
  - "Your goal" and the plan timeline
  - this week's homework
  - practice sets (L3)
  - topics mastered this month
- **Celebrations.** When a level's topics are mastered, the student sees a celebration.

**Guard rails.**
- **Gamification.** Kept modest: no leaderboards between students, which would expose one
  child's progress to another (R7) and backfire with younger learners.
- **Money.** None.

**Needs.** F1. **Cost.** $0. **Size.** S.

### L12 · Rating anchors and evidence-weighted mastery

**Why.** Every rating the progress chart draws on is a tutor's 1–5 judgement. Two tutors can
give the same lesson a 3 and a 4, and today nothing shows how many observations stand behind a
rating. The leading products tie each level to something observable:
- **Beast Academy.** Stars: 1 star means proficient enough to move on.
- **IXL.** SmartScore 80 means proficient.
- **Mathnasium.** A mastery check needs 90% or more.
- **Alcumus.** It computes each topic's rating from every attempt, and so does Canvas's Outcomes
  tool, with a choice of calculation methods.

**Build.**
- **Anchors.** Each rating gets a one-line anchor that shows in every picker. For example,
  "5 · Mastered: a clean check of five or more problems with no help". The office edits the
  anchors in settings (F9).
- **A computed estimate.** It is shown *beside* the tutor's rating, never instead of it:
  - It combines lesson scores, homework reviews (L1) and practice results (L3), weighting
    recent evidence more.
  - It shows a confidence band.
  - It is labelled with how many observations it rests on.
- **Where it lives.** It is computed in `packages/shared` next to `computeProgress`, so every
  screen agrees.

**Later.** A setting for how mastery is decided, e.g. most recent, decaying average, or "n
times at 4 or above", like Canvas Outcomes.

**Guard rails.** The tutor's rating stays the source of truth for the plan (Phase 16). The
estimate is advice, and derived, never stored.

**Needs.** None for anchors; L1 or L3 for the estimate to mean much. **Cost.** $0. **Size.** S
for anchors; M with the estimate.

### L13 · Prerequisite map

**Why.** The catalog is a list of 116 topics in book order, with no links between them. Yet
"add some topics from a lower level" (Phase 16) is really a statement about prerequisites. The
leading products all run on a map of which topic depends on which:
- **Math Academy.** It builds on a knowledge graph.
- **Mathspace.** It checks readiness on prerequisites.
- **Prodigy.** It drops a struggling student to the prerequisites.

**Build.**
- **The links.** A `curriculum_prerequisites` table (topic, requires_topic) holds links
  within and across levels, from Beast Academy into Prealgebra, Algebra and Geometry.
  Examples:
  - `PRE.04` Fractions requires `BA4.08` and `BA4.10`.
  - `ALG.03` requires `PRE.05`.
- **Where it's stored.** It is reference data like the catalog: upserts in `schema.sql`'s
  catalog block, written once by the office and reviewed.
- **What it does.**
  - **Plans.** The plan dialog suggests missing prerequisites: "BA4.10 is rated 2 and
    PRE.04 needs it".
  - **Stalls.** A stalled topic (L14) points to its weakest prerequisite.
  - **Readiness checks.** They draw their questions from a level's prerequisites (L4).
  - **Review.** It can credit prerequisites (L8).

**Guard rails.** Reference data is never deleted, only corrected, like the topics themselves.

**Needs.** None. **Cost.** $0. **Size.** M, and most of the effort is the tutors' judgement
in drawing the links, not the code.

### L14 · Stalled-topic alerts

**Why.** A plan topic that has stayed at 2 for five lessons shows as a flat line only to
someone who opens that student's chart. Zearn alerts the teacher after three missed attempts
in one set, and IXL's Trouble Spots list students stuck on a skill.

**Build.**
- **When a topic is stalled.** Its rating has not risen across N lessons (a setting, default
  4), or the lessons' goal scores have averaged below 3 over the same stretch.
- **Where it shows.** The topic is flagged on the student's progress page, in the lesson
  cockpit (L6) and on the office's at-risk panel (G6).
- **Notifications.** The tutor is notified (F3), and with L13 the flag suggests which
  prerequisite to revisit.

**Needs.** None; F3 for notifications. **Cost.** $0. **Size.** S.

### L15 · Interactive graphing and geometry

**Why.** Algebra and geometry lessons need graphs and constructions that are hard to draw by
hand. Desmos (now part of Amplify) is what students already use at school, and Khanmigo draws
interactive diagrams.

**Build.** A graphing calculator and geometry tool opens in the lesson cockpit (L6) for ALG
and GEO topics. Its state is saved with the lesson, so it can be reopened and replayed.

**Guard rails.** The embed terms must be checked before building:
- Desmos requires an API key and its terms apply to commercial use.
- GeoGebra's apps are free only for non-commercial use.

**Needs.** L6. **Cost.** Depends on the licence. **Size.** S.

---

## 9. Live online lessons

Virtual lessons exist today (`mode = 'virtual'`), but they happen in Google Meet or Zoom, and
the portal knows nothing of what happened in them. Six of the eight business platforms offer
video or a whiteboard, mostly by integration. The online-classroom products combine video, a
shared whiteboard and recordings in one room tied to the lesson record:
- **Wise.** Built-in Zoom or Meet, with recording and AI summaries.
- **Pencil Spaces.** Whiteboard and video, with attendance, talk-time statistics, and alerts
  when a student idles or switches tab. Priced by the session-hour, from free to $5.
- **Lessonspace.** A no-install classroom with an equation editor, graphing and recordings, and
  an embedding API. From $9 a month for 10 hours to $199 for 200.

**Buy or build.** Pencil Spaces and Lessonspace both integrate with TutorCruncher and
Teachworks, and Lessonspace can be embedded. Embedding one of them behind the lesson cockpit is
the fastest route to a full online classroom. Building V1–V3 is worth it for two reasons:
- The handwriting features in [future-ai.md](future-ai.md) need the ink themselves.
- Keeping children's video and ink inside the institute's own storage simplifies consent.

### V1 · The lesson room: video in the portal

**Why.** Pasted meeting links (S7) work, but the tutor juggles two windows, and nothing links
the call to the lesson. A room that opens from the lesson cockpit (L6) with video, the
whiteboard (V2) and the timer in one place is the online-tutoring standard.

**Build.** The recommended order:
1. **First, embed rather than build.** Open the existing meeting link beside the cockpit.
2. **When online lessons are a meaningful share of the work,** add WebRTC video through
   Cloudflare Realtime. It is a two-person call with the whiteboard alongside, and the lesson
   timer starts when both join.
   - **Free allowance.** The relay (SFU) and TURN share 1,000 GB of egress a month free, then
     $0.05 per GB. A one-hour one-to-one lesson uses roughly 1–1.5 GB, so several hundred
     lesson-hours a month fit free (an estimate).
   - **Ready-made alternative.** Cloudflare's RealtimeKit adds a ready-made meeting interface
     and recording to R2, for $0.002 per participant-minute (about $0.24 for a one-hour
     lesson for two).

**Guard rails.**
- **Who can join.** A room is joinable only by the lesson's tutor, student and guardians, and
  admins.
- **Recording.** Recording is off by default, and on only with consent (F7).
- **Child safety.** No recording of a child without a guardian's consent. NC is a one-party
  consent state, but a family's written consent is the standard for minors.

**Needs.** L6, F1 (the student must be able to join), F7 (consent). **Cost.** $0 within the
free egress; RealtimeKit or recordings are billed per minute. **Size.** L.

### V2 · Shared whiteboard with handwriting

**Why.** Maths is written, not typed. Every online-tutoring product surveyed centres on a shared
whiteboard, and it is also the input surface for the live handwriting recognition in
[future-ai.md](future-ai.md#ai-7--live-handwriting-recognition-while-solving).

**Build.**
- **The board.** Tutor and student draw on one board: pen, eraser, shapes, a grid, and
  pasting a problem image.
- **How it syncs.** Ink is captured as strokes (Pointer Events: pressure and stylus), not
  pixels, and drawn with perfect-freehand (MIT licence). Strokes sync through a Cloudflare
  Durable Object, one per lesson, which relays them over WebSockets and keeps the board's
  state.
- **Why not a library.** tldraw needs a paid licence to use without its watermark, reported at
  around $6,000 a year. A shared-editing library (Yjs) waits until two people write at once.
- **Keeping it.** The board is saved to the lesson when it ends. It works in person too, on a
  shared tablet.

**Later.**
- Multiple pages.
- A problem bank sidebar (L3).
- Replay (V3).
- Recognition (AI-7).

**Data.** Board snapshots and stroke logs in R2 (F2), referenced from the lesson.

**Guard rails.**
- **Who sees a board.** Its audience is the lesson's (`teachingScopeSql`).
- **No money.** The board never shows any.

**Needs.** F1, F2. **Cost.** $0: Durable Objects are on the free plan. Incoming WebSocket
messages are billed at 20 to one request, which allows roughly 55 student-hours of live board a
day at ten messages a second. **Size.** L.

### V3 · Replay: how the student solved it

**Why.** Because the whiteboard stores strokes with timestamps, a lesson can be replayed as it
was written, much smaller than video. It shows where a student hesitated, what they erased,
and the order they worked in. That is useful for:
- the next tutor
- the parent
- the future misconception features (AI-6)

**Build.** A scrubber over the saved stroke log on the lesson's page.

**Guard rails.**
- **Who can replay.** The same audience as the board.
- **Retention.** Replays are kept per the retention policy (A3).

**Needs.** V2. **Cost.** $0. **Size.** M.

---

## Sources

Vendor pages were read on 24 September 2026. The research could not verify some claims and
said so; these are noted in the plans where they matter:
- Wise's prices.
- Teachworks' lack of a native app.
- A few franchise details.

**Business platforms.**
- **TutorBird.**
  - [features](https://www.tutorbird.com/features/)
  - [pricing](https://www.tutorbird.com/pricing/)
  - [calendar and attendance](https://www.tutorbird.com/calendar-attendance/)
- **My Music Staff.**
  - [student management](https://www.mymusicstaff.com/student-management/)
  - [Auto-Pay](https://www.mymusicstaff.com/introducing-auto-pay-beta/)
  - [practice log](https://www.mymusicstaff.com/practice-log/)
- **Teachworks.**
  - [pricing](https://teachworks.com/pricing)
  - [calendar](https://www.teachworks.com/features/calendar)
  - [billing](https://www.teachworks.com/features/billing)
  - [communication](https://www.teachworks.com/features/communication)
  - [2025 review](https://blog.teachworks.com/2025/12/teachworks-2025-a-year-in-review-for-tutoring-and-education-businesses/)
- **TutorCruncher.**
  - [pricing](https://tutorcruncher.com/pricing/)
  - [cancelling lessons](https://help.tutorcruncher.com/en/articles/14183040-cancelling-lessons)
  - [enquiry forms](https://help.tutorcruncher.com/en/articles/8255801-socket-for-basic-client-enquiry-forms)
  - [Bobbin](https://tutorcruncher.com/blog/introducing-bobbin)
- **Oases.**
  - [features](https://oasesonline.com/features/)
  - [progress reports](https://oasesonline.com/features/tutoring-schedule/student-progress-report/)
- **Wise:** [wise.live](https://www.wise.live/)
- **Jackrabbit.**
  - [pricing](https://www.jackrabbitclass.com/pricing/)
  - [parent experience](https://www.jackrabbitclass.com/features/parent-family-experience/)
  - [skills tracking](https://www.jackrabbitclass.com/features/student-skills-tracking/)
- **TutorOcean:** [product page](https://corp.tutorocean.com/tutoring-management-software/)
- **Pencil Spaces:** [pricing](https://www.pencilspaces.com/pricing)
- **Lessonspace:** [pricing](https://www.thelessonspace.com/pricing)

**Learning centres.**
- **Mathnasium:** [myMathnasium announcement](https://www.prnewswire.com/news-releases/mathnasium-expands-the-learning-experience-with-new-mathnasium-plus-enrichment-program-and-digital-parent-portal-302884125.html)
- **Kumon:** [Kumon Connect](https://www.franchise.org/2024/03/kumon-connect-brings-even-more-personalization-to-learning/)
- **RSM:** [parent handbook](https://static.russianschool.com/media/ParentHandbook.pdf)
- **Sylvan:** [Insight assessment](https://www.sylvanlearning.com/free-learning-resources/the-sylvan-insight-assessment-turning-your-childs-education-from-unknown-to-known/)
- **AoPS Academy:** [Morrisville campus](https://morrisville.aopsacademy.org/)

**Maths learning products.**
- **Beast Academy.**
  - [parent reporting](https://help.beastacademy.com/a/1793720-parent-reporting-overview)
  - [placement tests](https://beastacademy.com/resources/placementtests)
- **AoPS.**
  - [Alcumus](https://artofproblemsolving.com/blog/articles/alcumus-a-peek-under-the-hood-of-our-adaptive-learning-tool)
  - [Prealgebra 1 diagnostic](https://data.artofproblemsolving.com/course-docs/diagnostics/prealgebra1-pretest.pdf)
- **Khan Academy.**
  - [mastery levels](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
  - [API removal](https://support.khanacademy.org/hc/en-us/community/posts/360055082872-API-removal-notice)
- **IXL.**
  - [SmartScore](https://www.ixl.com/help-center/article/1272663/how_does_the_smartscore_work)
  - [analytics export](https://www.ixl.com/analytics/export)
- **Math Academy:** [how it works](https://www.mathacademy.com/how-it-works)
- **Mathspace:** [pre-tests](https://blog.mathspace.co/introducing-pre-tests/)
- **Zearn:** [Boosts](https://help.zearn.org/hc/en-us/articles/1500003390061-Boosts)
- **Thinkster:** [how it works](https://hellothinkster.com/get/how-our-math-tutor-app-works/)
- **Desmos:** [API](https://www.desmos.com/api)

**Research.**
- [Mastery learning meta-analysis](https://journals.sagepub.com/doi/10.3102/00346543060002265)
- [IES practice guide](https://ies.ed.gov/ncee/wwc/practiceguide/1)
- [Interleaving RCT](https://www.researchgate.net/publication/333154174_A_Randomized_Controlled_Trial_of_Interleaved_Mathematics_Practice)
- [ASSISTments homework RCT](https://journals.sagepub.com/doi/full/10.1177/2332858416673968)
- [Tutoring effect sizes](https://www.nber.org/papers/w27476)
- [Tutor CoPilot RCT](https://arxiv.org/abs/2410.03017)
- [Bayesian Knowledge Tracing](http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/893CorbettAnderson1995.pdf)
- [Hint ladders](https://arxiv.org/html/2404.02213v1)

**Copyright and reusable content.**
- [AoPS terms](https://artofproblemsolving.com/company/tos)
- [17 U.S.C. §102](https://www.law.cornell.edu/uscode/text/17/102)
- [OpenStax Prealgebra 2e](https://openstax.org/details/books/prealgebra-2e)

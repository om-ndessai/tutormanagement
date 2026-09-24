# Canvas gap analysis

Part 2 of the enhancement roadmap (see [README.md](README.md)). How the portal compares with
Instructure's Canvas LMS, and a staged plan for reaching feature compatibility with it. Canvas
was checked on 24 September 2026; sources are at the end.

---

## What "compatibility with Canvas" should mean here

It can mean two different things, and the plan treats them separately.

1. **Parity.** The portal can do, for the institute's own teaching, the things Canvas does for
   a school: assignments, grading, quizzes, messaging, a parent app.
2. **Interoperability.** The portal can exchange data with the Canvas that each student's
   *school* runs. For example, a tutor can see that Sofia has a fractions test on Thursday, and
   a worksheet built in the portal can be opened in Canvas.

For a tutoring institute, the second is worth more per unit of effort than the first. Canvas is
built for schools of thousands; much of it (Blueprint courses, SIS imports, moderated grading)
answers problems a 50-student institute does not have. The recommendation is to reach
**interoperability first**, then build **parity only where it serves one-to-one and
small-group tutoring**, and to consciously skip the rest.

---

## Canvas in 2026: what changed

- **Tiers.** Since April 2026 Canvas is sold in three tiers:
  - **Core:** every existing customer.
  - **Plus:** adds Studio video, Intelligent Insights, and AI grading and rubric tools.
  - **Next:** adds the IgniteAI Agent, "Ask Your Data" and study tools for learners.
- **A security incident, then a lockdown.** Attackers got in through Free-for-Teacher accounts
  in April–May 2026. Instructure then:
  - closed Free-for-Teacher
  - turned self-registration **off by default on every instance**, which also stops parent
    pairing codes working unless a school turns it back on
  - required multi-factor sign-in for admins
  - tightened OAuth
  - made students' personal access tokens expire within 30 days
- **Canvas Lite.** It replaces Free-for-Teacher from 30 September 2026: free, five courses,
  50 learners, and **no API access**.
- **The API documentation moved** to developerdocs.instructure.com.

The lockdown matters to this plan: routes into a school's Canvas that relied on self-service
by families (pairing codes, personal tokens) are narrower in 2026 than a year earlier.

---

## The capability map

Every major Canvas capability, what the portal has today, and what to do about it.

**Relevance** means relevance to a tutoring institute of this size:
- **H** — families or tutors would notice its absence
- **M** — useful
- **L** — rarely needed
- **—** — an answer to a problem the institute does not have

**Approach:**
- **Build** — parity in the portal
- **Link** — interoperate with the school's Canvas
- **Have** — already covered
- **Skip** — deliberately not built

### Structure and people

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Courses, terms, sections | One-to-one pairings and weekly slots; no courses | M | Build as *classes* for group teaching | S9 |
| Five base roles (teacher, TA, student, observer, designer), custom roles, detailed permissions | Admin, tutor, student, parent (parent ≈ observer, tutor ≈ teacher) | M | Build two staff roles | A4 |
| Admins "act as" a user; Student View | Admin "view as" on the dashboard only | M | Build "view as" on every page, read-only | C7 |
| Observer pairing codes | Guardianships set by an admin | L | Have: admin-managed suits a small institute, and Canvas's own codes now need self-registration, which is off by default | — |
| Differentiation Tags and "Assign To" (dates per student) | Everything is per student already | L | Have by design | — |
| Blueprint courses, Commons | — | — | Skip: districts sharing courses | — |
| SIS imports (CSV, OneRoster 1.1/1.2) | Users created one at a time | L | Build a CSV import of families instead | C8 |
| Course copy, templates, Common Cartridge import | — | L | Build with classes; export in C4 | S9, C4 |

### Content

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Modules: completion requirements, prerequisites, MasteryPaths | A plan's ordered topics; mastery at 4 drives the chart | H | Have the sequence. Build prerequisites (L13), and resources and homework on each topic | L13, L1, L2 |
| Pages (new Block Content Editor in early access) | — | L | Build only as resource descriptions | L2 |
| Files | — | H | Build | F2 |
| Rich Content Editor: LaTeX equation editor, accessibility checker | Plain text | M | Build maths rendering and input | F6 |
| Canvas Studio video (Plus tier) | — | L | Skip; stroke replay is the maths-specific equivalent | V3 |
| Student Notebook (July 2026) | — | L | Skip | — |

### Assessment and grading

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Assignments: text, file, media, student annotation, on paper; group assignments; peer review | — | H | Build as homework with photo submission; skip groups and peer review | L1 |
| New Quizzes: numeric and formula questions (variables, ± tolerance), item banks, accommodations | — | H | Build practice sets and an item bank with maths answer checking, including formula items | L3 |
| Placement and diagnostic quizzes | Assessment typed in by the assessor | M | Build | L4 |
| Gradebook: weighted groups, late and missing policies, grading schemes, posting policies | 1–5 topic ratings, no grades | M | Build a homework record (done / partly / not done, topic scores); skip weights and letter grades | L1 |
| SpeedGrader: document annotation, rubrics, audio and video comments, comment library | — | M | Build a review queue with annotation | C5 |
| Enhanced Rubrics (mandatory from 19 December 2026) | 1–5 goal and topic scales | M | Build rubrics for homework review | C5 |
| Outcomes, mastery scales, calculation methods, Learning Mastery Gradebook | Curriculum topics, 1–5 ratings, mastered at 4, a pace chart | H | **Have the model.** Build rating anchors and a mastery estimate, and the grid | L12, L9 |
| Moderated and anonymous grading, plagiarism checking | — | — | Skip | — |
| Mastery Connect (separate K-12 product) | — | — | Skip | — |

### Communication and calendar

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Announcements | — | M | Build | M2 |
| Inbox (conversations) | Comments on records | H | Build messaging with guardian-visible threads | M1 |
| Discussions (redesigned, with AI summaries and translation) | Comments | L | Skip unless group classes need it | — |
| Notification preferences, email and push | — | H | Build | F3, F5 |
| Calendar with a private feed per user | Weekly slots, upcoming lessons, one-off `.ics` downloads | H | Build subscription feeds and changes to single dates | S1, S6 |
| Scheduler (appointment slots) | — | M | Build assessment booking | G2 |
| Conferences (BigBlueButton; free-tier recordings expire after 7 days) | Meeting links pasted as text | M | Build | S7, V1 |
| Collaborations, groups | — | L | Skip | — |
| Roll Call attendance | Only lessons that happened are recorded | H | Build | S1 |

### Parents and mobile

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Canvas Parent app: grades, assignments, events, reminders | Parent dashboard in a responsive web app | H | Build an installable app with push | F5 |
| Parent alerts on grade thresholds, missing work, announcements | — | H | Build alerts on the notification centre | C6 |
| Observers see grades and due dates, not quizzes or the class list | Parents see their own children only (R7) | — | Have | — |
| Canvas Student and Teacher apps | Responsive web app | M | Build: the same installable app | F5 |

### Analytics, data and platform

| Canvas | Portal today | Relevance | Approach | Plan |
| --- | --- | --- | --- | --- |
| Course and Admin Analytics, student context cards | Dashboards, progress page | M | Build | A1, L9 |
| Intelligent Insights (Plus): students needing attention | — | M | Build at-risk and stalled-topic alerts | G6, L14 |
| Canvas Data 2, Live Events (webhook or SQS, Caliper 1.1) | CSV exports | L | Build outbound webhooks only for a real consumer | C9 |
| REST and GraphQL APIs, OAuth2 developer keys | Private JSON API | L | Skip a public API until there is a consumer | — |
| LTI 1.1 and 1.3 Advantage, Dynamic Registration | — | L | Link, only with a partner school | C3 |
| Sign-in: SAML, OIDC, Google, Microsoft, Apple, Clever and more | Google only | H | Build emailed sign-in links, then Apple and Microsoft | F12 |
| Accessibility: Instructure claims WCAG 2.2 AA (New Quizzes 2.1, aiming for 2.2) | Tokens, keyboard-friendly components, no audit | M | Build an audit aiming at WCAG 2.2 AA | Q1 |
| AI by tier (Core, Plus, Next) | — | M | Build on the portal's own terms | [below](#how-canvass-ai-compares) |
| Portfolios (ePortfolios and Portfolium end December 2026), badges, Catalog, Canvas Career | — | L | Build a light Catalog as public class registration; skip the rest | S9, G1 |

### The parity scorecard

Of the 45 capabilities in the tables above:

| Status | Count | Meaning |
| --- | --- | --- |
| **Have** | 5 | Already equivalent, or the portal's design makes it unnecessary |
| **Build** | 31 | Planned, in [feature-plans.md](feature-plans.md) or below |
| **Link** | 1 | Interoperate with the school's Canvas instead |
| **Skip** | 8 | Deliberately not built: they serve districts, not a tutoring institute |

**Reaching practical parity.** It means building the **31**. They are listed in the staged plan
below; most are already planned for their own sake.

---

## Interoperability: connecting to a student's school Canvas

A private tutoring portal has five technical routes into a student's school Canvas, and one
manual one: the parent simply tells the tutor. The 2026 lockdown narrowed most of the technical
routes.

| Route | Who has to act | What it gives | Barriers | Verdict |
| --- | --- | --- | --- | --- |
| **The student's calendar feed** | The student or parent copies the private feed URL from Canvas's Calendar | Every due date and event in all their courses: 366 days ahead, 30 days back, up to 1,000 items | No grades, submission status or to-do items. The URL works like a password. | **Use it** (C1) |
| **Parent reports grades** | The parent types or photographs results | Whatever the parent chooses to share | Manual | **Use it** (C2) |
| **OAuth2 developer key** | The school's Canvas admin issues a key; each family then authorises it | Everything that user can see: courses, assignments, submissions, scores, comments | One key per school, and each school must approve and sign a data agreement. No New Quizzes responses. | Only with a partner school (C3) |
| **LTI 1.3 tool** | The school's admin installs the tool | Identity, course and roster at launch; grades only for items the tool itself created | Every school must vet and install it; a private business is rarely approved | Only with a partner school (C3) |
| **Personal access tokens** | The user generates one | Full API access as that user | Asking users to generate tokens for an app **breaks the Canvas API Policy**. Schools can block them, and students' tokens expire within 30 days. | **Never** |
| **Observer / Parent app** | A parent enters the student's pairing code | Grades, due dates, alerts inside Canvas's own app | Needs self-registration, off by default since May 2026. The app has no export. | Parents use it alongside the portal |

**What realistically works.**
- **Many schools at once.** Use the student's own calendar feed for school deadlines, with
  grades reported by the parent.
- **With a partner school.** A deeper connection is possible if a school agrees to partner:
  an LTI tool plus a scoped API key, under a signed data agreement.

### C1 · School calendar import

**Why.** A tutor planning Thursday's lesson wants to know that the school has a fractions test
on Friday. Today they find out afterwards. Canvas's per-user calendar feed carries every due
date for every course. So do Google Calendar's secret iCal addresses, which Google Classroom
uses, and most other school systems.

**Build.**
- **Adding a feed.** A guardian or the student pastes their school calendar feed URL on the
  student's record.
- **How it runs.**
  - **Fetching.** A job (F4) fetches it daily; a fetch is network time, not CPU.
  - **Filtering.** It keeps the next three weeks.
  - **Tagging.** Maths events are tagged by course name and by keywords set per family: test,
    quiz, unit.
- **Where it shows.**
  - "School this week" in the lesson cockpit (L6) and on the student's progress page.
  - An office view of which students have tests coming.

**Data.**
- `school_feeds`: student, URL encrypted at rest, added_by, last_fetched, last_error.
- `school_events`: student, feed, title, course, due_at, kind, fetched_at.

**Guard rails.**
- **The URL is a secret.** It is stored encrypted with a Worker secret, never shown back in
  full, and deletable by the family.
- **Who sees the events.** The student's progress audience (`studentScopeSql`).
- **Consent.** Importing is the family's own action, so the family's consent (F7) is the
  basis, and the notice mentions it.
- **Crawl.** The exposure crawl covers the new read route.

**Needs.** F4, F7. **Size.** S.

### C2 · School results, by hand

**Why.** How a student does at school is the ultimate measure of the tutoring. The
observer app shows grades, but offers no export. A parent reporting "82 on the fractions test",
or photographing the graded test, closes the loop.

**Build.**
- **What gets recorded.** A guardian or tutor records a school result: date, course, the
  topics it covered (catalog topics), a score, and optionally a photo (F2).
- **Where it shows.** Results appear on the progress timeline as a second series of markers, so
  tutoring and school results can be read together.

**Data.** `school_results` (student, recorded_by, taken_on, course, score, out_of, note, file).

**Guard rails.** The same audience as progress.

**Needs.** None; F2 for photos. **Size.** S.

### C3 · A deeper connection for a partner school

**Why.** If the institute partners with a school, for example as its math-support provider,
both routes a school controls open up:
- an LTI 1.3 tool inside that school's Canvas (tutors launch the portal from a course, and
  rosters come across)
- an OAuth2 developer key that lets each family authorise the portal to read their child's
  assignments and grades

**Build, only when a partner exists.**
- **LTI.** An LTI 1.3 tool with Dynamic Registration and Names and Roles.
- **The developer key.** OAuth2 with the school's developer key, reading courses, assignments
  and scores for students whose families authorise it.

**Certification is optional.** 1EdTech membership is required to certify an LTI tool. Its dues
are quoted by size, and certifications appear to lapse and need re-testing. Canvas does not
require certification; it mostly helps in school procurement.

**Guard rails.**
- **FERPA applies.** Under a school contract the institute becomes a "school official", with
  use limits and a five-year bar for improper disclosure. NC's G.S. 115C-401.2 also applies:
  no ads, no profiling, and deletion within 45 days of the school's request. A written data
  agreement comes first.
- **Hard to undo.** This is the largest compliance step in the whole roadmap. Worth it only for
  a real partnership.

**Needs.** F7, F10, legal review. **Size.** L.

### C4 · Export to Canvas: Common Cartridge and QTI

**Why.** A worksheet set or practice quiz built in the portal (L2, L3) could be useful to a
partner school, or to a homeschooling family on Canvas. Canvas imports Common Cartridge (1.1
to 1.3) and QTI 1.2 and 2.x quizzes, and exports CC 1.1 with QTI 1.2. A small tool can generate
both.

**Build.**
- **The export.** A practice set or resource collection exports as a `.imscc` zip: a manifest,
  HTML pages, files and QTI 1.2 items (numeric and multiple choice).
- **Checking it.** Tested on a school's beta instance. New Quizzes does not run on Canvas's
  own test environment.

**Guard rails.**
- **Answers.** The export contains answers, so only admins and tutors can export.
- **Copyright.** Only the institute's own items are exportable (L3's rules).

**Needs.** L2 or L3. **Size.** M.

---

## Parity plans that exist only because of Canvas

Most parity is already planned in [feature-plans.md](feature-plans.md): homework (L1),
practice (L3), messaging (M1) and so on. These are the Canvas-inspired features that have no
other home.

### C5 · Review queue with annotation and rubrics

**Why.** SpeedGrader is the part of Canvas teachers praise most. It puts every submission in
one queue: open the next one, annotate it, score it against a rubric, leave a comment, move on.
Once homework has photo submissions (L1), tutors need the same thing, or review happens in a
photo viewer and the scores never reach the progress chart.

**Build.**
- **The queue.** A "To review" queue for each tutor: submitted homework, oldest first.
- **Reviewing.** Each item opens beside its photos. The tutor can:
  - draw on the image: a simple pen layer (perfect-freehand), saved separately so the
    original is never altered. The whiteboard (V2) later reuses the same pen code.
  - score each practised topic 1–5
  - pick rubric lines: "shows working", "correct method", "arithmetic slip"
  - comment
- **After saving.** Scores flow into topic ratings exactly as lesson scores do. The family
  sees the annotated work and the comment.

**Later.** AI first drafts of scores and comments
([future-ai.md](future-ai.md#ai-1--automated-homework-evaluation)).

**Data.**
- `rubrics` and `rubric_lines`, per level or institute-wide.
- `homework_reviews` from L1 gains `rubric_line_ids` and an annotation file (F2).

**Guard rails.**
- The audience of an annotated image is the homework's audience.
- The queue is the tutor's own students only.

**Needs.** L1, F2. **Size.** M.

### C6 · Parent alerts

**Why.** The Canvas Parent app's most-used feature is alerts. A parent chooses thresholds,
such as a missing assignment or a grade below a mark, and is told when one is crossed.
This portal has the signals and no way to raise them.

**Build.**
- **Choosing alerts.** A guardian picks alerts per child:
  - homework missing past its due date (L1)
  - a lesson cancelled or moved (S1)
  - the plan falls behind pace
  - a new report (L5)
  - a balance older than 30 days (Finance)
- **Delivery.** Through the notification centre (F3) and push (F5).

**Guard rails.** Each alert is computed from the guardian's own scoped reads. Money alerts are
Finance-kind notifications and never appear on a Tutoring surface.

**Needs.** F3; the alert kinds need their features (L1, S1, L5). **Size.** S.

### C7 · "View as" everywhere

**Why.** Canvas's Student View lets staff see exactly what a student sees, which is how support
questions get answered. The portal's "view as" covers the dashboard only (Phase 8).

**Build.**
- **Where it works.** An admin can "view as" a person across every page, read-only.
- **How it's enforced.** The API runs each read as that person, and refuses every write while
  impersonating.
- **The banner.** A banner shows who is being viewed and how to stop.

**Guard rails.**
- **Every read is scoped as the person being viewed.** This is the whole point, and the reason
  the exposure crawl should run once more through "view as" to prove it matches the
  person's own view.
- **Audit.** An audit event is recorded when viewing starts and stops.

**Needs.** None. **Size.** M.

### C8 · Bulk import of families

**Why.** Canvas loads people from a school's student information system. The institute's
equivalent is its starting roster: families in a spreadsheet, typed in one at a time today.

**Build.**
- **The file.** A CSV upload with one row per student and their guardian or guardians.
- **Checking.** Every row is validated with the same shared schemas as the create-user
  request, so the guardian and email rules hold. Errors are shown per row before anything is
  saved.
- **Saving.** Each valid row becomes one create request, so each student is created with
  their parent, as today.

**Guard rails.**
- Admin-only.
- One audit event per person created, exactly as if typed.

**Needs.** None. **Size.** S.

### C9 · Outbound webhooks

**Why.** Canvas publishes events (Live Events) so other systems can react. Only worth building
once there is a consumer, such as Zapier or a school partner.

**Build.**
- **Registering a URL.** An admin registers a URL and picks events: lesson recorded, payment
  recorded, plan created.
- **What is sent.** A signed JSON body carrying ids and kinds only, never names, notes or
  amounts. The receiver fetches details with its own credentials.
- **Reliability.** Deliveries are retried through the job queue (F4).

**Needs.** F4. **Size.** S.

---

## How Canvas's AI compares

| Canvas tier | Canvas AI features | Portal's equivalent |
| --- | --- | --- |
| Core | Discussion summaries, search, translation, help writing quiz questions, accessibility fixes | Translation M4; question drafting AI-4 |
| Plus | Rubric generator, grading assistance, discussion insights | Homework evaluation AI-1; review queue C5 |
| Next | IgniteAI Agent (launched March 2026, built on Amazon Bedrock), Ask Your Data, study tools | Ask the portal AI-8; study helper AI-9 |

The portal's AI plans go further in the maths-specific places Canvas does not reach:
- line-by-line checking of handwritten steps (AI-7)
- a readiness forecast against a learning plan (AI-5)
- a pre-lesson brief for a one-to-one tutor (AI-12)

---

## The staged plan to compatibility

Each stage is useful on its own, and each builds on the one before.

| Stage | Goal | Builds | Canvas equivalent reached |
| --- | --- | --- | --- |
| **1. Speak Canvas** | The portal knows what school is asking of each student, and families can reach it like any modern school system | C1 school calendar import · C2 school results · F12 sign-in links · F3 notifications · F5 installable app · C6 parent alerts | Calendar feeds, the Parent app and its alerts |
| **2. The core of an LMS for tutoring** | Work between lessons is set, done, reviewed and visible | L1 homework · C5 review queue and rubrics · L2 library · L3 practice and item bank · F6 maths input · M1 messaging · M2 announcements · L9 mastery grid · L12 anchors | Assignments, SpeedGrader, rubrics, New Quizzes, Inbox, Announcements, Learning Mastery Gradebook |
| **3. Depth** | Diagnostics, groups and the operator's view | L4 diagnostics · L13 prerequisites (MasteryPaths-like) · S9 classes · G2 booking · S1 attendance · A1 analytics · C7 view-as · C8 bulk import · Q1 accessibility | Placement quizzes, MasteryPaths, courses and sections, Scheduler, Roll Call, Analytics, Student View, SIS import |
| **4. Ecosystem, only with a reason** | Exchange data with schools and tools | C4 Common Cartridge and QTI export · C3 partner-school connection · C9 webhooks | Common Cartridge, LTI 1.3, Live Events |

**Deliberately never built.**
- Blueprint courses and Commons.
- OneRoster.
- Moderated, anonymous and peer grading.
- Plagiarism checking.
- ePortfolios.
- Studio video.
- A general public API.
- A full custom-permission matrix.

Each is an answer to running a school district, and each would add weight to every feature
the institute does need.

---

## Sources

- **Instructure Community.**
  - [Tier feature comparison](https://community.instructure.com/en/kb/articles/664412-canvas-tier-feature-comparison)
  - [Classic vs New Quizzes](https://community.instructure.com/en/kb/articles/658474-classic-quizzes-vs-new-quizzes-feature-comparison)
  - [New Quizzes FAQ](https://community.instructure.com/en/kb/articles/664245-faq-new-quizzes)
  - [Calendar feed](https://community.instructure.com/en/kb/articles/662804-how-do-i-view-the-calendar-ical-feed-to-import-and-subscribe-to-an-external-calendar)
  - [Observer visibility](https://community.instructure.com/en/kb/articles/387091-observer-visibility-and-participation)
  - [Pairing codes](https://community.instructure.com/en/kb/articles/388738-pairing-codes-faq)
  - [Canvas Parent](https://community.instructure.com/en/kb/articles/662786-what-is-the-canvas-parent-app)
  - [May 2026 incident change log](https://community.instructure.com/en/discussion/666044/incident-change-log-for-may-2026)
  - [Access-token changes](https://community.instructure.com/en/discussion/660299/strengthening-security-in-canvas-updates-to-user-access-token-management)
  - [Enhanced Rubrics](https://community.instructure.com/en/discussion/664713/enhanced-rubrics-feature-overview)
- **Developer documentation.**
  - [OAuth2](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth)
  - [Developer keys](https://canvas.instructure.com/doc/api/file.developer_keys.html)
  - [LTI](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.tools_intro)
  - [SIS imports](https://developerdocs.instructure.com/services/canvas/resources/sis_imports)
  - [Content migrations](https://canvas.instructure.com/doc/api/content_migrations.html)
  - [Authentication providers](https://canvas.instructure.com/doc/api/authentication_providers.html)
  - [Live Events](https://canvas.instructure.com/doc/api/file.data_service_introduction.html)
- **Instructure announcements.**
  - [Canvas tiers](https://www.prnewswire.com/news-releases/instructure-introduces-simplified-canvas-tiers-and-ecosystem-updates-at-new--next-showcase-302748373.html)
  - [IgniteAI Agent](https://www.instructure.com/press-release/instructure-delivers-its-agentic-ai-promise-launch-igniteai-agent)
  - [Incident update](https://www.instructure.com/incident_update)
- **1EdTech.**
  - [LTI certification](https://www.1edtech.org/certification/lti)
  - [Canvas certifications](https://site.imsglobal.org/certifications/instructure/canvas)

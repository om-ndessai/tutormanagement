# Enhancement roadmap

An industry audit of the portal, written on 2026-09-24 after Phases 1–19 and 21 were built.
Nothing here is scheduled. Features are chosen by ID and become phases in
[`docs/plan.md`](../plan.md), which stays the authoritative roadmap.

| Part | What it answers |
| --- | --- |
| [feature-plans.md](feature-plans.md) | What comparable products do that this portal does not, and a build plan for each: 72 features, each with an ID |
| [canvas-gap-analysis.md](canvas-gap-analysis.md) | How the portal compares with Canvas, capability by capability, and a staged plan for compatibility with it: 9 more features (C1–C9) |
| [future-ai.md](future-ai.md) | Automated homework evaluation, live handwriting recognition, and 10 other AI features, with architectures, costs, safeguards, and what running them on Cloudflare takes |

---

## How to use this

1. **Pick.** Read the catalog below. Each row links to its plan. Mark the features you want.
2. **Check what each needs.** Several features stand on a foundation (F1–F12). Choosing
   homework (L1), for example, means building file storage (F2) too, or accepting a thinner
   first version.
3. **Order them into phases.** Write each chosen feature, or a group of small ones, into
   `docs/plan.md` as a phase, in your own words, the way Phases 1–21 were written. The plan
   here is the starting point for that phase, not a replacement for it.

The **Suggested wave** column is one reasonable order: cheapest-and-most-useful first, then
foundations, then the features that need them. It is a starting point for your choices, not a
decision.

---

## Where the portal stands (September 2026)

**Built.** Everything a small tutoring institute needs to *record and account for* one-to-one
tutoring:
- **People.** Google sign-in, and a people model where one person can hold several roles.
- **Lessons.** Pairings with per-pair pay rates. Lessons recorded by hand or by live timer,
  priced on quarter hours with a separate family price and tutor pay.
- **Weekly slots.** Standing weekly slots, with calendar files and an "upcoming" carousel.
- **Money.** A payments ledger, balances, tutor advances and 1099s.
- **Progress.** Curriculum-based assessments, learning plans and per-lesson progress with a
  pace chart.
- **Record-keeping.** Comments, a full audit log, and dashboards split into Tutoring and
  Finance.
- **Enforced rules.** Rules on who sees what (R1–R9) are enforced and crawled by
  `exposure.spec.ts`.

**What the audit found missing, in one line each.** Most gaps fall in four places:

1. **Between lessons.** No homework, practice, resources or reports. The portal records
   lessons but does not help with the week in between.
2. **Money that moves by itself.** No online payment, invoices, autopay or pay runs. Every
   payment is typed in by hand.
3. **Reaching people.** No email, reminders, messaging, notifications or mobile app, beyond
   the planned Phase 20.
4. **The edges of the schedule.** No cancellations, make-ups, attendance, family requests,
   closures or calendar feeds.

**Relative to industry.**
- **Strengths.** The portal leads in four places:
  - **Tax and advances.** No product reviewed generates 1099s or manages tutor advances.
  - **Progress.** Only Oases and the franchise chains tie an assessment to a curriculum-based
    plan and per-lesson scores, as Phase 16 does.
  - **Data protection.** Written, crawled rules on who sees what, which none of the products
    reviewed publishes.
  - **Price and pay.** The separation of what families pay from what tutors are paid.
- **Behind.** It is behind them on operations, meaning payments, reminders and scheduling.
- **Far behind.** It is well behind maths learning platforms on anything a student does
  between lessons.

---

## The catalog

**For:**
- O — the office
- T — tutors
- F — families
- S — students

**Value:** H — high, M — medium, L — low. **Size:** S, M, L, XL, as defined in
[feature-plans.md](feature-plans.md#how-each-plan-is-written).

**Suggested wave:**
1. quick wins on today's data
2. run the business in the portal
3. learning between lessons
4. practice, groups and growth

V is vision.

### Foundations

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [F1](feature-plans.md#f1--students-who-have-no-email-can-still-take-part) | Students who have no email can still take part | S F | H | M | F7 | 3 |
| [F2](feature-plans.md#f2--files-uploads-and-downloads) | Files: uploads and downloads | O T F | H | M | — | 3 |
| [F3](feature-plans.md#f3--notification-centre) | Notification centre | all | H | M | Phase 20 | 2 |
| [F4](feature-plans.md#f4--background-jobs) | Background jobs | O | M | S–M | — | 2 |
| [F5](feature-plans.md#f5--installable-app-and-push-notifications) | Installable app and push notifications | T F | H | M | F3 | 2 |
| [F6](feature-plans.md#f6--maths-in-text-rendering-and-input) | Maths in text: rendering and input | T F S | M | S | — | 1 |
| [F7](feature-plans.md#f7--consent-and-privacy-centre) | Consent and privacy centre | O F | H | M | — | 3 |
| [F8](feature-plans.md#f8--self-service-profile-editing) | Self-service profile editing | T F | M | M | — | 2 |
| [F9](feature-plans.md#f9--institute-settings) | Institute settings | O | M | S | — | 1 |
| [F10](feature-plans.md#f10--backups-monitoring-and-hardening) | Backups, monitoring and hardening | O | H | S | — | 1 |
| [F11](feature-plans.md#f11--ai-platform-layer) | AI platform layer | O | M | M | F4 (F7 for child data) | 3 |
| [F12](feature-plans.md#f12--more-ways-to-sign-in) | More ways to sign in | F | H | S | Phase 20 | 2 |

### Scheduling and attendance

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [S1](feature-plans.md#s1--cancellations-reschedules-make-ups-and-attendance) | Cancellations, reschedules, make-ups and attendance | O T F | H | M | F9 | 2 |
| [S2](feature-plans.md#s2--lesson-reminders) | Lesson reminders | T F | H | S | F3, F4, S1 | 2 |
| [S3](feature-plans.md#s3--scheduling-assistant) | Scheduling assistant | O T | M | S | — | 1 |
| [S4](feature-plans.md#s4--family-requests-change-cancel-extra-lesson) | Family requests: change, cancel, extra lesson | F O | M | M | S1, F3 | 2 |
| [S5](feature-plans.md#s5--closures-and-holidays) | Closures and holidays | O | M | S | S1 | 2 |
| [S6](feature-plans.md#s6--calendar-subscription-feeds-then-two-way-sync) | Calendar subscription feeds, then two-way sync | T F | M | S | S1 | 2 |
| [S7](feature-plans.md#s7--meeting-links-for-virtual-lessons) | Meeting links for virtual lessons | T F | M | S | — | 1 |
| [S8](feature-plans.md#s8--rooms-and-resources) | Rooms and resources | O | L | S | S3 | 4 |
| [S9](feature-plans.md#s9--group-classes-camps-and-competition-circles) | Group classes, camps and competition circles | O F | H | L | S1 | 4 |

### Billing and payments

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [B1](feature-plans.md#b1--online-payments-card-and-bank-transfer) | Online payments (card and bank transfer) | O F | H | M | — | 2 |
| [B2](feature-plans.md#b2--monthly-statements-and-invoices) | Monthly statements and invoices | O F | H | M | F3, F4 (B1 for the pay link) | 2 |
| [B3](feature-plans.md#b3--autopay-and-payment-reminders) | Autopay and payment reminders | O F | M | M | B1, B2 | 3 |
| [B4](feature-plans.md#b4--lesson-packages-and-prepaid-credit) | Lesson packages and prepaid credit | O F | M | M | — (B1 helps) | 4 |
| [B5](feature-plans.md#b5--discounts-sibling-pricing-and-scholarships) | Discounts, sibling pricing and scholarships | O F | L | S | — | 1 |
| [B6](feature-plans.md#b6--tutor-pay-runs-and-pay-statements) | Tutor pay runs and pay statements | O T | M | M | — | 2 |
| [B7](feature-plans.md#b7--accounting-export) | Accounting export | O | M | S | — | 1 |
| [B8](feature-plans.md#b8--1099-electronic-filing) | 1099 electronic filing | O | L | S | — | 4 |
| [B9](feature-plans.md#b9--adjustments-credits-and-refunds) | Adjustments, credits and refunds | O | M | S | — | 1 |

### Enrollment and growth

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [G1](feature-plans.md#g1--enquiry-form-and-lead-pipeline) | Enquiry form and lead pipeline | O | H | M | — | 2 |
| [G2](feature-plans.md#g2--assessment-booking-and-onboarding-checklist) | Assessment booking and onboarding checklist | O F | M | M | G1, G3 | 4 |
| [G3](feature-plans.md#g3--policies-and-e-signature-acknowledgements) | Policies and e-signature acknowledgements | O F | M | S | — | 1 |
| [G4](feature-plans.md#g4--surveys-nps-and-reviews) | Surveys, NPS and reviews | O | M | S | F3 | 4 |
| [G5](feature-plans.md#g5--referral-programme) | Referral programme | O | L | S | G1, B9 | 4 |
| [G6](feature-plans.md#g6--at-risk-students-and-re-enrolment) | At-risk students and re-enrolment | O | M | S | — (S1 helps) | 1 |

### Communication

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [M1](feature-plans.md#m1--messaging-with-safeguarding-built-in) | Messaging, with safeguarding built in | T F | H | M | F3 | 3 |
| [M2](feature-plans.md#m2--announcements) | Announcements | O F | M | S | F3 | 2 |
| [M3](feature-plans.md#m3--weekly-family-digest) | Weekly family digest | F | H | S | F3, F4 | 2 |
| [M4](feature-plans.md#m4--translation-for-families) | Translation for families | F | L | S | F7, F11 | V |

### Tutor workforce

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [T1](feature-plans.md#t1--tutor-onboarding-and-compliance-records) | Tutor onboarding and compliance records | O | H | S | — | 1 |
| [T2](feature-plans.md#t2--tutor-self-service-availability-and-time-off) | Tutor self-service: availability and time off | T | M | S | F8, S1 | 3 |
| [T3](feature-plans.md#t3--tutorstudent-matching) | Tutor–student matching | O | M | S | S3 | 4 |
| [T4](feature-plans.md#t4--tutor-insight-load-retention-and-progress) | Tutor insight: load, retention and progress | O T | M | S | — (S1, G4 help) | 1 |
| [T5](feature-plans.md#t5--substitute-cover) | Substitute cover | O | L | M | S1, S3, F3 | 4 |

### Administration and data

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](feature-plans.md#a1--business-analytics) | Business analytics | O | H | M | — (S1, B-series enrich) | 2 |
| [A2](feature-plans.md#a2--reports-and-exports) | Reports and exports | O | M | S | — | 1 |
| [A3](feature-plans.md#a3--data-retention-and-deletion) | Data retention and deletion | O F | H | M | F7, F4 | 3 |
| [A4](feature-plans.md#a4--staff-roles-front-desk-and-bookkeeper) | Staff roles: front desk and bookkeeper | O | M | L | — | 4 |
| [A5](feature-plans.md#a5--audit-review-and-alerts) | Audit review and alerts | O | M | S | F3 | 2 |
| [A6](feature-plans.md#a6--a-second-location) | A second location | O | L | M | S8, F9 | V |

### Quality

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [Q1](feature-plans.md#q1--accessibility-audit-wcag-22-aa) | Accessibility audit (WCAG 2.2 AA) | all | M | S | — | 1 |
| [Q2](feature-plans.md#q2--languages-in-the-interface) | Languages in the interface | F | L | M | — | V |
| [Q3](feature-plans.md#q3--performance-budget) | Performance budget | all | M | S | — | 1 |

### Teaching and learning

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [L1](feature-plans.md#l1--homework-set-submit-review) | Homework: set, submit, review | T F S | H | M | — (F1, F2 for student uploads) | 3 |
| [L2](feature-plans.md#l2--resource-library-mapped-to-the-curriculum) | Resource library mapped to the curriculum | T | M | S | F2 | 3 |
| [L3](feature-plans.md#l3--practice-sets-with-automatic-checking) | Practice sets with automatic checking | S T | H | L | F1, F6 | 4 |
| [L4](feature-plans.md#l4--diagnostic-placement-test) | Diagnostic placement test | O T | M | M | L3 | 4 |
| [L5](feature-plans.md#l5--progress-reports-and-report-cards) | Progress reports and report cards | F | H | M | F3 | 3 |
| [L6](feature-plans.md#l6--the-lesson-cockpit) | The lesson cockpit | T | H | M | — (L1 helps) | 2 |
| [L7](feature-plans.md#l7--structured-lesson-notes-and-templates) | Structured lesson notes and templates | T F | M | S | — | 1 |
| [L8](feature-plans.md#l8--spaced-review-of-mastered-topics) | Spaced review of mastered topics | T S | M | S | — (L3 helps) | 3 |
| [L9](feature-plans.md#l9--class-wide-mastery-heatmap) | Class-wide mastery heatmap | O T | M | S | — | 1 |
| [L10](feature-plans.md#l10--bringing-in-outside-learning-platforms) | Bringing in outside learning platforms | T | L | S | — | 4 |
| [L11](feature-plans.md#l11--a-students-own-space) | A student's own space | S | M | S | F1 | 3 |
| [L12](feature-plans.md#l12--rating-anchors-and-evidence-weighted-mastery) | Rating anchors and evidence-weighted mastery | T | M | S | — (L1 or L3 for the estimate) | 1 |
| [L13](feature-plans.md#l13--prerequisite-map) | Prerequisite map | T O | M | M | — | 2 |
| [L14](feature-plans.md#l14--stalled-topic-alerts) | Stalled-topic alerts | T O | M | S | — (F3 to notify) | 1 |
| [L15](feature-plans.md#l15--interactive-graphing-and-geometry) | Interactive graphing and geometry | T S | L | S | L6 | 4 |

### Live online lessons

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [V1](feature-plans.md#v1--the-lesson-room-video-in-the-portal) | The lesson room: video in the portal | T S | M | L | L6, F1, F7 | V |
| [V2](feature-plans.md#v2--shared-whiteboard-with-handwriting) | Shared whiteboard with handwriting | T S | M | L | F1, F2 | V |
| [V3](feature-plans.md#v3--replay-how-the-student-solved-it) | Replay: how the student solved it | T F | L | M | V2 | V |

### Canvas compatibility

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [C1](canvas-gap-analysis.md#c1--school-calendar-import) | School calendar import | T F | H | S | F4, F7 | 3 |
| [C2](canvas-gap-analysis.md#c2--school-results-by-hand) | School results, by hand | T F | M | S | — (F2 for photos) | 1 |
| [C3](canvas-gap-analysis.md#c3--a-deeper-connection-for-a-partner-school) | A deeper connection for a partner school | O | L | L | F7, F10 | V |
| [C4](canvas-gap-analysis.md#c4--export-to-canvas-common-cartridge-and-qti) | Export to Canvas: Common Cartridge and QTI | O T | L | M | L2, L3 | 4 |
| [C5](canvas-gap-analysis.md#c5--review-queue-with-annotation-and-rubrics) | Review queue with annotation and rubrics | T | H | M | L1, F2 | 3 |
| [C6](canvas-gap-analysis.md#c6--parent-alerts) | Parent alerts | F | H | S | F3 (more alerts with L1, S1, L5) | 2 |
| [C7](canvas-gap-analysis.md#c7--view-as-everywhere) | "View as" everywhere | O | M | M | — | 2 |
| [C8](canvas-gap-analysis.md#c8--bulk-import-of-families) | Bulk import of families | O | M | S | — | 1 |
| [C9](canvas-gap-analysis.md#c9--outbound-webhooks) | Outbound webhooks | O | L | S | F4 | V |

### AI and handwriting

| ID | Feature | For | Value | Size | Needs | Suggested wave |
| --- | --- | --- | --- | --- | --- | --- |
| [AI-1](future-ai.md#ai-1--automated-homework-evaluation) | Automated homework evaluation | T F | H | XL | F1, F2, F4, F7, F11, L1, C5 | V |
| [AI-2](future-ai.md#ai-2--lesson-notes-assistant) | Lesson-notes assistant | T | H | M | F11, L7, L6 | 3 |
| [AI-3](future-ai.md#ai-3--family-digests-and-progress-narratives) | Family digests and progress narratives | F T | M | S | M3, L5, F11 | 3 |
| [AI-4](future-ai.md#ai-4--adaptive-practice-and-generated-problems) | Adaptive practice and generated problems | S T | M | L | L3, F11 | 4 |
| [AI-5](future-ai.md#ai-5--goal-readiness-forecast-no-ai-provider) | Goal-readiness forecast (no AI provider) | F O | H | S | — | 1 |
| [AI-6](future-ai.md#ai-6--misconception-tagging) | Misconception tagging | T | M | M | — (L3 or AI-1 to suggest) | 3 |
| [AI-7](future-ai.md#ai-7--live-handwriting-recognition-while-solving) | Live handwriting recognition while solving | S T | M | XL | F1, F7, V2, F2 | V |
| [AI-8](future-ai.md#ai-8--ask-the-portal) | "Ask the portal" | O | M | M | F11 | 4 |
| [AI-9](future-ai.md#ai-9--a-study-helper-between-lessons) | A study helper between lessons | S | L | L | F1, F7, F11, L1, L3, M1 | V |
| [AI-10](future-ai.md#ai-10--smarter-operations-no-ai-provider) | Smarter operations (no AI provider) | O | M | M | S3 or G6 | 4 |
| [AI-11](future-ai.md#ai-11--explain-your-thinking-recordings) | Explain-your-thinking recordings | S T | L | L | AI-7, F2, F7, F11 | V |
| [AI-12](future-ai.md#ai-12--pre-lesson-brief) | Pre-lesson brief | T | H | S | L6, L7, L1, L8, L14, AI-6 | 3 |


### What each wave achieves

| Wave | Theme | Features | What the institute gets |
| --- | --- | --- | --- |
| 1 | Quick wins on today's data | 22 | Mostly small, and no new infrastructure. It uses data the portal already holds but does nothing with: availability, ratings, `last_rated_on`. It adds backups, compliance records for tutors, maths rendering, and a forecast of each student's finish date. |
| 2 | Run the business in the portal | 22 | Email and notifications (after Phase 20), attendance and cancellations, reminders, statements and online payment, enquiries, messages to families, the lesson cockpit, an installable app. This is where the table-stakes gap closes. |
| 3 | Learning between lessons | 19 | Consent, student sign-in and files, then homework, reports, review of mastered topics, messaging, the school calendar, and the first tutor-facing AI: the pre-lesson brief, dictated notes, drafted digests. |
| 4 | Practice, groups and growth | 18 | Practice sets and diagnostics, group classes, packages, onboarding, matching, staff roles, adaptive practice. |
| V | Vision | 12 | Video lessons and the whiteboard, automated homework evaluation, live handwriting recognition, the student study helper, partner-school connections. |

---

## Decisions to make first

A few choices shape many plans at once. Settling them before picking features saves rework.

1. **Online payments.** Phase 5 set the rule that "no actual payments will be made through the
   portal". B1 reverses that, and B3 and B4 build on it.
   - **For.** Money arriving by itself, and the end of reconciling Zelle payments by hand.
   - **Against.** About 3% in card fees (under 1% by bank transfer), and a card-security
     self-assessment, the lightest level.
2. **The $5 a month plan.** Most features fit Cloudflare's free plan. The recommendation is to
   move to Workers Paid when the first AI or student-facing feature ships. That is less for
   the extra capacity than because, on the free plan, a busy day stops the portal until
   midnight UTC ([details](future-ai.md#running-it-on-cloudflare)).
3. **Students signing in.** Letting children sign in (F1) is what every student-facing feature
   needs, and it is also what brings the amended COPPA rule fully into play: verifiable
   parental consent, a published notice, a retention policy and a written security programme
   (F7). Deciding yes means building F7 first, and a lawyer's read of the consent wording.
4. **Which AI providers, if any.** Vendors' terms differ sharply for children's data:
   - Google's Gemini API forbids it.
   - OpenAI requires approved zero retention.
   - Anthropic allows it with safeguards.
   - Cloudflare's own models keep it inside Cloudflare.

   The plans assume only allowlisted providers, and a tutor's approval before anything reaches
   a family ([governance](future-ai.md#ai-governance)).
5. **Schools.** Working with each student's school through their calendar feed (C1) needs
   nothing from the school. A deeper Canvas connection (C3) needs a school to partner, and turns
   the institute into a FERPA "school official". It is worth pursuing only if such a
   partnership is wanted for its own sake.

---

## If you choose only a few

Ten picks with the most value for the effort, and why:

| Pick | Why this one |
| --- | --- |
| **S1** Attendance, cancellations and make-ups (with F9) | It is table stakes on every platform surveyed. It also fixes a real inaccuracy: the progress page counts a cancelled lesson as a missed one. |
| **S2** Reminders (with F3, F4, after Phase 20) | The cheapest way to cut no-shows; seven of the eight platforms surveyed have it. |
| **B2** Statements, then **B1** online payment | Families get a document and a pay button. The office stops chasing and reconciling. |
| **L6** The lesson cockpit, with **L7** structured notes | The screen tutors actually use during a lesson. It is money-free by construction, answering the Phase 19 concern for good. |
| **L1** Homework | The main thing that happens between lessons, and the thing parents most want to see. Homework with feedback has randomised-trial evidence behind it. |
| **L5** Progress reports and **M3** the weekly digest | They make the portal's strongest asset, curriculum-linked progress, visible to the people paying for it. |
| **F5** Installable app with push | Parents read on phones. An installable web app gets most of a native app's benefit at a fraction of the cost. |
| **G1** Enquiries and leads | Six of the eight platforms have it, and today conversion isn't measured at all. |
| **AI-12** Pre-lesson brief, with **AI-2** dictated notes | The best-evidenced AI in tutoring, and it touches no child's own work. |
| **F10** Backups and monitoring | Real family records have been in production since 21 September 2026. Weekly automatic backups cost nothing. |

---

## How this was researched

On 24 September 2026, five parallel research passes read vendor and product pages, academic
papers, Cloudflare's documentation and the relevant law:
1. tutoring business platforms
2. maths learning products and AI tutoring tools
3. Canvas
4. handwriting recognition and automated grading
5. Cloudflare's limits and compliance

Every figure in these documents comes from one of those sources, which are listed at the end
of each part. A few could not be confirmed and are flagged where they are used:
- some vendor prices
- Teachworks' lack of a native app
- MyScript's current pricing
- recognition latency, which no vendor publishes

Estimates marked as such (video data per lesson, PDFs per day) are the researchers', not the
vendors'. Nothing here is legal advice: the compliance notes summarise the law as published,
for a lawyer to confirm.

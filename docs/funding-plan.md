# Funding plan: the NC Idea Challenge follow-on (up to $10,000)

Written 2026-10-04. This is a plan, not a schedule: a feature named here is built only once
it is written into [`plan.md`](plan.md) as a phase.

Figures marked (u) were seen only in a search snippet. Re-check them before quoting them to
anyone.

---

## Context

The portal's idea won a $1,000 prize in the 2026 NC Idea Challenge. The next step is the
optional follow-on of up to $10,000. This plan says how to pursue it, using what comparable
tutoring businesses and software vendors do well.

### The funder

Read on 2026-10-04 from ideachallengenc.org (home, FAQ, terms, student, educator and winners
pages) and exponentialscholars.org.

- **Who.** Exponential Scholars, a North Carolina nonprofit. Its line is "Talent is everywhere.
  Opportunity is not." It serves "bright young people across North Carolina — especially in
  communities that get overlooked."
- **The challenge.** NC students in grades 5–12 and NC educators answer one question in a
  1–2 minute video: "what's your idea to help your community?" Entries are individual.
- **How it is judged.** Two judges score community impact ("is the need real, specific, and
  grounded in a community you actually know?"), feasibility ("are there logical first steps")
  and authenticity. They do not score polish, and the rules say "the thinking must be yours."
- **The $1,000.** "No strings attached."
- **The follow-on.** "Up to $10,000 more (optional)" if the winner develops "an implementation
  or testing plan" with the organisers and both sides agree on targets. The terms call it
  "$10,000 additional for demonstrated progress."
- **Tax.** Prizes are taxable. From $2,000 a Form W-9 is required and a 1099-MISC follows. A
  minor's cheque is payable to a parent or guardian.

**What is not published:** the format and deadline of the follow-on, how the amount is set,
whether it is paid up front or on progress, what it may be spent on, and what must be reported.
The winners page shows 215 winners and $215,000 awarded. The stated pool is $500,000 for up to
500 winners, which the $1,000 prizes alone would use, so the follow-on is probably selective.
That last point is an inference.

### What this means

This is not a venture pitch. The funder is buying community impact and demonstrated progress,
told in the entrant's own voice. Revenue and market size matter only as evidence that the idea
keeps running after the money is spent.

### Assumptions and unknowns

- **Assumed, from the owner on 2026-10-04:** the portal is offered as a product other tutoring
  programmes can use; production serves under 10 families; there is one part-time builder;
  nothing is written for the follow-on yet.
- **Unknown:** whether the entry was on the student or the educator track, what the winning
  video said, and what the judges wrote back. The follow-on plan has to grow from that video.

---

## What the research found

Three research passes and one technical design pass ran on 2026-10-04.

### Why local tutoring businesses win families

| Mechanism | Evidence in the Triangle |
| --- | --- |
| Recurring billing by default | Best Brains Morrisville bills $149–399 a month and Mathnasium a flat monthly membership (u). AoPS Morrisville charges $729 per trimester automatically, and the family must give notice to stop. |
| A diagnostic opens the funnel | RSM offers a free evaluation and Mathnasium a free assessment (u). Best Brains and Kumon (u) take bookings online. |
| Progress visibility is now a product | Mathnasium launched its myMathnasium parent portal on 22 September 2026: session summaries, progress reports, messages, billing. Kumon Connect shows the score and time per worksheet (u). |
| Solicited reviews | Mathnasium Chapel Hill has a steady stream of 9–10 scores through a review engine. |
| Density where the children are | 12 Mathnasium and 7+ Kumon centres found across the Triangle (u). RSM and AoPS sit in Cary and Morrisville. |

**The access gap this shows.** The tools that let a parent see progress sit inside programmes
that cost roughly $150–450 a month (national estimates for Kumon and Mathnasium, u) or $729 a
trimester. A small independent or volunteer programme has none of them.

**The institute's own position**, from its FAQ:

- A 2-hour assessment with the parent present and a written report. This is stronger than the
  chains' free assessment, but it can be booked only by email or contact form.
- Tuition in three instalments, collected by hand. An internal scholarship, and enrolment as an
  ESA+ provider.
- **It teaches weekly 2-hour group classes as well as tutoring.** The portal models one tutor
  with one student only, so it does not yet cover the institute's own main format.
- **Its Canvas access is gone.** Instructure suspended Free-for-Teacher accounts after a May
  2026 breach, and homework cannot be submitted "until our platform is established". This is
  the origin story: an independent centre on a borrowed tool lost it.

### Why software vendors win tutoring businesses

| Mechanism | Evidence |
| --- | --- |
| Self-serve trial, no card | TutorBird 30 days, Teachworks 3 weeks, TutorCruncher 2 weeks. |
| Tiny entry price that grows with use | Per tutor, per lesson or per student, from about $17 a month. |
| Review-site dominance | Capterra: TutorBird 4.8 from 268 reviews, TutorCruncher 4.6 from 246. |
| Money runs through the product | Autopay, Stripe and QuickBooks sync create the switching cost. |
| Migration done for the customer | Jackrabbit imports free; Wise promises "live in 2–3 days". |
| One codebase, several verticals | Jackrabbit, based in Huntersville, NC, serves "more than 15,000 locations" across dance, gym, swim and music. |

Their customers complain about limited reporting and no real app (TutorBird), nowhere to
record grades or scores (Teachworks), and per-lesson fees eating margin (TutorCruncher). No
review asked for 1099s, margin tracking or privacy controls, so those three strengths of this
portal are unproven as reasons to switch.

### The market

- 9,820 US tutoring establishments in 2023 (Census County Business Patterns), 87% with under
  20 staff. North Carolina has 267, of which 141 have under 5 staff.
- At incumbent prices ($50–100 a month) that is $6–12M a year of software spend.
- At $20–50 a month and about 6% monthly churn, a customer is worth $330–820. Acquiring an
  education-software customer through paid channels costs about $806. This is why vendors grow
  through trials, reviews and referrals, and why this portal should too.
- No count of free or volunteer tutoring programmes in NC was found. Finding them is a
  discovery task.

### What moves acquisition and retention

| Lever | Best evidence | Strength |
| --- | --- | --- |
| Weekly messages to parents | Three randomised school trials. In one, with students who had failed a course, one-sentence weekly messages cut failure to earn credit from 15.8% to 9.3% | Strong |
| Lesson reminders | A Cochrane review of healthcare trials found text reminders raise attendance, on low-to-moderate quality evidence. The quoted 67.8% to 78.6% is (u) | Good, by proxy |
| Fast reply to an enquiry | Replying within the hour made firms about 7 times likelier to qualify the lead | Moderate |
| Asking families for reviews | 47% of consumers avoid a business with under 20 reviews (2026 survey) | Moderate |
| Autopay | Fewer late payments; the retention claim is vendor-only | Moderate |
| Referral credit | Referred customers were at least 16% more valuable, and stayed longer, at a German bank | Moderate, by proxy |
| Mobile app, forecast, prepaid packages | Little or none found | Weak |

No independent benchmark exists for tutoring churn, lifetime value or referral share. Measure
the portal's own figures and report them.

---

## The case to make

Judges scored community impact, feasibility and authenticity. The follow-on plan should answer
the same three.

**The need.** Small tutoring programmes run on email, spreadsheets and payment apps, and
parents cannot see whether the lessons are working. The institute lost its own platform in May
2026. The chains now sell progress visibility as a feature, at prices many families cannot pay.

**The idea.** The portal follows a student from assessment to plan to each lesson's score to a
pace chart, with a parent's view of it. It is built and in use. The follow-on puts it in the
hands of other tutoring programmes.

**Recommended: pitch reach, not revenue.**

- Offer the portal free to free and volunteer-run programmes. It costs about $2.60 a month per
  programme to run, and a programme that charges nothing can set its rates to zero.
- Paid centres can pay later; that is what keeps it running, and it is not this funder's
  concern.
- The reason: Chapel Hill is not an overlooked community (median household income $85,989;
  77% of adults hold a bachelor's degree), and overlooked communities are who this funder serves. A plan
  that stops at the institute is weaker than one that reaches programmes whose families cannot
  pay Mathnasium's prices.

This is a recommendation. It only works if it is true to the idea in the winning video.

**Feasibility.** The portal has 25 phases built, 23 end-to-end specs and an open demo. The
design pass puts a second programme live within 4 weeks of part-time work.

**Authenticity.** The plan and anything said to the organisers must be the entrant's own
thinking and words, above all on the student track. This document supplies evidence and
structure.

**Gaps to state plainly:**

| Gap | What to say |
| --- | --- |
| Under 10 families, one institute | The follow-on is what takes it to other programmes. |
| Group classes are not modelled | Start with one-to-one programmes; classes come only if pilots need them. |
| One part-time builder | The build order below fits 8–10 hours a week. |
| No other programme has been asked yet | Conversations first (step 3 below), and their answers set the targets. |
| Children's records from other organisations | Terms and a data agreement come before any are loaded; the budget pays for them. |

### Targets to propose (draft)

The numbers are placeholders. Set them after the discovery conversations.

| By | Target | Measure |
| --- | --- | --- |
| Week 4 | A second programme is live | Set up by script, with its own database and name |
| Week 11 | Every family with an email gets a weekly progress message and a reminder before each lesson | Messages sent and opened |
| Week 26 | Five programmes use the portal, at least two of them free or volunteer-run | Weekly active tutors |
| Week 26 | 100 students have a tracked learning plan | Students with a plan and scored lessons |
| Week 26 | A results report and a public guide to adopting the portal | Attendance before and after reminders; what the programmes said |

### Draft budget

| Item | Amount |
| --- | --- |
| Legal review: terms, privacy notice and data agreement for children's records | $2,500 |
| Builder's time | $2,500 |
| Security review | $1,500 |
| Setting up and training pilot programmes (travel, materials, importing rosters) | $1,500 |
| Spanish for the parent-facing screens and messages | $1,000 |
| Hosting, email and a domain for 12 months, up to ten programmes | $500 |
| Contingency | $500 |
| **Total** | **$10,000** |

Hosting for ten programmes is about $26 a month: Cloudflare's paid plan $5, email $20,
domain $1.

---

## Features that improve acquisition and retention

IDs are from [`roadmap/`](roadmap/README.md).

### For a programme's families

| Rank | Feature | Stage | Why | Size |
| --- | --- | --- | --- | --- |
| 1 | Emailed lesson notes and weekly digest (Phase 20, M3) | Retention | Strongest evidence; the notes and pace data already exist | S–M |
| 2 | Lesson reminders (S2) | Retention | Reminders raise attendance in healthcare trials; the cron already runs | S |
| 3 | Printable progress report (L5) | Retention | Makes the portal's best asset visible to the parent | S |
| 4 | Enquiry form with an instant alert (G1) | Acquisition | Speed of reply; conversion becomes measurable | M |
| 5 | Review request to every family at a fixed milestone (G4) | Acquisition | Review count and recency are thresholds; Google forbids asking only happy customers | S |
| 6 | Online assessment booking, with the report in the portal (G2) | Activation | The chains book online; the institute books by email | M |
| 7 | Online payment and autopay (B1–B3) | Revenue | Every vendor and chain has it; reverses the Phase 5 rule | M each |
| 8 | Referral credit (G5), at-risk flags (G6) | Referral, retention | Cheap, on data already held | S each |
| 9 | Group classes (S9) | Acquisition | Most centres, including the institute, teach classes | L |
| 10 | Installable app (F5), goal forecast (AI-5) | Engagement | Little evidence | M, S |

### For a programme to adopt the portal

| Rank | Feature | Stage | Why |
| --- | --- | --- | --- |
| 1 | Setting up a new programme by script | Acquisition | Nothing else matters without it |
| 2 | Programme settings (F9): own name and colours first; time zone and curriculum later | Acquisition | Brand ids are a fixed list in `packages/shared/src/brand.ts` |
| 3 | Bulk import of families (C8), done for the programme | Acquisition | Every growing vendor migrates for free |
| 4 | Sign-in by emailed link (F12) | Activation | Google-only sign-in shuts out some parents |
| 5 | A public page, the open demo and an adoption guide | Acquisition | How vendors are found |
| 6 | Business analytics (A1), accounting export (B7) | Retention | "Reporting is limited" is TutorBird's top complaint |
| 7 | Backups and monitoring (F10), consent centre (F7) | Trust | Children's records |

### For families the chains do not serve

No evidence was gathered for these. They follow from the funder's focus.

| Feature | Why |
| --- | --- |
| Sign-in by emailed link (F12) | A parent without a Google account can still see progress |
| Spanish for parents (Q2, M4) | Parent-facing screens and messages |
| Installable app (F5) | Families who use a phone as their only computer |

### Build order for the follow-on period

From the technical design pass. The budget is 8–10 hours a week for 26 weeks: 208–260 hours.

**One deployment per programme, on Cloudflare's $5-a-month paid plan.**

- No query changes. Each programme's data sits in its own database, as the demo's already
  does (`env.test` in `apps/api/wrangler.jsonc`).
- The free plan stops before ten programmes: 5 cron triggers and 10 databases per account, and
  the daily request cap is shared, so one busy programme would stop all of them.
- At about 50 programmes, move to one Worker that picks the database by hostname.
- A shared database with a programme column is 60–100 hours with nothing a pilot can see, and
  every missed filter would leak another organisation's children's records. Not in this period.

| Weeks | Work | Outcome |
| --- | --- | --- |
| 1–4 | Set-up script, name and colours from configuration, weekly backups (F10) | Second programme live |
| 5–7 | Family import (C8); email sender and lesson notes (Phase 20) | Roster imported, first notes sent |
| 8–11 | Reminders (S2), weekly digest (M3) | Weekly parent messages running |
| 12–14 | Sign-in by emailed link (F12) | Parents without Google accounts get in |
| 15–18 | Enquiry form and alert (G1); printable progress report (L5) | Enquiries captured |
| 19–21 | Review request (G4) | Programmes 4–6 set up |
| 22–26 | Reserve, about 40 hours | Set-up at 3–5 hours a programme; results gathered |

What the design pass found:

- **Time zone and curriculum can wait.** NC programmes share the zone and can use the Beast
  Academy and AoPS ladder as it stands.
- **Two features need a rule change from the owner.** The emailed sign-in link amends "an
  identity comes only from Google". Group classes override "a family price has no override".
- **Group classes are large.** The tutor-student pair runs through six tables and 22 queries.
  If two pilots need classes, the stopgap is recording one lesson per student in a loop.
- **The import is two requests per family,** parent first, through the existing
  `POST /api/users`. It needs no new route or table.

Not in this period: online payments, a shared database, full group classes, calendar
invitations, text messages, student sign-in, an editable curriculum, self-serve billing.

---

## Next steps

1. **Ask the organisers** (hello@ideachallengenc.org) what is not published:
   - the format and deadline of the follow-on, and how the amount is decided;
   - whether money is paid up front or on progress, and what it may be spent on;
   - what they want reported, and who signs for a minor;
   - whether a tool built for a fee-charging institute qualifies.
2. **Re-watch the winning video and re-read the judges' feedback.** The plan must be the same
   idea, grown.
3. **Talk to 5–8 people who run tutoring programmes,** at least two of them free or
   volunteer-run: a school peer-tutoring club, a library, a community centre. Ask what they
   use today and what would make them switch.
4. **Count progress so far** from production: families, students, tutors, lessons, hours,
   lessons with notes and scores, reflections. Counts only, no names or amounts. This is a
   `--remote` command, so it needs the owner's go-ahead.
5. **Fix the demo's phone header.** `apps/web/src/components/layout/app-shell.tsx:137`
   hard-codes "TMI Portal" below the `lg` width, so the demo shows the institute's name on a
   phone. Use `brand.short`, typecheck, deploy to the demo only, then `npm run demo:reset`.
6. **Write the one-page plan,** targets and budget in the entrant's own words.
7. **Choose a name for the product.**

Three supporting documents can be prepared on request: the full research with every source, a
discovery interview script with a tracking table, and a short guide to adopting the portal.

---

## How to check this plan

- Every figure quoted to the organisers traces to a source below; anything marked (u) is
  re-fetched or dropped.
- The budget sums to $10,000.
- After the header fix, `npm run typecheck` is clean and the demo at 390px shows "CHMI Portal"
  with no trace of the institute's name.
- The targets were set from what programme leaders said, not from this draft.

---

## Sources

All read on 2026-10-04 unless dated.

**The funder**
- https://ideachallengenc.org/ and its `/faq`, `/terms`, `/students`, `/educators`, `/about`, `/winners` and `/parents` pages
- https://www.exponentialscholars.org/
- https://theurbannews.com/latest-news/2026/start-something-new/ (8 September 2026)

**Local tutoring businesses**
- https://trianglemathinstitute.com/faq
- https://www.prnewswire.com/news-releases/mathnasium-expands-the-learning-experience-with-new-mathnasium-plus-enrichment-program-and-digital-parent-portal-302884125.html (22 September 2026)
- https://aopsacademy.org/campus/morrisville/tuition?campus=morrisville
- https://bestbrains.com/morrisville
- https://mathschool.com/locations/west-cary
- https://app.listen360.com/organizations/1082005812248843355/reviews/public
- https://censusreporter.org/profiles/16000US3711800-chapel-hill-nc/

**Software vendors and the market**
- https://www.capterra.com/p/181623/TutorBird/reviews/
- https://www.capterra.com/p/145838/TutorCruncher/reviews/
- https://www.capterra.com/p/233485/Teachworks/reviews/
- https://www.jackrabbitclass.com/about/
- https://www.wise.live/
- https://www2.census.gov/programs-surveys/cbp/datasets/2023/ (`cbp23us.zip`, `cbp23st.zip`)
- https://chartmogul.com/blog/good-customer-churn-rate/ (February 2022)
- https://firstpagesage.com/marketing/average-cac-for-saas-businesses-by-industry-and-customer-type-fc/ (August 2025)

**Evidence**
- Kraft and Rogers 2015: https://ideas.repec.org/a/eee/ecoedu/v47y2015icp49-63.html
- Bergman and Chan 2021: https://ideas.repec.org/a/uwp/jhriss/v56y2021i1p125-158.html
- EEF Texting Parents 2016, via https://schoolsweek.co.uk/texting-parents-about-their-childs-homework-deadlines-boosts-maths-results-new-report-finds/
- Gurol-Urganci et al. 2013 (Cochrane): https://pubmed.ncbi.nlm.nih.gov/24310741/
- Oldroyd et al. 2011: https://hbr.org/2011/03/the-short-life-of-online-sales-leads
- BrightLocal 2026: https://www.brightlocal.com/research/local-consumer-review-survey/
- Schmitt, Skiera and Van den Bulte 2011: https://journals.sagepub.com/doi/abs/10.1509/jm.75.1.46
- Google's review policy: https://support.google.com/contributionpolicy/answer/7400114?hl=en

**Running it on Cloudflare**
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://resend.com/pricing

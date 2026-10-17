# Phase 37: a free online maths assessment, adaptive, that brings in families

Plan, written 2026-10-16. Owner's request: "For G1 I want to have a free online assessment. Any
student can take an adaptive test." Nothing here is built until the owner approves it. It joins
roadmap items G1 (enquiry form and lead pipeline) and L4 (diagnostic placement test)
(`docs/roadmap/feature-plans.md`), and takes its questions from Phase 36's bank
(`docs/ai-platform-plan.md`). **No AI runs during a test**: the engine is ordinary code, and every
question was approved by a person beforehand.

## What a family sees

1. A public page at the organization's own address, in its branding: "Free maths check-up, about
   20 minutes, grades 3 to 8 and Math 1". Any visitor, no account.
2. **The parent starts it**: their name and email, the child's first name and current grade, and
   one tick: the notice says what is collected, why, how long it is kept, and that answers are
   scored by the organization's own software and sent to nobody else. Cloudflare Turnstile (the
   free bot check) on this step.
3. **The child answers** one question at a time: multiple choice or a number, maths rendered
   properly, a progress bar, "I don't know" allowed (it counts as a miss, not a guess). It can be
   paused and resumed on the same device. No timer.
4. **The result, on screen at once**: for each strand (numbers and algebra, geometry and
   measurement, data, ratios), where the child is working, from "secure in grade 6" to "gaps from
   grade 4"; two or three strengths and two or three things to work on, by name; and "Book a free
   consultation". The same report sits at a private link for 30 days.
5. **The organization** sees a new lead with the result attached.

## Decisions for the owner

The owner has not answered these yet. My recommendations are written into the plan; strike any
that are wrong.

| # | Question | My recommendation |
| --- | --- | --- |
| 1 | Grades | **Grades 3-8 and Math 1, on NC 2026.** These are what local schools teach now. A grade opens on the page only once its questions are approved (Phase 36), so it can launch with, say, grades 4-6. |
| 2 | Who may take it | **Anyone**, per organization: off by default, and each organization's admins turn it on (Organization page). Turnstile, a limit of 3 tests per email a day and 20 per network a day, and a cap on tests per organization per day. |
| 3 | The family's report | **Strand level and named strengths and gaps**, on screen and at the private link. The topic-by-topic ratings go to the organization only: they are the start of the assessment, and the conversation they open is the consultation. |
| 4 | Emailing the report | **Not in the first version.** Today's email (Phase 32) can only reach addresses verified in Cloudflare on the free plan, so a parent's email would fail. The on-screen report and private link need no email. Emailing it waits for a sender: Workers Paid with a sending domain (Cloudflare Email Sending), or an outside provider as Phase 20 proposed. The organization is still told, in the portal, at once. |
| 5 | Organizations that teach Beast Academy only (the institute today) | The result and lead work for every organization. Turning a result into a **draft assessment** needs ratings on the organization's own curricula, so it is offered only where NC 2026 is on the list. The institute can add NC 2026 beside Beast Academy (still the default) on its Curricula card; otherwise its leads carry the report only. |
| 6 | Children's privacy | The design collects from a child only their answers, under a parent's notice and consent, kept by the organization, processed by no third party. That fits COPPA's "email plus" consent for internal use. **Confirm with counsel before turning it on** (not legal advice). Result and answers are deleted after 12 months unless the family enrols. |

## How it adapts

The NC 2026 standards fall into the same few strands every year from grade 3 to 8 (Algebraic and
Numerical Reasoning; Spatial, Geometric and Measurement Reasoning; Reasoning with Data; and Ratio
and Proportional Reasoning in grades 6-7). Math 1's domains map onto them. The test runs a
**staircase per strand**:

- It starts at the child's stated grade, with an on-grade question from a standard in that strand.
- Two right at a grade: step up a grade. Two wrong: step down. One of each: a third question
  decides.
- A strand stops when it has a pass at one grade and a fail at the next (its working level), or
  hits the floor (below grade 3) or the ceiling (Math 1), or after 8 questions.
- Questions are chosen at random among approved ones for an untested standard at that grade, never
  the same standard twice in a row and never one the child has seen.
- About 25-30 questions in all, 20-25 minutes.

**What it produces** (`scoreDiagnostic` in shared, a pure function with unit tests, and the same
code the server runs):
- **Per strand**: the working level, the highest grade passed.
- **Per standard tested**: a 1-5 rating on the portal's scale. Both right: 4. One of two: 3. None:
  2, or 1 if the standard is below the child's grade. Untested standards get no rating: silence is
  not a 1, as in Phase 16. It never gives a 5 ("mastered"), since two questions cannot show that.
- **A recommended level**: the grade of the weakest strand's first unsecured standard.

**Where the answers live.** The server holds the answers and chooses the next question. The browser
receives only the question shown (stem, choices) and sends back what was typed. Nothing in the page
reveals an answer, and a run is identified by an unguessable id.

## Leads (G1)

The organization's side, for admins only:

- **A Leads page** (menu item for admins; the app's More): each lead with the parent, the child's
  first name and grade, where it came from (`assessment` now; `enquiry` and `referral` later), its
  status (**New → Contacted → Consultation booked → Enrolled**, or **Lost** with a reason), notes,
  and the result.
- **The result view**: strand levels, the rated standards grouped by strand, every question asked
  with what was answered and whether it was right, and the time it took.
- **Enrol** opens the existing "add a student with their parent" form, prefilled from the lead,
  so the guardian rule and the audit stay where they are. On saving, if the organization offers NC
  2026, the existing assessment dialog opens prefilled with the ratings and recommended level as
  a draft. The assessor edits and saves it as their own; nothing is saved without them.
- **Told at once**: a new lead shows on the admins' dashboard Recent Activity and in a "New leads"
  count. Email to the admins follows Phase 32's switch, with no child's details in the message (R15).
- A lead is never a user, and the test creates none. Only an admin creates users, as now.

## Data

Additive only:
- **`leads`**: organization, parent name, email, phone (optional), child first name, grade, source,
  status, lost reason, notes, `converted_user_id`, `purge_after`, timestamps.
- **`diagnostic_runs`**: organization, lead, curriculum (`nc-2026`), start grade, status (`started`,
  `finished`, `abandoned`), the engine's state (JSON), the result (JSON: strands, ratings, level),
  `report_token` (the private link), started, finished, `ip_hash` (salted, for the limits).
- **`diagnostic_answers`**: run, sequence, question, what was answered, right or wrong, seconds.
- **`organizations.public_assessment`** (0/1, default 0), set by the organization's admins.
- `questions.times_used` and `times_correct` are updated as answers come in, for spotting a question
  that is too hard or broken.

Every root table carries `organization_id` and is scoped like the rest
(`scripts/check-org-scope.mjs`). Leads, runs and answers are admin-only reads: new rule **R17** in
`docs/data-exposure.md`, crawled by `exposure.spec.ts` as every non-admin. A daily purge in the
existing cron deletes leads, runs and answers past `purge_after` that never enrolled.

## Routes

**Public**, in `publicRoutes`, a deliberate decision as CLAUDE.md requires:
- `GET /api/public/assessment/config?org=` gives the organization's branding, whether the
  assessment is on, and which grades are open.
- `POST /api/public/assessment/start` takes the parent's details, consent and Turnstile token,
  creates the lead and run, and returns the run id and first question.
- `POST /api/public/assessment/:run/answer` grades the answer and returns the next question or the
  result.
- `GET /api/public/assessment/report/:token` is the private report.

They are rate-limited, check the organization has it on, and never return an answer, a solution, a
lead or another run.

**Admins:**
- `GET /api/leads`, `GET /api/leads/:id` (with the run).
- `PATCH /api/leads/:id` for status and notes.
- `POST /api/leads/:id/enrolled` records the student created. The student is still created through
  the existing users route.
- The switch is `PATCH /api/organization` (`public_assessment`).

**Audit** (`AUDIT_ACTIONS`, names only, never answers or ratings):
- `lead.created`: "A family started the online assessment (grade 5)". There is no human actor;
  `actor_name` is the organization's assessment page.
- `lead.updated`, `lead.enrolled`.
- `organization.assessment_toggled`.

## Clients
- **The test page** is web only, under the same Worker and SPA: `/assessment` (on `tmi-portal` it
  is the institute's; on `tutoring` it is `/assessment/<slug>`). It must work on a phone in a
  browser, since most parents will open it there (`responsive.spec.ts` covers it).
- **Leads**: web and the mobile app (list, detail, status and notes, Enrol), with the usual parity
  row and flows.
- **The switch**: on the Organization page and screen, web and app.

## Tests
- **Unit (shared)**: the staircase on scripted answer sequences (all right, all wrong, mixed, floor,
  ceiling, the 8-question cap); `scoreDiagnostic`'s ratings and level; no repeated question.
- **API (local)**:
  - A run end to end.
  - An answer never appears in any public response.
  - The organization switch is enforced.
  - The rate limits, a bad Turnstile token (the test key) and a finished run refusing answers.
  - The report token.
  - Leads are 404 to every non-admin and to another organization's admin.
  - The purge.
- **e2e (web)**:
  - A parent takes a short test on the fixture bank, at phone width, and sees the report.
  - An admin sees the lead, moves it along and enrols it.
  - The assessment dialog opens prefilled where NC 2026 is offered, and does not where it is not.
  - `exposure.spec.ts` and `exposure-organizations.spec.ts` gain leads.
- **Mobile flows**: `leads/list`, `leads/enrol`, `organization/assessment-switch`.
- `npm run smoke` on web, iOS and Android.

## Release
As CLAUDE.md lays out, after approval. On production the switch stays **off** for every
organization. It is turned on by the organization's admin once:
- the grades they want have approved questions (Phase 36);
- the Turnstile site key and secret are set, which is your job: one widget in the Cloudflare
  dashboard, `wrangler secret put TURNSTILE_SECRET`;
- counsel has looked at the notice (decision 6).

**Depends on**: Phase 36 (the bank). **Size**: M-L. **Running cost**: within the free tier for a
modest number of tests a day. Each answer is one small write, and a test is about 30 of them.
Workers Paid (Phase 36, decision 2) removes the risk of a busy day stopping the portal.

# Phases 38 and 39: the Assessment menu (beta), answers written on a canvas

Requested by the owner on 2026-10-18 as the first, smaller step towards the think-aloud canvas
([roadmap AI-13](roadmap/future-ai.md#ai-13--the-think-aloud-canvas)). The two phases:
- **Phase 38.** A student answers bank questions in their own handwriting, one question per page,
  with no feedback while they work. On submitting, the API writes a PDF of the questions and the
  handwriting for the tutor.
- **Phase 39.** The tutor also gets a second PDF, the same pages with an AI evaluation on each.

The PDFs live in D1 for now. They move to R2 later; one table holds them, so the move touches one
repository.

**Not to be confused with** two existing things:
- **The progress assessments** (`assessments`, the admin-written placement ratings). Hence the new
  tables are `canvas_assessments`.
- **Phase 37's public online assessment** (planned, not built), which brings in families. Its page
  is `/assessment` (singular), and this menu is `/assessments`.

## Phase 38: answers on a canvas, a PDF for the tutor

### What people see

- **The menu.**
  - **Placement.** "Assessment", with a **Beta** badge, after Progress.
  - **Who sees it.** Shown only while the organization has it on, for every role.
  - **The command palette.** It lists it the same way.
- **The switch.** "Assessment (beta)" on the Organization page, beside email notifications. Only
  the organization's admins see it. Off by default.
- **The Assessment page** (`/assessments`). It has two parts:
  1. **Start an assessment.**
     - **The student.** Anybody who may follow the student's progress may start one: the
       student themselves, a guardian, a tutor of theirs, or an admin. Someone who is only a
       student starts their own, with no picker.
     - **The grade.** The grades offered are those with approved questions.
     - **The questions.** It draws up to 10 approved questions of that grade at random, leaving
       out standards marked "needs a figure". The approved list grows as the bank is reviewed.
  2. **The list.** Assessments the reader may see, newest first: the student, the grade, the
     status (in progress, submitted, discarded), how many questions have writing, and the dates.
     The actions on each:
     - **Continue**: for whoever started it, while it is in progress.
     - **Discard**: the same.
     - **Open PDF**: for the student's tutors and the admins, once it is submitted.
- **Taking it** (`/assessments/:id`). One question per page.
  - **The question.** Its text, typeset as in the bank, with choices lettered A–D.
  - **The canvas.** Pen, eraser (it removes a whole stroke), undo and clear page.
    - **Input.** A pen, a finger or a mouse all work. Once a pen is used, touches are ignored,
      which gives palm rejection.
  - **Moving around.** Previous and Next, and numbered page buttons that show which pages have
    writing. A student can go back to any page and keep editing.
  - **No feedback.** Nothing is checked or marked while they work.
  - **Kept on the device as they go.** The work is saved in the browser, so a reload loses nothing.
    It never reaches the server until it is submitted.
  - **Submit, at any time.**
    - **Blank pages.** A confirmation says how many pages are blank.
    - **Afterwards.** The page goes back to the list.

### Added on 2026-10-18, at the owner's request

- **Both platforms.** Phase 38 is built in the web app and the mobile app alike. Parity is the
  default rule from now on (CLAUDE.md). The app's canvas uses `react-native-svg` and the gesture
  handler, so it needs no new native module.
- **Multiple-choice questions are answered by choosing.**
  - **The choice.** Lettered choices the student taps (tap again to take it back), with the canvas
    still there for working.
  - **On the wire.** The selected position travels with the page (`choice`).
  - **Marking.** Code marks it against the key (`checkAnswer`), never a model.
  - **In the PDF.** It rings the choice, prints "Selected: C", and says in the tutor's box whether
    the selection is correct.
  - **Who sees the score.** "X of Y choices correct" goes only to the student's tutors and the
    admins (R17).
- **The PDF is shown in the app, never downloaded.**
  - **How it is drawn.** pdf.js (`pdfjs-dist`) draws each page onto a canvas, on a review page
    (`/assessments/:id/review` on the web; a screen in the app, inside its WebView).
  - **Why not the browser's own viewer.** That works the same on an iPad's Safari and Android's
    Chrome, which do not show a PDF inside a page on their own.
  - **Download.** The web page keeps a Download link as a secondary action.
- **A trial with unreviewed questions.**
  - **The switch.** `organizations.canvas_assessments_unreviewed`, "Include questions not yet
    reviewed", is the organization admins' second switch on the same card. Off by default.
  - **What it draws.** While it is on, assessments draw on the bank's `checked` questions too,
    never `draft`, `flagged` or `retired`.
  - **Telling the tutor.** The grade picker says the grade "includes unreviewed". The tutor's PDF
    tags each such page "Not yet reviewed" and counts them on the cover.
  - **The cost.** Counting the bank then reads its checked questions (thousands of rows), so the
    grade list is fetched at most every few minutes.

### The PDF

Written by the Worker (`apps/api/src/lib/pdf.ts`), in US Letter.
- **The cover.**
  - The student, the grade, who started it, and when it was started and submitted.
  - Each question's skill, and whether it has writing.
- **One page per question.**
  - **The question.** Its text, with choices A–D.
  - **The working.** The student's handwriting, drawn as vector strokes scaled into the page:
    sharp at any zoom, and a few KB a page.
  - **For the tutor.** The answer and the bank's worked solution, in a box at the foot of the
    page.
- **Text.**
  - **Font.** Helvetica, one of the PDF's standard fonts, so nothing is embedded.
  - **Maths.** The bank's LaTeX is rewritten as plain text: `\frac{3}{4}` as 3/4, `\times` as ×,
    `\le` as <=, `x^{2}` as x^2. The typeset version stays on screen.
- **Size and speed.**
  - **Size.** A vector page keeps a 10-question PDF to roughly 50–200 KB, well under D1's 2 MB
    for a value.
  - **Speed.** Writing it takes a few milliseconds of CPU, inside the free plan's 10 ms.
  - **Compression.** Page contents are deflated with the Worker's built-in `CompressionStream`.

### Who sees what (R17, new in `docs/data-exposure.md`)

- **The list and an assessment's status.** They reach the student's audience, through
  `studentScopeSql`: the student, their guardians, their current tutors and the admins.
- **Who started it.** Named only to the student's current tutors, the admins and the person
  themselves.
- **The questions, while in progress.** Only the person who started it reads them. They are
  never sent with an answer or a solution.
- **The PDF.** Only the student's current tutors and the organization's admins, because it
  carries the answer key and the worked solution. For anyone else it is 404, like every row they
  cannot list. A student or guardian sees that it was submitted, not the PDF.
- **The log.** Says "started", "submitted (7 of 10 written)" or "discarded", and the grade. Never
  a question or anything written.

### Data (additive)

- **`organizations.canvas_assessments`.** 0/1, default 0. It travels on `Organization`, so the
  menu sees it, and on `OrganizationSettings`, so the admins can switch it.
- **`canvas_assessments`.** One row per attempt:
  - `organization_id`, `student_user_id`, `started_by_user_id`
  - `level_id`
  - `question_ids` (a JSON array, in order)
  - `status` (`in_progress`, `submitted`, `discarded`)
  - `questions_written`
  - `started_at`, `submitted_at`, `updated_at`

  The same-organization triggers apply to both people, and the organization can never change.
- **`canvas_assessment_files`.** `(assessment_id, kind)`, `organization_id`, `content_type`,
  `bytes` BLOB, `size`, `sha256`, `created_at`. The kinds:
  - `answers`: the PDF.
  - `strokes`: the deflated JSON the PDF was drawn from, which Phase 39 redraws.
  - `evaluated`: Phase 39's PDF.

  The blobs are kept out of `canvas_assessments`, so a list never reads them. The R2 move
  replaces `bytes` with a key here and nowhere else.
- **Storage budget.** D1's free plan allows 500 MB a database. At about 150 KB per submission, PDF
  and strokes together, that is a few thousand submissions before R2 is needed.

### Routes (`/api/canvas-assessments`, guarded, refused with 403 `feature_disabled` while the organization has it off)

| Route | Who | What |
| --- | --- | --- |
| `GET /levels` | anyone | The grades, with how many approved questions each could draw on |
| `GET /` | anyone | The visible assessments (R17), each with `can_review` and `can_continue` |
| `POST /` `{student_user_id, level_id}` | the student's audience | Starts one. 404 for a student they cannot see; 409 `no_questions` when the grade has none |
| `GET /:id` | its audience | The row; the questions (no answers) only for the person who started it, while in progress |
| `POST /:id/submit` `{pages}` | the person who started it, while in progress | Validates, writes the PDF and the strokes, marks it submitted, all in one batch |
| `POST /:id/discard` | the person who started it, or an admin, while in progress | Marks it discarded |
| `GET /:id/pdf` | the student's tutors and the admins | The PDF as a plain link (`?org=`), `Content-Disposition: inline` |

**The wire format for handwriting.**
- **A page.** `{ question_id, strokes: string[] }`.
- **A stroke.** One string of integers, "w x y x y …": its width, then its points, on a 1000 × 800
  canvas.
- **Why strings.** Zod checks a string's length cheaply, and a hand-written parser reads the
  numbers. Validating 20,000 points as arrays would cost the Worker more CPU than the free plan
  allows.
- **The caps** (shared `CANVAS_LIMITS`):
  - 600 strokes a page;
  - 20,000 numbers a page;
  - a body of at most 1 MB.

  The client simplifies strokes (Ramer–Douglas–Peucker) before sending.

**Audit actions.** `canvas_assessment.started`, `.submitted` and `.discarded`, as finished
sentences naming the student and the grade.

### Clients

- **Web.**
  - **The page** is `apps/web/src/features/canvas-assessments/`: the api hooks, the list and start
    card, the take page and the canvas component.
  - **The canvas** uses Pointer Events and needs no new dependency.
  - **The switch** is a card on the Organization page.
  - **On a phone** it works at phone width (`responsive.spec.ts`).
- **The mobile app.** The same feature, ported from the web: the menu with its Beta badge, the
  Organization screen's two switches, the list and start card, taking it (choices and the canvas),
  and the review screen with the PDF drawn by pdf.js in the WebView. Flows under
  `apps/mobile/.maestro/flows/canvas-assessments/`.

### Tests

- **Pure checks, in `canvas-assessments.spec.ts`.** `shared` has no unit runner, so they sit in the
  e2e spec: the stroke parser, its caps, and LaTeX to plain text (mixed numbers, ×, <=, °, square
  roots).
- **The PDF.** It is checked for its header, its `%%EOF`, a cross-reference table whose offsets
  point at their objects, and the page count (one per question, plus the cover).
- **e2e (web, `canvas-assessments.spec.ts`).**
  - **The switch.** Riverside's admin turns it on and off: the menu and its Beta badge appear and
    go, and the routes answer 403 while it is off.
  - **A full run.** An admin starts one for Sofia and writes on page 1, then page 2. Back on
    page 1 the writing is still there, and undo, the eraser and the pen all work. The work
    survives a reload. Then submit.
  - **The PDF.** Alex, her tutor, opens it. Sofia and Maria see the row as submitted, and the PDF
    is 404 for them.
  - **Starting.** Alex cannot start one for Sanjay, who is not his student (404). A grade with no
    approved questions answers 409, and an unknown grade 422.
  - **What the taker gets.** The questions carry no answers. Only the person who started it
    submits it.
  - **Bad pages.** A foreign question or a stroke off the page answers 422.
  - **Afterwards.** Discarding works, and a submitted assessment cannot be submitted or
    discarded again.
- **`exposure.spec.ts`.** Every non-admin reads `/api/canvas-assessments` against R7 and R17, and
  the PDF answers 200 only to Sofia's tutor.
- **`npm run smoke`** on web, iOS and Android.

### Release

As CLAUDE.md lays out, after the owner approves:
1. **Production SQL.** In `docs/database.md`, Phase 38: one `ALTER TABLE`, two tables, their
   indexes and triggers.
2. **The switch.** It stays off everywhere until an organization's admin turns it on.
3. **Children's privacy.** A student signing in and writing on the canvas is F7's "whiteboard"
   case. The owner should check the institute's consent forms cover it before turning it on for
   students under 13. Phase 38 sends nothing to any AI service.

## Phase 39: a second PDF, with an AI evaluation

**Delayed by the owner on 2026-10-18**: Phase 40 comes first.

### What the tutor gets

- **Two PDFs on a submitted assessment:**
  - **"Answers"**, from Phase 38.
  - **"Answers with AI evaluation"**: the same pages, each with a panel.
- **The panel on each page.**
  - What the model read as the final answer.
  - A verdict: correct, incorrect, partly, blank or unreadable.
  - Its confidence.
  - One or two sentences for the tutor about the working.
- **A summary page.** The score, and the questions to look at first.
- **A label on every panel.** "A draft for the tutor: check it before sharing."

### How it works

- **The task.** `canvas_assessment.evaluate`, registered in `AI_TASKS`.
  - `child_input: true`, because it reads the child's handwriting.
  - Model: Claude Sonnet 5.5 to start, with Haiku 5.5 once a measurement shows it reads the work
    as well.
- **What the model is sent.**
  - **A PDF made for it from the stored strokes.** It holds the questions and the working only:
    no names, no organization, no answers (AG2).
  - **Text with each question's key and worked solution.** Claude reads a PDF directly, page by
    page, as images and text. `runAi` gains a `document` part, its only change besides consent.
- **Code checks the model.** The reply must match a Zod schema: one entry per question, with
  limits on length. Where the final answer it read parses as a number or matches a choice,
  `checkAnswer` decides "correct" or "incorrect". A disagreement with the model is shown on the
  panel as "the code and the model disagree".
- **When it runs.**
  - **On submit.** Only if consent is on file and the task is on, after the response
    (`waitUntil`).
  - **By hand.** An "Evaluate with AI" button lets a tutor or admin run it, or run it again.
  - **Costs.** Caps and `ai_runs` as for every task. One evaluation is roughly 15–25k tokens in,
    a few cents with Sonnet.
- **Who reads it.** The evaluated PDF reaches the student's tutors and the admins only. That
  keeps "nothing a model writes reaches a family or a student without a person approving it",
  because the tutor decides what to tell them.

### The consent it needs (the part to decide)

`runAi` refuses every `child_input` task until parental consent exists (AG1; roadmap F7). Phase 39
therefore brings the smallest slice of F7 that this task needs:
- **A `consents` table.**
  - Its columns: organization, student, purpose (`ai_processing`), the guardian, `method`,
    `recorded_by`, `given_at`, `withdrawn_at`.
  - **Recording it.** An admin records a guardian's signed consent form (`method = 'signed_form'`).
    A signed form returned by mail or scan is one of the FTC's accepted methods.
  - **Withdrawing it.** A guardian can withdraw it in the portal, at any time.
- **What `runAi` checks.** A `child_input` task must name its student, and is refused
  (`refused_consent`, logged) unless that student has live `ai_processing` consent in that
  organization.
- **Decisions for the owner, worth checking with counsel:**
  1. Whether a guardian may also *give* consent in the portal, or only through a signed form.
  2. The wording of the consent and of the notice: Anthropic as the processor, no training, and
     its retention.
  3. How long the evaluated PDF and the strokes are kept.

### Tests

- **Unit.**
  - The evaluation schema.
  - The code's override of the verdict.
  - The model's PDF carries no name: the student's and guardians' names are absent from its
    bytes.
- **API, with the fake provider.**
  - Refused without consent, and the refusal is logged.
  - With consent, the evaluated PDF is stored and readable by the tutor; it is 404 for the
    student and the parent.
- **e2e.** An admin records consent, a submission is evaluated through the fake, and both PDFs
  open.

### Release

Production SQL in `docs/database.md`, Phase 39: `consents` and `canvas_assessment_files`'s third
kind (already in the CHECK from Phase 38). `ANTHROPIC_API_KEY` is already set on both production
Workers.

## Phase 40: the tutor reviews it online, and the organization sets its length

Requested by the owner on 2026-10-18, and queued until Phase 38 is fully released. It is built on
the web app and the mobile app alike.

The owner decided on 2026-10-18:
- **Everyone concerned sees the review**: the student, their parents, their tutors and the admins.
- **No scoring for now.** The tutor judges for themselves; scoring is a later phase.

### Reviewing online

- **Who writes a review.** The student's current tutors and the organization's admins.
- **Where.** "Review" on a submitted assessment, on the web and in the app.
- **The screen.** It shows the submitted PDF's pages (pdf.js, as Phase 38), with a review layer
  over them:
  - **A red pen.** For the tutor's marks anywhere on a page: ticks, crosses, circles,
    corrections. It has an eraser and undo.
  - **A note per question**, and **an overall comment**.
  - **No marks, points or score.** That comes later.
- **Drafts.** The review saves as a draft as it goes. Only its reviewers see a draft, and they can
  come back to it on another device.
- **"Save as reviewed".** It finishes the review:
  - **The reviewed PDF.** The Worker writes a third PDF: a first page with the overall comment,
    then each submitted page with the tutor's ink and note drawn over it.
  - **The status.** The assessment becomes `reviewed`, with who reviewed it and when.
  - **Changing it.** A reviewed assessment can be reopened, and saving again writes a new reviewed
    PDF.
- **Who reads the reviewed PDF.** The student's whole audience: the student, their guardians,
  their current tutors and the admins. They see it in the app or the portal, never as a download
  that leaves a copy behind. The submitted PDF stays the tutors' and admins' alone (R17).
- **The answer key is left out of the reviewed PDF.** The submitted PDF's "For the tutor" box
  (the answer and the worked solution) is the tutor's. The family's copy carries the tutor's own
  corrections instead, which keeps the bank's answers out of copies that travel further. Add the
  key back to it if the owner prefers.

### How "editing the PDF" works

The tutor's markings are kept as **data, not as edits to the PDF's bytes**.
- **The ink.** Stored in each page's own coordinates (612 × 792 points, the PDF's page), so a mark
  lands exactly where it was drawn on the rendered page.
- **Rebuilding.** The reviewed PDF is rebuilt from the stored handwriting (Phase 38's `strokes`
  file), the questions, and the review. The submitted PDF itself is never changed.
- **Why.** No PDF parser is needed in the Worker, and both PDFs always open and print.

### Data (additive)

- **`canvas_assessment_reviews`.** One row per assessment:
  - `organization_id`, `assessment_id`, `reviewer_user_id`
  - `notes` (JSON: a note per question)
  - `comment`
  - `ink` (deflated JSON per page)
  - `status` (`draft`, `final`)
  - `updated_at`, `finished_at`
- **`canvas_assessments.status`** gains `reviewed`; the table gains `reviewed_by_user_id` and
  `reviewed_at`.
- **`canvas_assessment_files`.** The `kind` gains `reviewed`.
- **`organizations.canvas_assessment_questions`.** The number of questions an assessment draws,
  1–25, default 10. It is set by the organization's admins on the same card, and applies to
  assessments started afterwards. The submit limit follows it, and 25 pages stays well under D1's
  2 MB a value.

### Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/canvas-assessments/:id/review` | tutors, admins | The draft or finished review |
| `PUT /api/canvas-assessments/:id/review` | tutors, admins | Save the draft |
| `POST /api/canvas-assessments/:id/review/finish` | tutors, admins | Write the reviewed PDF and mark it reviewed |
| `POST /api/canvas-assessments/:id/review/reopen` | tutors, admins | Reopen a finished review |
| `GET /api/canvas-assessments/:id/pdf?kind=reviewed` | the student's audience | The reviewed PDF, once it exists |

For anybody outside the student's audience, every route is 404. The audit says "reviewed Sofia's
Grade 4 assessment", never a note or a comment.

### Tests

- **e2e (web).**
  - A tutor draws on a page and writes notes.
  - The draft survives a reload, and the student does not see the draft.
  - "Save as reviewed" produces a valid PDF with the comment page and the ink.
  - The student and their parent then open the reviewed PDF. They still get 404 for the submitted
    one, and the reviewed one carries no answer key.
  - Reopening a review works.
  - The question limit applies.
- **Maestro flows** for the same on iOS and Android.
- **`npm run smoke`** on web, iOS and Android.

### Later

Scoring: a mark per question, points and a score page, with multiple-choice questions prefilled
from the code's marking.

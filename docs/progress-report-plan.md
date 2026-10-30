# Phase 58: the progress report (plan, 2026-10-29)

**Status: approved by the owner, 2026-10-29** (anyone who may read the progress page may generate it; each lesson carries its whole write-up). Asked for by the owner on 2026-10-29. Phase 57
is the Handwriting lab (`docs/stable-release-checklist.md`, D).

## What the owner asked for

At the very bottom of each student's progress page:
- two dates, **From** and **To**;
- a checkbox, **Include original assessment**;
- a button, **Generate Progress**.

It makes a PDF carrying the organization's name, logo and colours, with:
1. the goal card, with its status;
2. analytics cards: topics mastered, expected by today, sessions held, and the total hours of those sessions;
3. the timeline towards the goal (the chart);
4. the recommendation card;
5. the plan topics;
6. the sessions with their notes, newest first, each with its times and location;
7. the original assessment, when the box is ticked.

**No money**, anywhere in it.

## How it works

### One route, built by the Worker

`GET /api/progress/:studentId/report.pdf?from=YYYY-MM-DD&to=YYYY-MM-DD&original=1` builds the PDF on
request and answers it `inline`, `private, no-store`, as the assessment PDFs are. Nothing is stored:
no table, no D1 write, and a fresh PDF on every press.

- **Who may make one:** exactly whoever may read that student's progress page (`canViewStudentProgress`;
  404 otherwise). That means admins, the student, their guardians, and their current tutors.
- **Which lessons it lists:** only the ones this reader could already see on the sessions page. It uses
  the sessions list's own WHERE (`teachingScopeSql`), never "can see the student". A tutor's report
  therefore lists only their own lessons with that student, as their sessions page does.
- **No money:** the sessions are read with a SELECT that names no `*_cents` column, like
  `SELECT_PROGRESS_SESSIONS`. The report imports nothing from the money scopes.
- **Defaults:** From is the plan's start, To is today (the organization's clock). The range must not be
  reversed, and it is at most two years long. It filters the sessions list and the hours. The goal,
  topics, chart and recommendation are the plan as of today, with the range drawn on the chart.
- **Write-up:** each lesson carries its whole write-up (owner, 2026-10-29): `sessions.notes` ("what was
  covered") and the `session_write_ups` parts (planned, previous-session review, homework review and status,
  homework set), each only where written. These reach exactly the lesson's audience, which is who the
  sessions WHERE already admits. Assessments of the lesson and the student's reflection stay out.
- **Not in the audit log:** like the CSV exports, generating a report changes nothing.

### The PDF (`lib/pdf.ts`, extended)

The writer stays hand-written, with standard fonts and vector drawing, within the free plan's 10 ms of
CPU. It needs two new abilities:
- **Images:** a PNG image XObject for the logo. The PNG's own compressed data is passed through
  (`FlateDecode` with the PNG predictor), so nothing is re-encoded. Its transparency becomes a soft mask.
  A **WebP** logo cannot go into a PDF without decoding it, so a WebP-only organization gets its name
  set in its colour instead. An admin can re-upload a PNG to get the picture.
- **The chart:** the same expected line, actual line, today marker and cancelled lessons as
  `ProgressChart`, drawn as vector lines from the same shared figures (`computeProgress`), not redrawn
  from pixels.

Layout, US Letter:
- **Page 1:**
  - the header band in the organization's palette colour (`ORG_PALETTE_HEX`), with its logo and name;
  - the student's name, the date range and the date generated;
  - the goal card with its status badge;
  - the four analytics cards;
  - the chart.
- **Next pages:**
  - the recommendation;
  - the plan topics, baseline → now and mastered;
  - then the sessions, newest first. Each shows the date, start-end times and length, the tutor and the
    location, with its notes wrapped underneath. Lessons run on across pages.
- **Optional last part:** the original assessment, which is the plan's own baseline assessment (else the
  student's first). It shows the date, the assessor, the recommended level, the summary and the topic ratings.

Every page carries a footer with the organization's name, "Progress report", and "page n of m".

### Location of a lesson

A lesson row has no location. The report shows the lesson's **mode** (in person / online). Where the
pairing's schedule names exactly one location of that kind, it adds that location's **name**, never its
address or link. Where that is ambiguous it shows the mode alone. Nothing new is stored.

### Hours

The sum of `duration_minutes` of the lessons listed, shown in hours and minutes. It is derived on every
request and never stored.

### Web and app (parity)

- **Web:** a "Progress report" panel at the very bottom of `student-progress-page.tsx`, with the From and
  To date fields, the checkbox and **Generate Progress**. It opens the PDF in the portal's viewer
  (pdf.js), with its download link, as the assessment PDFs do.
- **App:** the same panel at the bottom of `student-progress-screen.tsx`. It fetches the bytes and shows
  them in the existing pdf.js viewer. It is never written to disk, and `printToFileAsync` stays banned.
  The share sheet is not offered, the same as the assessment PDF.
- The shared contract is a `progressReportQuerySchema` (from, to, original) in `packages/shared`.

## Tests

- API:
  - the route answers 401 signed out and 404 for a student the reader cannot see;
  - a reversed or too-long range answers 400;
  - the PDF carries no amount (the bytes are checked for `$`);
  - a tutor's report lists only their own lessons;
  - the exposure crawl calls it as every non-admin.
- Web: a Playwright spec that generates one and checks the viewer opens. The panel joins the progress
  page's existing spec.
- App: Jest for the panel and its date check, and a Maestro flow on both platforms.
- `npm run smoke` on both clients, and `test:compat`. No schema change, so no SQL block.

## Release

No schema change. The release is the usual one: the local suite, smoke, compat, the tag, the demo, then
both production Workers.

## Built (server, 2026-10-29)

- `GET /api/progress/:studentId/report.pdf` in `routes/progress.ts` (Tutoring's feature group). Access is
  `canViewStudentProgress` (404 otherwise); the query goes through `progressReportQuerySchema`, and a
  reversed or over-two-year range (also after the defaults) is the usual validation error, 422
  `validation_failed`. From defaults to the active plan's `starts_on`, else 90 days before To; To to
  today on the organization's clock. Answers `inline; filename="progress-<student>-<to>.pdf"`,
  `private, no-store`, `nosniff`.
- `repositories/progress-report.ts`: `listReportSessions` (the sessions list's `teachingScopeSql`, no
  `*_cents` column, newest first, at most 500 listed; the count and minutes cover the whole range) and
  `catalogLabels` (the few levels and topics named, through the organization's own list). A lesson's
  place: the pairing's schedules' `schedule_locations` of the lesson's kind; exactly one distinct
  location gives its name, otherwise the mode alone.
- `lib/pdf.ts`: rounded rectangles, circles, polylines and dashes, right and centred text, and PNG image
  XObjects (`pngToPdfImage`): an opaque PNG's IDAT passes straight through with the PNG predictor; an
  alpha channel (types 4 and 6, or a palette with tRNS) is inflated, unfiltered and split into a soft
  mask. Interlaced, 16-bit or damaged PNGs, and WebP, fall back to the organization's initials on the
  white tile. The route caches a logo's PDF image per isolate by its hash.
- `lib/progress-report-pdf.ts`: the layout. Without a plan, the goal card says so, two figures remain
  (sessions, hours), and the lessons follow on page 1.
- Tests: `e2e/tests/progress-report.spec.ts` (audience, 404 across families and organizations, 422 ranges,
  no `$`/`cents`, a tutor's report lists only their lessons, no plan); the report joins the exposure crawl.
  Signed-out 401 is not asserted locally (sign-in is off); the route inherits `requireAuth`.

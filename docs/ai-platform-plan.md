# Phase 36: the AI layer, and the question bank it writes

Plan, written 2026-10-16 at the owner's request ("focus on F11 and G1"; "build the plans for phase 36
and 37"). Nothing here is built until the owner approves it. The starting points are
`docs/roadmap/feature-plans.md` (F11) and `docs/roadmap/future-ai.md` (AI governance AG1-AG10,
"Running it on Cloudflare", provider terms), re-read on this date. Phase 37
(`docs/online-assessment-plan.md`) is the reason for it: a free adaptive test needs a few hundred
checked maths questions, and nobody is going to type them.

## What it is

Not an AI product. One gateway in the Worker that every AI feature must call, so that what may be
sent, to whom, at what cost, and who checks the result is decided once:

```
feature code ──► runAi(c, task, input) ──► consent? ─► redact ─► SSN guard ─► budget? ─►
   Cloudflare AI Gateway ──► provider (Anthropic / Workers AI / fake)
   ◄── reply ─► SSN guard ─► restore tokens ─► Zod-validate ─► log the run (no content) ─► caller
```

Its first and only task in this phase writes questions for the bank. Those are prompts made of
catalog text (a standard's code, name and description). **No person's data, and no child's, goes
through it in Phase 36.** The child-data gate is built and tested now so the first task that needs it
cannot forget it.

## Decisions (owner, 2026-10-17)

- **Provider: Claude** (Anthropic), key as the Worker secret `ANTHROPIC_API_KEY`. Questions are
  written by Claude Sonnet 5.5 and solved independently by Claude Opus 5.5: a different model checks
  the work, so the two are less likely to make the same mistake. Workers AI is not built in this
  phase (its local binding needs a Cloudflare login, which would break the local suite); the
  provider list stays open for it.
- **The free plan, for now.** Nothing here needs Workers Paid: a model call waits on the network,
  which the 10 ms CPU limit does not count, and each request makes one call. AI Gateway is free and
  optional (`AI_GATEWAY` var); without it, calls go straight to Anthropic.
- **Grades 3-8 and Math 1 on NC 2026** (98 standards) are the bank's scope.
- Approvers are platform admins; caps start at $5 a day and $25 a month, editable in the console.
- Phase 37's other questions wait. **The goal of this phase is a reliable question bank.**

## How a question earns trust

Nothing reaches a child without passing every layer, and the human last:

1. **Written to a form.** Claude Sonnet returns each question through a forced tool call, validated
   by Zod: stem, kind (`choice` or `numeric`), four choices or a numeric key, a worked solution, the
   objective it targets, its difficulty (1 easier / 2 on grade / 3 stretch), and, wherever the answer
   is a calculation, a **`compute` expression** (numbers, `+ - * / ^ ( )` only).
2. **Checked by code** (`lintQuestion` in shared, no model):
   - a choice question has four distinct choices, exactly one of which is the key, and no "all/none
     of the above";
   - a numeric key parses (whole, decimal, fraction, mixed number);
   - `compute`, evaluated **exactly** with rational arithmetic (`evaluateExact`), equals the key;
   - balanced `$...$`, a length limit, the SSN guard;
   - no near-duplicate of another question on the same standard.
3. **Solved again, blind.** Claude Opus gets only the stem and the choices (shuffled), works it, and
   gives a final answer, which `checkAnswer` must match to the key. It also judges: is there exactly
   one defensible answer, does it test this standard, is it right for the grade, and is it free of
   errors. Any "no" flags the question, with the reason.
4. **Approved by a person**, with everything beside it: the standard, the rendered question, the
   key, the solution, and each check's result. An edit re-runs the code checks at once, and the blind
   solve on request; approval is refused while a check fails.
5. **Watched in use** (Phase 37): `times_used` and `times_correct` flag a question nearly everyone
   misses or nobody does.

Status follows from it: `draft` (written) → `checked` (layers 2-3 passed) or `flagged` (a reason
shown) → `approved` → `retired`. A per-standard target, 6 approved (2 at each difficulty), drives
the coverage view.

## Build

### The gateway (`apps/api/src/lib/ai/`)
- **`runAi(c, task, input, { organizationId?, actor })`**, the only way to call a model. Route code
  never calls a provider directly. `scripts/check-ai-gateway.mjs` (run by `npm run typecheck`) fails on
  a provider URL or the `AI` binding used outside `lib/ai/`.
- **Tasks are a registry, `AI_TASKS` in `packages/shared/src/ai.ts`.** Each has an id, a label, Zod
  schemas for input and output, `child_input` (true when anything a child produced is in it), its
  provider and model, and default caps. Adding an AI feature means adding a task. Phase 36 registers
  two: `question_bank.draft` and `question_bank.check`.
- **Providers.** An allowlist in code (AG3): `anthropic` (Messages API, through AI Gateway when
  `AI_GATEWAY` is set, key as the Worker secret `ANTHROPIC_API_KEY`) and `fake` (deterministic, for
  local and e2e runs, so no test spends money or quota; it writes sums whose blind solve it can
  check, and one wrong key per batch so a flag is exercised). `AI_PROVIDER`
  in `vars` picks `fake` on `tutoring-test` and locally; the production pair use the task's own
  provider.
- **Before sending.**
  - Consent (AG1): a task with `child_input` is refused (`403 ai_consent_required`) until F7 exists.
    No such task exists in this phase, so the refusal is tested by the first one that does.
  - Redaction (AG2): names, emails and phone numbers the caller names are swapped for tokens
    (`[PERSON_1]`) and restored in the reply. It is a pure function in shared with unit tests,
    unused by `question_bank.draft` (catalog text has no people), ready for the next task.
  - `containsSsn` on the prompt and the reply (AG10); a hit refuses the run.
- **Budget (AG9).** Before each call, the day's and month's spend for the task (summed from `ai_runs`,
  indexed) against its caps, plus a platform-wide monthly cap. Over it: `429 ai_budget_exhausted`.
  Cost comes from the provider's reported tokens times a price table in shared; the AI Gateway
  dashboard is the cross-check.
- **After.** The reply is validated against the task's output schema; one retry on a malformed reply,
  then an error. Nothing the model says is shown to a family in this phase.
- **Off switches (AG8).** `AI_ENABLED` per Worker (`"false"` stops every run), and each task's
  `enabled` in the console. An organization-level switch arrives with the first task that runs on
  an organization's data (with F9), not now.

### What is recorded (AG7)
- **`ai_runs`**: one row per call. Task, provider, model, input and output tokens, cost in
  micro-dollars, outcome (`ok`, `invalid_output`, `refused_consent`, `refused_budget`,
  `refused_ssn`, `provider_error`), actor, organization (NULL for a platform task), time. **Never
  the prompt or the reply.** AI Gateway's own request logging is left OFF, since its logs hold
  prompts.
- Audit lines for what people did, never what the model wrote: `question_bank.drafted` ("<admin's
  name> drafted 8 questions for 4.ANR.1"), `question.approved`, `question.retired`,
  `ai.task_updated`. Platform actions, so `organization_id` is NULL, like `platform_admin.*`.

### The question bank (the first consumer)
Platform reference data, like the catalog: every organization's test draws on one bank.

- **`questions`**: `id`, `topic_id` (a `curriculum_topics` row, so each question tests one
  standard), `difficulty` (1 easier / 2 on grade / 3 stretch, within its standard), `kind`
  (`choice` or `numeric`), `stem` (text with maths in `$...$`), `choices` (JSON, for `choice`),
  `answer` (the correct choice, or the accepted value), `solution` (a worked solution, for the
  reviewer and for the family's report later, never shown during a test), `status` (`draft` →
  `checked` → `approved` → `retired`), `source` (`ai` or `manual`), `ai_run_id`, `reviewed_by`,
  `reviewed_at`, `times_used`, `times_correct`, timestamps.
- **Never deleted** once a test has used it (Phase 37 answers reference it). Retired instead, as
  with curricula.
- **Answers are exact.** `numeric` accepts equivalent forms (`3/4`, `0.75`, `.75`; mixed numbers as
  `1 1/2`): `checkAnswer` in shared, one function for the server and its unit tests. No free-form
  expressions in this version.
- **Text only.** A standard that cannot be tested without a figure (most geometry, data displays)
  is marked `needs_figure` and left out of the test until figures are supported. The console shows
  what is covered and what is not, per grade.

**How a question is written.**
1. In the console, a platform admin picks standards (a grade, or a whole range) and asks for N
   drafts each (default 8: about 3 easier, 3 on grade, 2 stretch).
2. `question_bank.draft` writes them from the standard's code, name, description and objectives,
   with rules in the prompt: one skill per question, grade-appropriate numbers and reading level,
   no names of real people, plausible wrong answers for `choice` built from common mistakes.
3. **A second, independent run solves each draft without seeing its answer**
   (`question_bank.check`, also registered). Only questions where the two agree and `checkAnswer`
   accepts become `checked`; the rest are flagged with the disagreement.
4. A platform admin reviews `checked` questions one by one (stem rendered, choices, answer,
   solution, the standard beside it) and approves, edits then approves, or retires. Keyboard
   shortcuts for approve and next, because there are hundreds.

**Getting it everywhere.** Production's bank is written in production's console. `npm run
questions:export` (read-only against production, one query) writes the approved set to
`apps/api/db/questions/*.json`, committed, and the generator turns it into `db/questions.sql`,
loaded after `catalog.sql` by every local and test build path, so the local suite and the demo test
against real questions. A small fixture set exists from day one so Phase 37 can be built before the
bank is. The export copies `checked` questions too, so a part-reviewed bank stays whole locally.

**The first writing (2026-10-17)** was done before the owner set `ANTHROPIC_API_KEY`, by Claude Code
running the same pipeline outside the Worker: Sonnet agents wrote 9 per standard from the catalog's
summaries, `lintQuestion` checked them, Opus agents solved them blind with shuffled choices, and the
flagged were rewritten and solved again. The `checked` result went into `db/questions/*.json` and,
by `generate-questions.mjs --production`, into production's bank to await review
(`docs/database.md`, Phase 36).

### Maths on screen
Questions need fractions, exponents and symbols. KaTeX (bundled, not from a CDN) renders `$...$` in
the console's review screen and in Phase 37's test page. The rest of the portal is unchanged (F6,
maths in notes, stays a separate roadmap item).

### Console screens (web)
- **AI**: each task with its switch, caps, today's and this month's spend, and recent runs
  (outcome, tokens, cost; no content).
- **Question bank**: coverage by grade and strand (approved / checked / draft / needs a figure),
  "Draft questions" for chosen standards, and the review queue.

The mobile app's console gets nothing: authoring is a desk job. A row in `docs/mobile/parity.md`
says so ("web only").

## Data

Additive only: `CREATE TABLE ai_runs`, `ai_task_settings` (task, enabled, caps; seeded from
`AI_TASKS`), `questions`, and their indexes. No change to any existing table. The statements go into
`docs/database.md` under Phase 36.

## Rules that go into CLAUDE.md
- Every model call goes through `runAi`, and every AI feature is a task in `AI_TASKS`.
- A task with `child_input` is refused until F7 (consent) is built; its plan must add the consent.
- Nothing a model writes reaches a family or a student unapproved.
- `ai_runs` and the audit log never hold a prompt, a reply or a question's text.

## Tests
- Unit (shared): `checkAnswer` (equivalent forms, refusals), redaction round-trip with a known
  name, the price table, the budget arithmetic.
- API (local, `AI_PROVIDER=fake`): `runAi` refuses a `child_input` task, an SSN in the prompt or the
  reply, a disabled task, `AI_ENABLED=false` and an exhausted budget, each with its `ai_runs`
  outcome; a malformed reply is retried once; no route other than the console's reaches it; every
  new route answers 401 signed out and 403 to an organization admin.
- e2e (web): a platform admin drafts questions for one standard (fake provider), sees them checked,
  approves one, retires one; the AI page shows the runs without content; `exposure.spec.ts` gains
  the new routes (none readable by a non-platform-admin).
- `npm run smoke` on web and both mobile platforms, as the API changes.

## Release
Per CLAUDE.md, once approved: full local suite, mobile smoke, commit and push, `deploy:test` and
`db:reset:test`, back up production, apply the Phase 36 block, deploy both Workers. Then, on
production, the owner sets `ANTHROPIC_API_KEY` (`wrangler secret put`, both Workers) and the AI
Gateway id, and writing the bank begins: a first batch for one grade, reviewed, before the rest.

**Size**: M for the gateway; the bank's review is the owner's time (about 500 approved questions for
Phase 37's range, around 2 minutes each at first, faster with the shortcuts).

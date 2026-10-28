---
name: think-aloud-reader
description: Improve and measure the handwriting reader behind the think-aloud canvas (AI-13; Phase 54's Handwriting lab) — its instructions, the picture of a line, how lines are found, the model — one change at a time against a corpus, with npm run handwriting:eval. Use for any work on reading handwriting, OCR of the canvas, or the reading panel's accuracy.
---

# The think-aloud reader

The reader turns one handwritten line of maths into LaTeX, blind. Making it better is an experiment
loop: **change one thing, measure it against a corpus, keep it only if the score rises, write it
down.** Read `docs/think-aloud-plan.md` first (what is built and why), and the newest entries of
`docs/think-aloud/reader-log.md` (what was already tried).

## Never

- **Never put a child's handwriting in a corpus, a test or a prompt.** Stage 0 is adults' handwriting
  and the synthetic hand only. A student's ink goes to a model only through a `child_input` task, and
  `runAi` refuses those until parental consent for AI processing exists (AG1). Do not weaken that.
- **Never call a model outside `runAi`.** The evaluation goes through the Worker's own route, so it
  measures what ships; `scripts/check-ai-gateway.mjs` fails a direct call.
- **Never let the reader see the answer.** No question, key or other line in its prompt: a reader that
  knows the answer "corrects" slips towards it, which is the failure the whole design avoids.
- **Never loosen `normalizeReading` to win points.** It may treat as equal only spellings that mean
  exactly the same to a reader of the line (`\dfrac`/`\frac`, `{7}`/`7`, `\leq`/`\le`). `\times` and
  `\cdot`, a slash and a stacked fraction, are different readings.
- **Never record a fake-provider score as a reading score.** The fake reads a line as its stroke count.
- Never commit an exported corpus of staff handwriting, or the key. `.handwriting-eval/` is ignored.

## The loop

1. **Start the Worker** with a real reader if you can: `apps/api/.dev.vars` with
   `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=…` (ask the owner; never commit it), `AUTH_ENABLED=false`,
   then `npm run dev:api` (or `npm run dev` for the lab at http://localhost:5173/platform/handwriting).
   Without a key you can still work on finding lines and the picture, and say so.
2. **Baseline.** `npm run handwriting:eval -- --corpus=synthetic --label="baseline"`, and on the lab's
   samples: `--corpus=samples` (that Worker's database) or `--corpus=<exported file>`. Options:
   `--category=fraction`, `--limit=N`, `--min=0.95` (exit 1 below), `--no-images`.
3. **Look before changing.** Open `.handwriting-eval/<time>/report.md`: every line not read right, with
   what was written, what was read and the picture the reader was given. Read the pictures. Decide
   whether the miss is the picture (too small, cramped, a stroke lost), the line-finding (two steps as
   one line, a fraction split), the instructions (a convention the reader does not follow), or the model.
4. **Change one thing**, in one place:

   | What | Where |
   | --- | --- |
   | The instructions, the tool | `READ_SYSTEM`, `READ_PROMPT`, `READ_TOOL` in `apps/api/src/lib/ai/handwriting.ts` |
   | The picture | `LINE_IMAGE`, `rasterizeLine` in `apps/api/src/lib/raster.ts` |
   | Finding lines | `segmentLines`, `lineGap` in `packages/shared/src/handwriting.ts` |
   | Model, effort, caps | `AI_TASKS['handwriting.read_line']` in `packages/shared/src/ai.ts` (a new model also needs `AI_MODELS` and `AI_MODEL_PRICES`, checked against the pricing page) |
   | What counts as the same reading | `normalizeReading` (see Never) |
   | The synthetic hand | `packages/shared/src/handwriting-synthetic.ts` (it is a test fixture, not a target: do not tune the reader to it) |

   After changing `packages/shared`, restart `wrangler dev`: it does not always pick up a linked
   workspace's change.
5. **Measure again** with the same corpus and options, and a `--label` naming the change. Keep the
   change only if the score you care about rises and nothing else falls; latency counts.
6. **Record it** at the top of `docs/think-aloud/reader-log.md`: the change, the corpus, the provider and
   model, before and after (exact, unreadable, not maths, confident exact, p50/p90), and what to try
   next. A change that did not help is worth recording too.
7. **Check nothing else broke**: `npm run typecheck`, and the lab's spec,
   `E2E_BASE_URL=http://localhost:5173 npx playwright test handwriting-lab` from `e2e/` (with the
   fake provider, as the suite always runs). A change to the API or shared contract also needs
   `npm run smoke` (CLAUDE.md).

## Reading the scores

- **exact** is the headline: the spike's pass mark is ≥ 95% of clear lines.
- **confident exact** says whether the reader's confidence can be trusted to stay quiet when unsure
  (stage 2 flags nothing unless code has checked it; a low-confidence reading can be withheld).
- **not maths** is how often a student would be shown nothing; rising is bad.
- **p90 latency** has a budget: under 2 seconds from the pen resting to the reading, on a tablet.
- The synthetic set is easy, deliberately: it catches a broken pipeline, not a weak reader. The
  lab's samples, written by people, are the measure that matters.

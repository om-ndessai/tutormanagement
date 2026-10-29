# Question-bank workspace: NC 2017, round 5

The briefs and scripts that write NC 2017's questions (`docs/question-bank-nc-2017.md`), kept in the
repository so a later session can carry on. The first part of round 5 ran on the owner's Mac
(`~/aimtrue-question-bank/qb3`); its workspace never reached git, and the second part (2026-10-28, a
cloud session) rebuilt it from that session's transcript. This folder is the rebuilt one.

Nothing here runs in the Worker or the app. Questions reach the repository only through `merge.mjs`,
which writes `apps/api/db/questions/NC17.<level>.json`.

## Setting up

The briefs say `$QB`: a scratch folder outside the repository (drafts and keys must not be committed
half-done). Copy this folder there and bundle the shared checks once:

```bash
export QB_DIR=/path/to/workspace QB_REPO=/path/to/tutormanagement
mkdir -p $QB_DIR/{drafts,context,standards,solve-in,solve-out,solve-key,repair,logs,scripts}
cp -r docs/question-bank-workspace/* $QB_DIR/
npx esbuild packages/shared/src/questions.ts --bundle --format=esm --platform=node --outfile=$QB_DIR/tools/shared-questions.mjs
```

Then replace the `QB=<the workspace folder…>` line at the top of each brief with the real path (the
agents read the briefs, not the environment).

## The loop

Writers are Claude Sonnet agents, solvers Claude Opus agents (Claude Code's Agent tool), about 20 at a
time, solvers before writers.

| Step | Command | Then |
| --- | --- | --- |
| Order the standards still short of 99 | `node tools/plan-b.mjs` | writes `logs/b-order.json`, round robin over the 14 levels |
| Next writer group (two standards) | `node tools/next-b.mjs 2` | writes `standards/b5-*.json` and `context/<topic>.json`; prompt a Sonnet agent: "Read $QB/PASS-B5.md and follow it, together with $QB/WRITER-NC17.md which it points to, for these PARTs: …" |
| A standard with no questions yet | `node tools/standards.mjs a5 <topic>…` | prompt with PASS-A5.md instead |
| Lint a draft | `node tools/lint.mjs drafts/<PART>.json` | the writers run it themselves |
| Package finished drafts for the blind solve | `PER=50 node tools/build-solve.mjs <batch> drafts/<PART>.json…` | only drafts whose writer has reported (a half-written draft lints clean too); prompt an Opus agent: "Read $QB/SOLVER-5.md and follow it exactly for these PARTs: <batch>-01 <batch>-02" |
| Keep what passed | `node tools/merge.mjs <chunk>…` | `checked` into the repository; the rest to `repair/queue.jsonl` |
| Replacements for the flagged | `node tools/repair-input.mjs r<N>` | prompt a Sonnet agent with REPAIR.md; questions flagged only for a lost backslash are re-solved instead |
| Check the repository files | `node tools/verify.mjs` | the e2e spec's lint over every NC17 question, plus control characters and bare LaTeX |
| Sort, regenerate SQL | `node tools/finalize.mjs` | then commit `apps/api/db` |
| All of the last three, then commit and push | `tools/ship.sh <chunk>…` | commits with the Claude session's attribution lines: edit them first |
| Where things stand | `node tools/status.mjs` | |

A question is kept only when the blind solver's answer matches the key (`checkAnswer`), all four
judgements are true and it wrote no issue. A question the solver passed with a note goes to repair, as
the first part's held questions would have.

## What the lint adds to `lintQuestion`

- A control character in the text: `\t`, `\f`, `\n`, `\b`, `\r` are JSON escapes, so `"\times"` in a file
  is a tab and "imes". Twelve drafts and one released NC 2026 solution had it.
- A LaTeX command inside `$…$` with no backslash (`53^circ`): a JavaScript string drops an unknown
  escape like `\c` silently.
- The PDF converter's limits (bare `pi`, `\vec`, `\binom`, `\begin`, set symbols), the key alone in its
  ending, an option named by its position, and the share of keys that are strictly the longest or
  shortest option.

# Math Kangaroo writing workspace

The briefs and scripts that wrote the Math Kangaroo levels (`docs/question-bank-kangaroo.md`). Not part of
the build. Drafts, solver files and the downloaded papers live in a scratch folder outside the repository.

- `WRITER-MK12.md`, `SOLVER-MK12.md`: the briefs for grades 1-2.
- `tools/entry.ts`: bundle it once into `tools/shared.mjs`, so the scripts run the bank's own `lintQuestion`
  and `checkAnswer`:
  `node_modules/.bin/esbuild <tools>/entry.ts --bundle --platform=node --format=esm --outfile=<tools>/shared.mjs`
- `tools/lint.mjs <draft>...`: the code checks on a writer's draft.
- `tools/prep-solve.mjs <out> <draft>...`: the blind solver's input (no key, options shuffled).
- `tools/merge.mjs <level> <drafts> <solve-out> <bank file> <id map> <source> <notes>`: keeps what passed
  every check and the blind solve, and lists the rest as flagged.

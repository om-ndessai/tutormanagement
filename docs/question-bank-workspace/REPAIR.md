# Replacing flagged questions (NC 2017, NC 2017)

QB=<the workspace folder: see README.md>

Your task names your PART (`r1-1`, `r1-2`, ...). First read `$QB/WRITER-NC17.md` and `$QB/PASS-B5.md`. Every rule in them applies, except the parts about how many to write.

## Input

`$QB/repair/<PART>.json` lists questions that were flagged by a second model that solved each one blind
and judged it ("solve": its answer, whether it agreed with the key, and the issues it found), or by the
code checks ("lint"). Each entry carries the standard (code, name, what it covers, grade), the
difficulty, the flagged question in full, and `existing_stems`: every question already kept on that
standard, which yours must not repeat or closely imitate.

Most flags in this pass are about alignment and wording, not maths: a question that tests a neighbouring
standard instead of this one (place value in a reading-numerals standard, a bare equation in a word-problem
standard, a single function in a comparing-functions standard), two defensible answers (a rounding or
quartile convention, a borderline probability word, a measuring tool that also works), a solid or figure
that cannot exist, or a question far too easy for its course. Fix THAT.

## Output

Write `$QB/drafts/<PART>.json` in the base brief's format, with `"part": "<PART>"`: for EACH flagged
entry, one NEW question on the same `topic_id` and the same `difficulty` that fixes what was wrong --
a different problem, not the flagged one with a cosmetic change. Each question carries its own
`topic_id` and `difficulty`, copied from its entry. Use "notes" only if an entry cannot be
replaced fairly in text, and then skip it.

If you build questions with a script, keep it in `$QB/scripts/` named after your PART.

Last step: lint your draft to 0 (`node $QB/tools/lint.mjs $QB/drafts/<PART>.json`) and re-read it.
Do not edit anything outside $QB/drafts and $QB/scripts. Reply briefly: how many written, and any entry skipped and why.
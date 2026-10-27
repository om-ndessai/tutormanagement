# Writer brief: Math Kangaroo, grades 3-12 (levels MK34 ... MK1112)

You write ORIGINAL multiple-choice and numeric questions for a maths question bank, in the style of one
level of the Math Kangaroo contest. The questions reach students through an app, so correctness and
clarity matter more than anything: every question is solved blind by a second model, and any question
with a wrong key, two defensible answers or unclear wording is thrown away.

## Your level

Read your level's profile first (the path is in your task): it describes the maths the level uses, what
makes a 3-, 4- and 5-point question there, and the traps to avoid. It was written from ten years of
papers, in our own words. Keep every question to the maths and the reading level it describes.

- **NEVER copy or closely paraphrase a real contest problem.** Invent your own situations, names and
  numbers; use the profile's ideas only as the kind of thinking to test. Do not open the contest papers.
- Kangaroo questions are not drill: each has an idea -- notice a pattern, count both ends, work
  backwards, use parity, try the cases, find the extreme case, avoid the trap. Short stories with named
  people or animals are welcome; pure maths statements are fine at the upper levels.

## Rules for every question

1. **Text only.** No picture exists. Never write "picture", "figure", "diagram", "shown", "see below".
   Describe every arrangement fully in words: sides and where points lie ("M is the midpoint of AB"),
   grids by rows, solids by their dimensions, nets by which squares join which.
2. **Exactly one defensible answer** under a careful, literal reading. State every assumption ("both
   included", "all different", "positive integers", "the cube is solid"). Make sure the premise is
   possible: the numbers must actually fit every clue, a triangle's sides must close, a figure must exist.
3. **Maths notation:** inline LaTeX between `$...$` only: `\frac{a}{b}`, `\sqrt{x}`, `x^2`, `a_n`,
   `\times`, `\cdot`, `\div`, `\pi`, `\le`, `\ge`, `\ne`, `\pm`, `\angle`, `\triangle`, `^\circ`,
   `\ldots`. Nothing else: no environments, `\binom`, `\sqrt[n]{}`, `\vec`, set symbols or `\text`.
   Grades 3-4 should hardly need any. Every `$` must be paired.
4. **Money:** write "5 dollars", "3 euros", "80 cents" -- NEVER a currency `$` sign (it is the maths
   delimiter).
5. **kind "choice"** (about 20 of your 30 per topic): exactly 4 options, all different, all plausible --
   each wrong one what a student gets from a typical slip. Number options go in increasing order, like the
   contest. Put units in the stem ("How many centimetres ...?"), not in the options. Word or expression
   options should be similar in length; the key must not be the longest or shortest more often than
   chance. "answer" must be exactly the text of one option. No "all/none of the above", "cannot be
   determined", "impossible to say".
6. **kind "numeric"** (about 10 of 30): "choices": [], "answer" a whole number, a decimal or a fraction
   like 7/3 -- no units, no LaTeX, no words.
7. **compute:** when the answer is a number, an expression that evaluates exactly to it using only
   digits, + - * / ^ and parentheses (e.g. "(47 - 15)/2 + 1"); null when the answer is not a number or
   the work is reasoning rather than a formula. It must be right: code checks it against the answer.
8. **solution:** 1-5 sentences, a clear worked solution ending at the answer. Never name an option by
   letter or position.
9. **skill:** a short phrase for the idea tested.
10. **Length:** the stem at most 550 characters; an option at most 100.
11. **Variety:** cover every skill the topic description names, roughly evenly. No two questions may be
    the same template with the numbers changed. Vary names (many cultures) and settings.
12. **Correctness:** after writing each question, solve it again from scratch, check the key, check that
    no other option is also right, and check the premise. For counting questions, count by a second
    method or list the cases. For geometry, check the configuration exists with the given numbers.

## Difficulty

10 at difficulty 1 (the level's 3-point questions), 10 at difficulty 2 (4-point), 10 at difficulty 3
(5-point), for EACH topic -- as hard as the profile says the real ones are, not easier.

## Output

One JSON file per topic, at `<workspace>/drafts/<topic_id>.json`:

```json
{
  "topic_id": "MK56.01",
  "topic_name": "Digits and Number Puzzles",
  "questions": [
    { "id": "MK56.01-001", "difficulty": 1, "kind": "choice", "skill": "...", "stem": "...",
      "choices": ["...", "...", "...", "..."], "answer": "...", "compute": "...", "solution": "..." }
  ]
}
```

Ids are `<topic_id>-001` ... `-030`. Write the file with a file-writing tool (valid JSON; inside JSON a
LaTeX backslash is written `\\`, e.g. `"$\\frac{1}{2}$"`).

Then run the code checks and fix everything they report, re-running until they print "all clean":

```
node <tools>/lint.mjs <workspace>/drafts/<topic_id>.json
```

It also prints how often the key is strictly the longest or shortest option; keep each under about 1 in 4
of the choice questions. Finish by reporting, per topic, the counts by difficulty and kind and anything
you were unsure about.

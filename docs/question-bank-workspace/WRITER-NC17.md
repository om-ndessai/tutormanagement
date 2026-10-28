# Writing questions for the question bank: North Carolina standards

You write maths questions for an online maths check-up taken by North Carolina students at home, on a
phone or a computer, with no one helping. A wrong answer key or an ambiguous question misplaces a
child, so correctness comes before everything else.

QB=<the workspace folder: see README.md>

Your task names one or more PARTs, each one standard (`a5-<topic_id>` or `b5-<topic_id>`), and the
pass brief to follow with this one. Do the parts one after the other: finish, lint and re-read one
part's file before starting the next.

## Input

`$QB/standards/<PART>.json`: the standard (topic_id, code, name, strand, a summary of what it covers,
and the grade or course). Use ONLY this file to learn what the standard covers. Do not open anything
under the repository's apps/api/db/catalog, do not look up NCDPI's official standard statements (their
terms allow non-commercial use only, so the questions are written from these summaries), do not open
other parts' files in $QB unless your pass brief says so, and do not look anything up.

## Output

Write `$QB/drafts/<PART>.json`:

```
{
  "part": "<PART>",
  "notes": { "<topic_id>": "anything the reviewer should know, e.g. why fewer were written" },
  "questions": [
    { "topic_id": "NC17.2.OA.1", "skill": "...", "difficulty": 1, "kind": "choice" | "numeric",
      "stem": "...", "choices": ["...","...","...","..."] or [], "answer": "...", "compute": "..." or "",
      "solution": "..." }
  ]
}
```

You may build questions with a generator script. Keep it in `$QB/scripts/` and name EVERY file you
create there after your PART (`build-<PART>.mjs`, `lib-<PART>.mjs`): other writers work in the same
folder at the same time, and a shared name like `lib.mjs` gets overwritten. Then check the generated
keys, choices AND solutions: a template that is wrong once is wrong thirty times.

## The grade or course

These are North Carolina's 2017 standards (the edition before 2026), Kindergarten to Precalculus.

- **Kindergarten and Grade 1.** An adult may read the question aloud but does not help with the maths.
  Very short sentences and small words; one idea per question; whole-number answers only, inside the
  standard's range (Kindergarten: counting to 100 by ones and tens, adding and subtracting within 10;
  Grade 1: within 120, adding and subtracting within 20 and tens within 100). Kindergarten compares
  (more, fewer, longer, heavier) but never asks HOW MUCH more, longer or heavier, and never chains two
  comparisons (A is taller than B, B taller than C): those are Grade 1. One step only in Kindergarten.
- **Grade 2.** Short sentences, numbers within 1,000, whole-number answers (money as cents or dollars
  and cents in words).
- **Grades 3-8.** Numbers, words and contexts a student in that grade meets in class, the reading level at
  or below the grade. The ANSWER, too, must be the kind of number the grade and standard work with: no
  fraction or decimal answers where the standard covers only whole numbers, no negative numbers before
  Grade 6, and no content from a later grade even at difficulty 3.
- **The early grades' picture work.** Shapes, picture graphs, clocks, coins and number lines are normally
  shown. Here they are written out: a shape by its sides and corners ("a flat shape with 4 straight sides
  that are all the same length and 4 square corners"), a picture graph, bar graph, line plot or tally as a
  short list ("Dogs: 5, Cats: 3, Fish: 7"), a clock as its time in words or the position of its hands in
  words, coins by name. Test only what words can test, and write fewer if you must (say so in "notes").
- **NC Math 1, 2 and 3** (grades 9-11): high-school language. Where a summary speaks of technology
  (regression, simulation, graphing a system), write questions a student can answer by hand: give the
  fitted equation and ask for a prediction or a residual, give r and ask what it says, choose data whose
  answer is exact, or ask the concept as a choice question. A graph is described by its features in words
  (intercepts, vertex, where it rises), or by a short table of values. Proof standards are asked as
  choice questions about a written argument (which reason justifies a step, which statement is missing).
- **NC Math 4 and Precalculus** (fourth-year courses): complex numbers as $3 + 2i$; trigonometry in
  degrees or radians as the question says, exact values from the unit circle; logarithms; sequences and
  recursion; parametric equations; conics; statistics and probability distributions. A matrix is written
  by its rows ("the matrix A with rows [2, 1] and [0, 3]"), a vector by its components ("the vector v
  with components (3, -4)"), an answer that is a matrix or a vector is a choice question with each option
  written the same way. Advanced courses never ask a bare one-step calculation (a unit conversion,
  62 - 50) dressed in context: even a difficulty-1 question needs an idea the standard names.

## What the questions must be like

- **Exactly one correct answer.** Give every number and unit the student needs. No trick wording.
  Round only when the question says how ("to the nearest tenth"), and make the key match.
- **Difficulty means something.** 1: one step, friendly numbers, the core idea. 2: on grade -- the
  standard as a typical end-of-year question asks it. 3: a stretch within the standard -- more steps,
  less friendly numbers, a reverse or multi-part question -- never content from a later grade.
- **Cover the whole standard.** List the skills its summary names and spread the questions across all
  of them, each at more than one difficulty where the count allows. Name the skill in "skill"
  consistently (the same words for the same skill).
- **Real variety, not copies.** Each question a genuinely different problem: change the numbers AND
  the context or the wording or the form (numeric vs choice; find the whole vs find the part; a story
  vs a bare calculation; which-is-true vs which-is-false). A stem that differs from another only in one
  or two numbers or a name fails the near-copy check.
- **Kinds:** roughly half "choice", half "numeric", wherever both suit the skill. Spread the correct
  option evenly over the four positions.
- **Statistics conventions.** A quartile or IQR question always states the method ("the lower quartile is
  the median of the lower half, leaving out the median") or uses an even number of values; a percent
  of a normal distribution says "use the empirical rule"; a probability word (likely, unlikely) is
  never asked of a value near 1/2.
- **Text only.** Never refer to a picture, graph, table, number line, clock face, ruler, grid or diagram
  that is not written out in the question. A small table written out in words, a list of data values,
  coordinates written as (3, -2), or a shape described by its measurements is fine.
- Words for maths match what is shown: a "number sentence" or "equation" has an equals sign, so options
  without one are "expressions"; "digit" for a single digit, "number" for a number. When a story
  names a total and its parts, say which is which ("9 plain stickers, 4 star stickers").
- An unknown in a number sentence is written "?" and called "the ?" (or a letter, in grades that use
  letters) -- never "the box" or "the blank", which the student cannot see.
- Neutral, everyday contexts. No real people, brands, religions or politics; simple first names.
- Maths goes in $...$ using simple LaTeX only: \\frac{3}{4}, \\sqrt{2}, x^2, a_1, \\times, \\div, \\cdot,
  \\le, \\ge, \\ne, \\pm, \\pi, ^\\circ, \\angle, \\triangle, \\text{...}, \\left( \\right), and \\infty, \\approx, \\cong, \\parallel, \\perp, \\sim, \\overline{AB}, and the named
  functions and letters \\sin, \\cos, \\tan, \\sec, \\csc, \\cot, \\log, \\ln, \\theta, \\alpha, \\beta, \\mu, \\sigma (always followed by a space or
  a brace: "\\sin \\theta", "\\log_2 8", "\\ln(x)"). The questions are
  also printed to PDF by a small converter that knows only these: **no LaTeX environments**
  (\\begin{...}: no matrices, arrays, cases or aligned), no \\binom, \\vec, \\langle, \\mathbb or \\lim, no set or logic symbols. Write a
  matrix by its rows ("the matrix A with rows [2, 1] and [0, 3]"), a combination as "C(6, 2)" or in
  words, and set and logic operations in words ("the union of A and B", "not p", "p and q", "if p, then
  q"). In JSON, escape backslashes ("$\\frac{3}{4}$"). Thousands separators in maths: $4{,}215$. Words
  stay outside the maths: "$-2$ and $3$", never "$-2 and 3$". American English.
- Money is written in words or plain numbers: "5 dollars", "2.50 dollars", "35 cents". NEVER a dollar
  sign, not even escaped: every $ character counts as a maths delimiter.
- **"choice"**: exactly four options, one correct, the three others each the result of a specific
  common mistake. Options similar in form, length and detail: the correct one must not be reliably the
  longest, the most hedged or the only precise one. Never "all of the above" or "none of the above".
  "answer" is the correct option copied exactly, character for character.
- **Never point at an option by its position** in a stem or solution ("option B", "the first
  choice", "the second statement"): options are shown shuffled. Name the option by its content.
- **"numeric"**: the answer is a single number written as an integer, a decimal, a fraction a/b
  (negative: -3/4), or a mixed number "w n/d" -- nothing else (no units, no "x =", no commas; put
  units in the question: "in centimeters"). "choices" is []. Any equivalent form is accepted (3/4,
  6/8 and 0.75 all match). Irrational answers (\\sqrt{2}, \\pi) must be choice questions, and so must
  answers that are a word, an expression, an interval or a set.
- **"compute"**: when the answer is the result of a calculation, an expression using only numbers and
  + - * / ^ ( ) that equals the answer exactly (for 3/4 of 24, "3/4*24"; to solve 3x + 5 = 20,
  "(20-5)/3"). For a choice question whose correct option is a plain number, it equals that number.
  Otherwise "". Provide it whenever you can: the checker recomputes it exactly and it catches wrong
  keys. Never delete it to silence a mismatch: a mismatch means the key or the compute is wrong.
- **"solution"**: a short worked solution a parent could follow.
- Keep stems under 600 characters, options under 120, solutions under 1200, skill under 120.
- Work each answer out carefully before writing it down, and check it.

## Checking (required, per part)

    node $QB/tools/lint.mjs $QB/drafts/<PART>.json

It runs the bank's code checks (form, four distinct options with exactly one matching the answer, the
compute expression evaluated exactly against the answer, balanced $, near-copies against every
question already on the standard and every other draft on it, LaTeX the PDF cannot print, the key alone in
its ending, an option named by its position) and prints how often the key is strictly the longest or
shortest option. Fix every problem it reports, by fixing the question, until it
reports 0. Then re-read every question once more as a careful teacher would: is the key truly right, is
there exactly one defensible answer, is any wording ambiguous, does it suit the grade, does it match
its difficulty? A second model will solve each one blind and flag any it disagrees with, so a doubtful
question costs more than a missing one. Fix what you find and lint again.

Edit nothing outside $QB. When done, reply briefly per part: the count by difficulty and kind, the
skills covered with rough counts, and anything you were unsure of or left out (and why).

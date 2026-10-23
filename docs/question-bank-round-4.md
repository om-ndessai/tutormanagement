# The question bank, round 4: every remaining NC 2026 standard, and the rest of the AoPS books

Requested by the owner on 2026-10-22: "Review the generated question bank and continue generating for the
standards or topics not yet generated. Use agentic setup to validate the answers. Also generate in a way
that at least some questions get generated for each topic/standard before running into usage limits."
Owner's choices the same day: **NC 2026's remaining levels** join the bank (not NC 2017), and the
questions are **released like Phase 41** (production backed up, the new questions loaded as `checked`,
both Workers deployed).

## Scope

| Curriculum | Levels | Topics | State before this round |
| --- | --- | --- | --- |
| NC 2026 | Kindergarten, Grades 1-2 | 42 standards | not in the bank |
| NC 2026 | NC Math 2 | 17 standards | not in the bank |
| NC 2026 | Applied Logic and Reasoning, Applied Statistics and Data Science, Mathematical and Statistical Modeling | 33 standards | not in the bank |
| AoPS Introduction to Algebra | chapters 14, 15, 18-22 | 7 chapters | written 2026-10-18, never solved blind |
| AoPS Introduction to Geometry | chapters 1-19 | 19 chapters | 2 written, none solved |

NC 2026 grades 3-8 and Math 1 (about 100 a standard) and Beast Academy 1-5, Prealgebra and Algebra 1-13
and 16-17 (about 99 a chapter) were already in the bank. NC 2017 stays out: its standards are the 2026
edition's predecessors, and an organization on it has none of the bank's levels.

## Breadth first

The previous writing stopped on the account's usage limit with 26 chapters untouched. So this round
writes in two passes, and the first finishes everywhere before the second starts:

- **Pass A:** 30 questions a topic (10 per difficulty), covering every skill its summary names, for all
  109 topics still missing. Each is written, code-checked, solved blind and kept or flagged before any
  topic gets more.
- **Pass B:** the rest, to about 99 a topic (23 more per difficulty), each writer reading pass A's
  questions on its topic first; the near-copy check compares the two passes as well as the bank.

Whatever the limit allows of pass B is kept; a topic is never left with nothing.

## How a question is checked

The same pipeline as before (`docs/ai-platform-plan.md`, `docs/question-bank-beast-academy.md`), run by
Claude Code agents outside the Worker: a Claude Sonnet writer per two or three topics; `lintQuestion`
(form, four distinct options with exactly one the key, the `compute` expression evaluated exactly, `$`
balance -- now in the options too -- and near-copies); a Claude Opus solver working each question blind
with the options shuffled and no key, whose answer `checkAnswer` must match and who judges whether there is
exactly one defensible answer, it is on the standard, it suits the grade and it is free of errors. Only
`checked` questions are kept; a platform admin approves them in the console.

Written from our own summaries of the standards, never from NCDPI's statements (the catalog's summaries,
as in the first writings).

**What changes for the new levels.**
- Kindergarten and Grade 1: an adult may read a question aloud but does not help; very short sentences,
  whole numbers in the standard's range. Shapes, picture graphs, clocks and coins are written out in words.
- Math 2 and the fourth-year courses: where a standard speaks of technology (regression, simulation), a
  question gives what the tool would (the fitted equation, r) and asks for the reasoning; where it is a
  process (modeling, study design, ethics), concrete choice questions about a described situation.
- No LaTeX environments, matrices or set and logic symbols: the Assessment's PDF prints the maths through
  a small converter (`mathTextToPlain`), so a matrix is written by its rows and set operations in words.

## The review of the bank so far

- 53 questions flagged in the Beast Academy writing (and 2 more this round) are replaced by new ones on the
  same chapter and difficulty, written to fix what the solver found, then solved blind again.
- The bank holds no key that stands out by length (no topic over half), and no option named by its
  position. One `\cup` the PDF converter printed as "cup" now reads "union".
- Two released BA1.07 questions said "the box" while showing "?", and a few solver notes on passing
  questions asked for clearer wording: fixed, solved again, and applied (see Results).

## Code

- `QUESTION_BANK_LEVEL_IDS` adds `NC26.K`, `NC26.1`, `NC26.2`, `NC26.M2`, `NC26.ALR`, `NC26.ASDS` and
  `NC26.MSM`, in catalog order; the console, the Assessment menu, Quest and Quest Games take their levels
  from it, on the web and in the app.
- Labels (`QUESTION_BANK_LEVEL_LABELS`): K, G1, G2, Math 2, Applied Logic, Stats & Data Science, Math
  Modeling. Every organization sees NC 2026's levels, as before.
- Quest's level order (`QUEST_LEVEL_FAMILIES`) runs from Kindergarten to Math 2; the three fourth-year
  courses, which no course follows, move nowhere.
- `lintQuestion` checks `$` balance in the options as well.
- No schema change.

## Release

Local suite and `npm run smoke` (web, iOS, Android) green; commit and push; demo refreshed
(`db:reset:test`); production backed up; the new questions loaded as `checked` (INSERTs only,
`ON CONFLICT DO NOTHING`); both Workers deployed. The writing's workspace is kept in
`~/aimtrue-question-bank/qb3` (briefs `PASS-A.md`, `WRITER-NC.md`, `REPAIR-4.md`, state `B4-STATE.md`).

## Results (2026-10-22)

Every topic in scope now holds 98-99 `checked` questions:

| Level | Topics | Questions |
| --- | --- | --- |
| NC 2026 Kindergarten | 12 | 1,188 |
| NC 2026 Grade 1 | 16 | 1,583 |
| NC 2026 Grade 2 | 14 | 1,385 |
| NC Math 2 | 17 | 1,683 |
| Applied Logic and Reasoning | 11 | 1,088 |
| Applied Statistics and Data Science | 13 | 1,286 |
| Mathematical and Statistical Modeling | 9 | 889 |
| AoPS Introduction to Algebra 14, 15, 18-22 | 7 | 693 |
| AoPS Introduction to Geometry 1-19 | 19 | 1,881 |

11,727 new questions in all (the bank goes from 18,571 to 30,298), from about 12,200 written: 2% were
flagged by the blind solver or the code checks and replaced. Two usage limits interrupted the writing; the
breadth-first order meant every topic already had its first 30 when the first one hit.

What the solvers flagged most, and the briefs then guarded against:
- **Level, not maths.** Kindergarten questions that asked HOW MUCH longer or chained two comparisons
  (Grade 1 work); plain arithmetic (62 - 50, a unit conversion) set inside an advanced course's
  conceptual standard.
- **Ambiguity.** A normal-distribution percent typed without "use the empirical rule" (a z-table gives a
  different number); "win outright"; whether an amount is gross or net; a method described differently
  from its definition (the method of markers).
- **Impossible premises.** Triangles whose sides cannot meet, a degree list with an odd sum, a trapezoid
  that cannot exist.
- **Giveaways.** The key strictly the longest option (up to two thirds of the choice questions on some
  process standards) and, once, the only option without a full stop. Those options were rewritten and the
  questions solved again; across the new choice questions the key is now strictly the longest in 10% and
  strictly the shortest in 9%.

The review of the bank already released: the 51 questions flagged in the Beast Academy writing were
replaced; eight released questions got wording fixes with unchanged keys (a square counting as a
rectangle, "the box" where a "?" is shown, "smallest whole number", flour for eggs), each solved again,
applied in production only where the row is still unapproved and unedited. The PDF converter now prints
floor, ceiling, continued fractions, sums, union and intersection.

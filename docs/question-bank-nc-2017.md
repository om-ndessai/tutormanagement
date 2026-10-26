# The question bank, round 5: North Carolina's 2017 standards

Requested by the owner on 2026-10-23: "Build the NC 2017 questions into question bank." Owner's choices
the same day:
- **How many:** 30 questions a standard first, then up to about 99, breadth first, as in round 4
  (`docs/question-bank-round-4.md`).
- **Who sees them:** NC 2017's levels appear only for an organization whose curriculum list offers NC
  2017, as Beast Academy's do, labelled with their year ("G4 (2017)"). NC 2026's levels stay everyone's.
- **When:** released after each pass, like round 4.

## Scope

NC 2017 in the catalog: 361 standards in 14 levels.

| Levels | Standards |
| --- | --- |
| Kindergarten, Grades 1-2 | 69 |
| Grades 3-5 | 62 |
| Grades 6-8 | 79 |
| NC Math 1, 2 and 3 | 129 |
| NC Math 4, Precalculus | 22 |

The bank held none of them. At about 99 a standard that is about 35,700 questions, three times round 4,
taking the bank from 30,298 to about 66,000.

## Breadth first

- **Pass A:** 30 questions a standard (10 per difficulty) for all 361, covering every skill each summary
  names. Writer groups of three standards are taken round robin across the 14 levels, so every level
  fills at the same pace and a usage limit never leaves a level empty.
- **Pass B:** 69 more a standard (23 per difficulty), each writer reading pass A's questions on its
  standard first. The near-copy check compares the two passes as well as the bank.
- After each pass: repair the flagged, scan for giveaways (the key strictly the longest or shortest
  option, an option alone in its ending), then release.

## How a question is checked

The same pipeline as before, run by Claude Code agents outside the Worker:
1. A Claude Sonnet writer per three standards writes from the catalog's own summaries, never NCDPI's
   statements.
2. `lintQuestion` checks the form, four distinct options with exactly one the key, the `compute`
   expression evaluated exactly, `$` balance, and near-copies.
3. A Claude Opus solver works each question blind, with the options shuffled and no key. `checkAnswer`
   must match its answer, and it judges single answer, alignment, grade and errors.

Only `checked` questions are kept. A platform admin approves them in the console, or a tutor does
through Quest.

The writer brief adds two things to round 4's:
- **Grades 3-8:** the answer is the kind of number the grade works with.
- **Math 4 and Precalculus:** complex numbers, matrices and vectors written by their rows or
  components, unit-circle values, and parametric equations and conics in words.

The PDF converter prints only simple LaTeX, so there are no environments, `\vec`, `\langle`,
`\binom`, `\sqrt[n]` or set symbols.

## Code

- `QUESTION_BANK_LEVEL_IDS` adds `NC17.K` ... `NC17.8`, `NC17.M1`-`NC17.M4` and `NC17.PC`, after NC
  2026's levels. Their labels are "K (2017)" ... "G8 (2017)", "Math 1 (2017)" ... "Math 4 (2017)" and
  "Precalculus (2017)".
- `assessmentLevelCurriculum` names `nc-2017` for them. `bankLevelOffered` (shared) is the one rule:
  - The Assessment menu, Quest Games and now Quest's level picker list a level only where the
    organization offers its curriculum, on the web and in the app (`offeredBankLevelIds`, which keeps
    a student's current level even after its curriculum is retired).
  - Setting a Quest level the organization does not offer is refused, as starting such an Assessment
    already was.
- Quest's level order (`QUEST_LEVEL_FAMILIES`) gains NC 2017 from Kindergarten to Math 3. Math 4 and
  Precalculus, which no course follows, move nowhere.
- **Reads.** The Assessment menu's and Quest Games' level lists count the questions each level can draw.
  For an organization with the unreviewed trial on, that read one index row per checked question in
  range: 30,301 rows on the demo database (2026-10-23), and it would have been about 66,000 once NC 2017
  was in. The count now reads only the topic ranges of the levels the organization offers, one statement
  per range in a batch, each seeking `questions_quest_idx` by status and topic: measured on the demo, one
  range reads 1,488 rows to count 1,485, where the same ranges joined by OR in one statement still read all
  30,301. An organization without NC 2017 never reads its questions. With the trial off, only approved questions
  are counted, through the index, as before (13 rows on the demo).
- No schema change.

## Release (after each pass)

1. Local suite and `npm run smoke` (web, iOS, Android) green.
2. Commit and push.
3. Refresh the demo: `deploy:test`, and load `db/questions.sql` there additively.
4. Back up production.
5. Load the new questions as `checked` (INSERTs only, `ON CONFLICT DO NOTHING`).
6. Deploy both Workers, from a clean worktree of the commit.

The workspace is `~/aimtrue-question-bank/qb3`:
- briefs: `PASS-A5.md`, `WRITER-NC17.md`, `solve-in/SOLVER-5.md`
- standards files: `build-standards5.mjs`
- state log: `B5-STATE.md`

## Results: first release (2026-10-25)

The owner asked on 2026-10-25 to release what was built so far and pick up the rest later. Released:
pass A on 340 of the 361 standards, plus pass B (69 more each) on the four standards it had finished,
NC.K.CC.1, NC.1.OA.1, NC.4.OA.1 and NC.5.OA.2.

| Level | Standards | With questions | Questions |
| --- | --- | --- | --- |
| Kindergarten | 23 | 22 | 721 |
| Grade 1 | 23 | 23 | 758 |
| Grade 2 | 23 | 23 | 690 |
| Grade 3 | 20 | 19 | 569 |
| Grade 4 | 25 | 23 | 758 |
| Grade 5 | 17 | 16 | 549 |
| Grade 6 | 31 | 28 | 838 |
| Grade 7 | 23 | 22 | 660 |
| Grade 8 | 25 | 25 | 750 |
| NC Math 1 | 41 | 38 | 1,133 |
| NC Math 2 | 47 | 43 | 1,284 |
| NC Math 3 | 41 | 36 | 1,071 |
| NC Math 4 | 10 | 10 | 300 |
| Precalculus | 12 | 12 | 359 |

That is 10,440 new questions, all `checked`, none approved; the bank goes from 30,298 to 40,738.

**The blind solve.** About 1% of pass A was flagged (99 questions), and 79 of them were rewritten and solved
again in a repair round (`ra5a-1`-`ra5a-4`), all but one kept. The flags, and what the briefs added:
- **A neighbouring standard.** Place value in a reading-numerals standard, an unknown addend solved by
  subtracting in an adding standard, one function in a comparing-functions standard. The pass brief now
  says every question must need the skill its own standard names.
- **Two defensible answers.** How quartiles are found, a probability word near 1/2, a measuring tool that
  also works, "first step" questions with two valid first steps. The writer brief now requires a stated
  quartile method and keeps probability words away from 1/2.
- **Impossible figures and contradictory numbers.** A net that cannot fold, an arc inconsistent with its
  angle, log values with no common base.
- **Too easy for the course.** One-step arithmetic in a Math 3 standard.

Across the released choice questions the key is strictly the longest option in 8.5% and strictly the
shortest in 6%.

**Held back** (16, kept out of this release for a wording fix): ten the solvers passed but noted, such as a
quartile on an odd-length list with no method stated, a clock face assumed round, or numbered lists that
sound like counts when read aloud; and three whose solutions name an option by its position. They are
listed in the workspace (`hold5.json`).

**Still to do.** 21 standards have no questions yet; their writers were stopped by the account's usage
limit:
- NC.K.G.5, NC.3.MD.8, NC.4.MD.8, NC.4.G.3, NC.5.G.3
- NC.6.EE.4, NC.6.EE.6, NC.6.G.3, NC.7.SP.2
- NC.M1.G-GPE.6, NC.M1.S-ID.1, NC.M1.S-ID.8
- NC.M2.F-IF.9, NC.M2.G-SRT.2, NC.M2.G-SRT.3, NC.M2.S-IC.2
- NC.M3.F-BF.3, NC.M3.F-LE.4, NC.M3.G-GPE.1, NC.M3.G-GMD.3, NC.M3.S-IC.4

Most have complete drafts waiting for the blind solve. Pass B is then to be finished on the other 357
standards, the 16 held questions fixed, and the second release made the same way. To resume, read the
workspace's `B5-STATE.md`.

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

**Still to do** (as of the first release; the 21 were done on 2026-10-28, below). 21 standards have no questions yet; their writers were stopped by the account's usage
limit:
- NC.K.G.5, NC.3.MD.8, NC.4.MD.8, NC.4.G.3, NC.5.G.3
- NC.6.EE.4, NC.6.EE.6, NC.6.G.3, NC.7.SP.2
- NC.M1.G-GPE.6, NC.M1.S-ID.1, NC.M1.S-ID.8
- NC.M2.F-IF.9, NC.M2.G-SRT.2, NC.M2.G-SRT.3, NC.M2.S-IC.2
- NC.M3.F-BF.3, NC.M3.F-LE.4, NC.M3.G-GPE.1, NC.M3.G-GMD.3, NC.M3.S-IC.4

Most have complete drafts waiting for the blind solve. Pass B is then to be finished on the other 357
standards, the 16 held questions fixed, and the second release made the same way. To resume, read the
workspace's `B5-STATE.md`.

## Second part (2026-10-28): the 21 missing standards and pass B, on branch `claude/sweet-darwin-s30s5m`

The first part's workspace stayed on the owner's Mac, so a cloud session rebuilt it from that session's
transcript. The briefs and scripts are now in the repository (`docs/question-bank-workspace/`, with a
README), so the work can resume anywhere. Same pipeline: Sonnet writers, `lintQuestion`, Opus solving
blind; only `checked` is kept, nothing approved.

**Done on this branch** (7,902 new questions, all `checked`, none approved; NC 2017 goes from 10,440 to
18,342 and the whole bank from 40,738 to 48,640):
- **Pass A on the 21 empty standards**: all 21 now hold questions. NC 2017 has no standard without them.
- **Pass B** (topping a standard up to about 99) on 110 of the 361 standards, taken round robin over the
  14 levels, so every level gained.
- **Repairs**: 50 questions the blind solver flagged were replaced by new ones on the same standard and
  difficulty and solved again; 10 flagged only for a lost backslash were fixed and solved again.

| Level | Standards | At ~99 | Questions before | Questions now |
| --- | --- | --- | --- | --- |
| Kindergarten | 23 | 9 | 721 | 1,304 |
| Grade 1 | 23 | 9 | 758 | 1,307 |
| Grade 2 | 23 | 8 | 690 | 1,240 |
| Grade 3 | 20 | 8 | 569 | 1,150 |
| Grade 4 | 25 | 9 | 758 | 1,368 |
| Grade 5 | 17 | 9 | 549 | 1,126 |
| Grade 6 | 31 | 8 | 838 | 1,476 |
| Grade 7 | 23 | 8 | 660 | 1,238 |
| Grade 8 | 25 | 7 | 750 | 1,232 |
| NC Math 1 | 41 | 7 | 1,133 | 1,706 |
| NC Math 2 | 47 | 7 | 1,284 | 1,882 |
| NC Math 3 | 41 | 7 | 1,071 | 1,695 |
| NC Math 4 | 10 | 7 | 300 | 779 |
| Precalculus | 12 | 7 | 359 | 839 |
| **All** | **361** | **110** | **10,440** | **18,342** |

About 3% of what was written was flagged by the blind solver, nearly all for alignment (a bare calculation
in a word-problem standard, a neighbouring standard's skill) or wording a child could read two ways, and
none of those was kept.

**Still to do** (stopped on 2026-10-28 at the owner's request, everything solved was merged first):
- **Pass B on the other 251 standards**: 228 hold 30-89 questions and 23 hold 27-30. `plan-b.mjs` lists
  them in round-robin order; at the pace so far that is about 17,000 more questions.
- **43 flagged questions not yet replaced** (the repair queue lived in the cloud session's scratchpad and
  is not kept). They are not in the bank; pass B's top-up to 99 covers their standards anyway.
- **The 16 held questions** of the first release are not here: their text never left the Mac
  (`qb3/hold5.json` and `final/`). They are not needed for coverage, since pass B fills those standards
  anyway; fix them there only if wanted.
- Pass B's top-up counts 33 per difficulty, so a standard that pass A left at 27-29 is filled to 99 too.

**New checks.** The blind solvers found LaTeX backslashes lost in the JSON: `"\times"` in a file is a tab
and "imes", and a JavaScript string drops `\c` from `\circ`. The workspace lint now refuses control
characters and LaTeX commands without their backslash. Scanning the whole bank found two released
worked solutions with the fault, fixed here:
- `83cc96af-54ea-4b18-b472-e4fa91041f7e` (NC17.M2.G-CO.3): "180^circ".
- `9d90b256-e008-4550-ac6d-54a1053ed04e` (NC26.M1): a form feed where `\frac` began.

## Release 2026-10-29: NC 2017's second part with Math Kangaroo

Merged into `main` on 2026-10-29 together with Math Kangaroo (`claude/awesome-faraday-gvx4rt`,
`docs/question-bank-kangaroo.md`), tagged `release-20261029-qb` (`release-20261029` was already that
morning's app and web release). No schema change. Since `release-20261025`:
a new curriculum (Math Kangaroo, six levels, `catalog/mk.json`), its 1,440 checked questions, NC 2017's
7,902 new checked questions, and `main`'s app and web fixes. The bank goes from 40,738 to 50,080.

Done in the cloud session (no Cloudflare login there): the merge, `questions.sql` and the sample
regenerated, `npm run typecheck` (the app's included), the lint over all 50,080 questions, the app's jest
(984/984, after one test learned that Math Kangaroo's levels need the `mk` curriculum offered), and the
local web suite: 266 of 267. The one failure, `responsive.spec.ts` "/select-organization does not scroll
sideways at 360px" (7px), is on a page this release does not touch (no `apps/web` change against `main`)
and most likely the cloud's Linux fonts measuring "Chapel Hill Math Institute" wider; check it on the Mac.
Not run there: `npm run smoke -- mobile` (no simulator on Linux) and `npm run test:compat`.

**On the Mac, from a clean checkout of `main`** (wrangler logged in to both accounts):

```bash
git checkout main && git pull && npm ci && npm run mobile:install
```

1. **The app's smoke**, the one gate the cloud could not run (the release changes the shared contract:
   six new level ids):

   ```bash
   npm run smoke -- mobile
   ```
2. **Math Kangaroo: backup, curriculum, questions.** Its loader backs production up to
   `~/tmi-portal-backups/`, runs `db/catalog.sql` (the new curriculum and its topics, before any question
   names them), loads the `MK*` levels' 1,440 checked questions and prints their count. It asks you to
   type `tutoring-db`:

   ```bash
   npm run questions:seed:production
   ```
3. **NC 2017's new questions.** Its loader would also resend the 10,440 already there and refuse on its
   write budget, so write only what is new since the last release (Math Kangaroo's, now loaded, are in the
   file too and are skipped by `ON CONFLICT`):

   ```bash
   node apps/api/db/release-questions.mjs --since=release-20261025 --out=$HOME/aimtrue-question-bank/release-20261029
   ```

   ```bash
   grep -cE '^(UPDATE|DELETE|DROP|ALTER)' $HOME/aimtrue-question-bank/release-20261029/questions-01.sql
   ```

   That must print 0. Then, from `apps/api`:

   ```bash
   npx wrangler d1 execute tutoring-db --remote --yes --file=$HOME/aimtrue-question-bank/release-20261029/questions-01.sql
   ```

   Steps 2 and 3 together write about 47,000 rows (a question is about five), inside the free plan's
   100,000 a day. Run nothing else heavy on production that day.
4. **The two worked-solution fixes**, only where nobody has edited or approved the row (from `apps/api`):

   ```bash
   npx wrangler d1 execute tutoring-db --remote --yes --command="UPDATE questions SET solution = replace(solution, '180^circ', '180^\circ') WHERE id = '83cc96af-54ea-4b18-b472-e4fa91041f7e' AND status = 'checked'; UPDATE questions SET solution = replace(solution, char(12), '\f') WHERE id = '9d90b256-e008-4550-ac6d-54a1053ed04e' AND status = 'checked';"
   ```
5. **Count** (read-only). NC 2017 should show 18,342 `checked` (fewer if some were approved meanwhile:
   approved plus checked is 18,342), and the bank 50,080 in all:

   ```bash
   npx wrangler d1 execute tutoring-db --remote --command="SELECT substr(topic_id, 1, instr(topic_id, '.') - 1) AS family, status, COUNT(*) FROM questions GROUP BY family, status ORDER BY family, status"
   ```
6. **Deploy both production Workers** (the code that knows the Math Kangaroo levels), then check both
   addresses answer `/api/health`:

   ```bash
   npm run deploy
   ```
7. **Refresh the demo**: deploy it, then its curriculum and the bank's sample (inserts only; about 1,150 new questions,
   some 6,000 rows, inside its 40,000 budget). From `apps/api`:

   ```bash
   npm run deploy:test
   ```

   ```bash
   npx wrangler d1 execute tutoring-test-db --remote --env tutoring-test --yes --file=./db/catalog.sql
   ```

   ```bash
   npx wrangler d1 execute tutoring-test-db --remote --env tutoring-test --yes --file=./db/questions-sample.sql
   ```

An organization sees Math Kangaroo's levels only once its admins offer the curriculum (Organization page,
Curricula card), as with NC 2017. **Do not run `npm run questions:export` before step 3**: it rewrites
`db/questions/*.json` from production and would drop every question not yet loaded.

**Size.** `questions.sql` is about 43 MB at 50,080 questions (about 0.85 KB each). GitHub refuses a file
over 100 MB, which this file reaches at roughly 115,000 questions; if the merged banks approach that,
split `questions.sql` by curriculum before committing it.

### Done on the Mac, 2026-10-29

Run from `main` at `release-20261029-qb`, by the steps above:
1. **Gates.** `npm run typecheck` clean; `npm run smoke -- web` 18/18; the app's smoke on release builds
   7/7 on the iOS simulator and 7/7 on the Android emulator, after one fix to the test: `diagnostics`
   opened its link while Android's release build was still starting, and the link was lost to the
   redirect to sign-in (the screen itself was right when opened by hand); the flow now waits for the
   sign-in screen first. `npm run test:compat` passed against `release-20261029` (21/21). The 360px
   `/select-organization` failure seen in the cloud was not looked at again: this release has no web change.
2. **Backup:** `~/tmi-portal-backups/tutoring-db-20261029-112316-pre-qb-20261029.sql` (43 MB). The
   loader's own export failed once with a Cloudflare authentication error (code 10000); a direct
   `wrangler d1 export` a minute later succeeded, and the loader then ran with `--skip-backup`.
   Catalog 1,615 rows written; Math Kangaroo 1,440 `checked` (240 a level), 7,200 rows.
3. **NC 2017:** 9,342 INSERTs (7,902 new; Math Kangaroo's skipped), 39,510 rows written.
4. **Both worked-solution fixes** applied (one row each).
5. **Count:** NC 2017 18,342 `checked`; the bank 50,068. The runbook's 50,080 assumed production held
   40,738; it held 40,726, and 40,726 + 1,440 + 7,902 = 50,068.
6. **Both production Workers deployed** (`tmi-portal` cbd48d40, `tutoring` 07d3b93a); both answer
   `/api/health`, serve the SPA, refuse `/api/users` without a session (401), sign-in on, sign-up closed.
7. **The demo:** deployed; catalog loaded; the sample added 5,732 questions (5,755 rows).

About 48,300 rows written to production that day, inside the 100,000.

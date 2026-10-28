# Pass B (round 5): more questions on every NC 2017 standard

QB=<the workspace folder: see README.md>

Your task names PARTs `b5-<topic_id>`, each one North Carolina 2017 standard. First read
`$QB/WRITER-NC17.md`; every rule there applies, with these changes.

- **The standard already has its first questions**, from pass A: `$QB/context/<topic_id>.json` ("in_bank":
  every question the bank already holds on it, and how many at each difficulty). Read them first. Yours must
  not repeat or closely imitate them -- the near-copy check compares every stem with them and with the bank.
- **Learn from pass A's flags.** About 1% of pass A was rejected by the blind solver. The commonest reasons: a question that
  tests a neighbouring standard instead of this one; two defensible answers (a convention such as how
  quartiles are found, a borderline word, a tool or option that also works); a figure or solid that cannot
  exist; numbers that contradict each other; a question far too easy for its course.
- **What this pass's solver has flagged so far** (2026-10-28), on top of those:
  - A bare calculation in a standard about word problems or stories (NC.1.OA.2, NC.4.OA.3): every question
    there is a story. A question whose stem already gives the number it asks for, or a figure count it only
    adds, tests nothing.
  - Counting words a child can read two ways: "counts on from 5 and says three numbers" (does 5 count?).
    Say "says the next three numbers after 5".
  - "Round each number" when the story has a number that should not be rounded; "matches" for two patterns
    (the same position, or the same value?); "within 2 standard deviations" (say "inclusive").
  - An option that is also true ("11 games for every 4 wins" beside "4 wins for every 7 losses").
  - A question solvable by inspection in a standard about a method (logs for $3^x = 27$).
  - **A LaTeX backslash lost in JSON.** In the file, `\times` must be written `\\times`; `\t`, `\f`, `\n`, `\b`
    and `\r` otherwise become control characters ("3 <tab>imes 7"). If a script writes the file, build it with
    `JSON.stringify`, and use `String.raw` or doubled backslashes in the script's own strings. The lint refuses it.
- **Write 69 new questions per PART: 23 at difficulty 1, 23 at 2, 23 at 3** -- or, when the task gives a
  different count per difficulty (a standard that lost some of its first 30), that count. The bank serves an adaptive
  test that needs many questions per standard, so that two children, or one child taking it twice, rarely
  see the same one.
- **Cover the whole standard.** Spread the 69 across every skill its summary names, favouring the skills
  pass A covered least; every skill at more than one difficulty, none more than about a fifth. Every
  question must need the skill this summary names, not only touch its topic.
- **Write it in three steps**, so no single file write is too long: write the difficulty-1 questions to
  `$QB/drafts/<PART>.json`, lint; then add the difficulty-2 ones, lint; then the difficulty-3 ones, lint.
- **The key must not stand out.** Across a part, the correct option may be the strictly longest of its four
  in at most a quarter of the choice questions, and the strictly shortest in at most a quarter. Every
  option of a question ends the same way (all with a full stop, or none). The lint prints both shares. Fix it by rewriting the WRONG options, never by padding the stem.
- If part of the standard cannot be tested fairly in text, write fewer and say why in "notes".
- Lint to 0 and re-read as the base brief says. A generator script, if any, goes in `$QB/scripts/`
  named after the PART.

Do not edit anything outside $QB/drafts and $QB/scripts.

Reply briefly per part: count by difficulty and kind, skills with rough counts, anything unsure or left out.

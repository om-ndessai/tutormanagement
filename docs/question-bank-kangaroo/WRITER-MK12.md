# Writer brief: Math Kangaroo, Grades 1-2 (level MK12)

You write ORIGINAL multiple-choice and numeric questions for a maths question bank, in the style of the
Math Kangaroo contest's youngest level (grades 1-2). The questions go to young children through an app,
so correctness and clarity matter more than anything else: every question will be solved blind by a
second model, and any question with a wrong key, two defensible answers, or unclear wording is thrown away.

## What Kangaroo questions at this level are like (from a review of the 2016-2025 papers)

- Short stories with a named child or animal (a kangaroo, a beaver, a squirrel, a frog, a dwarf...),
  one clear question at the end. Friendly, a little playful.
- Not textbook drill: each question has a small "aha" -- read carefully, count both ends, notice what
  stays the same, work backwards, try the cases, think about the most or fewest possible.
- Typical ideas: how many houses from number 15 to 47; cutting a rope into pieces; animals' legs and
  humps; lights and windows in rooms; queues ("7th from the front, 2nd from the back"); taller/shorter
  clue chains; two weighings giving a weight; two purchases giving a price; a repeating pattern's 27th
  item; one counter going up while another goes down; how many different two-digit numbers from given
  digits; children dancing in pairs; a machine dropping balls and "how many to be sure"; points gained
  for each hit; frogs singing on different nights; squirrels in trees, all different, at least 2 each,
  the most on one tree; glue drops between cubes stuck in a row; the opposite faces of a die.
- The 3-point questions are one easy step with a small twist; 4-point need two steps or careful reading;
  5-point need a real idea (casework, working backwards, a trap most children fall into).
- NEVER copy or closely paraphrase a real contest problem. Invent your own situations, names and numbers.
  Use the ideas above only as the kind of thinking to test.

## Rules for every question

1. **Text only.** There is no picture. Never write "picture", "figure", "diagram", "shown", "see below".
   Describe every arrangement fully in words (a row of 6 cubes, a tower, a grid of 3 rows and 4 columns,
   a walk "2 steps right, then 1 step up").
2. **Grades 1-2.** An adult may read the question aloud but gives no help. Short sentences (under ~60
   words in total). Whole numbers, mostly up to 100 (a few up to 200 at difficulty 3). No fractions
   beyond "half", no multiplication tables beyond doubling, counting in 2s, 5s, 10s and small equal groups.
   Clock times on the hour or half hour, days of the week, centimetres, metres, kilograms, euros or dollars.
3. **Exactly one defensible answer.** State every assumption: "both included", "each has a different
   number", "at least 1", "nobody is counted twice", "all the same size". Avoid words that read two ways
   ("between" -> say whether the ends count). Never "about" or "roughly".
4. **Money:** write "5 dollars", "3 euros", "8 cents" -- NEVER the "$" sign (it is a maths delimiter here).
   Avoid LaTeX entirely; write plain text ("3 + 4 = 7", "a box marked ?").
5. **kind "choice"** (about 20 of your 30 per topic): exactly 4 options, all different, all plausible --
   each wrong option should be what a child gets from a typical slip (off by one, forgot one end, added
   instead of subtracted). Numbers as options go in increasing order, like the contest. Word options
   (names, days, "Basket 3") should be similar in length, and the key must NOT be the longest or the
   shortest more often than chance. "answer" must be exactly the text of one option. No "all of the
   above", "none of the above", "impossible to tell" or "cannot be decided".
6. **kind "numeric"** (about 10 of 30): "choices": [], "answer" a whole number written as digits.
7. **compute:** when the answer is a number, an arithmetic expression that evaluates to it exactly using
   only digits, + - * / ^ and parentheses (e.g. "47 - 15 + 1"). Use null when the answer is a name or
   word, or the work is reasoning rather than a formula.
8. **solution:** 1-4 short sentences a parent could read to the child, ending at the answer. Never
   name an option by its letter or position ("option B", "the third choice").
9. **skill:** a short phrase for the idea tested ("Counting from 15 to 47, both included").
10. **Variety:** cover every skill the topic description names, roughly evenly. No two questions may be the
    same template with the numbers swapped; change the situation and the idea. Also vary names (use many
    names from many cultures) and settings.
11. **Correctness:** after writing each question, solve it again yourself from scratch as a child would.
    Check the key, check that no wrong option is also right, and check that the premise is possible
    (e.g. the numbers actually fit the clues).

## Difficulty

10 questions at difficulty 1 (3-point), 10 at difficulty 2 (4-point), 10 at difficulty 3 (5-point),
for EACH topic.

## Output

One JSON file per topic, at `<workspace>/drafts/<topic_id>.json`:

```json
{
  "topic_id": "MK12.01",
  "topic_name": "Counting and Numbers",
  "questions": [
    { "id": "MK12.01-001", "difficulty": 1, "kind": "choice", "skill": "...", "stem": "...",
      "choices": ["...", "...", "...", "..."], "answer": "...", "compute": "...", "solution": "..." }
  ]
}
```

Ids are `<topic_id>-001` ... `-030`. Write the file with a tool (not by hand-escaping in a shell): valid JSON.

Then run the code checks and fix everything they report, re-running until they print "all clean":

```
node <tools>/lint.mjs <workspace>/drafts/<topic_id>.json
```

It also prints how often the key is strictly the longest or shortest option; keep each under about 1 in 4
of the choice questions. Finish by reporting, per topic, the counts by difficulty and kind and anything
you were unsure about.

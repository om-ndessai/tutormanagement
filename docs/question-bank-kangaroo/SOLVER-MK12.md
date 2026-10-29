# Solver brief: blind check of Math Kangaroo Grades 1-2 questions

You are checking questions for a children's maths question bank (Math Kangaroo style, grades 1-2), text
only. You get the questions WITHOUT their answer keys, with the options shuffled. Solve each one
independently and judge it. Work only from your input file: do not open, search or list any other file
in the workspace (the drafts hold the keys; reading them would defeat the check).

For each question, decide:
- **answer**: for "choice", the exact text of the option you choose; for "numeric", the number.
- **single_answer**: true only if exactly one option (or one number) is defensible under a careful,
  literal reading. False if another option could also be argued, or none is right.
- **aligned**: the question tests the kind of problem its topic names (topic_name), roughly.
- **grade_appropriate**: a strong grade 1-2 child, with the question read aloud, could solve it
  (contest level: some are meant to be hard). False if it needs maths beyond grades 1-2 (multiplication
  facts beyond doubling and small equal groups, fractions beyond a half, big numbers) or depends on a
  picture that is not there.
- **error_free**: no mistakes in the maths or the wording, no impossible or contradictory premise, no
  reference to a picture, no option that gives the answer away, no cultural knowledge needed.
- **issues**: "" if all four are true; otherwise one or two sentences saying exactly what is wrong and how
  it could be fixed.
- **work**: one or two lines of your working.

Be strict: a question that is "probably fine" but could confuse a careful child should be marked down. But
do not mark a question down just because it is hard, if it is fair and has one answer.

Write a JSON array to the output path you are given, one object per input question, in input order:

```json
[{ "id": "MK12.01-001", "answer": "...", "single_answer": true, "aligned": true,
   "grade_appropriate": true, "error_free": true, "issues": "", "work": "..." }]
```

Write it with a file-writing tool so it is valid JSON. Then reply with how many you judged and a list of
the ids you marked down, each with a few words.

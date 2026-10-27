# Solver brief: blind check of Math Kangaroo questions (one level)

You are checking questions for a maths question bank in the style of the Math Kangaroo contest, text only.
Your task names the level and its grades. You get the questions WITHOUT their answer keys, with the options
shuffled. Solve each one independently and judge it. Work only from your input file: do not open, search
or list any other file in the workspace (the drafts hold the keys; reading them would defeat the check).

For each question, decide:
- **answer**: for "choice", the exact text of the option you choose; for "numeric", the number.
- **single_answer**: true only if exactly one option (or one number) is defensible under a careful,
  literal reading. False if another option could also be argued, or none is right.
- **aligned**: the question tests the kind of problem its topic names (topic_name), roughly.
- **grade_appropriate**: a strong student of the level's grades could solve it without a calculator, at
  contest level (some are meant to be hard). False if it needs maths well beyond those grades, or
  depends on a picture that is not there.
- **error_free**: no mistakes in the maths or the wording, no impossible or contradictory premise (check
  that the configuration exists with the given numbers), no reference to a picture, no option that gives
  the answer away.
- **issues**: "" if all four are true; otherwise one or two sentences saying exactly what is wrong and how
  it could be fixed.
- **work**: one or two lines of your working.

Be strict: a question that is "probably fine" but could mislead a careful student should be marked down.
Do not mark one down only for being hard, if it is fair and has one answer. Solve genuinely -- for counting
and number theory, check by a second method.

Write a JSON array to the output path you are given, one object per input question, in input order:

```json
[{ "id": "MK56.01-001", "answer": "...", "single_answer": true, "aligned": true,
   "grade_appropriate": true, "error_free": true, "issues": "", "work": "..." }]
```

Write it with a file-writing tool so it is valid JSON. Then reply with how many you judged and a list of
the ids you marked down, each with a few words.

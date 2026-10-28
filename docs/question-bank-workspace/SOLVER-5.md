# Solving questions blind

You check questions for an online maths check-up that students take at home, on a phone or a
computer, with no one helping. Each question belongs to one of North Carolina's 2017 standards, from Kindergarten to NC Math 3,
NC Math 4 and Precalculus. A wrong answer key or an ambiguous question misplaces a child.
For Kindergarten and Grade 1 an adult may read the question aloud but does not help.

S=<the workspace folder: see README.md>
Your PART (or PARTs) is given in your task.

Read ONLY `$S/solve-in/<PART>.json`. It lists questions, each with a ref, its standard (code, the
grade or course, its name and what it covers), the question, and either "options" (choose one) or
"answer_with": "a number". The questions come from different standards: judge each against its own. You are deliberately NOT given the intended answers: do not open, list or
search any other file or folder -- under $S (drafts/, solve-key/, context/, standards/, repair/, logs/, scripts/ and other
parts' solve-out/ files hold the keys), in the scratchpad above it, or in the repository -- and do not
look anything up. Solve from scratch. Maths is written in $...$ LaTeX.

For each question, solve it yourself carefully, showing your working; then judge it strictly:
- single_answer: exactly one answer is defensible as written.
- aligned: it tests the stated standard.
- grade_appropriate: its numbers, words and difficulty suit the stated grade or course.
- error_free: no mistake in the wording, the maths, or the options (for a choice question, exactly one
  option is correct), and nothing refers to a picture, table or diagram that is not written out.
Say what is wrong in "issues" (under 400 characters), or leave it "". Keep "work" under 2000
characters. For a choice question, final_answer is the option you chose, copied exactly character for
character; otherwise it is the number only (an integer, a decimal, a/b, or "w n/d"; no units, no "x =").

Write `$S/solve-out/<PART>.json` (one file per PART):

```
{ "results": [
  { "ref": "<its ref>", "work": "...", "final_answer": "...", "single_answer": true, "aligned": true,
    "grade_appropriate": true, "error_free": true, "issues": "" }
] }
```

One result per question, every ref, in order. Write valid JSON (escape backslashes and quotes). You
may write it in chunks or with a small script; if you use a script, keep it outside $S and name it
after your PART. Check the file parses (`node -e
"JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" <file>`) and that the number of
results equals the number of questions.

Reply briefly: how many questions per PART, and the refs where you found a problem, each with one line
on why.

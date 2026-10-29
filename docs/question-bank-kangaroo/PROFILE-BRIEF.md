# Brief: profile one Kangaroo level from ten years of papers

You are helping build a maths question bank in the style of the Math Kangaroo contest. The bank is text
only (no pictures) and every question is ORIGINAL. Your job is to read ten years of one level's papers and
describe what the level asks, so writers can produce original questions of the same kind and difficulty.

Input: the text extracted from the PDFs, `<src>/txt/<year>_<Level>.txt` for 2016-2025 (figures are missing
from the text; infer from the wording when a question depends on a picture). Each paper has 24 or 30
questions in thirds worth 3, 4 and 5 points, five options each. The answer keys are in
`<src>/pdf/<year>_Answers.pdf` if you need them (`pdftotext -layout`).

The papers are copyrighted. NEVER quote a question or paraphrase one closely in your output. Describe the
kinds of problems and ideas in your own general words ("two runners on a circular track meeting", not the
actual numbers or story).

Write `<out>` (markdown) with:
1. **Format**: questions per paper, years, anything unusual.
2. **Mix**: a table of the kinds of problem with a rough share each (sort every question by hand into a
   kind; say how many questions you sorted). Mark how many depend on a picture, and of those which ideas
   could still be posed fully in words.
3. **Maths the level uses**: number ranges, operations, fractions, algebra, geometry facts, notation, so
   writers keep to the level (what a strong student of these grades knows).
4. **What makes a 3-, 4- and 5-point question** at this level, with idea-level examples (no real numbers).
5. **Eight topics** for the bank, each a kind of contest problem that works in TEXT ONLY, together covering
   the level's mix (fold the picture-only kinds into whatever survives in words, e.g. "Geometry in words").
   For each: an id `<LEVEL>.01` ... `<LEVEL>.08`, a short name (2-5 words), and a one-sentence description
   listing its skills, in the style of: "Counting things described in words, how many whole numbers are in a
   range (house numbers 15 to 47), cuts and pieces of a rope, digits and two-digit numbers, and comparing
   numbers." Also a "unit" for each: one of Number, Algebra, Reasoning, Geometry, Combinatorics.
6. **Writer cautions**: typical ambiguities and traps to avoid when writing such problems in words.

Reply with a short summary (the eight topics with their units) once the file is written.

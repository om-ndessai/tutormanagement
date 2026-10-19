# Phase 41: the question bank on Beast Academy's chapters

Requested by the owner on 2026-10-18: "generate question bank based on beast academy topics". Owner's
choices the same day: **Levels 1-5 and the three AoPS books** the catalog files under Beast Academy
(116 chapters), **about 100 questions per chapter**, and **the bank only for now** (the Assessment menu
stays on NC 2026).

## What changes

- **The bank's levels.** `QUESTION_BANK_LEVEL_IDS` (shared) adds `BA1`-`BA5`, `PRE`, `ALG` and `GEO`; a
  question's topic is a chapter (`BA3.06`, "The Distributive Property"). No schema change: `questions.topic_id`
  already references any catalog topic.
- **The Assessment menu does not change.** It draws on `CANVAS_ASSESSMENT_LEVEL_IDS`, NC 2026's levels, and
  counts its questions by topic range, so the new chapters add no reads to it.
- **The console** (web and app) lists the levels in the bank's order, NC first, so the review in progress
  stays on top. Each new level appears as a section of chapters, with its coverage and review queue, as the
  NC levels do. The console's own writing prompts no longer say "North Carolina".
- **`generate-questions.mjs`** accepts the new levels; `db/questions/BA1.json` ... `GEO.json` hold them.

## How the questions are written

The same pipeline as the NC writings (`docs/ai-platform-plan.md`, "The second writing"), run by Claude Code
agents outside the Worker: a Sonnet writer per two chapters writes 99 per chapter (33 per difficulty) across
every skill the chapter's summary names; `lintQuestion` and the near-copy check; an Opus solver works each one
blind with the options shuffled; disagreements are rewritten and solved again; only `checked` questions are
kept, and a platform admin approves them in the console.

**Original work.** Beast Academy and AoPS are copyrighted books. The catalog holds the chapter names only, so
the writers work from the summaries below, written for this phase in our own words. They never reproduce a
problem or text from the books and never use their characters.

**Figures.** Several chapters are largely about pictures (Shapes, 3D Solids, much of Introduction to
Geometry). Writers test only what text can and may write fewer there; a platform admin can mark a chapter
"needs a figure", as with NC geometry.

**Reads and size.** The bank roughly doubles (about 11,500 more). Coverage reads every question once per
load, so a console load reads about twice as many rows; the review queue pages by status as before. D1 holds
the text easily (the NC bank is under 10 MB).

## Release

Local suite and `npm run smoke` (web, iOS, Android) green; commit and push; demo refreshed
(`db:reset:test`); production backed up; the new questions loaded as `checked` with
`generate-questions.mjs --production` (INSERTs only, `ON CONFLICT DO NOTHING`); both Workers deployed.

## The chapter summaries

### Beast Academy Level 1 (Ages 6-8 (about grade 1))

| Chapter | Name | Covers |
| --- | --- | --- |
| BA1.01 | Counting (1A) | Counting objects and counting on and back; how many whole numbers are in a range (for example from 12 to 20, both included); counting by 2s, 5s and 10s up to 100; the number just before or after. |
| BA1.02 | Shapes (1A) | Flat shapes: triangles, squares, rectangles, circles, pentagons and hexagons, named and described by their sides and corners; how many sides or corners a shape or a group of shapes has. Mostly about pictures: write only what words can test. |
| BA1.03 | Comparing (1A) | Comparing whole numbers up to 100 with more, fewer, greater than, less than and equal to; ordering a few numbers; how many more one group has than another. |
| BA1.04 | Addition (1B) | Addition facts within 20, making ten, adding a one-digit number to a two-digit number, adding tens, a missing addend (7 + ? = 15), and short story problems. |
| BA1.05 | Subtraction (1B) | Subtraction within 20 and of tens, take-away and how-many-more stories, subtraction as the opposite of addition, a missing number in a subtraction. |
| BA1.06 | Categories (1B) | Sorting things into groups by a rule; counting how many are in a group; groups that overlap (how many are in both, in either, or in neither), described in words. |
| BA1.07 | Addition & Subtraction (1C) | Fact families, missing numbers in addition and subtraction sentences, two-step story problems, adding and subtracting tens and ones within 100. |
| BA1.08 | Comparing (1C) | Comparing sums and differences without working them out (which is greater, 8 + 5 or 7 + 7), balancing two sides, and comparing lengths and amounts. |
| BA1.09 | Patterns (1C) | Repeating patterns and growing number patterns (adding or subtracting the same number each time): the next term, a missing term, and the 10th or 20th item of a repeating pattern. |
| BA1.10 | Big Numbers (1D) | Numbers to 1,000: hundreds, tens and ones, reading and writing three-digit numbers, adding and subtracting tens and hundreds, comparing big numbers. |
| BA1.11 | Measurement (1D) | Length measured in units (inches, centimeters, or how many of one object), comparing and adding lengths, and telling time to the hour and half hour in words. |
| BA1.12 | Problem Solving (1D) | Problem solving: small logic puzzles, guess and check, working backwards, and making an organized list, with numbers within 100. |

### Beast Academy Level 2 (Ages 7-9 (about grade 2))

| Chapter | Name | Covers |
| --- | --- | --- |
| BA2.01 | Place Value (2A) | Place value to 999: hundreds, tens and ones, expanded form, the value of a digit, and regrouping (3 hundreds and 14 tens is 440). |
| BA2.02 | Comparing (2A) | Comparing and ordering three-digit numbers, the distance between two numbers, and the greatest or least number that can be made from given digits. |
| BA2.03 | Addition (2A) | Adding two- and three-digit numbers mentally and on paper, regrouping, adding several numbers in a convenient order, and missing digits in a sum. |
| BA2.04 | Subtraction (2B) | Subtracting within 1,000, regrouping, subtraction as the distance between numbers, checking with addition, and missing digits in a difference. |
| BA2.05 | Expressions (2B) | Expressions with addition and subtraction: evaluating them, parentheses, equal and unequal expressions, keeping a difference the same by changing both numbers, and balancing an equation. |
| BA2.06 | Problem Solving (2B) | Problem solving with addition and subtraction: multi-step stories, working backwards, guess and check, and organized lists. |
| BA2.07 | Measurement (2C) | Length in inches, feet, yards, centimeters and meters; simple conversions (12 inches in a foot, 100 centimeters in a meter); adding and comparing lengths. |
| BA2.08 | Strategies (2C) | Mental strategies: adding or subtracting a nearby round number and adjusting, adding in a clever order, and counting how many numbers are in a list such as 15, 16, ..., 42. |
| BA2.09 | Odds & Evens (2C) | Odd and even numbers, whether a sum or difference is odd or even, pairing up, and counting the odd or even numbers in a range. |
| BA2.10 | Big Numbers (2D) | Numbers to 10,000: thousands, hundreds, tens and ones, counting by 10s, 100s and 1,000s, and adding and subtracting round numbers. |
| BA2.11 | Algorithms (2D) | The standard algorithms for adding and subtracting multi-digit numbers with regrouping, and missing-digit puzzles in a written sum or difference. |
| BA2.12 | Problem Solving (2D) | Mixed problem solving: patterns, organized lists, logic and multi-step stories. |

### Beast Academy Level 3 (Ages 8-10 (about grade 3))

| Chapter | Name | Covers |
| --- | --- | --- |
| BA3.01 | Shapes (3A) | Polygons by number of sides (triangle to octagon), sides and vertices, diagonals, kinds of quadrilaterals, and lines of symmetry described in words. |
| BA3.02 | Skip-Counting (3A) | Skip-counting by any number, how many numbers are in a list such as 4, 7, 10, ..., 61, the 20th number in such a list, and counting backwards. |
| BA3.03 | Perimeter & Area (3A) | Perimeter of rectangles and polygons from their side lengths, the area of a rectangle in square units, and a missing side from the perimeter or the area. |
| BA3.04 | Multiplication (3B) | Multiplication as equal groups and arrays, the facts, the order and grouping properties, multiplying by 10 and 100, and two-step stories. |
| BA3.05 | Perfect Squares (3B) | Square numbers (1, 4, 9, 16, ...), squares of numbers up to 20, the pattern of differences between squares, and square arrays. |
| BA3.06 | The Distributive Property (3B) | Breaking a product apart: 7 x 13 = 7 x 10 + 7 x 3, multiplying a two-digit number by a one-digit number mentally, and combining products with a common factor (6 x 17 + 4 x 17). |
| BA3.07 | Variables (3C) | Letters for unknown numbers: evaluating expressions, solving simple equations (x + 7 = 15, 3n = 21), and balance puzzles. |
| BA3.08 | Division (3C) | Division as sharing and as grouping, the division facts, remainders, division as the opposite of multiplication, and stories. |
| BA3.09 | Measurement (3C) | Units of length, weight, capacity and time (feet and inches, pounds and ounces, kilograms and grams, liters, hours and minutes), converting between them, and elapsed time. |
| BA3.10 | Fractions (3D) | Unit fractions, a fraction of a whole and of a group, equivalent fractions, comparing fractions, and where a fraction lies between whole numbers. |
| BA3.11 | Estimation (3D) | Rounding to the nearest 10, 100 or 1,000, estimating sums, differences and products, and deciding whether an answer is reasonable. |
| BA3.12 | Area (3D) | Area of rectangles, squares and shapes made of rectangles described by their measurements, and how area and perimeter differ. |

### Beast Academy Level 4 (Ages 9-12 (about grade 4))

| Chapter | Name | Covers |
| --- | --- | --- |
| BA4.01 | Shapes (4A) | Angles (acute, right, obtuse, straight), angle measures in degrees, triangles classified by sides and by angles, the angles of a triangle adding to 180 degrees, and kinds of quadrilaterals. |
| BA4.02 | Multiplication (4A) | Multiplying multi-digit numbers: the standard method, multiplying by multiples of 10, estimating products, and using the properties to multiply cleverly. |
| BA4.03 | Exponents (4A) | Powers as repeated multiplication, squares and cubes, powers of 10, evaluating expressions with exponents, and the order of operations. |
| BA4.04 | Counting (4B) | Counting carefully: organized lists, counting how many numbers in a list, the multiplication principle (outfits, meals, codes), and avoiding counting something twice. |
| BA4.05 | Division (4B) | Long division, remainders and what they mean in a story, dividing by multiples of 10, and divisibility by 2, 3, 5, 9 and 10. |
| BA4.06 | Logic (4B) | Logic puzzles: truth-tellers and liars, ordering people or things from clues, and deciding what must be true from a set of statements. |
| BA4.07 | Factors (4C) | Factors and multiples, primes and composites, prime factorization, counting factors, divisibility rules, and common factors and multiples. |
| BA4.08 | Fractions (4C) | Equivalent fractions, simplest form, comparing fractions, mixed numbers and improper fractions, and adding and subtracting fractions with like denominators. |
| BA4.09 | Integers (4C) | Negative numbers, comparing integers, adding and subtracting integers, distances between integers, and temperature and elevation stories. |
| BA4.10 | Fractions (4D) | Adding and subtracting fractions with unlike denominators, multiplying a fraction by a whole number, a fraction of a quantity, and fraction stories. |
| BA4.11 | Decimals (4D) | Tenths and hundredths, decimal place value, comparing and ordering decimals, converting between fractions and decimals, and adding and subtracting decimals. |
| BA4.12 | Probability (4D) | Probability of equally likely outcomes as a fraction: coins, number cubes, spinners and bags of marbles described in words, and impossible, certain and likely events. |

### Beast Academy Level 5 (Ages 10-13 (about grade 5))

| Chapter | Name | Covers |
| --- | --- | --- |
| BA5.01 | 3D Solids (5A) | Prisms, pyramids and cubes: faces, edges and vertices; the volume of a rectangular box; the surface area of a box; and how many small cubes make a larger one. |
| BA5.02 | Integers (5A) | Integers: all four operations including with negatives, the order of operations, absolute value, and comparing. |
| BA5.03 | Expressions & Equations (5A) | Simplifying expressions, combining like terms, the distributive property, and solving one- and two-step equations, including from stories. |
| BA5.04 | Statistics (5B) | Mean, median, mode and range; a missing value from a given mean; and how adding or changing a value changes them. |
| BA5.05 | Factors & Multiples (5B) | Greatest common factor, least common multiple, prime factorization, the number of factors, and stories about grouping and cycles. |
| BA5.06 | Fractions (5B) | Multiplying and dividing fractions and mixed numbers, reciprocals, and fraction stories. |
| BA5.07 | Sequences (5C) | Arithmetic sequences: the next term, the 50th term, how many terms, and the sum of a short sequence; simple patterns that multiply. |
| BA5.08 | Ratios & Rates (5C) | Ratios, equivalent ratios, part-to-part and part-to-whole, unit rates, and speed, distance and time. |
| BA5.09 | Decimals (5C) | Multiplying and dividing decimals, converting fractions to decimals and back, and rounding decimals. |
| BA5.10 | Percents (5D) | Percent as per hundred, a percent of a number, converting among fractions, decimals and percents, and percent increase and decrease. |
| BA5.11 | Square Roots (5D) | Square roots of perfect squares (including fractions and decimals), estimating a square root between two whole numbers, and solving x^2 = a number. |
| BA5.12 | Exponents (5D) | Rules for exponents with the same base, powers of powers, the zero exponent, comparing powers, and the last digit of a power. |

### AoPS Prealgebra (About grades 5-7)

| Chapter | Name | Covers |
| --- | --- | --- |
| PRE.01 | Properties of Arithmetic | The commutative, associative and distributive properties, identities and inverses, arithmetic with negative numbers and reciprocals, and using the properties to compute cleverly. |
| PRE.02 | Exponents | The laws of exponents, zero and negative exponents, powers of negative numbers, and the order of operations. |
| PRE.03 | Number Theory | Primes, prime factorization, divisibility rules, greatest common divisor, least common multiple, and the number of divisors. |
| PRE.04 | Fractions | All four operations with fractions and mixed numbers, simplifying, and fractions within fractions. |
| PRE.05 | Equations and Inequalities | Solving linear equations and inequalities in one variable, and writing them from word problems. |
| PRE.06 | Decimals | Operations with decimals, rounding, converting fractions to decimals, and turning repeating decimals into fractions. |
| PRE.07 | Ratios, Conversions, and Rates | Ratios, unit conversions, rates, speed, and work problems. |
| PRE.08 | Percents | Percent of a number, percent increase and decrease, successive percent changes, and simple interest. |
| PRE.09 | Square Roots | Square roots, simplifying square roots (the square root of 50 is 5 times the square root of 2), and estimating them. |
| PRE.10 | Angles | Angle measures, complementary and supplementary angles, vertical angles, parallel lines cut by a transversal, and the angles of a triangle and of a polygon, described in words. |
| PRE.11 | Perimeter and Area | Perimeter and area of rectangles, triangles, parallelograms, trapezoids and circles, and of shapes made from them, described by their measurements. |
| PRE.12 | Right Triangles and Quadrilaterals | The Pythagorean theorem, Pythagorean triples, 45-45-90 and 30-60-90 triangles, and the properties and areas of quadrilaterals. |
| PRE.13 | Data and Statistics | Mean, median, mode and range of data given as a list, and how they change when data change. |
| PRE.14 | Counting | Counting with the multiplication principle, casework, counting the complement, simple arrangements and selections, and overlapping groups. |
| PRE.15 | Problem-Solving Strategies | Problem-solving strategies: working backwards, finding a pattern, making a list, and logical reasoning. |

### AoPS Introduction to Algebra (Grades 6-9)

| Chapter | Name | Covers |
| --- | --- | --- |
| ALG.01 | Follow the Rules | The order of operations, evaluating expressions, the distributive property, and simplifying expressions with variables. |
| ALG.02 | x Marks the Spot | Writing and simplifying algebraic expressions, combining like terms, and translating words into algebra. |
| ALG.03 | One-Variable Linear Equations | Solving linear equations in one variable, including with fractions and variables on both sides, and word problems. |
| ALG.04 | More Variables | Expressions with several variables, and solving a formula for one variable in terms of the others. |
| ALG.05 | Multi-Variable Linear Equations | Systems of linear equations in two or three variables by substitution and elimination, and word problems that lead to them. |
| ALG.06 | Ratios and Percents | Ratios, percents, percent change, and mixture problems. |
| ALG.07 | Proportion | Direct and inverse variation, and solving proportions. |
| ALG.08 | Graphing Lines | Slope, intercepts, the equation of a line in slope-intercept, point-slope and standard form, and parallel and perpendicular lines, with points written as coordinates. |
| ALG.09 | Introduction to Inequalities | Solving linear inequalities, compound inequalities, and simple absolute value inequalities; describing the solutions in words or as intervals. |
| ALG.10 | Quadratic Equations – Part 1 | Factoring quadratics, solving quadratic equations by factoring, and the sum and product of the roots. |
| ALG.11 | Special Factorizations | Difference of squares, perfect square trinomials, sum and difference of cubes, and factoring tricks such as xy + x + y + 1 = (x + 1)(y + 1). |
| ALG.12 | Complex Numbers | The imaginary unit i, adding, subtracting, multiplying and dividing complex numbers, and conjugates. |
| ALG.13 | Quadratic Equations – Part 2 | Completing the square, the quadratic formula, the discriminant, and relationships between roots and coefficients. |
| ALG.14 | Graphing Quadratics | The vertex, axis of symmetry and intercepts of a parabola, vertex form, and maximum and minimum values, from equations. |
| ALG.15 | More Inequalities | Quadratic and rational inequalities, and using the fact that a square is never negative to find a maximum or minimum. |
| ALG.16 | Functions | Function notation, domain and range, composition, and inverse functions. |
| ALG.17 | Graphing Functions | How shifting, stretching and reflecting changes a function and its graph, described with equations and points rather than pictures. |
| ALG.18 | Polynomials | Adding, subtracting and multiplying polynomials, degree, the remainder and factor theorems, and roots of polynomials. |
| ALG.19 | Exponents and Logarithms | Rational exponents, exponential growth and decay, logarithms and their basic rules, and solving exponential equations. |
| ALG.20 | Special Functions | Absolute value, floor and ceiling, and piecewise-defined functions: evaluating them and solving equations with them. |
| ALG.21 | Sequences & Series | Arithmetic and geometric sequences and series, their sums, and infinite geometric series. |
| ALG.22 | Special Manipulations | Clever algebra: symmetric expressions (from x + y and xy), telescoping sums, substitutions, and nested expressions. |

### AoPS Introduction to Geometry (Grades 7-10)

| Chapter | Name | Covers |
| --- | --- | --- |
| GEO.01 | What's in a Name? | Points, lines, segments, rays, angles and polygons and how they are named; collinear points; and counting the segments, lines or triangles determined by points. |
| GEO.02 | Angles | Angle measures, parallel lines, the angle sum of a triangle, exterior angles, and the angle sums of polygons. |
| GEO.03 | Congruent Triangles | Congruent triangles (SSS, SAS, ASA, AAS), which facts do and do not guarantee congruence, and isosceles triangle properties. |
| GEO.04 | Perimeter and Area | Areas of triangles, parallelograms and trapezoids, triangles sharing a base or a height, and areas of composite shapes, described by their measurements. |
| GEO.05 | Similar Triangles | Similar triangles (AA), ratios of corresponding sides, scale factors, and the ratio of the areas of similar figures. |
| GEO.06 | Right Triangles | The Pythagorean theorem and triples, 45-45-90 and 30-60-90 triangles, and finding missing lengths. |
| GEO.07 | Special Parts of a Triangle | Medians, altitudes and angle bisectors of a triangle, the angle bisector theorem, the centroid dividing a median 2 to 1, and the incenter and circumcenter. |
| GEO.08 | Quadrilaterals | Properties of parallelograms, rectangles, rhombuses, squares, trapezoids and kites, and their areas. |
| GEO.09 | Polygons | Interior and exterior angle sums, regular polygons, the number of diagonals of a polygon, and the area of a regular hexagon. |
| GEO.10 | Geometric Inequalities | The triangle inequality, the largest angle lying opposite the longest side, and the possible lengths of a third side. |
| GEO.11 | Circles | Radius, diameter, circumference and area, arcs and sectors, chords, and tangent lines. |
| GEO.12 | Circles and Angles | Inscribed angles, central angles, and angles formed by chords, secants and tangents, with the arcs described in words. |
| GEO.13 | Power of a Point | Power of a point: intersecting chords, two secants, and a tangent and a secant from one point. |
| GEO.14 | Three-Dimensional Geometry | Prisms and pyramids: volume, surface area, and diagonals of a box. |
| GEO.15 | Curved Surfaces | Cylinders, cones and spheres: volume and surface area. |
| GEO.16 | The More Things Change... | Translations, reflections, rotations and dilations, described with coordinates. |
| GEO.17 | Analytic Geometry | Coordinates: distance, midpoint, slope, equations of lines and circles, and areas of polygons from their vertices. |
| GEO.18 | Introduction to Trigonometry | Sine, cosine and tangent in right triangles, values at 30, 45 and 60 degrees, and the laws of sines and cosines. |
| GEO.19 | Problem Solving Strategies in Geometry | Mixed geometry problems solved by drawing helpful lines, using areas, similarity or the Pythagorean theorem cleverly, described in words. |

## Where it stands (2026-10-19)

The owner paused the writing on the night of 2026-10-18; the account's usage limit stopped it soon after,
and the next morning the owner asked for what was built to be saved and **offered in the Assessment menu**.

- **In the bank:** 8,859 `checked` questions on 90 chapters: Beast Academy 1-5 (60), Prealgebra (15),
  Introduction to Algebra 1-13 and 16-17 (15). 51 flagged by the blind solve are left out until a repair
  round; most are wording (a phrase read two ways, reading level at Level 1, a chapter mismatch).
- **Not yet:** Algebra 14, 15 and 18-21 (written, not solved blind), Algebra 22 and all of Introduction
  to Geometry (not written). Their levels show in the console with no questions.
- **The Assessment menu** offers every bank level. A Beast Academy or AoPS level is offered only to an
  organization whose curriculum list includes Beast Academy (`assessmentLevelCurriculum` in shared; the
  route refuses one otherwise with 422). The picker reads "Level", not "Grade". Being `checked`, these
  questions are drawn only while the organization includes questions not yet reviewed, and the tutor's
  PDF marks them so, until a platform admin approves them in the console.
- **To resume:** the workspace is `~/aimtrue-question-bank/qb3` (briefs, tooling, drafts, flagged
  questions, `B3-STATE.md`).
